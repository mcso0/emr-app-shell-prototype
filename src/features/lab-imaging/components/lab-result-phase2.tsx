"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CdsActionsDownloadIcon, CdsActionsPlusIcon, CdsActionsRefreshCcwIcon, CdsActionsUploadIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsAlertsLoaderIcon } from "@/components/cds-icons/alerts-and-status";
import { CdsFilesImageIcon, CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import labResultAttachmentIcon from "../assets/lab-result-file-attachment.svg";
import labResultAttachmentSmallIcon from "../assets/lab-result-file-attachment-small.svg";
import labResultPdfIcon from "../assets/lab-result-file-pdf.svg";
import labResultPdfSmallIcon from "../assets/lab-result-file-pdf-small.svg";
import labResultCardViewIcon from "../assets/lab-result-view-card.svg";
import labResultListViewIcon from "../assets/lab-result-view-list.svg";
import { useLabAutosave } from "../lab-autosave";
import { validateLabResultAttachment } from "../lab-result-attachment-core";
import { uploadLabAttachmentToSignedUrl } from "./lab-result-upload-transport";
import type { LabResultAttachment, LabResultHistoryEvent, LabResultPhase2Data } from "../use-lab-result-phase2";
import type { LabResult, LabResultRow } from "@/types/emr-domain";

const LabAttachmentViewer = dynamic(() => import("./lab-attachment-viewer"), { ssr: false });
// Original static SVGs from the approved result-sheet Figma nodes 28532:202785 and 28532:203029.

type UploadTask = { id: string; file: File; status: "queued" | "preparing" | "uploading" | "finalizing" | "failed"; loading: boolean; progress?: number; error?: string };

function attachmentPath(workspaceId: string, resultId: string, attachmentId: string, download = false) {
  const base = `/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-attachments/${encodeURIComponent(attachmentId)}?resultId=${encodeURIComponent(resultId)}`;
  return download ? `${base}&download=1` : base;
}

export function LabResultRowDetail({ result, row, staffInstruction, finding, onFindingChange, phase2, refresh }: {
  result: LabResult;
  row: LabResultRow;
  staffInstruction?: string;
  finding: string;
  onFindingChange: (value: string) => void;
  phase2: LabResultPhase2Data | null;
  refresh: () => void;
}) {
  const attachments = phase2?.attachments.filter(item => item.rowId === row.id) ?? [];
  const instruction = staffInstruction?.trim() ?? "";
  return <div className="bg-[var(--emr-surface-muted)] px-6 pb-4 pt-2.5" data-testid={`lab-result-detail-${row.id}`}>
    {instruction ? <section className="mb-3" aria-label="직원 전달 사항">
      <div className="flex h-7 items-center gap-1 px-2.5 emr-text-metadata text-muted-foreground">직원 전달 사항</div>
      <div className="px-2.5 py-2.5">
        <div className="min-h-9 rounded-lg border border-[var(--emr-border-subtle)] bg-card px-2 py-1.5 emr-text-dense leading-5 text-foreground">
          {instruction}
        </div>
      </div>
    </section> : null}
    <div className="grid min-w-0 grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_17px_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex h-7 items-center gap-1 px-2.5 emr-text-metadata text-muted-foreground">
          <label htmlFor={`lab-finding-${row.id}`}>검사 소견</label>
        </div>
        <div className="p-2.5">
          <Textarea id={`lab-finding-${row.id}`} className="h-[76px] min-h-[76px] max-h-[76px] resize-none overflow-y-auto bg-card p-[7px] !text-[12px] !leading-4 !tracking-[0.3px] font-medium shadow-[var(--clair-shadow-xs)]" maxLength={4096}
            disabled={phase2 !== null && !phase2.canEdit}
            value={finding} onChange={event => onFindingChange(event.target.value)}
            placeholder="항목별 검사 소견을 입력하세요. 자동으로 저장됩니다." />
        </div>
      </div>
      <div className="relative hidden md:block" aria-hidden="true"><span className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-[var(--clair-color-atomic-black-alpha-6)]" /></div>
      <LabResultAttachmentArea key={`${result.workspaceId}:${result.id}:${row.id}`} result={result} row={row} attachments={attachments} enabled={phase2 !== null} canEdit={phase2?.canEdit ?? false} refresh={refresh} />
    </div>
  </div>;
}

export function LabResultAttachmentArea({ result, row, attachments, enabled, canEdit, refresh }: {
  result: LabResult; row: LabResultRow | null; attachments: LabResultAttachment[]; enabled: boolean; canEdit: boolean; refresh: () => void;
}) {
  const rowId = row?.id ?? null;
  const scopeLabel = row?.analyteName ?? "검사결과 종합소견";
  const emptyHeight = row ? "h-[76px]" : "h-32";
  const [mode, setMode] = useState<"card" | "list">("card");
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [preview, setPreview] = useState<LabResultAttachment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LabResultAttachment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const tasksRef = useRef<UploadTask[]>([]);
  const active = useRef(0);
  const cancelled = useRef(new Set<string>());
  const uploadRequests = useRef(new Map<string, () => void>());
  tasksRef.current = tasks;
  const endpoint = `/api/workspaces/${encodeURIComponent(result.workspaceId)}/lab-imaging/result-attachments`;

  useEffect(() => () => {
    for (const task of tasksRef.current) cancelled.current.add(task.id);
    uploadRequests.current.forEach(abort => abort());
    uploadRequests.current.clear();
  }, [result.workspaceId, result.id, rowId]);

  const discard = useCallback(async (attachmentId: string) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "discard", resultId: result.id, attachmentId }) }).catch(() => null);
    if (response?.status === 409 || response?.status === 404) {
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
        body: JSON.stringify({ action: "prepare", resultId: result.id, rowId, name: valid.name, mimeType: valid.mimeType, size: valid.size }) });
      const prepared = await preparedResponse.json();
      if (!preparedResponse.ok || !prepared.ok || typeof prepared.attachmentId !== "string" || typeof prepared.objectPath !== "string" || typeof prepared.uploadToken !== "string" || typeof prepared.uploadUrl !== "string") throw new Error("업로드를 준비하지 못했습니다.");
      attachmentId = prepared.attachmentId;
      if (cancelled.current.has(task.id)) { if (attachmentId && !await discard(attachmentId)) setUploadNotice("업로드 취소 정리가 지연되고 있습니다."); return; }
      setTasks(current => current.map(item => item.id === task.id ? { ...item, status: "uploading", progress: undefined } : item));
      const request = uploadLabAttachmentToSignedUrl({
        file: task.file,
        mimeType: valid.mimeType,
        uploadUrl: prepared.uploadUrl,
        onProgress: progress => setTasks(current => current.map(item => item.id === task.id ? { ...item, progress } : item)),
      });
      uploadRequests.current.set(task.id, request.abort);
      await request.promise;
      uploadRequests.current.delete(task.id);
      if (cancelled.current.has(task.id)) { if (attachmentId && !await discard(attachmentId)) setUploadNotice("업로드 취소 정리가 지연되고 있습니다."); return; }
      setTasks(current => current.map(item => item.id === task.id ? { ...item, status: "finalizing", progress: 100 } : item));
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
      uploadRequests.current.delete(task.id);
      active.current -= 1;
      setTasks(current => [...current]);
    }
  }, [discard, endpoint, refresh, result.id, result.workspaceId, rowId]);

  useEffect(() => {
    const available = Math.max(0, 2 - active.current);
    const next = tasks.filter(task => task.status === "queued").slice(0, available);
    if (!next.length) return;
    active.current += next.length;
    setTasks(current => current.map(item => next.some(task => task.id === item.id) ? { ...item, status: "preparing" } : item));
    next.forEach(task => void upload(task));
  }, [tasks, upload]);

  const removeTask = (task: UploadTask) => {
    cancelled.current.add(task.id);
    uploadRequests.current.get(task.id)?.();
    setTasks(current => current.filter(item => item.id !== task.id));
  };
  const retryTask = (task: UploadTask) => {
    cancelled.current.delete(task.id);
    setTasks(current => current.map(item => item.id === task.id ? { ...item, status: "queued", loading: false, progress: undefined, error: undefined } : item));
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
  const visibleTasks = tasks.filter(task => task.loading || task.status !== "queued");
  const itemCount = attachments.length + visibleTasks.length;
  return <div className="group/attachments @container min-w-0" aria-label={`${scopeLabel} 첨부 자료`}>
    {uploadNotice ? <p role="alert" className="mb-2 emr-text-metadata text-destructive">{uploadNotice}</p> : null}
    <div className="flex min-h-6 items-center justify-between gap-2">
      <span className="flex h-7 items-center gap-1 px-2.5 emr-text-metadata text-muted-foreground">첨부 자료{attachments.length ? <span className="text-foreground">{attachments.length}</span> : ""}</span>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/attachments:opacity-100 group-focus-within/attachments:opacity-100 [@media(hover:none)]:opacity-100">
        {itemCount > 0 ? <Button type="button" variant="ghost" size="icon-xs" disabled aria-label="첨부자료 일괄 다운로드 미지원" title="일괄 다운로드는 지원하지 않습니다."><CdsActionsDownloadIcon aria-hidden="true" /></Button> : null}
        {itemCount > 0 ? <Button type="button" variant="ghost" size="icon-xs" className={mode === "card" ? "bg-[var(--clair-color-atomic-black-alpha-4)]" : undefined}
          onClick={() => setMode("card")} aria-label="카드 보기" aria-pressed={mode === "card"}><LabResultFigmaIcon asset={labResultCardViewIcon} size={14} /></Button> : null}
        {itemCount > 0 ? <Button type="button" variant="ghost" size="icon-xs" className={mode === "list" ? "bg-[var(--clair-color-atomic-black-alpha-4)]" : undefined}
          onClick={() => setMode("list")} aria-label="목록 보기" aria-pressed={mode === "list"}><LabResultFigmaIcon asset={labResultListViewIcon} size={14} /></Button> : null}
        {canEdit && itemCount > 0 ? <Button type="button" variant="ghost" size="icon-xs" disabled={!enabled} onClick={() => fileInput.current?.click()} aria-label="첨부 자료 추가"><CdsActionsPlusIcon aria-hidden="true" /></Button> : null}
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
    {itemCount > 0 ? <>
      <div className="px-2.5 py-2.5">
        {mode === "list" ? <div className="mb-1 grid h-6 grid-cols-[minmax(0,1fr)_48px_64px_20px_24px] items-center gap-2 px-2 text-[10px] leading-[14px] tracking-[0.31px] text-muted-foreground @md:grid-cols-[minmax(0,1fr)_72px_88px_48px_24px]" aria-hidden="true">
          <span>파일명</span><span>파일 크기</span><span>첨부 시각</span><span>담당자</span><span />
        </div> : null}
        <AttachmentFileViewport mode={mode} itemCount={itemCount} label={`${scopeLabel} 첨부 ${mode === "card" ? "카드" : "목록"} 스크롤 영역`}>
          {mode === "card" ? <div className="grid grid-cols-2 gap-2.5 @lg:grid-cols-4" data-testid="lab-attachment-card-grid">
            {attachments.map(item => <AttachmentCard key={item.id} item={item} url={attachmentPath(result.workspaceId, result.id, item.id)} downloadUrl={attachmentPath(result.workspaceId, result.id, item.id, true)} canDelete={canEdit} onPreview={() => setPreview(item)} onDelete={() => setPendingDelete(item)} />)}
            {visibleTasks.map(task => <UploadCard key={task.id} task={task} onCancel={() => removeTask(task)} onRetry={() => retryTask(task)} />)}
          </div> : <div className="flex flex-col gap-1 text-[12px] leading-4 tracking-[0.3px]" data-testid="lab-attachment-list">
            {attachments.map(item => <AttachmentListRow key={item.id} item={item} url={attachmentPath(result.workspaceId, result.id, item.id)} downloadUrl={attachmentPath(result.workspaceId, result.id, item.id, true)} canDelete={canEdit} onPreview={() => setPreview(item)} onDelete={() => setPendingDelete(item)} />)}
            {visibleTasks.map(task => <UploadListRow key={task.id} task={task} onCancel={() => removeTask(task)} onRetry={() => retryTask(task)} />)}
          </div>}
        </AttachmentFileViewport>
      </div>
    </> : <div className="px-2.5 py-2.5">
      {canEdit ? <button type="button" disabled={!enabled} className={`flex ${emptyHeight} w-full items-center justify-center gap-1 rounded-[8px] border border-dashed border-[var(--emr-border-default)] bg-transparent px-2 py-1 text-[12px] leading-4 tracking-[0.3px] font-medium text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-[var(--emr-state-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed`} onClick={() => fileInput.current?.click()}>
        <CdsActionsUploadIcon className="size-3" aria-hidden="true" /><span>첨부자료 업로드</span>
      </button> : <div className={`flex ${emptyHeight} items-center justify-center rounded-[8px] border border-dashed border-[var(--emr-border-default)] bg-transparent px-2 py-1 text-[12px] leading-4 tracking-[0.3px] font-medium text-muted-foreground`}>첨부 자료가 없습니다.</div>}
    </div>}
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

function AttachmentFileViewport({ mode, itemCount, label, children }: { mode: "card" | "list"; itemCount: number; label: string; children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [moreBelow, setMoreBelow] = useState(false);
  const [cardMaxHeight, setCardMaxHeight] = useState(0);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setCanScroll(viewport.scrollHeight > viewport.clientHeight + 1);
      setMoreBelow(remaining > 1);
      if (mode === "card") {
        const card = viewport.querySelector<HTMLElement>("[data-testid='lab-attachment-card'], [data-testid='lab-upload-card']");
        const grid = viewport.querySelector<HTMLElement>("[data-testid='lab-attachment-card-grid']");
        if (card && grid) {
          const gap = Number.parseFloat(window.getComputedStyle(grid).rowGap) || 10;
          const nextMax = card.getBoundingClientRect().height * 2 + gap;
          setCardMaxHeight(current => Math.abs(current - nextMax) > 0.5 ? nextMax : current);
        }
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, [itemCount, mode]);
  const update = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setCanScroll(viewport.scrollHeight > viewport.clientHeight + 1);
    setMoreBelow(remaining > 1);
  };
  return <div className="relative min-w-0" data-testid="lab-attachment-viewport-shell">
    <div ref={viewportRef} onScroll={update} tabIndex={canScroll ? 0 : undefined} role="region" aria-label={label}
      style={{ maxHeight: mode === "card" && cardMaxHeight > 0 ? `${cardMaxHeight}px` : mode === "list" ? "212px" : undefined }}
      className="min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md">
      {children}
    </div>
    {moreBelow ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5 rounded-b-md bg-gradient-to-b from-transparent to-[var(--emr-surface-muted)]" data-testid="lab-attachment-overflow-fade" /> : null}
  </div>;
}

function AttachmentCard({ item, url, downloadUrl, canDelete, onPreview, onDelete }: { item: LabResultAttachment; url: string; downloadUrl: string; canDelete: boolean; onPreview: () => void; onDelete: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = item.uploadedByName?.trim().slice(0, 2) || "?";
  return <div className="group/card relative min-w-0 overflow-hidden rounded-md bg-[var(--clair-color-atomic-black-alpha-4)] p-2 text-[12px] leading-4 tracking-[0.3px] transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-8)] focus-within:bg-[var(--clair-color-atomic-black-alpha-8)]" data-testid="lab-attachment-card">
    <button type="button" className="flex w-full min-w-0 flex-col items-stretch justify-end gap-2 text-left outline-none transition-transform duration-[220ms] ease-out group-hover/card:-translate-y-[13px] group-focus-within/card:-translate-y-[13px] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" aria-label={`${item.name} 미리보기`} onClick={onPreview}>
      {item.mimeType.startsWith("image/") && !imageFailed ? <div className="aspect-[190/107] w-full overflow-hidden rounded-sm bg-card">
        {/* Protected same-origin attachment route; no public image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      </div> : <div className="relative flex aspect-[190/107] w-full items-center justify-center overflow-hidden rounded-sm bg-card text-[var(--emr-text-secondary)]" aria-label={attachmentTypeLabel(item.mimeType)}>
        <span className="flex size-10 items-center justify-center rounded-[10px] border border-[var(--clair-color-atomic-black-alpha-4)] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-xs)]"><AttachmentTypeIcon mimeType={item.mimeType} size="lg" /></span>
      </div>}
      <div className="flex h-5 min-h-5 min-w-0 items-center gap-2 pr-6 text-[12px] leading-4 tracking-[0.3px]">
        <span className="min-w-0 flex-1 truncate" title={item.name}>{item.name}</span>
      </div>
    </button>
    <Avatar className="absolute bottom-2 right-2 size-5 border border-[var(--clair-color-atomic-black-alpha-8)] bg-[var(--emr-surface-panel)]" aria-label={`업로드 담당자 ${item.uploadedByName ?? "정보 없음"}`} title={item.uploadedByName ?? "담당자 정보 없음"}>
      <AvatarFallback className="bg-[var(--emr-surface-panel)] text-[9px] leading-3 text-foreground">{initials}</AvatarFallback>
    </Avatar>
    <span className="absolute bottom-1 left-2 right-7 hidden truncate text-[12px] leading-4 tracking-[0.3px] text-muted-foreground group-hover/card:block group-focus-within/card:block">{formatTime(item.uploadedAt)}</span>
    <div className="absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100">
      <AttachmentActionMenu presentation="card" name={item.name} downloadUrl={downloadUrl} canDelete={canDelete} onPreview={onPreview} onDelete={onDelete} />
    </div>
  </div>;
}

function AttachmentListRow({ item, url, downloadUrl, canDelete, onPreview, onDelete }: { item: LabResultAttachment; url: string; downloadUrl: string; canDelete: boolean; onPreview: () => void; onDelete: () => void }) {
  const initials = item.uploadedByName?.trim().slice(0, 2) || "?";
  return <div className="grid h-8 grid-cols-[minmax(0,1fr)_48px_64px_20px_24px] items-center gap-2 rounded-sm px-2 text-[12px] leading-4 tracking-[0.3px] hover:bg-[var(--clair-color-atomic-black-alpha-4)] @md:grid-cols-[minmax(0,1fr)_72px_88px_48px_24px]" data-testid="lab-attachment-list-row">
    <button type="button" className="flex min-w-0 items-center gap-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onPreview} title={item.name}>
      <AttachmentListFileIcon mimeType={item.mimeType} url={url} />
      <span className="min-w-0 truncate">{item.name}</span>
    </button>
    <span className="truncate text-muted-foreground" title={formatSize(item.size)}>{formatSize(item.size)}</span>
    <span className="truncate text-muted-foreground" title={formatTime(item.uploadedAt)}>{formatTime(item.uploadedAt)}</span>
    <Avatar className="size-5 border border-[var(--clair-color-atomic-black-alpha-8)] bg-[var(--emr-surface-panel)]" aria-label={`업로드 담당자 ${item.uploadedByName ?? "정보 없음"}`} title={item.uploadedByName ?? "담당자 정보 없음"}>
      <AvatarFallback className="bg-[var(--emr-surface-panel)] text-[9px] leading-3 text-foreground">{initials}</AvatarFallback>
    </Avatar>
    <AttachmentActionMenu name={item.name} downloadUrl={downloadUrl} canDelete={canDelete} onPreview={onPreview} onDelete={onDelete} />
  </div>;
}

function AttachmentListFileIcon({ mimeType, url }: { mimeType: string; url: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (mimeType.startsWith("image/") && !imageFailed) return <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-[var(--clair-color-atomic-black-alpha-8)] bg-card">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt="" className="size-full object-cover" onError={() => setImageFailed(true)} />
  </span>;
  return <span className="flex size-4 shrink-0 items-center justify-center" aria-label={attachmentTypeLabel(mimeType)}><AttachmentTypeIcon mimeType={mimeType} size="sm" /></span>;
}

function AttachmentTypeIcon({ mimeType, size }: { mimeType: string; size: "sm" | "lg" }) {
  if (mimeType.startsWith("image/")) return <CdsFilesImageIcon className={size === "lg" ? "size-6 text-[var(--emr-text-tertiary)]" : "size-4 text-[var(--emr-text-tertiary)]"} aria-hidden="true" />;
  const src = mimeType === "application/pdf"
    ? size === "lg" ? labResultPdfIcon : labResultPdfSmallIcon
    : size === "lg" ? labResultAttachmentIcon : labResultAttachmentSmallIcon;
  return <LabResultFigmaIcon asset={src} size={size === "lg" ? 24 : 16} />;
}

function attachmentTypeLabel(mimeType: string) { return mimeType.startsWith("image/") ? "이미지 파일" : mimeType === "application/pdf" ? "PDF 파일" : "첨부 파일"; }

function LabResultFigmaIcon({ asset, size }: { asset: string | { src?: string }; size: number }) {
  const src = typeof asset === "string" ? asset : asset.src ?? "";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="" aria-hidden="true" />;
}

function AttachmentActionMenu({ presentation = "list", name, downloadUrl, canDelete, onPreview, onDelete }: {
  presentation?: "card" | "list"; name: string; downloadUrl: string; canDelete: boolean; onPreview: () => void; onDelete: () => void;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" className={presentation === "card" ? "border border-[var(--clair-color-atomic-black-alpha-8)] bg-card shadow-[var(--clair-shadow-xs)]" : undefined} aria-label={`${name} 작업 메뉴`} /> }>
      <CdsFilesMoreHorizontalIcon aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-36">
      <DropdownMenuItem onClick={onPreview}>미리보기</DropdownMenuItem>
      <DropdownMenuItem onClick={() => window.open(downloadUrl, "_blank", "noopener")}>다운로드</DropdownMenuItem>
      {canDelete ? <DropdownMenuItem variant="destructive" onClick={onDelete}>삭제</DropdownMenuItem> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function UploadCard({ task, onCancel, onRetry }: { task: UploadTask; onCancel: () => void; onRetry: () => void }) {
  return <div className="group/upload-card relative min-w-0 overflow-hidden rounded-md bg-[var(--clair-color-atomic-black-alpha-4)] p-2 text-[12px] leading-4 tracking-[0.3px]" data-testid="lab-upload-card" title={task.error}>
    <div className="relative flex aspect-[190/107] w-full items-center justify-center overflow-hidden rounded-sm bg-[var(--clair-color-atomic-black-alpha-4)] text-muted-foreground">
      {task.loading && task.status !== "failed" ? <CdsAlertsLoaderIcon className="size-4 animate-spin motion-reduce:animate-none" aria-label={task.status === "finalizing" ? "파일 확인 중" : task.status === "preparing" ? "업로드 준비 중" : "업로드 중"} /> : <AttachmentTypeIcon mimeType={normalizeMime(task.file)} size="sm" />}
    </div>
    <div className="mt-2 flex h-5 min-h-5 min-w-0 items-center gap-2 text-[12px] leading-4 tracking-[0.3px]">
      <span className="min-w-0 flex-1 truncate" title={task.file.name}>{task.file.name}</span>
      <span className={task.status === "failed" ? "shrink-0 text-destructive" : "shrink-0 text-[var(--clair-color-primary-strong)]"}>
        {task.status === "failed" ? "실패" : task.status === "queued" ? "대기" : task.status === "preparing" ? "준비 중" : task.status === "finalizing" ? "100%" : task.progress === undefined ? "—%" : `${task.progress}%`}
      </span>
      {task.error ? <span className="sr-only">{task.error}</span> : null}
    </div>
    <div className="absolute right-1 top-1"><UploadStatus task={task} onCancel={onCancel} onRetry={onRetry} /></div>
  </div>;
}
function UploadStatus({ task, onCancel, onRetry }: { task: UploadTask; onCancel: () => void; onRetry: () => void }) {
  return <div className="flex items-center gap-1" role="status" aria-label={`${task.file.name}: ${uploadPhaseLabel(task)}`}>
    {task.status === "failed" ? <button type="button" className="rounded bg-card px-1 text-[10px] text-destructive shadow-[var(--clair-shadow-xs)]" onClick={onRetry} aria-label={`${task.file.name} 업로드 재시도`}>재시도</button> : null}
    <button type="button" className="flex size-6 items-center justify-center rounded bg-card shadow-[var(--clair-shadow-xs)]" onClick={onCancel} aria-label={`${task.file.name} 업로드 취소`}><CdsActionsXIcon className="size-3" aria-hidden="true" /></button>
  </div>;
}

function UploadListRow({ task, onCancel, onRetry }: { task: UploadTask; onCancel: () => void; onRetry: () => void }) {
  const progress = Math.max(0, Math.min(100, task.progress ?? 0));
  return <div className="relative flex h-8 items-center gap-2 overflow-hidden rounded-sm border border-[var(--clair-color-atomic-black-alpha-8)] px-2" role="status" aria-label={`${task.file.name} ${uploadPhaseLabel(task)}`} title={task.error} data-testid="lab-upload-list-row">
    <span className="absolute inset-y-0 left-0" style={{ width: `${progress}%`, backgroundColor: "color-mix(in srgb, var(--clair-color-primary-strong) 8%, transparent)" }} data-testid="lab-upload-progress-fill">
      {progress < 100 ? <span className="absolute right-0 top-0 h-full w-12 bg-gradient-to-r from-transparent to-[var(--emr-surface-muted)]" style={{ opacity: 1 - progress / 100 }} aria-hidden="true" /> : null}
    </span>
    <span className="relative flex min-w-0 flex-1 items-center gap-1.5">
      {task.status === "failed" ? <AttachmentTypeIcon mimeType={normalizeMime(task.file)} size="sm" /> : <CdsAlertsLoaderIcon className="size-4 shrink-0 animate-spin text-[var(--emr-text-secondary)] motion-reduce:animate-none" aria-label={task.status === "finalizing" ? "파일 확인 중" : task.status === "preparing" ? "업로드 준비 중" : task.status === "queued" ? "업로드 대기 중" : "업로드 중"} />}
      <span className="min-w-0 flex-1 truncate" title={task.file.name}>{task.file.name}</span>
    </span>
    <span className={`relative w-12 shrink-0 text-right font-medium tabular-nums ${task.status === "failed" ? "text-destructive" : "text-[var(--clair-color-primary-strong)]"}`}>{uploadProgressLabel(task)}</span>
    {task.error ? <span className="sr-only">{task.error}</span> : null}
    {task.status === "failed" ? <button type="button" className="relative flex size-5 shrink-0 items-center justify-center rounded hover:bg-[var(--emr-state-hover)]" onClick={onRetry} aria-label={`${task.file.name} 업로드 재시도`}><CdsActionsRefreshCcwIcon className="size-3" aria-hidden="true" /></button> : null}
    <button type="button" className="relative flex size-6 shrink-0 items-center justify-center rounded hover:bg-[var(--emr-state-hover)]" onClick={onCancel} aria-label={`${task.file.name} 업로드 취소`}><CdsActionsXIcon className="size-3" aria-hidden="true" /></button>
  </div>;
}

function uploadPhaseLabel(task: UploadTask) {
  if (task.status === "failed") return `업로드 실패. ${task.error ?? ""}`.trim();
  if (task.status === "queued") return "업로드 대기 중";
  if (task.status === "preparing") return "업로드 준비 중";
  if (task.status === "finalizing") return "파일 확인 중";
  return `업로드 ${task.progress ?? 0}%`;
}

function uploadProgressLabel(task: UploadTask) {
  if (task.status === "failed") return "실패";
  if (task.status === "queued") return "대기";
  if (task.status === "preparing") return "준비 중";
  if (task.status === "finalizing") return "100%";
  return task.progress === undefined ? "—%" : `${task.progress}%`;
}

export function LabOverallFinding({ result, phase2, refresh }: { result: LabResult; phase2: LabResultPhase2Data | null; refresh: () => void }) {
  const autosave = useLabAutosave<string>(`${result.workspaceId}:${result.id}:overall`, async (finding, _requestId, expectedRevision) => {
    const endpoint = `/api/workspaces/${encodeURIComponent(result.workspaceId)}/lab-imaging/result-phase2`;
    const response = await fetch(endpoint, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId: result.id, expectedRevision, finding }),
    });
    const body = await response.json();
    if (response.ok && body.ok === true && Number.isSafeInteger(body.data?.revision)) {
      refresh();
      return { ok: true, revision: body.data.revision };
    }
    if (response.status === 409) {
      // The previous response may have been lost after committing. Only accept
      // readback that matches this exact finding and the next revision.
      const readback = await fetch(`${endpoint}?resultId=${encodeURIComponent(result.id)}`, { cache: "no-store" });
      const current = await readback.json();
      if (readback.ok && current.ok === true && current.data?.resultId === result.id &&
        current.data.overallFinding === finding && current.data.overallRevision === expectedRevision + 1) {
        refresh();
        return { ok: true, revision: current.data.overallRevision };
      }
      return { ok: false, reason: "conflict", retryable: false,
        message: "다른 수정이 저장됐습니다. 입력을 확인한 뒤 새로고침해 주세요." };
    }
    return { ok: false, reason: response.status === 401 || response.status === 403 ? "permission_denied" : "error",
      retryable: response.status >= 500 || response.status === 429,
      message: response.status === 401 || response.status === 403 ? "저장 권한이 없습니다." : "종합소견을 저장하지 못했습니다." };
  }, phase2?.overallRevision ?? 0);
  const value = autosave.state.draft ?? phase2?.overallFinding ?? "";
  return <section className="rounded-lg border bg-card p-4" data-testid="lab-overall-finding" onBlurCapture={autosave.flush}>
    <div className="mb-3 flex items-center justify-between gap-2"><h2 className="emr-text-body font-semibold">검사결과 종합소견</h2>
      {autosave.state.value !== "idle" ? <div className="flex items-center gap-2">
        <span role="status" data-testid="lab-overall-save-status" className={`emr-text-metadata ${["error", "conflict", "permission_denied"].includes(autosave.state.value) ? "text-destructive" : "text-muted-foreground"}`}>{autosave.state.message}</span>
        {autosave.state.retryable ? <Button size="xs" variant="outline" onClick={autosave.retry}>재시도</Button> : null}
      </div> : null}</div>
    <div className="grid min-w-0 grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_17px_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex h-7 items-center gap-1 px-2.5 emr-text-metadata text-muted-foreground">
          <label htmlFor={`lab-overall-finding-${result.id}`}>종합 소견</label>
        </div>
        <div className="p-2.5">
          <Textarea id={`lab-overall-finding-${result.id}`} aria-label="검사결과 종합소견" className="h-32 min-h-32 resize-none overflow-y-auto bg-background emr-text-dense" maxLength={10000}
            disabled={!phase2?.canEdit} value={value} onChange={event => autosave.change(event.target.value)}
            placeholder={phase2 ? "전체 검사 결과에 대한 종합소견을 입력하세요. 자동으로 저장됩니다." : "종합소견을 불러오는 중입니다."} />
        </div>
      </div>
      <div className="relative hidden md:block" aria-hidden="true"><span className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-[var(--clair-color-atomic-black-alpha-6)]" /></div>
      <LabResultAttachmentArea key={`${result.workspaceId}:${result.id}:overall-attachments`} result={result} row={null}
        attachments={phase2?.attachments.filter(item => item.rowId === null) ?? []}
        enabled={phase2 !== null} canEdit={phase2?.canEdit ?? false} refresh={refresh} />
    </div>
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
