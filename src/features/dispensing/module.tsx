"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  MenuIcon,
  PrinterIcon,
} from "@/components/icons";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesDocumentAltFillIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
} from "@/components/emr/subpanel";
import {
  EmrInstructionHeaderStack,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrOrderGroupSection } from "@/components/emr/order-group-section";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import {
  getOrderQueueItems,
  getOrderQueueStatuses,
  getSelectedOrderQueueItem,
} from "@/features/order-queue/data";
import {
  allOrderRows,
  currentTechnician,
  getOrderTableGroupsForQueueItem,
  historyGroups,
  patient,
  technicianUsers,
  type OrderTableGroup,
} from "@/features/dispensing/data";
import type { Order, OrderQueueItem, ShellComponentProps, TechnicianUser } from "@/types/emr";

type OrderGroupFilter = "all" | "oral" | "other";
type DispensingContentBodyProps = Pick<
  ShellComponentProps,
  "hasRightPanel" | "moduleId" | "moduleLabel"
> & {
  selectedQueueItem: OrderQueueItem | null;
};

const HISTORY_GROUP_EASE = [0.16, 1, 0.3, 1] as const;
const HISTORY_GROUP_EXIT_EASE = [0.32, 0, 0.67, 0] as const;

function splitHistoryItem(item: string) {
  const [category, ...rest] = item.split(" ");

  if (!rest.length || item.startsWith("[")) {
    return { title: item, category: null, description: null };
  }

  return {
    title: rest.join(" "),
    category,
    description: rest.join(" "),
  };
}

function getQueueStatusLabel(moduleId: string, item: OrderQueueItem | null) {
  if (!item) return "대기중";

  return getOrderQueueStatuses(moduleId).find((status) => status.id === item.statusId)?.label ?? item.statusId;
}

function getQueuePatientSummary(item: OrderQueueItem | null) {
  if (!item) return `${patient.name}(${patient.age}) · 코리...`;

  return `${item.patientName}(${item.patientAge ?? patient.age}) · ${item.patientBreed ?? patient.breed}`;
}

export function DispensingSidePanel() {
  const { selectedQueueItemIds, setModulePanelOpen, setSelectedQueueItem } = useLayoutStore();
  const items = getOrderQueueItems("dispensing");
  const statuses = getOrderQueueStatuses("dispensing");

  return (
    <EmrOrderQueueSidePanel
      items={items}
      statuses={statuses}
      title="조제/처치"
      selectedItemId={selectedQueueItemIds.dispensing}
      onCollapse={() => setModulePanelOpen(false)}
      onSelectItem={(itemId) => setSelectedQueueItem("dispensing", itemId)}
    />
  );
}

export function DispensingHeader({ hasRightPanel, moduleId }: ShellComponentProps) {
  const {
    contentAsideOpen,
    rightPanelOpen,
    selectedQueueItemIds,
    setContentAsideOpen,
    setRightPanelOpen,
  } =
    useLayoutStore();
  const selectedQueueItem = getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);

  return (
    <EmrPatientContextBar
      historyButton={{
        controls: "dispensing-content-aside",
        expanded: contentAsideOpen,
        label: "조제이력",
        onClick: () => setContentAsideOpen(!contentAsideOpen),
      }}
      patientItems={[
        { label: "환자", value: selectedQueueItem?.patientName ?? patient.name },
        { label: "보호자", value: selectedQueueItem?.guardianName ?? patient.guardian },
        { label: "품종", value: selectedQueueItem?.patientBreed ?? patient.breed },
        { label: "나이", value: selectedQueueItem?.patientAge ?? patient.age },
        { label: "성별", value: selectedQueueItem?.patientSex ?? patient.sex },
      ]}
      vitalItems={[
        { label: "체중", value: selectedQueueItem?.patientWeight ?? patient.weight },
        { label: "체온", value: selectedQueueItem?.patientTemperature ?? patient.temperature },
        { label: "호흡", value: selectedQueueItem?.patientRespiration ?? patient.respiration },
        { label: "혈압", value: selectedQueueItem?.patientBloodPressure ?? patient.bloodPressure },
      ]}
      memoActions={[
        { label: "방문목적" },
        { label: "보호자메모", locked: true },
        { label: "환자메모" },
        { label: "수납메모", disabled: true },
      ]}
      onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
      rightPanelDisabled={!hasRightPanel}
      rightPanelOpen={rightPanelOpen}
    />
  );
}

