import type { ChartExportResult, SearchParagraph } from "@/features/chart/advanced-search/contract";

// Synthetic QA only. The review route is disabled in Production.
const chartId = "c876f9ed-1732-4a96-ab89-a96361e648b1";
export function reviewExportData(id: string): { paragraphs: SearchParagraph[]; results: ChartExportResult[] } {
  if (id !== chartId) return { paragraphs: [], results: [] };
  return {
    paragraphs: [
      { id: "pdf-qa-long", scope: "경과 기록", section: "subjective", text: Array.from({ length: 31 }, (_, i) =>
        `관찰 기록 ${i + 1} · 식사 시간과 증상 변화를 차트에 남겼습니다.`).join("\n") + "\n긴 기록 마지막 줄 · 누락 여부 확인" },
      { id: "pdf-qa-free", scope: "", section: null, text: '= "검수용 자유 기록"\n줄바꿈을 보존합니다.' },
    ],
    results: [
      { order: "혈구 검사", kind: "clinical_lab", attempt: 1, status: "reviewed",
        finding: "합성 검사 종합소견: 이전 검사와 비교한 내용을 기록했습니다.\n다음 진료에서 경과를 다시 확인하기로 했습니다.",
        rows: [
          { name: "백혈구", value: "8.4", unit: "10³/µL", reference: "5.5–19.5", judgment: "normal",
            presence: "value", qualifier: "exact", deviceFlag: null, note: "합성 관찰값" },
          { name: "혈소판", value: "20", unit: "10³/µL", reference: null, judgment: "low",
            presence: "value", qualifier: "less_than", deviceFlag: null, note: "합성 장비 신호 확인" },
        ] },
      { order: "복부 초음파", kind: "imaging", attempt: 2, protocol: "복부 초음파",
        finding: "합성 영상 소견: 검사 당시 관찰 사항을 기록했습니다.",
        interpretation: "합성 영상 판독: 이전 기록과 비교했습니다." },
    ],
  };
}
