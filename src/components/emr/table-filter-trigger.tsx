"use client";

import * as React from "react";

import { CdsActionsListFilterIcon } from "@/components/cds-icons/actions-and-controls";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmrTableFilterTriggerProps = Omit<
  ButtonProps,
  "children" | "variant"
> & {
  activeCount: number;
  iconOnly?: boolean;
  label?: string;
};

export const EmrTableFilterTrigger = React.forwardRef<
  HTMLButtonElement,
  EmrTableFilterTriggerProps
>(function EmrTableFilterTrigger(
  {
    activeCount,
    "aria-label": ariaLabel,
    className,
    iconOnly = false,
    label = "필터",
    size = "sm",
    ...props
  },
  ref
) {
  const selected = activeCount > 0;

  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : size}
      aria-label={
        ariaLabel ?? (selected ? `${label}, 적용 중인 룰 ${activeCount}개` : label)
      }
      className={cn(
        iconOnly
          ? "relative"
          : [
              "h-8 min-h-8 gap-1 rounded-lg bg-card px-3 py-1.5 text-sm leading-5 font-medium tracking-[0.014em] shadow-[var(--clair-shadow-xs)]",
              "aria-expanded:bg-card aria-expanded:text-foreground aria-expanded:shadow-[var(--clair-shadow-xs)]",
              selected && "border-[var(--clair-color-atomic-sky-200)]",
            ],
        className
      )}
      {...props}
    >
      <span data-slot="filter-label-pair" className="inline-flex items-center gap-1.5">
        <CdsActionsListFilterIcon aria-hidden="true" />
        {!iconOnly && <span data-slot="filter-label-text">{label}</span>}
      </span>
      {selected && (iconOnly ? (
        <span
          data-slot="filter-active-indicator"
          aria-hidden="true"
          className="pointer-events-none absolute right-[var(--clair-spacing-4)] top-[var(--clair-spacing-4)] size-[var(--clair-spacing-6)] rounded-full bg-[var(--clair-color-atomic-sky-500)]"
        />
      ) : (
        <strong className="font-medium text-[var(--emr-text-link)]">{activeCount}</strong>
      ))}
    </Button>
  );
});