export function DispensingContentAside() {
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const totalHistoryCount = historyGroups.reduce((total, group) => total + group.count, 0);
  const toggleHistoryGroup = (date: string) => {
    setCollapsedHistoryGroups((current) => {
      const next = new Set(current);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return next;
    });
  };

  return (
    <div
      id="dispensing-content-aside"
      className="flex h-full w-full flex-col gap-2 bg-[var(--clair-color-atomic-neutral-50)] px-4 pt-4"
    >
      <HistoryListHeader count={totalHistoryCount} onCollapse={() => setContentAsideOpen(false)} />
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {historyGroups.map((group) => (
            <HistoryGroup
              key={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              group={group}
              onToggle={() => toggleHistoryGroup(group.date)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DispensingRightPanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-col justify-center border-b px-3">
        <div className="text-sm font-semibold">환자 사이드 패널</div>
        <div className="text-[11px] text-muted-foreground">환자 컨텍스트와 작업 참고 정보</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {[
            ["조제 참고", "환자의 최근 조제 이력과 주의 메모를 확인하는 영역입니다."],
            ["보호자 메모", "복약 안내 전 확인해야 하는 보호자 전달사항을 표시합니다."],
            ["환자 메모", "처치와 조제 업무에서 함께 참고할 환자 특이사항을 표시합니다."],
          ].map(([title, description]) => (
            <section key={title} className="rounded-md border bg-card p-3">
              <div className="font-semibold">{title}</div>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                {description}
              </p>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function HistoryListHeader({ count, onCollapse }: { count: number; onCollapse: () => void }) {
  return (
    <EmrListHeader
      className="mx-0 h-6 border-y-0"
      count={count}
      label="조제이력"
      leadingAction={
        <EmrListHeaderIconButton ariaLabel="이력 패널 접기" iconSize="md" onClick={onCollapse}>
          <CdsNavigationChevronsLeftIcon className="size-4" />
        </EmrListHeaderIconButton>
      }
      headerActions={
        <>
          <EmrListHeaderIconButton ariaLabel="정렬">
            <CdsUtilitiesSortIcon className="size-4" />
          </EmrListHeaderIconButton>
          <EmrListHeaderIconButton ariaLabel="필터">
            <CdsActionsListFilterIcon className="size-4" />
          </EmrListHeaderIconButton>
          <EmrListHeaderIconButton ariaLabel="검색">
            <CdsActionsSearchIcon className="size-4" />
          </EmrListHeaderIconButton>
        </>
      }
    />
  );
}

function HistoryGroup({
  collapsed,
  group,
  onToggle,
}: {
  collapsed: boolean;
  group: (typeof historyGroups)[number];
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.24, ease: HISTORY_GROUP_EASE },
        opacity: { duration: 0.14, ease: "easeOut" },
        y: { duration: 0.2, ease: HISTORY_GROUP_EASE },
      };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.18, ease: HISTORY_GROUP_EXIT_EASE },
        opacity: { duration: 0.12, ease: "easeIn" },
        y: { duration: 0.16, ease: HISTORY_GROUP_EXIT_EASE },
      };

  return (
    <section className="flex flex-col gap-1 rounded-[10px]" data-testid={`history-group-${group.date}`}>
      <button
        type="button"
        className="flex h-8 w-full items-center justify-between rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-(--clair-color-atomic-black-alpha-8) focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={!collapsed}
        data-testid={`history-group-toggle-${group.date}`}
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.019em]">
          <span className="truncate text-[var(--clair-color-label-alternative)]">{group.date}</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{group.count}</span>
        </div>
        <motion.span
          className="flex size-4 shrink-0 items-center justify-center text-[var(--clair-color-label-alternative)]"
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: HISTORY_GROUP_EASE }}
        >
          <ChevronDownIcon className="size-4 shrink-0 text-[var(--clair-color-label-alternative)]" />
        </motion.span>
      </button>
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <motion.div
            key={`${group.date}-items`}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0, transition: contentTransition }}
            exit={{ height: 0, opacity: 0, y: -4, transition: contentExitTransition }}
          >
            {group.items.map((item) => (
              <HistoryItem key={item} item={item} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function HistoryItem({ item }: { item: string }) {
  const { title, category, description } = splitHistoryItem(item);

  return (
    <>
      <div
        className="flex min-h-[58px] flex-col gap-1.5 rounded-[var(--clair-radius-sm)] px-1 py-1 outline-none transition-colors hover:bg-(--clair-color-atomic-black-alpha-4) focus-visible:bg-(--clair-color-atomic-black-alpha-4) focus-visible:ring-3 focus-visible:ring-ring/50"
        tabIndex={0}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="truncate text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
            {title}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
            {category ? <span className="shrink-0">{category}</span> : null}
            {description ? <span className="truncate text-[var(--clair-color-atomic-gray-500)]">{description}</span> : null}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
          <span className="truncate">담당자명</span>
          <span className="truncate">담당자명</span>
          <span className="shrink-0">10:30 요청</span>
        </div>
      </div>
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
    </>
  );
}

function cloneOrderTableGroups(queueItemId?: string): OrderTableGroup[] {
  return getOrderTableGroupsForQueueItem(queueItemId).map((group) => ({
    ...group,
    assigneeIds: [...group.assigneeIds],
    rows: group.rows.map((row) => ({
      ...row,
      diffs: row.diffs ? { ...row.diffs } : undefined,
    })),
  }));
}

function isEditableOrder(row: Order) {
  return row.status !== "완료" && row.status !== "취소" && row.workStatus !== "완료";
}

function findTechnician(technicianId: string) {
  return technicianUsers.find((technician) => technician.id === technicianId) ?? currentTechnician;
}

function assignOrder(row: Order, technician: TechnicianUser): Order {
  return {
    ...row,
    assigneeId: technician.id,
    assignee: technician.name,
    assigneeInitial: technician.initial,
  };
}

function clearOrderAssignee(row: Order): Order {
  return {
    ...row,
    assigneeId: undefined,
    assignee: "미지정",
    assigneeInitial: "미",
  };
}

function getRequestedStatus(row: Order) {
  return row.warningMessage || row.diffs ? "재요청" : "요청";
}

function getGroupAssigneeIds(rows: Order[]) {
  return Array.from(
    new Set(rows.map((row) => row.assigneeId).filter((assigneeId): assigneeId is string => Boolean(assigneeId)))
  );
}

function getAssigneeSummary(assigneeIds: string[]) {
  if (!assigneeIds.length) return "미지정";

  return assigneeIds.map((assigneeId) => findTechnician(assigneeId).name).join(" · ");
}

function completeOrders(rows: Order[], rowIds: string[]) {
  const selected = new Set(rowIds);

  return rows.map((row) =>
    selected.has(row.id)
      ? {
          ...row,
          status: "완료" as const,
          workStatus: "완료" as const,
          warningMessage: undefined,
          diffs: undefined,
        }
      : row
  );
}

function startOrderGroup(group: OrderTableGroup) {
  const rows = group.rows.map((row) => {
    if (!isEditableOrder(row)) return row;

    const assignedRow = row.assigneeId ? row : assignOrder(row, currentTechnician);

    return {
      ...assignedRow,
      status: "조제중" as const,
      workStatus: "대기" as const,
    };
  });

  return {
    ...group,
    workStatus: "진행중" as const,
    assigneeIds: getGroupAssigneeIds(rows),
    rows,
  };
}

function cancelOrderGroupAssignment(group: OrderTableGroup) {
  const rows = group.rows.map((row) => {
    if (!isEditableOrder(row)) return row;

    return clearOrderAssignee({
      ...row,
      status: getRequestedStatus(row),
      workStatus: "대기" as const,
    });
  });

  return {
    ...group,
    workStatus: "요청" as const,
    assigneeIds: [],
    rows,
  };
}

function completeOrderGroup(group: OrderTableGroup) {
  const rows = group.rows.map((row) =>
    row.status === "취소"
      ? row
      : {
          ...row,
          status: "완료" as const,
          workStatus: "완료" as const,
          warningMessage: undefined,
          diffs: undefined,
        }
  );

  return {
    ...group,
    workStatus: "완료" as const,
    assigneeIds: getGroupAssigneeIds(rows),
    rows,
  };
}

function assignOrderInGroup(group: OrderTableGroup, rowId: string, technicianId: string) {
  const technician = findTechnician(technicianId);
  const rows = group.rows.map((row) =>
    row.id === rowId && isEditableOrder(row) ? assignOrder(row, technician) : row
  );

  return {
    ...group,
    assigneeIds: getGroupAssigneeIds(rows),
    rows,
  };
}

function GroupStatusAction({
  group,
  statusLabel,
  completeLabel,
  size = "xs",
  onStart,
  onComplete,
  onCancelAssignment,
}: {
  group: OrderTableGroup;
  statusLabel: string;
  completeLabel: string;
  size?: "xs" | "sm";
  onStart: () => void;
  onComplete: () => void;
  onCancelAssignment: () => void;
}) {
  if (group.workStatus === "완료") {
    return (
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled
        className="border-[var(--clair-color-atomic-sky-100)] bg-card text-[var(--clair-color-primary-normal)]"
      >
        <CheckIcon data-icon="inline-start" />
        {completeLabel}
      </Button>
    );
  }

  if (group.workStatus === "진행중") {
    return (
      <div className="inline-flex items-center">
        <Button
          type="button"
          variant="outline"
          size={size}
          className="rounded-r-none border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]"
        >
          {statusLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${group.title} 상태 액션`}
            className={cn(
              buttonVariants({ variant: "outline", size: size === "sm" ? "icon-sm" : "icon-xs" }),
              "-ml-px rounded-l-none border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]"
            )}
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={onComplete}
            >
              <CheckIcon className="size-3" />
              완료
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={onCancelAssignment}
            >
              담당취소
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Button type="button" size={size} onClick={onStart}>
      담당하기
      <ChevronDownIcon data-icon="inline-end" />
    </Button>
  );
}

export function DispensingContent({
  hasRightPanel,
  moduleId,
  moduleLabel,
}: ShellComponentProps) {
  const selectedQueueItemIds = useLayoutStore((state) => state.selectedQueueItemIds);
  const selectedQueueItem = getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);

  return (
    <DispensingContentBody
      key={selectedQueueItem?.id ?? "default"}
      hasRightPanel={hasRightPanel}
      moduleId={moduleId}
      moduleLabel={moduleLabel}
      selectedQueueItem={selectedQueueItem}
    />
  );
}

function DispensingContentBody({
  hasRightPanel,
  moduleId,
  moduleLabel,
  selectedQueueItem,
}: DispensingContentBodyProps) {
  const { rightPanelOpen, setRightPanelOpen } = useLayoutStore();
  const selectedQueueItemId = selectedQueueItem?.id;
  const [tableGroups, setTableGroups] = useState<OrderTableGroup[]>(() =>
    cloneOrderTableGroups(selectedQueueItemId)
  );
  const selectedQueueStatusLabel = getQueueStatusLabel(moduleId, selectedQueueItem);
  const [orderGroupFilter, setOrderGroupFilter] = useState<OrderGroupFilter>("all");
  const [collapsedOrderGroupIds, setCollapsedOrderGroupIds] = useState<Set<string>>(() => new Set());
  const primaryGroup = tableGroups[0];
  const totalOrderCount = tableGroups.reduce((total, group) => total + group.rows.length, 0);
  const regularOrderCount = tableGroups.find((group) => group.id === "oral")?.rows.length ?? 0;
  const otherOrderCount = tableGroups.find((group) => group.id === "other")?.rows.length ?? 0;
  const visibleTableGroups =
    orderGroupFilter === "all"
      ? tableGroups
      : tableGroups.filter((group) => group.id === orderGroupFilter);
  const orderGroupFilterItems = [
    {
      value: "all" as const,
      label: "전체",
      count: totalOrderCount > 0 ? totalOrderCount : undefined,
      disabled: totalOrderCount === 0,
    },
    {
      value: "oral" as const,
      label: "경구제",
      count: regularOrderCount > 0 ? regularOrderCount : undefined,
      disabled: regularOrderCount === 0,
    },
    {
      value: "other" as const,
      label: "기타",
      count: otherOrderCount > 0 ? otherOrderCount : undefined,
      disabled: otherOrderCount === 0,
    },
  ];

  const instructionType = moduleLabel === "처치" ? "처치" : "조제";
  const statusLabel = moduleLabel === "처치" ? "처치중" : "조제중";
  const completeLabel = moduleLabel === "처치" ? "처치완료" : "조제완료";
  const primaryAssigneeSummary = primaryGroup ? getAssigneeSummary(primaryGroup.assigneeIds) : "미지정";
  const primaryStartStatus =
    primaryGroup?.workStatus === "진행중"
      ? statusLabel
      : primaryGroup?.workStatus === "완료"
        ? completeLabel
        : "대기중";
  const instructionRequestedAt = selectedQueueItem
    ? `2026.04.14 ${selectedQueueItem.time}`
    : "2026.04.14 10:30";
  const instructionPatientSummary = getQueuePatientSummary(selectedQueueItem);
  const instructionId = selectedQueueItem?.instructionId ?? "RX-260414-0008";
  const instructionRequester = selectedQueueItem?.requesterName ?? "이수지";
  const instructionAssignee = selectedQueueItem?.assigneeName ?? primaryAssigneeSummary;
  const instructionStartStatus = selectedQueueItem ? selectedQueueStatusLabel : primaryStartStatus;
  const instructionStartedAt = selectedQueueItem?.startedAt ?? "미시작";
  const instructionInfoItems: Array<{ label: string; value: ReactNode }> = [
    {
      label: "요청 일시",
      value: (
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{instructionRequestedAt}</span>
          <EmrStatusBadge
            label={instructionStartStatus}
            marker="none"
            testId="instruction-status-label"
          />
        </span>
      ),
    },
    { label: "환자 정보", value: instructionPatientSummary },
    { label: "요청 수의사", value: instructionRequester },
    { label: `${instructionType} 담당`, value: instructionAssignee },
    { label: `${instructionType} 시작`, value: instructionStartedAt },
  ];
  const updateGroup = (
    groupId: string,
    updater: (group: OrderTableGroup) => OrderTableGroup
  ) => {
    setTableGroups((current) =>
      current.map((group) => (group.id === groupId ? updater(group) : group))
    );
  };
  const completeGroupRows = (groupId: string, rowIds: string[]) => {
    setTableGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;

        const rows = completeOrders(group.rows, rowIds);
        const activeRows = rows.filter((row) => row.status !== "취소");
        const allActiveRowsCompleted = activeRows.every((row) => row.workStatus === "완료");

        return {
          ...group,
          workStatus: allActiveRowsCompleted ? "완료" : group.workStatus,
          assigneeIds: getGroupAssigneeIds(rows),
          rows,
        };
      })
    );
  };
  const assignGroupOrder = (groupId: string, rowId: string, technicianId: string) => {
    updateGroup(groupId, (group) => assignOrderInGroup(group, rowId, technicianId));
  };
  const startGroup = (groupId: string) => {
    updateGroup(groupId, startOrderGroup);
  };
  const completeGroup = (groupId: string) => {
    updateGroup(groupId, completeOrderGroup);
  };
  const cancelGroupAssignment = (groupId: string) => {
    updateGroup(groupId, cancelOrderGroupAssignment);
  };
  const toggleOrderGroup = (groupId: string) => {
    setCollapsedOrderGroupIds((current) => {
      const next = new Set(current);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title={`${instructionType} 지시서`}
            icon={
                <CdsFilesDocumentAltFillIcon
                  className="size-5 shrink-0 text-[var(--clair-color-atomic-gray-300)]"
                  aria-hidden="true"
                />
            }
            badge={
              <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] text-muted-foreground">
                {instructionId}
              </Badge>
            }
            actions={
              <>
              {hasRightPanel && moduleLabel === "처치" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  aria-label={rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"}
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                >
                  {rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" className="bg-card">
                <DownloadIcon data-icon="inline-start" />
                PDF 다운로드
              </Button>
              <Button variant="outline" size="sm" className="bg-card">
                <PrinterIcon data-icon="inline-start" />
                출력하기
              </Button>
              {primaryGroup ? (
                <GroupStatusAction
                  group={primaryGroup}
                  statusLabel={statusLabel}
                  completeLabel={completeLabel}
                  size="sm"
                  onStart={() => startGroup(primaryGroup.id)}
                  onComplete={() => completeGroup(primaryGroup.id)}
                  onCancelAssignment={() => cancelGroupAssignment(primaryGroup.id)}
                />
              ) : null}
              </>
            }
          />
        }
        orderInfo={
          <div className="grid grid-cols-5 rounded-lg border border-border bg-card px-4 py-3">
            {instructionInfoItems.map(({ label, value }) => (
              <div key={label} className="border-r border-border px-3 last:border-r-0">
                <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
                <div className="mt-1 flex min-h-6 items-center text-[13px] font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
        }
        filters={
          <LineTabs
            aria-label="오더 그룹 필터"
            className="w-full border-b border-[var(--clair-color-line-normal)]"
            value={orderGroupFilter}
            items={orderGroupFilterItems}
            onValueChange={setOrderGroupFilter}
          />
        }
      />

      <ScrollArea data-slot="instruction-result-scroll-area" className="min-h-0 flex-1">
        <div data-slot="instruction-result-scroll-content" className="flex flex-col gap-4 pb-10 pt-4">
          {visibleTableGroups.map((group, section) => {
            const completedCount = group.rows.filter((row) => row.workStatus === "완료").length;
            const collapsed = collapsedOrderGroupIds.has(group.id);

            return (
              <EmrOrderGroupSection
                key={group.id}
                collapsed={collapsed}
                count={group.rows.length}
                label={group.label}
                title={group.title}
                meta={
                  <span className="text-[12px] font-medium text-[var(--clair-color-label-alternative)]">
                    작업 완료 {completedCount}/{group.rows.length}
                  </span>
                }
                actions={
                  <>
                    <Button variant="outline" size="xs" className="bg-card">
                      수정이력조회
                      <MenuIcon data-icon="inline-end" />
                    </Button>
                    <div className="h-[18px] w-px bg-[var(--clair-color-line-normal)]" />
                    <Button variant="outline" size="xs" className="bg-card">
                      필터 1
                    </Button>
                    <Button variant="outline" size="xs" className="max-w-24 bg-card">
                      <span className="truncate">{getAssigneeSummary(group.assigneeIds)}</span>
                    </Button>
                    <GroupStatusAction
                      group={group}
                      statusLabel={statusLabel}
                      completeLabel={completeLabel}
                      onStart={() => startGroup(group.id)}
                      onComplete={() => completeGroup(group.id)}
                      onCancelAssignment={() => cancelGroupAssignment(group.id)}
                    />
                  </>
                }
                onToggle={() => toggleOrderGroup(group.id)}
              >
                <EmrDataTable
                  rows={group.rows}
                  sectionId={`section-${section}`}
                  technicians={technicianUsers}
                  onCompleteRows={(rowIds) => completeGroupRows(group.id, rowIds)}
                  onAssignOrder={(rowId, technicianId) =>
                    assignGroupOrder(group.id, rowId, technicianId)
                  }
                />
              </EmrOrderGroupSection>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DispensingDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const order = allOrderRows.find((row) => row.id === activeDrawer?.id) ?? allOrderRows[0];

  return (
    <div className="flex h-[calc(100%-48px)] flex-col gap-4 overflow-y-auto p-4">
      <div className="rounded-md border bg-background p-3">
        <div className="text-[12px] text-muted-foreground">오더명</div>
        <div className="mt-1 text-base font-semibold">{order.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["구분", order.category],
          ["상태", order.status],
          ["경로", order.route],
          ["빈도", order.frequency],
          ["요청 일시", order.requestedAt],
          ["요청 수의사", order.doctor],
        ].map(([label, value]) => (
          <label key={label} className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            {label}
            <Input value={value} readOnly className="h-8 bg-card text-foreground" />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        용량
        <DoseInput key={order.id} initialDose={order.dose} />
      </label>
      <div className="mt-auto flex justify-end gap-2 border-t pt-4">
        <Button variant="outline">변경 이력</Button>
        <Button>수정 저장</Button>
      </div>
    </div>
  );
}

function DoseInput({ initialDose }: { initialDose: string }) {
  const [doseValue, setDoseValue] = useState(initialDose);

  return (
    <Input
      value={doseValue}
      onValueChange={setDoseValue}
      className="h-8 bg-card text-foreground"
    />
  );
}
