"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedControlItem<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  count?: number;
};

type SegmentedControlProps<TValue extends string> = {
  value: TValue;
  items: Array<SegmentedControlItem<TValue>>;
  "aria-label": string;
  className?: string;
  itemClassName?: string;
  variant?: "pill" | "tabs";
  onValueChange: (value: TValue) => void;
};

export function SegmentedControl<TValue extends string>({
  value,
  items,
  "aria-label": ariaLabel,
  className,
  itemClassName,
  variant = "pill",
  onValueChange,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-fit items-center",
        variant === "pill" && "gap-2.5",
        variant === "tabs" &&
          "gap-[var(--clair-border-width-atomic-2)] rounded-[var(--clair-radius-atomic-8)] bg-[var(--clair-color-atomic-gray-100)] p-[var(--clair-border-width-atomic-4)]",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex shrink-0 items-center justify-center border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              variant === "pill" &&
                (active
                  ? "min-h-8 rounded-full border-transparent bg-[var(--clair-color-atomic-gray-800)] px-3 py-1.5 text-[14px] font-medium leading-5 tracking-[0px] text-[var(--clair-color-static-white)] hover:bg-[var(--clair-color-atomic-gray-800)]"
                  : "min-h-8 rounded-full border-[var(--clair-color-atomic-gray-200)] bg-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[14px] font-medium leading-5 tracking-[0px] text-[var(--clair-color-atomic-gray-600)] hover:bg-selection"),
              variant === "tabs" &&
                (active
                  ? "min-h-5 min-w-5 rounded-[var(--clair-radius-atomic-6)] border-transparent bg-card px-1.5 py-px text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-900)] hover:bg-card"
                  : "min-h-5 min-w-5 rounded-[var(--clair-radius-atomic-6)] border-transparent bg-transparent px-1.5 py-px text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-700)] hover:bg-[var(--clair-color-atomic-black-alpha-4)]"),
              itemClassName
            )}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
            {typeof item.count === "number" ? ` ${item.count}` : null}
          </button>
        );
      })}
    </div>
  );
}
