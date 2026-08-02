export type EmrTableFilterBuilderCombinator = "and" | "or";

export type EmrTableFilterBuilderValueKind = "select" | "text";

export type EmrTableFilterBuilderOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type EmrTableFilterBuilderOperator<TRow = unknown> = {
  id: string;
  label: string;
  match?: (fieldValue: unknown, ruleValue: string, row: TRow) => boolean;
  valueRequired?: boolean;
};

export type EmrTableFilterBuilderField<TRow = unknown> = {
  disabled?: boolean;
  getValue?: (row: TRow) => unknown;
  id: string;
  label: string;
  operators?: Array<EmrTableFilterBuilderOperator<TRow>>;
  options?: EmrTableFilterBuilderOption[];
  valueKind?: EmrTableFilterBuilderValueKind;
  valuePlaceholder?: string;
};

export type EmrTableFilterBuilderRuleSnapshot = {
  fieldId: string;
  operatorId: string;
  value: string;
};

export type EmrTableFilterBuilderRule = {
  applied: EmrTableFilterBuilderRuleSnapshot | null;
  fieldId: string | null;
  id: string;
  operatorId: string | null;
  value: string;
};

export type EmrTableFilterBuilderGroup = {
  combinator: EmrTableFilterBuilderCombinator;
  id: string;
  rules: EmrTableFilterBuilderRule[];
};

export type EmrTableFilterBuilderModel = {
  combinator: EmrTableFilterBuilderCombinator;
  groups: EmrTableFilterBuilderGroup[];
  id: string;
};

export const emrTableFilterBuilderDefaultOperators: EmrTableFilterBuilderOperator[] = [
  { id: "is", label: "같음" },
  { id: "contains", label: "포함" },
];

export function createEmrTableFilterBuilderRule(
  id: string,
  overrides: Partial<Omit<EmrTableFilterBuilderRule, "id">> = {}
): EmrTableFilterBuilderRule {
  return {
    applied: null,
    fieldId: null,
    id,
    operatorId: null,
    value: "",
    ...overrides,
  };
}

export function createEmrTableFilterBuilderGroup(
  id: string,
  ruleId = `${id}-rule-1`
): EmrTableFilterBuilderGroup {
  return {
    combinator: "and",
    id,
    rules: [createEmrTableFilterBuilderRule(ruleId)],
  };
}

export function createInitialEmrTableFilterBuilderModel(
  id: string,
  ruleId = `${id}-group-1-rule-1`
): EmrTableFilterBuilderModel {
  return {
    combinator: "and",
    groups: [createEmrTableFilterBuilderGroup(`${id}-group-1`, ruleId)],
    id,
  };
}

export function getEmrTableFilterBuilderField<TRow>(
  fields: Array<EmrTableFilterBuilderField<TRow>>,
  fieldId: string | null
) {
  if (!fieldId) return undefined;

  return fields.find((field) => field.id === fieldId && !field.disabled);
}

export function getEmrTableFilterBuilderOperators<TRow>(
  field?: EmrTableFilterBuilderField<TRow>
) {
  return field?.operators?.length
    ? field.operators
    : emrTableFilterBuilderDefaultOperators;
}

export function getEmrTableFilterBuilderOperator<TRow>(
  field: EmrTableFilterBuilderField<TRow> | undefined,
  operatorId: string | null
) {
  if (!operatorId) return undefined;

  return getEmrTableFilterBuilderOperators(field).find(
    (operator) => operator.id === operatorId
  );
}

export function isEmrTableFilterBuilderRuleComplete<TRow>(
  rule: Pick<EmrTableFilterBuilderRule, "fieldId" | "operatorId" | "value">,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  const field = getEmrTableFilterBuilderField(fields, rule.fieldId);
  const operator = getEmrTableFilterBuilderOperator(field, rule.operatorId);

  if (!field || !operator) return false;
  if (operator.valueRequired === false) return true;

  return rule.value.trim().length > 0;
}

