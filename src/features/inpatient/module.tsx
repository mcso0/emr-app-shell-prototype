"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import type { EmrTableDensity } from "@/components/emr/table-density";

type InpatientSemanticTone = "danger" | "info" | "neutral" | "success" | "warning";

const inpatientToneClassName: Record<InpatientSemanticTone, string> = {
  danger:
    "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  info:
    "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  neutral:
    "border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
  success:
    "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  warning:
    "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
};

const inpatientStatusTone: Record<InpatientAdmission["status"], InpatientSemanticTone> = {
  admitted: "info",
  critical: "danger",
  discharge_ready: "success",
};

const inpatientCautionTone: Record<InpatientCautionTag["tone"], InpatientSemanticTone> = {
  care: "success",
  danger: "danger",
  notice: "warning",
  purple: "neutral",
};

const inpatientTableMinWidthClass = "min-w-[1180px]";
const inpatientTableMinWidth = 1180;

const inpatientTableColumnClasses = {
  room: "w-[76px]",
  patient: "w-[132px]",
  guardian: "w-[96px]",
  chart: "w-[70px]",
  cautions: "w-[164px]",
  diagnosis: "w-[172px]",
  memo: "w-[208px]",
  admittedAt: "w-[112px]",
  stay: "w-[68px]",
  department: "w-[84px]",
  attendingVet: "w-[84px]",
  primaryNurse: "w-[84px]",
  discharge: "w-[74px]",
} as const;

const inpatientWeekdayLabels = ["일", "월", "화", "수", "목", "금", "토"] as const;
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
      className={cn("h-5 rounded-md px-1.5", inpatientToneClassName[inpatientCautionTone[tag.tone]])}
    >
      {tag.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: InpatientAdmission["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 rounded-md px-1.5", inpatientToneClassName[inpatientStatusTone[status]])}
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
      <PopoverContent align="start" className="w-64 gap-3 p-3" initialFocus={false}>
        <div className="grid gap-1.5">
          <label htmlFor="inpatient-date-picker" className="text-[12px] font-medium text-muted-foreground">
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
} satisfies Partial<Record<InpatientSemanticTone, { accent: string; icon: string }>>;

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
      <div className={cn("absolute inset-x-0 top-0 h-0.5", toneClassName.accent)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-[24px] font-semibold leading-7 text-foreground">{value}</div>
        </div>
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", toneClassName.icon)}>
          {icon}
        </div>
      </div>
      <div className="mt-3 truncate text-[12px] text-muted-foreground">{description}</div>
    </section>
  );
}

