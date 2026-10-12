"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useModuleSidePanel } from "@/components/emr/module-side-panel-context";
import { createPortal } from "react-dom";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { ChevronDownIcon, ChevronRightIcon, CircleCloseFillIcon, ClockIcon, UserIcon } from "@/components/icons";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { EmrPageHeader } from "@/components/emr/page-header";
import { EmrDateNavigator } from "@/components/emr/subpanel";
import { EmrTaskQueueCard } from "@/components/emr/task-queue-card";
import { EmrSidePanelTypeBadge } from "@/components/emr/side-panel-card";
import { EmrSidePanelStateIcon } from "@/components/emr/side-panel-state-icon";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrFilterToggle } from "@/components/emr/filter-toggle";
import { EmrModuleListSidePanel } from "@/components/emr/module-list-side-panel";
import { Badge } from "@/components/ui/badge";
import { AnimalPatientAvatar } from "@/components/emr/animal-patient-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
import { EmrTableFilterTrigger } from "@/components/emr/table-filter-trigger";
import { filterRowsByEmrTableFilterBuilder, getEmrTableFilterBuilderActiveCount, type EmrTableFilterBuilderField } from "@/components/emr/table-filter-builder-model";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollBar } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useLayoutStore } from "@/stores/layout-store";
import { useHomeWorkspaceStore } from "@/features/home/home-workspace-store";
import { compareHospitalTasks, countHospitalWorkTypes, getHospitalStatus, hospitalStatuses, type HospitalStatus, type HospitalSort } from "@/features/home/home-hospital-presentation";
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
function hospitalDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? `${String(year).slice(-2)}년 ${month}월 ${day}일` : date;
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
  const panelPresentation = useModuleSidePanel();
  const enterHome = () => {
    if (panelPresentation && !panelPresentation.isCurrentModule) {
      panelPresentation.onNavigate(`${panelPresentation.pathname}?${panelPresentation.search}`, "home");
    }
  };
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
      { id: "hospital", type: "button", label: "원내 현황", active: view === "hospital", icon: <ClipboardListIcon />, onClick: () => { setView("hospital"); enterHome(); } },
      { id: "mine", type: "button", label: "내 업무", active: view === "mine", icon: <ListTodoIcon />, onClick: () => { setView("mine"); enterHome(); } },
    ]}
  />;
}

