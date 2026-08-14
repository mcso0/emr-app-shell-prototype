"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatScheduleMinutes } from "../model";
import type {
  HospitalScheduleNonWorkEntry,
  HospitalScheduleRevisionStaff,
  HospitalScheduleWorkBlock,
} from "../revision-types";

export type ScheduleEntryEditorTarget =
  | { mode: "create"; date: string }
  | { mode: "work"; block: HospitalScheduleWorkBlock }
  | { mode: "non_work"; entry: HospitalScheduleNonWorkEntry }
  | null;

export function ScheduleShiftEditorSheet({
  deleting = false,
  onDelete,
  onDirtyChange,
  onOpenChange,
  onSave,
  staff,
  target,
}: {
  deleting?: boolean;
  onDelete?: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onSave: (value: ScheduleEditorValue) => Promise<void>;
  staff: HospitalScheduleRevisionStaff[];
  target: ScheduleEntryEditorTarget;
}) {
  const [draft, setDraft] = useState(() => makeDraft(target, staff));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!isValidDraft(draft)) return;
    setSaving(true);
    try {
      await onSave(draft);
      onDirtyChange(false);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      {target ? (
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{target.mode === "create" ? "근무 추가" : "근무 수정"}</SheetTitle>
            <SheetDescription>변경 내용은 서버 검증과 저장이 완료된 뒤 근무표에 반영됩니다.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <FieldGroup>
              <Field>
                <FieldLabel>유형</FieldLabel>
                <FieldContent>
                  <Select
                    value={draft.kind}
                    disabled={target.mode !== "create"}
                    onValueChange={(value) => {
                      const kind = value === "off" || value === "leave" ? value : "work";
                      onDirtyChange(true);
                      setDraft((current) => ({ ...current, kind }));
                    }}
                  >
                    <SelectTrigger aria-label="근무 유형" className="w-full">
                      {draft.kind === "work" ? "근무" : draft.kind === "leave" ? "휴가" : "휴무일"}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">근무</SelectItem>
                      <SelectItem value="leave">휴가</SelectItem>
                      <SelectItem value="off">휴무일</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>직원</FieldLabel>
                <FieldContent>
                  <Select
                    value={draft.staffProfileId ?? "unassigned"}
                    onValueChange={(value) => {
                      onDirtyChange(true);
                      setDraft((current) => ({ ...current, staffProfileId: value === "unassigned" ? null : value ?? null }));
                    }}
                  >
                    <SelectTrigger aria-label="직원" className="w-full">
                      {draft.staffProfileId
                        ? staff.find((member) => member.id === draft.staffProfileId)?.name
                        : "미배정"}
                    </SelectTrigger>
                    <SelectContent>
                      {draft.kind === "work" ? <SelectItem value="unassigned">미배정</SelectItem> : null}
                      {staff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} · {roleLabel(member.role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-v2-entry-date">날짜</FieldLabel>
                <FieldContent>
                  <Input
                    id="schedule-v2-entry-date"
                    type="date"
                    value={draft.date}
                    onChange={(event) => {
                      onDirtyChange(true);
                      setDraft((current) => ({ ...current, date: event.target.value }));
                    }}
                  />
                </FieldContent>
              </Field>
              {draft.kind === "work" ? (
                <Field>
                  <FieldLabel htmlFor="schedule-v2-work-label">업무</FieldLabel>
                  <FieldContent>
                    <Input
                      id="schedule-v2-work-label"
                      value={draft.workLabel}
                      placeholder="예: 진료"
                      onChange={(event) => {
                        onDirtyChange(true);
                        setDraft((current) => ({ ...current, workLabel: event.target.value }));
                      }}
                    />
                  </FieldContent>
                </Field>
              ) : null}
              {draft.kind !== "off" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="schedule-v2-start">시작</FieldLabel>
                    <FieldContent>
                      <Input
                        id="schedule-v2-start"
                        type="time"
                        value={formatScheduleMinutes(draft.startMinutes)}
                        onChange={(event) => {
                          onDirtyChange(true);
                          setDraft((current) => ({ ...current, startMinutes: getMinuteValue(event.target.value) }));
                        }}
                      />
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="schedule-v2-end">종료</FieldLabel>
                    <FieldContent>
                      <Input
                        id="schedule-v2-end"
                        type="time"
                        value={formatScheduleMinutes(draft.endMinutes)}
                        onChange={(event) => {
                          onDirtyChange(true);
                          setDraft((current) => ({ ...current, endMinutes: getMinuteValue(event.target.value) }));
                        }}
                      />
                    </FieldContent>
                  </Field>
                </div>
              ) : null}
            </FieldGroup>
          </div>
          <SheetFooter>
            {target.mode !== "create" && onDelete ? (
              <Button type="button" variant="destructive" onClick={() => void onDelete()} disabled={saving || deleting}>
                {deleting ? "삭제 중" : "삭제"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              취소
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || !isValidDraft(draft)}>
              {saving ? "저장 중" : "저장"}
            </Button>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

export type ScheduleEditorValue = {
  id: string | null;
  staffProfileId: string | null;
  date: string;
  kind: "work" | "leave" | "off";
  startMinutes: number;
  endMinutes: number;
  workLabel: string;
  workKind: "clinical" | "support" | "reception";
};

function makeDraft(
  target: ScheduleEntryEditorTarget,
  staff: HospitalScheduleRevisionStaff[],
): ScheduleEditorValue {
  if (target?.mode === "work") {
    return {
      id: target.block.id,
      staffProfileId: target.block.staffProfileId,
      date: target.block.shiftDate,
      kind: "work",
      startMinutes: target.block.startMinutes,
      endMinutes: target.block.endMinutes,
      workLabel: target.block.workLabelSnapshot,
      workKind: target.block.workKind,
    };
  }
  if (target?.mode === "non_work") {
    return {
      id: target.entry.id,
      staffProfileId: target.entry.staffProfileId,
      date: target.entry.entryDate,
      kind: target.entry.entryKind,
      startMinutes: target.entry.startMinutes ?? 9 * 60,
      endMinutes: target.entry.endMinutes ?? 18 * 60,
      workLabel: "",
      workKind: "clinical",
    };
  }
  return {
    id: null,
    staffProfileId: staff[0]?.id ?? null,
    date: target?.date ?? "",
    kind: "work",
    startMinutes: 9 * 60,
    endMinutes: 18 * 60,
    workLabel: "진료",
    workKind: "clinical",
  };
}

function isValidDraft(draft: ScheduleEditorValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return false;
  if (draft.kind === "off") return Boolean(draft.staffProfileId);
  if (draft.kind === "leave") return Boolean(draft.staffProfileId) && draft.endMinutes > draft.startMinutes;
  return draft.endMinutes > draft.startMinutes && draft.workLabel.trim().length > 0;
}

function getMinuteValue(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function roleLabel(role: HospitalScheduleRevisionStaff["role"]) {
  return role === "veterinarian" ? "수의사" : role === "technician" ? "테크니션" : "접수";
}
