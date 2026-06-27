"use client";

import { useMemo, useState } from "react";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronRightIcon,
} from "@/components/cds-icons/navigation";
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
  className?: string;
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

  return (
    <section
      className={cn(
        "h-[237px] w-[296px] shrink-0 bg-[var(--emr-surface-sidepanel)]",
        className,
      )}
      data-testid="side-panel-mini-calendar"
      aria-label="접수/예약 간이 캘린더"
    >
      <div className="mx-[6px] h-[225px] w-[284px]">
        <div className="flex h-9 items-center px-1.5">
          <button
            type="button"
            className="relative flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[var(--emr-text-tertiary)] outline-none transition-[background-color,color,box-shadow] duration-150 ease-out hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="이전 달"
            onClick={() => navigateVisibleMonth(-1)}
          >
            <CdsNavigationChevronLeftIcon className="size-4" aria-hidden="true" />
          </button>
          <div className="flex h-6 flex-1 items-center justify-center px-1 text-center text-[12px] font-semibold leading-[18px] text-[var(--emr-text-primary)] tabular-nums">
            {visibleMonthParts.year}년 {visibleMonthParts.month}월
          </div>
          <button
            type="button"
            className="relative flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[var(--emr-text-tertiary)] outline-none transition-[background-color,color,box-shadow] duration-150 ease-out hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="다음 달"
            onClick={() => navigateVisibleMonth(1)}
          >
            <CdsNavigationChevronRightIcon className="size-4" aria-hidden="true" />
          </button>
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
                  selected &&
                    !today &&
                    "bg-[var(--clair-color-atomic-black-alpha-4)] text-[var(--emr-text-primary)]",
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
                      "shadow-[inset_0_0_0_1px_var(--emr-line-default)] group-hover/date:bg-transparent",
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
