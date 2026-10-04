"use client";

import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupDivider,
  ButtonGroupIconButton,
  ButtonGroupPrimaryButton,
} from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      <ButtonGroup aria-label={menuAriaLabel}>
        <ButtonGroupPrimaryButton
          type="button"
          variant="outline"
          size="sm"
          className="border-r-transparent border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-primary"
        >
          {activeLabel}
        </ButtonGroupPrimaryButton>
        <ButtonGroupDivider className="bg-[var(--emr-status-info-border)]" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ButtonGroupIconButton
                aria-label={`${menuAriaLabel} 열기`}
                variant="outline"
                size="sm"
                className="border-l-transparent border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-primary"
              />
            }
          >
            <ChevronDownIcon className="size-3" />
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
      </ButtonGroup>
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
