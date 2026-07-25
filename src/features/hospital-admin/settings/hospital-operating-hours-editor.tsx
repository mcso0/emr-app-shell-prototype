"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  CdsActionsPlusIcon,
  CdsActionsTrashIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsContentEditIcon } from "@/components/cds-icons/content-and-editor";
import {
  CdsFilesCalendarIcon,
  CdsFilesClockIcon,
} from "@/components/cds-icons/files-and-layout";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  cloneHospitalBasicSettingsDraft,
  createTimeOptions,
  setOpenWeekdays,
  validateHospitalBasicSettingsDraft,
  validateOperatingHoursDraft,
  weekdays,
  type HospitalBasicSettingsDraft,
  type HospitalScheduleException,
  type HospitalSettingsValidationIssue,
  type ScheduleRangeKind,
  type TimeRange,
  type Weekday,
  type WeekdaySchedule,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";

type HospitalOperatingHoursEditorProps = {
  value: HospitalBasicSettingsDraft;
  validationIssues: HospitalSettingsValidationIssue[];
  onChange: (next: HospitalBasicSettingsDraft) => void;
};

type TimeDialogState = {
  day: Weekday;
  schedule: WeekdaySchedule;
} | null;

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

const weekdayShortLabels: Record<Weekday, string> = {
  monday: "월",
  tuesday: "화",
  wednesday: "수",
  thursday: "목",
  friday: "금",
  saturday: "토",
  sunday: "일",
};

const holidayPolicyLabels = {
  closed: "휴무일",
  custom: "예외 일정만 적용",
  weekday: "평일과 동일",
} as const;

const exceptionPolicyLabels = {
  closed: "휴무",
  custom: "단축 운영",
} as const;

