"use client";

import type { ReactNode } from "react";
import { EmrTableCellText } from "@/components/emr/table-primitives";
import type { EmrTableCellTextMode } from "@/components/emr/table-density";
import { cn } from "@/lib/utils";

type CustomerTableCellContentProps = {
  align?: "left" | "center" | "right";
  children: ReactNode;
  className?: string;
  identity?: boolean;
  rich?: boolean;
  textMode?: EmrTableCellTextMode;
};

export function CustomerTableCellContent({
  align = "left",
  children,
  className,
  identity = false,
  rich = false,
  textMode = "one-line",
}: CustomerTableCellContentProps) {
  const scalar = typeof children === "string" || typeof children === "number";
  const text = scalar ? String(children) : undefined;

  return (
    <div
      className={cn(
        "flex min-h-10 min-w-0 items-center gap-1.5 px-2.5 text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-neutral-700)]",
        identity && "px-0",
        align === "center" && "justify-center text-center",
        align === "right" && "justify-end text-right",
        className,
      )}
      data-emr-table-content="true"
      data-emr-customer-cell-content="true"
    >
      {!rich ? (
        <EmrTableCellText mode={textMode} fullText={text}>
          {children}
        </EmrTableCellText>
      ) : (
        children
      )}
    </div>
  );
}
