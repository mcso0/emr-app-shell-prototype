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
      className={cn("flex h-full w-full flex-col gap-2 bg-[var(--emr-surface-content-panel)] px-4 pt-4", className)}
    >
      {children}
    </div>
  );
}