export function HospitalOperatingHoursEditor({
  value,
  validationIssues,
  onChange,
}: HospitalOperatingHoursEditorProps) {
  const [timeDialog, setTimeDialog] = useState<TimeDialogState>(null);
  const [timeDialogError, setTimeDialogError] = useState("");
  const [exceptionDialog, setExceptionDialog] =
    useState<ExceptionDialogState>(null);
  const [exceptionError, setExceptionError] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<HospitalScheduleException | null>(null);
  const firstTimeSelectRef = useRef<HTMLButtonElement>(null);
  const timeOptions = useMemo(() => createTimeOptions(), []);
  const openDays = weekdays.filter((day) => value.weeklyHours[day].isOpen);

  const handleOpenDaysChange = (nextValues: string[]) => {
    const nextOpenDays = nextValues.filter(isWeekday);
    const changedDay = weekdays.find(
      (day) => openDays.includes(day) !== nextOpenDays.includes(day),
    );
    onChange(setOpenWeekdays(value, nextOpenDays));
    if (changedDay) {
      toast.success(
        `${weekdayLabels[changedDay]}을 ${
          nextOpenDays.includes(changedDay) ? "운영일" : "휴무일"
        }로 변경했습니다.`,
      );
    }
  };

  const openTimeDialog = (day: Weekday) => {
    if (!value.weeklyHours[day].isOpen) return;
    setTimeDialog({
      day,
      schedule: structuredClone(value.weeklyHours[day]),
    });
    setTimeDialogError("");
  };

  const applyTimeDialog = () => {
    if (!timeDialog) return;
    const next = cloneHospitalBasicSettingsDraft(value);
    next.weeklyHours[timeDialog.day] = structuredClone(timeDialog.schedule);
    const issue = validateOperatingHoursDraft(next).find((item) =>
      item.fieldId.startsWith(`hospital-settings-${timeDialog.day}`),
    );
    if (issue) {
      setTimeDialogError(issue.message);
      window.requestAnimationFrame(() => firstTimeSelectRef.current?.focus());
      toast.error("운영시간을 확인해 주세요.");
      return;
    }

    onChange(next);
    toast.success(`${weekdayLabels[timeDialog.day]} 운영시간을 적용했습니다.`);
    setTimeDialog(null);
  };

  const openExceptionDialog = (exception?: HospitalScheduleException) => {
    setExceptionError("");
    setExceptionDialog(
      exception
        ? { mode: "edit", value: cloneException(exception) }
        : { mode: "create", value: createEmptyException() },
    );
  };

  const saveException = () => {
    if (!exceptionDialog) return;
    const exception = exceptionDialog.value;
    const duplicate = value.exceptions.some(
      (item) => item.date === exception.date && item.id !== exception.id,
    );

    if (!exception.date) {
      setExceptionError("날짜를 선택해 주세요.");
      toast.error("예외 일정의 날짜를 선택해 주세요.");
      return;
    }
    if (duplicate) {
      setExceptionError("같은 날짜의 예외 일정이 이미 있습니다.");
      toast.error("이미 등록된 날짜입니다.");
      return;
    }

    const validation = validateHospitalBasicSettingsDraft({
      ...value,
      exceptions: [exception],
    });
    const exceptionIssue = validation.find((issue) =>
      issue.fieldId.includes(exception.id),
    );
    if (exceptionIssue) {
      setExceptionError(exceptionIssue.message);
      toast.error("예외 일정의 운영시간을 확인해 주세요.");
      return;
    }

    const next = cloneHospitalBasicSettingsDraft(value);
    next.exceptions =
      exceptionDialog.mode === "create"
        ? [...next.exceptions, exception]
        : next.exceptions.map((item) =>
            item.id === exception.id ? exception : item,
          );
    onChange(next);
    toast.success(
      exceptionDialog.mode === "create"
        ? "예외 일정이 추가되었습니다."
        : "예외 일정이 수정되었습니다.",
    );
    setExceptionDialog(null);
  };

  const deleteException = (exceptionId: string) => {
    const next = cloneHospitalBasicSettingsDraft(value);
    next.exceptions = next.exceptions.filter(
      (exception) => exception.id !== exceptionId,
    );
    onChange(next);
    toast.success("예외 일정이 삭제되었습니다.");
    setDeleteTarget(null);
  };

  const exceptions = [...value.exceptions].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  return (
    <div className="flex flex-col gap-4">
      <section
        className="flex w-full flex-col pb-2"
        aria-labelledby="hospital-settings-hours-title"
      >
        <div className="flex min-h-[74px] flex-col justify-center gap-1 px-4 py-3.5">
          <h2
            id="hospital-settings-hours-title"
            className="text-base leading-6 font-semibold"
          >
            주간 운영시간
          </h2>
          <p className="text-[13px] leading-[18px] font-medium tracking-[0.019em] text-muted-foreground">
            운영일을 선택하고 각 요일의 시간을 설정합니다.
          </p>
        </div>

        <Card
          className="gap-0 border-0 py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]"
          data-testid="hospital-settings-hours-card"
        >
          <CardContent className="p-0">
            <div className="relative flex flex-col gap-3 px-4 py-4 after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-border md:min-h-[85px] md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-5 md:after:right-6 md:after:left-6">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm leading-5 font-medium tracking-[0.014em]">
                  운영 요일
                </p>
                <p className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
                  진료와 예약을 운영하는 요일을 선택합니다.
                </p>
              </div>
              <ToggleGroup
                aria-label="운영 요일"
                multiple
                size="sm"
                spacing={1}
                className="flex-wrap justify-start md:flex-nowrap md:justify-end"
                value={openDays}
                onValueChange={handleOpenDaysChange}
              >
                {weekdays.map((day) => (
                  <ToggleGroupItem
                    key={day}
                    value={day}
                    aria-label={`${weekdayLabels[day]} 운영`}
                    className="size-8 min-w-8 rounded-lg px-0 aria-pressed:bg-neutral-800 aria-pressed:text-white data-[state=on]:bg-neutral-800 data-[state=on]:text-white"
                  >
                    {weekdayShortLabels[day]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {weekdays.map((day) => {
              const schedule = value.weeklyHours[day];
              const dayLabel = weekdayLabels[day];
              return (
                <div
                  key={day}
                  className="relative flex flex-col gap-3 px-4 py-4 after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-border last:after:hidden md:min-h-[85px] md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-5 md:after:right-6 md:after:left-6 last:md:min-h-[84px]"
                  data-testid={`hospital-settings-day-${day}`}
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="text-sm leading-5 font-medium tracking-[0.014em]">
                      {dayLabel}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {schedule.isOpen ? (
                        <>
                          <Badge
                            size="md"
                            className="border-0 bg-sky-50 text-sky-700"
                          >
                            운영: {formatRange(schedule.treatment)}
                          </Badge>
                          <Badge
                            size="md"
                            variant="secondary"
                            className="border-0 bg-black/[0.04] text-foreground"
                          >
                            휴게: {formatRange(schedule.break)}
                          </Badge>
                        </>
                      ) : (
                        <Badge
                          size="md"
                          variant="secondary"
                          className="border-0 bg-black/[0.04] text-foreground"
                        >
                          휴무일
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!schedule.isOpen}
                    aria-label={`${dayLabel} 운영시간 설정`}
                    onClick={() => openTimeDialog(day)}
                  >
                    {schedule.isOpen ? (
                      <CdsFilesClockIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                    ) : (
                      <CdsFilesCalendarIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                    )}
                    {schedule.isOpen
                      ? formatRange(schedule.treatment)
                      : "휴무일"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
        {validationIssues.length > 0 ? (
          <p className="text-sm text-destructive" role="alert">
            운영시간 입력값을 확인해 주세요.
          </p>
        ) : null}
      </section>

      <section
        className="flex w-full flex-col pb-2"
        aria-labelledby="hospital-settings-exceptions-title"
      >
        <div className="flex min-h-[74px] flex-col justify-center gap-1 px-4 py-3.5">
          <h2
            id="hospital-settings-exceptions-title"
            className="text-base leading-6 font-semibold"
          >
            공휴일 및 예외일
          </h2>
          <p className="text-[13px] leading-[18px] font-medium tracking-[0.019em] text-muted-foreground">
            공휴일 정책과 날짜별 예외 운영 일정을 설정합니다.
          </p>
        </div>

        <Card
          className="gap-0 border-0 py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]"
          data-testid="hospital-settings-exceptions-card"
        >
          <CardContent className="p-0">
            <div className="relative flex flex-col gap-3 px-4 py-4 after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-border md:min-h-[85px] md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-5 md:after:right-6 md:after:left-6">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm leading-5 font-medium tracking-[0.014em]">
                  공휴일 기본 정책
                </p>
                <p className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
                  등록된 예외 일정이 없을 때 적용되는 운영 기준입니다.
                </p>
              </div>
              <Select
                value={value.holidayPolicy}
                onValueChange={(nextValue) => {
                  if (!nextValue) return;
                  const next = cloneHospitalBasicSettingsDraft(value);
                  next.holidayPolicy =
                    nextValue as HospitalBasicSettingsDraft["holidayPolicy"];
                  onChange(next);
                  toast.success("공휴일 기본 정책을 변경했습니다.");
                }}
              >
                <SelectTrigger
                  aria-label="공휴일 기본 정책"
                  className="w-full md:w-[320px]"
                >
                  <SelectValue>
                    {holidayPolicyLabels[value.holidayPolicy]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(holidayPolicyLabels).map(
                      ([policy, label]) => (
                        <SelectItem key={policy} value={policy}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {exceptions.length === 0 ? (
              <div
                className="flex flex-col gap-3 px-4 py-4 md:min-h-[84px] md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-5"
                data-testid="hospital-settings-exception-empty-state"
              >
                <p className="text-sm leading-5 font-medium tracking-[0.014em] text-muted-foreground">
                  등록된 예외 일정이 없습니다
                </p>
                <AddExceptionButton onClick={() => openExceptionDialog()} />
              </div>
            ) : (
              exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="relative flex flex-col gap-3 px-4 py-4 after:absolute after:right-4 after:bottom-0 after:left-4 after:h-px after:bg-border md:min-h-[85px] md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-5 md:after:right-6 md:after:left-6"
                  data-testid={`hospital-settings-exception-${exception.date}`}
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <CdsFilesCalendarIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                      <p className="text-sm leading-5 font-medium tracking-[0.014em]">
                        {formatDisplayDate(exception.date)}
                      </p>
                    </div>
                    <ExceptionBadges exception={exception} />
                  </div>
                  <div className="flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openExceptionDialog(exception)}
                    >
                      <CdsContentEditIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      수정
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteTarget(exception)}
                    >
                      <CdsActionsTrashIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      삭제
                    </Button>
                  </div>
                </div>
              ))
            )}
            {exceptions.length > 0 ? (
              <div className="flex min-h-[84px] items-center justify-end px-4 py-4 md:px-6 md:py-5">
                <AddExceptionButton onClick={() => openExceptionDialog()} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={Boolean(timeDialog)}
        onOpenChange={(open) => {
          if (!open) setTimeDialog(null);
        }}
      >
        {timeDialog ? (
          <DialogContent showCloseButton={false} className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {weekdayLabels[timeDialog.day]} 운영시간 설정
              </DialogTitle>
              <DialogDescription>
                진료시간과 휴게시간을 설정합니다.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <DialogTimeRangeFields
                firstTriggerRef={firstTimeSelectRef}
                kind="treatment"
                label="진료시간"
                options={timeOptions}
                value={timeDialog.schedule.treatment}
                onChange={(edge, nextValue) =>
                  setTimeDialog((current) =>
                    current
                      ? {
                          ...current,
                          schedule: {
                            ...current.schedule,
                            treatment: {
                              ...current.schedule.treatment,
                              [edge]: nextValue,
                            },
                          },
                        }
                      : current,
                  )
                }
              />
              <DialogTimeRangeFields
                kind="break"
                label="휴게시간"
                options={timeOptions}
                value={timeDialog.schedule.break}
                onChange={(edge, nextValue) =>
                  setTimeDialog((current) =>
                    current
                      ? {
                          ...current,
                          schedule: {
                            ...current.schedule,
                            break: {
                              ...current.schedule.break,
                              [edge]: nextValue,
                            },
                          },
                        }
                      : current,
                  )
                }
              />
              <FieldError>{timeDialogError}</FieldError>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTimeDialog(null)}
              >
                취소
              </Button>
              <Button type="button" onClick={applyTimeDialog}>
                운영시간 적용
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
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
              <DialogTitle>
                {exceptionDialog.mode === "create"
                  ? "예외 일정 추가"
                  : "예외 일정 수정"}
              </DialogTitle>
              <DialogDescription>
                특정 날짜의 휴무 또는 단축 운영시간을 설정합니다.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={Boolean(exceptionError)}>
                <FieldLabel htmlFor="hospital-settings-exception-date">
                  날짜
                </FieldLabel>
                <Input
                  id="hospital-settings-exception-date"
                  type="date"
                  value={exceptionDialog.value.date}
                  aria-invalid={Boolean(exceptionError)}
                  onChange={(event) =>
                    setExceptionDialog((current) =>
                      current
                        ? {
                            ...current,
                            value: {
                              ...current.value,
                              date: event.target.value,
                            },
                          }
                        : current,
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
                                ? createCustomException(
                                    current.value.id,
                                    current.value.date,
                                  )
                                : {
                                    id: current.value.id,
                                    date: current.value.date,
                                    mode: "closed",
                                  },
                          }
                        : current,
                    );
                  }}
                >
                  <SelectTrigger aria-label="운영 방식" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="closed">휴무</SelectItem>
                      <SelectItem value="custom">단축 운영</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {exceptionDialog.value.mode === "custom" ? (
                <>
                  <DialogTimeRangeFields
                    kind="treatment"
                    label="진료시간"
                    options={timeOptions}
                    value={exceptionDialog.value.treatment}
                    onChange={(edge, nextValue) =>
                      setExceptionDialog((current) =>
                        current?.value.mode === "custom"
                          ? {
                              ...current,
                              value: {
                                ...current.value,
                                treatment: {
                                  ...current.value.treatment,
                                  [edge]: nextValue,
                                },
                              },
                            }
                          : current,
                      )
                    }
                  />
                  <DialogTimeRangeFields
                    kind="break"
                    label="휴게시간"
                    options={timeOptions}
                    value={exceptionDialog.value.break}
                    onChange={(edge, nextValue) =>
                      setExceptionDialog((current) =>
                        current?.value.mode === "custom"
                          ? {
                              ...current,
                              value: {
                                ...current.value,
                                break: {
                                  ...current.value.break,
                                  [edge]: nextValue,
                                },
                              },
                            }
                          : current,
                      )
                    }
                  />
                </>
              ) : null}
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setExceptionDialog(null)}
              >
                취소
              </Button>
              <Button type="button" onClick={saveException}>
                {exceptionDialog.mode === "create" ? "추가" : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <EmrConfirmDialogContent
          title="예외 일정을 삭제하시겠습니까?"
          description="삭제한 일정은 변경사항을 저장하기 전까지 되돌릴 수 있습니다."
          cancelLabel="취소"
          confirmLabel="삭제"
          confirmButtonVariant="destructive"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget) deleteException(deleteTarget.id);
          }}
        />
      </Dialog>
    </div>
  );
}

function DialogTimeRangeFields({
  firstTriggerRef,
  kind,
  label,
  onChange,
  options,
  value,
}: {
  firstTriggerRef?: React.RefObject<HTMLButtonElement | null>;
  kind: ScheduleRangeKind;
  label: string;
  onChange: (edge: keyof TimeRange, value: string) => void;
  options: string[];
  value: TimeRange;
}) {
  const prefix = kind === "treatment" ? "진료" : "휴게";
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <TimeSelect
          triggerRef={firstTriggerRef}
          ariaLabel={`${prefix} 시작`}
          options={options}
          value={value.start}
          onChange={(nextValue) => onChange("start", nextValue)}
        />
        <span className="text-muted-foreground" aria-hidden="true">
          –
        </span>
        <TimeSelect
          ariaLabel={`${prefix} 종료`}
          options={options}
          value={value.end}
          onChange={(nextValue) => onChange("end", nextValue)}
        />
      </div>
    </Field>
  );
}

function TimeSelect({
  ariaLabel,
  onChange,
  options,
  triggerRef,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: string[];
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  value: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => nextValue && onChange(nextValue)}
    >
      <SelectTrigger ref={triggerRef} aria-label={ariaLabel} className="w-full">
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

function formatRange(range: TimeRange): string {
  return `${range.start}-${range.end}`;
}

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}년 ${month}월 ${day}일`;
}

function ExceptionBadges({
  exception,
}: {
  exception: HospitalScheduleException;
}) {
  if (exception.mode === "closed") {
    return (
      <Badge
        size="md"
        variant="secondary"
        className="border-0 bg-black/[0.04] text-foreground"
      >
        휴무일
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge size="md" className="border-0 bg-sky-50 text-sky-700">
        {exceptionPolicyLabels[exception.mode]}:{" "}
        {formatRange(exception.treatment)}
      </Badge>
      <Badge
        size="md"
        variant="secondary"
        className="border-0 bg-black/[0.04] text-foreground"
      >
        휴게: {formatRange(exception.break)}
      </Badge>
    </div>
  );
}

function AddExceptionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      <CdsActionsPlusIcon data-icon="inline-start" aria-hidden="true" />
      예외 일정 추가
    </Button>
  );
}

function createEmptyException(): HospitalScheduleException {
  return { id: createExceptionId(), date: "", mode: "closed" };
}

function createCustomException(
  id: string,
  date: string,
): Extract<HospitalScheduleException, { mode: "custom" }> {
  return {
    id,
    date,
    mode: "custom",
    treatment: { start: "09:00", end: "19:00" },
    break: { start: "13:00", end: "14:00" },
  };
}

function cloneException(
  exception: HospitalScheduleException,
): HospitalScheduleException {
  return exception.mode === "closed"
    ? { ...exception }
    : {
        ...exception,
        treatment: { ...exception.treatment },
        break: { ...exception.break },
      };
}

function createExceptionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `exception-${Date.now()}`;
}

function isWeekday(value: string): value is Weekday {
  return weekdays.includes(value as Weekday);
}
