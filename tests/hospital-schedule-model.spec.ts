import { expect, test } from "@playwright/test";
import { hospitalScheduleSeed } from "@/features/hospital-admin/schedule/fixtures";
import {
  applyApprovedRequest,
  getCoverageIssues,
  getScheduleConflicts,
  getWeekDates,
} from "@/features/hospital-admin/schedule/model";

test("hospital schedule creates a seven-day Monday-first week", () => {
  expect(getWeekDates("2026-07-06")).toEqual([
    "2026-07-06",
    "2026-07-07",
    "2026-07-08",
    "2026-07-09",
    "2026-07-10",
    "2026-07-11",
    "2026-07-12",
  ]);
});

test("hospital schedule reports the seeded availability conflict", () => {
  expect(getScheduleConflicts(hospitalScheduleSeed)).toContainEqual(
    expect.objectContaining({
      kind: "availability",
      shiftId: "shift-suji-friday",
      staffId: "staff-suji",
    })
  );
});

test("hospital schedule finds the seeded reception coverage gap", () => {
  expect(getCoverageIssues(hospitalScheduleSeed)).toContainEqual(
    expect.objectContaining({
      date: "2026-07-07",
      role: "reception",
      startMinutes: 17 * 60,
      endMinutes: 18 * 60,
    })
  );
});

test("approved shift-change requests update a shift and require republishing", () => {
  const request = hospitalScheduleSeed.requests.find(
    (candidate) => candidate.id === "request-suji-friday"
  );

  expect(request).toBeDefined();

  const next = applyApprovedRequest(hospitalScheduleSeed, request!);

  expect(next.shifts.find((shift) => shift.id === "shift-suji-friday")).toMatchObject({
    endMinutes: 18 * 60,
  });
  expect(next.publication.state).toBe("changed");
  expect(next.requests.find((candidate) => candidate.id === request!.id)).toMatchObject({
    status: "approved",
  });
});
