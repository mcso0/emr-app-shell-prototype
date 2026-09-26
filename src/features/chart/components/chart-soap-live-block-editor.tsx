"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ko } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { uploadSoapAttachment } from "@/features/chart/soap-attachment-client";

import { buildSoapCommandItems, type ChartSoapTemplateStructure } from "./chart-soap-block-commands";
import { chartSoapBlockSchema, type ChartSoapBlock, type ChartSoapBlockEditorInstance, type ChartSoapPartialBlock } from "./chart-soap-block-schema";
import { ChartSoapToolbar, type ChartSoapRecordInsertionItem, type ChartSoapRecordSource } from "./chart-soap-toolbar";
import styles from "./chart-soap-live-block-editor.module.css";

type MediaKind = "image" | "video";
type PendingAttachment = {
  file: File;
  kind: MediaKind;
  progress: number;
  status: "selected" | "uploading" | "failed";
  targetBlockId: string;
  capturedAt: string;
  description: string;
  error?: string;
};

function getMediaKind(file: File): MediaKind | null {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "image";
  if (["video/mp4", "video/webm"].includes(file.type)) return "video";
  return null;
}

function insertAttachmentBlock(
  editor: ChartSoapBlockEditorInstance,
  pending: PendingAttachment,
  attachment: { url: string; name: string },
) {
  const original = editor.getBlock(pending.targetBlockId);
  const current = original ?? editor.document[0]?.children[0] ?? editor.document[0];
  if (!current) return false;
  const caption = [
    pending.capturedAt ? `촬영/기록: ${pending.capturedAt}` : "",
    pending.description.trim() ? `설명: ${pending.description.trim()}` : "",
  ].filter(Boolean).join(" · ");
  const inserted = editor.insertBlocks([
    { type: pending.kind, props: { name: attachment.name, url: attachment.url, caption, showPreview: true } },
  ], current, "after")[0];
  editor.setTextCursorPosition(inserted, "end");
  return Boolean(original);
}

function getUploadErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    unsupported_media_type: "지원하지 않는 파일 형식입니다.",
    invalid_media_content: "파일 내용이 형식과 일치하지 않습니다. 다른 파일을 선택해 주세요.",
    invalid_size: "파일 크기 제한을 확인해 주세요.",
    invalid_name: "파일 이름을 확인해 주세요.",
    encounter_unavailable: "현재 진료를 찾을 수 없습니다.",
    stale_status: "현재 진료 상태에서는 첨부할 수 없습니다.",
    permission_missing: "첨부 권한이 없습니다.",
    configured_data_source_required: "실제 저장소가 연결된 작업공간에서만 파일을 첨부할 수 있습니다.",
    attachment_storage_unconfigured: "첨부 저장소 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
    attachment_unavailable: "첨부 파일을 확인할 수 없습니다.",
    attachment_prepare_failed: "첨부 준비에 실패했습니다. 다시 시도해 주세요.",
    attachment_upload_failed: "파일 전송에 실패했습니다. 다시 시도해 주세요.",
    attachment_finalize_failed: "첨부 확인에 실패했습니다. 다시 시도해 주세요.",
    attachment_request_failed: "첨부 요청에 실패했습니다. 다시 시도해 주세요.",
    storage_sign_failed: "파일 저장소에 연결하지 못했습니다. 다시 시도해 주세요.",
    db_write_failed: "첨부 기록을 저장하지 못했습니다. 다시 시도해 주세요.",
  };
  return messages[code] ?? "첨부를 완료하지 못했습니다. 다시 시도해 주세요.";
}

