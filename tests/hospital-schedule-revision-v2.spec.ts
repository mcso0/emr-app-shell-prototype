import { expect, test } from "@playwright/test";
import {
  getScheduleRevisionIssues,
  getScheduleWeekStart,
  rangesOverlap,
} from "@/features/hospital-admin/schedule/revision-model";

test("revision model preserves adjacent split shifts and blocks overlapping work", () => {
  const issues = getScheduleRevisionIssues({
    weekStart: "2026-07-20",
    completenessStaff: [],
    nonWorkEntries: [],
    workBlocks: [
      {
        id: "morning",
        staffProfileId: "staff-1",
        shiftDate: "2026-07-20",
        startMinutes: 540,
        endMinutes: 720,
        workKind: "clinical",
        workLabelSnapshot: "진료",
        locationLabelSnapshot: null,
        privateNote: null,
      },
      {
        id: "afternoon",
        staffProfileId: "staff-1",
        shiftDate: "2026-07-20",
        startMinutes: 720,
        endMinutes: 1080,
        workKind: "clinical",
        workLabelSnapshot: "진료",
        locationLabelSnapshot: null,
        privateNote: null,
      },
      {
        id: "overlap",
        staffProfileId: "staff-1",
        shiftDate: "2026-07-20",
        startMinutes: 700,
        endMinutes: 800,
        workKind: "clinical",
        workLabelSnapshot: "진료",
        locationLabelSnapshot: null,
        privateNote: null,
      },
    ],
  });

  expect(rangesOverlap(540, 720, 720, 1080)).toBe(false);
  expect(issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: "overlapping_assignment", entryId: "overlap" })]),
  );
});

test("revision model separates missing assignment from explicit off", () => {
  const issues = getScheduleRevisionIssues({
    weekStart: "2026-07-20",
    completenessStaff: [{ staffProfileId: "staff-1", role: "veterinarian", required: true, active: true }],
    workBlocks: [],
    nonWorkEntries: [
      {
        id: "off-monday",
        staffProfileId: "staff-1",
        entryDate: "2026-07-20",
        entryKind: "off",
        leaveSubtype: null,
        startMinutes: null,
        endMinutes: null,
        privateNote: null,
      },
    ],
  });

  expect(getScheduleWeekStart("2026-07-26")).toBe("2026-07-20");
  expect(issues.some((item) => item.date === "2026-07-20" && item.code === "missing_required_assignment")).toBe(false);
  expect(issues.some((item) => item.date === "2026-07-21" && item.code === "missing_required_assignment")).toBe(true);
});
