"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { Textarea } from "@/components/ui/textarea";
import { oralInstructionSchema, type OralInstruction } from "./chart-oral-instruction-contract";

export function ChartOralInstructionEditor({ workspaceId, chartId, disabled }: { workspaceId: string; chartId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return <><Button size="sm" variant="ghost" onClick={() => setOpen(true)}>경구제 전체 지시</Button>
    <Dialog open={open} onOpenChange={setOpen}>{open && <Editor key={chartId} workspaceId={workspaceId} chartId={chartId} disabled={disabled} close={() => setOpen(false)} />}</Dialog></>;
}
function Editor({ workspaceId, chartId, disabled, close }: { workspaceId: string; chartId: string; disabled: boolean; close: () => void }) {
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/charts/${encodeURIComponent(chartId)}/oral-instruction`;
  const [document, setDocument] = useState<OralInstruction | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: abort.signal });
        const body = await response.json();
        if (abort.signal.aborted) return;
        const parsed = oralInstructionSchema.safeParse(body.document);
        if (!response.ok || !body.ok || !parsed.success) throw new Error();
        setDocument(parsed.data); setDraft(parsed.data.instruction); setError(null);
      } catch { if (!abort.signal.aborted) setError("지시사항을 불러오지 못했어요. 다시 조회해 주세요."); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, [endpoint, retry]);
  async function save() {
    if (!document || saving || disabled || !document.canEdit) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: document.revision, instruction: draft }) });
      const body = await response.json();
      const parsed = oralInstructionSchema.safeParse(body.document);
      if (!response.ok || !body.ok || !parsed.success) {
        setError(body.error === "revision_conflict" ? "다른 사용자가 지시사항을 변경했어요. 입력 내용을 확인하고 다시 조회해 주세요." : "저장하지 못했어요. 입력 내용은 유지됩니다.");
        return;
      }
      setDocument(parsed.data); close();
    } catch { setError("저장 결과를 확인하지 못했어요. 다시 조회해 주세요."); }
    finally { setSaving(false); }
  }
  return <EmrDialogShell title="경구제 전체 지시사항" description="현재 차트의 경구제 오더 전체에 적용됩니다."
    secondaryAction={<Button variant="outline" disabled={saving} onClick={close}>취소</Button>}
    primaryAction={<Button disabled={loading || saving || disabled || !document?.canEdit || draft === document.instruction} onClick={() => void save()}>{saving ? "저장 중" : "저장"}</Button>}>
    {loading ? <p role="status">지시사항을 불러오는 중이에요.</p> : <Textarea aria-label="경구제 전체 지시사항" maxLength={5000} value={draft} disabled={saving || disabled || !document?.canEdit} onChange={e => setDraft(e.target.value)} />}
    {error && <div role="alert"><p>{error}</p><Button variant="outline" disabled={saving} onClick={() => { setLoading(true); setRetry(n => n + 1); }}>다시 조회</Button></div>}
    {!!document?.history.length && <details className="mt-3 text-sm"><summary>변경 이력</summary>{document.history.map(item => <div className="mt-2 whitespace-pre-wrap" key={item.revision}><time>{item.createdAt}</time>{item.actorName && <span> · {item.actorName}</span>}<p>{item.instruction || "지시사항 삭제"}</p></div>)}</details>}
  </EmrDialogShell>;
}
