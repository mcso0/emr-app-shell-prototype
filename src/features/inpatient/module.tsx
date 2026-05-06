"use client";

import { useMemo } from "react";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  inpatientSearchFieldItems,
  inpatientWardGroups,
  mockInpatientAdmissions,
  type InpatientAdmission,
  type InpatientCautionTag,
  type InpatientSearchField,
} from "@/features/inpatient/data";
import { useInpatientStore } from "@/features/inpatient/store";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";

const statusBadgeClassName: Record<InpatientAdmission["status"], string> = {
  admitted:
    "border-[var(--clair-color-atomic-blue-200)] bg-[var(--clair-color-atomic-blue-50)] text-[var(--clair-color-atomic-blue-700)]",
  critical:
    "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-700)]",
  discharge_ready:
    "border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-700)]",
};

const cautionTagClassName: Record<InpatientCautionTag["tone"], string> = {
  care:
    "border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-700)]",
  danger:
    "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-700)]",
  notice:
    "border-[var(--clair-color-atomic-orange-200)] bg-[var(--clair-color-atomic-orange-50)] text-[var(--clair-color-atomic-orange-700)]",
  purple:
    "border-[var(--clair-color-atomic-purple-200)] bg-[var(--clair-color-atomic-purple-50)] text-[var(--clair-color-atomic-purple-700)]",
};

