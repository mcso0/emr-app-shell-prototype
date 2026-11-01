"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { instructionReviewListSchema, instructionReviewTargetId, type TaskInstructionReview } from "./task-instruction-review-contract";

export function useTaskInstructionReview(workspaceId: string | undefined, taskIds: readonly string[], revisionKey?: string, targetKind: "task" | "order" = "task", contextId = "") {
  const ids = [...new Set(taskIds)].sort().join(",");
  const endpoint = workspaceId ? `/api/workspaces/${encodeURIComponent(workspaceId)}/fulfillment/instruction-review` : null;
  const identity = `${endpoint}:${ids}:${targetKind}:${contextId}`;
  const active = useRef(identity);
  useLayoutEffect(() => { active.current = identity; return () => { active.current = ""; }; }, [identity]);
  const sequence = useRef(0);
  const pending = useRef(false);
  const requests = useRef(new Set<AbortController>());
  const [loaded, setLoaded] = useState<{ identity: string; reviews: TaskInstructionReview[] } | null>(null);
  const [failure, setFailure] = useState<{ identity: string; message: string } | null>(null);
  const [openFor, setOpenFor] = useState<{ identity: string; ids: string[] } | null>(null);
  const [busyFor, setBusyFor] = useState<string | null>(null);
  const reviews = loaded?.identity === identity ? loaded.reviews : [];
  const error = failure?.identity === identity ? failure.message : null;

  const read = useCallback(async (targets = ids ? ids.split(",") : []) => {
    if (!endpoint || targets.length === 0) return [];
    const current = ++sequence.current;
    const abort = new AbortController(); requests.current.add(abort);
    try {
      const response = await fetch(`${endpoint}?${targetKind}Ids=${encodeURIComponent(targets.join(","))}`, { cache: "no-store", signal: abort.signal });
      const body = await response.json();
      if (abort.signal.aborted || active.current !== identity || current !== sequence.current) return null;
      const parsed = instructionReviewListSchema.safeParse(body.reviews);
      if (!response.ok || !body.ok || !parsed.success || parsed.data.length !== targets.length || parsed.data.some(item => !targets.includes(instructionReviewTargetId(item)) || (targetKind === "task" ? !item.taskId : !item.orderId)) || new Set(parsed.data.map(instructionReviewTargetId)).size !== targets.length) {
        if ([401, 403, 404].includes(response.status)) setLoaded(null);
        throw new Error("지시사항을 불러오지 못했습니다. 다시 확인해 주세요.");
      }
      setLoaded(previous => ({ identity, reviews: [...(previous?.identity === identity ? previous.reviews.filter(item => !targets.includes(instructionReviewTargetId(item))) : []), ...parsed.data] }));
      setFailure(null);
      return parsed.data;
    } catch {
      if (!abort.signal.aborted && active.current === identity && current === sequence.current)
        setFailure({ identity, message: "지시사항을 불러오지 못했습니다. 다시 확인해 주세요." });
      return null;
    } finally { requests.current.delete(abort); }
  }, [endpoint, identity, ids, targetKind]);

  useEffect(() => {
    queueMicrotask(() => { if (active.current === identity) void read(); });
    const refresh = () => { if (!pending.current) void read(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("clair-instructions-changed", refresh);
    const controllers = requests.current;
    return () => {
      controllers.forEach(abort => abort.abort()); controllers.clear();
      pending.current = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("clair-instructions-changed", refresh);
    };
  }, [read, revisionKey, identity]);

  const check = async (targets = ids ? ids.split(",") : []) => {
    if (!endpoint || targets.length === 0) return true;
    if (pending.current) return false;
    pending.current = true; setBusyFor(identity);
    try {
      const current = await read(targets);
      if (!current || active.current !== identity) return false;
      if (current.some(item => item.requiresAcknowledgement)) { setOpenFor({ identity, ids: targets }); return false; }
      return true;
    } finally { if (active.current === identity) { pending.current = false; setBusyFor(null); } }
  };
  const acknowledge = async () => {
    if (!endpoint || pending.current || openFor?.identity !== identity) return;
    pending.current = true; setBusyFor(identity); setFailure(null);
    const selected = reviews.filter(item => openFor.ids.includes(instructionReviewTargetId(item)) && item.requiresAcknowledgement && item.current);
    const unique = selected.filter((item, index) => selected.findIndex(other => other.current?.chartId === item.current?.chartId && other.current?.versionKey === item.current?.versionKey) === index);
    const abort = new AbortController(); requests.current.add(abort);
    try {
      for (const item of unique) {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
          body: JSON.stringify({ [targetKind === "order" ? "orderId" : "taskId"]: instructionReviewTargetId(item), versionKey: item.current!.versionKey }) });
        const body = await response.json();
        if (active.current !== identity || abort.signal.aborted) return;
        if (!response.ok || !body.ok) {
          await read(openFor.ids);
          throw new Error(body.error === "instruction_version_conflict" ? "지시가 다시 변경되었습니다. 최신 내용을 확인해 주세요." : "확인을 저장하지 못했습니다. 다시 시도해 주세요.");
        }
      }
      const current = await read(openFor.ids);
      if (active.current === identity && current && !current.some(item => item.requiresAcknowledgement)) setOpenFor(null);
    } catch (failure) {
      if (!abort.signal.aborted && active.current === identity) setFailure({ identity, message: failure instanceof Error ? failure.message : "확인을 저장하지 못했습니다." });
    } finally {
      requests.current.delete(abort);
      if (active.current === identity) { pending.current = false; setBusyFor(null); }
    }
  };
  return {
    workspaceId, reviews, error, busy: busyFor === identity, open: openFor?.identity === identity,
    selected: reviews.filter(item => openFor?.identity === identity && openFor.ids.includes(instructionReviewTargetId(item))),
    refresh: () => read(ids ? ids.split(",") : reviews.map(instructionReviewTargetId)), check, acknowledge,
    show: () => { setOpenFor({ identity, ids: ids ? ids.split(",") : reviews.map(instructionReviewTargetId) }); void read(ids ? ids.split(",") : reviews.map(instructionReviewTargetId)); },
    close: () => { if (!pending.current) setOpenFor(null); },
    requireReview: () => { const targets = ids ? ids.split(",") : reviews.map(instructionReviewTargetId); setOpenFor({ identity, ids: targets }); void read(targets); },
  };
}
export type TaskInstructionReviewController = ReturnType<typeof useTaskInstructionReview>;
