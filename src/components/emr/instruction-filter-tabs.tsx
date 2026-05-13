"use client";

import { LineTabs, type LineTabItem } from "@/components/ui/line-tabs";
import { cn } from "@/lib/utils";

type EmrInstructionFilterTabsProps<TValue extends string> = {
  value: TValue;
  items: Array<LineTabItem<TValue>>;
  "aria-label": string;
  className?: string;
  onValueChange: (value: TValue) => void;
};

export function EmrInstructionFilterTabs<TValue extends string>({
  value,
  items,
  "aria-label": ariaLabel,
  className,
  onValueChange,
}: EmrInstructionFilterTabsProps<TValue>) {
  return (
    <LineTabs
      aria-label={ariaLabel}
      className={cn("w-full border-b border-[var(--emr-line-hairline)]", className)}
      size="default"
      value={value}
      items={items}
      onValueChange={onValueChange}
    />
  );
}
