"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CdsActionsDownloadIcon, CdsActionsMinusIcon, CdsActionsPlusIcon, CdsActionsRotateCwIcon, CdsActionsTrash2Icon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronLeftIcon, CdsNavigationChevronRightIcon } from "@/components/cds-icons/navigation";
import { CdsFilesFileTextIcon, CdsFilesImageIcon } from "@/components/cds-icons/files-and-layout";
import { attachmentReadStatus, CSV_PREVIEW_COLUMNS, decodeAttachmentText, parseAttachmentCsv, TEXT_PREVIEW_LENGTH } from "../lab-attachment-preview-core";
import type { LabResultAttachment } from "../use-lab-result-phase2";
import styles from "./lab-attachment-viewer.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type ImageView = { scale: number; x: number; y: number; rotation: number; background: "dark" | "gray" | "checker" };
type PdfView = { page: number; zoom: number };
type FileView = { image?: ImageView; pdf?: PdfView };
type Content = { key: string; status: "loading" | "ready" | "empty" | "denied" | "unavailable" | "error"; objectUrl?: string; text?: string; encoding?: string };

export default function LabAttachmentViewer({ item, items, url, scopeLabel, metadataUnavailable = false, canDelete, onSelect, onClose, onDownload, onDelete, onRevalidate, returnFocus, children }: {
  item: LabResultAttachment;
  items: LabResultAttachment[];
  url: string;
  scopeLabel: string;
  metadataUnavailable?: boolean;
  canDelete: boolean;
  onSelect: (item: LabResultAttachment) => void;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRevalidate: () => void;
  returnFocus: () => HTMLElement | null;
  children?: ReactNode;
}) {
  const views = useRef(new Map<string, FileView>());
  const close = useRef<HTMLButtonElement>(null);
  const [attempt, setAttempt] = useState(0);
  const image = ["image/jpeg", "image/png", "image/webp"].includes(item.mimeType);
  const pdf = item.mimeType === "application/pdf";
  const text = item.mimeType === "text/plain" || item.mimeType === "text/csv";
  const supported = image || pdf || text;
  const content = useAttachmentContent(url, attempt, text, supported, onRevalidate);
  const restricted = content.status === "denied" || content.status === "unavailable";
  const index = items.findIndex(file => file.id === item.id);
  const readView = () => views.current.get(item.id);
  const remember = (next: FileView) => views.current.set(item.id, { ...views.current.get(item.id), ...next });

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false} initialFocus={close} finalFocus={returnFocus}
      overlayClassName="bg-black/60 supports-backdrop-filter:backdrop-blur-sm" className={styles.viewer} data-testid="lab-attachment-viewer">
      <header className={styles.header}>
        {image && !restricted ? <CdsFilesImageIcon className={styles.fileIcon} aria-hidden="true" /> : <CdsFilesFileTextIcon className={styles.fileIcon} aria-hidden="true" />}
        <div className={styles.identity}>
          <DialogTitle className={styles.title} title={restricted ? undefined : item.name}>{restricted ? "첨부 파일 미리보기" : item.name}</DialogTitle>
        </div>
        <div className={styles.actions}>
          {!restricted ? <>
            <Button type="button" variant="ghost" size="sm" aria-label="다운로드" onClick={onDownload}><CdsActionsDownloadIcon aria-hidden="true" /><span className={styles.actionLabel}>다운로드</span></Button>
            {canDelete ? <Button type="button" variant="ghost" size="sm" aria-label="삭제" className={styles.delete} data-testid="lab-viewer-delete" onClick={onDelete}><CdsActionsTrash2Icon aria-hidden="true" /><span className={styles.actionLabel}>삭제</span></Button> : null}
            <span className={styles.actionDivider} aria-hidden="true" />
          </> : null}
          <Button ref={close} type="button" variant="ghost" size="icon-sm" className={styles.close} aria-label="미리보기 닫기" title="닫기 (Esc)" onClick={onClose}><CdsActionsXIcon aria-hidden="true" /></Button>
        </div>
      </header>
      <div className={styles.body}>
        {metadataUnavailable && !restricted ? <div className={styles.collectionNotice} role="status">
          <span>첨부 목록을 갱신하지 못했습니다. 마지막으로 확인한 미리보기입니다.</span>
          <Button type="button" variant="outline" size="xs" onClick={onRevalidate}>목록 다시 불러오기</Button>
        </div> : null}
        <div className={styles.content}>
        {!supported ? <Feedback title="미리보기를 지원하지 않는 형식입니다." detail="다운로드해서 원본 파일을 확인해 주세요." />
          : content.status !== "ready" ? <ReadFeedback status={content.status} retry={() => setAttempt(value => value + 1)} />
          : image ? <ImagePreview key={content.key} url={content.objectUrl!} name={item.name} readView={readView} remember={next => remember({ image: next })} retry={() => setAttempt(value => value + 1)} />
          : pdf ? <PdfPreview key={content.key} url={content.objectUrl!} readView={readView} remember={next => remember({ pdf: next })} retry={() => setAttempt(value => value + 1)} />
          : item.mimeType === "text/csv" ? <CsvPreview text={content.text!} encoding={content.encoding!} />
          : <TextPreview key={content.key} text={content.text!} encoding={content.encoding!} />}
        </div>
      </div>
      {!restricted ? <footer className={styles.footer}>
        <div className={styles.scope} title={scopeLabel}><span className={styles.metadata}>{fileType(item.mimeType)} · {formatSize(item.size)} · 읽기 전용</span><span className={styles.scopeDetail}>{scopeLabel} · 첨부 자료</span></div>
        <div className={styles.navigation} role="group" aria-label="첨부 파일 이동">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="이전 파일" disabled={index <= 0} onClick={() => onSelect(items[index - 1])}><CdsNavigationChevronLeftIcon aria-hidden="true" /></Button>
          <output aria-label="현재 첨부 파일">{index + 1} / {items.length}</output>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="다음 파일" disabled={index < 0 || index >= items.length - 1} onClick={() => onSelect(items[index + 1])}><CdsNavigationChevronRightIcon aria-hidden="true" /></Button>
        </div>
      </footer> : null}
      {children}
    </DialogContent>
  </Dialog>;
}

