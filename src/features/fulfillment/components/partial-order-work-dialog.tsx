"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { partialWorkSchema } from "../partial-order-work-contract";
export function PartialOrderWorkDialog({ workspaceId, taskId, name, onClose, onSaved }: { workspaceId: string; taskId: string; name: string; onClose: () => void; onSaved: () => void }) {
 const [document, setDocument] = useState<z.infer<typeof partialWorkSchema> | null>(null), [note, setNote] = useState(""), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
 const pending = useRef(false), generation = useRef(0), retry = useRef<{ fingerprint: string; commandId: string } | null>(null);
 const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/fulfillment/partial-work?taskId=${taskId}`;
 useEffect(() => {
  const current = ++generation.current; const abort = new AbortController();
  void fetch(endpoint, { cache: "no-store", signal: abort.signal }).then(async response => {
   const body = await response.json(); if (current !== generation.current) return;
   const parsed = partialWorkSchema.safeParse(body.document); if (!response.ok || !body.ok || !parsed.success) throw new Error();
   setDocument(parsed.data); setError(null);
  }).catch(() => { if (!abort.signal.aborted && current === generation.current) setError("부분 수행 기록을 불러오지 못했어요."); });
  return () => { generation.current = current + 1; abort.abort(); };
 }, [endpoint, reload]);
 const save = async () => {
  if (!document?.canRecord || !note.trim() || pending.current) return;
  const fingerprint = JSON.stringify({ revision: document.revision, note });
  if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, commandId: crypto.randomUUID() };
  pending.current = true; setBusy(true); const current = generation.current;
  try {
   const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commandId: retry.current.commandId, expectedRevision: document.revision, note }) }); const body = await response.json();
   if (current !== generation.current) return;
   const parsed = partialWorkSchema.safeParse(body.document); if (!response.ok || !body.ok || !parsed.success) throw new Error();
   setDocument(parsed.data); setNote(""); setError(null); retry.current = null; onSaved();
  } catch { if (current === generation.current) setError("저장하지 못했어요. 입력은 보존했어요. 담당자와 최신 작업 상태를 확인해 주세요."); }
  finally { pending.current = false; if (current === generation.current) setBusy(false); }
 };
 return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}><EmrDialogShell title={`${name} · 부분 수행 기록`} variant="wide-form" showCloseButton={!busy}
  secondaryAction={<Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>}
  primaryAction={<Button disabled={busy || !document?.canRecord || !note.trim()} onClick={() => void save()}>기록 저장</Button>}>
  <div className="space-y-3">{!document && !error && <p role="status">부분 수행 기록을 불러오는 중…</p>}{document?.notes.map((item, index) => <section key={index} className="rounded-lg border p-3 text-sm"><p className="mb-1 text-xs text-muted-foreground">{item.attemptNo}회차 · {item.actorName} · {new Date(item.createdAt).toLocaleString("ko-KR")}</p><p className="whitespace-pre-wrap">{item.note}</p></section>)}
  {document?.canRecord && <label className="grid gap-2 text-sm">이미 수행한 내용<Textarea aria-label="이미 수행한 내용" value={note} maxLength={2000} disabled={busy} onChange={e => setNote(e.target.value)} placeholder="이미 수행한 범위와 남은 작업에 필요한 내용을 기록해 주세요." /></label>}
  {document && !document.canRecord && <p className="text-sm text-muted-foreground">현재 담당자가 진행 중·일시중지 상태에서 기록할 수 있어요.</p>}
  {error && <div role="alert" className="text-sm"><p>{error}</p><Button variant="outline" disabled={busy} onClick={() => setReload(n => n + 1)}>최신 상태 조회</Button></div>}</div>
 </EmrDialogShell></Dialog>;
}
