"use client";

import { ClockIcon } from "@/components/icons";
import { EmrStatusBadge } from "@/components/emr/status-badge";
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
  patientView?: { chartLabel?: string; statusLabel: string; urgent: boolean };
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

  if (patientView) return <EmrSidePanelCard className={className} selectionVariant="modulePanel" selected={selected} testId={item.testId} onSelect={onSelect}>
    <div className="emr-text-metadata flex min-w-0 items-center gap-1 text-[var(--emr-sidepanel-task-card-label-text)]"><ClockIcon className="size-3 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{item.eventTime} {item.eventActorName} {eventLabel}</span><EmrSidePanelCardAction ariaLabel={item.actionAriaLabel} density={item.actionMenuDensity} items={item.actionItems} testId={item.actionTestId} /></div>
    {patientView.chartLabel ? <div className="emr-text-metadata truncate text-[var(--emr-sidepanel-task-card-label-text)]" title={patientView.chartLabel}>{patientView.chartLabel}</div> : null}
    <div className="emr-text-metadata flex min-w-0 items-center gap-1 font-medium">{item.secondLineBadgeLabel ? <span className="shrink-0 rounded border px-1 text-[10px]">{item.secondLineBadgeLabel}</span> : null}{patientView.urgent ? <span className="shrink-0 text-[10px] text-[var(--emr-status-danger-text)]">긴급</span> : null}<span className="truncate">{item.secondLineText}</span></div>
    <div className="flex min-w-0 items-center gap-1 overflow-hidden"><EmrSidePanelMetaBadge label="요청" value={item.eventActorName} maxWidthClassName="max-w-[88px]" /><EmrSidePanelMetaBadge label="담당" value={item.assigneeName ?? "미지정"} maxWidthClassName="max-w-[80px]" /><EmrStatusBadge className="ml-auto shrink-0" label={patientView.statusLabel === "대기" ? "대기중" : patientView.statusLabel} marker="none" /></div>
  </EmrSidePanelCard>;

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
      <div className="flex h-6 min-w-0 items-center gap-[var(--clair-spacing-6)] overflow-hidden">
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
