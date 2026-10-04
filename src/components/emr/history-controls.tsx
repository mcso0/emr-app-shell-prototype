"use client";

import { useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { CircleCloseFillIcon } from "@/components/icons";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrPopoverShell } from "@/components/emr/popover-shell";
import { EmrListHeaderIconButton } from "@/components/emr/subpanel";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { getHistoryDateRangeError, type HistoryDateRange, type HistorySortDirection } from "@/lib/history-controls";

export function useHistorySearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!open || composing) return;
    timerRef.current = window.setTimeout(() => setSearchQuery(query), 250);
    return () => window.clearTimeout(timerRef.current);
  }, [composing, open, query]);
  const clear = () => {
    window.clearTimeout(timerRef.current);
    setQuery(""); setSearchQuery(""); setComposing(false);
  };
  return { open, setOpen, query, setQuery, searchQuery, setComposing, clear };
}

export function EmrHistorySortButton({ direction, onChange, dateLabel }: {
  direction: HistorySortDirection;
  onChange: (direction: HistorySortDirection) => void;
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<EmrListHeaderIconButton ariaLabel={`정렬: ${direction === "newest" ? "최신순" : "오래된순"}`} />}>
        <CdsUtilitiesSortIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="sr-only">{dateLabel} 정렬</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={direction} onValueChange={(value) => {
            onChange(value as HistorySortDirection);
            setOpen(false);
          }}>
            {([['newest', '최신순'], ['oldest', '오래된순']] as const).map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="relative min-w-0 shrink-0">
      <Input ref={inputRef} type="search" className="pr-8 [&::-webkit-search-cancel-button]:hidden" aria-label={label} placeholder={placeholder} value={search.query}
        onChange={(event) => { search.setQuery(event.target.value); onQueryChange?.(); }}
        onCompositionStart={() => search.setComposing(true)}
        onCompositionEnd={() => search.setComposing(false)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }} />
      <EmrListHeaderIconButton ariaLabel="검색 취소" iconSize="md" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={onClose}>
        <CircleCloseFillIcon className="size-4" aria-hidden="true" />
      </EmrListHeaderIconButton>
    </div>
  );
}

export function EmrHistoryFilterPopover({ open, trigger, title, dateLabel, dates, onDatesChange, onOpen, onApply, onCancel, onReset, children, requireDates = false }: {
  open: boolean;
  trigger: ReactElement;
  title: string;
  dateLabel: string;
  dates: HistoryDateRange;
  onDatesChange: (dates: HistoryDateRange) => void;
  onOpen: () => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  children?: ReactNode;
  requireDates?: boolean;
}) {
  const id = useId();
  const error = getHistoryDateRangeError(dates, requireDates);
  return (
    <Popover open={open} modal={false} onOpenChange={(next) => { if (next) onOpen(); else onCancel(); }}>
      <PopoverTrigger render={trigger} />
      <EmrPopoverShell align="end" width="md" density="compact" bodyScroll bodyClassName="min-h-0 pt-3" className="max-h-(--available-height) max-w-[calc(100vw-2rem)]"
        footer={<>
          <Button size="sm" variant="ghost" onClick={onReset}>초기화</Button>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={onCancel}>취소</Button>
            <Button size="sm" disabled={Boolean(error)} onClick={onApply}>적용</Button>
          </div>
        </>}>
        <PopoverTitle className="sr-only">{title}</PopoverTitle>
        <FieldGroup className="gap-3!">
          <FieldSet className="gap-2!">
            <FieldLegend variant="label">{dateLabel}</FieldLegend>
            <div className="grid grid-cols-2 gap-2">
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
      </EmrPopoverShell>
    </Popover>
  );
}
