"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ClockIcon } from "@/components/icons";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrContentAsideHeader,
  EmrContentAsidePanel,
} from "@/components/emr/content-aside-panel";
import { EmrContentHistoryGroup } from "@/components/emr/content-history-list";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrListHeaderIconButton } from "@/components/emr/subpanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type {
  FulfillmentWorkItem,
  FulfillmentWorkItemStatus,
} from "@/features/fulfillment/server-fulfillment-work-item-core";
import {
  formatOperatingShortTime,
  formatShortOperatingDate,
  getOperatingDateFromIso,
} from "@/lib/emr-domain/demo-date";
import styles from "./patient-history-aside.module.css";

export type PatientHistoryEntry = {
  assignee?: string;
  category?: "dispensing" | "treatment";
  id: string;
  onSelect?: () => void;
  orderNames?: string[];
  selected?: boolean;
  status: string;
  timestamp: string;
  title: string;
};

type HistoryReadStatus = "loading" | "ready" | "error" | "permission_denied";
type HistoryQueueType = "lab" | "imaging" | "dispensing" | "treatment";

export function getFulfillmentOrderDisplayName(snapshot?: {
  billingName?: string;
  displayName?: string;
  effectiveDisplayName?: string;
  inHospitalOrderName?: string;
  orderDisplayName?: string;
  standardOrderName?: string;
} | null) {
  return [
    snapshot?.orderDisplayName,
    snapshot?.displayName,
    snapshot?.effectiveDisplayName,
    snapshot?.inHospitalOrderName,
    snapshot?.standardOrderName,
    snapshot?.billingName,
  ].find((name) => typeof name === "string" && name.trim())?.trim();
}

export function getPatientHistoryStatus(status: FulfillmentWorkItemStatus) {
  if (status === "requested") return "요청";
  if (status === "in_progress") return "진행 중";
  if (status === "paused") return "일시중지";
  if (status === "completed") return "완료";
  if (status === "cancelled") return "취소";
  return "재요청";
}

