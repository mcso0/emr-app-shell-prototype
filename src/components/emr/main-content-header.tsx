import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export type EmrMainContentHeaderHeightMode = "fixed" | "adaptive";

export type EmrMainContentHeaderProps = ComponentPropsWithoutRef<"div"> & {
  heightMode: EmrMainContentHeaderHeightMode;
};

export function EmrMainContentHeader({
  className,
  heightMode,
  ...props
}: EmrMainContentHeaderProps) {
  return (
    <div
      {...props}
      data-height-mode={heightMode}
      data-slot="emr-main-content-header"
      className={cn("flex shrink-0 flex-col overflow-hidden", className)}
    />
  );
}
