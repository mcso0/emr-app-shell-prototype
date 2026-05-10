"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDownIcon, ClockIcon, UserIcon, WarningIcon } from "@/components/icons";
import {
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelMetaBadge,
  EmrSidePanelTypeBadge,
} from "@/components/emr/side-panel-card";
import {
  EMR_SIDE_PANEL_COLLAPSE_EASE,
  EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE,
  EmrSidePanelCollapsibleGroup,
} from "@/components/emr/side-panel-collapsible-group";
import { Badge } from "@/components/ui/badge";
import {
  SegmentedControl,
  type SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  HomeDashboardData,
  HomeKanbanColumn,
  HomeTask,
  HomeTaskStatus,
  HomeWorkspaceView,
} from "@/features/home/home.types";

type HomeKanbanWorkspaceProps = {
  data: HomeDashboardData;
};

type HomeStatusFilter = "all" | "urgent" | "overdue" | "roleQueue";
type HomeAssigneeFilter = string;
type HomeWorkstreamFilter = string;

const allFilterLabel = "전체";
const unassignedFilterLabel = "미지정";

const viewLabels: Record<HomeWorkspaceView, string> = {
  hospital: "병원 현황",
  mine: "내 업무",
};

const statusLabel: Record<HomeTaskStatus, string> = {
  assigned: "배정",
  inProgress: "진행",
  overdue: "지연",
  requested: "요청",
};

const statusGroupItems: Array<{
  id: HomeTaskStatus;
  indicatorClassName: string;
  label: string;
}> = [
  {
    id: "overdue",
    indicatorClassName: "bg-[var(--clair-color-atomic-red-400)]",
    label: statusLabel.overdue,
  },
  {
    id: "requested",
    indicatorClassName: "bg-[var(--clair-color-atomic-orange-400)]",
    label: statusLabel.requested,
  },
  {
    id: "assigned",
    indicatorClassName: "bg-[var(--clair-color-atomic-gray-400)]",
    label: statusLabel.assigned,
  },
  {
    id: "inProgress",
    indicatorClassName: "bg-[var(--clair-color-atomic-sky-400)]",
    label: statusLabel.inProgress,
  },
];

function getShortTime(value?: string) {
  if (!value) return "기한 없음";

  return value.slice(11, 16);
}

function getUrgentCount(tasks: HomeTask[]) {
  return tasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
}

function matchesStatusFilter(task: HomeTask, filter: HomeStatusFilter) {
  if (filter === "urgent") return task.priority === "urgent" || task.priority === "high";
  if (filter === "overdue") return task.status === "overdue";
  if (filter === "roleQueue") return task.assignment === "roleQueue";

  return true;
}

function matchesAssigneeFilter(task: HomeTask, filter: HomeAssigneeFilter) {
  if (filter === allFilterLabel) return true;
  if (filter === unassignedFilterLabel) return task.assignment === "roleQueue" || getAssigneeLabel(task) === unassignedFilterLabel;

  return getAssigneeLabel(task) === filter;
}

function getViewMeta(view: HomeWorkspaceView) {
  if (view === "mine") return "내가 담당자이거나 나에게 요청된 업무만 표시";

  return "전체 업무 리스트와 미배정 큐까지 표시";
}

function getRequesterLabel(task: HomeTask) {
  if (task.requestedBy) return task.requestedBy;
  if (task.assignment === "roleQueue") return task.roleQueueLabel?.replace(" · 미배정", "") ?? task.sourceLabel;

  return task.sourceLabel;
}

function getAssigneeLabel(task: HomeTask) {
  if (task.assigneeName) return task.assigneeName;
  if (task.assignment === "roleQueue") return "미지정";

  return "나";
}

