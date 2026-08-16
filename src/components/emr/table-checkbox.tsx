"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type EmrTableCheckboxProps = ComponentProps<typeof Checkbox> & {
  checkedTone?: "brand" | "neutral";
};

export function EmrTableCheckbox({
  checkedTone = "neutral",
  className,
  ...props
}: EmrTableCheckboxProps) {
  return (
    <Checkbox
      data-emr-table-checkbox="true"
      data-emr-table-checkbox-tone={checkedTone}
      className={cn(
        checkedTone === "brand" &&
          "data-checked:before:border-[var(--emr-table-checkbox-brand-checked)] data-checked:before:bg-[var(--emr-table-checkbox-brand-checked)]",
        className,
      )}
      {...props}
    />
  );
}
