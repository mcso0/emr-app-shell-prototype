"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  SettingsIcon,
  UsersIcon,
  WarningIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { useAuthClient } from "@/features/auth/auth-client";
import { getCoverageIssues, getScheduleConflicts, getWeekDates, formatScheduleMinutes } from "./model";
import {
  createHospitalSchedulePersistenceAdapter,
  readPersistedHospitalSchedule,
} from "./schedule-persistence-client";
import {
  hospitalScheduleShiftKinds,
  setHospitalSchedulePersistenceAdapter,
  useHospitalScheduleStore,
  type HospitalScheduleShiftDraft,
} from "./store";
import type {
  HospitalScheduleRequestType,
  HospitalScheduleRole,
  HospitalScheduleShift,
  HospitalScheduleShiftKind,
} from "./types";

const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];
const roleLabels: Record<HospitalScheduleRole, string> = {
  veterinarian: "수의사",
  technician: "테크니션",
  reception: "접수",
};
const shiftTone: Record<HospitalScheduleShiftKind, string> = {
  clinical:
    "border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-800)] hover:bg-[var(--clair-color-atomic-green-100)]",
  support:
    "border-[var(--clair-color-atomic-blue-200)] bg-[var(--clair-color-atomic-blue-50)] text-[var(--clair-color-atomic-blue-800)] hover:bg-[var(--clair-color-atomic-blue-100)]",
  reception:
    "border-[var(--clair-color-atomic-purple-200)] bg-[var(--clair-color-atomic-purple-50)] text-[var(--clair-color-atomic-purple-800)] hover:bg-[var(--clair-color-atomic-purple-100)]",
  leave:
    "border-[var(--clair-color-atomic-yellow-200)] bg-[var(--clair-color-atomic-yellow-50)] text-[var(--clair-color-atomic-yellow-800)] hover:bg-[var(--clair-color-atomic-yellow-100)]",
  off: "border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-neutral-50)] text-[var(--clair-color-atomic-neutral-700)] hover:bg-[var(--clair-color-atomic-neutral-100)]",
};

type ShiftSheetState =
  | { mode: "create"; preset?: Partial<HospitalScheduleShiftDraft> }
  | { mode: "edit"; shift: HospitalScheduleShift }
  | null;

