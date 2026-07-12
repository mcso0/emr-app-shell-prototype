"use client";

import { useMemo, useState } from "react";
import { CdsFilesCalendarIcon } from "@/components/cds-icons/files-and-layout";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  applyScheduleRangeToOpenDays,
  cloneHospitalBasicSettingsDraft,
  createTimeOptions,
  validateHospitalBasicSettingsDraft,
  weekdays,
  type HospitalBasicSettingsDraft,
  type HospitalScheduleException,
  type HospitalSettingsValidationIssue,
  type ScheduleRangeKind,
  type TimeRange,
  type Weekday,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";

type HospitalOperatingHoursEditorProps = {
  value: HospitalBasicSettingsDraft;
  validationIssues: HospitalSettingsValidationIssue[];
  onChange: (next: HospitalBasicSettingsDraft) => void;
};

type PendingTimePropagation = {
  day: Weekday;
  nextDraft: HospitalBasicSettingsDraft;
  rangeKind: ScheduleRangeKind;
};

type ExceptionDialogState =
  | { mode: "create"; value: HospitalScheduleException }
  | { mode: "edit"; value: HospitalScheduleException }
  | null;

const weekdayLabels: Record<Weekday, string> = {
  monday: "월요일",
  tuesday: "화요일",
  wednesday: "수요일",
  thursday: "목요일",
  friday: "금요일",
  saturday: "토요일",
  sunday: "일요일",
};

const holidayPolicyLabels = {
  closed: "공휴일 휴무",
  custom: "직접 설정",
  weekday: "평일 운영시간 적용",
} as const;

const exceptionPolicyLabels = {
  closed: "휴무일",
  custom: "직접 설정",
} as const;

