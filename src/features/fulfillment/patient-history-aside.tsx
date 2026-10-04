"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClockIcon } from "@/components/icons";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { EmrHistoryFilterDialog, EmrHistorySearch, EmrHistorySortButton, useHistorySearch } from "@/components/emr/history-controls";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { compareHistoryDates, emptyHistoryDateRange, matchesHistoryDate, matchesHistoryQuery, type HistoryDateRange, type HistorySortDirection } from "@/lib/history-controls";
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
  modality?: string;
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

type PatientHistoryFilters = { dates: HistoryDateRange; statuses: string[]; assignees: string[]; names: string[]; modalities: string[] };
const emptyFilters: PatientHistoryFilters = { dates: emptyHistoryDateRange, statuses: [], assignees: [], names: [], modalities: [] };

export function PatientHistoryAside({
  entries, id, kind, label, onCollapse, showCategories = false, status = "ready",
}: {
  entries: PatientHistoryEntry[];
  id: string;
  kind: "lab" | "imaging" | "fulfillment";
  label: string;
  onCollapse: () => void;
  showCategories?: boolean;
  status?: HistoryReadStatus;
}) {
  const search = useHistorySearch();
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const [direction, setDirection] = useState<HistorySortDirection>("newest");
  const [filters, setFilters] = useState(emptyFilters);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [category, setCategory] = useState<"all" | "dispensing" | "treatment">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const resetConditions = () => { search.clear(); setFilters(emptyFilters); setCategory("all"); setCollapsedGroups(new Set()); };
  const visibleEntries = entries.filter((entry) =>
    (category === "all" || entry.category === category) &&
    matchesHistoryDate(entry.timestamp, filters.dates) &&
    (!filters.statuses.length || filters.statuses.includes(entry.status)) &&
    (!filters.assignees.length || filters.assignees.includes(entry.assignee ?? "미정")) &&
    (!filters.names.length || filters.names.includes(entry.title)) &&
    (!filters.modalities.length || filters.modalities.includes(entry.modality ?? "정보 없음")) &&
    matchesHistoryQuery(search.searchQuery, [entry.title, ...(entry.orderNames ?? []), entry.status, entry.assignee, entry.modality, entry.category === "dispensing" ? "조제" : entry.category === "treatment" ? "처치" : undefined])
  ).sort((a, b) => compareHistoryDates(a.timestamp, b.timestamp, direction) || a.id.localeCompare(b.id));
  const groups = new Map<string, PatientHistoryEntry[]>();
  for (const entry of visibleEntries) {
    const date = getOperatingDateFromIso(entry.timestamp) ?? "날짜 미상";
    groups.set(date, [...(groups.get(date) ?? []), entry]);
  }
  const facetOptions = (field: "statuses" | "assignees" | "names" | "modalities") => Array.from(new Set(entries.map((entry) =>
    field === "statuses" ? entry.status : field === "assignees" ? entry.assignee ?? "미정" : field === "names" ? entry.title : entry.modality ?? "정보 없음"
  )));
  const activeCount = filters.statuses.length + filters.assignees.length + filters.names.length + filters.modalities.length + (filters.dates.start ? 1 : 0);
  const filtered = Boolean(activeCount || search.searchQuery.trim() || category !== "all");
  const hiddenSelection = entries.some((entry) => entry.selected && !visibleEntries.some((visible) => visible.id === entry.id));
  const searchLabel = kind === "lab" ? "검사 이력 검색" : kind === "imaging" ? "영상 이력 검색" : "조제/처치 이력 검색";
  const filterTitle = kind === "lab" ? "검사 이력 필터" : kind === "imaging" ? "영상 이력 필터" : "조제/처치 이력 필터";

  return (
    <EmrContentAsidePanel id={id} className={styles.panel}>
      <EmrContentAsideHeader className={styles.header} count={visibleEntries.length} label={label} onCollapse={onCollapse}
        actions={<>
          <EmrHistorySortButton direction={direction} onChange={setDirection} dateLabel="이력 기록일" />
          <EmrListHeaderIconButton ariaLabel="필터" aria-pressed={Boolean(activeCount)} onClick={() => { setDraftFilters(filters); setFilterOpen(true); }}><CdsActionsListFilterIcon className="size-4" /></EmrListHeaderIconButton>
          <EmrListHeaderIconButton ref={searchTriggerRef} ariaLabel="검색" aria-pressed={search.open} onClick={() => { if (search.open) search.clear(); search.setOpen(!search.open); }}><CdsActionsSearchIcon className="size-4" /></EmrListHeaderIconButton>
        </>}
      />
      <div className="h-px w-full shrink-0 bg-[var(--emr-border-default)]" />
      {search.open ? <EmrHistorySearch search={search} label={searchLabel} placeholder="검사·오더명·상태·담당자 검색" onQueryChange={() => setCollapsedGroups(new Set())} onClose={() => { search.clear(); search.setOpen(false); searchTriggerRef.current?.focus(); }} /> : null}
      {status === "ready" ? <p role="status" aria-live="polite" className="shrink-0 emr-text-metadata text-muted-foreground">결과 {visibleEntries.length} / 전체 {entries.length}건</p> : null}
      {filtered ? <Button size="sm" variant="outline" onClick={resetConditions}>조건 해제</Button> : null}
      {status === "ready" && hiddenSelection ? <EmrInlineAlert severity="info" title="선택한 이력이 조건에 가려져 있습니다">선택한 기록은 계속 열려 있습니다.</EmrInlineAlert> : null}
      <EmrHistoryFilterDialog open={filterOpen} title={filterTitle} dateLabel="이력 기록일" dates={draftFilters.dates} onDatesChange={(dates) => setDraftFilters((current) => ({ ...current, dates }))} onReset={() => setDraftFilters(emptyFilters)} onCancel={() => setFilterOpen(false)} onApply={() => { setFilters(draftFilters); setCollapsedGroups(new Set()); setFilterOpen(false); }}>
        {([['statuses', '상태'], ['assignees', '담당자'], ...(kind === 'lab' ? [['names', '검사명']] : kind === 'imaging' ? [['modalities', '검사 분류']] : [])] as Array<["statuses" | "assignees" | "names" | "modalities", string]>).map(([field, title]) => <FieldSet key={field}><FieldLegend variant="label">{title} · 여러 항목 선택 가능</FieldLegend><FieldGroup>
          {facetOptions(field).map((value, index) => <Field key={value} orientation="horizontal"><Checkbox id={`${id}-${field}-${index}`} checked={draftFilters[field].includes(value)} onCheckedChange={(checked) => setDraftFilters((current) => ({ ...current, [field]: checked ? [...current[field], value] : current[field].filter((item) => item !== value) }))} /><FieldLabel htmlFor={`${id}-${field}-${index}`}>{value}</FieldLabel></Field>)}
        </FieldGroup></FieldSet>)}
      </EmrHistoryFilterDialog>
      {showCategories ? <div className={styles.tabs}><SegmentedControl aria-label="조제/처치 이력 종류" items={[{ label: "전체", value: "all" }, { label: "조제", value: "dispensing" }, { label: "처치", value: "treatment" }]} size="sm" value={category} variant="tabs" onValueChange={(value) => { setCategory(value); setCollapsedGroups(new Set()); }} /></div> : null}
      <ScrollArea className={styles.scrollArea} viewportClassName="scroll-fade-y scroll-fade-8">
        <div className={styles.groups}>
          {status === "loading" ? <p className={styles.message}>이력을 불러오는 중입니다.</p> : null}
          {status === "permission_denied" ? <EmrInlineAlert severity="warning" title="이력을 볼 권한이 없습니다." /> : null}
          {status === "error" ? <EmrInlineAlert severity="warning" title="이력을 불러오지 못했습니다." /> : null}
          {status === "ready" && !groups.size ? <EmrEmptyState surface="queue" size="sm" density="compact" kind={!entries.length ? "no-data" : search.searchQuery.trim() ? "no-search-results" : "no-filter-results"} title={!entries.length ? "기록된 이력이 없습니다" : search.searchQuery.trim() ? "검색 결과가 없습니다" : "조건에 맞는 이력이 없습니다"} description={!entries.length ? "환자의 이력이 등록되면 표시됩니다." : "검색어와 필터 조건을 확인해 주세요."} primaryAction={entries.length ? <Button size="sm" variant="outline" onClick={resetConditions}>조건 해제</Button> : undefined} testId={`${id}-empty-state`} /> : null}
          {status === "ready" ? [...groups].map(([date, items]) => <EmrContentHistoryGroup key={date} collapsed={collapsedGroups.has(date)} count={items.length} dataTestId={`${id}-group-${date}`} label={date === "날짜 미상" ? date : formatShortOperatingDate(date)} onToggle={() => setCollapsedGroups((current) => { const next = new Set(current); if (next.has(date)) next.delete(date); else next.add(date); return next; })}>
            {items.map((entry) => <HistoryCard key={entry.id} entry={entry} />)}
          </EmrContentHistoryGroup>) : null}
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
    <button type="button" className={styles.entry} data-testid={`patient-history-item-${entry.id}`} data-selected={entry.selected} onClick={entry.onSelect}>
      {contents}
    </button>
  ) : <div className={styles.entry} data-testid={`patient-history-item-${entry.id}`}>{contents}</div>;
}
