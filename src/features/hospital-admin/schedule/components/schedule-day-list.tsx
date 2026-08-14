import { getWeekDates, formatScheduleMinutes } from "../model";
import type {
  HospitalScheduleNonWorkEntry,
  HospitalScheduleRevisionStaff,
  HospitalScheduleWorkBlock,
} from "../revision-types";
import { ScheduleShiftBlock } from "./schedule-week-grid";

export function ScheduleDayList({
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
  return (
    <div data-testid="hospital-schedule-v2-day-list" className="space-y-3 md:hidden">
      {getWeekDates(weekStart).map((date) => (
        <section key={date} className="rounded-xl border bg-card p-3">
          <h2 className="text-sm font-semibold">{formatDateLabel(date)}</h2>
          <div className="mt-3 space-y-3">
            {staff.map((member) => {
              const memberBlocks = workBlocks.filter(
                (block) => block.staffProfileId === member.id && block.shiftDate === date,
              );
              const memberNonWork = nonWorkEntries.filter(
                (entry) => entry.staffProfileId === member.id && entry.entryDate === date,
              );
              if (!memberBlocks.length && !memberNonWork.length) return null;
              return (
                <div key={member.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                  <p className="pt-1 text-xs font-medium text-muted-foreground">{member.name}</p>
                  <div className="space-y-1">
                    {memberBlocks.map((block) => (
                      <ScheduleShiftBlock
                        key={block.id}
                        disabled={!editable}
                        label={block.workLabelSnapshot}
                        tone={block.workKind}
                        timeLabel={`${formatScheduleMinutes(block.startMinutes)}–${formatScheduleMinutes(block.endMinutes)}`}
                        onClick={() => onEditWorkBlock(block)}
                      />
                    ))}
                    {memberNonWork.map((entry) => (
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
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${month}.${day} (${weekday})`;
}
