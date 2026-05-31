"use client";

import * as React from "react";

import {
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
  CdsActionsTrashIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
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
  addEmrTableFilterBuilderDraftRule,
  createInitialEmrTableFilterBuilderModel,
  ensureEmrTableFilterBuilderDraft,
  getEmrTableFilterBuilderActiveCount,
  getEmrTableFilterBuilderField,
  getEmrTableFilterBuilderOperator,
  getEmrTableFilterBuilderOperators,
  removeEmrTableFilterBuilderRule,
  updateEmrTableFilterBuilderRuleField,
  updateEmrTableFilterBuilderRuleOperator,
  updateEmrTableFilterBuilderRuleValue,
  type EmrTableFilterBuilderField,
  type EmrTableFilterBuilderModel,
  type EmrTableFilterBuilderRule,
} from "@/components/emr/table-filter-builder-model";

const unsetFieldValue = "__emr_filter_unset_field__";
const unsetOperatorValue = "__emr_filter_unset_operator__";
const unsetSelectValue = "__emr_filter_unset_value__";

type EmrTableFilterBuilderProps<TRow = unknown> = {
  addFilterLabel?: string;
  clearAllLabel?: string;
  className?: string;
  closeLabel?: string;
  description?: string;
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

export function EmrTableFilterBuilder<TRow = unknown>({
  addFilterLabel = "Add filter",
  clearAllLabel = "Clear all",
  className,
  closeLabel = "필터 닫기",
  description = "완성된 조건만 active filter로 계산됩니다.",
  fields,
  model,
  onClose,
  onModelChange,
  title = "Filters",
}: EmrTableFilterBuilderProps<TRow>) {
  const nextRuleId = React.useRef(model.rules.length + 1);
  const normalizedModel = ensureEmrTableFilterBuilderDraft(model);
  const activeCount = getEmrTableFilterBuilderActiveCount(normalizedModel, fields);

  const createRuleId = React.useCallback(() => {
    nextRuleId.current += 1;
    return `${model.id}-rule-${nextRuleId.current}`;
  }, [model.id]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.();
    }
  };

  return (
    <div
      className={cn("grid gap-4 rounded-lg bg-popover text-popover-foreground", className)}
      data-active-filter-count={activeCount}
      data-emr-table-filter-builder="true"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="emr-text-panel-title font-semibold">{title}</h2>
            <InfoIcon aria-hidden="true" className="size-4 text-[var(--emr-text-tertiary)]" />
          </div>
          {description ? (
            <p className="mt-0.5 emr-text-metadata text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={closeLabel}
            className="-mr-1 -mt-1 text-[var(--emr-text-tertiary)]"
            onClick={onClose}
          >
            <CdsActionsXIcon aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3">
        {normalizedModel.rules.map((rule, index) => {
          const field = getEmrTableFilterBuilderField(fields, rule.fieldId);
          const operators = getEmrTableFilterBuilderOperators(field);
          const fieldValue = rule.fieldId ?? unsetFieldValue;
          const operatorValue = rule.operatorId ?? unsetOperatorValue;
          const valueKind = field?.valueKind ?? "select";

          return (
            <div
              key={rule.id}
              className="grid items-center gap-2 rounded-lg bg-[var(--emr-surface-muted)] p-2 sm:grid-cols-[96px_minmax(152px,1fr)_minmax(124px,0.75fr)_minmax(180px,1.4fr)_32px]"
            >
              <div className="emr-text-dense-label text-[var(--emr-text-tertiary)]">
                {index === 0 ? (
                  "Where"
                ) : (
                  <span className="inline-flex h-8 min-w-20 items-center rounded-[var(--emr-radius-control)] border border-input bg-card px-2.5 text-[var(--emr-text-secondary)]">
                    AND
                  </span>
                )}
              </div>

              <Select
                value={fieldValue}
                onValueChange={(value) =>
                  onModelChange(
                    updateEmrTableFilterBuilderRuleField(
                      normalizedModel,
                      rule.id,
                      value === unsetFieldValue ? null : value,
                      fields
                    )
                  )
                }
              >
                <SelectTrigger
                  aria-label="필터 필드"
                  size="sm"
                  className={cn(
                    "w-full bg-card",
                    !rule.fieldId && "text-[var(--emr-text-placeholder)]"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {getRuleFieldLabel(rule, fields)}
                  </span>
                </SelectTrigger>
                <SelectContent align="start" className="min-w-44">
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

              <Select
                value={operatorValue}
                onValueChange={(value) =>
                  onModelChange(
                    updateEmrTableFilterBuilderRuleOperator(
                      normalizedModel,
                      rule.id,
                      value === unsetOperatorValue ? null : value
                    )
                  )
                }
              >
                <SelectTrigger
                  aria-label="필터 조건"
                  size="sm"
                  className={cn(
                    "w-full bg-card",
                    !rule.operatorId && "text-[var(--emr-text-placeholder)]"
                  )}
                  disabled={!field}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {getRuleOperatorLabel(rule, fields)}
                  </span>
                </SelectTrigger>
                <SelectContent align="start" className="min-w-36">
                  <SelectGroup>
                    <SelectItem value={unsetOperatorValue}>조건 선택</SelectItem>
                    {operators.map((operator) => (
                      <SelectItem key={operator.id} value={operator.id}>
                        {operator.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {valueKind === "text" ? (
                <div className="flex h-[var(--clair-control-height-sm)] min-w-0 items-center rounded-[var(--emr-radius-control)] border border-input bg-card px-2">
                  <CdsActionsSearchIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <Input
                    aria-label="필터 값"
                    className="h-7 border-0 bg-transparent px-2 emr-control-text-compact shadow-none focus-visible:ring-0"
                    disabled={!field || !rule.operatorId}
                    placeholder={field?.valuePlaceholder ?? "값을 입력"}
                    value={rule.value}
                    onChange={(event) =>
                      onModelChange(
                        updateEmrTableFilterBuilderRuleValue(
                          normalizedModel,
                          rule.id,
                          event.target.value
                        )
                      )
                    }
                  />
                </div>
              ) : (
                <Select
                  value={rule.value || unsetSelectValue}
                  onValueChange={(value) => {
                    const nextValue = value ?? unsetSelectValue;

                    onModelChange(
                      updateEmrTableFilterBuilderRuleValue(
                        normalizedModel,
                        rule.id,
                        nextValue === unsetSelectValue ? "" : nextValue
                      )
                    );
                  }}
                >
                  <SelectTrigger
                    aria-label="필터 값"
                    size="sm"
                    className={cn(
                      "w-full bg-card",
                      !rule.value && "text-[var(--emr-text-placeholder)]"
                    )}
                    disabled={!field || !rule.operatorId}
                  >
                    <CdsActionsSearchIcon
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {getRuleValueLabel(rule, field)}
                    </span>
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-52">
                    <SelectGroup>
                      <SelectItem value={unsetSelectValue}>
                        {field?.valuePlaceholder ?? "값 선택"}
                      </SelectItem>
                      {(field?.options ?? []).map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="필터 조건 삭제"
                className="justify-self-end text-[var(--emr-text-tertiary)] hover:text-[var(--emr-text-danger)]"
                onClick={() =>
                  onModelChange(removeEmrTableFilterBuilderRule(normalizedModel, rule.id))
                }
              >
                <CdsActionsTrashIcon aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-card"
          onClick={() =>
            onModelChange(
              addEmrTableFilterBuilderDraftRule(normalizedModel, createRuleId())
            )
          }
        >
          <CdsActionsPlusIcon data-icon="inline-start" />
          {addFilterLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[var(--emr-status-danger-border)] bg-card text-[var(--emr-status-danger-text)] hover:bg-[var(--emr-status-danger-bg)]"
          onClick={() =>
            onModelChange(createInitialEmrTableFilterBuilderModel(model.id))
          }
        >
          {clearAllLabel}
        </Button>
      </div>
    </div>
  );
}

export type {
  EmrTableFilterBuilderField,
  EmrTableFilterBuilderModel,
  EmrTableFilterBuilderProps,
};
