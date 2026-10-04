"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CdsActionsSearchIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrPopoverShell } from "@/components/emr/popover-shell";
import { EmrListHeaderIconButton } from "@/components/emr/subpanel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { getHistoryDateRangeError, type HistoryDateRange, type HistorySortDirection } from "@/lib/history-controls";

export function useHistorySearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (composing) return;
    const timer = window.setTimeout(() => setSearchQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [composing, query]);
  const clear = () => { setQuery(""); setSearchQuery(""); setComposing(false); };
  return { open, setOpen, query, setQuery, searchQuery, setComposing, clear };
}

export function EmrHistorySortButton({ direction, onChange, dateLabel }: {
  direction: HistorySortDirection;
  onChange: (direction: HistorySortDirection) => void;
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<EmrListHeaderIconButton ariaLabel={`정렬: ${direction === "newest" ? "최신순" : "오래된순"}`} />}>
        <CdsUtilitiesSortIcon className="size-4" />
      </PopoverTrigger>
      <EmrPopoverShell title="이력 정렬" description={`${dateLabel} 기준`} width="sm" density="compact" onClose={() => setOpen(false)}>
        <RadioGroup aria-label="이력 정렬" value={direction} onValueChange={(value) => {
          onChange(value as HistorySortDirection);
          setOpen(false);
        }}>
          {([['newest', '최신순'], ['oldest', '오래된순']] as const).map(([value, label]) => (
            <Field key={value} orientation="horizontal">
              <Radio id={`${id}-${value}`} value={value} />
              <FieldLabel htmlFor={`${id}-${value}`}>{label}</FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </EmrPopoverShell>
    </Popover>
  );
}

export function EmrHistorySearch({ search, label, placeholder, onClose, onQueryChange }: {
  search: ReturnType<typeof useHistorySearch>;
  label: string;
  placeholder: string;
  onClose: () => void;
  onQueryChange?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1">
      <Input ref={inputRef} type="search" aria-label={label} placeholder={placeholder} value={search.query}
        onChange={(event) => { search.setQuery(event.target.value); onQueryChange?.(); }}
        onCompositionStart={() => search.setComposing(true)}
        onCompositionEnd={() => search.setComposing(false)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.stopPropagation();
          if (search.query) { search.clear(); onQueryChange?.(); } else onClose();
        }} />
      {search.query ? <EmrListHeaderIconButton ariaLabel="검색어 지우기" onClick={() => { search.clear(); onQueryChange?.(); inputRef.current?.focus(); }}>
        <CdsActionsXIcon className="size-4" />
      </EmrListHeaderIconButton> : null}
      <EmrListHeaderIconButton ariaLabel="검색 닫기" onClick={onClose}><CdsActionsSearchIcon className="size-4" /></EmrListHeaderIconButton>
    </div>
  );
}

export function EmrHistoryFilterDialog({ open, title, dateLabel, dates, onDatesChange, onApply, onCancel, onReset, children, requireDates = false }: {
  open: boolean;
  title: string;
  dateLabel: string;
  dates: HistoryDateRange;
  onDatesChange: (dates: HistoryDateRange) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  children?: ReactNode;
  requireDates?: boolean;
}) {
  const id = useId();
  const error = getHistoryDateRangeError(dates, requireDates);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <EmrDialogShell variant="form" title={title} description="조건을 선택하고 적용해 주세요. 기간은 한국 시간 기준이며 시작일과 종료일을 포함합니다."
        primaryAction={<Button disabled={Boolean(error)} onClick={onApply}>적용</Button>}
        secondaryAction={<Button variant="outline" onClick={onCancel}>취소</Button>}
        footerMeta={<Button variant="ghost" onClick={onReset}>조건 초기화</Button>}>
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">{dateLabel}</FieldLegend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field data-invalid={Boolean(error)}><FieldLabel htmlFor={`${id}-start`}>시작일</FieldLabel>
                <Input id={`${id}-start`} type="date" value={dates.start} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => onDatesChange({ ...dates, start: event.target.value })} /></Field>
              <Field data-invalid={Boolean(error)}><FieldLabel htmlFor={`${id}-end`}>종료일</FieldLabel>
                <Input id={`${id}-end`} type="date" value={dates.end} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => onDatesChange({ ...dates, end: event.target.value })} /></Field>
            </div>
            {error ? <p id={`${id}-error`} role="alert" className="emr-text-metadata text-destructive">{error}</p> : null}
          </FieldSet>
          {children}
        </FieldGroup>
      </EmrDialogShell>
    </Dialog>
  );
}
