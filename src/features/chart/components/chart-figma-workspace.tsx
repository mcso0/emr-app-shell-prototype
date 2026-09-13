"use client";

import { type ReactNode } from "react";

import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsNavigationMaximize2Icon } from "@/components/cds-icons/navigation";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import {
  EmrPatientContextBar,
  type ContextBarProfileInteraction,
  type ContextBarVitalAction,
} from "@/components/emr/patient-context-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const chartWorkspacePanelClassName =
  "group/chart-panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-common-100)] shadow-xs";

type ChartPatientVitalItem = {
  label: string;
  value: string;
};

type ChartPatientMemoItem = {
  disabled?: boolean;
  label: string;
  summary: string;
};

type ChartPatientContextBarProps = {
  doctorName: string;
  guardianInteraction?: ContextBarProfileInteraction;
  guardianName: string;
  guardianPhone: string;
  memoItems: ChartPatientMemoItem[];
  patientInteraction?: ContextBarProfileInteraction;
  patientMeta: string;
  patientName: string;
  vitalAction?: ContextBarVitalAction;
  vitalItems: ChartPatientVitalItem[];
};

export function ChartPatientContextBar({
  doctorName,
  guardianInteraction,
  guardianName,
  guardianPhone,
  memoItems,
  patientInteraction,
  patientMeta,
  patientName,
  vitalAction,
  vitalItems,
}: ChartPatientContextBarProps) {
  return (
    <div
      data-slot="chart-patient-context-bar"
      className="h-full min-h-[var(--emr-context-bar-min-height)]"
    >
      <EmrPatientContextBar
        guardianIndicatorVisible={Boolean(guardianInteraction)}
        guardianInteraction={guardianInteraction}
        guardianItems={[
          { label: "보호자", value: guardianName },
          { label: "연락처", value: guardianPhone },
        ]}
        patientInteraction={patientInteraction}
        patientItems={[
          { label: "환자", value: patientName },
          { label: "환자 정보", value: patientMeta },
        ]}
        vitalAction={vitalAction}
        vitalItems={vitalItems}
        memoActions={memoItems}
        trailingItems={[{ label: "주치의", value: doctorName }]}
      />
    </div>
  );
}

export function ChartWorkspacePanel({
  actions,
  children,
  className,
  title,
  toolbar,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  title: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <section
      data-slot="chart-workspace-panel"
      className={cn(chartWorkspacePanelClassName, className)}
    >
      <div className="flex h-[38px] min-h-[38px] shrink-0 items-center justify-between gap-3 px-3 pt-2 pb-0.5">
        <h2 className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
          {title}
        </h2>
        <ChartPanelActionGroup>{actions}</ChartPanelActionGroup>
      </div>
      {toolbar ? (
        <div className="flex h-11 min-h-11 shrink-0 items-center overflow-x-auto border-b border-[var(--emr-border-default)] px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {toolbar}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function ChartActionBar({
  chartDate,
  completionAction,
  doctorName,
  encounterNo,
  historyAction,
  pendingIndicator,
  startTime,
  timeLabel = "진료 시작 일시",
  visitLabel,
}: {
  chartDate: string;
  completionAction?: ReactNode;
  doctorName: string;
  encounterNo: string;
  historyAction: ReactNode;
  pendingIndicator?: ReactNode;
  startTime: string;
  timeLabel?: string;
  visitLabel: string;
}) {
  return (
    <div
      data-slot="chart-action-bar"
      className="flex h-12 min-h-12 shrink-0 items-center justify-between gap-4 overflow-x-auto bg-[var(--emr-surface-workspace)] px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max items-center gap-2">
        {historyAction}
        <h1 className="whitespace-nowrap text-base font-semibold leading-6 text-foreground">
          차트 <span className="text-muted-foreground">{chartDate}</span>
        </h1>
        <Badge
          variant="outline"
          size="md"
          className="rounded-full px-2"
          data-testid="chart-visit-badge"
        >
          {visitLabel}
        </Badge>
        <Badge
          variant="ghost"
          size="md"
          className="max-w-40 truncate px-2 text-muted-foreground"
          data-testid="chart-encounter-number-badge"
        >
          {encounterNo}
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pendingIndicator}
        <span className="whitespace-nowrap text-[13px] font-medium leading-[18px] text-[var(--emr-text-secondary)]">
          {timeLabel} {startTime}
        </span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-input bg-card px-2 text-xs font-medium">
          <CdsPeopleUserIcon className="size-3.5" aria-hidden="true" />
          {doctorName}
        </span>
        {completionAction}
      </div>
    </div>
  );
}

export function ChartPanelActionGroup({ children }: { children?: ReactNode }) {
  return (
    <div
      data-slot="chart-panel-actions"
      className="flex shrink-0 items-center gap-1 text-[var(--clair-color-atomic-neutral-900)] has-[[aria-expanded=true]:not([data-chart-panel-collapse])]:opacity-100 has-[:focus-visible]:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/chart-panel:opacity-100"
    >
      {children}
    </div>
  );
}

export function ChartPanelIconButton({
  children,
  disabled = false,
  iconSize = "sm",
  label,
  onClick,
}: {
  children?: ReactNode;
  disabled?: boolean;
  iconSize?: "md" | "sm";
  label: string;
  onClick?: () => void;
}) {
  const iconSizeClassName =
    iconSize === "md" ? "[&_svg]:!size-4" : "[&_svg]:!size-3.5";

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="inline-flex cursor-not-allowed"
              tabIndex={0}
              aria-label={label}
            />
          }
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              "size-7 rounded-lg text-[var(--clair-color-atomic-neutral-900)] hover:!text-[var(--clair-color-atomic-neutral-900)] aria-expanded:!text-[var(--clair-color-atomic-neutral-900)] disabled:opacity-100",
              iconSizeClassName,
            )}
            tabIndex={-1}
            disabled
          >
            {children ?? <CdsNavigationMaximize2Icon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn(
              "size-7 rounded-lg text-[var(--clair-color-atomic-neutral-900)] hover:!text-[var(--clair-color-atomic-neutral-900)] aria-expanded:!text-[var(--clair-color-atomic-neutral-900)]",
              iconSizeClassName,
            )}
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children ?? <CdsNavigationMaximize2Icon />}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function ChartPanelActions({ onMore }: { onMore?: () => void }) {
  return (
    <>
      <ChartPanelIconButton label="패널 확대 준비 중" disabled />
      <ChartPanelIconButton
        label={onMore ? "더보기" : "더보기 준비 중"}
        disabled={!onMore}
        iconSize="md"
        onClick={onMore}
      >
        <CdsFilesMoreHorizontalIcon />
      </ChartPanelIconButton>
    </>
  );
}
