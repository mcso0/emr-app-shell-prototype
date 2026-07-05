"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CdsActionsRefreshCcwIcon } from "@/components/cds-icons/actions-and-controls";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import { EmrEmptyState } from "@/components/emr/empty-state";
import {
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelIdentityLine,
  EmrSidePanelMetaBadge,
  EmrSidePanelStatusBadge,
  EmrSidePanelTypeBadge,
} from "@/components/emr/side-panel-card";
import {
  EMR_SIDE_PANEL_COLLAPSE_EASE,
  EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE,
  EmrSidePanelCollapsibleGroup,
} from "@/components/emr/side-panel-collapsible-group";
import {
  EmrSubpanel,
  EmrSubpanelBody,
  EmrQueueEmptyState,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import {
  EmrTaskQueueCard,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SegmentedControl,
  type SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  HomeMutedPill,
  HomeTaskDecisionBadge,
  HomeTaskDecisionPill,
} from "@/features/home/components/home-task-badges";
import { useHomeWorkspaceStore } from "@/features/home/home-workspace-store";
import type {
  HomeDashboardData,
  HomeKanbanColumn,
  HomeTask,
  HomeTaskStatus,
} from "@/features/home/home.types";
import { useLayoutStore } from "@/stores/layout-store";

type HomeKanbanWorkspaceProps = {
  data: HomeDashboardData;
};

type HomeAssigneeFilter = string;
type HomeOperationMode = "flow" | "mine" | "assignment" | "delays" | "load";
type HomeWorkStatusFilter = "all" | HomeTaskStatus | "urgent" | "high";
type HomeWorkstreamFilter = string;

const allFilterLabel = "전체";
const unassignedFilterLabel = "미지정";

const statusLabel: Record<HomeTaskStatus, string> = {
  assigned: "배정",
  inProgress: "진행",
  overdue: "지연",
  requested: "요청",
};

const statusGroupItems: Array<{
  id: HomeTaskStatus;
  label: string;
}> = [
  {
    id: "overdue",
    label: statusLabel.overdue,
  },
  {
    id: "requested",
    label: statusLabel.requested,
  },
  {
    id: "assigned",
    label: statusLabel.assigned,
  },
  {
    id: "inProgress",
    label: statusLabel.inProgress,
  },
];

const workStatusFilterItems: Array<{ value: HomeWorkStatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "overdue", label: "지연" },
  { value: "urgent", label: "긴급" },
  { value: "high", label: "주의" },
  { value: "requested", label: "요청" },
  { value: "assigned", label: "배정" },
  { value: "inProgress", label: "진행" },
];

function getShortTime(value?: string) {
  if (!value) return "기한 없음";

  return value.slice(11, 16);
}

function getUrgentCount(tasks: HomeTask[]) {
  return tasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
}

function getModeCount(tasks: HomeTask[], mode: HomeOperationMode, myTaskIds: Set<string>) {
  if (mode === "mine") return tasks.filter((task) => myTaskIds.has(task.id)).length;
  if (mode === "assignment") return tasks.filter((task) => task.assignment === "roleQueue").length;
  if (mode === "delays") {
    return tasks.filter((task) => task.status === "overdue" || task.priority === "urgent" || task.priority === "high").length;
  }
  if (mode === "load") return new Set(tasks.map((task) => getAssigneeLabel(task))).size;

  return tasks.length;
}

function matchesOperationMode(task: HomeTask, mode: HomeOperationMode, myTaskIds: Set<string>) {
  if (mode === "mine") return myTaskIds.has(task.id);
  if (mode === "assignment") return task.assignment === "roleQueue";
  if (mode === "delays") return task.status === "overdue" || task.priority === "urgent" || task.priority === "high";

  return true;
}

function matchesAssigneeFilter(task: HomeTask, filter: HomeAssigneeFilter) {
  if (filter === allFilterLabel) return true;
  if (filter === unassignedFilterLabel) return task.assignment === "roleQueue" || getAssigneeLabel(task) === unassignedFilterLabel;

  return getAssigneeLabel(task) === filter;
}

