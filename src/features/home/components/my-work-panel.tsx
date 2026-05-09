"use client";

import Link from "next/link";
import { ChevronRightIcon, ClipboardListIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  SegmentedControl,
  type SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import { TaskListItem } from "@/features/home/components/task-list-item";
import type {
  HomeDomainFilter,
  HomeLauncherAction,
  HomeTask,
  HomeTaskDomain,
  HomeWorkFilter,
} from "@/features/home/home.types";

type MyWorkPanelProps = {
  tasks: HomeTask[];
  launchers: HomeLauncherAction[];
  activeFilter: HomeWorkFilter;
  activeDomain: HomeDomainFilter;
  onFilterChange: (filter: HomeWorkFilter) => void;
  onDomainChange: (domain: HomeDomainFilter) => void;
};

const primaryFilters: Array<SegmentedControlItem<HomeWorkFilter>> = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "긴급" },
  { value: "dueToday", label: "오늘 마감" },
  { value: "overdue", label: "지연" },
  { value: "roleQueue", label: "미배정 큐" },
];

const domainFilters: Array<SegmentedControlItem<HomeDomainFilter>> = [
  { value: "all", label: "전체" },
  { value: "chart", label: "진료" },
  { value: "reception", label: "접수" },
  { value: "lab", label: "검사" },
  { value: "dispensing", label: "조제/처치" },
  { value: "billing", label: "수납" },
  { value: "inpatient", label: "입원" },
];

function matchesPrimaryFilter(task: HomeTask, filter: HomeWorkFilter) {
  if (filter === "urgent") return task.priority === "urgent";
  if (filter === "dueToday") return Boolean(task.dueAt);
  if (filter === "overdue") return task.status === "overdue";
  if (filter === "roleQueue") return task.assignment === "roleQueue";

  return true;
}

function matchesDomainFilter(task: HomeTask, domain: HomeDomainFilter) {
  if (domain === "all") return true;
  return task.domain === domain;
}

function getDomainCount(tasks: HomeTask[], domain: HomeTaskDomain) {
  return tasks.filter((task) => task.domain === domain).length;
}

export function MyWorkPanel({
  tasks,
  launchers,
  activeFilter,
  activeDomain,
  onFilterChange,
  onDomainChange,
}: MyWorkPanelProps) {
  const filteredTasks = tasks
    .filter((task) => matchesPrimaryFilter(task, activeFilter))
    .filter((task) => matchesDomainFilter(task, activeDomain))
    .slice(0, 7);

  const domainItems = domainFilters.map((item) =>
    item.value === "all"
      ? { ...item, count: tasks.length }
      : { ...item, count: getDomainCount(tasks, item.value) }
  );
  const hasTasks = tasks.length > 0;

  return (
    <section
      data-testid="home-my-work-panel"
      className="rounded-[var(--clair-radius-md)] border border-border bg-white p-4 lg:flex lg:h-full lg:min-h-[420px] lg:flex-col"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-8 place-items-center rounded-[var(--clair-radius-md)] bg-[var(--clair-color-background-surface)]">
            <ClipboardListIcon className="size-4 text-[var(--clair-color-primary-normal)]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold leading-6">내 업무</h2>
            <p className="text-[12px] text-muted-foreground">나에게 요청되었거나 내 역할 큐에 들어온 업무</p>
          </div>
        </div>
        <Badge variant="outline" className="h-6 rounded-md px-2">
          {tasks.length}건
        </Badge>
      </div>

      {hasTasks ? (
        <div className="mt-4 grid gap-2">
          <SegmentedControl
            value={activeFilter}
            items={primaryFilters}
            aria-label="내 업무 상태 필터"
            variant="tabs"
            onValueChange={onFilterChange}
          />
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              value={activeDomain}
              items={domainItems}
              aria-label="내 업무 영역 필터"
              className="min-w-max"
              itemClassName="px-2"
              variant="tabs"
              onValueChange={onDomainChange}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {!hasTasks ? (
          <MyWorkEmptyState launchers={launchers} />
        ) : filteredTasks.length > 0 ? (
          filteredTasks.map((task) => <TaskListItem key={task.id} task={task} />)
        ) : (
          <div className="rounded-[var(--clair-radius-md)] border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
            선택한 조건에 맞는 내 업무가 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

function MyWorkEmptyState({ launchers }: { launchers: HomeLauncherAction[] }) {
  return (
    <div className="rounded-[var(--clair-radius-md)] border border-dashed border-border bg-[var(--clair-color-background-surface)] p-4">
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold leading-6">바로 시작할 업무를 선택하세요.</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            현재 요청된 내 업무는 없지만, 역할에 맞는 큐에서 업무를 시작할 수 있습니다.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {launchers.map((launcher, index) => (
            <Link
              key={launcher.id}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "group h-auto min-h-24 items-stretch justify-between rounded-[var(--clair-radius-md)] bg-white p-3 text-left"
              )}
              href={launcher.href}
            >
              <span>
                <span className="block text-[13px] font-semibold leading-5">{launcher.label}</span>
                <span className="mt-1 block text-[11px] font-normal leading-4 text-muted-foreground">
                  {index === 0 ? "예약과 접수 큐를 확인합니다." : index === 1 ? "내원 환자를 바로 접수합니다." : "수납 대기 흐름을 엽니다."}
                </span>
              </span>
              <ChevronRightIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
