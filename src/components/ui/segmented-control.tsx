"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One option in a SegmentedControl.
 */
export type SegmentedControlItem<TValue extends string> = {
  /**
   * Stable value emitted through `onValueChange`.
   */
  value: TValue;
  /**
   * Short visible label. Keep labels compact enough for dense EMR toolbars.
   */
  label: ReactNode;
  /**
   * Full accessible label when the visible label is abbreviated.
   */
  ariaLabel?: string;
  /**
   * Optional count for queue filters. Use only when the count matches the
   * currently visible data set.
   */
  count?: number;
  /**
   * Optional browser tooltip for extra context.
   */
  title?: string;
};

export type SegmentedControlProps<TValue extends string> = {
  /**
   * Currently selected item value.
   */
  value: TValue;
  /**
   * Small mutually exclusive option set. Avoid long taxonomies.
   */
  items: Array<SegmentedControlItem<TValue>>;
  /**
   * Required group label that names what this control changes.
   */
  "aria-label": string;
  /**
   * Additional classes for the outer group.
   */
  className?: string;
  /**
   * Additional classes for each item button.
   */
  itemClassName?: string;
  /**
   * Visual mode. Use `pill` for filters and `tabs` for compact display settings.
   */
  variant?: "pill" | "tabs";
  /**
   * Called with the selected item value. The consuming screen owns state,
   * persistence, analytics, and permission behavior.
   */
  onValueChange: (value: TValue) => void;
};

/**
 * Compact mutually exclusive filter or mode selector.
 *
 * Use SegmentedControl for small filters and display modes that update the
 * current view in place. Do not use it for shell navigation, long category
 * lists, or actions that require confirmation.
 *
 * @summary compact filter or mode selector
 */
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
          "gap-[var(--clair-border-width-atomic-2)] rounded-[var(--clair-radius-atomic-8)] bg-[var(--emr-surface-muted)] p-[var(--clair-border-width-atomic-4)]",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            aria-label={item.ariaLabel}
            aria-pressed={active}
            title={item.title}
            className={cn(
              "inline-flex shrink-0 items-center justify-center border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              variant === "pill" &&
                (active
                  ? "emr-control-text min-h-8 rounded-full border-transparent bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary"
                  : "emr-control-text min-h-8 rounded-full border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-1.5 font-medium text-[var(--emr-text-tertiary)] hover:bg-[var(--emr-state-hover)]"),
              variant === "tabs" &&
                (active
                  ? "emr-text-metadata min-h-5 min-w-5 rounded-[var(--emr-radius-control)] border-transparent bg-card px-1.5 py-px font-medium text-[var(--emr-text-primary)] hover:bg-card"
                  : "emr-text-metadata min-h-5 min-w-5 rounded-[var(--emr-radius-control)] border-transparent bg-transparent px-1.5 py-px font-medium text-[var(--emr-text-secondary)] hover:bg-[var(--emr-state-hover)]"),
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
