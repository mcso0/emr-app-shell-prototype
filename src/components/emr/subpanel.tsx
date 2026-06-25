"use client";

import { useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import {
  CdsActionsSearchIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { CollapseGnbIcon } from "@/components/gnb-icons";
import { EmrIconButton } from "@/components/emr/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  addMonthsToIsoDate,
  formatKoreanOperatingDateLabel,
  parseIsoDateParts,
} from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";

type EmrSubpanelProps = {
  children: ReactNode;
  className?: string;
};

type EmrSubpanelTitleProps = {
  title: ReactNode;
  className?: string;
  collapseLabel?: string;
  onCollapse?: () => void;
  tabs?: ReactNode;
  tabsClassName?: string;
  titleActions?: ReactNode;
};

type EmrDateNavigatorProps = {
  dateLabel: ReactNode;
  className?: string;
  onDateChange?: (date: string) => void;
  nextLabel?: string;
  onNext?: () => void;
  onOpenDatePicker?: () => void;
  onPrevious?: () => void;
  previousLabel?: string;
  selectedDate?: string;
  todayLabel?: ReactNode;
};

type EmrListHeaderProps = {
  label: ReactNode;
  className?: string;
  count?: ReactNode;
  headerActions?: ReactNode;
  leadingAction?: ReactNode;
  leadingIcon?: ReactNode;
  search?: EmrListHeaderSearchProps;
  topDividerVisible?: boolean;
};

type EmrListHeaderSearchProps = {
  active: boolean;
  query: string;
  resultCount: number;
  closeLabel?: string;
  inputLabel?: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  placeholder?: string;
};

type EmrListGroupProps = {
  children: ReactNode;
  label: ReactNode;
  className?: string;
  collapsed?: boolean;
  count?: ReactNode;
  groupActions?: ReactNode;
  onToggle?: () => void;
};

type EmrListItemProps = {
  title?: ReactNode;
  className?: string;
  footer?: ReactNode;
  itemBadge?: ReactNode;
  meta?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
  surface?: "default" | "transparent";
  subtitle?: ReactNode;
  testId?: string;
  variant?: "default" | "outline";
};

const emrDatePickerWeekdays = ["일", "월", "화", "수", "목", "금", "토"];

function getIsoDateFromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getEmrMonthDatePickerCells(
  visibleMonthDate: string,
  selectedDate: string,
) {
  const parts = parseIsoDateParts(visibleMonthDate);
  const monthStart = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  const firstCellDate = new Date(monthStart);
  firstCellDate.setUTCDate(1 - monthStart.getUTCDay());

  return Array.from({ length: 35 }, (_, index) => {
    const cellDate = new Date(firstCellDate);
    cellDate.setUTCDate(firstCellDate.getUTCDate() + index);
    const key = getIsoDateFromUtcDate(cellDate);

    return {
      key,
      day: String(cellDate.getUTCDate()),
      inMonth: cellDate.getUTCMonth() === parts.month - 1,
      selected: key === selectedDate,
    };
  });
}

export function EmrSubpanel({ children, className }: EmrSubpanelProps) {
  return (
    <div
      className={cn(
        "group/emr-subpanel flex h-full min-h-0 w-full min-w-[296px] max-w-[296px] flex-col bg-[var(--emr-surface-sidepanel)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function EmrSubpanelTitle({
  title,
  className,
  collapseLabel = "사이드 패널 접기",
  onCollapse,
  tabs,
  tabsClassName,
  titleActions,
}: EmrSubpanelTitleProps) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center px-4 py-3", className)}>
      <div className="flex min-w-0 flex-1 items-center">
        <div className="relative flex min-w-0 max-w-full items-center">
          <div className="emr-text-panel-title min-w-0 truncate font-semibold text-foreground">
            {title}
          </div>
          {onCollapse ? (
            <span className="pointer-events-auto absolute left-full z-10 ml-1 flex w-7 shrink-0 opacity-0 group-hover/emr-subpanel:opacity-100">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-[var(--emr-text-tertiary)] hover:text-[var(--emr-text-tertiary)]"
                aria-label={collapseLabel}
                onClick={onCollapse}
              >
                <CollapseGnbIcon aria-hidden="true" />
              </Button>
            </span>
          ) : null}
        </div>
      </div>
      {tabs ? <div className={cn("ml-3 flex shrink-0 items-center", tabsClassName)}>{tabs}</div> : null}
      {titleActions ? <div className="ml-2 flex shrink-0 items-center">{titleActions}</div> : null}
    </div>
  );
}

export function EmrDateNavigator({
  dateLabel,
  className,
  onDateChange,
  nextLabel = "다음 날짜",
  onNext,
  onOpenDatePicker,
  onPrevious,
  previousLabel = "이전 날짜",
  selectedDate,
  todayLabel,
}: EmrDateNavigatorProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonthDate, setPickerMonthDate] = useState(selectedDate ?? "");
  const datePickerEnabled = Boolean(selectedDate && onDateChange);
  const pickerMonthDateParts = parseIsoDateParts(pickerMonthDate || selectedDate || "");
  const datePickerCells = selectedDate
    ? getEmrMonthDatePickerCells(pickerMonthDate || selectedDate, selectedDate)
    : [];

  const openDatePicker = () => {
    onOpenDatePicker?.();
    if (datePickerEnabled) {
      setPickerMonthDate(selectedDate ?? "");
      setDatePickerOpen(true);
    }
  };
  const selectDate = (date: string) => {
    onDateChange?.(date);
    setDatePickerOpen(false);
  };
  const trigger = (
    <button
      type="button"
      className="emr-text-dense-label flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 font-medium tabular-nums text-foreground outline-none transition-[scale,background-color] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
      onClick={openDatePicker}
      disabled={!datePickerEnabled && !onOpenDatePicker}
      aria-label={typeof dateLabel === "string" ? `${dateLabel} 날짜 선택` : "날짜 선택"}
    >
      <CalendarIcon
        className="size-3.5 shrink-0 text-[var(--emr-text-tertiary)]"
        aria-hidden="true"
      />
      <span className="truncate">{dateLabel}</span>
      {todayLabel ? (
        <Badge variant="outline" className="h-[18px] rounded-md bg-[var(--emr-surface-panel)] px-1.5 text-[10px] leading-4">
          {todayLabel}
        </Badge>
      ) : null}
    </button>
  );

  return (
    <div className={cn("flex h-12 shrink-0 items-center justify-between gap-1 px-4", className)}>
      <Button
        variant="outline"
        size="icon"
        className="rounded-[var(--clair-radius-md)] bg-[var(--emr-surface-panel)] transition-transform active:scale-[0.96]"
        aria-label={previousLabel}
        disabled={!onPrevious}
        onClick={onPrevious}
      >
        <ChevronLeftIcon />
      </Button>
      {datePickerEnabled ? (
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger render={trigger} />
          <PopoverContent
            align="center"
            className="w-[244px] gap-3 p-3"
            initialFocus={false}
          >
            <div className="flex items-center justify-between">
              <div className="emr-text-dense font-semibold leading-5 text-foreground">
                {pickerMonthDateParts.year}년 {pickerMonthDateParts.month}월
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="이전 달"
                  onClick={() =>
                    setPickerMonthDate((current) =>
                      addMonthsToIsoDate(current || selectedDate || "", -1),
                    )
                  }
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="다음 달"
                  onClick={() =>
                    setPickerMonthDate((current) =>
                      addMonthsToIsoDate(current || selectedDate || "", 1),
                    )
                  }
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {emrDatePickerWeekdays.map((weekday) => (
                <span
                  key={weekday}
                  className="h-6 emr-text-micro font-medium leading-6 text-muted-foreground"
                >
                  {weekday}
                </span>
              ))}
              {datePickerCells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md emr-text-metadata font-medium tabular-nums outline-none transition-[scale,background-color] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
                    cell.inMonth ? "text-foreground" : "text-muted-foreground",
                    cell.selected &&
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  aria-label={
                    cell.selected
                      ? `${formatKoreanOperatingDateLabel(cell.key)} 선택됨`
                      : `${formatKoreanOperatingDateLabel(cell.key)} 선택`
                  }
                  aria-pressed={cell.selected}
                  onClick={() => selectDate(cell.key)}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        trigger
      )}
      <Button
        variant="outline"
        size="icon"
        className="rounded-[var(--clair-radius-md)] bg-[var(--emr-surface-panel)] transition-transform active:scale-[0.96]"
        aria-label={nextLabel}
        disabled={!onNext}
        onClick={onNext}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

export function EmrListHeader({
  label,
  className,
  count,
  headerActions,
  leadingAction,
  leadingIcon,
  search,
  topDividerVisible = false,
}: EmrListHeaderProps) {
  const searchQuery = search?.query ?? "";
  const searchActive = search?.active ?? false;
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape" || !search) return;

    event.preventDefault();

    if (search.query) {
      search.onQueryChange("");
      return;
    }

    search.onClose();
  };

  return (
    <>
      <div
        className={cn(
          "mx-4 flex h-10 shrink-0 items-center border-y border-[var(--emr-line-hairline)]",
          !topDividerVisible && "border-t-transparent",
          className
        )}
      >
        {searchActive && search ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <CdsActionsSearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--emr-text-tertiary)]"
              />
              <Input
                autoFocus
                aria-label={search.inputLabel ?? "대기열 검색"}
                className="h-8 rounded-[var(--clair-radius-md)] border-[var(--emr-state-selected-border)] bg-card pl-8 pr-2 font-semibold shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                placeholder={search.placeholder ?? "대기열 검색"}
                type="search"
                value={searchQuery}
                onChange={(event) => search.onQueryChange(event.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <EmrListHeaderIconButton ariaLabel={search.closeLabel ?? "검색 닫기"} onClick={search.onClose}>
              <CdsActionsXIcon className="size-4" />
            </EmrListHeaderIconButton>
          </div>
        ) : (
          <>
            <div className="emr-text-section flex min-w-0 flex-1 items-center gap-1.5 font-medium text-[var(--emr-text-secondary)]">
              {leadingAction}
              {leadingIcon ? <span className="flex size-4 shrink-0 items-center justify-center">{leadingIcon}</span> : null}
              {typeof label === "string" ? (
                <span className="truncate">{label}</span>
              ) : (
                <div className="min-w-0">{label}</div>
              )}
              {count !== undefined ? (
                <Badge variant="secondary" className="emr-text-metadata h-5 min-w-5 rounded-[var(--clair-radius-atomic-6)] bg-[var(--emr-surface-muted)] px-1 font-medium text-[var(--emr-text-primary)]">
                  {count}
                </Badge>
              ) : null}
            </div>
            {headerActions ? <div className="flex shrink-0 items-start gap-1.5">{headerActions}</div> : null}
          </>
        )}
      </div>
      {searchActive && searchQuery.trim() ? (
        <div className="emr-text-metadata mx-4 flex min-h-7 shrink-0 items-center border-b border-[var(--emr-line-hairline)] text-[var(--emr-text-tertiary)]">
          검색 결과 {search?.resultCount ?? 0}건
        </div>
      ) : null}
    </>
  );
}

export function EmrListHeaderIconButton({
  ariaLabel,
  children,
  iconSize = "sm",
  ...props
}: {
  ariaLabel: string;
  children?: ReactNode;
  iconSize?: "sm" | "md";
} & Omit<ComponentProps<typeof EmrIconButton>, "aria-label" | "children" | "iconSize">) {
  return (
    <EmrIconButton aria-label={ariaLabel} iconSize={iconSize} {...props}>
      {children}
    </EmrIconButton>
  );
}

export function EmrListSearchEmptyState({
  objectLabel = "대기열 항목",
  onClear,
  query,
}: {
  objectLabel?: string;
  onClear: () => void;
  query: string;
}) {
  return (
    <div className="mx-1 mt-3 rounded-[var(--clair-radius-md)] border border-dashed border-[var(--emr-line-strong)] bg-[var(--emr-surface-panel)] px-3 py-4 text-center">
      <div className="emr-text-section font-semibold text-[var(--emr-text-secondary)]">
        검색 결과가 없어
      </div>
      <p className="emr-text-metadata mt-1 text-[var(--emr-text-tertiary)]">
        {`'${query.trim()}'에 맞는 ${objectLabel}이 없어.`}
      </p>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="mt-3 bg-card"
        onClick={onClear}
      >
        검색어 지우기
      </Button>
    </div>
  );
}

export function EmrListGroup({
  children,
  label,
  className,
  collapsed = false,
  count,
  groupActions,
  onToggle,
}: EmrListGroupProps) {
  const titleContent = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="h-[18px] w-[3px] shrink-0 rounded-[var(--clair-border-width-atomic-1)] bg-[var(--emr-state-selected-border)]" />
        <div className="emr-text-section flex min-w-0 items-center gap-1.5 font-medium">
          <span className="truncate text-[var(--emr-text-secondary)]">{label}</span>
          {count !== undefined ? (
            <span className="shrink-0 text-[var(--emr-text-tertiary)]">{count}</span>
          ) : null}
        </div>
      </div>
      {groupActions ? (
        <div className="flex shrink-0 items-center gap-1">{groupActions}</div>
      ) : (
        <span className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm p-1">
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--clair-motion-duration-normal)] ease-[var(--clair-motion-easing-standard)]",
              collapsed && "rotate-180"
            )}
            aria-hidden="true"
          />
        </span>
      )}
    </>
  );

  return (
    <section className={cn("emr-density-stack-sm flex flex-col rounded-[var(--clair-radius-atomic-10)]", className)}>
      {onToggle ? (
        <button
          type="button"
          className="emr-density-list-compact flex h-8 w-full items-center gap-3 rounded-md text-left outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {titleContent}
        </button>
      ) : (
        <div className="emr-density-list-compact flex h-8 items-center gap-3 rounded-md">{titleContent}</div>
      )}
      {collapsed ? null : <div className="emr-density-stack-sm flex flex-col">{children}</div>}
    </section>
  );
}