function useAttachmentContent(url: string, attempt: number, text: boolean, supported: boolean, revalidate: () => void): Content {
  const key = `${url}:${attempt}`;
  const [content, setContent] = useState<Content>({ key: "", status: "loading" });
  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let expired = false;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      expired = true;
      controller.abort();
      setContent({ key, status: "error" });
    }, 30_000);
    void (async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          const status = attachmentReadStatus(response.status);
          setContent({ key, status });
          if (status === "denied" || status === "unavailable") revalidate();
          return;
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (!blob.size) { setContent({ key, status: "empty" }); return; }
        if (text) {
          const decoded = decodeAttachmentText(await blob.arrayBuffer());
          if (!controller.signal.aborted) setContent({ key, status: decoded.text.length ? "ready" : "empty", ...decoded });
        } else {
          objectUrl = URL.createObjectURL(blob);
          setContent({ key, status: "ready", objectUrl });
        }
      } catch {
        if (active && (!controller.signal.aborted || expired)) setContent({ key, status: "error" });
      } finally { window.clearTimeout(timer); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [key, url, text, supported, revalidate]);
  // Never display the previous response before the next effect starts.
  return content.key === key ? content : { key, status: "loading" };
}

function Feedback({ title, detail, retry }: { title: string; detail?: string; retry?: () => void }) {
  return <div className={styles.feedback} role="status"><p><strong>{title}</strong>{detail}</p>
    {retry ? <Button type="button" variant="outline" size="sm" onClick={retry}>다시 읽기</Button> : null}
  </div>;
}

function ReadFeedback({ status, retry }: { status: Content["status"]; retry: () => void }) {
  if (status === "loading") return <Feedback title="파일을 여는 중…" />;
  if (status === "empty") return <Feedback title="파일에 표시할 내용이 없습니다." detail="원본 파일을 다운로드해서 확인해 주세요." />;
  if (status === "denied") return <Feedback title="파일을 열 수 있는 권한이 없습니다." detail="접근 권한 또는 로그인 상태를 확인해 주세요." />;
  if (status === "unavailable") return <Feedback title="파일을 찾을 수 없습니다." detail="이미 삭제됐거나 현재 검사결과에서 사용할 수 없는 파일입니다." />;
  return <Feedback title="미리보기를 불러오지 못했습니다." detail="다시 읽거나 원본 파일을 다운로드해 주세요." retry={retry} />;
}

