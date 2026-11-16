"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LabResult, LabResultRow } from "@/types/emr-domain";
import { discardLabResultDraft, getLabResultDraft, supersedeLabResultDraft, useLabAutosaveActorScope } from "../lab-autosave";
import { parsePersistedLabResult } from "../persisted-result-contract";
import { useLabResultPhase2 } from "../use-lab-result-phase2";
import { LabResultAttachmentArea, LabResultHistoryDialog } from "./lab-result-phase2";

export function formatLabHistoryValue(row: LabResultRow) {
  if (row.resultPresence === "instrument_no_result") return "측정 불가";
  if (!row.value?.trim()) return "미입력";
  const label = row.interpretationRule?.codes.find(code => code.code === row.value?.trim())?.label ?? row.value;
  return `${row.qualifier === "less_than" ? "< " : row.qualifier === "greater_than" ? "> " : ""}${label}`;
}

/** Saved historical values only. Never mount autosave for another attempt. */
function PriorLabResult({ base, resultId }: { base: LabResult; resultId: string }) {
  const [state, setState] = useState<{ result?: LabResult; error?: string }>({});
  const [retry, setRetry] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const phase2 = useLabResultPhase2(base.workspaceId, resultId, true);
  const { workspaceId, orderId, encounterId } = base;
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const params = new URLSearchParams({ resultId, orderId: orderId ?? "" });
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-entries?${params}`, { cache: "no-store", signal: abort.signal });
        const body: unknown = await response.json();
        if (abort.signal.aborted) return;
        const result = response.ok && orderId ? parsePersistedLabResult(body, { workspaceId, orderId, encounterId, resultId }, base) : null;
        setState(result ? { result } : { error: "이전 검사 결과를 불러오지 못했습니다." });
      } catch { if (!abort.signal.aborted) setState({ error: "이전 검사 결과를 불러오지 못했습니다." }); }
    })();
    return () => abort.abort();
  }, [workspaceId, orderId, encounterId, resultId, base, retry]);
  const result = state.result;
  if (state.error) return <div role="alert">{state.error} <Button variant="outline" size="sm" onClick={() => setRetry(n => n + 1)}>재시도</Button></div>;
  if (!result) return <p role="status">이전 검사 결과를 불러오는 중입니다.</p>;
  return <div className="space-y-4 pt-3">
    <table className="w-full text-left text-sm" aria-label="이전 검사 결과">
      <thead><tr>{["항목", "결과", "단위", "소견"].map(label => <th key={label} className="border-b px-2 py-2">{label}</th>)}</tr></thead>
      <tbody>{result.rows.map(row => <tr key={row.id} className="border-b align-top">
        <th scope="row" className="px-2 py-2 font-medium">{row.analyteName}</th><td className="px-2 py-2">{formatLabHistoryValue(row)}{row.deviceFlag && <span className="ml-2 text-muted-foreground">{row.deviceFlag}</span>}</td>
        <td className="px-2 py-2">{row.unit ?? "—"}</td><td className="whitespace-pre-wrap px-2 py-2">{row.note ?? "—"}</td>
      </tr>)}</tbody>
    </table>
    {phase2.status === "loading" ? <p role="status">소견과 첨부자료를 불러오는 중입니다.</p> : phase2.data ? <>
      {phase2.data.overallFinding && <section><h4 className="mb-1 text-sm font-medium">종합소견</h4><p className="whitespace-pre-wrap text-sm">{phase2.data.overallFinding}</p></section>}
      {[null, ...result.rows].map(row => {
        const attachments = phase2.data!.attachments.filter(item => item.rowId === (row?.id ?? null));
        return attachments.length ? <LabResultAttachmentArea key={row?.id ?? "overall"} result={result} row={row} attachments={attachments} enabled canEdit={false} refresh={phase2.refresh} /> : null;
      })}
      {!!phase2.data.events.length && <><Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>수정 이력</Button>
        <LabResultHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} result={result} events={phase2.data.events} /></>}
    </> : <div role="alert">소견과 첨부자료를 불러오지 못했습니다. <Button variant="outline" size="sm" onClick={phase2.refresh}>재시도</Button></div>}
  </div>;
}

export function PriorLabResults({ result }: { result: LabResult }) {
  const [selected, setSelected] = useState<string | null>(null);
  const actor = useLabAutosaveActorScope();
  const [, setDraftVersion] = useState(0);
  const priorIds = result.priorResults?.map(prior => prior.resultId).join(",") ?? "";
  useEffect(() => {
    const refresh = () => setDraftVersion(version => version + 1);
    window.addEventListener("clair-lab-superseded-draft", refresh);
    for (const id of priorIds.split(",").filter(Boolean)) supersedeLabResultDraft(actor, result.workspaceId, id);
    return () => window.removeEventListener("clair-lab-superseded-draft", refresh);
  }, [actor, result.workspaceId, priorIds]);
  if (!result.priorResults?.length) return null;
  const hasDraft = Boolean(actor && result.priorResults.some(prior => getLabResultDraft(actor, result.workspaceId, prior.resultId, "rows") !== undefined || getLabResultDraft(actor, result.workspaceId, prior.resultId, "overall") !== undefined));
  return <details open={hasDraft || undefined} className="rounded-lg border border-border bg-card p-4">
    <summary className="cursor-pointer text-sm font-medium">이전 검사 결과</summary>
    <div className="mt-3 flex flex-wrap gap-2">{result.priorResults.map(prior => <Button key={prior.resultId} variant="outline" size="sm"
      aria-pressed={selected === prior.resultId} onClick={() => setSelected(prior.resultId)}>
      {prior.taskAttemptNo ? `${prior.taskAttemptNo}회차` : "이전 결과"} · {new Date(prior.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
    </Button>)}</div>
    {actor && result.priorResults.map(prior => {
      const rows = getLabResultDraft<LabResultRow[]>(actor, result.workspaceId, prior.resultId, "rows");
      const overall = getLabResultDraft<string>(actor, result.workspaceId, prior.resultId, "overall");
      if (!rows && overall === undefined) return null;
      return <section key={prior.resultId} className="mt-3 space-y-2 rounded-lg border p-3">
        <p role="alert" className="text-sm">{prior.taskAttemptNo ?? "이전"}회차의 미저장 입력입니다. 재요청된 검사에는 반영되지 않습니다.</p>
        <details><summary className="cursor-pointer text-sm">미저장 입력 보기</summary>
          <dl className="space-y-2 pt-2 text-sm">{rows?.map(row => <div key={row.id}><dt>{row.analyteName}</dt>
            <dd className="whitespace-pre-wrap">{formatLabHistoryValue(row)} {row.unit} {row.deviceFlag}{row.note && ` · ${row.note}`}</dd></div>)}
            {overall !== undefined && <div><dt>종합소견</dt><dd className="whitespace-pre-wrap">{overall || "비어 있음"}</dd></div>}
          </dl>
        </details>
        <Button size="sm" variant="outline" onClick={() => discardLabResultDraft(actor, result.workspaceId, prior.resultId)}>미저장 입력 버리기</Button>
      </section>;
    })}
    {selected && <PriorLabResult key={selected} base={result} resultId={selected} />}
  </details>;
}
