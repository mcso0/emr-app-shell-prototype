"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isExecutionRecord } from "@/features/fulfillment/execution-result-contract";
import { parseChartActualContext, parseChartActualPayload, type ChartActualContext } from "./chart-actual-contract";

export function ChartActualHistory({ workspaceId, taskId, onSaved }: { workspaceId: string; taskId: string; onSaved?: () => Promise<void> }) {
  const [context, setContext] = useState<ChartActualContext | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [performedAt, setPerformedAt] = useState("");
  const [reason, setReason] = useState("");
  const [selfPerformed, setSelfPerformed] = useState(false);
  const [reload, setReload] = useState(0);
  const command = useRef<{ hash: string; id: string } | null>(null);
  const scope = useRef(0);
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/tasks/${encodeURIComponent(taskId)}/actual`;
  useEffect(() => {
    const generation = ++scope.current;
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: abort.signal });
        const body: unknown = await response.json();
        if (scope.current !== generation) return;
        const next = response.ok && isExecutionRecord(body) && body.ok === true ? parseChartActualContext(body.context, workspaceId, taskId) : null;
        if (!next) { setError("실제 수행 이력을 불러오지 못했습니다. 권한·연결을 확인하고 다시 시도해 주세요."); return; }
        setContext(next); setError("");
      } catch { if (!abort.signal.aborted && scope.current === generation) setError("실제 수행 이력을 불러오지 못했습니다."); }
      finally { if (scope.current === generation) setLoading(false); }
    })();
    return () => { scope.current = generation + 1; abort.abort(); };
  }, [endpoint, reload, workspaceId, taskId]);
  const save = async () => {
    if (!context || saving || (context.canRecord ? !selfPerformed : !reason.trim()) || !performedAt || !Number.isFinite(Date.parse(performedAt)) || !parseChartActualPayload(context.clinicalOrderType, payload)) return;
    const generation = scope.current;
    const common = { expectedPlanSha256: context.planSha256, performedAt: new Date(performedAt).toISOString(), payload };
    const input = context.canRecord ? { ...common, action: "record", selfPerformed }
      : { ...common, expectedResultVersion: context.results.at(-1)!.version, amendmentReason: reason.trim() };
    const hash = JSON.stringify(input);
    if (command.current?.hash !== hash) command.current = { hash, id: crypto.randomUUID() };
    setSaving(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, commandId: command.current.id }) });
      const body: unknown = await response.json();
      if (generation !== scope.current) return;
      const next = response.ok && isExecutionRecord(body) && body.ok === true ? parseChartActualContext(body.context, workspaceId, taskId) : null;
      if (!next) { setError("수행 기록 저장을 확인하지 못했습니다. 충돌이 발생했다면 이력을 다시 불러온 뒤 확인해 주세요."); return; }
      setContext(next); setEditing(false); setReason(""); setSelfPerformed(false); command.current = null;
      await onSaved?.();
    } catch { if (generation === scope.current) setError("수행 기록 저장 결과를 확인하지 못했습니다. 같은 입력으로 재시도할 수 있습니다."); }
    finally { if (generation === scope.current) setSaving(false); }
  };
  const head = context?.results.at(-1);
  return <div className="mt-3 grid gap-2 border-t border-[var(--emr-border-default)] pt-3">
    <strong className="text-sm">실제 수행 기록</strong>
    {loading ? <p role="status">불러오는 중…</p> : null}
    {error ? <><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" disabled={saving} onClick={() => { setEditing(false); setLoading(true); setReload(value => value + 1); }}>이력 다시 불러오기</Button></> : null}
    {context && !context.canRecord && !context.results.length ? <p className="text-sm">보존된 실제 수행 기록이 없는 이전 오더입니다. 완료 상태만으로 실제 결과를 추정하지 않습니다.</p> : null}
    {context?.results.map(result => <div key={result.id} className="grid gap-1 rounded border border-[var(--emr-border-default)] p-2 text-sm">
      <strong>실제 기록 v{result.version}</strong>
      {Object.entries(result.payload).map(([key, value]) => <p className="whitespace-pre-wrap" key={key}>{key === "findingSummary" ? "소견" : key === "outcome" ? "결과" : "수행 내용"}: {value}</p>)}
      <p>수행: {new Date(result.performedAt).toLocaleString()} · {result.performedByUserId}</p>
      <p>기록: {new Date(result.recordedAt).toLocaleString()} · {result.recordedByUserId}</p>
      {result.amendmentReason ? <p>정정 사유: {result.amendmentReason}</p> : null}
    </div>)}
    {context?.canRecord && !editing ? <>
      <p className="text-sm">계획이 확정되었습니다. 실제 수행 후 결과를 기록해 주세요.</p>
      <Button onClick={() => {
        setPayload(context.clinicalOrderType === "system_exam" ? { findingSummary: "" } : { performedActivity: "", outcome: "" });
        setPerformedAt(""); setSelfPerformed(false); setEditing(true);
      }}>수행 결과 기록</Button>
    </> : null}
    {context?.canAmend && head && !editing ? <Button variant="outline" onClick={() => {
      setPayload({ ...head.payload }); const date = new Date(head.performedAt);
      setPerformedAt(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      setReason(""); setEditing(true);
    }}>실제 기록 정정</Button> : null}
    {editing ? <div className="grid gap-2">
      <p className="text-sm">{context?.canRecord ? "실제 수행한 내용과 시각을 입력해 주세요. 저장하면 수행 완료로 반영됩니다." : "원래 수행자와 확정 계획은 유지하고 새 정정본을 추가합니다."}</p>
      {Object.keys(payload).map(key => <label className="grid gap-1 text-sm" key={key}>{context?.canRecord ? "" : "정정 "}{key === "findingSummary" ? "소견" : key === "outcome" ? "결과" : "수행 내용"}
        <Textarea value={payload[key]} disabled={saving} maxLength={4000} onChange={event => setPayload(current => ({ ...current, [key]: event.target.value }))} /></label>)}
      <label className="grid gap-1 text-sm">실제 수행 시각<Input type="datetime-local" value={performedAt} disabled={saving} onChange={event => setPerformedAt(event.target.value)} /></label>
      {context?.canRecord ? <label className="flex items-center gap-2 text-sm"><Switch checked={selfPerformed} disabled={saving} onCheckedChange={setSelfPerformed} />현재 로그인한 내가 실제 수행했고 위 결과가 맞음을 확인</label>
        : <label className="grid gap-1 text-sm">정정 사유<Textarea value={reason} maxLength={500} disabled={saving} onChange={event => setReason(event.target.value)} /></label>}
      <Button disabled={saving || (context?.canRecord ? !selfPerformed : !reason.trim()) || !performedAt || !context || !parseChartActualPayload(context.clinicalOrderType, payload)} onClick={() => void save()}>{context?.canRecord ? "수행 완료" : "정정본 저장"}</Button>
      <Button variant="outline" disabled={saving} onClick={() => setEditing(false)}>취소</Button>
    </div> : null}
  </div>;
}
