"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { CdsFilesGridIcon, CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { ChevronDownIcon, ChevronRightIcon, CircleCloseFillIcon, MenuIcon } from "@/components/icons";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { EmrPageHeader } from "@/components/emr/page-header";
import { EmrDateNavigator } from "@/components/emr/subpanel";
import { EmrTaskQueueCard } from "@/components/emr/task-queue-card";
import { EmrSidePanelCollapsibleGroup } from "@/components/emr/side-panel-collapsible-group";
import { EmrSidePanelStateIcon } from "@/components/emr/side-panel-state-icon";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrModuleListSidePanel } from "@/components/emr/module-list-side-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useLayoutStore } from "@/stores/layout-store";
import { useHomeWorkspaceStore } from "@/features/home/home-workspace-store";
import type { HomeDashboardData, HomeTask, HomeOperationsProgressState } from "@/features/home/home.types";
import { cn } from "@/lib/utils";
import { moduleIconById } from "@/shell/module-nav-icons";
import { CheckIcon, ListTodoIcon, SendIcon } from "lucide-react";

const workTypes = [
  { id: "waiting", label: "접수" }, { id: "reservation", label: "예약" },
  { id: "chart", label: "진료" }, { id: "lab", label: "임상병리" },
  { id: "imaging", label: "영상검사" }, { id: "dispensing", label: "조제" },
  { id: "treatment", label: "처치" }, { id: "billing", label: "수납" },
] as const;
const statusGroups: Array<{ id: HomeOperationsProgressState; label: string }> = [
  { id: "waiting", label: "대기" }, { id: "in_progress", label: "진행 중" }, { id: "completed", label: "완료" },
];
const typeLabel = (task: HomeTask) => workTypes.find((type) => type.id === task.kanbanColumn)?.label ?? task.sourceLabel;
const taskOwners = (task: HomeTask) => task.assigneeNames?.length ? task.assigneeNames : [ownerLabel(task)];
const ownerLabel = (task: HomeTask) => task.assigneeName || (task.assigneeUserId || task.assigneeUserIds?.length ? "담당자 지정됨" : "미배정");
function progress(task: HomeTask): HomeOperationsProgressState {
  if (task.progressState) return task.progressState;
  if (task.status === "completed" || task.status === "cancelled") return task.status;
  return task.status === "in_progress" || task.status === "inProgress" ? "in_progress" : "waiting";
}
function operatingDay(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function previous(task: HomeTask, date: string) {
  return progress(task) !== "completed" && progress(task) !== "cancelled" && (task.operatingDate || operatingDay(task.dueAt || task.requestedAt)) < date;
}
function elapsed(task: HomeTask) {
  const timestamp = Date.parse(task.stateEnteredAt || task.requestedAt);
  if (!Number.isFinite(timestamp)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  return minutes >= 1440 ? `${Math.floor(minutes / 1440)}일` : minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}
function offsetDate(date: string, amount: number) {
  const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + amount); return day.toISOString().slice(0, 10);
}
function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export type HomePatientSummary = { present: number; waiting: number; inProgress: number };
type HomeKanbanWorkspaceProps = {
  data: HomeDashboardData;
  today: string;
  loading?: boolean;
  sourceStatus?: "empty" | "error" | "live" | "partial" | "permission_denied";
  errorMessage?: string;
  onRefresh?: () => void;
  patientSummary?: HomePatientSummary | null;
};

export function HomeNavigationSidePanel() {
  const view = useHomeWorkspaceStore((state) => state.view);
  const setView = useHomeWorkspaceStore((state) => state.setView);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  return <EmrModuleListSidePanel
    title="홈"
    testId="home-navigation-side-panel"
    collapseLabel="홈 패널 접기"
    onCollapse={() => setModulePanelOpen(false)}
    openSectionIds={new Set()}
    onToggleSection={() => undefined}
    items={[
      { id: "hospital", type: "button", label: "원내 현황", active: view === "hospital", icon: <CdsFilesGridIcon />, onClick: () => setView("hospital") },
      { id: "mine", type: "button", label: "내 업무", active: view === "mine", icon: <MenuIcon />, onClick: () => setView("mine") },
      { id: "inbox", type: "button", label: "인박스", disabled: true, disabledBadgeLabel: "예정" },
      { id: "messages", type: "button", label: "메시지", disabled: true, disabledBadgeLabel: "예정" },
    ]}
  />;
}

export function HomeKanbanWorkspace({ data, today, loading = false, sourceStatus = "live", errorMessage, onRefresh, patientSummary }: HomeKanbanWorkspaceProps) {
  const router = useRouter();
  const view = useHomeWorkspaceStore((state) => state.view);
  const personalTab = useHomeWorkspaceStore((state) => state.personalTab);
  const query = useHomeWorkspaceStore((state) => state.queries[state.view]);
  const preferences = useHomeWorkspaceStore((state) => state.preferences);
  const updateQuery = useHomeWorkspaceStore((state) => state.updateQuery);
  const updatePreferences = useHomeWorkspaceStore((state) => state.updatePreferences);
  const setPersonalTab = useHomeWorkspaceStore((state) => state.setPersonalTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollKey = `${view}:${view === "hospital" ? preferences.layout : personalTab}`;
  const term = query.search.trim().toLocaleLowerCase();
  const owners = [...new Set(data.hospitalTasks.flatMap(taskOwners))].sort((a, b) => a.localeCompare(b, "ko"));
  const visibleTypes = workTypes.filter((type) => !preferences.hidden.includes(type.id));
  const hiddenTypes = workTypes.filter((type) => preferences.hidden.includes(type.id));
  const scopeTasks = data.hospitalTasks.filter((task) => {
    if (progress(task) === "cancelled" || (!query.includeCompleted && progress(task) === "completed")) return false;
    const date = task.operatingDate || operatingDay(task.dueAt || task.requestedAt);
    if (!(date === query.date || previous(task, query.date))) return false;
    if (view === "mine") return personalTab === "assigned" ? task.isMyWork === true : task.isRequestedWork === true;
    return true;
  });
  const tasks = scopeTasks.filter((task) =>
    (view !== "hospital" || (!preferences.hidden.includes(task.kanbanColumn) && (query.owners === null || taskOwners(task).some((owner) => query.owners?.includes(owner))))) &&
    (!term || [task.patientName, task.clientName, task.title, task.sourceLabel, task.assigneeName].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)),
  );
  const blocked = sourceStatus === "error" || sourceStatus === "permission_denied";

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || loading) return;
    const saved = useHomeWorkspaceStore.getState().scroll[scrollKey];
    if (saved) { element.scrollLeft = saved.left; element.scrollTop = saved.top; }
  }, [scrollKey, loading]);

  function rememberScroll() {
    const element = scrollRef.current;
    if (element) useHomeWorkspaceStore.getState().rememberScroll(scrollKey, { left: element.scrollLeft, top: element.scrollTop });
  }
  function navigate(task: HomeTask) {
    rememberScroll();
    router.push(task.actionHref);
  }
  function toggleGroup(key: string) { updatePreferences({ collapsed: toggleValue(preferences.collapsed, key) }); }
  const collapsed = (key: string) => preferences.collapsed.includes(key);
  const reset = () => { updateQuery("hospital", { owners: null }); updatePreferences({ hidden: [] }); };
  const hasFilters = view === "hospital" && (query.owners !== null || hiddenTypes.length > 0);

  return <section className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]" data-testid="home-workspace" aria-busy={loading}>
    <EmrMainContentHeader aria-hidden="true" heightMode="adaptive" />
    <header className="flex min-h-[108px] shrink-0 flex-col gap-3 bg-[var(--emr-surface-workspace)] px-12 py-4">
      <EmrPageHeader
        className="min-h-8 gap-3"
        titleClassName="text-[24px] font-bold leading-8 tracking-[-0.552px] text-[var(--clair-color-atomic-neutral-900)]"
        title={view === "hospital" ? "원내 현황" : "내 업무"}
        badge={<Badge variant="secondary" aria-label="표시 업무 수" className="h-7 min-w-5 rounded-md bg-[var(--clair-color-atomic-black-alpha-4)] px-2 py-0 text-[16px] font-medium leading-6 tracking-[0.096px] text-[var(--clair-color-atomic-neutral-900)]">{loading ? "…" : blocked ? "—" : tasks.length}</Badge>}
        actions={view === "hospital" ? <div className="emr-text-metadata flex flex-wrap items-center gap-2 text-[var(--emr-text-secondary)]" aria-label="현재 병원 환자 현황">
          <span>원내 {patientSummary?.present ?? "—"}마리</span><span aria-hidden="true">·</span>
          <span>진료 대기 {patientSummary?.waiting ?? "—"}마리</span><span aria-hidden="true">·</span>
          <span>진료 중 {patientSummary?.inProgress ?? "—"}마리</span>
        </div> : undefined}
      />
      {view === "mine" && <SegmentedControl aria-label="내 업무 구분" value={personalTab} onValueChange={setPersonalTab} variant="tabs" size="md" itemClassName="gap-1.5 aria-pressed:bg-[var(--clair-color-atomic-common-100)] aria-pressed:hover:bg-[var(--clair-color-atomic-common-100)]" items={[{ value: "assigned", label: <><ListTodoIcon className="size-3.5" aria-hidden="true" />내가 해야 할 업무</> }, { value: "requested", label: <><SendIcon className="size-3.5" aria-hidden="true" />내가 요청한 업무</> }]} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <EmrDateNavigator className="h-8 gap-1.5 px-0 [&>button]:h-8 [&>button]:rounded-lg [&>button[aria-label='이전_날짜']]:order-2 [&>button[aria-label='다음_날짜']]:order-3 [&>button[aria-label$='날짜_선택']]:justify-start [&>button[aria-label$='날짜_선택']]:pl-0" dateLabel={query.date} selectedDate={query.date} todayDate={today}
            onDateChange={(date) => updateQuery(view, { date })}
            onPrevious={() => updateQuery(view, { date: offsetDate(query.date, -1) })}
            onNext={() => updateQuery(view, { date: offsetDate(query.date, 1) })}
          />
          {query.date !== today && <Button variant="ghost" size="sm" onClick={() => updateQuery(view, { date: today })}>오늘</Button>}
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-3">
          <HomeSearch key={view} personal={view === "mine"} value={query.search} onChange={(search) => updateQuery(view, { search })} />
          <Button variant="outline" size="sm" aria-pressed={query.includeCompleted} onClick={() => updateQuery(view, { includeCompleted: !query.includeCompleted })}>
            <CheckIcon aria-hidden="true" />완료 포함
          </Button>
          {view === "hospital" && <>
            <HomeMultiSelect label="담당자" options={owners.map((owner) => ({ id: owner, label: owner }))} values={query.owners ?? owners} allSelected={query.owners === null}
              onChange={(values) => updateQuery("hospital", { owners: values.length === owners.length ? null : values })} />
            <HomeMultiSelect label="업무" options={[...workTypes]} values={visibleTypes.map((type) => type.id)} allSelected={hiddenTypes.length === 0}
              onChange={(values) => updatePreferences({ hidden: workTypes.filter((type) => !values.includes(type.id)).map((type) => type.id) })} />
          </>}
          {hasFilters && <Button variant="ghost" size="sm" onClick={reset}>필터 해제</Button>}
          {view === "hospital" && <SegmentedControl aria-label="업무 보기 방식" variant="tabs" size="md" value={preferences.layout} onValueChange={(layout) => { rememberScroll(); updatePreferences({ layout }); }} items={[{ value: "board", label: "보드" }, { value: "list", label: "리스트" }]} />}
        </div>
      </div>
    </header>
    {sourceStatus === "partial" && <div role="status" className="emr-text-body flex shrink-0 items-center justify-between bg-[var(--emr-status-warning-bg)] px-6 py-2">일부 업무를 불러오지 못했습니다. 표시된 업무만 확인할 수 있습니다.<Button variant="ghost" size="sm" onClick={onRefresh}>다시 시도</Button></div>}
    {blocked ? <EmrEmptyState kind={sourceStatus === "permission_denied" ? "no-permission" : "read-error"} surface="content" title={sourceStatus === "permission_denied" ? "업무를 볼 권한이 없습니다" : "업무를 불러오지 못했습니다"} description={errorMessage} primaryAction={sourceStatus === "error" && onRefresh ? <Button variant="outline" onClick={onRefresh}>다시 시도</Button> : undefined} /> :
      <div className="flex min-h-0 flex-1 gap-3 p-6">
        <div ref={scrollRef} onScroll={rememberScroll} className="min-h-0 min-w-0 flex-1 overflow-auto" data-testid="home-workspace-scroll">
          {loading ? <div role="status" className="emr-text-body p-6 text-muted-foreground">업무를 불러오는 중입니다.</div> :
          view === "hospital" && preferences.layout === "board" ? <div className="grid h-full min-h-64 content-stretch items-start gap-3" data-testid="home-kanban-board" style={{ gridTemplateColumns: visibleTypes.map((type) => collapsed(`column:${type.id}`) ? "52px" : "minmax(240px, 1fr)").join(" ") }}>
            {visibleTypes.map((type) => <HomeBoardColumn key={type.id} id={type.id} label={type.label} tasks={tasks.filter((task) => task.kanbanColumn === type.id)} date={query.date} collapsed={collapsed(`column:${type.id}`)}
              onToggle={() => toggleGroup(`column:${type.id}`)} onHide={() => updatePreferences({ hidden: [...preferences.hidden, type.id] })}
              isGroupCollapsed={collapsed} onToggleGroup={toggleGroup} onNavigate={navigate} />)}
            {visibleTypes.length === 0 && <EmrEmptyState kind="no-filter-results" surface="content" title="표시할 업무 종류를 선택해 주세요" />}
          </div> : <div className="space-y-5" data-testid="home-task-list">
            {(view === "hospital" ? visibleTypes.map((type) => ({ id: type.id, label: type.label, items: tasks.filter((task) => task.kanbanColumn === type.id) })) : personalTab === "assigned" ? [
              { id: "previous", label: "이전 미완료", items: tasks.filter((task) => previous(task, query.date)) },
              { id: "selected", label: query.date === today ? "오늘 할 업무" : "선택일 업무", items: tasks.filter((task) => !previous(task, query.date)) },
            ] : statusGroups.filter((group) => group.id !== "completed" || query.includeCompleted).map((group) => ({ id: group.id, label: group.label, items: tasks.filter((task) => progress(task) === group.id) }))).map((group) => {
              const key = `list:${view}:${group.id}`;
              return <EmrSidePanelCollapsibleGroup key={key} label={<span className="inline-flex items-center gap-2">{view === "hospital" && <HomeWorkTypeIcon id={group.id} />}{group.label}</span>} accessibleLabel={`${group.label} 업무 목록`} count={group.items.length} collapsed={collapsed(key)} onToggle={() => toggleGroup(key)} indicatorVisible={false} stateIconState={false}
                className="rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)]" contentClassName="gap-0">
                {group.items.length ? <HomeWorkTable tasks={group.items} personal={view === "mine"} date={query.date} onNavigate={navigate} /> : <EmrEmptyState kind={term ? "no-search-results" : scopeTasks.length ? "no-filter-results" : "no-data"} surface="table" density="compact" size="sm" title={term ? "검색 결과가 없습니다" : "해당 업무가 없습니다"} />}
              </EmrSidePanelCollapsibleGroup>;
            })}
          </div>}
        </div>
        {view === "hospital" && hiddenTypes.length > 0 && <section className="h-fit w-40 shrink-0 rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] p-2" aria-label="숨김 업무">
          <div className="emr-text-metadata flex items-center justify-between gap-1 whitespace-nowrap"><strong>숨김 업무 {hiddenTypes.length}</strong><Button className="px-1" variant="ghost" size="xs" onClick={() => updatePreferences({ hidden: [] })}>모두 표시</Button></div>
          {hiddenTypes.map((type) => <div key={type.id} className="emr-text-body flex items-center justify-between gap-2 py-1"><span>{type.label}</span><Button variant="ghost" size="xs" aria-label={`${type.label} 열 표시`} onClick={() => updatePreferences({ hidden: preferences.hidden.filter((id) => id !== type.id) })}>표시</Button></div>)}
        </section>}
      </div>}
  </section>;
}

