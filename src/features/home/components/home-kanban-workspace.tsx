"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  InfoIcon,
} from "@/components/icons";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  HomeMutedPill,
  HomeNextActionPriorityBadge,
  HomeTaskDecisionBadge,
  HomeTaskDecisionPill,
  HomeTaskStatusBadge,
} from "@/features/home/components/home-task-badges";
import type {
  HomeDashboardData,
  HomeKanbanColumn,
  HomeNextAction,
  HomeRoleNextActionHypothesis,
  HomeTask,
  HomeTaskStatus,
  HomeWorkspaceView,
  UserRole,
} from "@/features/home/home.types";

type HomeKanbanWorkspaceProps = {
  data: HomeDashboardData;
};

type HomeAssigneeFilter = string;
type HomeOperationMode = "flow" | "mine" | "assignment" | "delays" | "load";
type HomeWorkstreamFilter = string;

const allFilterLabel = "전체";
const unassignedFilterLabel = "미지정";

const viewLabels: Record<HomeWorkspaceView, string> = {
  home: "홈",
  hospital: "업무 현황",
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
    indicatorClassName: "bg-[var(--emr-status-danger-text)]",
    label: statusLabel.overdue,
  },
  {
    id: "requested",
    indicatorClassName: "bg-[var(--emr-status-warning-text)]",
    label: statusLabel.requested,
  },
  {
    id: "assigned",
    indicatorClassName: "bg-[var(--emr-status-neutral-text)]",
    label: statusLabel.assigned,
  },
  {
    id: "inProgress",
    indicatorClassName: "bg-[var(--emr-status-info-text)]",
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

function getModeCount(tasks: HomeTask[], mode: HomeOperationMode, myTaskIds: Set<string>) {
  if (mode === "mine") return tasks.filter((task) => myTaskIds.has(task.id)).length;
  if (mode === "assignment") return tasks.filter((task) => task.assignment === "roleQueue").length;
  if (mode === "delays") return tasks.filter((task) => task.status === "overdue" || task.priority === "urgent" || task.priority === "high").length;
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

function getViewMeta(view: HomeWorkspaceView) {
  if (view === "home") return "오늘 운영과 내 담당 업무를 한 화면에서 표시";

  return "업무 분배와 병목 조정을 위한 운영 보드";
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

function getCompactUserName(userName: string) {
  return userName
    .replace(/\s+(수의사|테크니션|수납 담당|담당|매니저|병원 관리자|관리자)님?$/, "")
    .replace(/님$/, "");
}

export function HomeKanbanWorkspace({ data }: HomeKanbanWorkspaceProps) {
  const [view, setView] = useState<HomeWorkspaceView>("home");
  const [activeOperationMode, setActiveOperationMode] = useState<HomeOperationMode>("flow");
  const [activeAssigneeFilter, setActiveAssigneeFilter] = useState<HomeAssigneeFilter>(allFilterLabel);
  const [activeWorkstreamFilters, setActiveWorkstreamFilters] = useState<HomeWorkstreamFilter[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const tasks = data.hospitalTasks;
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
  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0];
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
      className={cn(
        "h-full min-h-0 overflow-hidden bg-card",
        view === "hospital" && "max-xl:overflow-y-auto"
      )}
    >
      <section
        data-testid="home-kanban-board"
        className={cn(
          "grid h-full min-h-0 min-w-0 gap-y-5 p-4",
          view === "hospital"
            ? "grid-rows-[auto_auto_minmax(0,1fr)] max-xl:min-h-[620px]"
            : "grid-rows-[auto_minmax(0,1fr)]"
        )}
      >
        <div className="flex min-h-9 items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
          <div className="flex items-center gap-6" role="tablist" aria-label="홈 보기">
            {(["home", "hospital"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-label={item === "home" ? "대시보드 보기" : viewLabels[item]}
                aria-selected={view === item}
                className={cn(
                  "whitespace-nowrap text-[18px] font-bold leading-7 tracking-normal text-muted-foreground transition-colors hover:text-foreground",
                  view === item && "text-foreground"
                )}
                onClick={() => {
                  setView(item);
                  setActiveOperationMode("flow");
                  setActiveAssigneeFilter(allFilterLabel);
                  setActiveWorkstreamFilters([]);
                  setSelectedTaskId(null);
                }}
              >
                {viewLabels[item]}
              </button>
            ))}
          </div>
          <p className="text-[12px] leading-4 text-muted-foreground">{getViewMeta(view)}</p>
        </div>

        {view === "home" ? (
          <HomeDashboard data={data} onOpenHospitalView={() => setView("hospital")} />
        ) : (
          <>
            <div className="grid min-w-0 gap-3">
              <SegmentedControl
                value={activeOperationMode}
                items={operationModeItems}
                aria-label="업무 현황 운영 모드"
                variant="pill"
                className="w-fit max-w-full gap-2 overflow-x-auto"
                itemClassName="h-8 min-h-8 rounded-full px-4 text-[13px] font-semibold leading-5"
                onValueChange={(mode) => {
                  setActiveOperationMode(mode);
                  setActiveAssigneeFilter(allFilterLabel);
                  setActiveWorkstreamFilters([]);
                  setSelectedTaskId(null);
                }}
              />
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <HospitalBoardSummary
                  activeMode={activeOperationMode}
                  columns={data.columns}
                  filteredTasks={filteredTasks}
                  tasks={tasks}
                  onColumnFocus={(columnLabel) => {
                    setActiveWorkstreamFilters([columnLabel]);
                    setSelectedTaskId(null);
                  }}
                />
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <HomeFilterSelect
                    label="담당자"
                    ariaLabel="담당자 필터"
                    value={activeAssigneeFilter}
                    items={assigneeFilterItems}
                    onValueChange={(value) => {
                      setActiveAssigneeFilter(value as HomeAssigneeFilter);
                      setSelectedTaskId(null);
                    }}
                  />
                  <HomeWorkstreamMultiSelect
                    label="업무"
                    columns={data.columns}
                    tasks={scopedTasks}
                    selectedFilters={activeWorkstreamFilters}
                    onSelectedFiltersChange={(filters) => {
                      setActiveWorkstreamFilters(filters);
                      setSelectedTaskId(null);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-3 max-xl:grid-cols-1">
              <div className="min-h-0 overflow-x-auto pb-2">
                <div className="grid h-full min-h-[560px] grid-flow-col auto-cols-[280px] items-start gap-3 max-sm:auto-cols-[248px]">
                  {visibleColumns.map((column) => (
                    <HomeKanbanColumn
                      key={column.id}
                      column={column}
                      selectedTaskId={selectedTask?.id}
                      tasks={filteredTasks.filter((task) => task.kanbanColumn === column.id)}
                      onSelectTask={setSelectedTaskId}
                    />
                  ))}
                </div>
              </div>
              <HospitalTaskDetailPanel activeMode={activeOperationMode} task={selectedTask} />
            </div>
          </>
        )}
      </section>

    </div>
  );
}

function HospitalBoardSummary({
  activeMode,
  columns,
  filteredTasks,
  onColumnFocus,
  tasks,
}: {
  activeMode: HomeOperationMode;
  columns: HomeKanbanColumn[];
  filteredTasks: HomeTask[];
  onColumnFocus: (columnLabel: string) => void;
  tasks: HomeTask[];
}) {
  const overdueCount = filteredTasks.filter((task) => task.status === "overdue").length;
  const urgentCount = getUrgentCount(filteredTasks);
  const unassignedCount = filteredTasks.filter((task) => task.assignment === "roleQueue").length;
  const workload = Array.from(
    tasks.reduce<Map<string, number>>((counts, task) => {
      const assignee = getAssigneeLabel(task);
      counts.set(assignee, (counts.get(assignee) ?? 0) + 1);
      return counts;
    }, new Map())
  ).sort((first, second) => second[1] - first[1]);
  const busiestAssignee = workload[0];

  return (
    <div className="grid min-w-0 flex-1 gap-2">
      <div className="grid grid-cols-4 gap-2 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <HospitalBoardSignal label="현재 모드" value={getModeDescription(activeMode)} />
        <HospitalBoardSignal label="미배정" tone={unassignedCount > 0 ? "warning" : "normal"} value={`${unassignedCount}건`} />
        <HospitalBoardSignal label="지연/주의" tone={urgentCount + overdueCount > 0 ? "danger" : "normal"} value={`${urgentCount + overdueCount}건`} />
        <HospitalBoardSignal label="최다 부하" value={busiestAssignee ? `${busiestAssignee[0]} ${busiestAssignee[1]}건` : "없음"} />
      </div>
      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5" aria-label="업무 흐름 빠른 이동">
        {columns.map((column) => {
          const count = filteredTasks.filter((task) => task.kanbanColumn === column.id).length;

          return (
            <button
              key={column.id}
              type="button"
              className="grid min-w-[112px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--clair-radius-atomic-8)] border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              onClick={() => onColumnFocus(column.label)}
            >
              <span className="truncate text-[12px] font-semibold leading-4 text-muted-foreground">{column.label}</span>
              <span className="text-[12px] font-bold leading-4 text-foreground">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HospitalBoardSignal({
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
        "grid min-h-[54px] content-center gap-1 rounded-[var(--clair-radius-atomic-8)] border border-border bg-card px-3 py-2",
        tone === "danger" && "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)]",
        tone === "warning" && "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]"
      )}
    >
      <span className="text-[11px] font-semibold leading-3 text-muted-foreground">{label}</span>
      <span className="truncate text-[13px] font-bold leading-5 text-foreground">{value}</span>
    </div>
  );
}

function HospitalTaskDetailPanel({
  activeMode,
  task,
}: {
  activeMode: HomeOperationMode;
  task?: HomeTask;
}) {
  const router = useRouter();

  if (!task) {
    return (
      <aside className="min-h-[240px] rounded-[var(--clair-radius-md)] border border-dashed border-border bg-card p-4 text-[13px] leading-5 text-muted-foreground">
        선택한 업무가 없습니다.
      </aside>
    );
  }

  return (
    <aside
      className="grid min-h-0 content-start gap-4 overflow-y-auto rounded-[var(--clair-radius-md)] border border-border bg-card p-4"
      data-testid="home-work-status-detail"
    >
      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-4 text-muted-foreground">{getTaskTypeLabel(task)}</p>
            <h2 className="mt-1 text-[18px] font-bold leading-7 text-foreground">{task.title}</h2>
          </div>
          <HomeTaskDecisionBadge task={task} label={getDecisionReason(task)} />
        </div>
        <p className="text-[13px] leading-5 text-muted-foreground">{task.recommendedAction}</p>
      </div>

      <div className="grid gap-2 rounded-[var(--clair-radius-atomic-8)] bg-muted/50 p-3 text-[12px] leading-4">
        <DetailRow label="환자/보호자" value={[task.patientName, task.clientName].filter(Boolean).join(" · ") || "미지정"} />
        <DetailRow label="요청 출처" value={getRequesterLabel(task)} />
        <DetailRow label="담당" value={getAssigneeLabel(task)} />
        <DetailRow label="시간 신호" value={getTimeSignal(task)} />
        <DetailRow label="운영 모드" value={getModeDescription(activeMode)} />
      </div>

      <div className="grid gap-2">
        <p className="text-[12px] font-semibold leading-4 text-muted-foreground">다음 판단</p>
        <div className="grid gap-1.5">
          {[getDecisionReason(task), task.sourceLabel, task.roleQueueLabel ?? task.encounterLabel ?? "관련 맥락 확인"].map((item) => (
            <span
              key={item}
              className="rounded-[var(--clair-radius-atomic-8)] border border-border bg-card px-2.5 py-2 text-[12px] font-medium leading-4 text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Button size="sm" onClick={() => router.push(task.actionHref)}>
          {task.actionLabel}
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={task.assignment !== "roleQueue"}>
            담당 배정
          </Button>
          <Button variant="outline" size="sm" disabled>
            메모 남기기
          </Button>
        </div>
      </div>
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

function HomeDashboard({
  data,
  onOpenHospitalView,
}: {
  data: HomeDashboardData;
  onOpenHospitalView: () => void;
}) {
  const [activeRole, setActiveRole] = useState<UserRole>(data.role);
  const urgentTasks = data.hospitalTasks.filter((task) => task.priority === "urgent" || task.priority === "high");
  const overdueTasks = data.hospitalTasks.filter((task) => task.status === "overdue");
  const waitingTasks = data.hospitalTasks.filter((task) => task.kanbanColumn === "waiting" || task.kanbanColumn === "chart");
  const roleQueueCount = data.hospitalTasks.filter((task) => task.assignment === "roleQueue").length;
  const bottleneck = [...data.flowSummary].sort((first, second) => second.count - first.count)[0];
  const activeRoleHypothesis =
    data.roleNextActions.find((item) => item.role === activeRole) ?? data.roleNextActions[0];
  const outlineTasks = [...data.tasks, ...data.hospitalTasks]
    .filter((task, index, tasks) => tasks.findIndex((item) => item.id === task.id) === index)
    .slice(0, 9);

  return (
    <div
      data-testid="home-dashboard"
      className="min-h-0 overflow-y-auto rounded-[var(--clair-radius-md)] bg-[linear-gradient(180deg,var(--emr-surface-muted)_0%,var(--emr-surface-workspace)_44%,var(--emr-surface-workspace)_100%)] pb-4"
    >
      <div className="grid min-h-full content-start gap-4 p-3">
        <HomeShiftOverview
          data={data}
          hospitalSignal={{
            bottleneckLabel: bottleneck?.label ?? "대기열",
            overdueCount: overdueTasks.length,
            roleQueueCount,
            urgentCount: urgentTasks.length,
            waitingCount: waitingTasks.length,
          }}
          onOpenHospitalView={onOpenHospitalView}
        />

        <RoleNextActionCommandCenter
          activeRole={activeRole}
          hospitalSignal={{
            bottleneckLabel: bottleneck?.label ?? "대기열",
            overdueCount: overdueTasks.length,
            roleQueueCount,
            urgentCount: urgentTasks.length,
            waitingCount: waitingTasks.length,
          }}
          hypotheses={data.roleNextActions}
          selectedHypothesis={activeRoleHypothesis}
          onRoleChange={setActiveRole}
        />

        <DashboardBottleneckBoard flowSummary={data.flowSummary} bottleneckId={bottleneck?.id} />

        <DashboardOutlineTable
          tasks={outlineTasks}
          urgentCount={urgentTasks.length}
          waitingCount={waitingTasks.length}
          onOpenHospitalView={onOpenHospitalView}
        />
      </div>
    </div>
  );
}

function HomeShiftOverview({
  data,
  hospitalSignal,
  onOpenHospitalView,
}: {
  data: HomeDashboardData;
  hospitalSignal: {
    bottleneckLabel: string;
    overdueCount: number;
    roleQueueCount: number;
    urgentCount: number;
    waitingCount: number;
  };
  onOpenHospitalView: () => void;
}) {
  return (
    <section className="grid gap-3 rounded-[var(--clair-radius-lg)] border border-[var(--emr-line-hairline)] bg-card p-4 shadow-[var(--clair-shadow-sm)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 max-lg:grid-cols-1">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] px-2.5 py-1 text-[12px] font-semibold leading-4 text-[var(--emr-status-info-text)]">
              {data.hospitalName}
            </span>
            <span className="rounded-full border border-[var(--emr-line-hairline)] bg-card px-2.5 py-1 text-[12px] font-semibold leading-4 text-foreground">
              {getCompactUserName(data.userName)} · {data.roleLabel}
            </span>
            <span className="text-[12px] font-medium leading-4 text-muted-foreground">
              {data.todayLabel} · {data.updatedAt.slice(11, 16)} 갱신
            </span>
          </div>
          <h2 className="mt-3 text-[26px] font-bold leading-8 text-foreground max-sm:text-[22px]">
            오늘의 워크 커맨드
          </h2>
          <p className="mt-2 max-w-[720px] text-[13px] leading-5 text-muted-foreground">
            환자 흐름, 긴급 신호, 미배정 큐를 하나로 묶어 지금 열어야 할 업무부터 보여줍니다.
          </p>
        </div>
        <Button size="sm" onClick={onOpenHospitalView}>
          업무 현황 열기
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <ShiftMetricCard label="내 업무" value={`${data.tasks.length}건`} caption={data.roleLabel} tone="info" />
        <ShiftMetricCard label="긴급/주의" value={`${hospitalSignal.urgentCount}건`} caption="먼저 확인" tone="danger" />
        <ShiftMetricCard label="대기/진료" value={`${hospitalSignal.waitingCount}건`} caption="환자 흐름" tone="neutral" />
        <ShiftMetricCard label="미배정 큐" value={`${hospitalSignal.roleQueueCount}건`} caption={hospitalSignal.bottleneckLabel} tone="warning" />
      </div>
    </section>
  );
}

function ShiftMetricCard({
  caption,
  label,
  tone,
  value,
}: {
  caption: string;
  label: string;
  tone: "danger" | "info" | "neutral" | "warning";
  value: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-[86px] content-between rounded-[var(--clair-radius-md)] border bg-[var(--emr-surface-panel)] p-3 shadow-[var(--clair-shadow-xs)]",
        tone === "danger" && "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)]",
        tone === "info" && "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)]",
        tone === "warning" && "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]",
        tone === "neutral" && "border-[var(--emr-line-hairline)]"
      )}
    >
      <span className="text-[12px] font-semibold leading-4 text-muted-foreground">{label}</span>
      <span className="flex items-end justify-between gap-2">
        <strong className="text-[24px] font-bold leading-7 text-foreground">{value}</strong>
        <span className="truncate text-[12px] font-medium leading-4 text-muted-foreground">{caption}</span>
      </span>
    </div>
  );
}

function RoleNextActionCommandCenter({
  activeRole,
  hospitalSignal,
  hypotheses,
  onRoleChange,
  selectedHypothesis,
}: {
  activeRole: UserRole;
  hospitalSignal: {
    bottleneckLabel: string;
    overdueCount: number;
    roleQueueCount: number;
    urgentCount: number;
    waitingCount: number;
  };
  hypotheses: HomeRoleNextActionHypothesis[];
  onRoleChange: (role: UserRole) => void;
  selectedHypothesis: HomeRoleNextActionHypothesis;
}) {
  return (
    <section
      aria-labelledby="home-role-next-action-title"
      className="relative isolate grid gap-4 overflow-hidden rounded-[var(--clair-radius-lg)] border border-[var(--emr-line-hairline)] bg-[linear-gradient(135deg,var(--emr-surface-panel)_0%,var(--emr-surface-panel)_58%,var(--emr-status-info-bg)_100%)] p-4 shadow-[var(--clair-shadow-md)]"
      data-testid="home-role-next-action"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--emr-status-info-text),var(--emr-status-success-text),var(--emr-status-warning-text))]" />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 max-lg:grid-cols-1">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold leading-4 text-[var(--emr-status-info-text)]">Next best actions</p>
          <h2 id="home-role-next-action-title" className="mt-1 text-[20px] font-bold leading-7 text-foreground">
            다음 행동
          </h2>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
            {selectedHypothesis.roleLabel} 기준으로 먼저 처리할 업무와 판단 근거를 표시합니다.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 max-lg:justify-start" role="tablist" aria-label="역할별 다음 행동 보기">
          {hypotheses.map((item) => (
            <button
              key={item.role}
              type="button"
              role="tab"
              aria-selected={activeRole === item.role}
              className={cn(
                "h-8 rounded-full border px-3 text-[12px] font-semibold leading-4 shadow-[var(--clair-shadow-xs)] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                activeRole === item.role
                  ? "border-foreground bg-foreground text-background"
                  : "border-[var(--emr-line-hairline)] bg-card text-muted-foreground hover:bg-[var(--emr-state-hover)]"
              )}
              onClick={() => onRoleChange(item.role)}
            >
              {item.roleLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-3 max-xl:grid-cols-1">
        <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
          {selectedHypothesis.actions.map((action, index) => (
            <NextActionCard key={action.id} action={action} rank={index + 1} />
          ))}
        </div>

        <aside className="grid content-between gap-4 rounded-[var(--clair-radius-md)] border border-[var(--emr-line-hairline)] bg-card/85 p-4 shadow-[var(--clair-shadow-xs)]">
          <div>
            <p className="text-[12px] font-semibold leading-4 text-muted-foreground">역할 가설</p>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-foreground">
              {selectedHypothesis.hypothesis}
            </p>
          </div>
          <div className="grid gap-2 text-[12px] leading-4">
            <div className="rounded-[var(--clair-radius-atomic-8)] bg-[var(--emr-surface-muted)] px-3 py-2">
              <span className="font-semibold text-foreground">신호 </span>
              <span className="text-muted-foreground">{selectedHypothesis.primarySignal}</span>
            </div>
            <div className="rounded-[var(--clair-radius-atomic-8)] bg-[var(--emr-surface-muted)] px-3 py-2">
              <span className="font-semibold text-foreground">측정 </span>
              <span className="text-muted-foreground">{selectedHypothesis.successMetric}</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <SignalPill label="현재 병목" value={hospitalSignal.bottleneckLabel} />
        <SignalPill label="대기/진료" value={`${hospitalSignal.waitingCount}건`} />
        <SignalPill label="긴급/주의" value={`${hospitalSignal.urgentCount}건`} tone="danger" />
        <SignalPill label="미배정 큐" value={`${hospitalSignal.roleQueueCount}건`} tone="warning" />
      </div>
    </section>
  );
}

function NextActionCard({ action, rank }: { action: HomeNextAction; rank: number }) {
  const router = useRouter();
  const primary = rank === 1;

  return (
    <article
      className={cn(
        "relative grid min-h-[208px] content-between gap-4 overflow-hidden rounded-[var(--clair-radius-md)] border bg-card p-4 shadow-[var(--clair-shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--clair-shadow-md)]",
        getNextActionToneClass(action.tone),
        primary && "shadow-[var(--clair-shadow-md)]"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", getNextActionAccentClass(action.tone))} aria-hidden="true" />
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold leading-4 shadow-[var(--clair-shadow-xs)]",
                primary ? "bg-foreground text-background" : "bg-[var(--emr-surface-muted)] text-foreground"
              )}>
                {rank}
              </span>
              <span className="truncate text-[12px] font-semibold leading-4 text-muted-foreground">{action.sourceLabel}</span>
            </div>
            <h3 className="mt-3 text-[17px] font-bold leading-6 text-foreground">
              {action.title}
            </h3>
          </div>
          <HomeNextActionPriorityBadge action={action} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] leading-4 text-muted-foreground">
          {action.patientName ? <span className="font-semibold text-foreground">{action.patientName}</span> : null}
          {action.clientName ? <span>{action.clientName}</span> : null}
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {action.dueLabel}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {action.evidence.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold leading-3 text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <Button
        size="sm"
        variant={primary ? "default" : "outline"}
        className="w-fit"
        onClick={() => router.push(action.actionHref)}
      >
        {action.actionLabel}
        <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </article>
  );
}

function SignalPill({
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
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-card/90 px-3 py-2 shadow-[var(--clair-shadow-xs)]",
        tone === "danger" && "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)]",
        tone === "warning" && "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]"
      )}
    >
      <span className="text-[11px] font-semibold leading-3 text-muted-foreground">{label}</span>
      <span className="truncate text-right text-[13px] font-bold leading-5 text-foreground">{value}</span>
    </div>
  );
}

function getNextActionToneClass(tone: HomeNextAction["tone"]) {
  if (tone === "danger") return "border-[var(--emr-status-danger-border)] bg-[linear-gradient(180deg,var(--emr-status-danger-bg),var(--emr-surface-panel))]";
  if (tone === "warning") return "border-[var(--emr-status-warning-border)] bg-[linear-gradient(180deg,var(--emr-status-warning-bg),var(--emr-surface-panel))]";
  if (tone === "attention") return "border-[var(--emr-status-info-border)] bg-[linear-gradient(180deg,var(--emr-status-info-bg),var(--emr-surface-panel))]";

  return "border-[var(--emr-line-hairline)]";
}

function getNextActionAccentClass(tone: HomeNextAction["tone"]) {
  if (tone === "danger") return "bg-[var(--emr-status-danger-text)]";
  if (tone === "warning") return "bg-[var(--emr-status-warning-text)]";
  if (tone === "attention") return "bg-[var(--emr-status-info-text)]";

  return "bg-[var(--emr-status-neutral-text)]";
}

function DashboardBottleneckBoard({
  bottleneckId,
  flowSummary,
}: {
  bottleneckId?: string;
  flowSummary: HomeDashboardData["flowSummary"];
}) {
  const router = useRouter();
  const maxCount = Math.max(...flowSummary.map((item) => item.count), 1);
  const bottleneck = flowSummary.find((item) => item.id === bottleneckId) ?? flowSummary[0];

  return (
    <section
      className="grid gap-4 rounded-[var(--clair-radius-lg)] border border-[var(--emr-line-hairline)] bg-card p-4 shadow-[var(--clair-shadow-sm)]"
      data-testid="home-dashboard-flow"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-bold leading-6 text-foreground">운영 병목 보드</h2>
            <span className="rounded-full border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[var(--emr-status-warning-text)]">
              현재 병목 {bottleneck?.label ?? "대기열"}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
            홈에서는 병목을 압축해서 보여주고, 상세 조정은 업무 현황으로 이동합니다.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {["오늘", "7일", "30일"].map((label, index) => (
            <button
              key={label}
              type="button"
              className={cn(
                "h-7 rounded-full border px-3 text-[12px] font-semibold leading-4 transition-colors hover:bg-[var(--emr-state-hover)]",
                index === 0 ? "border-foreground bg-foreground text-background hover:bg-foreground" : "border-[var(--emr-line-hairline)] bg-card text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 max-xl:grid-cols-3 max-md:grid-cols-2">
        {flowSummary.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "grid min-h-[104px] content-between rounded-[var(--clair-radius-md)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-3 text-left shadow-[var(--clair-shadow-xs)] transition-[background-color,border-color,box-shadow] hover:bg-[var(--emr-state-hover)] hover:shadow-[var(--clair-shadow-sm)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              item.id === bottleneckId && "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]"
            )}
            onClick={() => router.push(item.href)}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="truncate text-[13px] font-bold leading-5 text-foreground">{item.label}</span>
              <span className="shrink-0 rounded-full bg-card/70 px-2 py-0.5 text-[11px] font-bold leading-4 text-muted-foreground">
                {item.count}건
              </span>
            </span>
            <span className="grid gap-1.5 text-[12px] leading-4 text-muted-foreground">
              <span className="truncate">{item.slaLabel ?? item.detail ?? "SLA 확인"}</span>
              <span className="h-1.5 rounded-full bg-[var(--emr-surface-muted)]">
                <span
                  className="block h-full rounded-full bg-[var(--emr-text-primary)]"
                  style={{ width: `${Math.max(16, (item.count / maxCount) * 100)}%` }}
                />
              </span>
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span>지연 <b className="text-foreground">{item.overdueCount ?? 0}</b></span>
                <span>미배정 <b className="text-foreground">{item.unassignedCount ?? 0}</b></span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[var(--clair-radius-atomic-8)] bg-[var(--emr-surface-muted)] px-3 py-2">
        <InfoIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-[12px] leading-4 text-muted-foreground">
          현재 병목은 {flowSummary.find((item) => item.id === bottleneckId)?.label ?? "대기열"} 단계입니다.
        </span>
      </div>
    </section>
  );
}

function DashboardOutlineTable({
  onOpenHospitalView,
  tasks,
  urgentCount,
  waitingCount,
}: {
  onOpenHospitalView: () => void;
  tasks: HomeTask[];
  urgentCount: number;
  waitingCount: number;
}) {
  const router = useRouter();
  const tabs = [
    { count: tasks.length, label: "전체 업무" },
    { count: waitingCount, label: "대기 환자" },
    { count: urgentCount, label: "긴급 확인" },
    { count: tasks.filter((task) => task.assignment === "roleQueue").length, label: "공용 큐" },
  ];

  return (
    <Card className="rounded-[var(--clair-radius-md)]" data-testid="home-dashboard-outline">
      <CardHeader className="gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>오늘 업무 아웃라인</CardTitle>
            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">환자 흐름과 담당 업무를 표 형태로 스캔합니다.</p>
          </div>
          <CardAction className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onOpenHospitalView}>
              업무 현황
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </CardAction>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              className={cn(
                "h-7 rounded-[var(--clair-radius-atomic-8)] px-3 text-[12px] font-semibold leading-4 transition-colors hover:bg-muted",
                index === 0 ? "bg-foreground text-background hover:bg-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {tab.label}
              <span className="ml-1 opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10 pl-5">
                <Checkbox aria-label="전체 업무 선택" />
              </TableHead>
              <TableHead>업무</TableHead>
              <TableHead className="w-[132px]">구분</TableHead>
              <TableHead className="w-[118px]">상태</TableHead>
              <TableHead className="w-[170px]">환자/보호자</TableHead>
              <TableHead className="w-[132px]">담당</TableHead>
              <TableHead className="w-[86px] text-right">기한</TableHead>
              <TableHead className="w-[92px] pr-5 text-right">이동</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} data-testid={`home-dashboard-task-${task.id}`}>
                <TableCell className="pl-5">
                  <Checkbox aria-label={`${task.title} 선택`} />
                </TableCell>
                <TableCell className="min-w-[260px]">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-5">{task.title}</p>
                    <p className="truncate text-[12px] leading-4 text-muted-foreground">{task.recommendedAction}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-card">{getTaskTypeLabel(task)}</Badge>
                </TableCell>
                <TableCell>
                  <HomeTaskStatusBadge task={task} label={getStatusDisplayLabel(task)} />
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium leading-5">{task.patientName ?? "환자 미지정"}</p>
                    <p className="truncate text-[12px] leading-4 text-muted-foreground">{task.clientName ?? "보호자 미지정"}</p>
                  </div>
                </TableCell>
                <TableCell className="text-[13px]">{getAssigneeLabel(task)}</TableCell>
                <TableCell className="text-right text-[12px] text-muted-foreground">{getShortTime(task.dueAt ?? task.requestedAt)}</TableCell>
                <TableCell className="pr-5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => router.push(task.actionHref)}>
                    {task.actionLabel}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-[13px] text-muted-foreground" colSpan={8}>
                  오늘 표시할 업무가 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
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

function HomeKanbanColumn({
  column,
  onSelectTask,
  selectedTaskId,
  tasks,
}: {
  column: HomeKanbanColumn;
  onSelectTask: (taskId: string) => void;
  selectedTaskId?: string;
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
                    indicatorClassName={group.indicatorClassName}
                    label={group.label}
                    onToggle={() => toggleGroup(group.id)}
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
  const router = useRouter();

  return (
    <EmrSidePanelCard
      selected={selected}
      className="min-h-[132px]"
      testId={`home-kanban-task-${task.id}`}
      onSelect={onSelect}
    >
      <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--emr-text-secondary)]">
          <span className="truncate">{task.patientName ?? "환자 미지정"}</span>
          <span className="shrink-0 text-[var(--emr-text-tertiary)]">·</span>
          <span className="truncate">{task.clientName ?? "보호자 미지정"}</span>
          <EmrSidePanelTypeBadge label={task.receptionType ?? "접수"} />
        </div>
        <EmrSidePanelCardAction
          ariaLabel={`${task.title} 더보기`}
          testId={`home-kanban-task-action-${task.id}`}
        />
      </div>
      <div className="mt-0.5 flex min-h-5 min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--emr-text-tertiary)]">
        <span className="min-w-0 flex-1 truncate">{task.title}</span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap gap-1">
        <HomeTaskDecisionPill task={task} label={getDecisionReason(task)} />
        <HomeMutedPill label={getTimeSignal(task)} />
      </div>
      <div className="my-1.5 h-px w-full bg-[var(--emr-line-subtle)]" />
      <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-1">
        <EmrSidePanelMetaBadge label="요청" maxWidthClassName="max-w-[70px]" value={getRequesterLabel(task)} />
        <EmrSidePanelMetaBadge label="담당" maxWidthClassName="max-w-[70px]" value={getAssigneeLabel(task)} />
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-[11px] font-semibold"
          onClick={(event) => {
            event.stopPropagation();
            router.push(task.actionHref);
          }}
        >
          {task.actionLabel}
        </Button>
      </div>
    </EmrSidePanelCard>
  );
}
