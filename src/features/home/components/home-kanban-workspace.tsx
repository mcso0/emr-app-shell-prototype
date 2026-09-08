"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { ChevronDownIcon, ChevronRightIcon, CircleCloseFillIcon, ClockIcon, UserIcon } from "@/components/icons";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { EmrPageHeader } from "@/components/emr/page-header";
import { EmrDateNavigator } from "@/components/emr/subpanel";
import { EmrTaskQueueCard } from "@/components/emr/task-queue-card";
import { EmrSidePanelTypeBadge } from "@/components/emr/side-panel-card";
import { EmrSidePanelStateIcon } from "@/components/emr/side-panel-state-icon";
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
import { CheckIcon, ListTodoIcon, SendIcon, ClipboardListIcon, EyeIcon, EyeOffIcon, ChevronUpIcon, Columns3Icon, ListIcon, ArrowDownUpIcon } from "lucide-react";
import styles from "./home-workspace-layout.module.css";

const workTypes = [
  { id: "waiting", label: "접수" }, { id: "reservation", label: "예약" },
  { id: "chart", label: "진료" }, { id: "lab", label: "임상병리" },
  { id: "imaging", label: "영상검사" }, { id: "dispensing", label: "조제" },
  { id: "treatment", label: "처치" }, { id: "billing", label: "수납" },
] as const;
const statusGroups: Array<{ id: HomeOperationsProgressState; label: string }> = [
  { id: "in_progress", label: "진행 중" }, { id: "waiting", label: "대기" }, { id: "completed", label: "완료" },
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
      { id: "hospital-group", type: "groupLabel", label: "병원현황" },
      { id: "hospital", type: "button", label: "원내 현황", active: view === "hospital", icon: <ClipboardListIcon />, onClick: () => setView("hospital") },
      { id: "mine", type: "button", label: "내 업무", active: view === "mine", icon: <ListTodoIcon />, onClick: () => setView("mine") },
    ]}
  />;
}

