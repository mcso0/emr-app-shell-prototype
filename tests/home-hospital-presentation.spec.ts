import { expect, test } from "@playwright/test";
import { compareHospitalTasks, countHospitalWorkTypes, getHospitalStatus } from "../src/features/home/home-hospital-presentation";
import type { HomeTask } from "../src/features/home/home.types";

function task(id: string, status: HomeTask["status"], requestedAt: string, signals: HomeTask["attentionSignals"] = [], kanbanColumn: HomeTask["kanbanColumn"] = "lab") {
  return { id, status, progressState: status, requestedAt, attentionSignals: signals, kanbanColumn } as HomeTask;
}

test("hospital status is single-valued and terminal states win over re-request", () => {
  expect(getHospitalStatus(task("one", "waiting", "2026-09-22T09:00:00+09:00", ["re_requested"]))).toBe("re_requested");
  expect(getHospitalStatus(task("two", "completed", "2026-09-22T09:00:00+09:00", ["re_requested"]))).toBe("completed");
  expect(getHospitalStatus(task("three", "cancelled", "2026-09-22T09:00:00+09:00", ["re_requested"]))).toBe("cancelled");
});

test("hospital ordering puts unfinished urgent first, keeps terminal newest first, and places invalid times last", () => {
  const items = [
    task("wait", "waiting", "2026-09-22T09:00:00+09:00"),
    task("urgent", "waiting", "2026-09-22T12:00:00+09:00", ["urgent"]),
    task("re", "waiting", "2026-09-22T10:00:00+09:00", ["re_requested"]),
    task("progress", "in_progress", "2026-09-22T08:00:00+09:00"),
    task("done-old", "completed", "2026-09-22T08:00:00+09:00"),
    task("done-new", "completed", "2026-09-22T11:00:00+09:00"),
    task("bad", "waiting", "invalid"),
  ];
  expect(items.toSorted((a, b) => compareHospitalTasks(a, b, "priority")).map((item) => item.id)).toEqual(["urgent", "re", "progress", "wait", "bad", "done-new", "done-old"]);
  expect(items.toSorted((a, b) => compareHospitalTasks(a, b, "oldest")).at(-1)?.id).toBe("bad");
  expect(items.toSorted((a, b) => compareHospitalTasks(a, b, "newest")).at(-1)?.id).toBe("bad");
});

test("type counts use permitted common records before tab or hidden board status", () => {
  expect(countHospitalWorkTypes([task("a", "waiting", "", [], "lab"), task("b", "completed", "", [], "lab"), task("c", "waiting", "", [], "chart")])).toEqual({ lab: 2, chart: 1 });
});
