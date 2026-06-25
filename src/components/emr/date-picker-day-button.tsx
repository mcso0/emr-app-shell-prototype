import type { ComponentProps, ReactNode } from "react";
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

const datePickerDayButtonSizeClassName = {
  md: "size-8",
  sm: "size-7",
} as const;

export function EmrDatePickerDayButton({
  className,
  date,
  day,
  disabled,
  inMonth,
  selected,
  size = "sm",
  today = false,
  ...props
}: EmrDatePickerDayButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex items-center justify-center rounded-md emr-text-metadata font-medium tabular-nums outline-none transition-[scale,background-color,box-shadow] duration-150 ease-out hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
        datePickerDayButtonSizeClassName[size],
        inMonth ? "text-foreground" : "text-muted-foreground",
        today &&
          !selected &&
          !disabled &&
          "font-semibold text-primary ring-1 ring-primary/35 ring-offset-1 ring-offset-background hover:bg-[var(--clair-color-atomic-black-alpha-4)]",
        selected &&
          "bg-primary text-primary-foreground ring-0 ring-offset-0 hover:bg-primary/90",
        disabled &&
          "cursor-not-allowed text-[var(--emr-text-disabled)] hover:bg-transparent active:scale-100",
        className,
      )}
      aria-label={[
        today ? "오늘" : undefined,
        formatKoreanOperatingDateLabel(date),
        selected ? "선택됨" : "선택",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={selected}
      disabled={disabled}
      {...props}
    >
      <span>{day}</span>
    </button>
  );
}