function InpatientTableRow({ admission }: { admission: InpatientAdmission }) {
  const selectedAdmissionId = useInpatientStore((state) => state.selectedAdmissionId);
  const selectAdmission = useInpatientStore((state) => state.selectAdmission);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const selected = selectedAdmissionId === admission.id;
  const openAdmissionDrawer = () => {
    selectAdmission(admission.id);
    setActiveDrawer({
      type: "inpatient-admission",
      id: admission.id,
      subtitle: `${admission.room} · ${admission.patientName} · ${admission.guardianName}`,
    });
  };

  return (
    <TableRow
      data-testid={`inpatient-row-${admission.id}`}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "cursor-pointer",
        selected && "bg-[var(--emr-state-selected)] hover:bg-[var(--emr-state-selected)]"
      )}
      onClick={openAdmissionDrawer}
    >
      <TableCell className={cn(inpatientTableColumnClasses.room, "font-semibold")}>{admission.room}</TableCell>
      <TableCell className={inpatientTableColumnClasses.patient}>
        <div className="font-semibold">{admission.patientName}</div>
        <div className="text-[12px] text-muted-foreground">{admission.breed}</div>
      </TableCell>
      <TableCell className={inpatientTableColumnClasses.guardian}>{admission.guardianName}</TableCell>
      <TableCell className={inpatientTableColumnClasses.chart}>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="bg-card"
          disabled={!admission.chartAvailable}
          onClick={(event) => event.stopPropagation()}
        >
          차트
        </Button>
      </TableCell>
      <TableCell className={inpatientTableColumnClasses.cautions}>
        <div className="flex flex-wrap gap-1">
          {admission.cautions.map((tag) => (
            <CautionTag key={tag.label} tag={tag} />
          ))}
        </div>
      </TableCell>
      <TableCell className={cn(inpatientTableColumnClasses.diagnosis, "truncate")} title={admission.diagnosis}>
        {admission.diagnosis}
      </TableCell>
      <TableCell className={cn(inpatientTableColumnClasses.memo, "truncate")} title={admission.admissionMemo}>
        {admission.admissionMemo}
      </TableCell>
      <TableCell className={inpatientTableColumnClasses.admittedAt}>{admission.admittedAt}</TableCell>
      <TableCell className={inpatientTableColumnClasses.stay}>{admission.stayDayLabel}</TableCell>
      <TableCell className={inpatientTableColumnClasses.department}>{admission.department}</TableCell>
      <TableCell className={inpatientTableColumnClasses.attendingVet}>{admission.attendingVet}</TableCell>
      <TableCell className={inpatientTableColumnClasses.primaryNurse}>{admission.primaryNurse}</TableCell>
      <TableCell className={inpatientTableColumnClasses.discharge}>
        <Button
          type="button"
          variant={admission.status === "discharge_ready" ? "default" : "outline"}
          size="xs"
          className={admission.status === "discharge_ready" ? undefined : "bg-card"}
          onClick={(event) => event.stopPropagation()}
        >
          {admission.status === "discharge_ready" ? "퇴실" : "대기"}
        </Button>
      </TableCell>
    </TableRow>
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
  if (!admissions.length) return null;

  return (
    <section className="rounded-lg border bg-card" data-testid={`inpatient-section-${label}`}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[14px] font-semibold">{label}</h2>
          <Badge variant="secondary">{admissions.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">입원실 · 주의사항 · 담당 · 퇴실 상태</span>
        </div>
      </div>
      <div>
        <Table
          density={density}
          layout="scroll"
          minWidth={inpatientTableMinWidth}
          className={cn(inpatientTableMinWidthClass, "table-fixed")}
        >
          <TableHeader>
            <TableRow>
              <TableHead className={inpatientTableColumnClasses.room}>입원실</TableHead>
              <TableHead className={inpatientTableColumnClasses.patient}>동물명</TableHead>
              <TableHead className={inpatientTableColumnClasses.guardian}>보호자</TableHead>
              <TableHead className={inpatientTableColumnClasses.chart}>차트</TableHead>
              <TableHead className={inpatientTableColumnClasses.cautions}>유의사항</TableHead>
              <TableHead className={inpatientTableColumnClasses.diagnosis}>진단명</TableHead>
              <TableHead className={inpatientTableColumnClasses.memo}>입실 메모</TableHead>
              <TableHead className={inpatientTableColumnClasses.admittedAt}>입실시점</TableHead>
              <TableHead className={inpatientTableColumnClasses.stay}>기간</TableHead>
              <TableHead className={inpatientTableColumnClasses.department}>진료과</TableHead>
              <TableHead className={inpatientTableColumnClasses.attendingVet}>주치의</TableHead>
              <TableHead className={inpatientTableColumnClasses.primaryNurse}>담당자</TableHead>
              <TableHead className={inpatientTableColumnClasses.discharge}>퇴실</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admissions.map((admission) => (
              <InpatientTableRow key={admission.id} admission={admission} />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function InpatientContent() {
  const [selectedDate, setSelectedDate] = useState(inpatientTodayDate);
  const filter = useInpatientStore((state) => state.filter);
  const searchField = useInpatientStore((state) => state.searchField);
  const searchQuery = useInpatientStore((state) => state.searchQuery);
  const setFilter = useInpatientStore((state) => state.setFilter);
  const setSearchQuery = useInpatientStore((state) => state.setSearchQuery);
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("compact");
  const counts = useMemo(() => getInpatientCounts(), []);
  const visibleAdmissions = useMemo(
    () => getFilteredInpatientAdmissions({ filter, searchField, searchQuery }),
    [filter, searchField, searchQuery]
  );
  const groupedAdmissions = inpatientWardGroups.map((group) => ({
    ...group,
    admissions: visibleAdmissions.filter((admission) => admission.wardGroup === group.id),
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
                <InpatientDatePicker dateValue={selectedDate} onDateChange={setSelectedDate} />
              }
              actions={
                <>
                  <Button size="sm">
                    <CdsActionsPlusIcon data-icon="inline-start" className="size-3" />
                    입실 추가
                  </Button>
                  <Button variant="outline" size="sm" className="bg-card">
                    입원실 관리
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
                icon={<CdsMedicalBedIcon aria-hidden="true" className="size-4" />}
              />
              <SummaryCard
                label="주의 태그"
                value={`${counts.cautionTags}개`}
                description="산소·금식·면회 등"
                tone="warning"
                icon={<CdsAlertsAlertTriangleIcon aria-hidden="true" className="size-4" />}
              />
              <SummaryCard
                label="퇴실 준비"
                value={`${counts.discharge_ready}마리`}
                description="승인/안내 대기"
                tone="success"
                icon={<CdsMedicalClipboardCheckIcon aria-hidden="true" className="size-4" />}
              />
              <SummaryCard
                label="오늘 입실"
                value={`${counts.todayAdmissions}마리`}
                description="금일 신규 입실"
                tone="neutral"
                icon={<CdsFilesClockIcon aria-hidden="true" className="size-4" />}
              />
            </div>
          }
          filters={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                aria-label="입원실 그룹 필터"
                value={filter}
                items={inpatientFilterItems.map((item) => ({ ...item, count: counts[item.value] }))}
                variant="pill"
                onValueChange={setFilter}
              />
              <div className="flex min-w-[360px] max-w-xl flex-1 justify-end gap-2">
                <EmrTableDensitySelector value={tableDensity} onValueChange={setTableDensity} />
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
        <div className="flex flex-col gap-3 pb-4" data-testid="inpatient-workspace">
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
              검색 조건에 맞는 입원 환자가 없습니다.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

export function InpatientDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const selectedAdmissionId = useInpatientStore((state) => state.selectedAdmissionId);
  const admission = getInpatientAdmission(
    activeDrawer?.type === "inpatient-admission" ? activeDrawer.id : selectedAdmissionId
  );
  const checklistDoneCount = admission.dischargeChecklist.filter((item) => item.done).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          <section className="rounded-md border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[15px] font-semibold">{admission.patientName}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {admission.patientNo} · {admission.speciesLabel} · {admission.breed}
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
                  <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
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
