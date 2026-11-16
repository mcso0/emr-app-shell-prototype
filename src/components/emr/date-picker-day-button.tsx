import type { ComponentProps, ReactNode } from "react";
import { isComposing } from "@ui-sdk/core";
import { CalendarDay } from "@ui-sdk/react/calendar";
import { formatKoreanOperatingDateLabel } from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";

type EmrDatePickerDayButtonProps = Omit<ComponentProps<"button">, "children"> & {
  date: string;
  day: ReactNode;
  inMonth: boolean;
  selected: boolean;
  today?: boolean;
  size?: "sm" | "md";
};
type DayPresentation = Pick<
  EmrDatePickerDayButtonProps,
  "className" | "disabled" | "inMonth" | "selected" | "size" | "today"
>;
const datePickerDayButtonSizeClassName = { md: "size-8", sm: "size-7" } as const;

function dayClassName({ className, disabled, inMonth, selected, size = "sm", today = false }: DayPresentation) {
  return cn(
    "relative flex items-center justify-center rounded-md emr-text-metadata font-medium tabular-nums outline-none transition-[scale,background-color,box-shadow] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
    datePickerDayButtonSizeClassName[size],
    inMonth ? "text-foreground" : "text-muted-foreground",
    today && !selected && !disabled && "font-semibold text-primary ring-1 ring-primary/35 ring-offset-1 ring-offset-background hover:bg-[var(--emr-state-hover)]",
    selected && "bg-primary text-primary-foreground ring-0 ring-offset-0 hover:bg-primary/90",
    disabled && "cursor-not-allowed text-[var(--emr-text-disabled)] hover:bg-transparent active:scale-100",
    className,
  );
}
function dayLabel(date: string, selected: boolean, today?: boolean) {
  return [today ? "오늘" : undefined, formatKoreanOperatingDateLabel(date), selected ? "선택됨" : "선택"]
    .filter(Boolean)
    .join(" ");
}

export function EmrDatePickerDayButton({
  className, date, day, disabled, inMonth, selected, size = "sm", today = false, ...props
}: EmrDatePickerDayButtonProps) {
  return (
    <button
      type="button"
      className={dayClassName({ className, disabled, inMonth, selected, size, today })}
      aria-label={dayLabel(date, selected, today)}
      aria-pressed={selected}
      disabled={disabled}
      {...props}
    >
      <span>{day}</span>
    </button>
  );
}

/** Same CLAiR day appearance; UI SDK owns the gridcell focus and date selection. */
export function EmrDatePickerCalendarDay({
  className, date, day, inMonth, selected, size = "sm", today = false, onReselect,
}: Pick<EmrDatePickerDayButtonProps, "className" | "date" | "day" | "inMonth" | "selected" | "size" | "today"> & { onReselect?: () => void }) {
  return (
    <CalendarDay
      value={date}
      aria-label={dayLabel(date, selected, today)}
      className="p-0.5 outline-none [&:focus-visible>span]:ring-3 [&:focus-visible>span]:ring-ring/50"
      onClick={() => { if (selected) onReselect?.(); }}
      onKeyDown={(event) => {
        if (selected && !isComposing(event) && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onReselect?.();
        }
      }}
    >
      <span className={dayClassName({ className: cn("mx-auto", className), inMonth, selected, size, today })}>{day}</span>
    </CalendarDay>
  );
}