function HomeWorkTypeIcon({ id }: { id: string }) {
  const moduleId = id === "waiting" || id === "reservation" ? "reception" : id === "chart" ? "treatment" : id;
  const definition = moduleIconById[moduleId];
  if (!definition) return null;
  const Icon = definition.icon;
  return <span className="inline-flex size-3.5 shrink-0 items-center justify-center" aria-hidden="true"><Icon className={cn("size-3.5", moduleId === "lab" && "rotate-45 !scale-[0.7071]")} /></span>;
}

function HomeSearch({ personal, value, onChange }: { personal: boolean; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(Boolean(value));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visible = open || Boolean(value);
  const close = () => { setOpen(false); requestAnimationFrame(() => buttonRef.current?.focus()); };
  return visible ? <div className="relative w-52 min-w-0">
    <Input ref={inputRef} autoFocus aria-label={personal ? "내 업무 검색" : "환자 보호자 업무 검색"} placeholder={personal ? "내 업무 검색" : "환자·업무 검색"} value={value} onValueChange={onChange}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); if (value) onChange(""); else close(); } }}
      className="h-8 rounded-lg border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-common-100)] px-2.5 py-1.5 pr-8 text-[14px] font-medium leading-5 tracking-[0.196px] shadow-none" />
    <Button variant="ghost" size="icon-xs" className="absolute right-1 top-1" aria-label={value ? "검색어 지우기" : "검색 닫기"}
      onClick={() => { if (value) { onChange(""); inputRef.current?.focus(); } else close(); }}><CircleCloseFillIcon className="size-4" /></Button>
  </div> : <Button ref={buttonRef} variant="outline" size="sm" aria-expanded={false} onClick={() => setOpen(true)}><CdsActionsSearchIcon aria-hidden="true" />검색</Button>;
}