export function HomeKanbanWorkspace({ data }: HomeKanbanWorkspaceProps) {
  const [view, setView] = useState<HomeWorkspaceView>("hospital");
  const [activeStatusFilter, setActiveStatusFilter] = useState<HomeStatusFilter>("all");
  const [activeAssigneeFilter, setActiveAssigneeFilter] = useState<HomeAssigneeFilter>(allFilterLabel);
  const [activeWorkstreamFilters, setActiveWorkstreamFilters] = useState<HomeWorkstreamFilter[]>([]);
  const tasks = view === "mine" ? data.tasks : data.hospitalTasks;
  const activeWorkstreamColumns = data.columns.filter((column) => activeWorkstreamFilters.includes(column.label));
  const scopedTasks = tasks.filter(
    (task) =>
      matchesStatusFilter(task, activeStatusFilter) &&
      matchesAssigneeFilter(task, activeAssigneeFilter)
  );
  const filteredTasks = activeWorkstreamColumns.length > 0
    ? scopedTasks.filter((task) => activeWorkstreamColumns.some((column) => column.id === task.kanbanColumn))
    : scopedTasks;
  const filteredTaskCountByColumn = filteredTasks.reduce<Map<string, number>>((counts, task) => {
    counts.set(task.kanbanColumn, (counts.get(task.kanbanColumn) ?? 0) + 1);
    return counts;
  }, new Map());
  const visibleColumns = activeWorkstreamColumns.length > 0
    ? activeWorkstreamColumns
    : activeStatusFilter === "all"
      ? data.columns
      : data.columns
          .map((column, index) => ({
            column,
            count: filteredTaskCountByColumn.get(column.id) ?? 0,
            index,
          }))
          .sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.index - b.index)
          .map((item) => item.column);
  const statusItems = useMemo<Array<SegmentedControlItem<HomeStatusFilter>>>(
    () => [
      { value: "all", label: "전체", count: tasks.length },
      { value: "urgent", label: "긴급", count: getUrgentCount(tasks) },
      { value: "overdue", label: "지연", count: tasks.filter((task) => task.status === "overdue").length },
      { value: "roleQueue", label: "미지정", count: tasks.filter((task) => task.assignment === "roleQueue").length },
    ],
    [tasks]
  );
  const assigneeFilterItems = useMemo<Array<{ value: HomeAssigneeFilter; label: string }>>(() => {
    const assignees = Array.from(
      new Set(
        data.hospitalTasks
          .map((task) => getAssigneeLabel(task))
          .filter((assignee) => assignee !== "미지정")
      )
    ).sort((a, b) => a.localeCompare(b, "ko-KR"));

    return [
      { value: allFilterLabel, label: allFilterLabel },
      { value: unassignedFilterLabel, label: unassignedFilterLabel },
      ...assignees.map((assignee) => ({
        value: assignee,
        label: assignee,
      })),
    ];
  }, [data.hospitalTasks]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(300px,340px)] overflow-hidden bg-white max-xl:grid-cols-1 max-xl:overflow-y-auto">
      <section
        data-testid="home-kanban-board"
        className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-y-5 border-r border-border p-4 max-xl:min-h-[620px] max-xl:border-r-0"
      >
        <div className="flex min-h-9 items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
          <div className="flex items-center gap-6" role="tablist" aria-label="홈 보기">
            {(["hospital", "mine"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                className={cn(
                  "whitespace-nowrap text-[24px] font-bold leading-8 tracking-normal text-[var(--clair-color-label-assistive)] transition-colors hover:text-[var(--clair-color-label-strong)]",
                  view === item && "text-[var(--clair-color-label-strong)]"
                )}
                onClick={() => {
                  setView(item);
                  setActiveStatusFilter("all");
                  setActiveAssigneeFilter(allFilterLabel);
                  setActiveWorkstreamFilters([]);
                }}
              >
                {viewLabels[item]}
              </button>
            ))}
          </div>
          <p className="text-[12px] leading-4 text-muted-foreground">{getViewMeta(view)}</p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            value={activeStatusFilter}
            items={statusItems}
            aria-label="홈 업무 상태 필터"
            variant="pill"
            className="w-fit gap-2"
            itemClassName="h-8 min-h-8 rounded-full px-4 text-[13px] font-semibold leading-5"
            onValueChange={setActiveStatusFilter}
          />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {view === "hospital" ? (
              <HomeFilterSelect
                label="담당자"
                ariaLabel="담당자 필터"
                value={activeAssigneeFilter}
                items={assigneeFilterItems}
                onValueChange={(value) => setActiveAssigneeFilter(value as HomeAssigneeFilter)}
              />
            ) : null}
            <HomeWorkstreamMultiSelect
              label="업무"
              columns={data.columns}
              tasks={scopedTasks}
              selectedFilters={activeWorkstreamFilters}
              onSelectedFiltersChange={setActiveWorkstreamFilters}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-x-auto pb-2">
          <div className="grid h-full min-h-[560px] grid-flow-col auto-cols-[280px] items-start gap-3 max-sm:auto-cols-[248px]">
            {visibleColumns.map((column) => (
              <HomeKanbanColumn key={column.id} column={column} tasks={filteredTasks.filter((task) => task.kanbanColumn === column.id)} />
            ))}
          </div>
        </div>
      </section>

      <HomeWorkSummaryPanel
        columns={data.columns}
        tasks={scopedTasks}
      />
    </div>
  );
}