export function HomeKanbanWorkspace({ data, today, loading = false, sourceStatus = "live", errorMessage, onRefresh, patientSummary }: HomeKanbanWorkspaceProps) {
  const router = useRouter();
  const view = useHomeWorkspaceStore((state) => state.view);
  const personalTab = useHomeWorkspaceStore((state) => state.personalTab);
  const query = useHomeWorkspaceStore((state) => state.queries[state.view]);
  const operatingDate = view === "mine" ? today : query.date;
  const preferences = useHomeWorkspaceStore((state) => state.preferences);
  const updateQuery = useHomeWorkspaceStore((state) => state.updateQuery);
  const updatePreferences = useHomeWorkspaceStore((state) => state.updatePreferences);
  const setPersonalTab = useHomeWorkspaceStore((state) => state.setPersonalTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isBoard = view === "hospital" && preferences.layout === "board";
  const scrollKey = `${view}:${view === "hospital" ? preferences.layout : personalTab}`;
  const term = query.search.trim().toLocaleLowerCase();
  const [personalHidden, setPersonalHidden] = useState<Record<string, string[]>>({ assigned: [], requested: [] });
  const hidden = view === "hospital" ? preferences.hidden : personalHidden[personalTab];
  const setHidden = (values: string[]) => view === "hospital" ? updatePreferences({ hidden: values }) : setPersonalHidden((current) => ({ ...current, [personalTab]: values }));
  const visibleTypes = workTypes.filter((type) => !hidden.includes(type.id));
  const hiddenTypes = workTypes.filter((type) => hidden.includes(type.id));
  const scopeTasks = data.hospitalTasks.filter((task) => {
    if (progress(task) === "cancelled" || (!query.includeCompleted && progress(task) === "completed")) return false;
    const date = task.operatingDate || operatingDay(task.dueAt || task.requestedAt);
    if (!(date === operatingDate || (view === "mine" && previous(task, operatingDate)))) return false;
    if (view === "mine") return personalTab === "assigned" ? task.isMyWork === true : task.isRequestedWork === true;
    return true;
  });
  const owners = [...new Set(scopeTasks.flatMap(taskOwners))].sort((a, b) => a.localeCompare(b, "ko"));
  const tasks = scopeTasks.filter((task) =>
    !hidden.includes(task.kanbanColumn) &&
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

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || loading || blocked || !isBoard) return;
    const update = () => setCanScrollRight(element.scrollLeft < element.scrollWidth - element.clientWidth - 2);
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    // Column hiding/collapse changes scrollWidth without necessarily resizing the viewport.
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [loading, blocked, isBoard, preferences.hidden, preferences.collapsed]);

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
  const dateControl = <EmrDateNavigator className={styles.dateControl} dateLabel={query.date} selectedDate={query.date} todayDate={today}
    onDateChange={(date) => updateQuery(view, { date, owners: null })}
    onPrevious={() => updateQuery(view, { date: offsetDate(query.date, -1), owners: null })}
    onNext={() => updateQuery(view, { date: offsetDate(query.date, 1), owners: null })} />;
  const renderListGroup = (type: typeof workTypes[number], items: HomeTask[], prefix: string) => {
    const key = `list:${view}:${prefix}:${type.id}`;
    return <HomeListGroup key={key} id={type.id} label={type.label} tasks={items} date={operatingDate}
      collapsed={collapsed(key)} onToggle={() => toggleGroup(key)} onHide={() => setHidden([...hidden, type.id])} onNavigate={navigate} />;
  };

  return <section className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]" data-testid="home-workspace" aria-busy={loading}>
    <EmrMainContentHeader aria-hidden="true" heightMode="fixed" style={{ height: 56 }} />
    <header className={styles.pageHeader}>
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
      <div className={styles.toolbar}>
        {view === "hospital" ? dateControl : <SegmentedControl className={styles.personalTabs} aria-label="내 업무 구분" value={personalTab} onValueChange={setPersonalTab} variant="tabs" size="md" itemClassName="gap-1.5 aria-pressed:bg-[var(--clair-color-atomic-common-100)] aria-pressed:hover:bg-[var(--clair-color-atomic-common-100)]" items={[{ value: "assigned", label: <><ListTodoIcon className="size-3.5" aria-hidden="true" />내가 해야 할 업무</> }, { value: "requested", label: <><SendIcon className="size-3.5" aria-hidden="true" />내가 요청한 업무</> }]} />}
        <div className={styles.toolbarActions}>
          <HomeSearch key={view} personal={view === "mine"} value={query.search} onChange={(search) => updateQuery(view, { search })} />
          <Button variant="outline" size="sm" className={styles.completedButton} aria-pressed={query.includeCompleted} onClick={() => updateQuery(view, { includeCompleted: !query.includeCompleted })}>
            <CheckIcon aria-hidden="true" />완료 포함
          </Button>
          {view === "hospital" && <>
            <HomeMultiSelect label="담당자" options={owners.map((owner) => ({ id: owner, label: owner }))} values={query.owners ?? owners} allSelected={query.owners === null}
              onChange={(values) => updateQuery("hospital", { owners: values.length === owners.length ? null : values })} />
            <HomeMultiSelect label="업무" options={[...workTypes]} values={visibleTypes.map((type) => type.id)} allSelected={hiddenTypes.length === 0}
              onChange={(values) => updatePreferences({ hidden: workTypes.filter((type) => !values.includes(type.id)).map((type) => type.id) })} />
          </>}
          {view === "hospital" ? <><span className={styles.toolbarDivider} aria-hidden="true" /><SegmentedControl className={styles.viewTabs} aria-label="업무 보기 방식" variant="tabs" size="md" value={preferences.layout} onValueChange={(layout) => { rememberScroll(); updatePreferences({ layout }); }} items={[{ value: "board", label: <><Columns3Icon aria-hidden="true" />칸반</> }, { value: "list", label: <><ListIcon aria-hidden="true" />리스트</> }]} /></> :
            <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="sm"><ArrowDownUpIcon aria-hidden="true" />정렬</Button>} /><DropdownMenuContent align="end"><DropdownMenuItem><CheckIcon aria-hidden="true" />기본 업무 순서</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}

        </div>
      </div>
    </header>
    {sourceStatus === "partial" && <div role="status" className="emr-text-body flex shrink-0 items-center justify-between bg-[var(--emr-status-warning-bg)] px-6 py-2">일부 업무를 불러오지 못했습니다. 표시된 업무만 확인할 수 있습니다.<Button variant="ghost" size="sm" onClick={onRefresh}>다시 시도</Button></div>}
    {blocked ? <EmrEmptyState kind={sourceStatus === "permission_denied" ? "no-permission" : "read-error"} surface="content" title={sourceStatus === "permission_denied" ? "업무를 볼 권한이 없습니다" : "업무를 불러오지 못했습니다"} description={errorMessage} primaryAction={sourceStatus === "error" && onRefresh ? <Button variant="outline" onClick={onRefresh}>다시 시도</Button> : undefined} /> :
      <div className={cn(styles.workspaceBody, (view === "mine" || preferences.layout === "list") && styles.listWorkspaceBody)} data-testid="home-workspace-body">
        <div className={cn(styles.scrollFrame, isBoard && styles.boardScrollFrame)}>
        <div ref={scrollRef} onScroll={rememberScroll} className="h-full min-h-0 min-w-0 overflow-auto" data-testid="home-workspace-scroll">
          {loading ? <div role="status" className="emr-text-body p-6 text-muted-foreground">업무를 불러오는 중입니다.</div> :
          view === "hospital" && preferences.layout === "board" ? <div className={styles.board} data-testid="home-kanban-board" style={{ gridTemplateColumns: visibleTypes.map((type) => collapsed(`column:${type.id}`) ? "52px" : "280px").join(" ") }}>
            {visibleTypes.map((type) => <HomeBoardColumn key={type.id} id={type.id} label={type.label} tasks={tasks.filter((task) => task.kanbanColumn === type.id)} date={operatingDate} collapsed={collapsed(`column:${type.id}`)}
              onToggle={() => toggleGroup(`column:${type.id}`)} onHide={() => updatePreferences({ hidden: [...preferences.hidden, type.id] })}
              isGroupCollapsed={collapsed} onToggleGroup={toggleGroup} onNavigate={navigate} />)}
            {visibleTypes.length === 0 && <EmrEmptyState kind="no-filter-results" surface="content" title="표시할 업무 종류를 선택해 주세요" />}
          </div> : <div className={styles.list} data-testid="home-task-list">
            {view === "hospital" ? visibleTypes.map((type) => renderListGroup(type, tasks.filter((task) => task.kanbanColumn === type.id), "hospital")) : [
              { id: "selected", label: "오늘 할 업무", items: tasks.filter((task) => !previous(task, operatingDate)) },
              { id: "previous", label: "이전 미완료", items: tasks.filter((task) => previous(task, operatingDate)) },
            ].map((period) => <section key={period.id} className={styles.period} aria-label={period.label}>
              <h2 className={styles.periodTitle}>{period.label}<span>{period.items.length}</span></h2>
              {visibleTypes.filter((type) => period.items.some((task) => task.kanbanColumn === type.id)).map((type) => renderListGroup(type, period.items.filter((task) => task.kanbanColumn === type.id), `${personalTab}:${period.id}`))}
              {period.items.length === 0 && <p className="emr-text-body py-4 text-muted-foreground">{term ? "검색 결과가 없습니다" : "해당 업무가 없습니다"}</p>}
            </section>)}
          </div>}
        </div>
        {isBoard && !loading && <div className={styles.scrollFade} data-visible={canScrollRight} data-testid="home-board-scroll-fade" aria-hidden="true" />}
        </div>
        {hiddenTypes.length > 0 && <section className={styles.hiddenWork} aria-label="숨김 업무">
          <header className={cn(styles.groupHeader, styles.hiddenHeader)}><h2>숨김 업무</h2><Button variant="ghost" size="sm" className={styles.showAllButton} onClick={() => setHidden([])}><EyeIcon className="size-3" aria-hidden="true" /><span>전체 표시</span></Button></header>
          <div className={styles.hiddenRows}>{hiddenTypes.map((type) => <div key={type.id} className={styles.hiddenRow}><span>{type.label}</span><Button variant="ghost" size="icon-xs" className={styles.restoreButton} aria-label={`${type.label} 열 표시`} onClick={() => setHidden(hidden.filter((id) => id !== type.id))}><EyeIcon className="size-3.5" aria-hidden="true" /></Button></div>)}</div>
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
  return visible ? <div className="relative w-[280px] min-w-0">
    <CdsActionsSearchIcon aria-hidden="true" className="pointer-events-none absolute left-2 top-2 z-10 size-4 text-muted-foreground" />
    <Input ref={inputRef} autoFocus aria-label={personal ? "내 업무 검색" : "환자 보호자 업무 검색"} placeholder={personal ? "내 업무 검색" : "환자·업무 검색"} value={value} onValueChange={onChange}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); if (value) onChange(""); else close(); } }}
      className="h-8 rounded-lg border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-common-100)] px-2.5 py-1.5 pl-8 pr-8 text-[14px] font-medium leading-5 tracking-[0.196px] shadow-none" />
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
  return <section data-testid={`home-kanban-column-${id}`} className={cn(styles.column, collapsed && styles.collapsedColumn)}>
    {collapsed ? <div className="flex flex-col items-center gap-3 py-3"><Button variant="ghost" size="icon-xs" aria-label={`${label} 열 펼치기`} aria-expanded={false} onClick={onToggle}><ChevronRightIcon /></Button><h2 className="emr-text-body [writing-mode:vertical-rl]">{label}</h2><span className="emr-text-metadata text-muted-foreground">{tasks.length}</span></div> : <>
      <HomeGroupHeader id={id} label={label} count={tasks.length} collapsed={false} onToggle={onToggle} onHide={onHide} column />
      <div ref={scrollRef} className={styles.columnBody} onScroll={(event) => useHomeWorkspaceStore.getState().rememberScroll(`column:${id}`, { top: event.currentTarget.scrollTop, left: 0 })}>
        {statusGroups.filter((group) => tasks.some((task) => progress(task) === group.id)).map((group) => {
          const key = `status:${id}:${group.id}`; const items = tasks.filter((task) => progress(task) === group.id);
          return <section key={key} data-testid={`home-kanban-status-${id}-${group.id}`}>
            <button type="button" className={styles.statusHeader} aria-label={`${label} ${group.label}`} aria-expanded={!isGroupCollapsed(key)} onClick={() => onToggleGroup(key)}><EmrSidePanelStateIcon state={group.id === "completed" ? "done" : group.id === "in_progress" ? "in-progress" : "to-do"} /><span>{group.label}</span><span className={styles.count}>{items.length}</span>{isGroupCollapsed(key) ? <ChevronDownIcon /> : <ChevronUpIcon />}</button>
            {!isGroupCollapsed(key) && <div className={styles.cards}>
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
            </div>}
          </section>;
        })}
        {tasks.length === 0 && <p className="emr-text-metadata px-2 py-5 text-center text-muted-foreground">표시할 업무가 없습니다.</p>}
      </div>
    </>}
  </section>;
}

