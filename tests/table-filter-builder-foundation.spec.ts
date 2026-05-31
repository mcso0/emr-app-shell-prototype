import { expect, test } from "@playwright/test";

import {
  addEmrTableFilterBuilderDraftRule,
  createInitialEmrTableFilterBuilderModel,
  filterRowsByEmrTableFilterBuilder,
  getActiveEmrTableFilterBuilderRules,
  getEmrTableFilterBuilderActiveCount,
  removeEmrTableFilterBuilderRule,
  updateEmrTableFilterBuilderRuleField,
  updateEmrTableFilterBuilderRuleValue,
  type EmrTableFilterBuilderField,
} from "@/components/emr/table-filter-builder-model";

type DemoRow = {
  assignee: string;
  id: string;
  status: string;
};

const fields: Array<EmrTableFilterBuilderField<DemoRow>> = [
  {
    getValue: (row) => row.status,
    id: "status",
    label: "상태",
    options: [
      { label: "진행중", value: "active" },
      { label: "재확인", value: "review" },
    ],
  },
  {
    getValue: (row) => row.assignee,
    id: "assignee",
    label: "담당자",
    valueKind: "text",
    valuePlaceholder: "담당자 입력",
  },
];

const rows: DemoRow[] = [
  { assignee: "이수지", id: "row-1", status: "active" },
  { assignee: "박하늘", id: "row-2", status: "review" },
  { assignee: "이수지", id: "row-3", status: "review" },
];

test("reusable filter builder model opens with one incomplete draft rule", () => {
  const model = createInitialEmrTableFilterBuilderModel("order-filter");

  expect(model.rules).toHaveLength(1);
  expect(model.rules[0]).toMatchObject({
    combinator: "and",
    fieldId: null,
    operatorId: null,
    value: "",
  });
  expect(getEmrTableFilterBuilderActiveCount(model, fields)).toBe(0);
  expect(getActiveEmrTableFilterBuilderRules(model, fields)).toEqual([]);
});

test("incomplete rules are ignored and completed rules apply with AND", () => {
  let model = createInitialEmrTableFilterBuilderModel("order-filter");

  model = updateEmrTableFilterBuilderRuleField(
    model,
    model.rules[0].id,
    "status",
    fields
  );

  expect(getEmrTableFilterBuilderActiveCount(model, fields)).toBe(0);
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual(rows);

  model = updateEmrTableFilterBuilderRuleValue(
    model,
    model.rules[0].id,
    "review"
  );

  model = addEmrTableFilterBuilderDraftRule(model, "order-filter-rule-2");
  model = updateEmrTableFilterBuilderRuleField(
    model,
    "order-filter-rule-2",
    "assignee",
    fields
  );
  model = updateEmrTableFilterBuilderRuleValue(
    model,
    "order-filter-rule-2",
    "이수지"
  );

  expect(getEmrTableFilterBuilderActiveCount(model, fields)).toBe(2);
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([
    rows[2],
  ]);
});

test("removing every rule leaves one draft row for the next open state", () => {
  const model = createInitialEmrTableFilterBuilderModel("order-filter");
  const nextModel = removeEmrTableFilterBuilderRule(model, model.rules[0].id);

  expect(nextModel.rules).toHaveLength(1);
  expect(nextModel.rules[0]).toMatchObject({
    fieldId: null,
    operatorId: null,
    value: "",
  });
  expect(getEmrTableFilterBuilderActiveCount(nextModel, fields)).toBe(0);
});