function matchesWorkStatusFilter(task: HomeTask, filter: HomeWorkStatusFilter) {
  if (filter === "all") return true;
  if (filter === "urgent") return task.priority === "urgent";
  if (filter === "high") return task.priority === "high";

  return task.status === filter;
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

function getDecisionReason(task: HomeTask) {
  if (task.status === "overdue") return "SLA 지연";
  if (task.priority === "urgent") return "긴급 확인";
  if (task.priority === "high") return "주의 필요";
  if (task.assignment === "roleQueue") return "담당 미배정";
  if (task.status === "inProgress") return "진행 중";

  return task.sourceLabel;
}

function getTimeSignal(task: HomeTask) {
  if (task.status === "overdue") return `${getShortTime(task.dueAt ?? task.requestedAt)} 지연`;
  if (task.dueAt) return `${getShortTime(task.dueAt)}까지`;

  return `${getShortTime(task.requestedAt)} 요청`;
}

function getModeDescription(mode: HomeOperationMode) {
  if (mode === "mine") return "로그인 역할의 업무만 모아 바로 처리합니다.";
  if (mode === "assignment") return "미배정 큐를 먼저 잡아 병목을 해소합니다.";
  if (mode === "delays") return "지연, 긴급, 주의 업무만 추려 대응합니다.";
  if (mode === "load") return "담당자별 업무량과 미배정 편중을 확인합니다.";

  return "접수부터 수납까지 전체 업무 흐름을 봅니다.";
}

function getTaskTypeLabel(task: HomeTask) {
  if (task.kanbanColumn === "reservation") return "예약";
  if (task.kanbanColumn === "lab") return "임상병리";
  if (task.kanbanColumn === "imaging") return "영상검사";
  if (task.kanbanColumn === "dispensing") return "조제";
  if (task.kanbanColumn === "treatment") return "처치";
  if (task.kanbanColumn === "billing") return "수납";

  return "진료";
}

function getStatusDisplayLabel(task: HomeTask) {
  if (task.priority === "urgent") return "긴급";
  if (task.status === "overdue") return "지연";
  if (task.status === "inProgress") return "진행";
  if (task.status === "assigned") return "배정";

  return "요청";
}

function sortNextActions(tasks: HomeTask[]) {
  return [...tasks].sort((first, second) => {
    const score = (task: HomeTask) => {
      if (task.status === "overdue") return 0;
      if (task.priority === "urgent") return 1;
      if (task.priority === "high") return 2;
      if (task.assignment === "roleQueue") return 3;
      if (task.status === "inProgress") return 4;

      return 5;
    };

    return score(first) - score(second) || (first.dueAt ?? first.requestedAt).localeCompare(second.dueAt ?? second.requestedAt);
  });
}

function groupNextActions(tasks: HomeTask[]) {
  const urgent = tasks.filter((task) => task.status === "overdue");
  const attention = tasks.filter((task) => task.status !== "overdue" && (task.priority === "urgent" || task.priority === "high"));
  const assignment = tasks.filter((task) => task.assignment === "roleQueue");

  return [
    { id: "overdue", label: "SLA 지연", tasks: urgent },
    { id: "attention", label: "긴급/주의", tasks: attention },
    { id: "assignment", label: "배정 필요", tasks: assignment },
  ].filter((group) => group.tasks.length > 0);
}

export function HomeKanbanWorkspace({ data }: HomeKanbanWorkspaceProps) {
  const router = useRouter();
  const [activeOperationMode, setActiveOperationMode] = useState<HomeOperationMode>("flow");
  const [activeAssigneeFilter, setActiveAssigneeFilter] = useState<HomeAssigneeFilter>(allFilterLabel);
  const [activeWorkStatusFilter, setActiveWorkStatusFilter] = useState<HomeWorkStatusFilter>("all");
  const [activeWorkstreamFilters, setActiveWorkstreamFilters] = useState<HomeWorkstreamFilter[]>([]);
  const [delayedOnly, setDelayedOnly] = useState(false);
  const selectedTaskId = useHomeWorkspaceStore((state) => state.selectedTaskId);
  const detailOpen = useHomeWorkspaceStore((state) => state.detailOpen);
  const selectTask = useHomeWorkspaceStore((state) => state.selectTask);
  const closeTaskDetail = useHomeWorkspaceStore((state) => state.closeTaskDetail);
  const clearSelection = useHomeWorkspaceStore((state) => state.clearSelection);
  const tasks = data.hospitalTasks;
  const hasHospitalTasks = tasks.length > 0;
  const myTaskIds = useMemo(() => new Set(data.tasks.map((task) => task.id)), [data.tasks]);
  const operationModeItems = useMemo<Array<SegmentedControlItem<HomeOperationMode>>>(
    () => [
      { value: "flow", label: "전체 흐름", count: getModeCount(tasks, "flow", myTaskIds) },
      { value: "mine", label: "내 담당", count: getModeCount(tasks, "mine", myTaskIds) },
      { value: "assignment", label: "배정 필요", count: getModeCount(tasks, "assignment", myTaskIds) },
      { value: "delays", label: "지연 해소", count: getModeCount(tasks, "delays", myTaskIds) },
      { value: "load", label: "팀 부하", count: getModeCount(tasks, "load", myTaskIds) },
    ],
    [myTaskIds, tasks]
  );
  const activeWorkstreamColumns = data.columns.filter((column) => activeWorkstreamFilters.includes(column.label));
  const operationModeTasks = tasks.filter((task) => matchesOperationMode(task, activeOperationMode, myTaskIds));
  const scopedTasks = tasks.filter(
    (task) =>
      operationModeTasks.some((item) => item.id === task.id) &&
      matchesAssigneeFilter(task, activeAssigneeFilter) &&
      matchesWorkStatusFilter(task, activeWorkStatusFilter) &&
      (!delayedOnly || task.status === "overdue")
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
    : activeOperationMode === "flow" || activeOperationMode === "load"
      ? data.columns
      : data.columns
          .map((column, index) => ({
            column,
            count: filteredTaskCountByColumn.get(column.id) ?? 0,
            index,
          }))
          .sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.index - b.index)
          .map((item) => item.column);
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId)
    : undefined;
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
    <div
      className="h-full min-h-0 overflow-hidden bg-[var(--emr-surface-workspace)]"
      data-testid="home-kanban-workspace"
    >
      <section className="flex h-full min-h-0 min-w-0 overflow-hidden bg-card">
        <div
          data-testid="home-kanban-board"
          className={cn(
            "grid h-full min-h-0 min-w-0 flex-1 p-4",
            hasHospitalTasks
              ? "grid-rows-[auto_auto_minmax(0,1fr)] gap-3"
              : "grid-rows-[minmax(0,1fr)]"
          )}
        >
          {hasHospitalTasks ? (
            <>
              <div className="flex min-h-9 min-w-0 items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
                <div className="min-w-0">
                  <h1 className="text-[18px] font-bold leading-7 text-foreground">업무 현황</h1>
                </div>
                <div className="grid grid-cols-3 gap-2 text-right max-md:grid-cols-1">
                  <HomeBoardMetric label="미배정" value={`${tasks.filter((task) => task.assignment === "roleQueue").length}건`} tone="warning" />
                  <HomeBoardMetric label="지연/주의" value={`${getUrgentCount(tasks) + tasks.filter((task) => task.status === "overdue").length}건`} tone="danger" />
                  <HomeBoardMetric label="내 담당" value={`${data.tasks.length}건`} />
                </div>
              </div>

              <div className="grid min-w-0 gap-2 border-b border-[var(--emr-line-hairline)] bg-card py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <SegmentedControl
                    value={activeOperationMode}
                    items={operationModeItems}
                    aria-label="업무 현황 운영 모드"
                    disabled={!hasHospitalTasks}
                    variant="pill"
                    className="max-w-full gap-2 overflow-x-auto"
                    itemClassName="h-8 min-h-8 rounded-full px-4 text-[13px] font-semibold leading-5"
                    onValueChange={(mode) => {
                      setActiveOperationMode(mode);
                      setActiveAssigneeFilter(allFilterLabel);
                      setActiveWorkStatusFilter("all");
                      setActiveWorkstreamFilters([]);
                      setDelayedOnly(false);
                      clearSelection();
                    }}
                  />
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <HomeFilterSelect
                      label="담당자"
                      ariaLabel="담당자 필터"
                      disabled={!hasHospitalTasks}
                      value={activeAssigneeFilter}
                      items={assigneeFilterItems}
                      onValueChange={(value) => {
                        setActiveAssigneeFilter(value as HomeAssigneeFilter);
                        clearSelection();
                      }}
                    />
                    <HomeWorkstreamMultiSelect
                      label="업무"
                      columns={data.columns}
                      disabled={!hasHospitalTasks}
                      tasks={scopedTasks}
                      selectedFilters={activeWorkstreamFilters}
                      onSelectedFiltersChange={(filters) => {
                        setActiveWorkstreamFilters(filters);
                        clearSelection();
                      }}
                    />
                    <HomeFilterSelect
                      label="업무 상태"
                      ariaLabel="업무 상태 필터"
                      disabled={!hasHospitalTasks}
                      value={activeWorkStatusFilter}
                      items={workStatusFilterItems}
                      onValueChange={(value) => {
                        setActiveWorkStatusFilter(value as HomeWorkStatusFilter);
                        clearSelection();
                      }}
                    />
                    <label className="flex h-7 items-center gap-1.5 rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-card px-2 text-[12px] font-semibold text-muted-foreground">
                      <Checkbox
                        aria-label="지연만 보기"
                        checked={delayedOnly}
                        disabled={!hasHospitalTasks}
                        onCheckedChange={(checked) => {
                          setDelayedOnly(checked === true);
                          clearSelection();
                        }}
                      />
                      지연만 보기
                    </label>
                  </div>
                </div>
              </div>
            </>
          ) : null}

        <div className="relative min-h-0 overflow-hidden">
          {hasHospitalTasks ? (
            <div className="h-full min-h-0 overflow-x-auto pb-2">
              <div className="grid h-full min-h-[620px] grid-flow-col auto-cols-[280px] items-start gap-3 max-sm:auto-cols-[248px]">
                {visibleColumns.map((column) => (
                  <HomeKanbanColumn
                    key={column.id}
                    column={column}
                    selectedTaskId={selectedTaskId}
                    tasks={filteredTasks.filter((task) => task.kanbanColumn === column.id)}
                    onSelectTask={selectTask}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              className="grid h-full min-h-[620px] min-w-full place-items-center pb-2"
              data-testid="home-kanban-empty-state-surface"
            >
              <EmrEmptyState
                kind="upstream-pending"
                priority="supporting"
                surface="content"
                testId="home-kanban-empty-state"
                title="원내 업무가 없습니다"
                description="오늘 표시할 원내 업무가 없습니다."
                primaryAction={
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-card"
                    onClick={() => router.refresh()}
                  >
                    <CdsActionsRefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                    새로고침
                  </Button>
                }
              />
            </div>
          )}
        </div>

        </div>

        {detailOpen ? (
          <TaskDetailPanel
            activeMode={activeOperationMode}
            task={selectedTask}
            onClose={closeTaskDetail}
          />
        ) : null}
      </section>
    </div>
  );
}

function HomeBoardMetric({
  label,
  tone = "normal",
  value,
}: {
  label: string;
  tone?: "danger" | "normal" | "warning";
  value: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-[92px] gap-0.5 rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-card px-2.5 py-1.5",
        tone === "danger" && "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)]",
        tone === "warning" && "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]"
      )}
    >
      <span className="text-[11px] font-semibold leading-3 text-muted-foreground">{label}</span>
      <span className="text-[13px] font-bold leading-5 text-foreground">{value}</span>
    </div>
  );
}

