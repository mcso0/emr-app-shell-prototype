"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsAlertsAlertTriangleIcon } from "@/components/cds-icons/alerts-and-status";
import {
  CdsFilesCalendarIcon,
  CdsFilesClockIcon,
  CdsFilesDocumentAltFillIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsMedicalBedIcon,
  CdsMedicalClipboardCheckIcon,
} from "@/components/cds-icons/medical-and-domain";
import {
  EmrInstructionHeaderStack,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  getFilteredInpatientAdmissions,
  getInpatientAdmission,
  getInpatientCounts,
  getInpatientStatusLabel,
  inpatientFilterItems,
  inpatientWardGroups,
  type InpatientAdmission,
  type InpatientCautionTag,
} from "@/features/inpatient/data";
import { useInpatientStore } from "@/features/inpatient/store";
import { useLayoutStore } from "@/stores/layout-store";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { isPreparedEmptyClinicWorkspace } from "@/lib/emr-domain/demo-workspaces";
import { cn } from "@/lib/utils";
import type { EmrTableDensity } from "@/components/emr/table-density";
import type { ShellComponentProps } from "@/types/emr";

type InpatientSemanticTone =
  "danger" | "info" | "neutral" | "success" | "warning";

const inpatientToneClassName: Record<InpatientSemanticTone, string> = {
  danger:
    "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  info: "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  neutral:
    "border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
  success:
    "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  warning:
    "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
};

const inpatientStatusTone: Record<
  InpatientAdmission["status"],
  InpatientSemanticTone
> = {
  admitted: "info",
  critical: "danger",
  discharge_ready: "success",
};

const inpatientCautionTone: Record<
  InpatientCautionTag["tone"],
  InpatientSemanticTone
> = {
  care: "success",
  danger: "danger",
  notice: "warning",
  purple: "neutral",
};

const inpatientWeekdayLabels = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
] as const;
const inpatientTodayDate = "2026-05-06";

function formatInpatientDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) return dateValue;

  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day} (${inpatientWeekdayLabels[date.getDay()]})`;
}

function CautionTag({ tag }: { tag: InpatientCautionTag }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-md px-1.5",
        inpatientToneClassName[inpatientCautionTone[tag.tone]],
      )}
    >
      {tag.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: InpatientAdmission["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-md px-1.5",
        inpatientToneClassName[inpatientStatusTone[status]],
      )}
    >
      {getInpatientStatusLabel(status)}
    </Badge>
  );
}

function InpatientDatePicker({
  dateValue,
  onDateChange,
}: {
  dateValue: string;
  onDateChange: (dateValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dateLabel = formatInpatientDateLabel(dateValue);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-md bg-card px-2 text-[12px] font-medium text-muted-foreground"
            aria-label={`${dateLabel} 입원 기준일 선택`}
          />
        }
      >
        <CdsFilesCalendarIcon aria-hidden="true" className="size-3.5" />
        {dateLabel}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 gap-3 p-3"
        initialFocus={false}
      >
        <div className="grid gap-1.5">
          <label
            htmlFor="inpatient-date-picker"
            className="text-[12px] font-medium text-muted-foreground"
          >
            입원 기준일
          </label>
          <Input
            id="inpatient-date-picker"
            aria-label="입원 기준일"
            type="date"
            className="h-9 bg-card"
            value={dateValue}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={() => onDateChange(inpatientTodayDate)}
          >
            오늘
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            적용
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const summaryCardToneClassName = {
  info: {
    accent: "bg-[var(--emr-status-info-text)]",
    icon: "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  },
  warning: {
    accent: "bg-[var(--emr-status-warning-text)]",
    icon: "bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  },
  success: {
    accent: "bg-[var(--emr-status-success-text)]",
    icon: "bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  },
  neutral: {
    accent: "bg-[var(--emr-status-neutral-text)]",
    icon: "bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
  },
} satisfies Partial<
  Record<InpatientSemanticTone, { accent: string; icon: string }>
>;

type SummaryCardTone = keyof typeof summaryCardToneClassName;

function SummaryCard({
  description,
  icon,
  label,
  tone,
  value,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  tone: SummaryCardTone;
  value: string;
}) {
  const toneClassName = summaryCardToneClassName[tone];

  return (
    <section className="relative min-h-[104px] overflow-hidden rounded-lg border bg-card p-4 shadow-xs">
      <div
        className={cn("absolute inset-x-0 top-0 h-0.5", toneClassName.accent)}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-[24px] font-semibold leading-7 text-foreground">
            {value}
          </div>
        </div>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            toneClassName.icon,
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 truncate text-[12px] text-muted-foreground">
        {description}
      </div>
    </section>
  );
}

function InpatientWardSection({
  admissions,
  density,
  label,
}: {
  admissions: InpatientAdmission[];
  density: EmrTableDensity;
  label: string;
}) {
  const selectedAdmissionId = useInpatientStore(
    (state) => state.selectedAdmissionId,
  );
  const selectAdmission = useInpatientStore((state) => state.selectAdmission);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const openAdmissionDrawer = (admission: InpatientAdmission) => {
    selectAdmission(admission.id);
    setActiveDrawer({
      type: "inpatient-admission",
      id: admission.id,
      subtitle:
        admission.room +
        " · " +
        admission.patientName +
        " · " +
        admission.guardianName,
    });
  };
  const columns = useMemo<ColumnDef<InpatientAdmission, unknown>[]>(
    () => [
      {
        id: "room",
        accessorKey: "room",
        size: 76,
        minSize: 68,
        enableSorting: false,
        enableResizing: false,
        header: "입원실",
        meta: { label: "입원실", resize: "none" },
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.room}</span>
        ),
      },
      {
        id: "patient",
        accessorKey: "patientName",
        size: 132,
        minSize: 112,
        enableSorting: false,
        enableResizing: false,
        header: "동물명",
        meta: {
          label: "동물명",
          resize: "none",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) => (
          <div className="min-w-0 whitespace-normal">
            <div className="font-semibold">{row.original.patientName}</div>
            <div className="text-[12px] text-muted-foreground">
              {row.original.breed}
            </div>
          </div>
        ),
      },
      {
        id: "guardian",
        accessorKey: "guardianName",
        size: 96,
        minSize: 88,
        enableSorting: false,
        enableResizing: false,
        header: "보호자",
        meta: { label: "보호자", resize: "none" },
      },
      {
        id: "chart",
        size: 70,
        minSize: 70,
        enableSorting: false,
        enableResizing: false,
        header: "차트",
        meta: { label: "차트", resize: "none" },
        cell: () => (
          <span data-row-interactive="true">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="bg-card"
              data-row-interactive="true"
              disabled
              title="차트 연결 준비 중"
              aria-label="차트 (준비 중)"
              onClick={(event) => event.stopPropagation()}
            >
              차트
            </Button>
          </span>
        ),
      },
      {
        id: "cautions",
        accessorFn: (row) => row.cautions.map((tag) => tag.label).join(", "),
        size: 164,
        minSize: 140,
        enableSorting: false,
        enableResizing: false,
        header: "유의사항",
        meta: {
          label: "유의사항",
          resize: "none",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.cautions.map((tag) => (
              <CautionTag key={tag.label} tag={tag} />
            ))}
          </div>
        ),
      },
      {
        id: "diagnosis",
        accessorKey: "diagnosis",
        size: 172,
        minSize: 140,
        enableSorting: false,
        enableResizing: false,
        header: "진단명",
        meta: { label: "진단명", resize: "none" },
        cell: ({ row }) => (
          <span
            className="block min-w-0 truncate"
            title={row.original.diagnosis}
          >
            {row.original.diagnosis}
          </span>
        ),
      },
      {
        id: "memo",
        accessorKey: "admissionMemo",
        size: 208,
        minSize: 160,
        enableSorting: false,
        enableResizing: false,
        header: "입실 메모",
        meta: {
          grow: true,
          label: "입실 메모",
          resize: "none",
        },
        cell: ({ row }) => (
          <span
            className="block min-w-0 truncate"
            title={row.original.admissionMemo}
          >
            {row.original.admissionMemo}
          </span>
        ),
      },
      {
        id: "admittedAt",
        accessorKey: "admittedAt",
        size: 112,
        minSize: 100,
        enableSorting: false,
        enableResizing: false,
        header: "입실시점",
        meta: { label: "입실시점", resize: "none" },
      },
      {
        id: "stay",
        accessorKey: "stayDayLabel",
        size: 68,
        minSize: 64,
        enableSorting: false,
        enableResizing: false,
        header: "기간",
        meta: { label: "기간", resize: "none" },
      },
      {
        id: "department",
        accessorKey: "department",
        size: 84,
        minSize: 76,
        enableSorting: false,
        enableResizing: false,
        header: "진료과",
        meta: { label: "진료과", resize: "none" },
      },
      {
        id: "attendingVet",
        accessorKey: "attendingVet",
        size: 84,
        minSize: 76,
        enableSorting: false,
        enableResizing: false,
        header: "주치의",
        meta: { label: "주치의", resize: "none" },
      },
      {
        id: "primaryNurse",
        accessorKey: "primaryNurse",
        size: 84,
        minSize: 76,
        enableSorting: false,
        enableResizing: false,
        header: "담당자",
        meta: { label: "담당자", resize: "none" },
      },
      {
        id: "discharge",
        accessorFn: (row) => row.status,
        size: 74,
        minSize: 74,
        enableSorting: false,
        enableResizing: false,
        header: "퇴실",
        meta: { label: "퇴실", resize: "none" },
        cell: ({ row }) => (
          <span data-row-interactive="true">
            <Button
              type="button"
              variant={
                row.original.status === "discharge_ready" ? "default" : "outline"
              }
              size="xs"
              className={
                row.original.status === "discharge_ready" ? undefined : "bg-card"
              }
              data-row-interactive="true"
              disabled
              title="퇴실 처리 준비 중"
              aria-label={`${row.original.status === "discharge_ready" ? "퇴실" : "대기"} (준비 중)`}
              onClick={(event) => event.stopPropagation()}
            >
              {row.original.status === "discharge_ready" ? "퇴실" : "대기"}
            </Button>
          </span>
        ),
      },
    ],
    [],
  );
  // TanStack Table owns the row model while the drawer remains feature-owned.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: admissions,
    enableColumnResizing: false,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  if (!admissions.length) return null;

  return (
    <section
      className="rounded-lg border bg-card"
      data-testid={"inpatient-section-" + label}
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[14px] font-semibold">{label}</h2>
          <Badge variant="secondary">{admissions.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">
            입원실 · 주의사항 · 담당 · 퇴실 상태
          </span>
        </div>
      </div>
      <EmrDataTable
        aria-label={label + " 입원 목록"}
        className="table-fixed"
        density={density}
        overscrollAxes="horizontal"
        table={table}
        viewportMode="content"
        getRowProps={(row) => {
          const selected = selectedAdmissionId === row.original.id;

          return {
            className: cn(
              "cursor-pointer",
              selected &&
                "bg-[var(--emr-state-selected)] hover:bg-[var(--emr-state-selected)]",
            ),
            "data-selected": selected ? "true" : undefined,
            "data-state": selected ? "selected" : undefined,
            "data-testid": "inpatient-row-" + row.original.id,
            onClick: () => openAdmissionDrawer(row.original),
          };
        }}
      />
    </section>
  );
}
export function InpatientContent({ workspaceId }: ShellComponentProps) {
  const preparedEmptyClinic = isPreparedEmptyClinicWorkspace(workspaceId);
  const [selectedDate, setSelectedDate] = useState(() =>
    preparedEmptyClinic
      ? getWorkspaceOperatingDate(workspaceId)
      : inpatientTodayDate,
  );
  const filter = useInpatientStore((state) => state.filter);
  const searchField = useInpatientStore((state) => state.searchField);
  const searchQuery = useInpatientStore((state) => state.searchQuery);
  const setFilter = useInpatientStore((state) => state.setFilter);
  const setSearchQuery = useInpatientStore((state) => state.setSearchQuery);
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("compact");
  const counts = useMemo(
    () =>
      preparedEmptyClinic
        ? {
            all: 0,
            dog: 0,
            cat: 0,
            icu: 0,
            admitted: 0,
            critical: 0,
            discharge_ready: 0,
            cautionTags: 0,
            todayAdmissions: 0,
          }
        : getInpatientCounts(),
    [preparedEmptyClinic],
  );
  const visibleAdmissions = useMemo(
    () =>
      preparedEmptyClinic
        ? []
        : getFilteredInpatientAdmissions({ filter, searchField, searchQuery }),
    [filter, preparedEmptyClinic, searchField, searchQuery],
  );
  const groupedAdmissions = inpatientWardGroups.map((group) => ({
    ...group,
    admissions: visibleAdmissions.filter(
      (admission) => admission.wardGroup === group.id,
    ),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]">
      <div className="shrink-0 border-b bg-card px-4 py-3">
        <EmrInstructionHeaderStack
          titleBar={
            <EmrInstructionTitleBar
              title="입원 현황"
              icon={
                <CdsFilesDocumentAltFillIcon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              }
              badge={
                <InpatientDatePicker
                  dateValue={selectedDate}
                  onDateChange={setSelectedDate}
                />
              }
              actions={
                <>
                  <Button size="sm" disabled aria-label="입실 추가 (준비 중)" title="입실 추가 준비 중">
                    <CdsActionsPlusIcon
                      data-icon="inline-start"
                      className="size-3"
                    />
                    입실 추가<span className="hidden sm:inline"> (준비 중)</span>
                  </Button>
                  <Button variant="outline" size="sm" className="bg-card" disabled aria-label="입원실 관리 (준비 중)" title="입원실 관리 준비 중">
                    입원실 관리<span className="hidden sm:inline"> (준비 중)</span>
                  </Button>
                </>
              }
            />
          }
          orderInfo={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="입원중"
                value={`${counts.admitted + counts.critical}마리`}
                description="현재 병동/ICU 재원"
                tone="info"
                icon={
                  <CdsMedicalBedIcon aria-hidden="true" className="size-4" />
                }
              />
              <SummaryCard
                label="주의 태그"
                value={`${counts.cautionTags}개`}
                description="산소·금식·면회 등"
                tone="warning"
                icon={
                  <CdsAlertsAlertTriangleIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                }
              />
              <SummaryCard
                label="퇴실 준비"
                value={`${counts.discharge_ready}마리`}
                description="승인/안내 대기"
                tone="success"
                icon={
                  <CdsMedicalClipboardCheckIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                }
              />
              <SummaryCard
                label="오늘 입실"
                value={`${counts.todayAdmissions}마리`}
                description="금일 신규 입실"
                tone="neutral"
                icon={
                  <CdsFilesClockIcon aria-hidden="true" className="size-4" />
                }
              />
            </div>
          }
          filters={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                aria-label="입원실 그룹 필터"
                value={filter}
                items={inpatientFilterItems.map((item) => ({
                  ...item,
                  count: counts[item.value],
                }))}
                variant="pill"
                onValueChange={setFilter}
              />
              <div className="flex min-w-[360px] max-w-xl flex-1 justify-end gap-2">
                <EmrTableDensitySelector
                  value={tableDensity}
                  onValueChange={setTableDensity}
                />
                <div className="relative min-w-0 flex-1">
                  <CdsActionsSearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="입원 검색"
                    className="h-8 bg-card pl-8"
                    placeholder="동물명, 보호자명, 입원실 검색"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
              </div>
            </div>
          }
        />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 pb-4 pt-4">
        <div
          className="flex flex-col gap-3 pb-4"
          data-testid="inpatient-workspace"
        >
          {groupedAdmissions.map((group) => (
            <InpatientWardSection
              key={group.id}
              density={tableDensity}
              label={group.label}
              admissions={group.admissions}
            />
          ))}
          {!visibleAdmissions.length ? (
            <div className="rounded-lg border bg-card p-8 text-center text-[13px] text-muted-foreground">
              {preparedEmptyClinic
                ? "아직 입원 중인 환자가 없습니다."
                : "검색 조건에 맞는 입원 환자가 없습니다."}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

export function InpatientDrawer({ workspaceId }: ShellComponentProps) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const selectedAdmissionId = useInpatientStore(
    (state) => state.selectedAdmissionId,
  );
  if (isPreparedEmptyClinicWorkspace(workspaceId)) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-[13px] text-muted-foreground">
        아직 입원 중인 환자가 없습니다.
      </div>
    );
  }

  const admission = getInpatientAdmission(
    activeDrawer?.type === "inpatient-admission"
      ? activeDrawer.id
      : selectedAdmissionId,
  );
  const checklistDoneCount = admission.dischargeChecklist.filter(
    (item) => item.done,
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          <section className="rounded-md border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold">
                  {admission.patientName}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {admission.patientNo} · {admission.speciesLabel} ·{" "}
                  {admission.breed}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={admission.status} />
                <Badge variant="outline" className="rounded-md bg-card">
                  {admission.stayDayLabel}
                </Badge>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <div className="text-muted-foreground">주치의</div>
                <div className="mt-1 font-medium">{admission.attendingVet}</div>
              </div>
              <div>
                <div className="text-muted-foreground">주 담당자</div>
                <div className="mt-1 font-medium">{admission.primaryNurse}</div>
              </div>
            </div>
          </section>

          <section className="rounded-md border bg-card p-3">
            <div className="text-[13px] font-semibold">유의사항</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {admission.cautions.map((tag) => (
                <CautionTag key={tag.label} tag={tag} />
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
              {admission.admissionMemo}
            </p>
          </section>

          <section className="rounded-md border bg-card p-3">
            <div className="text-[13px] font-semibold">오늘 케어 포인트</div>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              {admission.carePoint}
            </p>
          </section>

          <section className="rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold">퇴실 체크리스트</div>
              <Badge variant="secondary">
                {checklistDoneCount}/{admission.dischargeChecklist.length}
              </Badge>
            </div>
            <div className="mt-2 divide-y">
              {admission.dischargeChecklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 py-2 text-[12px]"
                >
                  <Checkbox checked={item.done} aria-label={item.label} />
                  <span
                    className={
                      item.done ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
