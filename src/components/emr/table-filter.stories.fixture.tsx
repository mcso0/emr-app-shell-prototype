import {
  addEmrTableFilterBuilderDraftGroup,
  addEmrTableFilterBuilderDraftRule,
  createInitialEmrTableFilterBuilderModel,
  filterRowsByEmrTableFilterBuilder,
  getEmrTableFilterBuilderActiveCount,
  updateEmrTableFilterBuilderRuleField,
  updateEmrTableFilterBuilderRuleValue,
  type EmrTableFilterBuilderField,
  type EmrTableFilterBuilderModel,
} from "./table-filter-builder-model";

// Required by both Builder and Trigger API specimens. The actual source
// model, completeness rules and filtering algorithm own all transitions.
type SampleRow = { id: string; label: string; owner: string; status: string };
export const sampleFilterFields: Array<EmrTableFilterBuilderField<SampleRow>> = [
  { id: "status", label: "상태", getValue: row => row.status, options: [{ label: "대기", value: "waiting" }, { label: "진행", value: "active" }, { label: "완료", value: "done" }], valuePlaceholder: "상태 선택" },
  { id: "owner", label: "담당", getValue: row => row.owner, valueKind: "text", valuePlaceholder: "담당 입력" },
];
const sampleRows: SampleRow[] = [
  { id: "waiting", label: "합성 대기 업무", owner: "합성 접수팀", status: "waiting" },
  { id: "active", label: "합성 진행 업무", owner: "합성 검사팀", status: "active" },
  { id: "done", label: "합성 완료 업무", owner: "합성 검사팀", status: "done" },
];
export function createSampleFilterModel(count: number) {
  let model = createInitialEmrTableFilterBuilderModel("sample-filter");
  // Source limits: three groups, at most five conditions per group.
  for (let index = 0; index < Math.min(15, Math.max(0, Math.floor(count))); index += 1) {
    if (index > 0 && index % 5 === 0) model = addEmrTableFilterBuilderDraftGroup(model, `sample-filter-group-${index / 5 + 1}`, `sample-filter-rule-${index + 1}`);
    else if (index > 0) model = addEmrTableFilterBuilderDraftRule(model, model.groups.at(-1)!.id, `sample-filter-rule-${index + 1}`);
    const group = model.groups.at(-1)!, rule = group.rules.at(-1)!;
    model = updateEmrTableFilterBuilderRuleField(model, group.id, rule.id, "status", sampleFilterFields);
    model = updateEmrTableFilterBuilderRuleValue(model, group.id, rule.id, "active", sampleFilterFields);
  }
  return model;
}
export function SampleFilterResults({ model }: { model: EmrTableFilterBuilderModel }) {
  const rows = filterRowsByEmrTableFilterBuilder(sampleRows, model, sampleFilterFields);
  return <div className="mt-3 rounded border p-3">
    <output aria-label="필터 결과" className="block">완성된 조건 {getEmrTableFilterBuilderActiveCount(model, sampleFilterFields)}개 · 결과 {rows.length}건</output>
    <ul aria-label="필터 업무 목록">{rows.map(row => <li key={row.id}>{row.label}</li>)}</ul>
  </div>;
}