function snapshotRule(rule: EmrTableFilterBuilderRule): EmrTableFilterBuilderRuleSnapshot {
  return {
    fieldId: rule.fieldId ?? "",
    operatorId: rule.operatorId ?? "",
    value: rule.value,
  };
}

function commitRuleWhenComplete<TRow>(
  rule: EmrTableFilterBuilderRule,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  return isEmrTableFilterBuilderRuleComplete(rule, fields)
    ? { ...rule, applied: snapshotRule(rule) }
    : rule;
}

function getEffectiveRule<TRow>(
  rule: EmrTableFilterBuilderRule,
  fields: Array<EmrTableFilterBuilderField<TRow>>
): EmrTableFilterBuilderRule | null {
  if (!rule.applied) return null;

  const effectiveRule = {
    ...rule,
    fieldId: rule.applied.fieldId,
    operatorId: rule.applied.operatorId,
    value: rule.applied.value,
  };

  return isEmrTableFilterBuilderRuleComplete(effectiveRule, fields)
    ? effectiveRule
    : null;
}

export function getActiveEmrTableFilterBuilderRules<TRow>(
  model: EmrTableFilterBuilderModel,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  return model.groups.flatMap((group) =>
    group.rules.flatMap((rule) => {
      const effectiveRule = getEffectiveRule(rule, fields);
      return effectiveRule ? [effectiveRule] : [];
    })
  );
}

export function getEmrTableFilterBuilderActiveCount<TRow>(
  model: EmrTableFilterBuilderModel,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  return getActiveEmrTableFilterBuilderRules(model, fields).length;
}

export function ensureEmrTableFilterBuilderDraft(
  model: EmrTableFilterBuilderModel
): EmrTableFilterBuilderModel {
  if (model.groups.length > 0) return model;

  return createInitialEmrTableFilterBuilderModel(model.id);
}

function updateRule(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string,
  updater: (rule: EmrTableFilterBuilderRule) => EmrTableFilterBuilderRule
) {
  return {
    ...model,
    groups: model.groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            rules: group.rules.map((rule) =>
              rule.id === ruleId ? updater(rule) : rule
            ),
          }
        : group
    ),
  };
}

export function updateEmrTableFilterBuilderRuleField<TRow>(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string,
  fieldId: string | null,
  fields: Array<EmrTableFilterBuilderField<TRow>>
): EmrTableFilterBuilderModel {
  const field = getEmrTableFilterBuilderField(fields, fieldId);
  const firstOperator = field ? getEmrTableFilterBuilderOperators(field)[0] : undefined;

  return updateRule(model, groupId, ruleId, (rule) =>
    commitRuleWhenComplete(
      {
        ...rule,
        fieldId: field?.id ?? null,
        operatorId: firstOperator?.id ?? null,
        value: "",
      },
      fields
    )
  );
}

export function updateEmrTableFilterBuilderRuleOperator<TRow>(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string,
  operatorId: string | null,
  fields: Array<EmrTableFilterBuilderField<TRow>>
): EmrTableFilterBuilderModel {
  return updateRule(model, groupId, ruleId, (rule) =>
    commitRuleWhenComplete({ ...rule, operatorId, value: "" }, fields)
  );
}

export function updateEmrTableFilterBuilderRuleValue<TRow>(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string,
  value: string,
  fields: Array<EmrTableFilterBuilderField<TRow>>
): EmrTableFilterBuilderModel {
  return updateRule(model, groupId, ruleId, (rule) =>
    commitRuleWhenComplete({ ...rule, value }, fields)
  );
}

export function updateEmrTableFilterBuilderRuleDraftValue(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string,
  value: string
): EmrTableFilterBuilderModel {
  return updateRule(model, groupId, ruleId, (rule) => ({ ...rule, value }));
}