function ImagePreview({ url, name, readView, remember, retry }: { url: string; name: string; readView: () => FileView | undefined; remember: (next: ImageView) => void; retry: () => void }) {
  const [initial] = useState(() => readView()?.image);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [rotation, setRotation] = useState(initial?.rotation ?? 0);
  const [background, setBackground] = useState<ImageView["background"]>(initial?.background ?? "dark");
  const [scale, setScale] = useState(initial?.scale ?? 1);
  const transform = useRef<ReactZoomPanPinchRef>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => setFailed(true);
    image.src = url;
    return () => { image.onload = null; image.onerror = null; image.src = ""; };
  }, [url]);
  if (failed) return <Feedback title="이미지를 표시할 수 없습니다." detail="손상되었거나 브라우저가 읽을 수 없는 이미지입니다. 원본을 확인해 주세요." retry={retry} />;
  if (!dimensions) return <Feedback title="이미지를 여는 중…" />;
  const frame = rotation % 180 ? { width: dimensions.height, height: dimensions.width } : dimensions;
  const save = (nextRotation = rotation, nextBackground = background) => {
    const state = transform.current?.state;
    if (state) remember({ scale: state.scale, x: state.positionX, y: state.positionY, rotation: nextRotation, background: nextBackground });
  };
  return <TransformWrapper ref={transform} minScale={0.01} maxScale={8} initialScale={initial?.scale ?? 1}
    initialPositionX={initial?.x ?? 0} initialPositionY={initial?.y ?? 0}
    // Fit once. fitOnInit can reapply its pending layout after a quick user zoom.
    onInit={ref => { if (!initial) void ref.fitToView({ mode: "contain", animationTime: 0 }); }}
    wheel={{ activationKeys: ["Control", "Meta"] }} doubleClick={{ disabled: true }}
    keyboard={{ disabled: false, panStep: 40, zoomStep: 0.25, animationTime: 0 }}
    onTransform={(_, state) => { setScale(state.scale); remember({ scale: state.scale, x: state.positionX, y: state.positionY, rotation, background }); }}>
    {({ zoomIn, zoomOut, centerView, fitToView }) => <div className={styles.preview}>
      <div className={styles.toolbar} role="group" aria-label="이미지 보기 조작">
        <Button type="button" variant="ghost" size="xs" onClick={() => void fitToView({ mode: "contain", animationTime: 0 })}>맞춤</Button>
        <Button type="button" variant="ghost" size="xs" onClick={() => void centerView(1, 0)}>1:1</Button>
        <span className={styles.separator} aria-hidden="true" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="축소" disabled={scale <= 0.01} onClick={() => void zoomOut(0.25, 0)}><CdsActionsMinusIcon aria-hidden="true" /></Button>
        <output aria-label="이미지 배율">{Math.round(scale * 100)}%</output>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="확대" disabled={scale >= 8} onClick={() => void zoomIn(0.25, 0)}><CdsActionsPlusIcon aria-hidden="true" /></Button>
        <span className={styles.separator} aria-hidden="true" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="시계 방향으로 90도 회전" title="보기만 회전" onClick={() => {
          const next = (rotation + 90) % 360;
          setRotation(next); save(next);
          requestAnimationFrame(() => void fitToView({ mode: "contain", animationTime: 0 }));
        }}><CdsActionsRotateCwIcon aria-hidden="true" /></Button>
        <div className={styles.background}><label htmlFor="lab-viewer-background">배경</label><select id="lab-viewer-background" value={background} onChange={event => {
          const next = event.target.value as ImageView["background"]; setBackground(next); save(rotation, next);
        }}><option value="dark">다크</option><option value="gray">그레이</option><option value="checker">체커</option></select></div>
      </div>
      <div className={`${styles.stage} ${background === "gray" ? styles.gray : background === "checker" ? styles.checker : ""}`} data-testid="lab-image-stage">
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: frame.width, height: frame.height }}
          wrapperProps={{ tabIndex: 0, role: "region", "aria-label": "이미지 미리보기. 방향키로 이동, 더하기와 빼기로 확대 조절" }}>
          <div className={styles.imageFrame} style={frame}>
            {/* Protected bytes are decoded locally; original pixels and downloads remain unchanged. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`${name} 미리보기`} draggable={false} width={dimensions.width} height={dimensions.height}
              style={{ width: dimensions.width, height: dimensions.height, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
          </div>
        </TransformComponent>
      </div>
      <p className={styles.notice}>{dimensions.width} × {dimensions.height} px · {rotation}° · 드래그·방향키로 이동 · Ctrl/⌘ + 휠로 확대 · 회전은 원본에 저장되지 않습니다.</p>
    </div>}
  </TransformWrapper>;
}

function PdfPreview({ url, readView, remember, retry }: { url: string; readView: () => FileView | undefined; remember: (next: PdfView) => void; retry: () => void }) {
  const [initial] = useState(() => readView()?.pdf);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(initial?.page ?? 1);
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [size, setSize] = useState({ width: 800, height: 900 });
  const [ratio, setRatio] = useState(0.707);
  const [failure, setFailure] = useState<"encrypted" | "corrupt" | "empty" | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(80, Math.min(1600, Math.min(size.width - 32, (size.height - 32) * ratio) * zoom));
  const go = (next: number) => { setPage(next); remember({ page: next, zoom }); stage.current?.scrollTo(0, 0); };
  const magnify = (next: number) => { setZoom(next); remember({ page, zoom: next }); };
  if (failure === "encrypted") return <Feedback title="암호로 보호된 PDF입니다." detail="원본을 다운로드해서 암호를 입력할 수 있는 PDF 앱에서 열어 주세요." />;
  if (failure === "empty") return <Feedback title="PDF에 표시할 페이지가 없습니다." />;
  if (failure === "corrupt") return <Feedback title="PDF를 표시할 수 없습니다." detail="손상되었거나 지원하지 않는 PDF입니다. 원본을 확인해 주세요." retry={retry} />;
  return <div className={styles.preview}>
    <div className={styles.toolbar} role="group" aria-label="PDF 페이지 조작">
      <Button type="button" variant="ghost" size="xs" disabled={page <= 1 || !pageCount} onClick={() => go(page - 1)}>이전</Button>
      <output aria-label="현재 PDF 페이지">{pageCount ? `${page} / ${pageCount}` : "PDF"}</output>
      <Button type="button" variant="ghost" size="xs" disabled={!pageCount || page >= pageCount} onClick={() => go(page + 1)}>다음</Button>
      <span className={styles.separator} aria-hidden="true" />
      <Button type="button" variant="ghost" size="xs" onClick={() => magnify(1)}>맞춤</Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="PDF 축소" disabled={zoom <= 0.5} onClick={() => magnify(Math.max(0.5, zoom - 0.25))}><CdsActionsMinusIcon aria-hidden="true" /></Button>
      <output aria-label="PDF 배율">{Math.round(zoom * 100)}%</output>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="PDF 확대" disabled={zoom >= 3} onClick={() => magnify(Math.min(3, zoom + 0.25))}><CdsActionsPlusIcon aria-hidden="true" /></Button>
    </div>
    <div ref={stage} className={`${styles.scroll} ${styles.pdf}`} tabIndex={0} role="region" aria-label="PDF 페이지 미리보기">
      <Document file={url} suspense={false} loading="PDF를 여는 중…" error="PDF를 표시할 수 없습니다."
        onPassword={callback => { setFailure("encrypted"); callback(null); }} onLoadError={() => setFailure(current => current ?? "corrupt")}
        onLoadSuccess={({ numPages }) => {
          setPageCount(numPages);
          if (!numPages) setFailure("empty");
          const next = Math.min(page, Math.max(1, numPages));
          setPage(next); remember({ page: next, zoom });
        }}>
        <Page pageNumber={page} width={width} devicePixelRatio={1} renderTextLayer={false} renderAnnotationLayer={false}
          loading="페이지를 그리는 중…" onRenderError={() => setFailure("corrupt")}
          onLoadSuccess={loaded => { const viewport = loaded.getViewport({ scale: 1 }); setRatio(viewport.width / viewport.height); }} />
      </Document>
    </div>
    <p className={styles.notice}>현재 페이지 미리보기 · 문서와 도표의 원래 색을 유지합니다.</p>
  </div>;
}

function CsvPreview({ text, encoding }: { text: string; encoding: string }) {
  const data = useMemo(() => parseAttachmentCsv(text), [text]);
  if (!data.rowCount) return <Feedback title="표에 표시할 내용이 없습니다." />;
  if (data.malformed) return <Feedback title="CSV 표 구조를 확인할 수 없습니다." detail="따옴표나 구분자 형식을 확인해 주세요. 원본은 다운로드할 수 있습니다." />;
  const columns = Math.min(data.columnCount, CSV_PREVIEW_COLUMNS);
  return <div className={styles.preview}>
    <p className={styles.notice}>{encoding === "EUC-KR" ? "EUC-KR (추정)" : encoding} · {data.rowCount.toLocaleString()}행 · {data.columnCount}열 · 첫 행도 원본 데이터로 표시합니다.</p>
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="CSV 표 미리보기">
      <table className={styles.table}><thead><tr><th scope="col">행</th>{Array.from({ length: columns }, (_, i) => <th key={i} scope="col">열 {i + 1}</th>)}</tr></thead>
        <tbody>{data.rows.map((row, i) => <tr key={i}><th scope="row">{i + 1}</th>{Array.from({ length: columns }, (_, col) => <td key={col}>{row[col] ?? ""}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className={styles.notice}>{data.partial ? `일부 미리보기: 앞 ${data.rows.length}행 · ${columns}열, 셀당 최대 4,000자입니다. 전체 내용은 원본 다운로드로 확인해 주세요.` : "선행 0·단위·행 순서를 유지합니다. 수식처럼 보이는 값도 실행하지 않습니다."}</p>
  </div>;
}

function TextPreview({ text, encoding }: { text: string; encoding: string }) {
  const [wrap, setWrap] = useState(true);
  const [query, setQuery] = useState("");
  const visible = text.slice(0, TEXT_PREVIEW_LENGTH);
  const chunks: ReactNode[] = [];
  let count = 0;
  let start = 0;
  let more = false;
  if (query) {
    let found = visible.indexOf(query, start);
    while (found >= 0 && count < 100) {
      chunks.push(visible.slice(start, found), <mark key={found}>{visible.slice(found, found + query.length)}</mark>);
      start = found + query.length;
      count += 1;
      found = visible.indexOf(query, start);
    }
    more = found >= 0;
  }
  chunks.push(visible.slice(start));
  return <div className={styles.preview}>
    <div className={styles.toolbar} role="group" aria-label="텍스트 보기 조작">
      <input className={styles.search} type="search" aria-label="텍스트에서 찾기" placeholder="텍스트에서 찾기" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
      {query ? <output aria-label="검색 결과 수">{count}{more ? "+" : ""}개</output> : null}
      <Button type="button" variant="ghost" size="xs" aria-pressed={wrap} onClick={() => setWrap(value => !value)}>줄바꿈</Button>
    </div>
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="텍스트 미리보기"><pre className={`${styles.text} ${wrap ? styles.wrap : ""}`}>{chunks}</pre></div>
    <p className={styles.notice}>{encoding === "EUC-KR" ? "EUC-KR (추정)" : encoding} · {text.length > TEXT_PREVIEW_LENGTH ? `일부 미리보기: 앞 ${TEXT_PREVIEW_LENGTH.toLocaleString()}자입니다. 전체 내용은 원본 다운로드로 확인해 주세요.` : `${text.length.toLocaleString()}자 · 읽기 전용`}{query ? " · 현재 미리보기에서 대소문자를 구분해 찾습니다." : ""}</p>
  </div>;
}

function fileType(mimeType: string) {
  return mimeType === "application/pdf" ? "PDF" : mimeType === "text/csv" ? "CSV" : mimeType === "text/plain" ? "TXT" : mimeType.split("/").at(-1)?.toUpperCase() ?? "파일";
}
function formatSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
}
