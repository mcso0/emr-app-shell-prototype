"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { LabResultAttachment } from "../use-lab-result-phase2";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export default function LabAttachmentViewer({ item, url, canDelete, onClose, onDownload, onDelete }: {
  item: LabResultAttachment;
  url: string;
  canDelete: boolean;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const image = item.mimeType.startsWith("image/");
  const pdf = item.mimeType === "application/pdf";
  const text = item.mimeType === "text/plain" || item.mimeType === "text/csv";
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false} className="flex h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[1800px] flex-col gap-0 overflow-hidden rounded-xl bg-[var(--emr-surface-panel)] p-0 sm:h-[min(1080px,calc(100dvh-64px))] sm:w-[calc(100vw-64px)] sm:max-w-[1800px]">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--emr-border-default)] px-4 sm:px-6">
        <DialogTitle className="min-w-0 truncate emr-text-body font-semibold" title={item.name}>{item.name}</DialogTitle>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={onDownload}>다운로드</Button>
          {canDelete ? <Button type="button" variant="ghost" size="xs" onClick={onDelete}>삭제</Button> : null}
          <Button type="button" variant="ghost" size="icon-xs" aria-label="미리보기 닫기" onClick={onClose}>×</Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 bg-[var(--emr-surface-muted)] p-4 sm:p-6">
        {image ? <ImagePreview key={item.id} url={url} name={item.name} /> : pdf ? <PdfPreview key={item.id} url={url} /> : text ? <TextPreview key={item.id} url={url} />
          : <div className="flex h-full items-center justify-center emr-text-dense text-muted-foreground">이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드해 확인해 주세요.</div>}
      </div>
    </DialogContent>
  </Dialog>;
}

function ImagePreview({ url, name }: { url: string; name: string }) {
  const [scale, setScale] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  return <TransformWrapper minScale={0.05} maxScale={8} centerOnInit fitOnInit="contain"
    wheel={{ activationKeys: ["Control", "Meta"] }} onTransform={(_, next) => setScale(next.scale)}>
    {({ zoomIn, zoomOut, centerView, resetTransform }) => <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-center gap-1" role="group" aria-label="이미지 확대 조작">
        <Button variant="outline" size="xs" onClick={() => resetTransform(180)}>맞춤</Button>
        <Button variant="outline" size="xs" onClick={() => centerView(1, 180)}>1:1</Button>
        <Button variant="outline" size="icon-xs" aria-label="축소" onClick={() => zoomOut(0.25, 180)}>−</Button>
        <output className="min-w-12 text-center emr-text-metadata" aria-label="이미지 배율">{Math.round(scale * 100)}%</output>
        <Button variant="outline" size="icon-xs" aria-label="확대" onClick={() => zoomIn(0.25, 180)}>＋</Button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-[var(--emr-surface-workspace)]">
        {state !== "ready" ? <div className="absolute inset-0 flex items-center justify-center emr-text-dense text-muted-foreground" role="status">{state === "loading" ? "이미지를 여는 중…" : "이미지를 표시할 수 없습니다. 다운로드를 이용해 주세요."}</div> : null}
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Protected same-origin route is deliberately left unoptimized. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${name} 미리보기`} draggable={false} className="max-h-full max-w-full object-contain" onLoad={() => setState("ready")} onError={() => setState("error")} />
        </TransformComponent>
      </div>
    </div>}
  </TransformWrapper>;
}

function PdfPreview({ url }: { url: string }) {
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(800);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.min(1100, entry.contentRect.width - 32))));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  return <div className="flex h-full min-h-0 flex-col gap-3">
    <div className="flex justify-center gap-2" role="group" aria-label="PDF 페이지 조작">
      <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>이전</Button>
      <output className="emr-text-dense" aria-label="현재 PDF 페이지">{pageCount ? `${page} / ${pageCount}` : "PDF"}</output>
      <Button variant="outline" size="xs" disabled={!pageCount || page >= pageCount} onClick={() => setPage(value => value + 1)}>다음</Button>
    </div>
    <div ref={stage} className="min-h-0 flex-1 overflow-auto rounded-md bg-[var(--emr-surface-workspace)] p-4 text-center">
      <Document file={url} loading="PDF를 여는 중…" error="PDF를 표시할 수 없습니다. 다운로드를 이용해 주세요."
        onLoadSuccess={({ numPages }) => { setPageCount(numPages); setPage(1); }}>
        <Page pageNumber={page} width={width} renderTextLayer={false} renderAnnotationLayer={false} loading="페이지를 그리는 중…" />
      </Document>
    </div>
  </div>;
}

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; text: string }>({ status: "loading", text: "" });
  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("read_failed");
      return response.text();
    }).then(text => { if (!controller.signal.aborted) setState({ status: "ready", text }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: "error", text: "" }); });
    return () => controller.abort();
  }, [url]);
  return <div className="h-full overflow-auto rounded-md bg-[var(--emr-surface-workspace)] p-4 emr-text-dense">
    {state.status === "ready" ? <pre className="whitespace-pre-wrap break-words">{state.text}</pre>
      : <p role="status" className="text-center text-muted-foreground">{state.status === "loading" ? "파일을 여는 중…" : "미리보기를 열 수 없습니다. 다운로드를 이용해 주세요."}</p>}
  </div>;
}
