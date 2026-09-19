"use client";

import type { ComponentProps, ReactNode } from "react";

import { CircleCheckIcon } from "@/components/icons";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

export type EmrFilterToggleSize = "xs" | "sm" | "default" | "lg" | "xl";

type EmrFilterToggleProps = Omit<
  ComponentProps<typeof Toggle>,
  "children" | "size"
> & {
  children: ReactNode;
  icon?: ReactNode;
  size?: EmrFilterToggleSize;
};

const sizeClassNames: Record<EmrFilterToggleSize, string> = {
  xs: "emr-control-text-compact h-[var(--clair-control-height-xs)] min-w-7 gap-1 px-2 [&_svg:not([class*='size-'])]:size-3",
  sm: "emr-control-text-compact h-[var(--clair-control-height-sm)] min-w-8 gap-1 px-2 [&_svg:not([class*='size-'])]:size-3",
  default:
    "emr-control-text h-[var(--clair-control-height-md)] min-w-8 gap-1 px-3 [&_svg:not([class*='size-'])]:size-4",
  lg: "emr-control-text h-[var(--clair-control-height-lg)] min-w-9 gap-1.5 px-4 [&_svg:not([class*='size-'])]:size-4",
  xl: "emr-control-text h-[var(--clair-control-height-xl)] min-w-9 gap-1.5 px-4 [&_svg:not([class*='size-'])]:size-4",
};

/**
 * Compact EMR filter toggle with the shared button size scale.
 *
 * Use for an independent boolean filter that updates the current view in
 * place. The consumer owns the state, persistence, and permission behavior.
 */
export function EmrFilterToggle({
  children,
  className,
  icon = <CircleCheckIcon aria-hidden="true" />,
  size = "default",
  ...props
}: EmrFilterToggleProps) {
  return (
    <Toggle
      {...props}
      size={size === "xs" || size === "sm" ? "xs" : size === "lg" ? "md" : "default"}
      variant="outline"
      className={cn(
        "rounded-[var(--clair-radius-atomic-8)] border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-common-100)] text-[var(--clair-color-atomic-neutral-900)] shadow-[var(--clair-shadow-xs)]",
        "data-pressed:border-[var(--clair-color-atomic-sky-100)] data-pressed:bg-[var(--clair-color-atomic-sky-50)] data-pressed:text-[var(--clair-color-atomic-sky-600)] data-pressed:shadow-[var(--clair-shadow-xs)]",
        "data-pressed:hover:border-[var(--clair-color-atomic-sky-100)] data-pressed:hover:bg-[var(--clair-color-atomic-sky-50)] data-pressed:hover:text-[var(--clair-color-atomic-sky-600)]",
        sizeClassNames[size],
        className,
      )}
    >
      {icon}
      <span>{children}</span>
    </Toggle>
  );
}
