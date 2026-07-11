"use client";

import type { ComponentProps, ReactNode } from "react";
import { CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type EmrConfirmDialogPresentationProps = Pick<
  ComponentProps<typeof DialogContent>,
  "motion" | "overlayClassName"
>;

type EmrConfirmDialogContentProps = {
  cancelLabel: string;
  confirmLabel: string;
  description: ReactNode;
  title: ReactNode;
  className?: string;
  closeAriaLabel?: string;
  confirmDisabled?: boolean;
  confirmButtonVariant?: ComponentProps<typeof Button>["variant"];
  onCancel: () => void;
  onConfirm: () => void;
} & EmrConfirmDialogPresentationProps;

export function EmrConfirmDialogContent({
  cancelLabel,
  className,
  closeAriaLabel = "확인 다이얼로그 닫기",
  confirmDisabled = false,
  confirmButtonVariant,
  confirmLabel,
  description,
  motion,
  onCancel,
  onConfirm,
  overlayClassName,
  title,
}: EmrConfirmDialogContentProps) {
  return (
    <DialogContent
      className={cn("overflow-hidden p-0 sm:max-w-[420px]", className)}
      motion={motion}
      overlayClassName={overlayClassName}
      showCloseButton={false}
    >
      <DialogHeader className="px-6 pb-3 pt-6">
        <div className="min-w-0 pr-10">
          <DialogTitle className="emr-text-dialog-title font-semibold text-[var(--emr-text-primary)]">
            {title}
          </DialogTitle>
        </div>
        <DialogDescription className="leading-5 text-[var(--emr-text-tertiary)]">
          {description}
        </DialogDescription>
      </DialogHeader>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-[var(--emr-dialog-close-offset)] top-[var(--emr-dialog-close-offset)] size-8 rounded-md text-[var(--emr-text-secondary)] hover:bg-[var(--emr-state-hover)]"
        aria-label={closeAriaLabel}
        onClick={onCancel}
      >
        <CdsActionsXIcon className="size-4" />
      </Button>
      <DialogFooter className="-mx-0 -mb-0 items-center justify-end rounded-none border-t bg-[var(--emr-surface-panel)] px-6 py-4 sm:justify-end">
        <Button variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={confirmButtonVariant}
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