function CautionTag({ tag }: { tag: InpatientCautionTag }) {
  return (
    <Badge variant="outline" className={cn("h-5 rounded-md px-1.5", cautionTagClassName[tag.tone])}>
      {tag.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: InpatientAdmission["status"] }) {
  return (
    <Badge variant="outline" className={cn("h-5 rounded-md px-1.5", statusBadgeClassName[status])}>
      {getInpatientStatusLabel(status)}
    </Badge>
  );
}

function InpatientQueueItem({
  admission,
  selected,
}: {
  admission: InpatientAdmission;
  selected: boolean;
}) {
  const selectAdmission = useInpatientStore((state) => state.selectAdmission);

  return (
    <div data-testid={`inpatient-queue-item-${admission.id}`}>
      <EmrListItem
        selected={selected}
        variant="outline"
        title={`${admission.patientName} · ${admission.room}`}
        subtitle={`${admission.guardianName} · ${admission.breed} · ${admission.stayDayLabel}`}
        meta={admission.admittedAt.slice(9)}
        itemBadge={<StatusBadge status={admission.status} />}
        footer={
          <>
            <span>{admission.department}</span>
            <span>{admission.primaryNurse}</span>
          </>
        }
        onSelect={() => selectAdmission(admission.id)}
      />
    </div>
  );
}

export function InpatientSidePanel({ moduleLabel }: ShellComponentProps) {
  const filter = useInpatientStore((state) => state.filter);
  const selectedAdmissionId = useInpatientStore((state) => state.selectedAdmissionId);
  const setFilter = useInpatientStore((state) => state.setFilter);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const counts = useMemo(() => getInpatientCounts(), []);
  const rows = useMemo(
    () => mockInpatientAdmissions.filter((admission) => filter === "all" || admission.status === filter),
    [filter]
  );

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrDateNavigator dateLabel="26.05.06 (수)" todayLabel="오늘" />
      <div className="border-b px-3 py-2">
        <SegmentedControl
          aria-label="입원 목록 상태"
          value={filter}
          items={inpatientFilterItems.map((item) => ({ ...item, count: counts[item.value] }))}
          variant="tabs"
          className="w-full"
          itemClassName="flex-1"
          onValueChange={setFilter}
        />
      </div>
      <EmrListHeader
        label="입원 환자"
        count={rows.length}
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody>
        {rows.map((admission) => (
          <InpatientQueueItem
            key={admission.id}
            admission={admission}
            selected={admission.id === selectedAdmissionId}
          />
        ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 truncate text-[18px] font-semibold">{value}</div>
    </div>
  );
}

function InpatientTableRow({ admission }: { admission: InpatientAdmission }) {
  const selectedAdmissionId = useInpatientStore((state) => state.selectedAdmissionId);
  const selectAdmission = useInpatientStore((state) => state.selectAdmission);
  const selected = selectedAdmissionId === admission.id;

  return (
    <TableRow
      data-testid={`inpatient-row-${admission.id}`}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "cursor-pointer",
        selected && "bg-[var(--clair-color-atomic-sky-50)] hover:bg-[var(--clair-color-atomic-sky-50)]"
      )}
      onClick={() => selectAdmission(admission.id)}
    >
      <TableCell className="w-20 font-semibold">{admission.room}</TableCell>
      <TableCell className="min-w-36">
        <div className="font-semibold">{admission.patientName}</div>
        <div className="text-[12px] text-muted-foreground">{admission.breed}</div>
      </TableCell>
      <TableCell>{admission.guardianName}</TableCell>
      <TableCell>
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
      <TableCell className="min-w-44">
        <div className="flex flex-wrap gap-1">
          {admission.cautions.map((tag) => (
            <CautionTag key={tag.label} tag={tag} />
          ))}
        </div>
      </TableCell>
      <TableCell className="max-w-48 truncate">{admission.diagnosis}</TableCell>
      <TableCell className="max-w-56 truncate">{admission.admissionMemo}</TableCell>
      <TableCell>{admission.admittedAt}</TableCell>
      <TableCell>{admission.stayDayLabel}</TableCell>
      <TableCell>{admission.department}</TableCell>
      <TableCell>{admission.attendingVet}</TableCell>
      <TableCell>{admission.primaryNurse}</TableCell>
      <TableCell>
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
  label,
}: {
  admissions: InpatientAdmission[];
  label: string;
}) {
  if (!admissions.length) return null;

  return (
    <section className="rounded-lg border bg-card" data-testid={`inpatient-section-${label}`}>
      <div className="flex h-11 items-center justify-between border-b bg-[var(--clair-color-atomic-gray-50)] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[14px] font-semibold">{label}</h2>
          <Badge variant="secondary">{admissions.length}</Badge>
        </div>
        <span className="text-[12px] text-muted-foreground">입원실 · 주의사항 · 담당 · 퇴실 상태</span>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[1180px]">
          <TableHeader>
            <TableRow>
              <TableHead>입원실</TableHead>
              <TableHead>동물명</TableHead>
              <TableHead>보호자</TableHead>
              <TableHead>차트</TableHead>
              <TableHead>유의사항</TableHead>
              <TableHead>진단명</TableHead>
              <TableHead>입실 메모</TableHead>
              <TableHead>입실시점</TableHead>
              <TableHead>기간</TableHead>
              <TableHead>진료과</TableHead>
              <TableHead>주치의</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>퇴실</TableHead>
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
  const filter = useInpatientStore((state) => state.filter);
  const searchField = useInpatientStore((state) => state.searchField);
  const searchQuery = useInpatientStore((state) => state.searchQuery);
  const setFilter = useInpatientStore((state) => state.setFilter);
  const setSearchField = useInpatientStore((state) => state.setSearchField);
  const setSearchQuery = useInpatientStore((state) => state.setSearchQuery);
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--clair-color-background-normal)]">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">
            <CdsActionsPlusIcon data-icon="inline-start" className="size-3" />
            입실 추가
          </Button>
          <Button variant="outline" size="sm" className="bg-card">
            입원실 관리
          </Button>
          <SegmentedControl
            aria-label="입원 상태 필터"
            value={filter}
            items={inpatientFilterItems.map((item) => ({ ...item, count: counts[item.value] }))}
            variant="pill"
            onValueChange={setFilter}
          />
        </div>
        <div className="flex min-w-[360px] max-w-xl flex-1 justify-end gap-2">
          <Select value={searchField} onValueChange={(value) => setSearchField(value as InpatientSearchField)}>
            <SelectTrigger aria-label="입원 검색조건" className="h-8 w-[128px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {inpatientSearchFieldItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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

      <div className="grid shrink-0 gap-3 p-4 md:grid-cols-4">
        <SummaryCard label="입원중" value={`${counts.admitted + counts.critical}마리`} />
        <SummaryCard label="주의 태그" value={`${counts.cautionTags}개`} />
        <SummaryCard label="퇴실 준비" value={`${counts.discharge_ready}마리`} />
        <SummaryCard label="오늘 입실" value={`${counts.todayAdmissions}마리`} />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        <div className="flex flex-col gap-3 pb-4" data-testid="inpatient-workspace">
          {groupedAdmissions.map((group) => (
            <InpatientWardSection
              key={group.id}
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

export function InpatientRightPanel() {
  const selectedAdmissionId = useInpatientStore((state) => state.selectedAdmissionId);
  const admission = getInpatientAdmission(selectedAdmissionId);
  const checklistDoneCount = admission.dischargeChecklist.filter((item) => item.done).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-col justify-center border-b px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-semibold">입원 상세</div>
          <StatusBadge status={admission.status} />
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {admission.room} · {admission.patientName} · {admission.guardianName}
        </div>
      </div>
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
              <Badge variant="outline" className="rounded-md bg-card">
                {admission.stayDayLabel}
              </Badge>
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
