import { diagnosisLabels, orderDescription, type ChartExportRecord, type ChartExportResult, type Section } from "./contract";
import { speciesLabel } from "./ranking";

export function exportDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date) : "시각 미기록";
}

const labStatus: Record<string, string> = { entered: "입력 완료", reviewed: "검토 완료", corrected: "정정" };
const resultKind: Record<string, string> = { lab: "임상병리", clinical_lab: "임상병리", external_lab: "원외검사", imaging: "영상검사" };
const judgment: Record<string, string> = { low: "낮음", normal: "정상", high: "높음", critical: "위험", abnormal: "이상" };

export function recordedResultLines(result: ChartExportResult) {
  const tag = [resultKind[result.kind], result.attempt && `${result.attempt}회차`, result.status && labStatus[result.status]].filter(Boolean).join(" · ");
  return [
    [result.order, tag].filter(Boolean).join(" / "),
    result.performedAt && `수행 시각 · ${exportDateTime(result.performedAt)}`,
    result.protocol && `검사 방법 · ${result.protocol}`,
    result.views?.length && `촬영 방향 · ${result.views.join(", ")}`,
    ...(result.rows ?? []).map(row => {
      const value = row.presence === "instrument_no_result" ? "측정 불가" : row.value == null ? "미기록" :
        [row.qualifier === "less_than" ? "<" : row.qualifier === "greater_than" ? ">" : "", row.value, row.unit].filter(Boolean).join(" ");
      return [`${row.name} · ${value}`, row.reference && `참고범위 ${row.reference}`, judgment[row.judgment], row.deviceFlag, row.note && `소견: ${row.note}`].filter(Boolean).join(" · ");
    }),
    result.finding && `${result.kind === "imaging" ? "검사 소견" : "종합소견"} · ${result.finding}`,
    result.interpretation && `판독 · ${result.interpretation}`,
    result.note && `비고 · ${result.note}`,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);
}

const headings = [
  "차트", "환자명", "동물종", "진료 일시", "차트 상태", "담당의", "작성자", "주호소",
  "S · 문진", "O · 관찰", "A · 평가", "진단", "P · 계획", "자유 기록",
  "처방·오더", "연결된 검사 결과 및 소견", "첨부 자료 목록", "검사 결과 열람 범위",
];
function cells(row: ChartExportRecord) {
  const notes = (section: Section | null) => row.paragraphs
    .filter(paragraph => paragraph.section === section)
    .map(paragraph => paragraph.scope ? `[${paragraph.scope}]\n${paragraph.text}` : paragraph.text)
    .join("\n\n");
  return [
    row.purpose || row.complaint || row.patient + " 진료",
    row.patient, speciesLabel(row.species), exportDateTime(row.visitAt),
    row.status === "signed" ? "완료" : row.status === "amended" ? "정정" : "작성 중",
    row.doctor, row.author, row.complaint,
    notes("subjective"), notes("objective"), notes("assessment"),
    row.diagnoses.map(d => [d.system, diagnosisLabels[d.kind], d.name, d.primary && "주진단"].filter(Boolean).join(" · ")).join("\n"),
    notes("plan"), notes(null),
    row.orders.map(o => `${orderDescription(o)} · 수량 ${o.quantity}`).join("\n"),
    row.results.map(result => recordedResultLines(result).join("\n")).join("\n\n"),
    row.attachments.map(item => [item.name, item.caption].filter(Boolean).join(" · ")).join("\n"),
    [!row.resultAccess.lab && "임상·원외검사 제외 (조회 권한 없음)",
      !row.resultAccess.imaging && "영상검사 제외 (조회 권한 없음)"].filter(Boolean).join("\n"),
  ];
}

export function chartCsv(rows: ChartExportRecord[]) {
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
export function downloadChartCsv(rows: ChartExportRecord[]) {
  const url = URL.createObjectURL(
    new Blob([chartCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "차트-기록.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
