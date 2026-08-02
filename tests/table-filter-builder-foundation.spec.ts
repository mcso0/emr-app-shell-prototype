import { expect, test } from "@playwright/test";

import {
  addEmrTableFilterBuilderDraftGroup,
  addEmrTableFilterBuilderDraftRule,
  commitEmrTableFilterBuilderRule,
  createInitialEmrTableFilterBuilderModel,
  filterRowsByEmrTableFilterBuilder,
  getActiveEmrTableFilterBuilderRules,
  getEmrTableFilterBuilderActiveCount,
  removeEmrTableFilterBuilderRule,
  updateEmrTableFilterBuilderCombinator,
  updateEmrTableFilterBuilderGroupCombinator,
  updateEmrTableFilterBuilderRuleField,
  updateEmrTableFilterBuilderRuleDraftValue,
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

  expect(model.groups).toHaveLength(1);
  expect(model.groups[0].rules).toHaveLength(1);
  expect(model.groups[0]).toMatchObject({ combinator: "and" });
  expect(model.groups[0].rules[0]).toMatchObject({
    applied: null,
    fieldId: null,
    operatorId: null,
    value: "",
  });
  expect(getEmrTableFilterBuilderActiveCount(model, fields)).toBe(0);
  expect(getActiveEmrTableFilterBuilderRules(model, fields)).toEqual([]);
});

test("incomplete rules are ignored and completed rules apply with AND", () => {
  let model = createInitialEmrTableFilterBuilderModel("order-filter");
  const groupId = model.groups[0].id;
  const firstRuleId = model.groups[0].rules[0].id;

  model = updateEmrTableFilterBuilderRuleField(
    model,
    groupId,
    firstRuleId,
    "status",
    fields
  );

  expect(getEmrTableFilterBuilderActiveCount(model, fields)).toBe(0);
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual(rows);

  model = updateEmrTableFilterBuilderRuleValue(
    model,
    groupId,
    firstRuleId,
    "review",
    fields
  );

  model = addEmrTableFilterBuilderDraftRule(model, groupId, "order-filter-rule-2");
  model = updateEmrTableFilterBuilderRuleField(
    model,
    groupId,
    "order-filter-rule-2",
    "assignee",
    fields
  );
  model = updateEmrTableFilterBuilderRuleValue(
    model,
    groupId,
    "order-filter-rule-2",
    "이수지",
    fields
  );

  expect(getEmrTableFilterBuilderActiveCount(model, fields)).toBe(2);
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([
    rows[2],
  ]);
});

test("removing every rule leaves one draft row for the next open state", () => {
  const model = createInitialEmrTableFilterBuilderModel("order-filter");
  const groupId = model.groups[0].id;
  const nextModel = removeEmrTableFilterBuilderRule(
    model,
    groupId,
    model.groups[0].rules[0].id
  );

  expect(nextModel.groups).toHaveLength(1);
  expect(nextModel.groups[0].rules).toHaveLength(1);
  expect(nextModel.groups[0].rules[0]).toMatchObject({
    fieldId: null,
    operatorId: null,
    value: "",
  });
  expect(getEmrTableFilterBuilderActiveCount(nextModel, fields)).toBe(0);
});

test("rules can use OR inside a group", () => {
  let model = createInitialEmrTableFilterBuilderModel("order-filter");
  const groupId = model.groups[0].id;
  const firstRuleId = model.groups[0].rules[0].id;

  model = updateEmrTableFilterBuilderRuleField(model, groupId, firstRuleId, "status", fields);
  model = updateEmrTableFilterBuilderRuleValue(model, groupId, firstRuleId, "active", fields);
  model = addEmrTableFilterBuilderDraftRule(model, groupId, "order-filter-rule-2");
  model = updateEmrTableFilterBuilderRuleField(model, groupId, "order-filter-rule-2", "assignee", fields);
  model = updateEmrTableFilterBuilderRuleValue(model, groupId, "order-filter-rule-2", "박하늘", fields);
  model = updateEmrTableFilterBuilderGroupCombinator(model, groupId, "or");

  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([
    rows[0],
    rows[1],
  ]);
});

test("groups can use OR while each group keeps its own combinator", () => {
  let model = createInitialEmrTableFilterBuilderModel("order-filter");
  const firstGroupId = model.groups[0].id;
  const firstRuleId = model.groups[0].rules[0].id;
  model = updateEmrTableFilterBuilderRuleField(model, firstGroupId, firstRuleId, "status", fields);
  model = updateEmrTableFilterBuilderRuleValue(model, firstGroupId, firstRuleId, "active", fields);

  model = addEmrTableFilterBuilderDraftGroup(
    model,
    "order-filter-group-2",
    "order-filter-group-2-rule-1"
  );
  model = updateEmrTableFilterBuilderRuleField(
    model,
    "order-filter-group-2",
    "order-filter-group-2-rule-1",
    "assignee",
    fields
  );
  model = updateEmrTableFilterBuilderRuleValue(
    model,
    "order-filter-group-2",
    "order-filter-group-2-rule-1",
    "박하늘",
    fields
  );
  model = updateEmrTableFilterBuilderCombinator(model, "or");

  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([
    rows[0],
    rows[1],
  ]);
});

test("editing an active rule keeps its last valid result until the new value completes", () => {
  let model = createInitialEmrTableFilterBuilderModel("order-filter");
  const groupId = model.groups[0].id;
  const ruleId = model.groups[0].rules[0].id;
  model = updateEmrTableFilterBuilderRuleField(model, groupId, ruleId, "status", fields);
  model = updateEmrTableFilterBuilderRuleValue(model, groupId, ruleId, "review", fields);

  model = updateEmrTableFilterBuilderRuleField(model, groupId, ruleId, "assignee", fields);
  expect(getEmrTableFilterBuilderActiveCount(model, fields)).toBe(1);
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([
    rows[1],
    rows[2],
  ]);

  model = updateEmrTableFilterBuilderRuleValue(model, groupId, ruleId, "이수지", fields);
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([
    rows[0],
    rows[2],
  ]);
});

test("free text draft waits for commit before replacing the active snapshot", () => {
  let model = createInitialEmrTableFilterBuilderModel("order-filter");
  const groupId = model.groups[0].id;
  const ruleId = model.groups[0].rules[0].id;
  model = updateEmrTableFilterBuilderRuleField(model, groupId, ruleId, "assignee", fields);
  model = updateEmrTableFilterBuilderRuleValue(model, groupId, ruleId, "박하늘", fields);

  model = updateEmrTableFilterBuilderRuleDraftValue(model, groupId, ruleId, "이수지");
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([rows[1]]);

  model = commitEmrTableFilterBuilderRule(model, groupId, ruleId, fields);
  expect(filterRowsByEmrTableFilterBuilder(rows, model, fields)).toEqual([
    rows[0],
    rows[2],
  ]);
});
