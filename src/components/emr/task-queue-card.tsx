"use client";

import { ClockIcon } from "@/components/icons";
import { EmrSidePanelStateIcon } from "@/components/emr/side-panel-state-icon";
import { getEmrSidePanelStatusIconState } from "@/components/emr/side-panel-status-title";
import { cn } from "@/lib/utils";
import {
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelIdentityLine,
  EmrSidePanelMetaBadge,
  EmrSidePanelStatusBadge,
  EmrSidePanelTypeBadge,
} from "@/components/emr/side-panel-card";
import type {
  EmrRowActionMenuDensity,
  EmrRowActionMenuItem,
} from "@/components/emr/row-action-menu";

export type EmrTaskQueueEventKind = "request" | "reRequest" | "cancel";

export type EmrTaskQueueCardItem = {
  actionAriaLabel: string;
  actionItems?: EmrRowActionMenuItem[];
  actionMenuDensity?: EmrRowActionMenuDensity;
  actionTestId?: string;
  assigneeName?: string;
  eventActorName: string;
  eventKind?: EmrTaskQueueEventKind;
  eventText?: string;
  eventTime: string;
  guardianName: string;
  patientName: string;
  receptionType: string;
  secondLineBadgeLabel?: string;
  secondLineText: string;
  testId?: string;
};

type EmrTaskQueueCardProps = {
  className?: string;
  item: EmrTaskQueueCardItem;
  selected: boolean;
  patientView?: { statusLabel: string; urgent: boolean };
  onSelect?: () => void;
};

const eventKindLabels: Record<EmrTaskQueueEventKind, string> = {
  cancel: "취소",
  reRequest: "재요청",
  request: "요청",
};

function getEventLabel(kind: EmrTaskQueueEventKind | undefined) {
  return eventKindLabels[kind ?? "request"];
}

export function EmrTaskQueueCard({
  className,
  item,
  selected,
  onSelect,
  patientView,
}: EmrTaskQueueCardProps) {
  const eventLabel = getEventLabel(item.eventKind);
  const eventMeta =
    item.eventText ?? `${item.eventTime} ${item.eventActorName} ${eventLabel}`;

  if (patientView) {
    const statusLabel = patientView.statusLabel === "대기" ? "대기중" : patientView.statusLabel;
    const showTypeBadge = item.secondLineBadgeLabel && item.secondLineBadgeLabel.trim() !== item.secondLineText.trim();

    return (
      <EmrSidePanelCard className={cn("gap-[var(--clair-spacing-4)] rounded-[var(--clair-radius-atomic-8)]", className)} selectionVariant="modulePanel" selected={selected} testId={item.testId} onSelect={onSelect}>
        <div className="flex min-w-0 flex-col gap-[var(--clair-spacing-2)]">
          <div className="emr-text-metadata flex min-w-0 items-center gap-1 pr-[var(--clair-spacing-24)] text-[var(--emr-sidepanel-task-card-label-text)]">
            <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.eventTime} {item.eventActorName} {eventLabel}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1 text-[13px] leading-[18px] font-medium">
            {showTypeBadge ? <span className="max-w-[110px] shrink-0 truncate rounded border px-1 text-[10px] leading-[14px]">{item.secondLineBadgeLabel}</span> : null}
            {patientView.urgent ? <span className="shrink-0 text-[10px] text-[var(--emr-status-danger-text)]">긴급</span> : null}
            <span className="min-w-0 truncate" title={item.secondLineText}>{item.secondLineText}</span>
          </div>
        </div>
        <div className="absolute top-[var(--clair-spacing-4)] right-[var(--clair-spacing-4)]">
          <EmrSidePanelCardAction ariaLabel={item.actionAriaLabel} density={item.actionMenuDensity} items={item.actionItems} testId={item.actionTestId} />
        </div>
        <div data-slot="task-queue-card-footer" className="flex min-w-0 flex-wrap items-center gap-[var(--clair-spacing-4)] [&>span]:gap-[var(--clair-spacing-4)] [&>span]:h-[22px] [&>span]:px-[var(--clair-spacing-4)] [&>span]:py-0 [&>span]:font-normal">
          <EmrSidePanelMetaBadge label="요청" value={item.eventActorName} maxWidthClassName="max-w-[88px]" />
          <EmrSidePanelMetaBadge label="담당" value={item.assigneeName ?? "미지정"} maxWidthClassName="max-w-[80px]" />
          <EmrSidePanelStatusBadge
            icon={<EmrSidePanelStateIcon aria-hidden="true" state={getEmrSidePanelStatusIconState({ label: statusLabel })} />}
            maxWidthClassName="ml-auto max-w-none"
          >
            {statusLabel}
          </EmrSidePanelStatusBadge>
        </div>
      </EmrSidePanelCard>
    );
  }

  return (
    <EmrSidePanelCard
      className={className}
      selectionVariant="modulePanel"
      selected={selected}
      testId={item.testId}
      onSelect={onSelect}
    >
      <EmrSidePanelIdentityLine
        patientName={item.patientName}
        guardianName={item.guardianName}
        typeBadge={<EmrSidePanelTypeBadge label={item.receptionType} />}
        action={
          <EmrSidePanelCardAction
            ariaLabel={item.actionAriaLabel}
            density={item.actionMenuDensity}
            items={item.actionItems}
            testId={item.actionTestId}
          />
        }
      />
      <div className="emr-text-metadata flex h-6 min-w-0 items-baseline gap-[var(--clair-spacing-4)] font-medium text-[var(--emr-sidepanel-task-card-label-text)]">
        {item.secondLineBadgeLabel ? (
          <span className="shrink-0 rounded-[var(--clair-radius-atomic-6)] bg-transparent px-[var(--clair-spacing-6)] py-[var(--clair-spacing-2)]">
            {item.secondLineBadgeLabel}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{item.secondLineText}</span>
      </div>
      <div data-slot="task-queue-card-footer" className="flex h-6 min-w-0 items-center gap-[var(--clair-spacing-6)] overflow-hidden">
        <EmrSidePanelStatusBadge
          icon={<ClockIcon aria-hidden="true" />}
          maxWidthClassName="max-w-[144px]"
        >
          {eventMeta}
        </EmrSidePanelStatusBadge>
        <EmrSidePanelMetaBadge
          label="담당"
          maxWidthClassName="max-w-[84px]"
          value={item.assigneeName ?? "미지정"}
        />
      </div>
    </EmrSidePanelCard>
  );
}

export function joinTaskQueueSummary(values: string[], fallback: string) {
  const uniqueValues = values
    .map((value) => value.trim())
    .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);
  const [firstValue] = uniqueValues;

  if (!firstValue) return fallback;
  if (uniqueValues.length === 1) return firstValue;

  return `${firstValue} 외 ${uniqueValues.length - 1}`;
}

export function getTaskQueueEventKindFromStatus(status?: string | null): EmrTaskQueueEventKind {
  if (status === "cancelled" || status === "canceled") return "cancel";
  if (status === "re_requested" || status === "returned" || status === "reRequested") return "reRequest";

  return "request";
}