export function HospitalOperatingHoursEditor({
  value,
  validationIssues,
  onChange,
}: HospitalOperatingHoursEditorProps) {
  const [pendingTimePropagation, setPendingTimePropagation] =
    useState<PendingTimePropagation | null>(null);
  const [exceptionDialog, setExceptionDialog] = useState<ExceptionDialogState>(null);
  const [exceptionError, setExceptionError] = useState("");
  const timeOptions = useMemo(() => createTimeOptions(), []);

  const updateWeekday = (day: Weekday, update: (current: HospitalBasicSettingsDraft) => void) => {
    const next = cloneHospitalBasicSettingsDraft(value);
    update(next);
    onChange(next);
  };

  const updateTime = (
    day: Weekday,
    rangeKind: ScheduleRangeKind,
    edge: keyof TimeRange,
    nextValue: string
  ) => {
    const nextDraft = cloneHospitalBasicSettingsDraft(value);
    nextDraft.weeklyHours[day][rangeKind][edge] = nextValue;
    onChange(nextDraft);
    setPendingTimePropagation({ day, nextDraft, rangeKind });
  };

  const openExceptionDialog = (exception?: HospitalScheduleException) => {
    setExceptionError("");
    setExceptionDialog(
      exception
        ? { mode: "edit", value: cloneException(exception) }
        : { mode: "create", value: createEmptyException() }
    );
  };

  const saveException = () => {
    if (!exceptionDialog) return;
    const exception = exceptionDialog.value;
    const duplicate = value.exceptions.some(
      (item) => item.date === exception.date && item.id !== exception.id
    );

    if (!exception.date) {
      setExceptionError("날짜를 선택해 주세요.");
      return;
    }

    if (duplicate) {
      setExceptionError("같은 날짜의 예외 일정이 이미 있습니다.");
      return;
    }

    const validation = validateHospitalBasicSettingsDraft({
      ...value,
      exceptions: [exception],
    });
    const exceptionIssue = validation.find((issue) => issue.fieldId.includes(exception.id));
    if (exceptionIssue) {
      setExceptionError(exceptionIssue.message);
      return;
    }

    const next = cloneHospitalBasicSettingsDraft(value);
    next.exceptions =
      exceptionDialog.mode === "create"
        ? [...next.exceptions, exception]
        : next.exceptions.map((item) => (item.id === exception.id ? exception : item));
    onChange(next);
    setExceptionDialog(null);
  };

  const deleteException = (exceptionId: string) => {
    const next = cloneHospitalBasicSettingsDraft(value);
    next.exceptions = next.exceptions.filter((exception) => exception.id !== exceptionId);
    onChange(next);
  };

  const exceptions = [...value.exceptions].sort((left, right) => left.date.localeCompare(right.date));

  return (
    <section className="grid gap-4" aria-labelledby="hospital-settings-hours-title">
      <div>
        <h2 id="hospital-settings-hours-title" className="text-base font-semibold">
          운영시간
        </h2>
        <p className="mt-1 emr-text-dense text-muted-foreground">
          요일별 진료·휴게시간과 공휴일 정책을 설정합니다.
        </p>
      </div>

      <Card size="sm">
        <CardContent>
          <div className="divide-y divide-border">
            {weekdays.map((day) => {
              const schedule = value.weeklyHours[day];
              const dayLabel = weekdayLabels[day];

              return (
                <div
                  key={day}
                  className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)] lg:items-center"
                  data-testid={`hospital-settings-day-${day}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{dayLabel}</span>
                    <Field orientation="horizontal" className="w-auto items-center gap-2">
                      <Switch
                        aria-label={`${dayLabel} 운영 여부`}
                        checked={schedule.isOpen}
                        onCheckedChange={(checked) =>
                          updateWeekday(day, (next) => {
                            next.weeklyHours[day].isOpen = Boolean(checked);
                          })
                        }
                      />
                      <FieldLabel className="font-normal text-muted-foreground">
                        {schedule.isOpen ? "운영일" : "휴무일"}
                      </FieldLabel>
                    </Field>
                  </div>

                  <TimeRangeFields
                    day={day}
                    dayLabel={dayLabel}
                    disabled={!schedule.isOpen}
                    issues={validationIssues}
                    kind="treatment"
                    label="진료시간"
                    options={timeOptions}
                    value={schedule.treatment}
                    onChange={(edge, nextValue) => updateTime(day, "treatment", edge, nextValue)}
                  />
                  <TimeRangeFields
                    day={day}
                    dayLabel={dayLabel}
                    disabled={!schedule.isOpen}
                    issues={validationIssues}
                    kind="break"
                    label="휴게시간"
                    options={timeOptions}
                    value={schedule.break}
                    onChange={(edge, nextValue) => updateTime(day, "break", edge, nextValue)}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>공휴일 및 예외일</CardTitle>
          <CardDescription>
            공휴일 기본 정책과 특정 날짜의 예외 운영시간을 관리합니다.
          </CardDescription>
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={value.holidayPolicy}
              onValueChange={(nextValue) => {
                if (!nextValue) return;
                const next = cloneHospitalBasicSettingsDraft(value);
                next.holidayPolicy = nextValue as HospitalBasicSettingsDraft["holidayPolicy"];
                onChange(next);
              }}
            >
              <SelectTrigger aria-label="공휴일 기본 운영" size="sm" className="w-48 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.entries(holidayPolicyLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" onClick={() => openExceptionDialog()}>
              예외 일정 추가
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3">
          {value.holidayPolicy === "custom" ? (
            <FieldDescription>예외 일정을 추가해 날짜별 운영시간을 설정해 주세요.</FieldDescription>
          ) : null}
          {exceptions.length === 0 ? (
            <EmrEmptyState
              kind="no-data"
              priority="supporting"
              surface="table"
              size="sm"
              reserveActionSpace={false}
              testId="hospital-settings-exception-empty-state"
              title="등록된 예외 일정이 없습니다"
            />
          ) : (
            <div className="grid gap-2">
              {exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                  data-testid={`hospital-settings-exception-${exception.date}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CdsFilesCalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{exception.date}</span>
                    <span className="emr-text-dense text-muted-foreground">
                      {exceptionPolicyLabels[exception.mode]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openExceptionDialog(exception)}>
                      수정
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => deleteException(exception.id)}>
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(pendingTimePropagation)}
        onOpenChange={(open) => {
          if (!open) setPendingTimePropagation(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>다른 운영일에도 적용할까요?</DialogTitle>
            <DialogDescription>
              {pendingTimePropagation
                ? `${weekdayLabels[pendingTimePropagation.day]} ${
                    pendingTimePropagation.rangeKind === "treatment" ? "진료시간" : "휴게시간"
                  } 변경을 모든 운영일에 적용할 수 있습니다.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingTimePropagation(null)}>
              이 요일만 적용
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingTimePropagation) {
                  onChange(
                    applyScheduleRangeToOpenDays(
                      pendingTimePropagation.nextDraft,
                      pendingTimePropagation.day,
                      pendingTimePropagation.rangeKind
                    )
                  );
                }
                setPendingTimePropagation(null);
              }}
            >
              모든 운영일에 적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(exceptionDialog)}
        onOpenChange={(open) => {
          if (!open) setExceptionDialog(null);
        }}
      >
        {exceptionDialog ? (
          <DialogContent showCloseButton={false} className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{exceptionDialog.mode === "create" ? "예외 일정 추가" : "예외 일정 수정"}</DialogTitle>
              <DialogDescription>특정 날짜의 운영 방식을 설정합니다.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={Boolean(exceptionError)}>
                <FieldLabel htmlFor="hospital-settings-exception-date">날짜</FieldLabel>
                <Input
                  id="hospital-settings-exception-date"
                  type="date"
                  value={exceptionDialog.value.date}
                  aria-invalid={Boolean(exceptionError)}
                  onChange={(event) =>
                    setExceptionDialog((current) =>
                      current ? { ...current, value: { ...current.value, date: event.target.value } } : current
                    )
                  }
                />
                <FieldError>{exceptionError}</FieldError>
              </Field>
              <Field>
                <FieldLabel>운영 방식</FieldLabel>
                <Select
                  value={exceptionDialog.value.mode}
                  onValueChange={(nextValue) => {
                    if (!nextValue) return;
                    setExceptionDialog((current) =>
                      current
                        ? {
                            ...current,
                            value:
                              nextValue === "custom"
                                ? {
                                    ...createCustomException(current.value.id, current.value.date),
                                  }
                                : { id: current.value.id, date: current.value.date, mode: "closed" },
                          }
                        : current
                    );
                  }}
                >
                  <SelectTrigger aria-label="운영 방식" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="closed">휴무일</SelectItem>
                      <SelectItem value="custom">직접 설정</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {exceptionDialog.value.mode === "custom" ? (
                <ExceptionTimeFields
                  exception={exceptionDialog.value}
                  options={timeOptions}
                  onChange={(nextValue) =>
                    setExceptionDialog((current) =>
                      current ? { ...current, value: nextValue } : current
                    )
                  }
                />
              ) : null}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExceptionDialog(null)}>
                취소
              </Button>
              <Button type="button" onClick={saveException}>
                {exceptionDialog.mode === "create" ? "추가" : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function TimeRangeFields({
  day,
  dayLabel,
  disabled,
  issues,
  kind,
  label,
  onChange,
  options,
  value,
}: {
  day: Weekday;
  dayLabel: string;
  disabled: boolean;
  issues: HospitalSettingsValidationIssue[];
  kind: ScheduleRangeKind;
  label: string;
  onChange: (edge: keyof TimeRange, value: string) => void;
  options: string[];
  value: TimeRange;
}) {
  const fieldPrefix = `hospital-settings-${day}-${kind}`;
  const issue = issues.find((item) => item.fieldId.startsWith(fieldPrefix));

  return (
    <Field data-disabled={disabled} data-invalid={Boolean(issue)} className="gap-1.5">
      <FieldLabel className="text-xs text-muted-foreground">{label}</FieldLabel>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
        <TimeSelect
          ariaLabel={`${dayLabel} ${kind === "treatment" ? "진료" : "휴게"} 시작`}
          disabled={disabled}
          options={options}
          value={value.start}
          onChange={(nextValue) => onChange("start", nextValue)}
        />
        <span className="text-muted-foreground" aria-hidden="true">
          –
        </span>
        <TimeSelect
          ariaLabel={`${dayLabel} ${kind === "treatment" ? "진료" : "휴게"} 종료`}
          disabled={disabled}
          options={options}
          value={value.end}
          onChange={(nextValue) => onChange("end", nextValue)}
        />
      </div>
      <FieldError>{issue?.message}</FieldError>
    </Field>
  );
}

function TimeSelect({
  ariaLabel,
  disabled,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  disabled: boolean;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => nextValue && onChange(nextValue)}>
      <SelectTrigger aria-label={ariaLabel} disabled={disabled} size="sm" className="w-full bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ExceptionTimeFields({
  exception,
  onChange,
  options,
}: {
  exception: Extract<HospitalScheduleException, { mode: "custom" }>;
  onChange: (next: Extract<HospitalScheduleException, { mode: "custom" }>) => void;
  options: string[];
}) {
  const updateRange = (kind: ScheduleRangeKind, edge: keyof TimeRange, nextValue: string) => {
    onChange({
      ...exception,
      [kind]: { ...exception[kind], [edge]: nextValue },
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TimeRangeFields
        day="monday"
        dayLabel="예외 일정"
        disabled={false}
        issues={[]}
        kind="treatment"
        label="진료시간"
        options={options}
        value={exception.treatment}
        onChange={(edge, value) => updateRange("treatment", edge, value)}
      />
      <TimeRangeFields
        day="monday"
        dayLabel="예외 일정"
        disabled={false}
        issues={[]}
        kind="break"
        label="휴게시간"
        options={options}
        value={exception.break}
        onChange={(edge, value) => updateRange("break", edge, value)}
      />
    </div>
  );
}

function createEmptyException(): HospitalScheduleException {
  return { id: createExceptionId(), date: "", mode: "closed" };
}

function createCustomException(id: string, date: string): Extract<HospitalScheduleException, { mode: "custom" }> {
  return {
    id,
    date,
    mode: "custom",
    treatment: { start: "09:00", end: "19:00" },
    break: { start: "13:00", end: "14:00" },
  };
}

function cloneException(exception: HospitalScheduleException): HospitalScheduleException {
  return exception.mode === "closed"
    ? { ...exception }
    : { ...exception, treatment: { ...exception.treatment }, break: { ...exception.break } };
}

function createExceptionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `exception-${Date.now()}`;
}