export function EmrListItem({
  title,
  className,
  footer,
  itemBadge,
  meta,
  onSelect,
  selected = false,
  surface = "default",
  subtitle,
  testId,
  variant = "default",
}: EmrListItemProps) {
  const usesTransparentSurface = surface === "transparent";
  const content = (
    <>
      <div className="flex min-h-6 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="emr-text-dense truncate font-semibold text-[var(--emr-text-secondary)]">
              {title}
            </div>
          ) : null}
          {subtitle ? (
            <div className="emr-text-metadata truncate font-medium text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        {itemBadge ? <div className="shrink-0">{itemBadge}</div> : null}
      </div>
      {meta ? <div className="emr-text-status mt-1 min-w-0 truncate text-muted-foreground">{meta}</div> : null}
      {footer ? (
        <div className="emr-text-micro mt-2 flex min-h-5 items-center justify-between gap-2 border-t border-[var(--emr-line-hairline)] pt-1.5 text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </>
  );
  const itemClassName = cn(
    "group/emr-list-item w-full border text-left transition-colors",
    variant === "outline"
      ? "emr-density-card rounded-[var(--clair-radius-atomic-8)]"
      : "emr-density-list-compact rounded-[var(--clair-radius-sm)]",
    selected
      ? variant === "outline"
        ? "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
        : usesTransparentSurface
          ? "border-transparent bg-transparent hover:bg-[var(--emr-state-hover)]"
          : "border-transparent bg-[var(--emr-state-selected)]"
      : variant === "outline"
        ? "border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-state-hover)]"
        : usesTransparentSurface
          ? "border-transparent bg-transparent hover:bg-[var(--emr-state-hover)]"
          : "border-transparent bg-transparent hover:border-[var(--emr-line-hairline)] hover:bg-[var(--emr-state-hover)]",
    className
  );

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(itemClassName, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
        data-selected={selected ? "true" : undefined}
        data-testid={testId}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        {content}
      </div>
    );
  }

  return <div className={itemClassName} data-testid={testId}>{content}</div>;
}

export function EmrSubpanelBody({ children, className }: EmrSubpanelProps) {
  return (
    <ScrollArea className={cn("min-h-0 flex-1", className)}>
      <div className="emr-density-panel-inset emr-density-stack-md flex flex-col">{children}</div>
    </ScrollArea>
  );
}
