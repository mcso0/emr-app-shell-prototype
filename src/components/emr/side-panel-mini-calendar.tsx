"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CdsNavigationChevronDownIcon,
  CdsNavigationChevronUpIcon,
  CdsNavigationReturnIcon,
} from "@/components/cds-icons/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  addMonthsToIsoDate,
  formatKoreanOperatingDateLabel,
  getIsoDateFromUtcDate,
  parseIsoDateParts,
} from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";

type EmrSidePanelMiniCalendarProps = {
  selectedDate: string;
  todayDate: string;
  onDateSelect: (date: string) => void;
  onReturnToPreviousDate?: () => void;
  className?: string;
  previousDate?: string;
  rangeEndDate?: string;
  rangeStartDate?: string;
};

type MiniCalendarCell = {
  date: string;
  day: string;
  inMonth: boolean;
};

const sidePanelMiniCalendarWeekdays = ["일", "월", "화", "수", "목", "금", "토"];

function getMiniCalendarCells(visibleMonthDate: string): MiniCalendarCell[] {
  const parts = parseIsoDateParts(visibleMonthDate);
  const monthStart = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  const firstCellDate = new Date(monthStart);
  firstCellDate.setUTCDate(1 - monthStart.getUTCDay());

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(firstCellDate);
    cellDate.setUTCDate(firstCellDate.getUTCDate() + index);
    const date = getIsoDateFromUtcDate(cellDate);

    return {
      date,
      day: String(cellDate.getUTCDate()),
      inMonth: cellDate.getUTCMonth() === parts.month - 1,
    };
  });
}

function isDateInRange(date: string, startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return false;
  return date >= startDate && date <= endDate;
}

export function EmrSidePanelMiniCalendar({
  className,
  onDateSelect,
  onReturnToPreviousDate,
  previousDate,
  rangeEndDate,
  rangeStartDate,
  selectedDate,
  todayDate,
}: EmrSidePanelMiniCalendarProps) {
  const [visibleMonthState, setVisibleMonthState] = useState({
    selectedDate,
    visibleMonthDate: selectedDate,
  });
  const visibleMonthDate =
    visibleMonthState.selectedDate === selectedDate
      ? visibleMonthState.visibleMonthDate
      : selectedDate;
  const visibleMonthParts = parseIsoDateParts(visibleMonthDate);
  const cells = useMemo(
    () => getMiniCalendarCells(visibleMonthDate),
    [visibleMonthDate],
  );

  const navigateVisibleMonth = (direction: -1 | 1) => {
    setVisibleMonthState((current) => {
      const currentVisibleMonthDate =
        current.selectedDate === selectedDate
          ? current.visibleMonthDate
          : selectedDate;

      return {
        selectedDate,
        visibleMonthDate: addMonthsToIsoDate(currentVisibleMonthDate, direction),
      };
    });
  };
  const showReturnAction = Boolean(
    previousDate && previousDate !== selectedDate && onReturnToPreviousDate,
  );

  return (
    <section
      className={cn(
        "h-[227px] w-full shrink-0 bg-[var(--emr-surface-sidepanel)] pb-2",
        className,
      )}
      data-testid="side-panel-mini-calendar"
      aria-label="접수/예약 간이 캘린더"
    >
      <div className="mx-[6px] h-[219px]">
        <div
          className="flex h-[30px] items-center pl-3 pr-1.5"
          data-testid="side-panel-mini-calendar-header"
        >
          <div className="flex min-w-0 flex-1 items-center text-[length:var(--emr-type-size-dense)] font-medium leading-[var(--emr-type-leading-dense)] tracking-[var(--emr-type-tracking-dense)] text-[var(--emr-text-tertiary)] tabular-nums">
            {visibleMonthParts.year}년 {visibleMonthParts.month}월
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showReturnAction ? (
              <MiniCalendarIconButton
                label="이전에 보던 날짜로 돌아가기"
                onClick={() => onReturnToPreviousDate?.()}
                testId="side-panel-mini-calendar-return"
              >
                <CdsNavigationReturnIcon aria-hidden="true" />
              </MiniCalendarIconButton>
            ) : null}
            <MiniCalendarIconButton
              label="이전 달"
              onClick={() => navigateVisibleMonth(-1)}
            >
              <CdsNavigationChevronUpIcon aria-hidden="true" />
            </MiniCalendarIconButton>
            <MiniCalendarIconButton
              label="다음 달"
              onClick={() => navigateVisibleMonth(1)}
            >
              <CdsNavigationChevronDownIcon aria-hidden="true" />
            </MiniCalendarIconButton>
          </div>
        </div>
        <div className="grid h-[189px] grid-cols-7 grid-rows-7 text-center">
          {sidePanelMiniCalendarWeekdays.map((weekday) => (
            <div
              key={weekday}
              className="flex h-[27px] items-center justify-center text-[11px] font-medium leading-[13px] text-[var(--emr-text-tertiary)]"
            >
              {weekday}
            </div>
          ))}
          {cells.map((cell) => {
            const selected = cell.date === selectedDate;
            const today = cell.date === todayDate;
            const inRange = isDateInRange(cell.date, rangeStartDate, rangeEndDate);

            return (
              <button
                key={cell.date}
                type="button"
                className={cn(
                  "group/date relative flex h-[27px] items-center justify-center outline-none",
                  "text-[12px] font-medium leading-4 tabular-nums",
                  "transition-[background-color,box-shadow,color,opacity] duration-150 ease-out",
                  cell.inMonth
                    ? "text-[var(--emr-text-primary)]"
                    : "text-[var(--emr-text-disabled)]",
                  inRange &&
                    !selected &&
                    "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
                  selected && !today && "text-[var(--emr-text-primary)]",
                  "focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
                aria-label={[
                  today ? "오늘" : undefined,
                  formatKoreanOperatingDateLabel(cell.date),
                  selected ? "선택됨" : "선택",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={selected}
                data-date={cell.date}
                data-testid={`side-panel-mini-calendar-day-${cell.date}`}
                onClick={() => onDateSelect(cell.date)}
              >
                <span
                  className={cn(
                    "flex size-[23px] items-center justify-center rounded-[6px]",
                    "transition-[background-color,box-shadow,color,opacity] duration-150 ease-out",
                    "group-hover/date:bg-[var(--emr-state-hover)]",
                    today &&
                      "bg-[var(--clair-color-atomic-red-500)] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] group-hover/date:bg-[var(--clair-color-atomic-red-500)]",
                    selected &&
                      !today &&
                      "bg-[var(--emr-state-hover)] shadow-[inset_0_0_0_1px_var(--emr-line-default)] group-hover/date:bg-[var(--emr-state-hover)]",
                  )}
                >
                  {cell.day}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MiniCalendarIconButton({
  children,
  label,
  onClick,
  testId,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        title={label}
        data-testid={testId}
        className="relative flex size-6 shrink-0 items-center justify-center rounded-[6px] p-0 text-[var(--emr-text-tertiary)] outline-none transition-[background-color,color,box-shadow] duration-150 ease-out hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4"
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