export function usePatientFulfillmentHistory(
  workspaceId: string,
  patientId: string | undefined,
  queueTypes: readonly HistoryQueueType[],
) {
  const queueKey = queueTypes.join(",");
  const [state, setState] = useState<{
    assigneeNames: Record<string, string>;
    key: string;
    status: HistoryReadStatus;
    workItems: FulfillmentWorkItem[];
  }>({ assigneeNames: {}, key: "", status: "loading", workItems: [] });
  const key = `${workspaceId}:${patientId ?? ""}:${queueKey}`;

  useEffect(() => {
    if (!patientId) return;
    const controller = new AbortController();
    const types = queueKey.split(",") as HistoryQueueType[];

    async function load() {
      try {
        const headers = { "x-clair-demo-session-user-id": "user-tech" };
        const [responses, staffResponse] = await Promise.all([
          Promise.all(types.map((queueType) =>
            fetch(
              `/api/workspaces/${encodeURIComponent(workspaceId)}/fulfillment/work-items?queueType=${queueType}&patientId=${encodeURIComponent(patientId!)}`,
              { headers, signal: controller.signal },
            ),
          )),
          fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/staff`, {
            headers,
            signal: controller.signal,
          }).catch(() => null),
        ]);
        const bodies = await Promise.all(responses.map((response) => response.json()));
        const staffBody = staffResponse?.ok
          ? await staffResponse.json().catch(() => null) as { staff?: Array<{ displayName: string; id: string }> } | null
          : null;
        const assigneeNames = Object.fromEntries(
          (staffBody?.staff ?? []).map((staff) => [staff.id, staff.displayName]),
        );
        if (controller.signal.aborted) return;
        if (responses.some((response) => response.status === 403)) {
          setState({ assigneeNames: {}, key, status: "permission_denied", workItems: [] });
        } else if (responses.some((response, index) => !response.ok || !bodies[index]?.ok)) {
          setState({ assigneeNames: {}, key, status: "error", workItems: [] });
        } else {
          setState({
            assigneeNames,
            key,
            status: "ready",
            workItems: bodies.flatMap((body) => body.workItems as FulfillmentWorkItem[]),
          });
        }
      } catch {
        if (!controller.signal.aborted) setState({ assigneeNames: {}, key, status: "error", workItems: [] });
      }
    }

    void load();
    return () => controller.abort();
  }, [key, patientId, queueKey, workspaceId]);

  return state.key === key
    ? state
    : { assigneeNames: {}, key, status: "loading" as const, workItems: [] };
}

export function PatientHistoryAside({
  actions,
  entries,
  filter,
  id,
  label,
  onCollapse,
  onFilterChange,
  status = "ready",
}: {
  actions?: ReactNode;
  entries: PatientHistoryEntry[];
  filter?: "all" | "dispensing" | "treatment";
  id: string;
  label: string;
  onCollapse: () => void;
  onFilterChange?: (filter: "all" | "dispensing" | "treatment") => void;
  status?: HistoryReadStatus;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const filteredEntries = filter && filter !== "all"
    ? entries.filter((entry) => entry.category === filter)
    : entries;
  const groups = useMemo(() => {
    const byDate = new Map<string, PatientHistoryEntry[]>();
    for (const entry of [...filteredEntries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
      const date = getOperatingDateFromIso(entry.timestamp);
      if (!date) continue;
      byDate.set(date, [...(byDate.get(date) ?? []), entry]);
    }
    return [...byDate].map(([date, items]) => ({ date, items }));
  }, [filteredEntries]);

  return (
    <EmrContentAsidePanel id={id} className={styles.panel}>
      <EmrContentAsideHeader
        className={styles.header}
        count={entries.length}
        label={label}
        onCollapse={onCollapse}
        actions={actions ?? <>
          <EmrListHeaderIconButton ariaLabel="정렬"><CdsUtilitiesSortIcon className="size-4" /></EmrListHeaderIconButton>
          <EmrListHeaderIconButton ariaLabel="필터"><CdsActionsListFilterIcon className="size-4" /></EmrListHeaderIconButton>
          <EmrListHeaderIconButton ariaLabel="검색"><CdsActionsSearchIcon className="size-4" /></EmrListHeaderIconButton>
        </>}
      />
      <div className="h-px w-full shrink-0 bg-[var(--emr-border-default)]" />
      {onFilterChange ? (
        <div className={styles.tabs}>
          <SegmentedControl
            aria-label="조제/처치 이력 종류"
            items={[
              { label: "전체", value: "all" },
              { label: "조제", value: "dispensing" },
              { label: "처치", value: "treatment" },
            ]}
            size="sm"
            value={filter ?? "all"}
            variant="tabs"
            onValueChange={onFilterChange}
          />
        </div>
      ) : null}
      <ScrollArea className={styles.scrollArea} viewportClassName="scroll-fade-y scroll-fade-8">
        <div className={styles.groups}>
          {status === "loading" ? <p className={styles.message}>이력을 불러오는 중입니다.</p> : null}
          {status === "permission_denied" ? (
            <EmrInlineAlert severity="warning" title="이력을 볼 권한이 없습니다." />
          ) : null}
          {status === "error" ? (
            <EmrInlineAlert severity="warning" title="이력을 불러오지 못했습니다." />
          ) : null}
          {status === "ready" && !groups.length ? (
            <p className={styles.message}>기록된 이력이 없습니다.</p>
          ) : null}
          {status === "ready" ? groups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              collapsed={collapsedGroups.has(group.date)}
              count={group.items.length}
              dataTestId={`${id}-group-${group.date}`}
              label={formatShortOperatingDate(group.date)}
              onToggle={() => setCollapsedGroups((current) => {
                const next = new Set(current);
                if (next.has(group.date)) next.delete(group.date);
                else next.add(group.date);
                return next;
              })}
            >
              {group.items.map((entry) => <HistoryCard key={entry.id} entry={entry} />)}
            </EmrContentHistoryGroup>
          )) : null}
        </div>
      </ScrollArea>
    </EmrContentAsidePanel>
  );
}

function HistoryCard({ entry }: { entry: PatientHistoryEntry }) {
  const names = entry.orderNames ?? [entry.title];
  const title = names.length > 1 ? `${names[0]} +${names.length - 1}` : entry.title;
  const tone = /완료|확인/.test(entry.status)
    ? "success"
    : /중지|재요청|취소/.test(entry.status)
      ? "warning"
      : "active";
  const contents: ReactNode = (
    <>
      <span className={styles.time}><ClockIcon className="size-3" aria-hidden="true" />{formatOperatingShortTime(entry.timestamp)}</span>
      <span className={styles.card}>
        <span className={styles.title} title={names.length > 1 ? names.join("\n") : undefined}>{title}</span>
        <span className={styles.meta}>
          {entry.category ? <span className={styles.chip}>{entry.category === "dispensing" ? "조제" : "처치"}</span> : null}
          <span className={styles.status} data-tone={tone}>{entry.status}</span>
          <span className={styles.chip}>담당 {entry.assignee ?? "미정"}</span>
        </span>
      </span>
    </>
  );
  return entry.onSelect ? (
    <button type="button" className={styles.entry} data-selected={entry.selected} onClick={entry.onSelect}>
      {contents}
    </button>
  ) : <div className={styles.entry}>{contents}</div>;
}
