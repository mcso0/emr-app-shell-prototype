import { expect, test } from "@playwright/test";
import { compareHistoryDates, getHistoryDateRangeError, matchesHistoryDate, matchesHistoryQuery } from "../src/lib/history-controls";

test("history date boundaries include the entire Seoul day and reject invalid pairs", () => {
  const day = { start: "2026-07-01", end: "2026-07-01" };
  expect(matchesHistoryDate("2026-06-30T15:00:00Z", day)).toBe(true);
  expect(matchesHistoryDate("2026-07-01T14:59:59.999Z", day)).toBe(true);
  expect(matchesHistoryDate("2026-07-01T15:00:00Z", day)).toBe(false);
  expect(matchesHistoryDate(undefined, day)).toBe(false);
  expect(matchesHistoryDate(undefined, { start: "", end: "" })).toBe(true);
  expect(getHistoryDateRangeError({ start: "2026-07-02", end: "2026-07-01" })).toBeTruthy();
  expect(getHistoryDateRangeError({ start: "2026-02-29", end: "2026-03-01" })).toBeTruthy();
  expect(getHistoryDateRangeError({ start: "2028-02-29", end: "2028-02-29" })).toBeUndefined();
  expect(getHistoryDateRangeError({ start: "2026-07-01", end: "" })).toBeTruthy();
});

test("history search supports normalized multiword matching across fields", () => {
  expect(matchesHistoryQuery("  ＩＮＶ-１２３ 이수지  ", ["inv-123", "담당 이수지"])).toBe(true);
  expect(matchesHistoryQuery("inv-123 김도윤", ["inv-123", "이수지"])).toBe(false);
  expect(matchesHistoryQuery("<script>", ["초코"])).toBe(false);
  expect(matchesHistoryQuery("  ", [undefined])).toBe(true);
});

test("history sorting compares instants and keeps unknown dates last in both directions", () => {
  const earlier = "2026-07-01T00:00:00+09:00";
  const later = "2026-06-30T16:00:00Z";
  expect(compareHistoryDates(earlier, later, "newest")).toBeGreaterThan(0);
  expect(compareHistoryDates(earlier, later, "oldest")).toBeLessThan(0);
  for (const direction of ["newest", "oldest"] as const) {
    expect(compareHistoryDates(undefined, later, direction)).toBeGreaterThan(0);
    expect(compareHistoryDates("invalid", later, direction)).toBeGreaterThan(0);
  }
});