export function HomeHospitalStatusSidePanel({
  tasks,
}: {
  tasks: HomeTask[];
}) {
  const groupedActions = groupNextActions(sortNextActions(tasks).slice(0, 9));
  const selectedTaskId = useHomeWorkspaceStore((state) => state.selectedTaskId);
  const selectTask = useHomeWorkspaceStore((state) => state.selectTask);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);

  return (
    <div className="h-full min-h-0" data-testid="home-next-action-side-panel">
      <EmrSubpanel>
        <EmrSubpanelTitle
          title={<h2 className="truncate">원내 현황</h2>}
          collapseLabel="원내 현황 패널 접기"
          onCollapse={() => setModulePanelOpen(false)}
        />
        <EmrSubpanelBody>
          <div
            className={cn(
              "pt-1",
              groupedActions.length > 0 ? "grid gap-3" : "grid min-h-full flex-1 place-items-center"
            )}
            data-testid={groupedActions.length > 0 ? undefined : "home-side-panel-empty-state-surface"}
          >
            {groupedActions.length > 0 ? (
              groupedActions.map((group) => (
                <div key={group.id} className="grid gap-1.5">
                  <div className="flex h-8 items-center justify-between px-1">
                    <span className="emr-text-section font-semibold text-[var(--emr-sidepanel-list-title-text)]">{group.label}</span>
                    <Badge variant="secondary" className="h-5 min-w-5 rounded-[var(--clair-radius-atomic-6)] px-1.5 emr-text-status">
                      {group.tasks.length}
                    </Badge>
                  </div>
                  <div className="grid gap-2">
                    {group.tasks.slice(0, 4).map((task, index) => (
                      <NextActionSidePanelCard
                        key={`${group.id}-${task.id}`}
                        rank={index + 1}
                        selected={selectedTaskId === task.id}
                        task={task}
                        onSelect={() => selectTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmrQueueEmptyState
                className="min-h-0 -translate-y-6"
                data-testid="home-side-panel-empty-state"
                title="원내 업무가 없습니다"
              />
            )}
          </div>
        </EmrSubpanelBody>
      </EmrSubpanel>
    </div>
  );
}

function NextActionSidePanelCard({
  onSelect,
  rank,
  selected,
  task,
}: {
  onSelect: () => void;
  rank: number;
  selected: boolean;
  task: HomeTask;
}) {
  return (
    <EmrSidePanelCard
      selected={selected}
      selectionVariant="modulePanel"
      className="min-h-[116px]"
      testId={`home-next-action-${task.id}`}
      onSelect={onSelect}
    >
      <EmrSidePanelIdentityLine
        patientName={task.patientName ?? "환자 미지정"}
        guardianName={task.clientName ?? "보호자 미지정"}
        typeBadge={<EmrSidePanelTypeBadge label={task.receptionType ?? getTaskTypeLabel(task)} />}
        action={<EmrSidePanelCardAction ariaLabel={`${task.title} 더보기`} />}
      />
      <div className="grid gap-1">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold leading-3 text-background">
            {rank}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-[var(--emr-sidepanel-task-card-title-text)]">
            {task.title}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1">
          <HomeTaskDecisionPill task={task} label={getDecisionReason(task)} />
          <HomeMutedPill label={getTimeSignal(task)} />
        </div>
        <div className="flex min-w-0 flex-wrap gap-1">
          <EmrSidePanelMetaBadge label="담당" maxWidthClassName="max-w-[96px]" value={getAssigneeLabel(task)} />
          <EmrSidePanelStatusBadge maxWidthClassName="max-w-[112px]">{getStatusDisplayLabel(task)}</EmrSidePanelStatusBadge>
        </div>
      </div>
    </EmrSidePanelCard>
  );
}

function TaskDetailPanel({
  activeMode,
  onClose,
  task,
}: {
  activeMode: HomeOperationMode;
  onClose: () => void;
  task?: HomeTask;
}) {
  const router = useRouter();

  if (!task) {
    return (
      <aside
        className="grid h-full w-[420px] shrink-0 content-center border-l border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-6 text-center text-[13px] leading-5 text-muted-foreground"
        data-testid="home-work-status-detail"
      >
        선택한 업무가 없습니다.
      </aside>
    );
  }

  return (
    <aside
      className="flex h-full w-[420px] shrink-0 flex-col border-l border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]"
      data-testid="home-work-status-detail"
      aria-label="선택한 업무 상세"
    >
      <header className="flex min-h-[58px] items-start justify-between gap-3 border-b border-[var(--emr-line-hairline)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-[15px] font-semibold leading-6">선택한 업무</h2>
            <HomeTaskDecisionBadge task={task} label={getDecisionReason(task)} />
          </div>
          <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
            업무 원본 화면으로 이동하기 전 확인할 실행 맥락입니다.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0 rounded-full"
          aria-label="선택한 업무 닫기"
          onClick={onClose}
        >
          ×
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-[12px] font-semibold leading-4 text-muted-foreground">{getTaskTypeLabel(task)}</p>
            <h2 className="text-[20px] font-bold leading-7 text-foreground">{task.title}</h2>
            <p className="text-[13px] leading-5 text-muted-foreground">{task.recommendedAction}</p>
          </div>

          <div className="grid gap-2 rounded-[var(--clair-radius-atomic-8)] bg-[var(--emr-surface-muted)] p-3 text-[12px] leading-4">
            <DetailRow label="환자/보호자" value={[task.patientName, task.clientName].filter(Boolean).join(" · ") || "미지정"} />
            <DetailRow label="요청 출처" value={getRequesterLabel(task)} />
            <DetailRow label="담당" value={getAssigneeLabel(task)} />
            <DetailRow label="담당 팀" value={task.roleQueueLabel ?? task.sourceLabel} />
            <DetailRow label="시간 신호" value={getTimeSignal(task)} />
            <DetailRow label="운영 모드" value={getModeDescription(activeMode)} />
          </div>

          <div className="grid gap-2">
            <p className="text-[12px] font-semibold leading-4 text-muted-foreground">다음 판단</p>
            <div className="grid gap-1.5">
              {[getDecisionReason(task), task.sourceLabel, task.roleQueueLabel ?? task.encounterLabel ?? "관련 맥락 확인"].map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-card px-2.5 py-2 text-[12px] font-medium leading-4 text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-auto grid shrink-0 gap-2 border-t border-[var(--emr-line-hairline)] bg-card p-4">
        <Button
          size="sm"
          className="h-9 w-full justify-center rounded-[var(--clair-radius-atomic-8)] bg-foreground text-background hover:bg-foreground/90"
          onClick={() => router.push(task.actionHref)}
        >
          {task.actionLabel}
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled>
            담당 배정
          </Button>
          <Button variant="outline" size="sm" disabled>
            메모 남기기
          </Button>
        </div>
      </footer>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-foreground">{value}</span>
    </div>
  );
}

function HomeWorkstreamMultiSelect({
  columns,
  disabled = false,
  label,
  onSelectedFiltersChange,
  selectedFilters,
  tasks,
}: {
  columns: HomeKanbanColumn[];
  disabled?: boolean;
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
          disabled={disabled}
          className={cn(
            "flex h-7 w-[112px] items-center justify-between gap-1 rounded-[var(--clair-radius-atomic-8)] border border-border bg-card px-2 text-left text-[12px] font-semibold leading-4 text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
            disabled && "cursor-not-allowed opacity-45 hover:bg-card",
          )}
        >
          <span className="min-w-0 truncate">{displayLabel}</span>
          <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px] p-2" data-testid="home-workstream-filter-menu">
          <div className="grid gap-1">
            <label
              className={cn(
                "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--clair-radius-atomic-8)] border border-border bg-card px-2 py-2 text-[12px] leading-4 transition-colors hover:border-[var(--emr-state-selected-border)] hover:bg-[var(--emr-state-hover)]",
                selectedFilters.length === 0 && "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
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
                    "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--clair-radius-atomic-8)] border border-border bg-card px-2 py-2 text-[12px] leading-4 transition-colors hover:border-[var(--emr-state-selected-border)] hover:bg-[var(--emr-state-hover)]",
                    active && "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
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
  disabled = false,
  displayLabel,
  items,
  label,
  onValueChange,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  displayLabel?: string;
  items: Array<{ value: string; label: string }>;
  label: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const selectedLabel = displayLabel ?? items.find((item) => item.value === value)?.label;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] font-medium leading-4 text-muted-foreground">{label}</span>
      <Select
        disabled={disabled}
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
          {selectedLabel ? <span className="flex flex-1 text-left">{selectedLabel}</span> : <SelectValue />}
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

function HomeKanbanColumn({
  column,
  onSelectTask,
  selectedTaskId,
  tasks,
}: {
  column: HomeKanbanColumn;
  onSelectTask: (taskId: string) => void;
  selectedTaskId?: string | null;
  tasks: HomeTask[];
}) {
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
        "group/column flex min-h-0 flex-col overflow-hidden rounded-[var(--clair-radius-md)] border border-border bg-[var(--emr-surface-muted)]",
        columnCollapsed ? "h-auto" : "h-full"
      )}
    >
      <header className="flex min-h-[48px] items-center justify-between gap-3 border-b border-border px-3 py-3">
        <div className="min-w-0">
          <h2 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold leading-5">
            <span className="truncate">{column.label}</span>
            <Badge variant="outline" className="h-5 min-w-6 rounded-full bg-card px-1.5 text-[11px] font-semibold">
              {tasks.length}
            </Badge>
          </h2>
        </div>
        <button
          type="button"
          aria-expanded={!columnCollapsed}
          aria-label={`${column.label} ${columnCollapsed ? "펼치기" : "접기"}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-colors hover:bg-[var(--emr-state-hover)] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-hover/column:opacity-100"
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
                    indicatorVisible={false}
                    label={group.label}
                    onToggle={() => toggleGroup(group.id)}
                    stateIconState={false}
                    contentClassName="gap-2"
                  >
                    {group.tasks.map((task) => (
                      <HomeKanbanTaskCard
                        key={task.id}
                        selected={selectedTaskId === task.id}
                        task={task}
                        onSelect={() => onSelectTask(task.id)}
                      />
                    ))}
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

function HomeKanbanTaskCard({
  onSelect,
  selected,
  task,
}: {
  onSelect: () => void;
  selected: boolean;
  task: HomeTask;
}) {
  return (
    <EmrTaskQueueCard
      className="min-h-[108px]"
      item={getHomeTaskQueueCardItem(task)}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

function getHomeTaskQueueCardItem(task: HomeTask): EmrTaskQueueCardItem {
  return {
    actionAriaLabel: `${task.title} 더보기`,
    actionTestId: `home-kanban-task-action-${task.id}`,
    assigneeName: getAssigneeLabel(task),
    eventActorName: getRequesterLabel(task),
    eventText: `${getStatusDisplayLabel(task)} · ${getTimeSignal(task)}`,
    eventTime: getShortTime(task.dueAt),
    guardianName: task.clientName ?? "보호자 미지정",
    patientName: task.patientName ?? "환자 미지정",
    receptionType: task.receptionType ?? getTaskTypeLabel(task),
    secondLineBadgeLabel: getDecisionReason(task),
    secondLineText: task.title,
    testId: `home-kanban-task-${task.id}`,
  };
}
