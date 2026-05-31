"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmrContentAsidePanelProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export function EmrContentAsidePanel({
  children,
  className,
  id,
}: EmrContentAsidePanelProps) {
  return (
    <div
      id={id}
      data-slot="content-aside-panel"
      className={cn(
        "flex h-full w-full min-w-[var(--emr-content-aside-width)] flex-col gap-[var(--emr-content-aside-section-gap)] bg-[var(--emr-content-aside-bg)] px-[var(--emr-content-aside-padding-x)] pt-[var(--emr-content-aside-header-padding-top)]",
        className
      )}
    >
      {children}
    </div>
  );
}