function HomeWorkstreamMultiSelect({
  columns,
  label,
  onSelectedFiltersChange,
  selectedFilters,
  tasks,
}: {
  columns: HomeKanbanColumn[];
  label: string;
  onSelectedFiltersChange: (value: HomeWorkstreamFilter[]) => void;
  selectedFilters: HomeWorkstreamFilter[];
  tasks: HomeTask[];
}) {
  const displayLabel =
    selectedFilters.length === 0
      ? allFilterLabel
      : selectedFilters.length === 1
        ? selectedFilters[0]
        : `${selectedFilters.length}개 선택`;
  const toggleFilter = (value: HomeWorkstreamFilter) => {
    onSelectedFiltersChange(
      selectedFilters.includes(value)
        ? selectedFilters.filter((item) => item !== value)
        : [...selectedFilters, value]
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] font-medium leading-4 text-muted-foreground">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="업무 필터"
          className="flex h-7 w-[112px] items-center justify-between gap-1 rounded-[var(--clair-radius-atomic-8)] border border-border bg-card px-2 text-left text-[12px] font-semibold leading-4 text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="min-w-0 truncate">{displayLabel}</span>
          <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px] p-2" data-testid="home-workstream-filter-menu">
          <div className="grid gap-1">
            <label
              className={cn(
                "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--clair-radius-atomic-8)] border border-border bg-white px-2 py-2 text-[12px] leading-4 transition-colors hover:border-[var(--clair-color-atomic-blue-400)] hover:bg-[var(--clair-color-atomic-blue-50)]",
                selectedFilters.length === 0 && "border-[var(--clair-color-atomic-blue-500)] bg-[var(--clair-color-atomic-blue-50)]"
              )}
              onClick={() => onSelectedFiltersChange([])}
            >
              <Checkbox
                aria-label="전체 업무 선택"
                checked={selectedFilters.length === 0}
                onCheckedChange={() => onSelectedFiltersChange([])}
                onClick={(event) => event.stopPropagation()}
              />
              <span className="font-semibold text-foreground">전체 업무</span>
              <span className="font-bold text-foreground">{tasks.length}</span>
            </label>
            {columns.map((column) => {
              const columnTaskCount = tasks.filter((task) => task.kanbanColumn === column.id).length;
              const active = selectedFilters.includes(column.label);

              return (
                <label
                  key={column.id}
                  className={cn(
                    "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--clair-radius-atomic-8)] border border-border bg-white px-2 py-2 text-[12px] leading-4 transition-colors hover:border-[var(--clair-color-atomic-blue-400)] hover:bg-[var(--clair-color-atomic-blue-50)]",
                    active && "border-[var(--clair-color-atomic-blue-500)] bg-[var(--clair-color-atomic-blue-50)]"
                  )}
                  onClick={() => toggleFilter(column.label)}
                >
                  <Checkbox
                    aria-label={`${column.label} 업무 선택`}
                    checked={active}
                    onCheckedChange={(checked) => {
                      onSelectedFiltersChange(
                        checked
                          ? [...selectedFilters, column.label]
                          : selectedFilters.filter((item) => item !== column.label)
                      );
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <span className="font-semibold text-foreground">{column.label}</span>
                  <span className="font-bold text-foreground">{columnTaskCount}</span>
                </label>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function HomeFilterSelect({
  ariaLabel,
  displayLabel,
  items,
  label,
  onValueChange,
  value,
}: {
  ariaLabel: string;
  displayLabel?: string;
  items: Array<{ value: string; label: string }>;
  label: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] font-medium leading-4 text-muted-foreground">{label}</span>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) onValueChange(nextValue);
        }}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          size="sm"
          className="h-7 w-[112px] rounded-[var(--clair-radius-atomic-8)] bg-card px-2 text-[12px] font-semibold"
        >
          {displayLabel ? <span className="flex flex-1 text-left">{displayLabel}</span> : <SelectValue />}
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[140px]">
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value} className="text-[12px]">
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function HomeKanbanColumn({ column, tasks }: { column: HomeKanbanColumn; tasks: HomeTask[] }) {
  const reduceMotion = useReducedMotion();
  const [columnCollapsed, setColumnCollapsed] = useState(false);
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<HomeTaskStatus>>(new Set());
  const groupedTasks = statusGroupItems
    .map((group) => ({
      ...group,
      tasks: tasks.filter((task) => task.status === group.id),
    }))
    .filter((group) => group.tasks.length > 0);
  const toggleGroup = (status: HomeTaskStatus) => {
    setCollapsedStatusIds((current) => {
      const next = new Set(current);

      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }

      return next;
    });
  };

  return (
    <section
      data-testid={`home-kanban-column-${column.id}`}
      className={cn(
        "group/column flex min-h-0 flex-col overflow-hidden rounded-[var(--clair-radius-md)] border border-border bg-[var(--clair-color-background-surface)]",
        columnCollapsed ? "h-auto" : "h-full"
      )}
    >
      <header className="flex min-h-[62px] items-start justify-between gap-3 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold leading-5">
            <span className="truncate">{column.label}</span>
            <Badge variant="outline" className="h-5 min-w-6 rounded-full bg-card px-1.5 text-[11px] font-semibold">
              {tasks.length}
            </Badge>
          </h2>
          <p className="mt-1 truncate text-[12px] leading-4 text-muted-foreground">{column.description}</p>
        </div>
        <button
          type="button"
          aria-expanded={!columnCollapsed}
          aria-label={`${column.label} ${columnCollapsed ? "펼치기" : "접기"}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-8)] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/column:opacity-100"
          onClick={() => setColumnCollapsed((current) => !current)}
        >
          <motion.span
            animate={{ rotate: columnCollapsed ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EMR_SIDE_PANEL_COLLAPSE_EASE }}
          >
            <ChevronDownIcon className="size-4" aria-hidden="true" />
          </motion.span>
        </button>
      </header>

      <AnimatePresence initial={false}>
        {columnCollapsed ? null : (
          <motion.div
            className="min-h-0 flex-1 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: reduceMotion
                ? { duration: 0 }
                : {
                    height: { duration: 0.24, ease: EMR_SIDE_PANEL_COLLAPSE_EASE },
                    opacity: { duration: 0.14, ease: "easeOut" },
                  },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: reduceMotion
                ? { duration: 0 }
                : {
                    height: { duration: 0.18, ease: EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE },
                    opacity: { duration: 0.12, ease: "easeIn" },
                  },
            }}
          >
            <div className="grid max-h-full content-start gap-3 overflow-y-auto p-2.5">
              {groupedTasks.length > 0 ? (
                groupedTasks.map((group) => (
                  <EmrSidePanelCollapsibleGroup
                    key={group.id}
                    collapsed={collapsedStatusIds.has(group.id)}
                    count={group.tasks.length}
                    dataTestId={`home-kanban-status-${column.id}-${group.id}`}
                    indicatorClassName={group.indicatorClassName}
                    label={group.label}
                    onToggle={() => toggleGroup(group.id)}
                    contentClassName="gap-2"
                  >
                    {group.tasks.map((task) => <HomeKanbanTaskCard key={task.id} task={task} />)}
                  </EmrSidePanelCollapsibleGroup>
                ))
              ) : (
                <div className="rounded-[var(--clair-radius-md)] border border-dashed border-border bg-card px-3 py-6 text-center text-[12px] leading-5 text-muted-foreground">
                  현재 표시할 업무가 없습니다.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function HomeKanbanTaskCard({ task }: { task: HomeTask }) {
  const router = useRouter();

  return (
    <EmrSidePanelCard
      selected={false}
      className="min-h-[100px]"
      testId={`home-kanban-task-${task.id}`}
      onSelect={() => router.push(task.actionHref)}
    >
      <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
          <span className="truncate">{task.patientName ?? "환자 미지정"}</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">·</span>
          <span className="truncate">{task.clientName ?? "보호자 미지정"}</span>
          <EmrSidePanelTypeBadge label={task.receptionType ?? "접수"} />
        </div>
        <EmrSidePanelCardAction
          ariaLabel={`${task.title} 더보기`}
          testId={`home-kanban-task-action-${task.id}`}
        />
      </div>
      <div className="mt-0.5 flex min-h-5 min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-500)]">
        <span className="min-w-0 flex-1 truncate">{task.title}</span>
      </div>
      <div className="my-1.5 h-px w-full bg-[var(--clair-color-line-subtle)]" />
      <div className="flex h-5 min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <EmrSidePanelMetaBadge label="요청" maxWidthClassName="max-w-[70px]" value={getRequesterLabel(task)} />
          <EmrSidePanelMetaBadge label="담당" maxWidthClassName="max-w-[70px]" value={getAssigneeLabel(task)} />
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
          <ClockIcon className="size-3.5 text-[var(--clair-color-atomic-gray-400)]" aria-hidden="true" />
          <span>{getShortTime(task.dueAt ?? task.requestedAt)}</span>
        </span>
      </div>
    </EmrSidePanelCard>
  );
}

function HomeWorkSummaryPanel({
  columns,
  tasks,
}: {
  columns: HomeKanbanColumn[];
  tasks: HomeTask[];
}) {
  const router = useRouter();
  const columnIndexById = new Map(columns.map((column, index) => [column.id, index]));
  const getTopColumnGroup = (signalTasks: HomeTask[]) => {
    const groups = signalTasks.reduce<Map<HomeKanbanColumn["id"], HomeTask[]>>((items, task) => {
      items.set(task.kanbanColumn, [...(items.get(task.kanbanColumn) ?? []), task]);
      return items;
    }, new Map());

    const [columnId, columnTasks] =
      Array.from(groups.entries()).sort(
        ([firstColumnId, firstTasks], [secondColumnId, secondTasks]) =>
          secondTasks.length - firstTasks.length ||
          (columnIndexById.get(firstColumnId) ?? 0) - (columnIndexById.get(secondColumnId) ?? 0)
      )[0] ?? [];
    const column = columns.find((item) => item.id === columnId);

    if (!column || !columnTasks) return null;

    return { column, tasks: columnTasks };
  };
  const focusSignals = [
    {
      id: "urgent",
      Icon: WarningIcon,
      iconClassName: "text-[var(--clair-color-atomic-red-500)]",
      label: "긴급",
      title: "긴급 업무",
      reason: "먼저 확인이 필요한 업무가 몰려 있습니다.",
      filter: "urgent" as const,
      tasks: tasks.filter((task) => task.priority === "urgent" || task.priority === "high"),
    },
    {
      id: "overdue",
      Icon: ClockIcon,
      iconClassName: "text-[var(--clair-color-atomic-orange-500)]",
      label: "지연",
      title: "지연 업무",
      reason: "기준 시간을 넘겨 흐름이 멈출 수 있습니다.",
      filter: "overdue" as const,
      tasks: tasks.filter((task) => task.status === "overdue"),
    },
    {
      id: "roleQueue",
      Icon: UserIcon,
      iconClassName: "text-[var(--clair-color-label-assistive)]",
      label: "미지정",
      title: "미지정 업무",
      reason: "담당자 배정 전이라 다음 처리자가 필요합니다.",
      filter: "roleQueue" as const,
      tasks: tasks.filter((task) => task.assignment === "roleQueue"),
    },
  ]
    .map((signal) => {
      const group = getTopColumnGroup(signal.tasks);

      if (!group) return null;

      return {
        ...signal,
        column: group.column,
        count: group.tasks.length,
        focusTasks: group.tasks,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <aside
      data-testid="home-work-summary-panel"
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 bg-white p-4 max-xl:min-h-[320px] max-xl:border-t max-xl:border-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5">지금 볼 업무</h2>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">현재 보기에서 먼저 확인할 업무를 추렸습니다.</p>
        </div>
      </div>

      <div className="grid content-start gap-3 overflow-y-auto">
        <section className="grid gap-2">
          {focusSignals.length > 0 ? (
            focusSignals.map((item) => (
                <details
                  open
                  key={item.id}
                  className="group rounded-[var(--clair-radius-md)] border border-border bg-card px-3 py-3 transition-colors hover:bg-selection"
                >
                  <summary className="grid cursor-pointer list-none gap-2 marker:hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold leading-5 text-[var(--clair-color-label-strong)]">
                        <item.Icon className={cn("size-4 shrink-0", item.iconClassName)} aria-hidden="true" />
                        <span className="min-w-0 truncate">
                          {item.title} <span className="text-[var(--clair-color-label-assistive)]">{item.count}</span>
                        </span>
                      </span>
                      <ChevronDownIcon
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="text-[12px] leading-4 text-muted-foreground">{item.reason}</span>
                  </summary>
                  <div className="mt-2 grid gap-1.5">
                    {item.focusTasks.map((task) => (
                      <div
                        key={task.id}
                        className="group/focus-task relative rounded-[var(--clair-radius-atomic-8)] border border-border bg-white transition-colors hover:bg-selection focus-within:bg-selection"
                        data-testid={`home-focus-task-${task.id}`}
                      >
                        <div className="grid w-full gap-1 rounded-[var(--clair-radius-atomic-8)] px-2.5 py-2 pr-[72px] text-left">
                          <span className="truncate text-[12px] font-semibold leading-4">
                            {task.patientName ?? "환자 미지정"} · {task.clientName ?? "보호자 미지정"}
                          </span>
                          <span className="truncate text-[12px] leading-4 text-muted-foreground">{task.title}</span>
                        </div>
                        <button
                          type="button"
                          aria-label={`${task.patientName ?? task.title} 업무 화면 보러가기`}
                          className="absolute right-2 top-1/2 h-6 -translate-y-1/2 rounded-[var(--clair-radius-atomic-6)] border border-border bg-card px-2 text-[11px] font-semibold leading-4 text-[var(--clair-color-label-strong)] opacity-0 shadow-sm transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/focus-task:opacity-100 group-focus-within/focus-task:opacity-100"
                          data-testid={`home-focus-task-action-${task.id}`}
                          onClick={() => router.push(task.actionHref)}
                        >
                          보러가기
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              ))
          ) : (
            <div className="rounded-[var(--clair-radius-md)] border border-dashed border-border bg-card px-3 py-3 text-[12px] leading-5 text-muted-foreground">
              현재 바로 볼 업무가 없습니다.
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
