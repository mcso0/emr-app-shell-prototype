import { expect, test } from "@playwright/test";
import { groupPatientQueue, matchesPatientQueueFilter, patientQueueChartLabels, type PatientQueueRow } from "../src/features/work-queue/patient-queue";
function row(id: string, patch: Partial<PatientQueueRow> = {}): PatientQueueRow {
  return { id, workspaceId: "synthetic", patientId: "patient-a", status: "requested", priority: "normal", requestedAt: "2026-10-03T01:00:00Z", card: { patientName: "합성 동명이인", guardianName: "합성 보호자", receptionType: "외래", eventTime: "10:00", eventActorName: "합성 요청자", secondLineText: id, actionAriaLabel: id }, ...patch };
}
test("patient identity separates same names, workspaces and missing identities without changing source rows", () => {
  const rows = [row("a"), row("b", { patientId: "patient-b" }), row("c", { workspaceId: "foreign" }), row("d", { patientId: null }), row("e", { patientId: null }), row("f")];
  const before = JSON.stringify(rows);
  const groups = groupPatientQueue(rows, "priority", "request");
  expect(groups).toHaveLength(5);
  expect(groups.find(g => g.key === "synthetic:patient:patient-a")?.items.map(i => i.id)).toEqual(["a", "f"]);
  expect(JSON.stringify(rows)).toBe(before);
});
test("urgency is independent of status and equal ranks respect request, wait and assignee sort", () => {
  const a = row("a", { status: "paused", waitMinutes: 2 });
  const b = row("b", { status: "in_progress", requestedAt: "2026-10-03T02:00:00Z", waitMinutes: 9, card: { ...a.card, assigneeName: "가 담당" } });
  const rows = [row("cancel", { status: "cancelled" }), row("urgent", { status: "completed", priority: "urgent" }), row("return", { status: "returned" }), b, a];
  expect(groupPatientQueue(rows, "priority", "request")[0].items.map(i => i.id)).toEqual(["urgent", "return", "a", "b", "cancel"]);
  expect(groupPatientQueue([a,b], "priority", "wait")[0].items.map(i => i.id)).toEqual(["b", "a"]);
  expect(groupPatientQueue([a,b], "priority", "assignee")[0].items.map(i => i.id)).toEqual(["b", "a"]);
  expect(matchesPatientQueueFilter(a, "in_progress")).toBe(true);
  expect(matchesPatientQueueFilter(row("assigned", { assignedToUserId: "unresolved-user" }), "unassigned")).toBe(false);
});
test("group priority and latest use raw creation timestamp, with stable ties", () => {
  const rows = [row("old-urgent", { priority: "urgent" }), row("new-normal", { patientId: "patient-b", requestedAt: "2026-10-03T12:00:00Z" })];
  expect(groupPatientQueue(rows, "priority", "request")[0].items[0].id).toBe("old-urgent");
  expect(groupPatientQueue(rows, "latest", "request")[0].items[0].id).toBe("new-normal");
});
test("source chart labels include date, stable simultaneous-record distinction, and explicit unknown origin", () => {
  const rows = [row("a", { originChartId: "chart-b", originChartCreatedAt: "2026-10-02T01:00:01Z" }), row("b", { originChartId: "chart-a", originChartCreatedAt: "2026-10-02T01:00:09Z" }), row("c", { originChartId: "chart-c", originChartCreatedAt: "2026-10-03T01:00:00Z" }), row("legacy")];
  const labels = patientQueueChartLabels(rows);
  expect(labels.get("a")).toContain("기록 2");
  expect(labels.get("b")).toContain("기록 1");
  expect(labels.get("a")).not.toBe(labels.get("c"));
  expect(labels.get("legacy")).toBe("출처 차트 미확인");
  expect(patientQueueChartLabels([...rows].reverse())).toEqual(labels);
  expect([...labels.values()].join(" ")).not.toContain("chart-");
});