export function commitEmrTableFilterBuilderRule<TRow>(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string,
  fields: Array<EmrTableFilterBuilderField<TRow>>
): EmrTableFilterBuilderModel {
  return updateRule(model, groupId, ruleId, (rule) =>
    commitRuleWhenComplete(rule, fields)
  );
}

export function updateEmrTableFilterBuilderGroupCombinator(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  combinator: EmrTableFilterBuilderCombinator
): EmrTableFilterBuilderModel {
  return {
    ...model,
    groups: model.groups.map((group) =>
      group.id === groupId ? { ...group, combinator } : group
    ),
  };
}

export function updateEmrTableFilterBuilderCombinator(
  model: EmrTableFilterBuilderModel,
  combinator: EmrTableFilterBuilderCombinator
): EmrTableFilterBuilderModel {
  return { ...model, combinator };
}

export function addEmrTableFilterBuilderDraftRule(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string
): EmrTableFilterBuilderModel {
  return {
    ...model,
    groups: model.groups.map((group) =>
      group.id === groupId
        ? { ...group, rules: [...group.rules, createEmrTableFilterBuilderRule(ruleId)] }
        : group
    ),
  };
}

export function addEmrTableFilterBuilderDraftGroup(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string
): EmrTableFilterBuilderModel {
  return {
    ...model,
    groups: [...model.groups, createEmrTableFilterBuilderGroup(groupId, ruleId)],
  };
}

export function removeEmrTableFilterBuilderRule(
  model: EmrTableFilterBuilderModel,
  groupId: string,
  ruleId: string
): EmrTableFilterBuilderModel {
  const groups = model.groups.flatMap((group) => {
    if (group.id !== groupId) return [group];
    const rules = group.rules.filter((rule) => rule.id !== ruleId);
    return rules.length > 0 ? [{ ...group, rules }] : [];
  });

  return ensureEmrTableFilterBuilderDraft({ ...model, groups });
}

function normalizeFilterValue(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function defaultRuleMatch<TRow>(
  fieldValue: unknown,
  operator: EmrTableFilterBuilderOperator<TRow>,
  ruleValue: string
): boolean {
  const normalizedRuleValue = normalizeFilterValue(ruleValue);

  if (Array.isArray(fieldValue)) {
    return fieldValue.some((item) => defaultRuleMatch(item, operator, ruleValue));
  }

  const normalizedFieldValue = normalizeFilterValue(fieldValue);
  return operator.id === "contains"
    ? normalizedFieldValue.includes(normalizedRuleValue)
    : normalizedFieldValue === normalizedRuleValue;
}

export function doesEmrTableFilterBuilderRuleMatchRow<TRow>(
  rule: EmrTableFilterBuilderRule,
  row: TRow,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  const field = getEmrTableFilterBuilderField(fields, rule.fieldId);
  const operator = getEmrTableFilterBuilderOperator(field, rule.operatorId);

  if (!field || !operator) return true;
  const fieldValue = field.getValue?.(row);

  return operator.match
    ? operator.match(fieldValue, rule.value, row)
    : defaultRuleMatch(fieldValue, operator, rule.value);
}

export function filterRowsByEmrTableFilterBuilder<TRow>(
  rows: TRow[],
  model: EmrTableFilterBuilderModel,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  const activeGroups = model.groups.flatMap((group) => {
    const rules = group.rules.flatMap((rule) => {
      const effectiveRule = getEffectiveRule(rule, fields);
      return effectiveRule ? [effectiveRule] : [];
    });
    return rules.length > 0 ? [{ ...group, rules }] : [];
  });

  if (activeGroups.length === 0) return rows;

  return rows.filter((row) => {
    const groupResults = activeGroups.map((group) => {
      const matches = group.rules.map((rule) =>
        doesEmrTableFilterBuilderRuleMatchRow(rule, row, fields)
      );
      return group.combinator === "or" ? matches.some(Boolean) : matches.every(Boolean);
    });
    return model.combinator === "or"
      ? groupResults.some(Boolean)
      : groupResults.every(Boolean);
  });
}
