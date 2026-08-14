"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { ComponentProps } from "react";

type EmrTableCheckboxProps = ComponentProps<typeof Checkbox>;

export function EmrTableCheckbox(props: EmrTableCheckboxProps) {
  return <Checkbox data-emr-table-checkbox="true" {...props} />;
}
