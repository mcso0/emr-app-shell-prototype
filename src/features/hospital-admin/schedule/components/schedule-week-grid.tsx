import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getWeekDates, formatScheduleMinutes } from "../model";
import type {
  HospitalScheduleNonWorkEntry,
  HospitalScheduleRevisionStaff,
  HospitalScheduleWorkBlock,
} from "../revision-types";

const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];

export function ScheduleWeekGrid({
  editable,
  nonWorkEntries,
  onEditNonWorkEntry,
  onEditWorkBlock,
  staff,
  weekStart,
  workBlocks,
}: {
  editable: boolean;
  nonWorkEntries: HospitalScheduleNonWorkEntry[];
  onEditNonWorkEntry: (entry: HospitalScheduleNonWorkEntry) => void;
  onEditWorkBlock: (block: HospitalScheduleWorkBlock) => void;
  staff: HospitalScheduleRevisionStaff[];
  weekStart: string;
  workBlocks: HospitalScheduleWorkBlock[];
}) {
  const dates = getWeekDates(weekStart);

  return (
    <ScrollArea className="hidden rounded-xl border bg-card md:block">
      <div className="min-w-[calc(var(--emr-schedule-grid-staff-column)+var(--emr-schedule-grid-day-column-min)*7)]">
        <div
          className="grid border-b bg-[var(--emr-schedule-grid-header-bg)]"
          style={{ gridTemplateColumns: "var(--emr-schedule-grid-staff-column) repeat(7, minmax(var(--emr-schedule-grid-day-column-min), 1fr))" }}
        >
          <div className="border-r p-[var(--emr-schedule-grid-cell-padding)] text-xs font-medium text-muted-foreground">
            직원 · 주간 시간
          </div>
          {dates.map((date, index) => (
            <div key={date} className="border-r p-[var(--emr-schedule-grid-cell-padding)] last:border-r-0">
              <p className="text-xs text-muted-foreground">{weekdayLabels[index]}</p>
              <p className="text-sm font-semibold tabular-nums">{date.slice(5).replace("-", ".")}</p>
            </div>
          ))}
        </div>
        {staff.map((member) => (
          <div
            key={member.id}
            className="grid border-b last:border-b-0"
            style={{ gridTemplateColumns: "var(--emr-schedule-grid-staff-column) repeat(7, minmax(var(--emr-schedule-grid-day-column-min), 1fr))" }}
          >
            <div className="border-r p-[var(--emr-schedule-grid-cell-padding)]">
              <p className="text-sm font-medium">{member.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{roleLabel(member.role)} · {weeklyMinutes(workBlocks, member.id)}h</p>
            </div>
            {dates.map((date) => (
              <ScheduleDayCell
                key={`${member.id}-${date}`}
                editable={editable}
                nonWorkEntries={nonWorkEntries.filter((entry) => entry.staffProfileId === member.id && entry.entryDate === date)}
                onEditNonWorkEntry={onEditNonWorkEntry}
                onEditWorkBlock={onEditWorkBlock}
                workBlocks={workBlocks.filter((block) => block.staffProfileId === member.id && block.shiftDate === date)}
              />
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function ScheduleDayCell({
  editable,
  nonWorkEntries,
  onEditNonWorkEntry,
  onEditWorkBlock,
  workBlocks,
}: {
  editable: boolean;
  nonWorkEntries: HospitalScheduleNonWorkEntry[];
  onEditNonWorkEntry: (entry: HospitalScheduleNonWorkEntry) => void;
  onEditWorkBlock: (block: HospitalScheduleWorkBlock) => void;
  workBlocks: HospitalScheduleWorkBlock[];
}) {
  return (
    <div className="min-h-[var(--emr-schedule-grid-row-min-height)] border-r p-[var(--emr-schedule-grid-cell-padding)] last:border-r-0">
      <div className="flex flex-col gap-1">
        {workBlocks.map((block) => (
          <ScheduleShiftBlock
            key={block.id}
            disabled={!editable}
            label={block.workLabelSnapshot}
            tone={block.workKind}
            timeLabel={`${formatScheduleMinutes(block.startMinutes)}–${formatScheduleMinutes(block.endMinutes)}`}
            onClick={() => onEditWorkBlock(block)}
          />
        ))}
        {nonWorkEntries.map((entry) => (
          <ScheduleShiftBlock
            key={entry.id}
            disabled={!editable}
            label={entry.entryKind === "leave" ? "휴가" : "휴무일"}
            tone={entry.entryKind}
            timeLabel={entry.startMinutes === null || entry.endMinutes === null ? "종일" : `${formatScheduleMinutes(entry.startMinutes)}–${formatScheduleMinutes(entry.endMinutes)}`}
            onClick={() => onEditNonWorkEntry(entry)}
          />
        ))}
      </div>
    </div>
  );
}

export function ScheduleShiftBlock({
  disabled,
  label,
  onClick,
  timeLabel,
  tone,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  timeLabel: string;
  tone: "clinical" | "support" | "reception" | "leave" | "off";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-100",
        toneClassName(tone),
      )}
    >
      <span className="block truncate text-xs font-semibold">{label}</span>
      <span className="block text-[11px] tabular-nums opacity-80">{timeLabel}</span>
    </button>
  );
}

function weeklyMinutes(workBlocks: HospitalScheduleWorkBlock[], staffProfileId: string) {
  const minutes = workBlocks
    .filter((block) => block.staffProfileId === staffProfileId)
    .reduce((total, block) => total + block.endMinutes - block.startMinutes, 0);
  return Math.round((minutes / 60) * 10) / 10;
}

function roleLabel(role: HospitalScheduleRevisionStaff["role"]) {
  return role === "veterinarian" ? "수의사" : role === "technician" ? "테크니션" : "접수";
}

function toneClassName(tone: "clinical" | "support" | "reception" | "leave" | "off") {
  return {
    clinical: "border-[var(--emr-schedule-shift-clinical-border)] bg-[var(--emr-schedule-shift-clinical-bg)] text-[var(--emr-schedule-shift-clinical-text)]",
    support: "border-[var(--emr-schedule-shift-support-border)] bg-[var(--emr-schedule-shift-support-bg)] text-[var(--emr-schedule-shift-support-text)]",
    reception: "border-[var(--emr-schedule-shift-reception-border)] bg-[var(--emr-schedule-shift-reception-bg)] text-[var(--emr-schedule-shift-reception-text)]",
    leave: "border-[var(--emr-schedule-shift-leave-border)] bg-[var(--emr-schedule-shift-leave-bg)] text-[var(--emr-schedule-shift-leave-text)]",
    off: "border-[var(--emr-schedule-shift-off-border)] bg-[var(--emr-schedule-shift-off-bg)] text-[var(--emr-schedule-shift-off-text)]",
  }[tone];
}
