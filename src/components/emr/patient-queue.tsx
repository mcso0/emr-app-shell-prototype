"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CdsPeopleUsersIcon } from "@/components/cds-icons/people-and-places";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { CdsActionsListFilterIcon } from "@/components/cds-icons/actions-and-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmrListHeaderIconButton, EmrQueueEmptyState } from "@/components/emr/subpanel";
import { EmrSidePanelCollapsibleGroup } from "@/components/emr/side-panel-collapsible-group";
import { EmrTaskQueueCard } from "@/components/emr/task-queue-card";
import { groupPatientQueue, patientQueueChartLabels, patientQueueKey, patientQueueStatus, patientQueueStatusLabels, type PatientQueueRow, type PatientQueueSort, type PatientQueueOrderSort } from "@/features/work-queue/patient-queue";

export function PatientQueueToggle({ active, disabled, onChange }: { active: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger render={
        <EmrListHeaderIconButton
          ariaLabel={active ? "오더별 보기" : "환자별 보기"}
          aria-pressed={active}
          disabled={disabled}
          data-testid="patient-queue-view-toggle"
          className={active ? "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]" : undefined}
          onClick={onChange}
        >
          <CdsPeopleUsersIcon aria-hidden="true" className="size-4" />
        </EmrListHeaderIconButton>
      } />
      <TooltipContent role="tooltip" side="bottom">{active ? "오더별 보기로 전환" : "환자별로 그룹핑"}</TooltipContent>
    </Tooltip>
  );
}
export function PatientQueueSortOptions({ value, onChange }: { value: PatientQueueSort; onChange: (value: PatientQueueSort) => void }) {
  return <><DropdownMenuSeparator /><div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">환자 그룹 순서</div><DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as PatientQueueSort)}><DropdownMenuRadioItem value="priority">업무 우선순</DropdownMenuRadioItem><DropdownMenuRadioItem value="latest">최신 오더순</DropdownMenuRadioItem></DropdownMenuRadioGroup></>;
}
export function PatientQueueSortMenu({ orderSort, onOrderSort, groupSort, onGroupSort, disabled }: { orderSort: PatientQueueOrderSort; onOrderSort: (sort: PatientQueueOrderSort) => void; groupSort: PatientQueueSort; onGroupSort: (sort: PatientQueueSort) => void; disabled: boolean }) {
  return <DropdownMenu><DropdownMenuTrigger render={<EmrListHeaderIconButton ariaLabel="대기열 정렬" disabled={disabled}><CdsUtilitiesSortIcon className="size-4" /></EmrListHeaderIconButton>} /><DropdownMenuContent align="end" className="w-44"><div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">동순위 업무 정렬</div><DropdownMenuRadioGroup value={orderSort} onValueChange={v => onOrderSort(v as PatientQueueOrderSort)}><DropdownMenuRadioItem value="assignee">담당자순</DropdownMenuRadioItem><DropdownMenuRadioItem value="request">요청순</DropdownMenuRadioItem><DropdownMenuRadioItem value="wait">대기 긴 순</DropdownMenuRadioItem></DropdownMenuRadioGroup><PatientQueueSortOptions value={groupSort} onChange={onGroupSort} /></DropdownMenuContent></DropdownMenu>;
}
export function PatientQueueFilterMenu({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <DropdownMenu><DropdownMenuTrigger render={<EmrListHeaderIconButton ariaLabel="대기열 필터" aria-pressed={value !== "all"} disabled={disabled}><CdsActionsListFilterIcon className="size-4" /></EmrListHeaderIconButton>} /><DropdownMenuContent align="end" className="w-44"><DropdownMenuRadioGroup value={value} onValueChange={onChange}><DropdownMenuRadioItem value="all">전체 조건</DropdownMenuRadioItem><DropdownMenuRadioItem value="unassigned">담당 미정</DropdownMenuRadioItem>{["returned", "in_progress", "requested", "completed", "cancelled"].map(status => <DropdownMenuRadioItem key={status} value={status}>{patientQueueStatusLabels[status]}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>;
}

// A date/workspace-keyed instance keeps UI continuity separate from business selection.
export function PatientQueueContent({ active, allRows, rows, selectedId, groupSort, orderSort, onSelect, onClearConditions, readable = true, ready, children }: {
  active: boolean; allRows: PatientQueueRow[]; rows: PatientQueueRow[]; selectedId?: string;
  groupSort: PatientQueueSort; orderSort: PatientQueueOrderSort; onSelect: (id: string) => void;
  onClearConditions: () => void; readable?: boolean; ready: boolean; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const previousIds = useRef<Set<string> | null>(null);
  const previousActive = useRef(active);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [revealId, setRevealId] = useState<string | null>(selectedId ?? null);
  const groups = groupPatientQueue(rows, groupSort, orderSort);
  const viewport = useCallback(() => root.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]'), []);
  const capture = useCallback(() => {
    const area = viewport(); if (!area) return;
    const top = area.getBoundingClientRect().top;
    const cards = root.current?.querySelectorAll<HTMLElement>('[data-patient-queue-item]');
    const first = [...(cards ?? [])].find(card => card.getBoundingClientRect().bottom > top && card.getBoundingClientRect().top < area.getBoundingClientRect().bottom);
    anchor.current = first ? { id: first.dataset.patientQueueItem!, top: first.getBoundingClientRect().top - top } : null;
  }, [viewport]);
  useEffect(() => {
    const area = viewport(); area?.addEventListener("scroll", capture, { passive: true });
    return () => area?.removeEventListener("scroll", capture);
  }, [capture, viewport]);
  useEffect(() => {
    if (!readable) { previousIds.current = null; const frame = requestAnimationFrame(() => setNewIds([])); return () => cancelAnimationFrame(frame); }
    if (!ready) return;
    const next = new Set(allRows.map(row => row.id));
    if (previousIds.current) {
      const added = [...next].filter(id => !previousIds.current!.has(id));
      const frame = requestAnimationFrame(() => setNewIds(current => [...new Set([...current.filter(id => next.has(id)), ...added])]));
      previousIds.current = next;
      return () => cancelAnimationFrame(frame);
    }
    previousIds.current = next;
  }, [allRows, readable, ready]);
  useLayoutEffect(() => {
    const area = viewport();
    const modeChanged = previousActive.current !== active;
    previousActive.current = active;
    const target = revealId ?? (modeChanged ? selectedId : null);
    if (target && readable) {
      const row = allRows.find(row => row.id === target);
      if (active && row && collapsed.has(patientQueueKey(row))) {
        setCollapsed(current => { const next = new Set(current); next.delete(patientQueueKey(row)); return next; });
        setRevealId(target);
        return;
      }
      const frame = requestAnimationFrame(() => {
        const card = root.current?.querySelector<HTMLElement>(`[data-patient-queue-item="${CSS.escape(target)}"], [data-testid="${CSS.escape(allRows.find(row => row.id === target)?.card.testId ?? "")}"]`);
        card?.scrollIntoView({ block: "nearest" }); capture(); if (revealId) setRevealId(null);
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!modeChanged && area && anchor.current) {
      const card = root.current?.querySelector<HTMLElement>(`[data-patient-queue-item="${CSS.escape(anchor.current.id)}"]`);
      if (card) area.scrollTop += card.getBoundingClientRect().top - area.getBoundingClientRect().top - anchor.current.top;
    }
    capture();
  }, [active, allRows, rows, selectedId, collapsed, revealId, readable, capture, viewport]);
  const hiddenSelection = selectedId && allRows.some(row => row.id === selectedId) && !rows.some(row => row.id === selectedId);
  const chartLabels = patientQueueChartLabels(allRows);
  return <div ref={root} className="contents">
    {!readable ? <EmrQueueEmptyState placement="panel-center" title="업무 대기열을 볼 권한이 없습니다" /> : <>
      {readable && hiddenSelection ? <div role="status" className="emr-text-metadata rounded-md border border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] p-2 text-[var(--emr-status-info-text)]">선택한 업무는 현재 검색·필터에 포함되지 않습니다. <button className="underline" onClick={() => { onClearConditions(); setRevealId(selectedId); }}>조건 해제하고 보기</button></div> : null}
      {active && newIds.length > 0 && readable ? <div role="status" className="emr-text-metadata flex items-center justify-between rounded-md bg-[var(--emr-status-info-bg)] p-2 text-[var(--emr-status-info-text)]"><span>새 업무 {newIds.length}건 추가</span><button className="underline" onClick={() => { const id = newIds[0]; if (!rows.some(row => row.id === id)) onClearConditions(); setRevealId(id); setNewIds([]); }}>목록에서 보기</button></div> : null}
      {active && rows.length ? groups.map(group => {
        const first = group.items[0];
        return <EmrSidePanelCollapsibleGroup key={group.key} dataTestId={`patient-queue-group-${group.key}`} accessibleLabel={`${first.card.patientName} · ${first.card.guardianName}`} collapsed={collapsed.has(group.key)} count={group.items.length} indicatorVisible={false} stateIconState={false} label={<span className="flex min-w-0 items-center gap-1"><Avatar className="size-5 shrink-0"><AvatarFallback className="text-[10px]">{first.card.patientName.slice(0,1)}</AvatarFallback></Avatar><span className="truncate" title={`${first.card.patientName} · ${first.card.guardianName}`}>{first.card.patientName} · {first.card.guardianName}</span>{group.urgentCount ? <span className="shrink-0 text-[10px] text-[var(--emr-status-danger-text)]">긴급 {group.urgentCount}</span> : null}{group.returnedCount ? <span className="shrink-0 text-[10px] text-[var(--emr-status-warning-text)]">재요청 {group.returnedCount}</span> : null}</span>} onToggle={() => setCollapsed(current => { const next = new Set(current); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })}>
          <div className="flex flex-col gap-2 border-l border-[var(--emr-border-default)] pl-2">{group.items.map(row => {
            const chartLabel = chartLabels.get(row.id);
            return <div key={row.id} data-patient-queue-item={row.id}><EmrTaskQueueCard item={{ ...row.card, assigneeName: row.assignedToUserId ? row.card.assigneeName ?? "확인 불가" : row.card.assigneeName }} selected={selectedId === row.id} onSelect={() => onSelect(row.id)} patientView={{ chartLabel, statusLabel: patientQueueStatusLabels[patientQueueStatus(row.status)] ?? "대기", urgent: row.priority === "urgent" }} /></div>;
          })}</div>
        </EmrSidePanelCollapsibleGroup>;
      }) : children}
    </>}
  </div>;
}
