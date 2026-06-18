export type CalendarTimeRangeLayout = {
  height: number;
  top: number;
};

export function getCalendarTimeRangeLayout({
  endMinutes,
  hourRowHeight,
  minDurationMinutes,
  scheduleStartMinutes,
  startMinutes,
}: {
  endMinutes: number;
  hourRowHeight: number;
  minDurationMinutes: number;
  scheduleStartMinutes: number;
  startMinutes: number;
}): CalendarTimeRangeLayout | undefined {
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return undefined;
  }

  const durationMinutes = endMinutes - startMinutes;
  if (durationMinutes <= 0) return undefined;

  const pixelsPerMinute = hourRowHeight / 60;
  const minHeight = minDurationMinutes * pixelsPerMinute;

  return {
    height: Math.max(minHeight, durationMinutes * pixelsPerMinute),
    top: (startMinutes - scheduleStartMinutes) * pixelsPerMinute,
  };
}
