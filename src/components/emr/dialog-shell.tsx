"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type EmrDialogShellVariant = "confirm" | "form" | "wide-form";

type EmrDialogShellLayout = {
  contentClassName: string;
  headerClassName: string;
  bodyClassName: string;
  footerClassName: string;
};

export const emrDialogShellLayouts = {
  confirm: {
    contentClassName: "overflow-hidden p-0 sm:max-w-[420px]",
    headerClassName: "px-6 pb-3 pt-6",
    bodyClassName: "px-6 pb-5 pt-0",
    footerClassName:
      "-mx-0 -mb-0 items-center justify-end rounded-none border-t bg-[var(--emr-surface-panel)] px-6 py-4 sm:justify-end",
  },
  form: {
    contentClassName:
      "grid max-h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[520px]",
    headerClassName: "border-b border-[var(--emr-line-hairline)] px-6 pb-4 pt-6",
    bodyClassName: "min-h-0 overflow-y-auto px-6 py-5",
    footerClassName:
      "-mx-0 -mb-0 items-center justify-end rounded-none border-t bg-[var(--emr-surface-panel)] px-6 py-4 sm:justify-end",
  },
  "wide-form": {
    contentClassName:
      "grid max-h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[680px]",
    headerClassName: "border-b border-[var(--emr-line-hairline)] px-8 pb-4 pt-7",
    bodyClassName: "min-h-0 overflow-y-auto px-8 py-6",
    footerClassName:
      "-mx-0 -mb-0 items-center justify-end rounded-none border-t bg-[var(--emr-surface-panel)] px-8 py-4 sm:justify-end",
  },
} as const satisfies Record<EmrDialogShellVariant, EmrDialogShellLayout>;

export type EmrDialogShellProps = Omit<ComponentPropsWithoutRef<typeof DialogContent>, "children"> & {
  title: ReactNode;
  variant?: EmrDialogShellVariant;
  children?: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  footer?: ReactNode;
  footerMeta?: ReactNode;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  closeAriaLabel?: string;
};

export function EmrDialogShell({
  bodyClassName,
  children,
  className,
  closeAriaLabel = "다이얼로그 닫기",
  description,
  footer,
  footerClassName,
  footerMeta,
  headerClassName,
  primaryAction,
  secondaryAction,
  showCloseButton = true,
  title,
  variant = "confirm",
  ...props
}: EmrDialogShellProps) {
  const layout = emrDialogShellLayouts[variant];
  const hasStructuredFooter = footerMeta || secondaryAction || primaryAction;
  const hasFooter = footer !== undefined && footer !== null ? true : Boolean(hasStructuredFooter);

  return (
    <DialogContent
      {...props}
      data-variant={variant}
      showCloseButton={false}
      className={cn(layout.contentClassName, className)}
    >
      <DialogHeader className={cn(layout.headerClassName, headerClassName)}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="emr-text-dialog-title font-bold text-[var(--emr-text-primary)]">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="mt-2 leading-5 text-[var(--emr-text-tertiary)]">
                {description}
              </DialogDescription>
            ) : null}
          </div>
          {showCloseButton ? (
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 shrink-0 rounded-md text-[var(--emr-text-secondary)] hover:bg-[var(--emr-state-hover)]"
                  aria-label={closeAriaLabel}
                />
              }
            >
              <CdsActionsXIcon className="size-4" />
            </DialogClose>
          ) : null}
        </div>
      </DialogHeader>
      <div className={cn(layout.bodyClassName, bodyClassName)}>{children}</div>
      {hasFooter ? (
        <DialogFooter className={cn(layout.footerClassName, footerClassName)}>
          {footer ?? (
            <>
              {footerMeta ? (
                <div className="min-w-0 flex-1 text-sm leading-5 text-[var(--emr-text-tertiary)]">
                  {footerMeta}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {secondaryAction}
                {primaryAction}
              </div>
            </>
          )}
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}
