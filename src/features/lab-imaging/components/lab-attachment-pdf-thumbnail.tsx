"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export default function LabAttachmentPdfThumbnail({ url, onReady, onError }: {
  url: string;
  onReady: () => void;
  onError: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ width: 190, height: 107 });
  const [pageRatio, setPageRatio] = useState(1);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const intersection = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        intersection.disconnect();
      }
    });
    intersection.observe(element);
    const resize = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resize.observe(element);
    return () => { intersection.disconnect(); resize.disconnect(); };
  }, []);

  return <div ref={stage} className="flex h-full w-full items-center justify-center" data-testid="lab-pdf-thumbnail">
    {visible ? <Document file={url} suspense={false} loading={null} error={null}
      onSourceError={onError} onLoadError={onError} onPassword={onError}
      className="flex h-full w-full items-center justify-center">
      <Page pageNumber={1} width={Math.max(1, Math.min(size.width, size.height * pageRatio))}
        devicePixelRatio={1} renderTextLayer={false} renderAnnotationLayer={false}
        loading={null} error={null} onLoadError={onError} onRenderError={onError}
        onLoadSuccess={page => { const viewport = page.getViewport({ scale: 1 }); setPageRatio(viewport.width / viewport.height); }}
        onRenderSuccess={onReady} />
    </Document> : null}
  </div>;
}
