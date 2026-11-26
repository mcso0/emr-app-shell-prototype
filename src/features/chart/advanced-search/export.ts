import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import type { ChartExportFormat, ChartExportSummary } from "./contract";
import { speciesLabel } from "./ranking";

const headings = [
  "차트",
  "환자명",
  "동물종",
  "진료일",
  "담당의",
  "작성자",
  "진단",
];
function cells(row: ChartExportSummary) {
  return [
    row.title,
    row.patient,
    speciesLabel(row.species),
    getOperatingDateFromIso(row.visitAt),
    row.doctor,
    row.author,
    row.diagnosis,
  ].map((v) => v ?? "");
}
export function summaryCsv(rows: ChartExportSummary[]) {
  return (
    "\uFEFF" +
    [headings, ...rows.map(cells)]
      .map((row) =>
        row
          .map((value) => {
            const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(value)
              ? "'" + value
              : value;
            return '"' + safe.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export function deliverSummary(
  format: ChartExportFormat,
  rows: ChartExportSummary[],
) {
  if (format === "csv") {
    const url = URL.createObjectURL(
      new Blob([summaryCsv(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "차트-요약.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  // Isolate the print document so neither the app nor other patient records can appear.
  const frame = document.createElement("iframe");
  frame.title = "선택한 차트 요약 인쇄";
  frame.style.cssText =
    "position:fixed;width:1px;height:1px;right:0;bottom:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument,
    win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error("print_unavailable");
  }
  doc.documentElement.lang = "ko";
  doc.title = "선택한 차트 요약";
  const title = doc.createElement("h1");
  title.textContent = doc.title;
  doc.body.appendChild(title);
  for (const row of rows) {
    const section = doc.createElement("section");
    section.style.breakInside = "avoid";
    cells(row).forEach((value, i) => {
      const line = doc.createElement("p");
      line.textContent = headings[i] + " · " + (value || "미기록");
      section.appendChild(line);
    });
    doc.body.appendChild(section);
  }
  win.addEventListener("afterprint", () => frame.remove(), { once: true });
  try {
    win.print();
  } catch (error) {
    frame.remove();
    throw error;
  }
}
