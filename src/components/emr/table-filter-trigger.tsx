"use client";

import * as React from "react";

import { CdsActionsListFilterIcon } from "@/components/cds-icons/actions-and-controls";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmrTableFilterTriggerProps = Omit<
  ButtonProps,
  "children" | "size" | "variant"
> & {
  activeCount: number;
  label?: string;
};

export const EmrTableFilterTrigger = React.forwardRef<
  HTMLButtonElement,
  EmrTableFilterTriggerProps
>(function EmrTableFilterTrigger(
  { activeCount, "aria-label": ariaLabel, className, label = "필터", ...props },
  ref
) {
  const selected = activeCount > 0;

  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      aria-label={
        ariaLabel ?? (selected ? `${label}, 적용 중인 룰 ${activeCount}개` : label)
      }
      className={cn(
        "h-8 min-h-8 gap-1 rounded-lg bg-card px-3 py-1.5 text-sm leading-5 font-medium tracking-[0.014em] shadow-[var(--clair-shadow-xs)]",
        "aria-expanded:bg-card aria-expanded:text-foreground aria-expanded:shadow-[var(--clair-shadow-xs)]",
        selected && "border-[var(--clair-color-atomic-sky-200)]",
        className
      )}
      {...props}
    >
      <CdsActionsListFilterIcon aria-hidden="true" className="size-4" />
      <span>{label}</span>
      {selected ? (
        <strong className="font-medium text-[var(--emr-text-link)]">{activeCount}</strong>
      ) : null}
    </Button>
  );
});
