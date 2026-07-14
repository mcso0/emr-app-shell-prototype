import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type EmrRightPanelHeaderProps = ComponentPropsWithoutRef<"header">;

export function EmrRightPanelHeader({
  className,
  ...props
}: EmrRightPanelHeaderProps) {
  return (
    <header
      data-slot="emr-right-panel-header"
      className={cn(
        "flex h-[var(--emr-rightpanel-header-height)] shrink-0 items-center px-4",
        className,
      )}
      {...props}
    />
  );
}