export function HomeKanbanWorkspace({ data, today, loading = false, sourceStatus = "live", errorMessage, onRefresh, patientSummary }: HomeKanbanWorkspaceProps) {
  const router = useRouter();
  const view = useHomeWorkspaceStore((state) => state.view);
  const personalTab = useHomeWorkspaceStore((state) => state.personalTab);
  const query = useHomeWorkspaceStore((state) => state.queries[state.view]);
  const filterModel = useHomeWorkspaceStore((state) => state.filters[state.view]);
  const updateFilter = useHomeWorkspaceStore((state) => state.updateFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterReady, setFilterReady] = useState(false);
  const [filterAutoOpenConsumed, setFilterAutoOpenConsumed] = useState(false);
  const operatingDate = view === "mine" ? today : query.date;
  const preferences = useHomeWorkspaceStore((state) => state.preferences);
  const updateQuery = useHomeWorkspaceStore((state) => state.updateQuery);
  const updatePreferences = useHomeWorkspaceStore((state) => state.updatePreferences);
  const setPersonalTab = useHomeWorkspaceStore((state) => state.setPersonalTab);
  const hospitalWorkType = useHomeWorkspaceStore((state) => state.hospitalWorkType);
  const setHospitalWorkType = useHomeWorkspaceStore((state) => state.setHospitalWorkType);
  const hospitalSort = useHomeWorkspaceStore((state) => state.hospitalSort);
  const setHospitalSort = useHomeWorkspaceStore((state) => state.setHospitalSort);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isBoard = view === "hospital" && preferences.layout === "board";
  const scrollKey = `${view}:${view === "hospital" ? preferences.layout : personalTab}`;
  const term = query.search.trim().toLocaleLowerCase();
  const [personalHidden, setPersonalHidden] = useState<Record<string, string[]>>({ assigned: [], requested: [] });
  const hidden = personalHidden[personalTab];
  const setHidden = (values: string[]) => setPersonalHidden((current) => ({ ...current, [personalTab]: values }));
  const visibleTypes = workTypes.filter((type) => !hidden.includes(type.id));
  const hiddenTypes = workTypes.filter((type) => hidden.includes(type.id));
  const hiddenStatuses = hospitalStatuses.filter((status) => preferences.hiddenStatuses.includes(status.id));
  const visibleStatuses = hospitalStatuses.filter((status) => !preferences.hiddenStatuses.includes(status.id));
  const scopeTasks = data.hospitalTasks.filter((task) => {
    if ((progress(task) === "cancelled" && !query.includeCancelled) || (!query.includeCompleted && progress(task) === "completed")) return false;
    const date = task.operatingDate || operatingDay(task.dueAt || task.requestedAt);
    if (!(date === operatingDate || (view === "mine" && previous(task, operatingDate)))) return false;
    if (view === "mine") return personalTab === "assigned" ? task.isMyWork === true : task.isRequestedWork === true;
    return true;
  });
  const owners = [...new Set(scopeTasks.flatMap(taskOwners))].sort((a, b) => a.localeCompare(b, "ko"));
  const filterFields: Array<EmrTableFilterBuilderField<HomeTask>> = [
    { id: "owner", label: "담당자", getValue: taskOwners, operators: [{ id: "is", label: "같음" }], options: owners.map((owner) => ({ value: owner, label: owner })) },
    { id: "workType", label: "업무", getValue: (task) => task.kanbanColumn, operators: [{ id: "is", label: "같음" }], options: workTypes.map((type) => ({ value: type.id, label: type.label })) },
  ];
  const activeFilterCount = getEmrTableFilterBuilderActiveCount(filterModel, filterFields);
  const commonTasks = filterRowsByEmrTableFilterBuilder(scopeTasks, filterModel, filterFields).filter((task) =>
    (view !== "mine" || !hidden.includes(task.kanbanColumn)) &&
    (view !== "hospital" || (query.owners === null || taskOwners(task).some((owner) => query.owners?.includes(owner)))) &&
    (!term || [task.patientName, task.clientName, task.title, task.sourceLabel, task.assigneeName].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)),
  );
  const workTypeCounts = countHospitalWorkTypes(commonTasks);
  const tasks = view === "hospital" ? commonTasks.filter((task) => hospitalWorkType === "all" || task.kanbanColumn === hospitalWorkType).sort((a, b) => compareHospitalTasks(a, b, hospitalSort)) : commonTasks;
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
  }, [loading, blocked, isBoard, preferences.hiddenStatuses, preferences.collapsedStatuses]);

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
  const dateControl = <EmrDateNavigator appearance="home" className={styles.dateControl} dateLabel={query.date} formatSelectedDateLabel={hospitalDateLabel} selectedDate={query.date} todayDate={today} todayLabel={query.date === today ? "오늘" : undefined}
    onDateChange={(date) => updateQuery(view, { date, owners: null })}
    onPrevious={() => updateQuery(view, { date: offsetDate(query.date, -1), owners: null })}
    onNext={() => updateQuery(view, { date: offsetDate(query.date, 1), owners: null })} />;
  const renderListGroup = (type: typeof workTypes[number], items: HomeTask[], prefix: string) => {
    const key = `list:${view}:${prefix}:${type.id}`;
    return <HomeListGroup key={key} id={type.id} label={type.label} tasks={items} date={operatingDate}
      collapsed={collapsed(key)} onToggle={() => toggleGroup(key)} onHide={() => setHidden([...hidden, type.id])} onNavigate={navigate} />;
  };

  return <section className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]" data-testid="home-workspace" aria-busy={loading}>
    <EmrMainContentHeader aria-hidden="true" heightMode="fixed" style={{ height: view === "hospital" ? 52 : 56 }} />
    <header className={styles.pageHeader}>
      <EmrPageHeader
        className="min-h-8 gap-3"
        titleClassName={view === "hospital" ? styles.hospitalTitle : "text-[24px] font-bold leading-8 tracking-[-0.552px] text-[var(--clair-color-atomic-neutral-900)]"}
        title={view === "hospital" ? dateControl : "내 업무"}
        badge={view === "mine" ? <Badge variant="secondary" aria-label="표시 업무 수" className="h-7 min-w-5 rounded-md bg-[var(--clair-color-atomic-black-alpha-4)] px-2 py-0 text-[16px] font-medium leading-6 tracking-[0.096px] text-[var(--clair-color-atomic-neutral-900)]">{loading ? "…" : blocked ? "—" : tasks.length}</Badge> : undefined}
        actions={view === "hospital" ? <div className="emr-text-metadata flex flex-wrap items-center gap-2 text-[var(--emr-text-secondary)]" aria-label="현재 병원 환자 현황">
          <span>원내 {patientSummary?.present ?? "—"}마리</span><span aria-hidden="true">·</span>
          <span>진료 대기 {patientSummary?.waiting ?? "—"}마리</span><span aria-hidden="true">·</span>
          <span>진료 중 {patientSummary?.inProgress ?? "—"}마리</span>
        </div> : undefined}
      />
      <div className={styles.toolbar} data-testid="home-toolbar" data-view={view}>
        <HomeToolbarTabs key={view} selection={view === "hospital" ? hospitalWorkType : personalTab}>
        {view === "hospital" ? <div className={styles.workTypeTabs} role="group" aria-label="업무 종류">
          <button type="button" data-testid="home-all-work-tab" aria-pressed={hospitalWorkType === "all"} onClick={() => setHospitalWorkType("all")}>전체 업무 <span>{loading ? "…" : blocked ? "—" : commonTasks.length}</span></button>
          {workTypes.map((type) => <button type="button" key={type.id} aria-pressed={hospitalWorkType === type.id} onClick={() => setHospitalWorkType(type.id)}>{type.label} <span>{loading ? "…" : blocked ? "—" : workTypeCounts[type.id] ?? 0}</span></button>)}
        </div> : <SegmentedControl className={styles.personalTabs} aria-label="내 업무 구분" value={personalTab} onValueChange={setPersonalTab} variant="tabs" size="md" itemClassName="gap-1.5 aria-pressed:bg-[var(--clair-color-atomic-common-100)] aria-pressed:hover:bg-[var(--clair-color-atomic-common-100)]" items={[{ value: "assigned", label: <><ListTodoIcon className="size-3.5" aria-hidden="true" />내가 해야 할 업무</> }, { value: "requested", label: <><SendIcon className="size-3.5" aria-hidden="true" />내가 요청한 업무</> }]} />}
        </HomeToolbarTabs>
        <HomeToolbarActions>
          <div className={styles.iconTools}>
          <HomeSearch personal={view === "mine"} value={query.search} onChange={(search) => updateQuery(view, { search })} />
          <Popover key={`filters-${view}`} open={filterOpen} onOpenChange={(open) => { setFilterOpen(open); if (!open) { setFilterReady(false); setFilterAutoOpenConsumed(false); } }} onOpenChangeComplete={setFilterReady}>
            <PopoverTrigger render={<EmrTableFilterTrigger activeCount={activeFilterCount + (view === "hospital" && query.includeCancelled ? 1 : 0)} size="default" className={cn(styles.actionButton, view === "hospital" ? styles.hospitalFilterTrigger : styles.filterTrigger)} title={`업무 필터 · 적용 중 ${activeFilterCount + Number(view === "hospital" && query.includeCancelled)}개`} aria-label={view === "hospital" && (activeFilterCount || query.includeCancelled) ? `업무 필터 설정, 적용 중인 룰 ${activeFilterCount + Number(query.includeCancelled)}개` : "업무 필터 설정"} />} />
            <PopoverContent align="end" className="w-[min(640px,calc(100vw-32px))] gap-0 overflow-visible p-0" initialFocus={false}>
              {view === "hospital" && <div className={styles.cancelFilter}><Checkbox aria-label="취소 포함" checked={query.includeCancelled} onCheckedChange={(checked) => updateQuery("hospital", { includeCancelled: checked === true })} /><span>취소 포함</span></div>}
              <EmrTableFilterBuilder fields={filterFields} model={filterModel} autoOpenFirstField={filterReady && !filterAutoOpenConsumed}
                onModelChange={(model) => { setFilterAutoOpenConsumed(true); updateFilter(view, model); }}
                onClose={() => { setFilterOpen(false); setFilterReady(false); setFilterAutoOpenConsumed(false); }} />
            </PopoverContent>
          </Popover>
          {view === "hospital" && <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="icon" aria-label="정렬" title="정렬" className={cn(styles.sortButton, styles.actionButton)}>
                <ArrowDownUpIcon aria-hidden="true" className="size-4" />
              </Button>
            } />
            <DropdownMenuContent align="end"><DropdownMenuRadioGroup value={hospitalSort} onValueChange={(sort) => setHospitalSort(sort as HospitalSort)}>{([ ["priority", "업무 우선순"], ["oldest", "오래된 요청순"], ["newest", "최근 요청순"] ] as const).map(([sort, label]) => <DropdownMenuRadioItem key={sort} value={sort}>{label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
          </DropdownMenu>}
          </div>
          {view === "hospital" && <Button variant="outline" size="default" className={styles.todayButton} disabled={query.date === today} onClick={() => updateQuery("hospital", { date: today, owners: null })}>오늘</Button>}
          <EmrFilterToggle
            className={cn(styles.compactAction, styles.actionButton)}
            aria-label="완료 포함"
            title={`완료 포함 · ${query.includeCompleted ? "켜짐" : "꺼짐"}`}
            pressed={query.includeCompleted}
            onPressedChange={(pressed) => updateQuery(view, { includeCompleted: pressed })}
          >
            완료 포함
          </EmrFilterToggle>
          {view === "hospital" && <>
            <HomeMultiSelect label="담당자" menuVariant="reception" options={owners.map((owner) => ({ id: owner, label: owner }))} values={query.owners ?? owners} allSelected={query.owners === null}
              onChange={(values) => updateQuery("hospital", { owners: values.length === owners.length ? null : values })} />
          </>}
          {view === "hospital" ? <><span className={styles.toolbarDivider} aria-hidden="true" /><SegmentedControl className={styles.viewTabs} itemClassName={styles.actionButton} aria-label="업무 보기 방식" variant="tabs" size="md" value={preferences.layout} onValueChange={(layout) => { rememberScroll(); updatePreferences({ layout }); }} items={[{ value: "board", ariaLabel: "칸반", title: "칸반 보기", label: <><Columns3Icon aria-hidden="true" /><span className={styles.actionLabel}>칸반</span></> }, { value: "list", ariaLabel: "리스트", title: "리스트 보기", label: <><ListIcon aria-hidden="true" /><span className={styles.actionLabel}>리스트</span></> }]} /></> :
            <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="default" className={cn(styles.compactAction, styles.actionButton)} aria-label="정렬" title="정렬 · 기본 업무 순서"><ArrowDownUpIcon aria-hidden="true" /><span className={styles.actionLabel}>정렬</span></Button>} /><DropdownMenuContent align="end"><DropdownMenuItem><CheckIcon aria-hidden="true" />기본 업무 순서</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}

        </HomeToolbarActions>
      </div>
    </header>
    {view === "hospital" && !loading && !blocked && tasks.length === 0 && (hospitalWorkType !== "all" || term || query.owners !== null || activeFilterCount > 0) && <div role="status" className={styles.noMatchNotice}>선택한 조건에 맞는 업무가 없습니다. <Button variant="ghost" size="sm" onClick={() => { setHospitalWorkType("all"); updateQuery("hospital", { search: "", owners: null }); updateFilter("hospital", { ...filterModel, groups: filterModel.groups.map((group) => ({ ...group, rules: group.rules.map((rule) => ({ ...rule, applied: null })) })) }); }}>검색·업무 탭·필터 초기화</Button></div>}
    {sourceStatus === "partial" && <div role="status" className="emr-text-body flex shrink-0 items-center justify-between bg-[var(--emr-status-warning-bg)] px-6 py-2">일부 업무를 불러오지 못했습니다. 표시된 업무만 확인할 수 있습니다.<Button variant="ghost" size="sm" onClick={onRefresh}>다시 시도</Button></div>}
    {blocked ? <div className="flex min-h-0 flex-1 items-center justify-center" data-testid="home-blocked-state"><EmrEmptyState kind={sourceStatus === "permission_denied" ? "no-permission" : "read-error"} surface="content" title={sourceStatus === "permission_denied" ? "업무를 볼 권한이 없습니다" : "업무를 불러오지 못했습니다"} description={errorMessage} primaryAction={sourceStatus === "error" && onRefresh ? <Button variant="outline" onClick={onRefresh}>다시 시도</Button> : undefined} /></div> :
      <div className={cn(styles.workspaceBody, (view === "mine" || preferences.layout === "list") && styles.listWorkspaceBody)} data-testid="home-workspace-body">
        <ScrollAreaPrimitive.Root className={cn(styles.scrollFrame, "overflow-hidden", isBoard && styles.boardScrollFrame, view === "hospital" && !isBoard && tasks.length === 0 && styles.emptyListScrollFrame)} data-testid="home-workspace-scroll-area">
          <ScrollAreaPrimitive.Viewport ref={scrollRef} onScroll={rememberScroll} className="size-full min-h-0 min-w-0 rounded-[inherit] outline-none focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50" data-slot="scroll-area-viewport" data-testid="home-workspace-scroll">
            <ScrollAreaPrimitive.Content className="h-full">
              {loading ? <HomeDataLoadingState /> :
              view === "hospital" && preferences.layout === "board" ? <div className={cn(styles.board, visibleStatuses.length === 0 && styles.emptyBoard)} data-testid="home-kanban-board" style={{ gridTemplateColumns: visibleStatuses.map((status) => preferences.collapsedStatuses.includes(status.id) ? "52px" : "280px").join(" ") }}>
                {visibleStatuses.map((status) => <HomeBoardColumn key={status.id} id={status.id} label={status.label} inclusionDisabled={status.id === "completed" ? !query.includeCompleted : status.id === "cancelled" ? !query.includeCancelled : false} tasks={tasks.filter((task) => getHospitalStatus(task) === status.id)} date={operatingDate} collapsed={preferences.collapsedStatuses.includes(status.id)}
                  onToggle={() => updatePreferences({ collapsedStatuses: toggleValue(preferences.collapsedStatuses, status.id) })} onHide={() => updatePreferences({ hiddenStatuses: [...preferences.hiddenStatuses, status.id] })}
                  onNavigate={navigate} />)}
                {visibleStatuses.length === 0 && <EmrEmptyState kind="no-filter-results" surface="content" title="표시할 상태를 선택해 주세요" />}
              </div> : <div className={cn(styles.list, view === "hospital" && tasks.length === 0 && styles.emptyHospitalList)} data-testid="home-task-list">
                {view === "hospital" ? <HomeHospitalList tasks={tasks} date={operatingDate} onNavigate={navigate} /> : [
                  { id: "selected", label: "오늘 할 업무", items: tasks.filter((task) => !previous(task, operatingDate)) },
                  { id: "previous", label: "이전 미완료", items: tasks.filter((task) => previous(task, operatingDate)) },
                ].map((period) => <section key={period.id} className={styles.period} aria-label={period.label}>
                  <h2 className={styles.periodTitle}>{period.label}<span>{period.items.length}</span></h2>
                  {visibleTypes.filter((type) => period.items.some((task) => task.kanbanColumn === type.id)).map((type) => renderListGroup(type, period.items.filter((task) => task.kanbanColumn === type.id), `${personalTab}:${period.id}`))}
                  {period.items.length === 0 && <p className="emr-text-body py-4 text-muted-foreground">{term ? "검색 결과가 없습니다" : "해당 업무가 없습니다"}</p>}
                </section>)}
              </div>}
            </ScrollAreaPrimitive.Content>
          </ScrollAreaPrimitive.Viewport>
          <ScrollBar orientation="horizontal" className="z-10 data-horizontal:border-t-0 data-horizontal:pt-0.5" data-testid="home-workspace-horizontal-scrollbar" />
          <ScrollBar orientation="vertical" className="z-10 data-vertical:border-l-0 data-vertical:pl-0.5" data-testid="home-workspace-vertical-scrollbar" />
          <ScrollAreaPrimitive.Corner />
          {isBoard && !loading && <div className={styles.scrollFade} data-visible={canScrollRight} data-testid="home-board-scroll-fade" aria-hidden="true" />}
        </ScrollAreaPrimitive.Root>
        {view === "hospital" && isBoard && hiddenStatuses.length > 0 && <section className={styles.hiddenWork} aria-label="숨김 상태">
          <header className={cn(styles.groupHeader, styles.hiddenHeader)}><h2>숨김 상태</h2><Button variant="ghost" size="sm" className={styles.showAllButton} onClick={() => updatePreferences({ hiddenStatuses: [] })}><EyeIcon className="size-3" aria-hidden="true" /><span>전체 표시</span></Button></header>
          <div className={styles.hiddenRows}>{hiddenStatuses.map((status) => <div key={status.id} className={styles.hiddenRow}><span>{status.label}</span><Button variant="ghost" size="icon-xs" className={styles.restoreButton} aria-label={`${status.label} 열 표시`} onClick={() => updatePreferences({ hiddenStatuses: preferences.hiddenStatuses.filter((id) => id !== status.id) })}><EyeIcon className="size-3.5" aria-hidden="true" /></Button></div>)}</div>
        </section>}
        {view === "mine" && hiddenTypes.length > 0 && <section className={styles.hiddenWork} aria-label="숨김 업무">
          <header className={cn(styles.groupHeader, styles.hiddenHeader)}><h2>숨김 업무</h2><Button variant="ghost" size="sm" className={styles.showAllButton} onClick={() => setHidden([])}><EyeIcon className="size-3" aria-hidden="true" /><span>전체 표시</span></Button></header>
          <div className={styles.hiddenRows}>{hiddenTypes.map((type) => <div key={type.id} className={styles.hiddenRow}><span>{type.label}</span><Button variant="ghost" size="icon-xs" className={styles.restoreButton} aria-label={`${type.label} 열 표시`} onClick={() => setHidden(hidden.filter((id) => id !== type.id))}><EyeIcon className="size-3.5" aria-hidden="true" /></Button></div>)}</div>
        </section>}

      </div>}
  </section>;
}