function HomeMultiSelect({ label, options, values, allSelected, onChange }: { label: string; options: Array<{ id: string; label: string }>; values: string[]; allSelected: boolean; onChange: (values: string[]) => void }) {
  const text = allSelected ? `${label} 전체` : values.length === 0 ? `${label} 선택 없음` : values.length === 1 ? options.find((option) => option.id === values[0])?.label || values[0] : `${label} ${values.length}개`;
  return <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 min-h-8 min-w-24 gap-1 rounded-lg px-3 py-1.5 shadow-[var(--clair-shadow-xs)]" aria-label={`${label} 다중 선택`}>{text}<ChevronDownIcon className="size-3" /></Button>} />
    <DropdownMenuContent align="end" className="w-52 p-2">
      <div className="flex justify-between border-b border-border pb-1"><Button size="xs" variant="ghost" onClick={() => onChange(options.map((option) => option.id))}>전체 선택</Button><Button size="xs" variant="ghost" onClick={() => onChange([])}>선택 해제</Button></div>
      <div className="max-h-64 overflow-auto" role="group" aria-label={`${label} 선택`}>
        {options.map((option) => <label key={option.id} className="emr-text-body flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-[var(--emr-state-hover)]"><Checkbox aria-label={`${option.label} 선택`} checked={values.includes(option.id)} onCheckedChange={() => onChange(toggleValue(values, option.id))} />{option.label}</label>)}
      </div>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function HomeTaskSignals({ task, date }: { task: HomeTask; date: string }) {
  return <div className="flex flex-wrap items-center gap-1">
    {previous(task, date) && <Badge variant="secondary" className="emr-text-metadata">이전 미완료</Badge>}
    {task.attentionSignals?.includes("urgent") && <Badge variant="destructive" className="emr-text-metadata">긴급 요청</Badge>}
    {task.attentionSignals?.includes("re_requested") && <Badge variant="secondary" className="emr-text-metadata">재요청</Badge>}
  </div>;
}
function HomeTaskState({ task }: { task: HomeTask }) {
  const state = progress(task);
  return <span className="emr-text-body inline-flex items-center gap-1.5 whitespace-nowrap text-[var(--emr-text-secondary)]"><EmrSidePanelStateIcon state={state === "completed" ? "done" : state === "in_progress" ? "in-progress" : "to-do"} />{statusGroups.find((group) => group.id === state)?.label ?? "취소"}</span>;
}
function HomeBoardColumn({ id, label, tasks, date, collapsed, onToggle, onHide, isGroupCollapsed, onToggleGroup, onNavigate }: {
  id: string; label: string; tasks: HomeTask[]; date: string; collapsed: boolean; onToggle: () => void; onHide: () => void;
  isGroupCollapsed: (key: string) => boolean; onToggleGroup: (key: string) => void; onNavigate: (task: HomeTask) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scrollRef.current; const saved = useHomeWorkspaceStore.getState().scroll[`column:${id}`];
    if (element && saved) element.scrollTop = saved.top;
  }, [id, collapsed]);
  return <section data-testid={`home-kanban-column-${id}`} className={cn("group/column flex min-h-0 flex-col overflow-hidden rounded-[var(--emr-radius-control)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)]", collapsed ? "h-fit" : "h-full")}>
    {collapsed ? <div className="flex flex-col items-center gap-3 py-3"><Button variant="ghost" size="icon-xs" aria-label={`${label} 열 펼치기`} aria-expanded={false} onClick={onToggle}><ChevronRightIcon /></Button><h2 className="emr-text-body [writing-mode:vertical-rl]">{label}</h2><span className="emr-text-metadata text-muted-foreground">{tasks.length}</span></div> : <>
      <header className="flex h-12 shrink-0 items-center justify-between gap-1 border-b border-[var(--emr-border-default)] px-3">
        <h2 className="emr-text-section flex items-center gap-2"><HomeWorkTypeIcon id={id} />{label}<span className="emr-text-metadata text-[var(--emr-text-tertiary)]">{tasks.length}</span></h2>
        <div className="flex items-center opacity-0 transition-opacity group-hover/column:opacity-100 group-focus-within/column:opacity-100 has-[[data-popup-open]]:opacity-100 [@media(hover:none)]:opacity-100">
          <Button variant="ghost" size="icon-xs" aria-label={`${label} 열 접기`} aria-expanded={true} onClick={onToggle}><ChevronRightIcon className="rotate-180" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label={`${label} 열 메뉴`} />} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <CdsFilesMoreHorizontalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="h-8 cursor-pointer justify-start px-2.5 py-1.5" onClick={(event) => { event.stopPropagation(); onHide(); }}>
                <span className="emr-text-dense w-full truncate font-medium">이 업무 열 숨기기</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2" onScroll={(event) => useHomeWorkspaceStore.getState().rememberScroll(`column:${id}`, { top: event.currentTarget.scrollTop, left: 0 })}>
        {statusGroups.filter((group) => tasks.some((task) => progress(task) === group.id)).map((group) => {
          const key = `status:${id}:${group.id}`; const items = tasks.filter((task) => progress(task) === group.id);
          return <EmrSidePanelCollapsibleGroup key={key} label={group.label} accessibleLabel={`${label} ${group.label}`} count={items.length} collapsed={isGroupCollapsed(key)} onToggle={() => onToggleGroup(key)} indicatorVisible={false} stateIconState={false} dataTestId={`home-kanban-status-${id}-${group.id}`}>
            {items.map((task) => <div key={task.id} className="space-y-1">
              <EmrTaskQueueCard selected={false} item={{
                patientName: task.patientName || "환자 미지정", guardianName: task.clientName || "보호자 미지정", receptionType: task.receptionType || "외래",
                secondLineText: task.queueCardSecondLineText || task.title, secondLineBadgeLabel: task.queueCardSecondLineBadgeLabel,
                assigneeName: ownerLabel(task), eventActorName: task.requestedBy || "", eventTime: "", eventText: task.queueCardEventText || `${elapsed(task)} 경과`,
                actionAriaLabel: `${task.patientName || "환자"} ${label} 업무 메뉴`, actionMenuDensity: "compact",
                actionItems: [{ key: "source", label: `${label} 화면으로 이동`, onSelect: () => onNavigate(task) }], testId: `home-kanban-task-${task.id}`,
              }} />
              <HomeTaskSignals task={task} date={date} />
            </div>)}
          </EmrSidePanelCollapsibleGroup>;
        })}
        {tasks.length === 0 && <p className="emr-text-metadata px-2 py-5 text-center text-muted-foreground">표시할 업무가 없습니다.</p>}
      </div>
    </>}
  </section>;
}

