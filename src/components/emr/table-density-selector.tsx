"use client";

import {
  emrTableDensityOptions,
  type EmrTableDensity,
} from "@/components/emr/table-density";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type EmrTableDensitySelectorProps = {
  value: EmrTableDensity;
  onValueChange: (value: EmrTableDensity) => void;
  className?: string;
  label?: string;
};

function TableDensityIcon({ density }: { density: EmrTableDensity }) {
  const rowClassName = {
    compact: "h-0.5",
    standard: "h-0.5",
    comfortable: "h-0.5",
  }[density];
  const gapClassName = {
    compact: "gap-0.5",
    standard: "gap-1",
    comfortable: "gap-1.5",
  }[density];

  return (
    <span
      aria-hidden="true"
      className={cn("flex h-4 w-4 flex-col justify-center", gapClassName)}
    >
      <span className={cn("block rounded-full bg-current", rowClassName)} />
      <span className={cn("block rounded-full bg-current", rowClassName)} />
      <span className={cn("block rounded-full bg-current", rowClassName)} />
    </span>
  );
}

export function EmrTableDensitySelector({
  value,
  onValueChange,
  className,
  label = "테이블 보기 밀도",
}: EmrTableDensitySelectorProps) {
  return (
    <TooltipProvider>
      <div
        role="group"
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center gap-[var(--clair-border-width-atomic-2)] rounded-[var(--clair-radius-atomic-8)] bg-[var(--emr-surface-muted)] p-[var(--clair-border-width-atomic-4)]",
          className
        )}
      >
        {emrTableDensityOptions.map((option) => {
          const active = option.value === value;
          const accessibleLabel = `${option.label} 보기`;

          return (
            <Tooltip key={option.value}>
              <TooltipTrigger
                type="button"
                aria-label={accessibleLabel}
                aria-pressed={active}
                title={accessibleLabel}
                className={cn(
                  "inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-[var(--emr-radius-control)] border border-transparent px-1 text-[var(--emr-text-secondary)] transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "bg-card text-[var(--emr-text-primary)] shadow-[var(--clair-shadow-xs)] hover:bg-card"
                    : "bg-transparent hover:bg-[var(--emr-state-hover)]"
                )}
                onClick={() => onValueChange(option.value)}
              >
                <TableDensityIcon density={option.value} />
              </TooltipTrigger>
              <TooltipContent>{accessibleLabel}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
