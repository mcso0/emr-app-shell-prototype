"use client";

import * as React from "react";

import {
  CdsActionsPlusIcon,
  CdsActionsRefreshCcwIcon,
  CdsActionsSearchIcon,
  CdsActionsTrashIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import { EmrIconButton } from "@/components/emr/icon-button";
import { InfoIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addEmrTableFilterBuilderDraftGroup,
  addEmrTableFilterBuilderDraftRule,
  commitEmrTableFilterBuilderRule,
  createInitialEmrTableFilterBuilderModel,
  ensureEmrTableFilterBuilderDraft,
  getEmrTableFilterBuilderActiveCount,
  getEmrTableFilterBuilderField,
  getEmrTableFilterBuilderOperator,
  getEmrTableFilterBuilderOperators,
  removeEmrTableFilterBuilderRule,
  updateEmrTableFilterBuilderCombinator,
  updateEmrTableFilterBuilderGroupCombinator,
  updateEmrTableFilterBuilderRuleField,
  updateEmrTableFilterBuilderRuleDraftValue,
  updateEmrTableFilterBuilderRuleOperator,
  updateEmrTableFilterBuilderRuleValue,
  type EmrTableFilterBuilderCombinator,
  type EmrTableFilterBuilderField,
  type EmrTableFilterBuilderGroup,
  type EmrTableFilterBuilderModel,
  type EmrTableFilterBuilderRule,
} from "@/components/emr/table-filter-builder-model";

const unsetFieldValue = "__emr_filter_unset_field__";
const unsetOperatorValue = "__emr_filter_unset_operator__";
const unsetSelectValue = "__emr_filter_unset_value__";
const maxGroupCount = 3;
const maxRuleCount = 5;

type EmrTableFilterBuilderProps<TRow = unknown> = {
  addFilterLabel?: string;
  addGroupFilterLabel?: string;
  clearAllLabel?: string;
  className?: string;
  closeLabel?: string;
  description?: string;
  autoOpenFirstField?: boolean;
  fields: Array<EmrTableFilterBuilderField<TRow>>;
  model: EmrTableFilterBuilderModel;
  onClose?: () => void;
  onModelChange: (model: EmrTableFilterBuilderModel) => void;
  title?: string;
};

function getRuleFieldLabel<TRow>(
  rule: EmrTableFilterBuilderRule,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  return getEmrTableFilterBuilderField(fields, rule.fieldId)?.label ?? "필터 선택";
}

function getRuleOperatorLabel<TRow>(
  rule: EmrTableFilterBuilderRule,
  fields: Array<EmrTableFilterBuilderField<TRow>>
) {
  const field = getEmrTableFilterBuilderField(fields, rule.fieldId);
  return getEmrTableFilterBuilderOperator(field, rule.operatorId)?.label ?? "조건 선택";
}

function getRuleValueLabel<TRow>(
  rule: EmrTableFilterBuilderRule,
  field?: EmrTableFilterBuilderField<TRow>
) {
  if (!rule.value) return field?.valuePlaceholder ?? "값 선택";
  return field?.options?.find((option) => option.value === rule.value)?.label ?? rule.value;
}

function CombinatorSelect({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: EmrTableFilterBuilderCombinator) => void;
  value: EmrTableFilterBuilderCombinator;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as EmrTableFilterBuilderCombinator)}>
      <SelectTrigger aria-label={ariaLabel} size="sm" className="w-full bg-card uppercase">
        {value.toUpperCase()}
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="min-w-24">
        <SelectGroup>
          <SelectItem value="and">AND</SelectItem>
          <SelectItem value="or">OR</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ConditionRow<TRow>({
  autoOpenField,
  disableRemove,
  fields,
  group,
  groupIndex,
  model,
  onModelChange,
  onRemove,
  rule,
  ruleIndex,
}: {
  autoOpenField: boolean;
  disableRemove: boolean;
  fields: Array<EmrTableFilterBuilderField<TRow>>;
  group: EmrTableFilterBuilderGroup;
  groupIndex: number;
  model: EmrTableFilterBuilderModel;
  onModelChange: (model: EmrTableFilterBuilderModel) => void;
  onRemove: () => void;
  rule: EmrTableFilterBuilderRule;
  ruleIndex: number;
}) {
  const field = getEmrTableFilterBuilderField(fields, rule.fieldId);
  const operators = getEmrTableFilterBuilderOperators(field);
  const operator = getEmrTableFilterBuilderOperator(field, rule.operatorId);
  const valueKind = field?.valueKind ?? "select";
  const multipleRules = group.rules.length > 1;
  const ruleLabel = `그룹 ${groupIndex + 1} 조건 ${ruleIndex + 1}`;
  const modelRef = React.useRef(model);
  const textCommitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    modelRef.current = model;
  }, [model]);
  React.useEffect(
    () => () => {
      if (textCommitTimerRef.current) clearTimeout(textCommitTimerRef.current);
    },
    []
  );

  const commitTextValue = () => {
    if (textCommitTimerRef.current) clearTimeout(textCommitTimerRef.current);
    textCommitTimerRef.current = null;
    onModelChange(
      commitEmrTableFilterBuilderRule(modelRef.current, group.id, rule.id, fields)
    );
  };

  return (
    <div
      className={cn(
        "grid min-w-0 items-center gap-2 max-sm:grid-cols-[minmax(0,1fr)_32px]",
        multipleRules
          ? "sm:grid-cols-[79px_minmax(0,2fr)_minmax(72px,1fr)_minmax(0,2fr)_32px]"
          : "sm:grid-cols-[minmax(0,2fr)_minmax(72px,1fr)_minmax(0,2fr)_32px]"
      )}
      data-filter-condition-row
    >
      {multipleRules ? (
        <div className="max-sm:col-span-2">
          {ruleIndex > 0 ? (
            <CombinatorSelect
              ariaLabel={`${ruleLabel} 조합 방식`}
              value={group.combinator}
              onChange={(combinator) =>
                onModelChange(updateEmrTableFilterBuilderGroupCombinator(model, group.id, combinator))
              }
            />
          ) : (
            <span aria-hidden="true" className="hidden h-8 sm:block" />
          )}
        </div>
      ) : null}

      <Select
        key={autoOpenField ? "auto-open-field" : "field"}
        defaultOpen={autoOpenField}
        value={rule.fieldId ?? unsetFieldValue}
        onValueChange={(value) =>
          onModelChange(
            updateEmrTableFilterBuilderRuleField(
              model,
              group.id,
              rule.id,
              value === unsetFieldValue ? null : value,
              fields
            )
          )
        }
      >
        <SelectTrigger
          aria-label={`${ruleLabel} 필터 필드`}
          size="sm"
          className={cn(
            "w-full bg-card max-sm:col-start-1 max-sm:row-start-2",
            !rule.fieldId && "text-[var(--emr-text-placeholder)]"
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{getRuleFieldLabel(rule, fields)}</span>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="z-[90] min-w-52"
        >
          <SelectGroup>
            <SelectItem value={unsetFieldValue}>필터 선택</SelectItem>
            {fields.map((item) => (
              <SelectItem key={item.id} value={item.id} disabled={item.disabled}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {field ? (
        <Select
          value={rule.operatorId ?? unsetOperatorValue}
          onValueChange={(value) =>
            onModelChange(
              updateEmrTableFilterBuilderRuleOperator(
                model,
                group.id,
                rule.id,
                value === unsetOperatorValue ? null : value,
                fields
              )
            )
          }
        >
          <SelectTrigger
            aria-label={`${ruleLabel} 필터 조건`}
            size="sm"
            className="w-full bg-card max-sm:col-span-2 max-sm:row-start-3"
          >
            <span className="min-w-0 flex-1 truncate text-left">{getRuleOperatorLabel(rule, fields)}</span>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false} className="min-w-36">
            <SelectGroup>
              <SelectItem value={unsetOperatorValue}>조건 선택</SelectItem>
              {operators.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : <span aria-hidden="true" />}

      {field && operator?.valueRequired !== false ? (
        valueKind === "text" ? (
          <div className="flex h-[var(--clair-control-height-sm)] min-w-0 items-center rounded-[var(--emr-radius-control)] border border-input bg-card px-2 max-sm:col-span-2 max-sm:row-start-4">
            <CdsActionsSearchIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              aria-label={`${ruleLabel} 필터 값`}
              className="h-7 border-0 bg-transparent px-2 emr-control-text-compact shadow-none focus-visible:ring-0"
              placeholder={field.valuePlaceholder ?? "값을 입력"}
              value={rule.value}
              onBlur={commitTextValue}
              onChange={(event) => {
                const nextModel = updateEmrTableFilterBuilderRuleDraftValue(
                  model,
                  group.id,
                  rule.id,
                  event.target.value
                );
                modelRef.current = nextModel;
                onModelChange(nextModel);
                if (textCommitTimerRef.current) clearTimeout(textCommitTimerRef.current);
                textCommitTimerRef.current = setTimeout(commitTextValue, 250);
              }}
            />
          </div>
        ) : (
          <Select
            value={rule.value || unsetSelectValue}
            onValueChange={(value) => {
              const nextValue = value ?? unsetSelectValue;
              onModelChange(
                updateEmrTableFilterBuilderRuleValue(
                  model,
                  group.id,
                  rule.id,
                  nextValue === unsetSelectValue ? "" : nextValue,
                  fields
                )
              );
            }}
          >
            <SelectTrigger
              aria-label={`${ruleLabel} 필터 값`}
              size="sm"
              className={cn(
                "w-full bg-card max-sm:col-span-2 max-sm:row-start-4",
                !rule.value && "text-[var(--emr-text-placeholder)]"
              )}
            >
              <span className="min-w-0 flex-1 truncate text-left">{getRuleValueLabel(rule, field)}</span>
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className="min-w-52">
              <SelectGroup>
                <SelectItem value={unsetSelectValue}>{field.valuePlaceholder ?? "값 선택"}</SelectItem>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )
      ) : <span aria-hidden="true" />}

      <EmrIconButton
        type="button"
        aria-label={`${ruleLabel} 삭제`}
        className="justify-self-end hover:text-[var(--emr-text-danger)] max-sm:col-start-2 max-sm:row-start-2"
        data-filter-rule-delete
        disabled={disableRemove}
        onClick={onRemove}
      >
        <CdsActionsTrashIcon aria-hidden="true" />
      </EmrIconButton>
    </div>
  );
}

export function EmrTableFilterBuilder<TRow = unknown>({
  addFilterLabel = "필터 추가",
  addGroupFilterLabel = "그룹 필터",
  autoOpenFirstField = false,
  clearAllLabel = "초기화",
  className,
  closeLabel = "필터 닫기",
  description = "완성된 조건만 자동 적용되며, 그룹 안과 그룹 사이는 선택한 AND/OR로 계산됩니다.",
  fields,
  model,
  onClose,
  onModelChange,
  title = "필터",
}: EmrTableFilterBuilderProps<TRow>) {
  const nextGroupId = React.useRef(model.groups.length + 1);
  const nextRuleId = React.useRef(
    model.groups.reduce((count, group) => count + group.rules.length, 0) + 1
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [descriptionOpen, setDescriptionOpen] = React.useState(false);
  const normalizedModel = ensureEmrTableFilterBuilderDraft(model);
  const activeCount = getEmrTableFilterBuilderActiveCount(normalizedModel, fields);
  const multipleGroups = normalizedModel.groups.length > 1;
  const firstRule = normalizedModel.groups[0]?.rules[0];
  const isPristine =
    normalizedModel.groups.length === 1 &&
    normalizedModel.groups[0]?.rules.length === 1 &&
    firstRule?.fieldId === null &&
    firstRule?.operatorId === null &&
    firstRule?.value === "" &&
    firstRule?.applied === null;

  const createGroupId = () => `${model.id}-group-${++nextGroupId.current}`;
  const createRuleId = () => `${model.id}-rule-${++nextRuleId.current}`;

  const removeRule = (groupId: string, ruleId: string, flatIndex: number) => {
    onModelChange(removeEmrTableFilterBuilderRule(normalizedModel, groupId, ruleId));
    requestAnimationFrame(() => {
      const candidates = rootRef.current?.querySelectorAll<HTMLElement>(
        "[data-filter-rule-delete], [data-filter-add-rule], [data-filter-add-group]"
      );
      candidates?.[Math.min(flatIndex, Math.max(0, candidates.length - 1))]?.focus();
    });
  };

  return (
    <div
      ref={rootRef}
      className={cn("grid rounded-xl bg-popover text-popover-foreground", className)}
      data-active-filter-count={activeCount}
      data-filter-auto-open-ready={autoOpenFirstField ? "true" : "false"}
      data-emr-table-filter-builder="true"
    >
      <header className="flex min-h-10 items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="emr-text-panel-title font-semibold">{title}</h2>
          <span className="relative inline-flex">
            <span
              tabIndex={0}
              className="inline-grid size-4 place-items-center text-[var(--emr-text-tertiary)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-describedby={descriptionOpen ? "emr-table-filter-description" : undefined}
              aria-label="필터 적용 방식 안내"
              onBlur={() => setDescriptionOpen(false)}
              onFocus={() => setDescriptionOpen(true)}
              onMouseEnter={() => setDescriptionOpen(true)}
              onMouseLeave={() => setDescriptionOpen(false)}
            >
              <InfoIcon aria-hidden="true" className="size-4" />
            </span>
            {descriptionOpen ? (
              <span
                id="emr-table-filter-description"
                role="tooltip"
                className="absolute left-0 top-full z-[90] mt-1 w-80 max-w-[calc(100vw-48px)] rounded-md bg-foreground px-3 py-1.5 text-xs leading-5 text-background shadow-md"
              >
                {description}
              </span>
            ) : null}
          </span>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={closeLabel} className="-mr-1 -mt-1 text-[var(--emr-text-tertiary)]" onClick={onClose}>
            <CdsActionsXIcon aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </header>

      <div className="mt-4 grid max-h-[min(520px,calc(100vh-220px))] gap-2 overflow-y-auto px-4 pb-4">
        {normalizedModel.groups.map((group, groupIndex) => (
          <div
            key={group.id}
            className={cn(
              "grid min-w-0 items-start gap-2 sm:gap-4",
              multipleGroups && "sm:grid-cols-[101px_minmax(0,1fr)]"
            )}
            data-filter-group
          >
            {multipleGroups ? (
              <div className="pt-2">
                {groupIndex > 0 ? (
                  <CombinatorSelect
                    ariaLabel={`그룹 ${groupIndex + 1}와 이전 그룹 조합 방식`}
                    value={normalizedModel.combinator}
                    onChange={(combinator) =>
                      onModelChange(updateEmrTableFilterBuilderCombinator(normalizedModel, combinator))
                    }
                  />
                ) : <span aria-hidden="true" className="hidden h-8 sm:block" />}
              </div>
            ) : null}

            <section className="grid min-w-0 gap-2.5 rounded-lg bg-[var(--emr-surface-muted)] p-2" aria-label={`필터 그룹 ${groupIndex + 1}`}>
              {group.rules.map((rule, ruleIndex) => {
                const currentFlatIndex =
                  normalizedModel.groups
                    .slice(0, groupIndex)
                    .reduce((count, item) => count + item.rules.length, 0) + ruleIndex;
                return (
                  <ConditionRow
                    key={rule.id}
                    autoOpenField={
                      autoOpenFirstField && isPristine && groupIndex === 0 && ruleIndex === 0
                    }
                    disableRemove={isPristine && groupIndex === 0 && ruleIndex === 0}
                    fields={fields}
                    group={group}
                    groupIndex={groupIndex}
                    model={normalizedModel}
                    onModelChange={onModelChange}
                    onRemove={() => removeRule(group.id, rule.id, currentFlatIndex)}
                    rule={rule}
                    ruleIndex={ruleIndex}
                  />
                );
              })}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-self-start text-[var(--emr-text-tertiary)]",
                  group.rules.length > 1 && "sm:ml-[87px]"
                )}
                disabled={group.rules.length >= maxRuleCount}
                aria-label={group.rules.length >= maxRuleCount ? `그룹 ${groupIndex + 1}은 조건을 최대 ${maxRuleCount}개까지 추가할 수 있습니다` : undefined}
                data-filter-add-rule
                onClick={() =>
                  onModelChange(addEmrTableFilterBuilderDraftRule(normalizedModel, group.id, createRuleId()))
                }
              >
                <CdsActionsPlusIcon data-icon="inline-start" />
                {addGroupFilterLabel}
              </Button>
            </section>
          </div>
        ))}
      </div>

      <footer className="flex min-h-16 items-center justify-between gap-2 border-t border-border px-4 py-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-card !px-2"
          disabled={normalizedModel.groups.length >= maxGroupCount}
          aria-label={normalizedModel.groups.length >= maxGroupCount ? `필터 그룹은 최대 ${maxGroupCount}개까지 추가할 수 있습니다` : undefined}
          data-filter-add-group
          onClick={() => {
            const groupId = createGroupId();
            onModelChange(addEmrTableFilterBuilderDraftGroup(normalizedModel, groupId, createRuleId()));
          }}
        >
          <CdsActionsPlusIcon data-icon="inline-start" />
          {addFilterLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] !px-2 text-[var(--emr-status-danger-text)] hover:bg-[var(--emr-status-danger-hover-bg)]"
          disabled={isPristine}
          onClick={() => onModelChange(createInitialEmrTableFilterBuilderModel(model.id))}
        >
          <CdsActionsRefreshCcwIcon data-icon="inline-start" />
          {clearAllLabel}
        </Button>
      </footer>
    </div>
  );
}

export type {
  EmrTableFilterBuilderField,
  EmrTableFilterBuilderModel,
  EmrTableFilterBuilderProps,
};
