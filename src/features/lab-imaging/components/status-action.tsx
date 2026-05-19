"use client";

import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type LabImagingStatusActionProps<TStatus extends string> = {
  activeLabel: string;
  activeStatus: TStatus;
  completeLabel: string;
  completedStatus: TStatus;
  menuAriaLabel: string;
  requestedStatus: TStatus;
  status: TStatus;
  onCancelAssignment: () => void;
  onComplete: () => void;
  onStart: () => void;
};

export function LabImagingStatusAction<TStatus extends string>({
  activeLabel,
  activeStatus,
  completeLabel,
  completedStatus,
  menuAriaLabel,
  requestedStatus,
  status,
  onCancelAssignment,
  onComplete,
  onStart,
}: LabImagingStatusActionProps<TStatus>) {
  if (status === completedStatus) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="border-[var(--emr-status-info-border)] bg-card text-primary"
      >
        <CheckIcon data-icon="inline-start" />
        {completeLabel}
      </Button>
    );
  }

  if (status === activeStatus) {
    return (
      <div className="inline-flex items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-r-none border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-primary"
        >
          {activeLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={menuAriaLabel}
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "-ml-px rounded-l-none border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-primary"
            )}
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem className="h-8 cursor-pointer" onClick={onComplete}>
              <CheckIcon className="size-3" />
              {completeLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-8 cursor-pointer" onClick={onCancelAssignment}>
              담당취소
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  if (status === requestedStatus) {
    return (
      <Button type="button" size="sm" onClick={onStart}>
        담당하기
        <ChevronDownIcon data-icon="inline-end" />
      </Button>
    );
  }

  return null;
}
