export type EmrTableFilterBuilderCombinator = "and";

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

export type EmrTableFilterBuilderRule = {
  combinator: EmrTableFilterBuilderCombinator;
  fieldId: string | null;
  id: string;
  operatorId: string | null;
  value: string;
};

export type EmrTableFilterBuilderModel = {
  combinator: EmrTableFilterBuilderCombinator;
  id: string;
  rules: EmrTableFilterBuilderRule[];
};

export const emrTableFilterBuilderDefaultOperators: EmrTableFilterBuilderOperator[] = [
  { id: "is", label: "Is" },
  { id: "contains", label: "포함되어 있음" },
];

export function createEmrTableFilterBuilderRule(
  id: string,
  overrides: Partial<Omit<EmrTableFilterBuilderRule, "id">> = {}
): EmrTableFilterBuilderRule {
  return {
    combinator: "and",
    fieldId: null,
    id,
    operatorId: null,
    value: "",
    ...overrides,
  };
}

export function createInitialEmrTableFilterBuilderModel(
  id: string,
  ruleId = `${id}-rule-1`
): EmrTableFilterBuilderModel {
  return {
    combinator: "and",
    id,
    rules: [createEmrTableFilterBuilderRule(ruleId)],
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
  rule: EmrTableFilterBuilderRule,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  const field = getEmrTableFilterBuilderField(fields, rule.fieldId);
  const operator = getEmrTableFilterBuilderOperator(field, rule.operatorId);

  if (!field || !operator) return false;
  if (operator.valueRequired === false) return true;

  return rule.value.trim().length > 0;
}

export function getActiveEmrTableFilterBuilderRules<TRow>(
  model: EmrTableFilterBuilderModel,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  return model.rules.filter((rule) =>
    isEmrTableFilterBuilderRuleComplete(rule, fields)
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
  if (model.rules.length > 0) return model;

  return {
    ...model,
    combinator: "and",
    rules: [createEmrTableFilterBuilderRule(`${model.id}-rule-1`)],
  };
}

export function updateEmrTableFilterBuilderRuleField<TRow>(
  model: EmrTableFilterBuilderModel,
  ruleId: string,
  fieldId: string | null,
  fields: Array<EmrTableFilterBuilderField<TRow>>
): EmrTableFilterBuilderModel {
  const field = getEmrTableFilterBuilderField(fields, fieldId);
  const firstOperator = field ? getEmrTableFilterBuilderOperators(field)[0] : undefined;

  return {
    ...model,
    rules: model.rules.map((rule) =>
      rule.id === ruleId
        ? {
            ...rule,
            fieldId: field?.id ?? null,
            operatorId: firstOperator?.id ?? null,
            value: "",
          }
        : rule
    ),
  };
}

export function updateEmrTableFilterBuilderRuleOperator(
  model: EmrTableFilterBuilderModel,
  ruleId: string,
  operatorId: string | null
): EmrTableFilterBuilderModel {
  return {
    ...model,
    rules: model.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, operatorId, value: "" } : rule
    ),
  };
}

export function updateEmrTableFilterBuilderRuleValue(
  model: EmrTableFilterBuilderModel,
  ruleId: string,
  value: string
): EmrTableFilterBuilderModel {
  return {
    ...model,
    rules: model.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, value } : rule
    ),
  };
}

export function addEmrTableFilterBuilderDraftRule(
  model: EmrTableFilterBuilderModel,
  ruleId: string
): EmrTableFilterBuilderModel {
  return {
    ...model,
    rules: [
      ...model.rules,
      createEmrTableFilterBuilderRule(ruleId),
    ],
  };
}

export function removeEmrTableFilterBuilderRule(
  model: EmrTableFilterBuilderModel,
  ruleId: string
): EmrTableFilterBuilderModel {
  return ensureEmrTableFilterBuilderDraft({
    ...model,
    rules: model.rules.filter((rule) => rule.id !== ruleId),
  });
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
    return fieldValue.some((item) =>
      defaultRuleMatch(item, operator, ruleValue)
    );
  }

  const normalizedFieldValue = normalizeFilterValue(fieldValue);

  if (operator.id === "contains") {
    return normalizedFieldValue.includes(normalizedRuleValue);
  }

  return normalizedFieldValue === normalizedRuleValue;
}

export function doesEmrTableFilterBuilderRuleMatchRow<TRow>(
  rule: EmrTableFilterBuilderRule,
  row: TRow,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  const field = getEmrTableFilterBuilderField(fields, rule.fieldId);
  const operator = getEmrTableFilterBuilderOperator(field, rule.operatorId);

  if (!field || !operator) return true;
  if (!isEmrTableFilterBuilderRuleComplete(rule, fields)) return true;

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
  const activeRules = getActiveEmrTableFilterBuilderRules(model, fields);

  if (activeRules.length === 0) return rows;

  return rows.filter((row) =>
    activeRules.every((rule) =>
      doesEmrTableFilterBuilderRuleMatchRow(rule, row, fields)
    )
  );
}
