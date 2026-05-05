"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type EmrTableCheckboxProps = ComponentProps<typeof Checkbox>;

export function EmrTableCheckbox({ className, ...props }: EmrTableCheckboxProps) {
  return (
    <Checkbox
      className={cn(
        "border-[var(--clair-color-atomic-gray-300)] opacity-100 transition-opacity data-disabled:border-[var(--clair-color-atomic-gray-200)] data-disabled:opacity-100",
        className
      )}
      {...props}
    />
  );
}
