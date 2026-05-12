"use client";

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
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrContentAsidePanel } from "@/components/emr/content-aside-panel";
import { EmrContentHistoryGroup, EmrContentHistoryItem } from "@/components/emr/content-history-list";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
} from "@/components/emr/subpanel";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrInstructionFilterTabs } from "@/components/emr/instruction-filter-tabs";
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
  "hasRightPanel" | "moduleId"
> & {
  selectedQueueItem: OrderQueueItem | null;
};

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

export function DispensingHeader({ moduleId }: ShellComponentProps) {
  const {
    selectedQueueItemIds,
  } =
    useLayoutStore();
  const selectedQueueItem = getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);

  return (
    <EmrPatientContextBar
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
    />
  );
}

function getDispensingInstructionType(selectedQueueItem: OrderQueueItem | null) {
  return selectedQueueItem?.orderTypeCategory === "treatment" ? "처치" : "조제";
}

export function DispensingContentAside({ moduleId }: ShellComponentProps) {
  const selectedQueueItemIds = useLayoutStore((state) => state.selectedQueueItemIds);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const selectedQueueItem = getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);
  const historyLabel = `${getDispensingInstructionType(selectedQueueItem)} 이력`;
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
    <EmrContentAsidePanel id="dispensing-content-aside">
      <HistoryListHeader
        count={totalHistoryCount}
        label={historyLabel}
        onCollapse={() => setContentAsideOpen(false)}
      />
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {historyGroups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              count={group.count}
              dataTestId={`history-group-${group.date}`}
              label={group.date}
              onToggle={() => toggleHistoryGroup(group.date)}
              toggleTestId={`history-group-toggle-${group.date}`}
            >
              {group.items.map((item) => (
                <HistoryItem key={item} item={item} />
              ))}
            </EmrContentHistoryGroup>
          ))}
        </div>
      </ScrollArea>
    </EmrContentAsidePanel>
  );
}

function HistoryListHeader({
  count,
  label,
  onCollapse,
}: {
  count: number;
  label: string;
  onCollapse: () => void;
}) {
  return (
    <EmrListHeader
      className="mx-0 h-6 border-y-0"
      count={count}
      label={label}
      leadingAction={
        <EmrListHeaderIconButton ariaLabel={`${label} 목록 접기`} iconSize="md" onClick={onCollapse}>
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

function HistoryItem({ item }: { item: string }) {
  const { title, category, description } = splitHistoryItem(item);

  return (
    <EmrContentHistoryItem
      title={title}
      subtitle={
        category || description ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {category ? <span className="shrink-0">{category}</span> : null}
            {description ? <span className="truncate">{description}</span> : null}
          </span>
        ) : null
      }
      meta={
        <>
          <span className="truncate">담당자명</span>
          <span className="truncate">담당자명</span>
          <span className="shrink-0">10:30 요청</span>
        </>
      }
    />
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

function completeInstructionGroup(group: OrderTableGroup) {
  const rows = group.rows.map((row) => ({
    ...row,
    status: "완료" as const,
    workStatus: "완료" as const,
    warningMessage: undefined,
    diffs: undefined,
  }));

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
}: ShellComponentProps) {
  const selectedQueueItemIds = useLayoutStore((state) => state.selectedQueueItemIds);
  const selectedQueueItem = getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);

  return (
    <DispensingContentBody
      key={selectedQueueItem?.id ?? "default"}
      hasRightPanel={hasRightPanel}
      moduleId={moduleId}
      selectedQueueItem={selectedQueueItem}
    />
  );
}

function DispensingContentBody({
  hasRightPanel,
  moduleId,
  selectedQueueItem,
}: DispensingContentBodyProps) {
  const {
    contentAsideOpen,
    rightPanelOpen,
    setContentAsideOpen,
    setRightPanelOpen,
  } = useLayoutStore();
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

  const instructionType = getDispensingInstructionType(selectedQueueItem);
  const statusLabel = instructionType === "처치" ? "처치중" : "조제중";
  const completeLabel = instructionType === "처치" ? "처치완료" : "조제완료";
  const historyLabel = `${instructionType} 이력`;
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
  const completeInstruction = () => {
    setTableGroups((current) => current.map(completeInstructionGroup));
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-app)] px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title={`${instructionType} 지시서`}
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix={historyLabel}
                controls="dispensing-content-aside"
                expanded={contentAsideOpen}
                tooltipLabel={historyLabel}
                onClick={() => setContentAsideOpen(!contentAsideOpen)}
              />
            }
            badge={
              <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] text-muted-foreground">
                {instructionId}
              </Badge>
            }
            actions={
              <>
              {hasRightPanel && instructionType === "처치" ? (
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
                  onComplete={completeInstruction}
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
          <EmrInstructionFilterTabs
            aria-label="오더 그룹 필터"
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