function HomeDataLoadingState() {
  return (
    <div
      aria-label="업무를 불러오는 중"
      className="flex min-h-full w-full items-center justify-center"
      data-testid="home-loading-state"
      role="status"
    >
      <EmrEmptyState
        kind="upstream-pending"
        reserveActionSpace={false}
        size="lg"
        surface="content"
        title="업무를 불러오는 중입니다"
      />
    </div>
  );
}

function HomeWorkTypeIcon({ id }: { id: string }) {
  const moduleId = id === "waiting" || id === "reservation" ? "reception" : id === "chart" ? "treatment" : id;
  const definition = moduleIconById[moduleId];
  if (!definition) return null;
  const Icon = definition.icon;
  return <span className="inline-flex size-3.5 shrink-0 items-center justify-center" aria-hidden="true"><Icon className={cn("size-3.5", moduleId === "lab" && "rotate-45 !scale-[0.7071]")} /></span>;
}

function HomeToolbarActions({ children }: { children: ReactNode }) {
  const [hint, setHint] = useState<{ text: string; left: number; top: number } | null>(null);
  useEffect(() => {
    const close = () => setHint(null);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);
  const describe = (target: EventTarget | null, container: HTMLElement) => {
    const hovered = target instanceof Element ? target.closest('button[title]') : null;
    const focused = document.activeElement?.closest('button[title]');
    const button = hovered && container.contains(hovered) ? hovered : focused && container.contains(focused) ? focused : null;
    if (!button || !container.contains(button)) { setHint(null); return; }
    const rect = button.getBoundingClientRect();
    setHint({ text: button.getAttribute('title') || '', left: Math.max(130, Math.min(window.innerWidth - 130, rect.left + rect.width / 2)), top: rect.bottom + 8 });
  };
  return <>
    <div className={styles.toolbarActions} data-testid="home-toolbar-actions"
      onPointerOver={(event) => describe(event.target, event.currentTarget)}
      onPointerLeave={(event) => describe(document.activeElement, event.currentTarget)}
      onPointerDown={() => setHint(null)}
      onFocusCapture={(event) => describe(event.target, event.currentTarget)}
      onBlurCapture={() => setHint(null)}
      onScrollCapture={(event) => describe(document.activeElement, event.currentTarget)}
      onKeyDownCapture={(event) => { if (event.key === "Enter" || event.key === " " || event.key === "Escape") setHint(null); }}>
      {children}
    </div>
    {hint && createPortal(<div role="tooltip" className={styles.actionHint} style={{ left: hint.left, top: hint.top }}>{hint.text}</div>, document.body)}
  </>;
}

function HomeToolbarTabs({ selection, children }: { selection: string; children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setEdges({ left: viewport.scrollLeft > 1, right: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1 });
    const reveal = (button: HTMLElement | null) => {
      if (!button) return;
      const bounds = viewport.getBoundingClientRect(), item = button.getBoundingClientRect();
      if (item.left < bounds.left) viewport.scrollLeft += item.left - bounds.left;
      else if (item.right > bounds.right) viewport.scrollLeft += item.right - bounds.right;
    };
    const resize = () => { reveal(viewport.contains(document.activeElement) ? document.activeElement as HTMLElement : viewport.querySelector('[aria-pressed="true"]')); update(); };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaX || viewport.scrollWidth <= viewport.clientWidth) return;
      const amount = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1);
      const next = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + amount));
      if (next !== viewport.scrollLeft) { event.preventDefault(); viewport.scrollLeft = next; }
    };
    const onFocus = (event: FocusEvent) => { reveal((event.target as HTMLElement).closest('button')); };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    viewport.addEventListener('scroll', update);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('focusin', onFocus);
    resize();
    return () => { observer.disconnect(); viewport.removeEventListener('scroll', update); viewport.removeEventListener('wheel', onWheel); viewport.removeEventListener('focusin', onFocus); };
  }, [selection]);

  return <div className={styles.tabFrame} data-testid="home-toolbar-tab-frame">
    <div ref={viewportRef} className={styles.tabViewport} data-testid="home-toolbar-tabs" data-overflow={edges.left || edges.right}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (event.pointerType !== "mouse" || event.button !== 0 || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
        drag.current = { id: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        if (event.buttons !== 1) { drag.current = null; delete event.currentTarget.dataset.dragging; return; }
        if (!start.moved && Math.abs(event.clientX - start.x) < 5) return;
        if (!start.moved) { start.moved = true; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.dragging = "true"; }
        event.preventDefault();
        event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
      }}
      onPointerUp={(event) => { suppressClick.current = Boolean(drag.current?.moved); drag.current = null; delete event.currentTarget.dataset.dragging; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={(event) => { drag.current = null; suppressClick.current = false; delete event.currentTarget.dataset.dragging; }}
      onLostPointerCapture={(event) => { drag.current = null; delete event.currentTarget.dataset.dragging; }}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        buttons[next]?.focus();
      }}>
      {children}
    </div>
    <span className={cn(styles.tabFade, styles.tabFadeLeft)} data-visible={edges.left} aria-hidden="true" data-testid="home-tabs-fade-left" />
    <span className={cn(styles.tabFade, styles.tabFadeRight)} data-visible={edges.right} aria-hidden="true" data-testid="home-tabs-fade-right" />
  </div>;
}

