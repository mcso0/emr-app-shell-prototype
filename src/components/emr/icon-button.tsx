"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmrIconButtonProps = Omit<ComponentProps<typeof Button>, "children" | "size" | "variant"> & {
  children: ReactNode;
  iconSize?: "sm" | "md";
};

export function EmrIconButton({
  children,
  className,
  iconSize = "sm",
  ...props
}: EmrIconButtonProps) {
  const iconSlotClassName =
    iconSize === "md"
      ? "size-4 [&_svg]:size-4"
      : "size-[14px] [&_svg]:size-[14px]";

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn(
        "size-6 rounded-[var(--clair-radius-sm)] bg-transparent p-0 text-[var(--clair-color-label-alternative)]",
        "[&[aria-expanded=true]:not(:hover)]:!bg-transparent hover:!bg-[var(--clair-color-background-subtle)] hover:text-[var(--clair-color-label-strong)]",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden", iconSlotClassName)}>
        {children}
      </span>
    </Button>
  );
}
