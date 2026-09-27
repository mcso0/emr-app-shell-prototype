"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { LAB_RESULT_ATTACHMENT_BUCKET, validateLabResultAttachment } from "../lab-result-attachment-core";
import type { LabResultAttachment, LabResultHistoryEvent, LabResultPhase2Data } from "../use-lab-result-phase2";
import type { LabResult, LabResultRow } from "@/types/emr-domain";

const LabAttachmentViewer = dynamic(() => import("./lab-attachment-viewer"), { ssr: false });

type UploadTask = { id: string; file: File; status: "queued" | "uploading" | "failed"; loading: boolean; error?: string };

function attachmentPath(workspaceId: string, resultId: string, attachmentId: string, download = false) {
  const base = `/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-attachments/${encodeURIComponent(attachmentId)}?resultId=${encodeURIComponent(resultId)}`;
  return download ? `${base}&download=1` : base;
}

export function LabResultRowDetail({ result, row, finding, onFindingChange, phase2, refresh }: {
  result: LabResult;
  row: LabResultRow;
  finding: string;
  onFindingChange: (value: string) => void;
  phase2: LabResultPhase2Data | null;
  refresh: () => void;
}) {
  const attachments = phase2?.attachments.filter(item => item.rowId === row.id) ?? [];
  return <div className="grid gap-4 bg-[var(--emr-surface-muted)] px-4 py-4 md:grid-cols-2" data-testid={`lab-result-detail-${row.id}`}>
    <div className="min-w-0">
      <label className="mb-2 block emr-text-metadata text-muted-foreground" htmlFor={`lab-finding-${row.id}`}>검사 소견</label>
      <Textarea id={`lab-finding-${row.id}`} className="h-36 min-h-36 max-h-36 resize-none overflow-y-auto bg-card emr-text-dense" maxLength={4096}
        disabled={phase2 !== null && !phase2.canEdit}
        value={finding} onChange={event => onFindingChange(event.target.value)}
        placeholder="항목별 검사 소견을 입력하세요. 결과표의 저장 버튼으로 저장됩니다." />
    </div>
    <LabResultAttachmentArea result={result} row={row} attachments={attachments} enabled={phase2 !== null} canEdit={phase2?.canEdit ?? false} refresh={refresh} />
  </div>;
}