function HomeSearch({ personal, value, onChange }: { personal: boolean; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(Boolean(value));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visible = open || Boolean(value);
  const close = () => { setOpen(false); requestAnimationFrame(() => buttonRef.current?.focus()); };
  return visible ? <div className={styles.inlineSearch}>
    <CdsActionsSearchIcon aria-hidden="true" className="pointer-events-none absolute left-2 top-2 z-10 size-4 text-muted-foreground" />
    <Input ref={inputRef} autoFocus aria-label={personal ? "내 업무 검색" : "환자 보호자 업무 검색"} placeholder={personal ? "내 업무 검색" : "환자·업무 검색"} value={value} onValueChange={onChange}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); if (value) onChange(""); else close(); } }}
      className="h-8 rounded-lg border-[var(--emr-border-default)] bg-[var(--clair-color-atomic-common-100)] px-2.5 py-1.5 pl-8 pr-8 text-[14px] font-medium leading-5 tracking-[0.196px] shadow-none" />
    <Button variant="ghost" size="icon-xs" className="absolute right-1 top-1" aria-label={value ? "검색어 지우기" : "검색 닫기"}
      onClick={() => { if (value) { onChange(""); inputRef.current?.focus(); } else close(); }}><CircleCloseFillIcon className="size-4" /></Button>
  </div> : <Button ref={buttonRef} variant="outline" size={personal ? "default" : "icon"} className={cn(styles.actionButton, personal ? styles.compactAction : styles.hospitalSearchTrigger)} title={personal ? "내 업무 검색" : "환자·업무 검색"} aria-label="검색" aria-expanded={false} onClick={() => setOpen(true)}><CdsActionsSearchIcon aria-hidden="true" />{personal && <span className={cn("px-0.5", styles.actionLabel)}>검색</span>}</Button>;
}