function HomeGroupHeader({ id, label, count, collapsed, onToggle, onHide, column = false }: {
  id: string; label: string; count: number; collapsed: boolean; onToggle: () => void; onHide: () => void; column?: boolean;
}) {
  return <header className={cn(styles.groupHeader, !collapsed && styles.dividedHeader)}>
    <h2><HomeWorkTypeIcon id={id} />{label}<span>{count}</span></h2>
    <div className={styles.groupActions}>
      <Button variant="ghost" size="icon-xs" aria-label={`${label} ${column ? "열" : "업무 목록"} 숨기기`} onClick={onHide}><EyeOffIcon /></Button>
      <Button variant="ghost" size="icon-xs" aria-label={`${label} ${column ? `열 ${collapsed ? "펼치기" : "접기"}` : "업무 목록"}`} aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}</Button>
    </div>
  </header>;
}

function requestTime(task: HomeTask) {
  const time = new Date(task.requestedAt);
  return Number.isNaN(time.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit", hour12: true }).format(time);
}

function HomeListGroup({ id, label, tasks, date, collapsed, onToggle, onHide, onNavigate }: {
  id: string; label: string; tasks: HomeTask[]; date: string; collapsed: boolean; onToggle: () => void; onHide: () => void; onNavigate: (task: HomeTask) => void;
}) {
  return <section className={styles.listGroup} data-testid={`home-list-group-${id}`}>
    <HomeGroupHeader id={id} label={label} count={tasks.length} collapsed={collapsed} onToggle={onToggle} onHide={onHide} />
    {!collapsed && <div role="table" aria-label={`${label} 업무 목록`} className={styles.rows}>
      <div role="row" className="sr-only">{["상태", "환자 / 보호자", "내원 유형", "업무 종류", "세부 업무", "요청 시각", "담당자"].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}</div>
      {tasks.map((task) => <div role="row" tabIndex={0} key={task.id} className={styles.row} aria-label={`${task.patientName} ${task.title}`}
        onClick={() => onNavigate(task)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onNavigate(task); } }}>
        <div role="cell"><HomeTaskState task={task} /></div>
        <div role="cell" className={styles.identity} title={`${task.patientName || "환자 미지정"} · ${task.clientName || "보호자 미지정"}`}><strong>{task.patientName || "환자 미지정"}</strong><span>· {task.clientName || "보호자 미지정"}</span></div>
        <div role="cell"><EmrSidePanelTypeBadge label={task.receptionType || "외래"} /></div>
        <div role="cell">{typeLabel(task)}</div>
        <div role="cell" className={styles.taskDescription}><span title={task.queueCardSecondLineText || task.title}>{task.queueCardSecondLineText || task.title}</span><HomeTaskSignals task={task} date={date} /></div>
        <div role="cell" className={styles.secondary} title={`${task.requestedAt} · ${elapsed(task)} 경과`}><ClockIcon aria-hidden="true" /><span>{requestTime(task)}</span></div>
        <div role="cell" className={styles.secondary} title={taskOwners(task).join(", ")}><UserIcon aria-hidden="true" /><span>{taskOwners(task).join(", ")}</span></div>
        <div className={styles.rowAction}><Button variant="outline" size="xs" onClick={(event) => { event.stopPropagation(); onNavigate(task); }}>업무보러가기<ChevronRightIcon aria-hidden="true" /></Button></div>
      </div>)}
      {tasks.length === 0 && <p className="emr-text-body py-4 text-muted-foreground">해당 업무가 없습니다</p>}
    </div>}
  </section>;
}
