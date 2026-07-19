import type { StaffOperationalShift } from "@/features/staff/server-operational-profile-core";

export function ProfileWorkInfoCard({
  currentMinutes,
  shift,
  todayDate,
}: {
  currentMinutes: number;
  shift: StaffOperationalShift;
  todayDate: string;
}) {
  const isLeave = shift.kind === "leave";
  const isOff = shift.kind === "off";
  const detailLabel = shift.locationLabel || shift.workLabel;
  const dateTone = isLeave
    ? {
        band: "bg-[var(--clair-color-atomic-green-50)]",
        day: "text-[var(--clair-color-atomic-green-500)]",
        state: "leave",
      }
    : isOff
      ? {
          band: "bg-[var(--clair-color-atomic-neutral-100)]",
          day: "text-[var(--clair-color-atomic-neutral-500)]",
          state: "off",
        }
      : {
          band: "bg-[var(--clair-color-atomic-gray-100)]",
          day: "text-[var(--emr-profile-work-info-active)]",
          state: "working",
        };

  return (
    <div
      className="flex h-[70px] w-[330px] max-w-full items-center gap-4 rounded-xl border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] py-[14px] pl-4 pr-3"
      data-testid="staff-profile-work-info-card"
      data-work-info-state={dateTone.state}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          aria-hidden="true"
          className="grid size-[42px] shrink-0 grid-rows-[12px_1fr] overflow-hidden rounded-md border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)]"
        >
          <span className={dateTone.band} />
          <span
            className={`flex items-center justify-center pb-[3px] text-base leading-4 font-bold tracking-[0.019em] tabular-nums ${dateTone.day}`}
          >
            {shift.date.slice(-2)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-base leading-6 font-semibold tracking-[0.006em] tabular-nums text-[var(--emr-text-primary)]">
            {isLeave
              ? shift.workLabel || "휴가"
              : isOff
                ? "휴무일"
                : `${formatMinutes(shift.startMinutes)} - ${formatMinutes(shift.endMinutes)}`}
          </p>
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[13px] leading-[18px] font-medium tracking-[0.019em] text-[var(--emr-text-secondary)]">
            {isLeave ? (
              formatWorkInfoDate(shift.date)
            ) : isOff ? (
              "개인 일정"
            ) : (
              <>
                <span className="shrink-0 text-[var(--emr-profile-work-info-active)]">
                  {getShiftStateLabel({ currentMinutes, shift, todayDate })}
                </span>
                {detailLabel ? <span aria-hidden="true">·</span> : null}
                {detailLabel ? <span className="truncate">{detailLabel}</span> : null}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProfileWorkInfoEmptyCard({
  children = "오늘 게시된 근무가 없어요",
}: {
  children?: string;
}) {
  return (
    <div
      className="flex h-[70px] w-[330px] max-w-full items-center justify-center gap-4 rounded-xl border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] py-[14px] pl-4 pr-3"
      data-testid="staff-profile-work-info-empty-card"
    >
      <p className="text-center text-sm leading-5 font-medium tracking-[0.014em] text-[var(--emr-text-tertiary)]">
        {children}
      </p>
    </div>
  );
}

function formatWorkInfoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}(${weekday})`;
}

function getShiftStateLabel({
  currentMinutes,
  shift,
  todayDate,
}: {
  currentMinutes: number;
  shift: StaffOperationalShift;
  todayDate: string;
}) {
  if (shift.date < todayDate) return "근무 종료";
  if (shift.date > todayDate) return "근무 예정";
  if (currentMinutes < shift.startMinutes) return "근무 전";
  if (currentMinutes >= shift.endMinutes) return "근무 종료";
  return "근무 중";
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
