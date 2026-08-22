import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmrRightPanelProps = ComponentPropsWithoutRef<"div"> & {
  header: ReactNode;
};

export type EmrRightPanelFooterSize = "compact" | "single" | "stacked";

type EmrRightPanelFooterProps = ComponentPropsWithoutRef<"footer"> & {
  size: EmrRightPanelFooterSize;
};

export function EmrRightPanel({
  children,
  className,
  header,
  ...props
}: EmrRightPanelProps) {
  return (
    <div
      data-slot="emr-right-panel"
      className={cn("flex h-full min-h-0 flex-col", className)}
      {...props}
    >
      {header}
      {children}
    </div>
  );
}

export function EmrRightPanelBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="emr-right-panel-body"
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

export function EmrRightPanelFooter({
  className,
  size,
  ...props
}: EmrRightPanelFooterProps) {
  return (
    <footer
      data-size={size}
      data-slot="emr-right-panel-footer"
      className={cn(
        "shrink-0 border-t border-[var(--emr-border-default)] bg-card",
        size === "compact" && "h-[var(--emr-rightpanel-footer-compact-height)]",
        size === "single" && "h-[var(--emr-rightpanel-footer-single-height)]",
        size === "stacked" && "h-[var(--emr-rightpanel-footer-stacked-height)]",
        className,
      )}
      {...props}
    />
  );
}
