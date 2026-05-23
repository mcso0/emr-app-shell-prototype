"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  emrTableDensityOptions,
  type EmrTableDensity,
} from "@/components/emr/table-density";
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
  label = "밀도",
}: EmrTableDensitySelectorProps) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <span className="emr-text-metadata font-medium text-muted-foreground">{label}</span>
      <SegmentedControl
        aria-label="테이블 밀도"
        value={value}
        items={emrTableDensityOptions.map((option) => ({
          value: option.value,
          label: <TableDensityIcon density={option.value} />,
          ariaLabel: option.label,
          title: option.label,
        }))}
        variant="tabs"
        itemClassName="min-h-6 min-w-6 px-1"
        onValueChange={onValueChange}
      />
    </div>
  );
}
