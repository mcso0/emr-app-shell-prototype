import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const componentPaths = [
  "src/features/hospital-admin/schedule/components/schedule-page-header.tsx",
  "src/features/hospital-admin/schedule/components/schedule-week-navigator.tsx",
  "src/features/hospital-admin/schedule/components/schedule-week-grid.tsx",
  "src/features/hospital-admin/schedule/components/schedule-day-list.tsx",
  "src/features/hospital-admin/schedule/components/schedule-data-state.tsx",
  "src/features/hospital-admin/schedule/components/schedule-fixed-week-dialog.tsx",
  "src/features/hospital-admin/schedule/components/schedule-shift-editor-sheet.tsx",
  "src/features/hospital-admin/schedule/components/schedule-publish-review-dialog.tsx",
];

test("v2 screen is composed from named components and schedule tokens", () => {
  const screen = readFileSync(
    "src/features/hospital-admin/schedule/schedule-v2-screen.tsx",
    "utf8",
  );
  const tokens = readFileSync("src/styles/tokens/emr-foundation.css", "utf8");

  for (const component of [
    "SchedulePageHeader",
    "ScheduleWeekNavigator",
    "ScheduleWeekGrid",
    "ScheduleDayList",
    "ScheduleDataState",
    "ScheduleFixedWeekDialog",
    "ScheduleShiftEditorSheet",
    "SchedulePublishReviewDialog",
  ]) {
    expect(screen).toContain(component);
  }
  expect(tokens).toContain("--emr-schedule-grid-staff-column");
  expect(tokens).toContain("--emr-schedule-shift-clinical-bg");
  expect(screen).toContain("게시 완료 · 프로필 확인 필요");
  expect(screen).toContain("읽기 확인 다시 시도");
  expect(screen).toContain("이전 버전으로 편집");
  expect(screen).toContain("overflow-y-auto");
  expect(screen).toContain("기본 근무 입력");
  expect(readFileSync(componentPaths[4], "utf8")).toContain('aria-busy="true"');
});

test("v2 schedule components do not add raw CLAiR palette references", () => {
  for (const path of componentPaths) {
    expect(readFileSync(path, "utf8")).not.toContain("clair-color-atomic-");
  }
});
