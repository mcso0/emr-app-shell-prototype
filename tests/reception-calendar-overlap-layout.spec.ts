import { expect, test } from "@playwright/test";

import { getCalendarOverlapLayouts } from "../src/features/reception/calendar-overlap-layout";

test("reception calendar overlap layout splits same-lane cards into equal columns", () => {
  // Given: three cards assigned to the same veterinarian with overlapping time ranges.
  const ranges = [
    { id: "nana", startMinutes: 10 * 60 + 30, endMinutes: 11 * 60 },
    { id: "choco", startMinutes: 10 * 60 + 45, endMinutes: 11 * 60 + 15 },
    { id: "kong", startMinutes: 10 * 60 + 45, endMinutes: 11 * 60 + 30 },
  ];

  // When: the calendar computes horizontal placement for the lane.
  const layouts = getCalendarOverlapLayouts(ranges);

  // Then: every overlapping card gets an equal fill column from left to right.
  expect(layouts).toEqual([
    { columnCount: 3, columnIndex: 0, id: "nana", leftPercent: 0, widthPercent: 100 / 3 },
    {
      columnCount: 3,
      columnIndex: 1,
      id: "choco",
      leftPercent: 100 / 3,
      widthPercent: 100 / 3,
    },
    {
      columnCount: 3,
      columnIndex: 2,
      id: "kong",
      leftPercent: (100 / 3) * 2,
      widthPercent: 100 / 3,
    },
  ]);
});

test("reception calendar overlap layout reuses a column when ranges only touch", () => {
  // Given: cards that touch at the boundary and a middle card that overlaps both.
  const ranges = [
    { id: "morning", startMinutes: 9 * 60, endMinutes: 10 * 60 },
    { id: "bridge", startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 + 30 },
    { id: "next", startMinutes: 10 * 60, endMinutes: 11 * 60 },
  ];

  // When: the lane layout assigns overlap columns.
  const layouts = getCalendarOverlapLayouts(ranges);

  // Then: boundary-only neighbors can reuse the left column while the overlap count stays two.
  expect(layouts).toEqual([
    { columnCount: 2, columnIndex: 0, id: "morning", leftPercent: 0, widthPercent: 50 },
    { columnCount: 2, columnIndex: 1, id: "bridge", leftPercent: 50, widthPercent: 50 },
    { columnCount: 2, columnIndex: 0, id: "next", leftPercent: 0, widthPercent: 50 },
  ]);
});

test("reception calendar overlap layout keeps isolated ranges at full width", () => {
  // Given: two non-overlapping cards in the same veterinarian lane.
  const ranges = [
    { id: "first", startMinutes: 9 * 60, endMinutes: 9 * 60 + 30 },
    { id: "second", startMinutes: 10 * 60, endMinutes: 10 * 60 + 30 },
  ];

  // When: the lane layout is computed.
  const layouts = getCalendarOverlapLayouts(ranges);

  // Then: each isolated card keeps the whole lane width.
  expect(layouts).toEqual([
    { columnCount: 1, columnIndex: 0, id: "first", leftPercent: 0, widthPercent: 100 },
    { columnCount: 1, columnIndex: 0, id: "second", leftPercent: 0, widthPercent: 100 },
  ]);
});
