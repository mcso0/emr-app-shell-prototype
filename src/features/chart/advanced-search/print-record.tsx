import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Card } from "@/components/ui/card";
import { type ChartExportRecord } from "./contract";
import { ChartHistoryRecord, ChartHistorySection, ChartHistoryTextCard, visitLabel } from "./history-detail";
import { stateText } from "./presentation";
import { recordedResultLines, exportDateTime } from "./export";
import { speciesLabel } from "./ranking";

function ChartPrintDocument({ rows }: { rows: ChartExportRecord[] }) {
  return (
    <main data-chart-print-root>
      <h1 className="emr-text-dialog-title font-semibold">선택한 차트 기록</h1>
      {rows.map(row => (
        <article key={row.chartId} data-print-chart>
          <Card className="gap-0 border py-0 ring-0" data-print-history-card>
            <header data-print-history-header className="flex flex-wrap items-center gap-2 p-4">
              <span className="emr-text-panel-title font-semibold">{row.patient} · {speciesLabel(row.species)}</span>
              <time dateTime={row.visitAt} className="emr-text-metadata">{exportDateTime(row.visitAt)}</time>
              <EmrStatusBadge label={stateText(row.status)} />
              {row.author && <span className="emr-text-metadata">작성자 · {row.author}</span>}
            </header>
            <ChartHistoryRecord chart={{ ...row, media: [] }} visitType={visitLabel(row)} print>
              {row.complaint && row.complaint !== row.purpose && <ChartHistorySection title="주호소">
                <ChartHistoryTextCard lines={[row.complaint]} />
              </ChartHistorySection>}
              <ChartHistorySection title="연결된 검사 결과">
                {row.results.map((result, index) => {
                  const lines = recordedResultLines(result);
                  const body = lines.join("\n");
                  return <ChartHistoryTextCard key={index} lines={lines}
                    keepTogether={body.length <= 900 && body.split("\n").length <= 12} />;
                })}
                {row.results.length === 0 && <ChartHistoryTextCard lines={["내보낼 최종 검사 결과가 없습니다."]} />}
                {(!row.resultAccess.lab || !row.resultAccess.imaging) && <ChartHistoryTextCard lines={[
                  `${[!row.resultAccess.lab && "임상·원외검사", !row.resultAccess.imaging && "영상검사"].filter(Boolean).join(" 및 ")} 결과는 조회 권한이 없는 경우 포함되지 않습니다.`,
                ]} />}
              </ChartHistorySection>
              {row.attachments.length > 0 && <ChartHistorySection title="첨부 자료 목록">
                <ChartHistoryTextCard lines={row.attachments.map(item =>
                  [item.video ? "동영상" : "첨부", item.name, item.caption].filter(Boolean).join(" · "))} />
              </ChartHistorySection>}
            </ChartHistoryRecord>
          </Card>
        </article>
      ))}
    </main>
  );
}

const printStyles = `
@page { size: A4; margin: 13mm; }
html, body { margin: 0; background: #fff; color: #17212f; overflow: visible; }
[data-chart-print-root] { font-family: "Pretendard Variable", "Noto Sans CJK KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
[data-chart-print-root] > h1 { margin: 0 0 4mm; }
[data-print-chart] + [data-print-chart] { break-before: page; }
[data-print-history-card], [data-chart-print-root] [data-slot=card] { display: block; overflow: visible; }
[data-chart-print-root] [data-record-body], [data-chart-print-root] [data-history-section],
[data-chart-print-root] [data-record-scope] > [data-slot=card-content],
[data-chart-print-root] [data-history-section] [data-slot=card-content] { display: block; }
[data-chart-print-root] [data-record-body] { padding-block: 3.5mm; }
[data-print-history-header] { padding-block: 3mm; }
[data-chart-print-root] [data-history-section] { margin-top: 2mm; padding-block: 2mm 0; }
[data-chart-print-root] [data-history-section-heading] { min-height: 5mm; margin-bottom: 1mm; }
[data-chart-print-root] [data-history-section] [data-slot=card]:not([data-record-scope]) { padding-block: 2mm; }
[data-chart-print-root] [data-record-scope] [data-slot=card-header] { min-height: 0; padding-block: 2mm; }
[data-chart-print-root] [data-record-scope] [data-slot=card-content] { padding-block: 2mm; }
[data-chart-print-root] [data-history-section-heading], [data-print-history-header],
[data-chart-print-root] [data-slot=card-header], [data-print-paragraph-label] { break-after: avoid; }
[data-chart-print-root] [data-history-paragraph] + [data-history-paragraph],
[data-chart-print-root] [data-history-section] [data-slot=card] + [data-slot=card] { margin-top: 2mm; }
[data-chart-print-root] [data-history-keep-together] { break-inside: avoid; }
[data-chart-print-root] [data-history-section] p + p { margin-top: 1.5mm; }
[data-chart-print-root] [data-history-section] p { white-space: pre-wrap; tab-size: 4; overflow-wrap: anywhere; orphans: 2; widows: 2; }
[data-chart-print-root] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/** Load the app's own styles and mount the shared history cards in an isolated print document. */
export async function printChartRecords(rows: ChartExportRecord[]) {
  const frame = document.createElement("iframe");
  frame.title = "선택한 차트 기록 인쇄";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:0;top:0;width:210mm;height:297mm;opacity:0;pointer-events:none;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); throw new Error("print_unavailable"); }
  doc.documentElement.lang = "ko";
  const charset = doc.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  doc.head.prepend(charset);
  doc.title = "선택한 차트 기록";
  const styles: Promise<void>[] = [];
  for (const node of document.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>("style, link[rel=stylesheet]")) {
    if (node instanceof HTMLStyleElement) doc.head.appendChild(node.cloneNode(true));
    else if (new URL(node.href).origin === location.origin) {
      const copy = doc.createElement("link");
      copy.rel = "stylesheet"; copy.href = node.href;
      if (node.media) copy.media = node.media;
      styles.push(new Promise((resolve, reject) => {
        copy.addEventListener("load", () => resolve(), { once: true });
        copy.addEventListener("error", () => reject(new Error("print_unavailable")), { once: true });
      }));
      doc.head.appendChild(copy);
    }
  }
  const style = doc.createElement("style");
  style.textContent = printStyles;
  doc.head.appendChild(style);
  const root = createRoot(doc.body);
  const clean = () => { root.unmount(); frame.remove(); };
  let timer: number | undefined;
  try {
    flushSync(() => root.render(<ChartPrintDocument rows={rows} />));
    await Promise.race([
      (async () => { await Promise.all(styles); void doc.body.offsetHeight; await doc.fonts.ready; })(),
      new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("print_unavailable")), 10000); }),
    ]);
    win.addEventListener("afterprint", clean, { once: true });
    win.print();
  } catch (error) {
    clean();
    throw error;
  } finally { window.clearTimeout(timer); }
}