export function ChartSoapLiveBlockEditor({
  allowSoapTemplateCommands = true,
  uploadAttachment = uploadSoapAttachment,
  disabled = false,
  encounterId,
  initialContent,
  onDocumentChange,
  onNotice,
  onReady,
  recordInsertionItems,
  recordSources,
  templateStructure = "sectioned",
  workspaceId,
}: {
  allowSoapTemplateCommands?: boolean;
  uploadAttachment?: typeof uploadSoapAttachment;
  disabled?: boolean;
  encounterId?: string;
  initialContent: ChartSoapPartialBlock[];
  onDocumentChange: (blocks: readonly ChartSoapBlock[]) => void;
  onNotice: (message: string) => void;
  onReady: (blocks: readonly ChartSoapBlock[]) => void;
  recordInsertionItems?: readonly ChartSoapRecordInsertionItem[];
  recordSources?: readonly ChartSoapRecordSource[];
  templateStructure?: ChartSoapTemplateStructure;
  workspaceId?: string;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadIdRef = useRef(0);
  const scopeRef = useRef(`${workspaceId ?? ""}:${encounterId ?? ""}`);
  const disabledRef = useRef(disabled);
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const onNoticeRef = useRef(onNotice);
  const editor = useCreateBlockNote({
    schema: chartSoapBlockSchema,
    initialContent,
    dictionary: {
      ...ko,
      placeholders: {
        ...ko.placeholders,
        default: "내용을 입력하세요",
        emptyDocument: "내용을 입력하세요",
      },
    },
  });
  const suggestionItems = useMemo(() => buildSoapCommandItems({
    editor,
    includeSoapTemplates: allowSoapTemplateCommands,
    onNotice,
    templateStructure,
  }), [allowSoapTemplateCommands, editor, onNotice, templateStructure]);

  const initializedSelectionRef = useRef<ChartSoapBlockEditorInstance | null>(null);
  useLayoutEffect(() => {
    if (initializedSelectionRef.current === editor) return;
    initializedSelectionRef.current = editor;
    const firstBlock = editor.document[0];
    const firstParagraph = firstBlock?.children[0];
    if (firstBlock?.type === "soapSection" && firstParagraph?.type === "paragraph") {
      // Move the initial node selection without focusing or changing content.
      editor.setTextCursorPosition(firstParagraph, "start");
    }
  }, [editor]);
  useEffect(() => { onReady(editor.document); }, [editor, onReady]);
  useEffect(() => { onNoticeRef.current = onNotice; }, [onNotice]);
  useLayoutEffect(() => {
    const nextScope = `${workspaceId ?? ""}:${encounterId ?? ""}`;
    if (disabled || scopeRef.current !== nextScope) {
      uploadIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      setPending(null);
    }
    disabledRef.current = disabled;
    scopeRef.current = nextScope;
  }, [disabled, encounterId, workspaceId]);
  useEffect(() => () => {
    uploadIdRef.current += 1;
    abortRef.current?.abort();
  }, []);

  const startUpload = useCallback(async () => {
    if (!pending || pending.status === "uploading" || disabledRef.current || !workspaceId || !encounterId) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const uploadId = ++uploadIdRef.current;
    const uploadScope = scopeRef.current;
    const uploadItem = { ...pending, progress: 0, status: "uploading" as const };
    setPending(uploadItem);
    try {
      const attachment = await uploadAttachment({
        workspaceId,
        encounterId,
        file: pending.file,
        signal: abort.signal,
        onProgress: (progress: number) => {
          if (uploadIdRef.current === uploadId) setPending((current) => current ? { ...current, progress } : current);
        },
      });
      if (abort.signal.aborted || uploadIdRef.current !== uploadId || disabledRef.current || scopeRef.current !== uploadScope) return;
      const retainedPosition = insertAttachmentBlock(editor, uploadItem, attachment);
      setPending(null);
      onNoticeRef.current(retainedPosition
        ? "첨부 파일을 추가했습니다. 차트 저장 상태를 확인해 주세요."
        : "원래 입력 위치가 없어 현재 문서의 첫 구획에 첨부했습니다. 차트 저장 상태를 확인해 주세요.");
    } catch (error) {
      if (uploadIdRef.current !== uploadId || disabledRef.current || scopeRef.current !== uploadScope) return;
      if (abort.signal.aborted) return;
      const message = getUploadErrorMessage(error);
      setPending({ ...uploadItem, progress: 0, status: "failed", error: message });
      onNoticeRef.current(message);
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, [editor, encounterId, pending, uploadAttachment, workspaceId]);

  const onFiles = (files: FileList | null) => {
    if (!files?.length || disabled) return;
    if (files.length > 1) {
      onNoticeRef.current("한 번에 파일 하나만 첨부할 수 있습니다. 하나씩 선택해 주세요.");
      return;
    }
    const file = files[0];
    const kind = getMediaKind(file);
    if (!kind) {
      onNoticeRef.current("JPEG, PNG, WebP 이미지 또는 MP4, WebM 영상만 첨부할 수 있습니다.");
      return;
    }
    const limit = kind === "image" ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > limit) {
      onNoticeRef.current(kind === "image" ? "이미지는 5MB 이하만 첨부할 수 있습니다." : "영상은 20MB 이하만 첨부할 수 있습니다.");
      return;
    }
    if (!workspaceId || !encounterId) {
      onNoticeRef.current("차트가 연결된 진료에서 첨부할 수 있습니다.");
      return;
    }
    uploadIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setPending({ file, kind, progress: 0, status: "selected", targetBlockId: editor.getTextCursorPosition().block.id, capturedAt: "", description: "" });
  };
  const onFileDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !event.dataTransfer.files.length) return;
    event.preventDefault();
    event.stopPropagation();
    onFiles(event.dataTransfer.files);
  };
  const onFilePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled || !event.clipboardData.files.length) return;
    event.preventDefault();
    event.stopPropagation();
    onFiles(event.clipboardData.files);
  };

  return (
    <div className={styles.editorBoundary} data-soap-editor-boundary data-read-only={disabled ? "true" : "false"} onDropCapture={onFileDrop} onPasteCapture={onFilePaste}>
      {!disabled ? <ChartSoapToolbar
        allowSoapTemplateCommands={allowSoapTemplateCommands}
        editor={editor}
        onLocalMediaRequest={(kind) => (kind === "image" ? imageInputRef : videoInputRef).current?.click()}
        onNotice={onNotice}
        recordInsertionItems={recordInsertionItems}
        recordSources={recordSources}
        suggestionItems={suggestionItems}
      /> : null}
      <BlockNoteView
        className={`${styles.editor} scroll-fade-y scroll-fade-8`}
        editor={editor}
        editable={!disabled}
        formattingToolbar={false}
        sideMenu={false}
        slashMenu={false}
        filePanel={false}
        tableHandles={false}
        theme="light"
        aria-label="SOAP 블록 문서"
        onChange={(currentEditor) => onDocumentChange(currentEditor.document)}
      />
      {!disabled ? <>
        <input ref={imageInputRef} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="사진 첨부 파일 선택" onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} />
        <input ref={videoInputRef} className={styles.hiddenInput} type="file" accept="video/mp4,video/webm" aria-label="영상 첨부 파일 선택" onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} />
      </> : null}
      {pending ? <div className={styles.attachmentStatus} role="status" aria-live="polite">
        <strong>{pending.file.name}</strong>
        <label>촬영/기록 날짜<input type="date" value={pending.capturedAt} disabled={pending.status === "uploading"} onChange={(event) => setPending((current) => current ? { ...current, capturedAt: event.target.value } : null)} /></label>
        <label>설명<input type="text" maxLength={900} value={pending.description} disabled={pending.status === "uploading"} onChange={(event) => setPending((current) => current ? { ...current, description: event.target.value } : null)} /></label>
        {pending.status === "uploading" ? <><span>첨부 중 · {pending.progress}%</span><progress value={pending.progress} max={100} aria-label="첨부 진행률" /><button type="button" onClick={() => { uploadIdRef.current += 1; abortRef.current?.abort(); abortRef.current = null; setPending((current) => current ? { ...current, status: "selected", progress: 0 } : null); onNoticeRef.current("첨부를 취소했습니다."); }}>취소</button></> : <><span>{pending.error}</span><button type="button" onClick={() => void startUpload()}>{pending.status === "failed" ? "재시도" : "첨부 저장"}</button><button type="button" onClick={() => setPending(null)}>닫기</button></>}
      </div> : null}
    </div>
  );
}
