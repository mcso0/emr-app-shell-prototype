export type CalendarOverlapRange = {
  readonly endMinutes: number;
  readonly id: string;
  readonly startMinutes: number;
};

export type CalendarOverlapLayout = {
  readonly columnCount: number;
  readonly columnIndex: number;
  readonly id: string;
  readonly leftPercent: number;
  readonly widthPercent: number;
};

type CalendarOverlapPlacement = {
  readonly columnIndex: number;
  readonly range: CalendarOverlapRange;
};

export function getCalendarOverlapLayouts(
  ranges: readonly CalendarOverlapRange[],
): CalendarOverlapLayout[] {
  const sortedRanges = ranges
    .filter(isValidCalendarOverlapRange)
    .sort(compareCalendarOverlapRanges);
  const layouts: CalendarOverlapLayout[] = [];
  let group: CalendarOverlapRange[] = [];
  let groupEndMinutes = Number.NEGATIVE_INFINITY;

  for (const range of sortedRanges) {
    if (group.length > 0 && range.startMinutes >= groupEndMinutes) {
      layouts.push(...getCalendarOverlapGroupLayouts(group));
      group = [];
      groupEndMinutes = Number.NEGATIVE_INFINITY;
    }

    group.push(range);
    groupEndMinutes = Math.max(groupEndMinutes, range.endMinutes);
  }

  if (group.length > 0) {
    layouts.push(...getCalendarOverlapGroupLayouts(group));
  }

  return layouts;
}

function getCalendarOverlapGroupLayouts(
  ranges: readonly CalendarOverlapRange[],
): CalendarOverlapLayout[] {
  const placements: CalendarOverlapPlacement[] = [];
  const columnEndMinutes: number[] = [];

  for (const range of ranges) {
    const reusableColumnIndex = getReusableOverlapColumnIndex(
      columnEndMinutes,
      range.startMinutes,
    );
    const columnIndex = reusableColumnIndex ?? columnEndMinutes.length;

    columnEndMinutes[columnIndex] = range.endMinutes;
    placements.push({ columnIndex, range });
  }

  const columnCount = columnEndMinutes.length;
  const widthPercent = 100 / columnCount;

  return placements.map(({ columnIndex, range }) => ({
    columnCount,
    columnIndex,
    id: range.id,
    leftPercent: widthPercent * columnIndex,
    widthPercent,
  }));
}

function getReusableOverlapColumnIndex(
  columnEndMinutes: readonly number[],
  startMinutes: number,
): number | undefined {
  for (let index = 0; index < columnEndMinutes.length; index += 1) {
    const columnEndMinutesValue = columnEndMinutes[index];

    if (
      columnEndMinutesValue !== undefined &&
      columnEndMinutesValue <= startMinutes
    ) {
      return index;
    }
  }

  return undefined;
}

function isValidCalendarOverlapRange(range: CalendarOverlapRange) {
  return (
    Number.isFinite(range.startMinutes) &&
    Number.isFinite(range.endMinutes) &&
    range.endMinutes > range.startMinutes
  );
}

function compareCalendarOverlapRanges(
  left: CalendarOverlapRange,
  right: CalendarOverlapRange,
) {
  return (
    left.startMinutes - right.startMinutes ||
    left.endMinutes - right.endMinutes ||
    left.id.localeCompare(right.id)
  );
}