export function LabResultAttachmentArea({ result, row, attachments, enabled, canEdit, refresh }: {
  result: LabResult; row: LabResultRow; attachments: LabResultAttachment[]; enabled: boolean; canEdit: boolean; refresh: () => void;
}) {
  const [mode, setMode] = useState<"card" | "list">("card");
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [preview, setPreview] = useState<LabResultAttachment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LabResultAttachment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = useRef(0);
  const cancelled = useRef(new Set<string>());
  const endpoint = `/api/workspaces/${encodeURIComponent(result.workspaceId)}/lab-imaging/result-attachments`;

  const discard = useCallback(async (attachmentId: string) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "discard", resultId: result.id, attachmentId }) }).catch(() => null);
    if (response?.status === 409) {
      const removed = await fetch(attachmentPath(result.workspaceId, result.id, attachmentId), { method: "DELETE" }).catch(() => null);
      refresh();
      return removed?.ok === true;
    }
    return response?.ok === true;
  }, [endpoint, refresh, result.id, result.workspaceId]);

  const upload = useCallback(async (task: UploadTask) => {
    let attachmentId: string | null = null;
    try {
      const mimeType = normalizeMime(task.file);
      const valid = validateLabResultAttachment({ name: task.file.name, mimeType, size: task.file.size });
      if (!valid.ok) throw new Error(valid.status === 413 ? "파일 크기가 허용 범위를 넘었습니다." : "지원하지 않는 파일입니다.");
      const preparedResponse = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", resultId: result.id, rowId: row.id, name: valid.name, mimeType: valid.mimeType, size: valid.size }) });
      const prepared = await preparedResponse.json();
      if (!preparedResponse.ok || !prepared.ok || typeof prepared.attachmentId !== "string" || typeof prepared.objectPath !== "string" || typeof prepared.uploadToken !== "string") throw new Error("업로드를 준비하지 못했습니다.");
      attachmentId = prepared.attachmentId;
      if (cancelled.current.has(task.id)) { if (attachmentId && !await discard(attachmentId)) setUploadNotice("업로드 취소 정리가 지연되고 있습니다."); return; }
      const client = getBrowserSupabaseClient();
      if (!client) throw new Error("파일 저장 연결을 확인해 주세요.");
      const sent = await client.storage.from(LAB_RESULT_ATTACHMENT_BUCKET).uploadToSignedUrl(prepared.objectPath, prepared.uploadToken, task.file,
        { cacheControl: "0", contentType: valid.mimeType, upsert: false });
      if (sent.error) throw new Error("파일을 업로드하지 못했습니다.");
      if (cancelled.current.has(task.id)) { if (attachmentId && !await discard(attachmentId)) setUploadNotice("업로드 취소 정리가 지연되고 있습니다."); return; }
      const finalResponse = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize", resultId: result.id, attachmentId }) });
      const finalized = await finalResponse.json();
      if (!finalResponse.ok || !finalized.ok) throw new Error("파일 확인에 실패했습니다.");
      if (cancelled.current.has(task.id)) {
        // Cancellation can arrive while finalize is in flight. The ready file
        // must be tombstoned; the pending-only discard action cannot remove it.
        const removed = await fetch(attachmentPath(result.workspaceId, result.id, prepared.attachmentId), { method: "DELETE" }).catch(() => null);
        if (!removed?.ok) setUploadNotice("업로드된 파일을 취소하지 못했습니다. 목록에서 다시 삭제해 주세요.");
        refresh();
        return;
      }
      setTasks(current => current.filter(item => item.id !== task.id));
      refresh();
    } catch (error) {
      if (attachmentId && !await discard(attachmentId)) setUploadNotice("실패한 업로드의 저장소 정리가 지연되고 있습니다.");
      if (!cancelled.current.has(task.id)) setTasks(current => current.map(item => item.id === task.id
        ? { ...item, status: "failed", error: error instanceof Error ? error.message : "업로드 실패" } : item));
    } finally {
      active.current -= 1;
      setTasks(current => [...current]);
    }
  }, [discard, endpoint, refresh, result.id, result.workspaceId, row.id]);

  useEffect(() => {
    const available = Math.max(0, 2 - active.current);
    const next = tasks.filter(task => task.status === "queued").slice(0, available);
    if (!next.length) return;
    active.current += next.length;
    setTasks(current => current.map(item => next.some(task => task.id === item.id) ? { ...item, status: "uploading" } : item));
    next.forEach(task => void upload(task));
  }, [tasks, upload]);

  const removeTask = (task: UploadTask) => {
    cancelled.current.add(task.id);
    setTasks(current => current.filter(item => item.id !== task.id));
  };
  const retryTask = (task: UploadTask) => {
    cancelled.current.delete(task.id);
    setTasks(current => current.map(item => item.id === task.id ? { ...item, status: "queued", loading: false, error: undefined } : item));
    window.setTimeout(() => setTasks(current => current.map(item => item.id === task.id ? { ...item, loading: true } : item)), 200);
  };
  const deleteAttachment = async () => {
    if (!pendingDelete) return;
    setDeleting(true); setDeleteError(null);
    try {
      const response = await fetch(attachmentPath(result.workspaceId, result.id, pendingDelete.id), { method: "DELETE" });
      if (!response.ok) throw new Error("첨부 파일을 삭제하지 못했습니다.");
      setPendingDelete(null); setPreview(null); refresh();
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "삭제 실패"); }
    finally { setDeleting(false); }
  };
  const visibleTasks = tasks.filter(task => task.loading || task.status === "failed");
  const overflow = attachments.length + visibleTasks.length > 4;
  return <div className="group/attachments min-w-0" aria-label={`${row.analyteName} 첨부 자료`}>
    {uploadNotice ? <p role="alert" className="mb-2 emr-text-metadata text-destructive">{uploadNotice}</p> : null}
    <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
      <span className="emr-text-metadata text-muted-foreground">첨부 자료{attachments.length ? ` ${attachments.length}` : ""}</span>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/attachments:opacity-100 group-focus-within/attachments:opacity-100 [@media(hover:none)]:opacity-100">
        <Button type="button" variant="ghost" size="xs" onClick={() => setMode("card")} aria-pressed={mode === "card"}>카드</Button>
        <Button type="button" variant="ghost" size="xs" onClick={() => setMode("list")} aria-pressed={mode === "list"}>목록</Button>
        {canEdit ? <Button type="button" variant="ghost" size="xs" disabled={!enabled} onClick={() => fileInput.current?.click()}>＋ 추가</Button> : null}
      </div>
    </div>
    <input ref={fileInput} className="sr-only" type="file" multiple disabled={!canEdit} accept="image/jpeg,image/png,image/webp,application/pdf,text/csv,text/plain,.csv,.txt"
      onChange={event => {
        const files = Array.from(event.target.files ?? []);
        setUploadNotice(null);
        const added = files.map(file => ({ id: crypto.randomUUID(), file, status: "queued" as const, loading: false }));
        setTasks(current => [...current, ...added]);
        window.setTimeout(() => setTasks(current => current.map(task => added.some(item => item.id === task.id)
          ? { ...task, loading: true } : task)), 200);
        event.target.value = "";
      }} />
    <div className={`h-36 overflow-y-auto overscroll-contain ${overflow ? "scroll-fade-y scroll-fade-8" : ""}`} aria-label={`${row.analyteName} 첨부 목록`}>
      {attachments.length || visibleTasks.length ? mode === "card" ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {attachments.map(item => <AttachmentCard key={item.id} item={item} url={attachmentPath(result.workspaceId, result.id, item.id)} downloadUrl={attachmentPath(result.workspaceId, result.id, item.id, true)} canDelete={canEdit} onPreview={() => setPreview(item)} onDelete={() => setPendingDelete(item)} />)}
        {visibleTasks.map(task => <UploadCard key={task.id} task={task} onCancel={() => removeTask(task)} onRetry={() => retryTask(task)} />)}
      </div> : <div className="space-y-1 emr-text-dense">
        {attachments.map(item => <div key={item.id} className="flex min-h-8 items-center gap-2 rounded-sm px-2 hover:bg-[var(--emr-state-hover)]">
          <span aria-hidden="true">▧</span><button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setPreview(item)}>{item.name}</button>
          <span className="text-muted-foreground">{formatSize(item.size)}</span>
          <AttachmentActionMenu name={item.name} downloadUrl={attachmentPath(result.workspaceId, result.id, item.id, true)} canDelete={canEdit}
            onPreview={() => setPreview(item)} onDelete={() => setPendingDelete(item)} />
        </div>)}
        {visibleTasks.map(task => <div key={task.id} className="flex min-h-8 items-center gap-2 px-2"><span className="min-w-0 flex-1 truncate">{task.file.name}</span><UploadStatus task={task} onCancel={() => removeTask(task)} onRetry={() => retryTask(task)} /></div>)}
      </div> : canEdit ? <button type="button" disabled={!enabled} className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border emr-text-dense text-muted-foreground hover:bg-[var(--emr-state-hover)] disabled:cursor-not-allowed" onClick={() => fileInput.current?.click()}>↑ 첨부자료 업로드</button>
        : <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border emr-text-dense text-muted-foreground">첨부 자료가 없습니다.</div>}
    </div>
    {preview ? <LabAttachmentViewer item={preview} url={attachmentPath(result.workspaceId, result.id, preview.id)} canDelete={canEdit}
      onClose={() => setPreview(null)} onDownload={() => window.open(attachmentPath(result.workspaceId, result.id, preview.id, true), "_blank", "noopener")}
      onDelete={() => setPendingDelete(preview)} /> : null}
    <Dialog open={Boolean(pendingDelete)} onOpenChange={open => { if (!open && !deleting) { setPendingDelete(null); setDeleteError(null); } }}>
      <DialogContent className="sm:max-w-md"><DialogTitle>첨부 파일 삭제</DialogTitle>
        <p className="emr-text-dense">{pendingDelete?.name}을(를) 삭제할까요? 목록에서 바로 사라지고 복구할 수 없습니다.</p>
        {deleteError ? <p role="alert" className="text-destructive">{deleteError}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={deleting} onClick={() => setPendingDelete(null)}>취소</Button><Button variant="destructive" disabled={deleting} onClick={() => void deleteAttachment()}>{deleting ? "삭제 중" : "삭제"}</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}

