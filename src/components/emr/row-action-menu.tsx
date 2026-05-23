"use client";

import type { ReactNode } from "react";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type EmrRowActionMenuItem = {
  key: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
  testId?: string;
  variant?: "default" | "destructive";
};

export type EmrRowActionMenuProps = {
  ariaLabel: string;
  contentClassName?: string;
  items: EmrRowActionMenuItem[];
  testId?: string;
  triggerClassName?: string;
};

const defaultRowActionMenuTriggerClassName =
  "size-7 shrink-0 rounded-[var(--clair-radius-sm)] bg-[var(--emr-surface-panel)] p-0 text-[var(--emr-text-secondary)] hover:bg-[var(--emr-surface-muted)] data-popup-open:bg-[var(--emr-state-selected)] data-popup-open:text-[var(--emr-text-primary)] [&_svg]:size-4";

export function EmrRowActionMenu({
  ariaLabel,
  contentClassName,
  items,
  testId,
  triggerClassName,
}: EmrRowActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className={cn(triggerClassName ?? defaultRowActionMenuTriggerClassName)}
            aria-label={ariaLabel}
            data-testid={testId}
          />
        }
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <CdsFilesMoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-52", contentClassName)}>
        {items.map((item, index) => (
          <div key={item.key}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              className={cn(
                "min-h-9 cursor-pointer flex-col items-start justify-center gap-0.5 py-2",
                item.description && "min-h-12"
              )}
              data-testid={item.testId}
              disabled={item.disabled}
              variant={item.variant}
              onClick={(event) => {
                event.stopPropagation();
                item.onSelect?.();
              }}
            >
              <span className="emr-text-dense font-medium">{item.label}</span>
              {item.description ? (
                <span className="emr-text-micro text-muted-foreground">{item.description}</span>
              ) : null}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