function HomeWorkTable({ tasks, personal, date, onNavigate }: { tasks: HomeTask[]; personal: boolean; date: string; onNavigate: (task: HomeTask) => void }) {
  const columns = useMemo<Array<ColumnDef<HomeTask>>>(() => [
    { id: "patient", meta: { label: "환자 / 보호자" }, size: 170, cell: ({ row }) => <span className="flex items-center gap-2"><strong>{row.original.patientName || "환자 미지정"}</strong><span className="emr-text-metadata text-muted-foreground">{row.original.clientName}</span></span> },
    ...(personal ? [{ id: "type", meta: { label: "업무 종류" }, size: 100, cell: ({ row }: { row: { original: HomeTask } }) => <Badge variant="secondary" className="whitespace-nowrap">{typeLabel(row.original)}</Badge> }] : []),
    { id: "task", meta: { label: personal ? "세부 업무" : "업무" }, size: 300, cell: ({ row }) => <div className="flex flex-wrap items-center gap-2"><span>{row.original.queueCardSecondLineText || row.original.title}</span><HomeTaskSignals task={row.original} date={date} /></div> },
    { id: "state", meta: { label: "상태" }, size: 110, cell: ({ row }) => <HomeTaskState task={row.original} /> },
    { id: "owner", meta: { label: "담당자" }, size: 100, cell: ({ row }) => ownerLabel(row.original) },
    { id: "time", meta: { label: "경과" }, size: 95, cell: ({ row }) => elapsed(row.original) },
  ], [date, personal]);
  // TanStack owns mutable table state; React Compiler must not memoize this API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: tasks, columns, getCoreRowModel: getCoreRowModel(), getRowId: (task) => task.id, defaultColumn: { enableSorting: false, meta: { resize: "none" } } });
  return <EmrDataTable table={table} aria-label={personal ? "내 업무 목록" : "원내 업무 목록"} viewportMode="content" density="standard" rowOverlayWidth={200}
    getRowProps={(row) => ({ onClick: () => onNavigate(row.original), "aria-label": `${row.original.patientName} ${row.original.title}` })}
    getRowOverlayAriaLabel={(row) => `${row.original.patientName} 업무 이동`}
    renderRowOverlay={({ row }) => <Button variant="outline" size="sm" onClick={() => onNavigate(row.original)}>{typeLabel(row.original)} 화면으로 이동</Button>}
  />;
}
