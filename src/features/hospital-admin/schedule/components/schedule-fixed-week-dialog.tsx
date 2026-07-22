"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HospitalScheduleRevisionStaff } from "../revision-types";
import type { HospitalScheduleRole } from "../types";

const weekdayOptions = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 7, label: "일" },
] as const;

const roleOptions: Array<{ value: HospitalScheduleRole; label: string }> = [
  { value: "veterinarian", label: "수의사" },
  { value: "technician", label: "테크니션" },
  { value: "reception", label: "접수" },
];

export type FixedWeekValue = {
  weekdays: number[];
  startMinutes: number;
  endMinutes: number;
  roles: HospitalScheduleRole[];
};

export function ScheduleFixedWeekDialog({
  applying,
  onApply,
  onOpenChange,
  open,
  staff,
}: {
  applying: boolean;
  onApply: (value: FixedWeekValue) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  staff: HospitalScheduleRevisionStaff[];
}) {
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [roles, setRoles] = useState<HospitalScheduleRole[]>([
    "veterinarian",
    "technician",
    "reception",
  ]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("19:00");
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  const selectedStaffCount = useMemo(
    () => staff.filter((member) => roles.includes(member.role)).length,
    [roles, staff],
  );
  const valid =
    weekdays.length > 0 &&
    roles.length > 0 &&
    selectedStaffCount > 0 &&
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes > startMinutes;

  const toggleWeekday = (weekday: number) => {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((value) => value !== weekday)
        : [...current, weekday].sort((first, second) => first - second),
    );
  };

  const toggleRole = (role: HospitalScheduleRole) => {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((value) => value !== role)
        : [...current, role],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>기본 근무 일괄 입력</DialogTitle>
          <DialogDescription>
            선택한 직원에게 같은 요일과 시간을 채워요. 이미 입력된
            근무·휴무·휴가는 그대로 유지됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field>
            <FieldLabel>대상 직원</FieldLabel>
            <FieldContent>
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label="대상 역할"
              >
                {roleOptions.map((option) => {
                  const selected = roles.includes(option.value);
                  const count = staff.filter(
                    (member) => member.role === option.value,
                  ).length;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={selected ? "secondary" : "outline"}
                      className="h-auto justify-between px-3 py-2"
                      aria-pressed={selected}
                      onClick={() => toggleRole(option.value)}
                    >
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {count}명
                      </span>
                    </Button>
                  );
                })}
              </div>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>근무 요일</FieldLabel>
            <FieldContent>
              <div
                className="grid grid-cols-7 gap-1.5"
                role="group"
                aria-label="근무 요일"
              >
                {weekdayOptions.map((option) => {
                  const selected = weekdays.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`${option.label}요일`}
                      aria-pressed={selected}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted",
                      )}
                      onClick={() => toggleWeekday(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </FieldContent>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="fixed-week-start">시작</FieldLabel>
              <FieldContent>
                <Input
                  id="fixed-week-start"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="fixed-week-end">종료</FieldLabel>
              <FieldContent>
                <Input
                  id="fixed-week-end"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </FieldContent>
            </Field>
          </div>

          <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <p className="font-medium">
              {selectedStaffCount}명 · 주 {weekdays.length}일 ·{" "}
              {startTime || "--:--"}–{endTime || "--:--"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              이번 편집본에 최대 {selectedStaffCount * weekdays.length}건을
              추가하고, 기존 입력은 자동으로 건너뜁니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={applying}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            disabled={!valid || applying}
            onClick={() => {
              if (startMinutes === null || endMinutes === null) return;
              void onApply({ weekdays, roles, startMinutes, endMinutes });
            }}
          >
            {applying ? "입력 중" : "현재 주에 입력"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}
