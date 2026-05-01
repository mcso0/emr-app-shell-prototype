"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LineTabItem<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
};

type LineTabsProps<TValue extends string> = {
  value: TValue;
  items: Array<LineTabItem<TValue>>;
  "aria-label": string;
  className?: string;
  itemClassName?: string;
  onValueChange: (value: TValue) => void;
};

export function LineTabs<TValue extends string>({
  value,
  items,
  "aria-label": ariaLabel,
  className,
  itemClassName,
  onValueChange,
}: LineTabsProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex w-fit items-center gap-[6px]", className)}
    >
      {items.map((item) => {
        const disabled = item.disabled === true;
        const active = !disabled && item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            className={cn(
              "inline-flex shrink-0 flex-col items-center justify-center gap-[var(--clair-spacing-8)] px-[var(--clair-spacing-8)] text-[16px] font-medium leading-6 tracking-[var(--clair-typography-body-1-normal-letter-spacing)] transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              disabled &&
                "cursor-not-allowed text-[var(--clair-color-atomic-gray-300)]",
              active &&
                "text-[var(--clair-color-atomic-gray-900)] hover:text-[var(--clair-color-atomic-gray-900)]",
              !active &&
                !disabled &&
                "text-[var(--clair-color-atomic-gray-500)] hover:text-[var(--clair-color-atomic-gray-900)]",
              itemClassName
            )}
            onClick={() => onValueChange(item.value)}
          >
            <span className="inline-flex items-center gap-[var(--clair-border-width-atomic-4)]">
              <span>{item.label}</span>
              {typeof item.count === "number" ? <span>{item.count}</span> : null}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "h-0.5 w-full shrink-0 bg-[var(--clair-color-atomic-gray-900)] transition-opacity",
                active ? "opacity-100" : "opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