function HomeMultiSelect({ label, options, values, allSelected, onChange, menuVariant = "default" }: { label: string; options: Array<{ id: string; label: string }>; values: string[]; allSelected: boolean; onChange: (values: string[]) => void; menuVariant?: "default" | "reception" }) {
  const text = allSelected ? `${label} 전체` : values.length === 0 ? `${label} 선택 없음` : values.length === 1 ? options.find((option) => option.id === values[0])?.label || values[0] : `${label} ${values.length}개`;
  const receptionMenu = menuVariant === "reception";
  return <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" size="default" aria-label={`${label} 다중 선택`} title={text} className={cn(styles.compactAction, styles.ownerButton, styles.actionButton)}><UserIcon aria-hidden="true" className={styles.ownerIcon} /><span className={cn("px-0.5", styles.actionLabel)}>{text}</span>{!allSelected && <span className={styles.ownerDot} aria-hidden="true" />}<ChevronDownIcon className={styles.ownerChevron} /></Button>} />
    <DropdownMenuContent align="end" className={receptionMenu ? "w-[201px] rounded-[8px] border border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-common-100)] p-[4px] text-[var(--clair-color-atomic-neutral-900)] shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)] ring-0" : "w-52 p-2"} data-testid={receptionMenu ? "home-assignee-filter-menu" : undefined}>
      {receptionMenu ? <>
        <div className="flex h-8 w-full items-center">
          <DropdownMenuItem className="h-8 min-w-0 flex-1 justify-center rounded-[4px] px-[6px] py-[6px] text-[12px] font-medium leading-4 tracking-[0.3px]" onClick={() => onChange(options.map((option) => option.id))}>전체 선택</DropdownMenuItem>
          <DropdownMenuItem className="h-8 min-w-0 flex-1 justify-center rounded-[4px] px-[6px] py-[6px] text-[12px] font-medium leading-4 tracking-[0.3px]" onClick={() => onChange([])}>선택 해제</DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0 h-[10px] bg-transparent bg-[linear-gradient(to_bottom,transparent_4px,var(--clair-color-atomic-neutral-200)_4px,var(--clair-color-atomic-neutral-200)_5px,transparent_5px)]" />
        {options.map((option) => <DropdownMenuCheckboxItem key={option.id} checked={values.includes(option.id)} className="h-8 gap-2 rounded-[4px] px-2 py-[6px] pr-8 text-[14px] font-medium leading-5 tracking-[0.196px] opacity-80" onCheckedChange={() => onChange(toggleValue(values, option.id))}>{option.label}</DropdownMenuCheckboxItem>)}
      </> : <>
        <div className="flex justify-between border-b border-border pb-1"><Button size="xs" variant="ghost" onClick={() => onChange(options.map((option) => option.id))}>전체 선택</Button><Button size="xs" variant="ghost" onClick={() => onChange([])}>선택 해제</Button></div>
        <div className="max-h-64 overflow-auto" role="group" aria-label={`${label} 선택`}>
          {options.map((option) => <label key={option.id} className="emr-text-body flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-[var(--emr-state-hover)]"><Checkbox aria-label={`${option.label} 선택`} checked={values.includes(option.id)} onCheckedChange={() => onChange(toggleValue(values, option.id))} />{option.label}</label>)}
        </div>
      </>}
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
function HospitalStateIcon({ state }: { state: HospitalStatus }) {
  return <EmrSidePanelStateIcon state={state === "completed" ? "done" : state === "in_progress" ? "in-progress" : state === "re_requested" ? "rework" : state === "cancelled" ? "cancel" : "to-do"} />;
}
function HomeBoardColumn({ id, label, tasks, date, collapsed, inclusionDisabled, onToggle, onHide, onNavigate }: {
  id: HospitalStatus; label: string; tasks: HomeTask[]; date: string; collapsed: boolean; inclusionDisabled: boolean; onToggle: () => void; onHide: () => void;
  onNavigate: (task: HomeTask) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scrollRef.current; const saved = useHomeWorkspaceStore.getState().scroll[`status-column:${id}`];
    if (element && saved) element.scrollTop = saved.top;
  }, [id, collapsed]);
  return <section data-testid={`home-kanban-column-${id}`} className={cn(styles.column, collapsed && styles.collapsedColumn)}>
    {collapsed ? <div className="flex flex-col items-center gap-3 py-3"><Button variant="ghost" size="icon-xs" aria-label={`${label} 열 펼치기`} aria-expanded={false} onClick={onToggle}><ChevronRightIcon /></Button><HospitalStateIcon state={id} /><h2 className="emr-text-body [writing-mode:vertical-rl]">{label}</h2><span className="emr-text-metadata text-muted-foreground">{tasks.length}</span></div> : <>
      <header className={cn(styles.groupHeader, styles.dividedHeader)}><h2><HospitalStateIcon state={id} />{label}<span>{tasks.length}</span></h2><div className={styles.groupActions}><Button variant="ghost" size="icon-xs" aria-label={`${label} 열 숨기기`} onClick={onHide}><EyeOffIcon /></Button><Button variant="ghost" size="icon-xs" aria-label={`${label} 열 접기`} aria-expanded="true" onClick={onToggle}><ChevronUpIcon /></Button></div></header>
      <div ref={scrollRef} className={styles.columnBody} onScroll={(event) => useHomeWorkspaceStore.getState().rememberScroll(`status-column:${id}`, { top: event.currentTarget.scrollTop, left: 0 })}>
        <div className={styles.cards}>
            {tasks.map((task) => <div key={task.id} className="space-y-1" data-testid={`home-status-task-${task.id}`} title={`${task.requestedAt} · ${elapsed(task)} 경과`}>
              <EmrTaskQueueCard selected={false} item={{
                patientName: task.patientName || "환자 미지정", guardianName: task.clientName || "보호자 미지정", receptionType: task.receptionType || "외래",
                secondLineText: `${typeLabel(task)} · ${task.queueCardSecondLineText || task.title}`, secondLineBadgeLabel: task.queueCardSecondLineBadgeLabel,
                assigneeName: ownerLabel(task), eventActorName: task.requestedBy || "", eventTime: requestTime(task), eventText: `요청 ${requestTime(task)}`,
                actionAriaLabel: `${task.patientName || "환자"} ${typeLabel(task)} 업무 메뉴`, actionMenuDensity: "compact",
                actionItems: [{ key: "source", label: `${typeLabel(task)} 화면으로 이동`, onSelect: () => onNavigate(task) }], testId: `home-kanban-task-${task.id}`,
              }} />
              <HomeTaskSignals task={task} date={date} />
            </div>)}
        </div>
        {tasks.length === 0 && <p className="emr-text-metadata px-2 py-5 text-center text-muted-foreground">{inclusionDisabled && id === "completed" ? "완료 포함을 켜면 표시됩니다." : inclusionDisabled && id === "cancelled" ? "필터에서 취소 포함을 켜면 표시됩니다." : "표시할 업무가 없습니다."}</p>}
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

function HospitalUserAvatar({ name, src, label, unassigned = false, count }: { name: string; src?: string; label: string; unassigned?: boolean; count?: number }) {
  return <Tooltip>
    <TooltipTrigger aria-label={`${label} ${name}`} className={styles.hospitalAvatarTrigger} onClick={(event) => event.stopPropagation()}>
      <Avatar size="sm" roundness="round" className={cn(styles.hospitalUserAvatar, unassigned && styles.hospitalUnassignedAvatar)}>
        {src && <AvatarImage src={src} alt="" />}
        <AvatarFallback>{count ? `+${count}` : <UserIcon aria-hidden="true" />}</AvatarFallback>
      </Avatar>
    </TooltipTrigger>
    <TooltipContent role="tooltip">{name}</TooltipContent>
  </Tooltip>;
}

function HomeHospitalList({ tasks, date, onNavigate }: { tasks: HomeTask[]; date: string; onNavigate: (task: HomeTask) => void }) {
  const headings = ["업무", "환자", "보호자", "세부 업무", "상태", "요청 시각", "요청자", "담당자", ""];
  const isEmpty = tasks.length === 0;
  return <div role="table" aria-label="원내 업무 목록" className={cn(styles.hospitalTable, isEmpty && styles.emptyHospitalTable)} data-testid="home-hospital-table">
    <div role="row" className={styles.hospitalTableHeader}>{headings.map((heading, index) => <span role="columnheader" key={`${heading}-${index}`}>{heading}</span>)}</div>
    <div className={cn(styles.hospitalTableRows, isEmpty && styles.emptyHospitalTableRows)} data-testid="home-hospital-table-body">
      {tasks.map((task) => {
        const state = getHospitalStatus(task);
        const stateLabel = hospitalStatuses.find((item) => item.id === state)?.label ?? state;
        const owners = taskOwners(task);
        const visibleOwners = owners.length > 3 ? owners.slice(0, 2) : owners;
        return <div role="row" tabIndex={0} key={task.id} className={styles.hospitalRow} data-testid={`home-hospital-row-${task.id}`} aria-label={`${task.patientName || "환자 미지정"} ${task.title}`}
          onClick={() => onNavigate(task)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onNavigate(task); } }}>
          <span role="cell" title={typeLabel(task)}><Badge variant="outline" size="md" className={styles.hospitalTypeBadge}>{typeLabel(task)}</Badge></span>
          <span role="cell" className={styles.hospitalIdentity} title={task.patientName || "환자 미지정"}><AnimalPatientAvatar alt={task.patientName || "환자 미지정"} size="table" className={styles.hospitalPatientAvatar} /><span>{task.patientName || "환자 미지정"}</span></span>
          <span role="cell" className={styles.hospitalIdentity} title={task.clientName || "보호자 미지정"}><Avatar className={styles.hospitalGuardianAvatar}><AvatarFallback><UserIcon aria-hidden="true" /></AvatarFallback></Avatar><span>{task.clientName || "보호자 미지정"}</span></span>
          <span role="cell" className={styles.hospitalDetails} title={task.queueCardSecondLineText || task.title}><span>{task.queueCardSecondLineText || task.title}</span><HomeTaskSignals task={task} date={date} /></span>
          <span role="cell" className={styles.hospitalState}><HospitalStateIcon state={state} />{stateLabel}</span>
          <span role="cell" className={styles.hospitalTime} title={`${task.requestedAt} · ${elapsed(task)} 경과`}><ClockIcon aria-hidden="true" />{requestTime(task)}</span>
          <span role="cell" className={styles.hospitalUsers}>{task.requestedBy || task.requesterUserId ? <HospitalUserAvatar name={task.requestedBy || "요청자 지정됨"} src={task.requesterAvatarUrl} label="요청자" /> : <span className="text-muted-foreground">—</span>}</span>
          <span role="cell" className={styles.hospitalUsers}>{visibleOwners.map((name, index) => {
            const userId = task.assigneeUserIds?.[index] ?? (index === 0 ? task.assigneeUserId : undefined);
            return <HospitalUserAvatar key={userId ?? `${name}-${index}`} name={name} src={userId ? task.assigneeAvatarUrls?.[userId] : undefined} label="담당자" unassigned={name === "미배정"} />;
          })}{owners.length > 3 && <HospitalUserAvatar name={owners.slice(2).join(", ")} label="담당자" count={owners.length - 2} />}</span>
          <span role="cell" className={styles.hospitalRowAction}><Button variant="ghost" size="icon-xs" aria-label={`${task.patientName || "환자"} ${typeLabel(task)} 화면으로 이동`} onClick={(event) => { event.stopPropagation(); onNavigate(task); }}><ChevronRightIcon aria-hidden="true" /></Button></span>
        </div>;
      })}
      {isEmpty && <EmrEmptyState testId="home-hospital-empty-state" kind="no-filter-results" surface="content" title="조건에 맞는 업무가 없습니다" />}
    </div>
  </div>;
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
