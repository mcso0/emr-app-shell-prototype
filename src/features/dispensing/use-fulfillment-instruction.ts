"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  instructionDocumentSchema,
  instructionErrorMessages,
  type InstructionCommand,
  type InstructionDocument,
} from "@/features/fulfillment/instruction-contract";
import type { FulfillmentEligibleAssignee } from "@/features/fulfillment/server-fulfillment-assignee";

export type InstructionIntent = InstructionCommand extends infer Command
  ? Command extends InstructionCommand
    ? Omit<Command, "commandId" | "expectedRevision">
    : never
  : never;

export function useFulfillmentInstruction(
  workspaceId?: string,
  workItemId?: string,
  revisionKey?: string,
) {
  const endpoint =
    workspaceId && workItemId
      ? `/api/workspaces/${encodeURIComponent(workspaceId)}/fulfillment/work-items/${encodeURIComponent(workItemId)}/instruction`
      : null;
  const [loaded, setLoaded] = useState<{
    endpoint: string;
    document: InstructionDocument;
  } | null>(null);
  const [assignees, setAssignees] = useState<FulfillmentEligibleAssignee[]>([]);
  const [finishedRead, setFinishedRead] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const generation = useRef(0);
  const pending = useRef(false);
  const retry = useRef<{
    fingerprint: string;
    command: InstructionCommand;
  } | null>(null);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const readKey = `${endpoint}:${revisionKey}:${refreshKey}`;
  const loading = Boolean(endpoint && finishedRead !== readKey);
  const error = failure?.key === readKey ? failure.message : null;
  const setError = (message: string | null) =>
    setFailure(message ? { key: readKey, message } : null);

  useEffect(() => {
    const current = ++generation.current;
    const abort = new AbortController();
    if (!endpoint) return;
    const reportError = (message: string) =>
      setFailure({ key: readKey, message });
    void (async () => {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: abort.signal,
        });
        const body = await response.json();
        if (generation.current !== current) return;
        const parsed = instructionDocumentSchema.safeParse(body.document);
        if (!response.ok || body.ok !== true || !parsed.success) {
          reportError(
            instructionErrorMessages[body.error] ??
              "지시서를 불러오지 못했어요. 다시 시도해 주세요.",
          );
          setLoaded(null);
          return;
        }
        setFailure(null);
        setAssignees([]);
        setLoaded({ endpoint, document: parsed.data });
        try {
          const candidatesResponse = await fetch(
            endpoint.replace(/instruction$/, "assignees"),
            { cache: "no-store", signal: abort.signal },
          );
          const candidates = await candidatesResponse.json();
          if (generation.current !== current) return;
          if (!candidatesResponse.ok || !candidates.ok || !Array.isArray(candidates.assignees)) {
            throw new Error("assignee_read_failed");
          }
          setAssignees(
            candidates.assignees.filter(
              (item: FulfillmentEligibleAssignee) =>
                typeof item.userId === "string" &&
                typeof item.displayName === "string",
            ),
          );
        } catch {
          if (!abort.signal.aborted && generation.current === current)
            reportError("담당자 목록을 불러오지 못했어요.");
        }
      } catch {
        if (!abort.signal.aborted && generation.current === current)
          reportError("지시서를 불러오지 못했어요. 다시 시도해 주세요.");
      } finally {
        if (generation.current === current) setFinishedRead(readKey);
      }
    })();
    return () => {
      generation.current = current + 1;
      abort.abort();
    };
  }, [endpoint, readKey]);

  const document = loaded?.endpoint === endpoint ? loaded.document : null;
  const mutate = async (intent: InstructionIntent) => {
    if (!endpoint || !document || loading || pending.current) return false;
    const current = generation.current;
    const fingerprint = JSON.stringify({
      endpoint,
      intent,
      revision: document.revision,
    });
    if (retry.current?.fingerprint !== fingerprint) {
      retry.current = {
        fingerprint,
        command: {
          ...intent,
          commandId: crypto.randomUUID(),
          expectedRevision: document.revision,
        },
      };
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retry.current.command),
      });
      const body = await response.json();
      if (generation.current !== current) return false;
      const parsed = instructionDocumentSchema.safeParse(body.document);
      if (!response.ok || body.ok !== true || !parsed.success) {
        setError(
          instructionErrorMessages[body.error] ??
            "변경을 저장하지 못했어요. 다시 시도해 주세요.",
        );
        return false;
      }
      retry.current = null;
      setLoaded({ endpoint, document: parsed.data });
      return true;
    } catch {
      if (generation.current === current)
        setError(
          "변경 결과를 확인하지 못했어요. 다시 시도하면 같은 요청의 결과를 확인해요.",
        );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return { document, assignees, loading, busy, error, refresh, mutate };
}

export type FulfillmentInstructionController = ReturnType<
  typeof useFulfillmentInstruction
>;