function AttachmentCard({ item, url, downloadUrl, canDelete, onPreview, onDelete }: { item: LabResultAttachment; url: string; downloadUrl: string; canDelete: boolean; onPreview: () => void; onDelete: () => void }) {
  return <div className="group/card relative h-[105px] overflow-hidden rounded-md bg-[var(--emr-surface-muted)] p-2 emr-text-metadata" tabIndex={0} role="group" aria-label={item.name}>
    <div className="absolute inset-x-2 bottom-2 flex flex-col gap-2 transition-transform duration-[220ms] ease-out group-hover/card:-translate-y-4 group-focus-within/card:-translate-y-4 motion-reduce:transition-none">
      {item.mimeType.startsWith("image/") ? <div className="h-16 overflow-hidden rounded-sm bg-card">
        {/* Protected same-origin attachment route; no public image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </div>
        : <div className="flex h-16 items-center justify-center rounded-sm bg-card font-semibold text-[var(--emr-status-info-text)]">{item.mimeType === "application/pdf" ? "PDF" : "FILE"}</div>}
      <button type="button" className="block w-full truncate text-left hover:underline" onClick={onPreview} title={item.name}>{item.name}</button>
      <span className="absolute top-full pt-1 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100">{formatTime(item.uploadedAt)}</span>
    </div>
    <span className="absolute bottom-2 right-2 rounded-full border bg-card px-1 text-[9px]" aria-label={`업로드 담당자 ${item.uploadedByName ?? "정보 없음"}`}>{(item.uploadedByName ?? "?").slice(0, 2)}</span>
    <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100">
      <Button variant="outline" size="icon-xs" aria-label={`${item.name} 미리보기`} onClick={onPreview}>↗</Button>
      <AttachmentActionMenu name={item.name} downloadUrl={downloadUrl} canDelete={canDelete} onPreview={onPreview} onDelete={onDelete} />
    </div>
  </div>;
}

function AttachmentActionMenu({ name, downloadUrl, canDelete, onPreview, onDelete }: {
  name: string; downloadUrl: string; canDelete: boolean; onPreview: () => void; onDelete: () => void;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-xs" aria-label={`${name} 작업 메뉴`} />}>⋯</DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-36">
      <DropdownMenuItem onClick={onPreview}>미리보기</DropdownMenuItem>
      <DropdownMenuItem onClick={() => window.open(downloadUrl, "_blank", "noopener")}>다운로드</DropdownMenuItem>
      {canDelete ? <DropdownMenuItem variant="destructive" onClick={onDelete}>삭제</DropdownMenuItem> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function UploadCard({ task, onCancel, onRetry }: { task: UploadTask; onCancel: () => void; onRetry: () => void }) {
  return <div className="relative flex h-[105px] flex-col justify-end gap-1 rounded-md bg-[var(--emr-surface-muted)] p-2 emr-text-metadata">
    <div className="flex h-16 items-center justify-center rounded-sm bg-card text-muted-foreground">{task.loading ? "◌" : "파일"}</div>
    <span className="truncate" title={task.file.name}>{task.file.name}</span>
    <UploadStatus task={task} onCancel={onCancel} onRetry={onRetry} />
  </div>;
}
function UploadStatus({ task, onCancel, onRetry }: { task: UploadTask; onCancel: () => void; onRetry: () => void }) {
  return <div className="flex items-center gap-1 emr-text-metadata" role="status">
    {task.status === "failed" ? <><span className="truncate text-destructive" title={task.error}>실패</span><button className="underline" onClick={onRetry}>재시도</button></> : <span className="text-muted-foreground">{task.status === "queued" ? "대기 중" : task.loading ? "업로드 중" : "준비 중"}</span>}
    <button className="ml-auto" onClick={onCancel} aria-label={`${task.file.name} 업로드 취소`}>×</button>
  </div>;
}

export function LabOverallFinding({ result, phase2, refresh }: { result: LabResult; phase2: LabResultPhase2Data | null; refresh: () => void }) {
  const [draft, setDraft] = useState<{ resultId: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const value = draft?.resultId === result.id ? draft.value : phase2?.overallFinding ?? "";
  const save = async () => {
    if (!phase2) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(result.workspaceId)}/lab-imaging/result-phase2`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id, expectedRevision: phase2.overallRevision, finding: value }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "다른 수정이 저장됐습니다. 다시 불러온 뒤 확인해 주세요." : "종합소견 저장에 실패했습니다.");
      setDraft(null); setMessage("저장됨"); refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장 실패"); }
    finally { setSaving(false); }
  };
  return <section className="rounded-lg border bg-card p-4">
    <div className="mb-3 flex items-center justify-between gap-2"><h2 className="emr-text-body font-semibold">검사결과 종합소견</h2>
      <Button size="xs" disabled={!phase2?.canEdit || saving || value === phase2.overallFinding} onClick={() => void save()}>{saving ? "저장 중" : "종합소견 저장"}</Button></div>
    <Textarea aria-label="검사결과 종합소견" className="min-h-36 resize-none overflow-y-auto bg-background emr-text-dense" maxLength={10000}
      disabled={!phase2?.canEdit} value={value} onChange={event => setDraft({ resultId: result.id, value: event.target.value })}
      placeholder={phase2 ? "전체 검사 결과에 대한 종합소견을 입력하세요." : "종합소견을 불러오는 중입니다."} />
    {message ? <p className={`mt-2 emr-text-metadata ${message === "저장됨" ? "text-muted-foreground" : "text-destructive"}`} role="status">{message}</p> : null}
  </section>;
}

export function LabResultHistoryDialog({ open, onOpenChange, result, events }: { open: boolean; onOpenChange: (open: boolean) => void; result: LabResult; events: LabResultHistoryEvent[] }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[min(85vh,760px)] overflow-y-auto sm:max-w-2xl">
    <DialogTitle>검사 결과 수정 이력</DialogTitle>
    <p className="emr-text-metadata text-muted-foreground">{result.resultName} · 이전 오더와 결과를 읽기 전용으로 확인할 수 있습니다.</p>
    {events.length ? <ol className="space-y-3">{events.map((event, index) => <li key={`${event.createdAt}:${index}`} className="rounded-md border p-3 emr-text-dense">
      <div className="font-medium">{event.kind === "retest_requested" ? "재검 요청 전 결과" : event.kind === "overall_changed" ? "종합소견 수정" : `${result.rows.find(row => row.id === event.rowId)?.analyteName ?? event.after?.name ?? event.rowId ?? "검사 항목"} 수정`}</div>
      <div className="mt-1 emr-text-metadata text-muted-foreground">{formatTime(event.createdAt)} · {event.actorName ?? "담당자 정보 없음"}</div>
      {event.kind === "retest_requested" ? <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-[var(--emr-surface-muted)] p-2 emr-text-metadata">{renderRetestSnapshot(event.after)}</pre>
        : <div className="mt-2 grid gap-2 sm:grid-cols-2"><HistorySnapshot label="이전" value={event.before} /><HistorySnapshot label="변경" value={event.after} /></div>}
    </li>)}</ol> : <p className="py-8 text-center emr-text-dense text-muted-foreground">기록된 수정 이력이 없습니다.</p>}
  </DialogContent></Dialog>;
}
function HistorySnapshot({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return <div className="min-w-0 rounded bg-[var(--emr-surface-muted)] p-2"><span className="emr-text-metadata text-muted-foreground">{label}</span><pre className="mt-1 overflow-x-auto whitespace-pre-wrap emr-text-metadata">{value ? Object.entries(value).map(([key, item]) => `${key}: ${item ?? "-"}`).join("\n") : "-"}</pre></div>;
}
function renderRetestSnapshot(value: Record<string, unknown> | null) {
  if (!value) return "기록 없음";
  const rows = Array.isArray(value.rows) ? value.rows : [];
  const order = value.priorOrder && typeof value.priorOrder === "object" ? value.priorOrder as Record<string, unknown> : null;
  return [`이전 오더: ${order?.displayName ?? value.priorOrderId ?? "-"}`, `새 오더: ${value.newOrderId ?? "-"}`, `재검 사유: ${value.reason ?? "-"}`,
    ...rows.map(row => row && typeof row === "object" ? `${(row as Record<string, unknown>).name ?? "항목"}: ${(row as Record<string, unknown>).value ?? "-"} · 소견 ${(row as Record<string, unknown>).finding ?? "-"}` : ""),
    `종합소견: ${value.overallFinding ?? "-"}`].join("\n");
}
function formatSize(size: number) { return size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(date); }
function normalizeMime(file: File) { if (file.name.toLowerCase().endsWith(".csv")) return "text/csv"; if (file.name.toLowerCase().endsWith(".txt")) return "text/plain"; return file.type; }