const getDateLabel = (date: string, short = false) => {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = weekdayLabels[(new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7];
  return short ? `${month}.${day} (${weekday})` : `${year}년 ${month}월 ${day}일 (${weekday})`;
};

const shiftTimeLabel = (shift: Pick<HospitalScheduleShift, "startMinutes" | "endMinutes">) =>
  `${formatScheduleMinutes(shift.startMinutes)}–${formatScheduleMinutes(shift.endMinutes)}`;

const getMinuteValue = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

const getTimeInput = (minutes: number) => formatScheduleMinutes(minutes);

function getWeeklyMinutes(shifts: HospitalScheduleShift[], staffId: string) {
  return shifts
    .filter((shift) => shift.staffId === staffId && shift.kind !== "leave" && shift.kind !== "off")
    .reduce((sum, shift) => sum + shift.endMinutes - shift.startMinutes, 0);
}

function ScheduleDataState() {
  const dataState = useHospitalScheduleStore((state) => state.dataState);

  if (dataState === "ready") return null;

  const messages = {
    loading: ["근무표를 불러오는 중", "최신 편성 정보를 준비하고 있어."],
    empty: ["등록된 근무가 없어", "직원을 선택해 첫 근무를 추가해줘."],
    error: ["근무표를 불러오지 못했어", "세션 데이터를 다시 확인해줘."],
    "read-only": ["읽기 전용 근무표", "게시된 근무표는 이 화면에서만 확인할 수 있어."],
  } as const;
  const [title, description] = messages[dataState];

  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed bg-card p-6 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ShiftBlock({
  shift,
  onEdit,
  onDuplicate,
  onToggleLeave,
  onDelete,
}: {
  shift: HospitalScheduleShift;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleLeave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("group relative rounded-md border p-1.5", shiftTone[shift.kind])}>
      <button
        type="button"
        className="block w-full pr-5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`${shift.workLabel} ${shiftTimeLabel(shift)} 수정`}
        onClick={onEdit}
      >
        <span className="block truncate text-xs font-semibold">{shift.workLabel}</span>
        <span className="mt-0.5 block text-[11px] tabular-nums opacity-80">{shiftTimeLabel(shift)}</span>
      </button>
      <div className="absolute right-0.5 top-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <EmrRowActionMenu
          ariaLabel={`${shift.workLabel} 작업`}
          density="compact"
          items={[
            { key: "duplicate", label: "복제", onSelect: onDuplicate },
            {
              key: "leave",
              label: shift.kind === "leave" ? "휴무 해제" : "휴무 전환",
              onSelect: onToggleLeave,
            },
            { key: "delete", label: "삭제", variant: "destructive", onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  );
}

function ShiftSheet({
  state,
  onClose,
}: {
  state: ShiftSheetState;
  onClose: () => void;
}) {
  const key = state?.mode === "edit" ? state.shift.id : state ? "create" : "closed";

  return (
    <Sheet open={state !== null} onOpenChange={(open) => !open && onClose()}>
      {state ? <ShiftSheetEditor key={key} state={state} onClose={onClose} /> : null}
    </Sheet>
  );
}

function ShiftSheetEditor({ state, onClose }: { state: Exclude<ShiftSheetState, null>; onClose: () => void }) {
  const staff = useHospitalScheduleStore((store) => store.staff);
  const activeDate = useHospitalScheduleStore((store) => store.activeDate);
  const createShift = useHospitalScheduleStore((store) => store.createShift);
  const updateShift = useHospitalScheduleStore((store) => store.updateShift);
  const firstStaffId = staff[0]?.id ?? "";
  const [draft, setDraft] = useState<HospitalScheduleShiftDraft>(() =>
    makeShiftDraft(state, activeDate, firstStaffId),
  );

  const isEdit = state.mode === "edit";
  const save = () => {
    if (!draft.workLabel.trim() || draft.endMinutes <= draft.startMinutes) return;
    if (state.mode === "edit") {
      updateShift(state.shift.id, draft);
    } else {
      createShift(draft);
    }
    onClose();
  };

  return (
    <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "근무 수정" : "근무 추가"}</SheetTitle>
          <SheetDescription>
            직원, 시간, 업무를 한 번에 확인하고 저장해줘.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">
          <FieldGroup>
            <Field>
              <FieldLabel>직원</FieldLabel>
              <FieldContent>
                <Select
                  value={draft.staffId ?? "unassigned"}
                  onValueChange={(value) => setDraft((current) => ({ ...current, staffId: value === "unassigned" ? null : value ?? null }))}
                >
                  <SelectTrigger aria-label="직원" className="w-full">
                    {draft.staffId ? staff.find((candidate) => candidate.id === draft.staffId)?.name : "미배정"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">미배정</SelectItem>
                    {staff.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name} · {candidate.roleLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="schedule-shift-date">날짜</FieldLabel>
              <FieldContent>
                <Input
                  id="schedule-shift-date"
                  aria-label="날짜"
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                />
              </FieldContent>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="schedule-shift-start">시작</FieldLabel>
                <FieldContent>
                  <Input
                    id="schedule-shift-start"
                    aria-label="시작 시간"
                    type="time"
                    value={getTimeInput(draft.startMinutes)}
                    onChange={(event) => setDraft((current) => ({ ...current, startMinutes: getMinuteValue(event.target.value) }))}
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-shift-end">종료</FieldLabel>
                <FieldContent>
                  <Input
                    id="schedule-shift-end"
                    aria-label="종료 시간"
                    type="time"
                    value={getTimeInput(draft.endMinutes)}
                    onChange={(event) => setDraft((current) => ({ ...current, endMinutes: getMinuteValue(event.target.value) }))}
                  />
                </FieldContent>
              </Field>
            </div>
            <Field>
              <FieldLabel>근무 유형</FieldLabel>
              <FieldContent>
                <Select
                  value={draft.kind}
                  onValueChange={(value) => setDraft((current) => ({ ...current, kind: (value ?? "clinical") as HospitalScheduleShiftKind }))}
                >
                  <SelectTrigger aria-label="근무 유형" className="w-full">
                    {hospitalScheduleShiftKinds.find((kind) => kind.value === draft.kind)?.label}
                  </SelectTrigger>
                  <SelectContent>
                    {hospitalScheduleShiftKinds.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="schedule-shift-label">근무명</FieldLabel>
              <FieldContent>
                <Input
                  id="schedule-shift-label"
                  aria-label="근무명"
                  value={draft.workLabel}
                  onChange={(event) => setDraft((current) => ({ ...current, workLabel: event.target.value }))}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="schedule-shift-note">메모</FieldLabel>
              <FieldContent>
                <Textarea
                  id="schedule-shift-note"
                  aria-label="메모"
                  value={draft.note ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value || null }))}
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>
        <SheetFooter className="border-t bg-muted/30 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button disabled={!draft.workLabel.trim() || draft.endMinutes <= draft.startMinutes} onClick={save}>
            저장
          </Button>
        </SheetFooter>
    </SheetContent>
  );
}

function makeShiftDraft(
  state: ShiftSheetState,
  activeDate: string,
  firstStaffId: string,
): HospitalScheduleShiftDraft {
  if (state?.mode === "edit") return { ...state.shift };

  return {
    staffId: state?.preset?.staffId ?? firstStaffId,
    date: state?.preset?.date ?? activeDate,
    startMinutes: state?.preset?.startMinutes ?? 9 * 60,
    endMinutes: state?.preset?.endMinutes ?? 18 * 60,
    kind: state?.preset?.kind ?? "clinical",
    workLabel: state?.preset?.workLabel ?? "진료",
    locationLabel: state?.preset?.locationLabel ?? "진료실 A",
    note: state?.preset?.note ?? null,
  };
}

function RequestSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      {open ? <RequestSheetEditor onClose={onClose} /> : null}
    </Sheet>
  );
}

function RequestSheetEditor({ onClose }: { onClose: () => void }) {
  const personalStaffId = useHospitalScheduleStore((state) => state.personalStaffId);
  const activeDate = useHospitalScheduleStore((state) => state.activeDate);
  const shifts = useHospitalScheduleStore((state) => state.shifts);
  const submitRequest = useHospitalScheduleStore((state) => state.submitRequest);
  const [type, setType] = useState<HospitalScheduleRequestType>("leave");
  const [reason, setReason] = useState("");
  const personalShift = shifts.find((shift) => shift.staffId === personalStaffId && shift.date === activeDate) ?? null;

  return (
    <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>휴무·근무 변경 요청</SheetTitle>
          <SheetDescription>요청은 승인 전까지 현재 근무표에 반영되지 않아.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          <Field>
            <FieldLabel>요청 유형</FieldLabel>
            <FieldContent>
              <Select value={type} onValueChange={(value) => setType((value ?? "leave") as HospitalScheduleRequestType)}>
                <SelectTrigger aria-label="요청 유형" className="w-full">
                  {type === "leave" ? "휴무 요청" : "근무 변경 요청"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leave">휴무 요청</SelectItem>
                  <SelectItem value="shift-change">근무 변경 요청</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{getDateLabel(activeDate)}</p>
            <p className="mt-1 text-muted-foreground">
              {personalShift ? `${personalShift.workLabel} · ${shiftTimeLabel(personalShift)}` : "해당 날짜에 배정된 근무가 없어."}
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="schedule-request-reason">사유</FieldLabel>
            <FieldContent>
              <Textarea
                id="schedule-request-reason"
                aria-label="사유"
                placeholder="관리자가 확인할 내용을 적어줘"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FieldContent>
          </Field>
        </div>
        <SheetFooter className="border-t bg-muted/30 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            disabled={!reason.trim()}
            onClick={() => {
              submitRequest({
                staffId: personalStaffId,
                shiftId: personalShift?.id ?? null,
                date: activeDate,
                type,
                requestedStartMinutes: type === "shift-change" ? personalShift?.startMinutes ?? null : null,
                requestedEndMinutes: type === "shift-change" ? Math.max((personalShift?.endMinutes ?? 18 * 60) - 60, 0) : null,
                reason,
              });
              onClose();
            }}
          >
            요청 제출
          </Button>
        </SheetFooter>
    </SheetContent>
  );
}

function WeeklyScheduleGrid({
  onEdit,
  onStaff,
  onDelete,
}: {
  onEdit: (shift: HospitalScheduleShift) => void;
  onStaff: (staffId: string) => void;
  onDelete: (shift: HospitalScheduleShift) => void;
}) {
  const weekStart = useHospitalScheduleStore((state) => state.weekStart);
  const staff = useHospitalScheduleStore((state) => state.staff);
  const shifts = useHospitalScheduleStore((state) => state.shifts);
  const roleFilter = useHospitalScheduleStore((state) => state.roleFilter);
  const duplicateShift = useHospitalScheduleStore((state) => state.duplicateShift);
  const toggleShiftLeave = useHospitalScheduleStore((state) => state.toggleShiftLeave);
  const createShift = useHospitalScheduleStore((state) => state.createShift);
  const dates = getWeekDates(weekStart);
  const visibleStaff = roleFilter === "all" ? staff : staff.filter((candidate) => candidate.role === roleFilter);

  return (
    <div data-testid="hospital-schedule-weekly-grid" className="hidden overflow-x-auto rounded-xl border bg-card md:block">
      <div className="min-w-[1060px]">
        <div className="grid grid-cols-[220px_repeat(7,minmax(120px,1fr))] border-b bg-muted/30">
          <div className="px-4 py-3 text-xs font-medium text-muted-foreground">직원 · 주간 시간</div>
          {dates.map((date) => (
            <button
              type="button"
              key={date}
              className="border-l px-3 py-3 text-left hover:bg-muted/50"
              onClick={() => useHospitalScheduleStore.getState().setActiveDate(date)}
            >
              <span className="block text-xs text-muted-foreground">{weekdayLabels[dates.indexOf(date)]}</span>
              <span className="mt-0.5 block text-sm font-semibold">{getDateLabel(date, true)}</span>
            </button>
          ))}
        </div>
        {visibleStaff.map((member) => (
          <div key={member.id} className="grid grid-cols-[220px_repeat(7,minmax(120px,1fr))] border-b last:border-b-0">
            <button
              type="button"
              className="flex min-h-28 flex-col justify-center px-4 text-left hover:bg-muted/40"
              onClick={() => onStaff(member.id)}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">{member.initials}</span>
                {member.name}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{member.roleLabel} · {Math.round(getWeeklyMinutes(shifts, member.id) / 60)}h/{Math.round(member.weeklyTargetMinutes / 60)}h</span>
            </button>
            {dates.map((date) => {
              const dayShifts = shifts.filter((shift) => shift.staffId === member.id && shift.date === date);
              return (
                <div key={date} className="group/cell min-h-28 border-l p-1.5">
                  <div className="space-y-1.5">
                    {dayShifts.map((shift) => (
                      <ShiftBlock
                        key={shift.id}
                        shift={shift}
                        onEdit={() => onEdit(shift)}
                        onDuplicate={() => duplicateShift(shift.id)}
                        onToggleLeave={() => toggleShiftLeave(shift.id)}
                        onDelete={() => onDelete(shift)}
                      />
                    ))}
                  </div>
                  {!dayShifts.length ? (
                    <button
                      type="button"
                      className="mt-1 w-full rounded-md py-2 text-xs text-muted-foreground opacity-0 hover:bg-muted group-hover/cell:opacity-100 focus-visible:opacity-100"
                      aria-label={`${member.name} ${getDateLabel(date, true)} 근무 추가`}
                      onClick={() => createShift({ staffId: member.id, date, startMinutes: 9 * 60, endMinutes: 18 * 60, kind: "clinical", workLabel: "진료", locationLabel: "진료실 A", note: null })}
                    >
                      + 근무 추가
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        <div className="grid grid-cols-[220px_repeat(7,minmax(120px,1fr))] bg-muted/20">
          <div className="px-4 py-3 text-sm font-semibold">미배정</div>
          {dates.map((date) => (
            <div key={date} className="min-h-20 border-l p-1.5">
              {shifts.filter((shift) => shift.staffId === null && shift.date === date).map((shift) => (
                <ShiftBlock
                  key={shift.id}
                  shift={shift}
                  onEdit={() => onEdit(shift)}
                  onDuplicate={() => duplicateShift(shift.id)}
                  onToggleLeave={() => toggleShiftLeave(shift.id)}
                  onDelete={() => onDelete(shift)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyCoverage({ onEdit, onDelete }: { onEdit: (shift: HospitalScheduleShift) => void; onDelete: (shift: HospitalScheduleShift) => void }) {
  const activeDate = useHospitalScheduleStore((state) => state.activeDate);
  const staff = useHospitalScheduleStore((state) => state.staff);
  const shifts = useHospitalScheduleStore((state) => state.shifts);
  const duplicateShift = useHospitalScheduleStore((state) => state.duplicateShift);
  const toggleShiftLeave = useHospitalScheduleStore((state) => state.toggleShiftLeave);
  const issues = getCoverageIssues({ staff, shifts, coverageRules: useHospitalScheduleStore.getState().coverageRules }).filter((issue) => issue.date === activeDate);
  const hours = Array.from({ length: 12 }, (_, index) => index + 8);

  return (
    <div data-testid="hospital-schedule-daily-coverage" className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{getDateLabel(activeDate)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">직원 행과 시간축으로 역할별 커버리지를 확인해.</p>
        </div>
        <Badge variant="outline">{issues.length ? `공백 ${issues.length}건` : "커버리지 정상"}</Badge>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[180px_1fr] border-b">
            <div className="px-4 py-2 text-xs text-muted-foreground">직원</div>
            <div className="grid grid-cols-12">
              {hours.map((hour) => <div key={hour} className="border-l px-1 py-2 text-center text-xs text-muted-foreground">{hour}:00</div>)}
            </div>
          </div>
          {staff.map((member) => {
            const memberShifts = shifts.filter((shift) => shift.staffId === member.id && shift.date === activeDate);
            return (
              <div key={member.id} className="grid grid-cols-[180px_1fr] border-b last:border-b-0">
                <div className="flex min-h-16 flex-col justify-center px-4">
                  <span className="text-sm font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground">{member.roleLabel}</span>
                </div>
                <div className="relative min-h-16 bg-[linear-gradient(to_right,var(--clair-color-atomic-neutral-100)_1px,transparent_1px)] bg-[size:8.333%_100%]">
                  {memberShifts.map((shift) => {
                    const left = ((shift.startMinutes - 8 * 60) / (12 * 60)) * 100;
                    const width = ((shift.endMinutes - shift.startMinutes) / (12 * 60)) * 100;
                    return (
                      <div key={shift.id} className="absolute top-2 h-12" style={{ left: `${Math.max(left, 0)}%`, width: `${Math.min(width, 100 - Math.max(left, 0))}%` }}>
                        <ShiftBlock shift={shift} onEdit={() => onEdit(shift)} onDuplicate={() => duplicateShift(shift.id)} onToggleLeave={() => toggleShiftLeave(shift.id)} onDelete={() => onDelete(shift)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileDayList({ onEdit, onDelete }: { onEdit: (shift: HospitalScheduleShift) => void; onDelete: (shift: HospitalScheduleShift) => void }) {
  const activeDate = useHospitalScheduleStore((state) => state.activeDate);
  const staff = useHospitalScheduleStore((state) => state.staff);
  const shifts = useHospitalScheduleStore((state) => state.shifts);
  const duplicateShift = useHospitalScheduleStore((state) => state.duplicateShift);
  const toggleShiftLeave = useHospitalScheduleStore((state) => state.toggleShiftLeave);

  return (
    <div data-testid="hospital-schedule-mobile-day-list" className="space-y-2 md:hidden">
      <p className="px-1 text-sm font-semibold">{getDateLabel(activeDate)}</p>
      {staff.map((member) => {
        const dayShifts = shifts.filter((shift) => shift.staffId === member.id && shift.date === activeDate);
        return (
          <div key={member.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{member.name}</span>
              <span className="text-xs text-muted-foreground">{member.roleLabel}</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {dayShifts.length ? dayShifts.map((shift) => <ShiftBlock key={shift.id} shift={shift} onEdit={() => onEdit(shift)} onDuplicate={() => duplicateShift(shift.id)} onToggleLeave={() => toggleShiftLeave(shift.id)} onDelete={() => onDelete(shift)} />) : <p className="text-xs text-muted-foreground">배정된 근무 없음</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PersonalSchedule({ onRequest }: { onRequest: () => void }) {
  const personalStaffId = useHospitalScheduleStore((state) => state.personalStaffId);
  const staff = useHospitalScheduleStore((state) => state.staff);
  const shifts = useHospitalScheduleStore((state) => state.shifts);
  const requests = useHospitalScheduleStore((state) => state.requests);
  const weekStart = useHospitalScheduleStore((state) => state.weekStart);
  const personal = staff.find((member) => member.id === personalStaffId);
  const dates = getWeekDates(weekStart);
  const personalShifts = shifts.filter((shift) => shift.staffId === personalStaffId);
  const personalRequests = requests.filter((request) => request.staffId === personalStaffId);

  return (
    <div data-testid="hospital-schedule-personal" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <p className="text-sm font-semibold">{personal?.name}의 이번 주</p>
            <p className="mt-0.5 text-xs text-muted-foreground">근무 가능 시간과 확정 근무를 함께 보여줘.</p>
          </div>
          <Button size="sm" onClick={onRequest}>휴무·변경 요청</Button>
        </div>
        <div className="grid grid-cols-7 divide-x">
          {dates.map((date) => (
            <div key={date} className="min-h-64 p-2">
              <p className="text-center text-xs font-medium text-muted-foreground">{getDateLabel(date, true)}</p>
              <div className="mt-3 space-y-1.5">
                {personalShifts.filter((shift) => shift.date === date).map((shift) => (
                  <div key={shift.id} className={cn("rounded-md border p-1.5 text-xs", shiftTone[shift.kind])}>
                    <p className="font-semibold">{shift.workLabel}</p>
                    <p className="mt-0.5 tabular-nums">{shiftTimeLabel(shift)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">근무 가능 시간</p>
          <p className="mt-2 text-sm text-muted-foreground">평일 10:00–18:00</p>
          <p className="mt-1 text-xs text-muted-foreground">금요일 18시 이후는 요청 승인 후 반영돼.</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">내 요청</p>
            <Badge variant="outline">{personalRequests.filter((request) => request.status === "pending").length} 대기</Badge>
          </div>
          <div className="mt-3 space-y-3">
            {personalRequests.map((request) => (
              <div key={request.id} className="border-l-2 border-[var(--clair-color-atomic-yellow-400)] pl-3">
                <p className="text-sm font-medium">{request.type === "leave" ? "휴무 요청" : "근무 변경 요청"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{request.reason}</p>
                <p className="mt-1 text-xs font-medium">{request.status === "pending" ? "승인 대기" : request.status === "approved" ? "승인됨" : "반려됨"}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function StaffDetailSheet({ staffId, onClose }: { staffId: string | null; onClose: () => void }) {
  const staff = useHospitalScheduleStore((state) => state.staff);
  const shifts = useHospitalScheduleStore((state) => state.shifts);
  const requests = useHospitalScheduleStore((state) => state.requests);
  const approveRequest = useHospitalScheduleStore((state) => state.approveRequest);
  const declineRequest = useHospitalScheduleStore((state) => state.declineRequest);
  const member = staff.find((candidate) => candidate.id === staffId);
  const pending = requests.filter((request) => request.staffId === staffId && request.status === "pending");

  return (
    <Sheet open={staffId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{member?.name ?? "직원"} 일정</SheetTitle>
          <SheetDescription>{member?.roleLabel} · 이번 주 {Math.round(getWeeklyMinutes(shifts, member?.id ?? "") / 60)}시간 배정</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-4">
          <section>
            <p className="text-sm font-semibold">승인 대기 요청</p>
            {pending.length ? (
              <div className="mt-3 space-y-3">
                {pending.map((request) => (
                  <div key={request.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{request.type === "leave" ? "휴무 요청" : "근무 변경 요청"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{getDateLabel(request.date)}</p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => declineRequest(request.id)}>반려</Button>
                      <Button size="sm" onClick={() => approveRequest(request.id)}>승인</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-muted-foreground">승인 대기 요청이 없어.</p>}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function HospitalScheduleScreen({ workspaceId }: { workspaceId: string }) {
  const { hydrated, hydrate, session } = useAuthClient();
  const surface = useHospitalScheduleStore((state) => state.surface);
  const setSurface = useHospitalScheduleStore((state) => state.setSurface);
  const viewMode = useHospitalScheduleStore((state) => state.viewMode);
  const setViewMode = useHospitalScheduleStore((state) => state.setViewMode);
  const weekStart = useHospitalScheduleStore((state) => state.weekStart);
  const activeDate = useHospitalScheduleStore((state) => state.activeDate);
  const setActiveDate = useHospitalScheduleStore((state) => state.setActiveDate);
  const roleFilter = useHospitalScheduleStore((state) => state.roleFilter);
  const setRoleFilter = useHospitalScheduleStore((state) => state.setRoleFilter);
  const staff = useHospitalScheduleStore((state) => state.staff);
  const shifts = useHospitalScheduleStore((state) => state.shifts);
  const requests = useHospitalScheduleStore((state) => state.requests);
  const coverageRules = useHospitalScheduleStore((state) => state.coverageRules);
  const publication = useHospitalScheduleStore((state) => state.publication);
  const settings = useHospitalScheduleStore((state) => state.settings);
  const hydrateRemoteSchedule = useHospitalScheduleStore((state) => state.hydrateRemoteSchedule);
  const setDataState = useHospitalScheduleStore((state) => state.setDataState);
  const setSettings = useHospitalScheduleStore((state) => state.setSettings);
  const publish = useHospitalScheduleStore((state) => state.publish);
  const [shiftSheet, setShiftSheet] = useState<ShiftSheetState>(null);
  const [staffSheetId, setStaffSheetId] = useState<string | null>(null);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HospitalScheduleShift | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const deleteShift = useHospitalScheduleStore((state) => state.deleteShift);
  const conflicts = useMemo(() => getScheduleConflicts({ staff, shifts }), [staff, shifts]);
  const coverageIssues = useMemo(() => getCoverageIssues({ staff, shifts, coverageRules }), [staff, shifts, coverageRules]);
  const publishBlocked = conflicts.length > 0 || coverageIssues.length > 0;
  const dates = getWeekDates(weekStart);
  const pendingRequests = requests.filter((request) => request.status === "pending");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (session?.role !== "supabase") {
      setHospitalSchedulePersistenceAdapter(null);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      const remote = await readPersistedHospitalSchedule({ workspaceId });
      if (!remote || cancelled) {
        if (!cancelled) setDataState("ready");
        return;
      }
      hydrateRemoteSchedule(remote);
    };

    setDataState("loading");
    setHospitalSchedulePersistenceAdapter(
      createHospitalSchedulePersistenceAdapter({
        workspaceId,
        onRefreshed: refresh,
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "근무표 저장에 실패했어.");
        },
      }),
    );
    void refresh().catch((error: unknown) => {
      if (!cancelled) {
        setDataState("error");
        toast.error(error instanceof Error ? error.message : "근무표를 불러오지 못했어.");
      }
    });

    return () => {
      cancelled = true;
      setHospitalSchedulePersistenceAdapter(null);
    };
  }, [hydrateRemoteSchedule, hydrated, session?.role, setDataState, workspaceId]);

  const moveActiveDate = (direction: -1 | 1) => {
    const currentIndex = dates.indexOf(activeDate);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), dates.length - 1);
    setActiveDate(dates[nextIndex] ?? activeDate);
  };

  return (
    <main data-testid="hospital-admin-schedule-screen" className="flex min-h-full flex-col bg-[var(--emr-surface-canvas)]">
      <div className="border-b bg-card px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">병원관리 / 인력 운영</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">근무표</h1>
              <Badge variant="outline" className={cn(publication.state === "published" ? "border-[var(--clair-color-atomic-green-300)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-800)]" : "border-[var(--clair-color-atomic-yellow-300)] bg-[var(--clair-color-atomic-yellow-50)] text-[var(--clair-color-atomic-yellow-800)]")}>
                {publication.state === "published" ? "게시됨" : publication.state === "changed" ? "재게시 필요" : "초안"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">편성, 커버리지, 개인 일정을 한 곳에서 관리해. Supabase 연결 시 변경 내용은 안전하게 저장돼.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><SettingsIcon aria-hidden="true" /> 설정</Button>
            {surface === "admin" ? <Button size="sm" onClick={() => setShiftSheet({ mode: "create" })}>+ 근무</Button> : null}
            {surface === "admin" ? <Button size="sm" variant={publication.state === "published" ? "outline" : "default"} onClick={() => setPublishOpen(true)}>게시하기</Button> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            aria-label="근무표 사용자 화면"
            size="sm"
            variant="tabs"
            value={surface}
            items={[{ value: "admin", label: "관리자 근무표" }, { value: "personal", label: "내 근무" }]}
            onValueChange={setSurface}
          />
          {surface === "admin" ? (
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl aria-label="근무표 보기" size="sm" variant="tabs" value={viewMode} items={[{ value: "week", label: "주간 편성" }, { value: "day", label: "일간 커버리지" }]} onValueChange={setViewMode} />
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter((value ?? "all") as typeof roleFilter)}>
                <SelectTrigger aria-label="역할 필터" className="h-8 min-w-24">{roleFilter === "all" ? "전체 역할" : roleLabels[roleFilter]}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 역할</SelectItem>
                  {Object.entries(roleLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="이전 날짜" disabled={activeDate === dates[0]} onClick={() => moveActiveDate(-1)}><ChevronLeftIcon /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="다음 날짜" disabled={activeDate === dates[dates.length - 1]} onClick={() => moveActiveDate(1)}><ChevronRightIcon /></Button>
            <span className="ml-2 text-sm font-medium">{getDateLabel(weekStart)} 주</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarIcon className="size-4" aria-hidden="true" />
            {publication.publishedAtLabel ? `최근 게시 ${publication.publishedAtLabel}` : "아직 게시하지 않았어"}
          </div>
        </div>

        {publication.state === "changed" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--clair-color-atomic-yellow-200)] bg-[var(--clair-color-atomic-yellow-50)] px-3 py-2 text-sm text-[var(--clair-color-atomic-yellow-800)]">
            <span>승인되거나 수정된 근무가 있어. 게시하면 구성원에게 최신 근무표가 보여.</span>
            <Button size="sm" variant="outline" onClick={() => setPublishOpen(true)}>재게시 검토</Button>
          </div>
        ) : null}

        {surface === "admin" ? (
          <>
            <ScheduleDataState />
            {viewMode === "week" ? <WeeklyScheduleGrid onEdit={(shift) => setShiftSheet({ mode: "edit", shift })} onStaff={setStaffSheetId} onDelete={setDeleteTarget} /> : <DailyCoverage onEdit={(shift) => setShiftSheet({ mode: "edit", shift })} onDelete={setDeleteTarget} />}
            <MobileDayList onEdit={(shift) => setShiftSheet({ mode: "edit", shift })} onDelete={setDeleteTarget} />
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard icon={<UsersIcon />} label="이번 주 배정" value={`${staff.length}명`} description={`미배정 ${shifts.filter((shift) => shift.staffId === null).length}건`} />
              <SummaryCard icon={<WarningIcon />} label="게시 전 확인" value={`${conflicts.length + coverageIssues.length}건`} description={publishBlocked ? "충돌과 커버리지 공백을 해결해야 해" : "게시할 수 있어"} tone={publishBlocked ? "warning" : "success"} />
              <button type="button" className="rounded-xl border bg-card p-4 text-left hover:bg-muted/40" onClick={() => setStaffSheetId("staff-suji")}>
                <p className="text-xs text-muted-foreground">승인 대기 요청</p>
                <p className="mt-2 text-lg font-semibold">{pendingRequests.length}건</p>
                <p className="mt-1 text-xs text-muted-foreground">직원 일정에서 승인·반려할 수 있어</p>
              </button>
            </div>
          </>
        ) : <PersonalSchedule onRequest={() => setRequestSheetOpen(true)} />}
      </div>

      <ShiftSheet state={shiftSheet} onClose={() => setShiftSheet(null)} />
      <RequestSheet open={requestSheetOpen} onClose={() => setRequestSheetOpen(false)} />
      <StaffDetailSheet staffId={staffSheetId} onClose={() => setStaffSheetId(null)} />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <EmrConfirmDialogContent
          cancelLabel="취소"
          confirmLabel="삭제"
          confirmButtonVariant="destructive"
          title="근무를 삭제할까?"
          description={deleteTarget ? `${deleteTarget.workLabel} 근무가 목록에서 사라지고, 근무표는 재게시 필요 상태가 돼.` : ""}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { if (deleteTarget) deleteShift(deleteTarget.id); setDeleteTarget(null); }}
        />
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>게시 전 충돌 검토</DialogTitle>
            <DialogDescription>충돌과 역할별 커버리지 공백이 없을 때만 이 주의 근무표를 게시할 수 있어.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            {conflicts.map((conflict) => <p key={`${conflict.kind}-${conflict.shiftId}`} className="flex gap-2"><WarningIcon className="mt-0.5 size-4 text-[var(--clair-color-atomic-yellow-700)]" />{conflict.message}</p>)}
            {coverageIssues.map((issue) => <p key={`${issue.date}-${issue.role}-${issue.startMinutes}`} className="flex gap-2"><WarningIcon className="mt-0.5 size-4 text-[var(--clair-color-atomic-yellow-700)]" />{getDateLabel(issue.date, true)} {roleLabels[issue.role]} {formatScheduleMinutes(issue.startMinutes)}–{formatScheduleMinutes(issue.endMinutes)} 커버리지가 비어 있어.</p>)}
            {!publishBlocked ? <p className="text-[var(--clair-color-atomic-green-800)]">게시 가능한 근무표야.</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>닫기</Button>
            <Button disabled={publishBlocked} onClick={() => { publish(); setPublishOpen(false); }}>게시</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>근무표 설정</DialogTitle>
            <DialogDescription>첫 구현에서는 이 브라우저 세션에만 적용돼.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>근무표 잠금</FieldLabel>
              <FieldContent>
                <Select value={settings.lockDay} onValueChange={(value) => setSettings({ lockDay: (value ?? "thursday") as typeof settings.lockDay })}>
                  <SelectTrigger aria-label="근무표 잠금" className="w-full">{settings.lockDay === "thursday" ? "목요일" : settings.lockDay === "friday" ? "금요일" : "일요일"}</SelectTrigger>
                  <SelectContent><SelectItem value="thursday">목요일</SelectItem><SelectItem value="friday">금요일</SelectItem><SelectItem value="sunday">일요일</SelectItem></SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <p className="text-sm text-muted-foreground"><ClockIcon className="mr-1 inline size-4" />{formatScheduleMinutes(settings.lockMinutes)}에 편성을 잠그도록 표시해.</p>
          </div>
          <DialogFooter><Button onClick={() => setSettingsOpen(false)}>완료</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SummaryCard({ icon, label, value, description, tone = "default" }: { icon: ReactNode; label: string; value: string; description: string; tone?: "default" | "success" | "warning" }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", tone === "warning" && "border-[var(--clair-color-atomic-yellow-200)]", tone === "success" && "border-[var(--clair-color-atomic-green-200)]")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
