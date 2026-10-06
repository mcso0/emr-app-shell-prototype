import type { EmrTaskQueueCardItem } from "@/components/emr/task-queue-card";

export type PatientQueueSort = "priority" | "latest";
export type PatientQueueOrderSort = "request" | "assignee" | "wait";
export type PatientQueueMetadata = {
  patientId?: string | null;
  assignedToUserId?: string | null;
  workspaceId?: string;
  status?: string;
  priority?: string;
  requestedAt?: string;
  originChartId?: string | null;
  originChartCreatedAt?: string | null;
};
export type PatientQueueRow = PatientQueueMetadata & {
  id: string;
  card: EmrTaskQueueCardItem;
  waitMinutes?: number;
};
export const patientQueueStatusLabels: Record<string, string> = {
  requested: "대기", in_progress: "진행중", paused: "진행중",
  returned: "재요청", completed: "완료", cancelled: "취소",
};
export function patientQueueStatus(status?: string) {
  const aliases: Record<string, string> = {
    waiting: "requested", pending: "requested", received: "in_progress",
    entered: "in_progress", reading: "in_progress", captured: "in_progress",
    inProgress: "in_progress", reRequested: "returned", re_requested: "returned",
    canceled: "cancelled", reviewed: "completed", paused: "in_progress",
  };
  return aliases[status ?? ""] ?? status ?? "requested";
}
export function patientQueueKey(row: PatientQueueRow) {
  return `${row.workspaceId ?? ""}:${row.patientId?.trim() ? `patient:${row.patientId}` : `task:${row.id}`}`;
}
export function queueTimestamp(value?: string | null) {
  const result = value ? Date.parse(value) : 0;
  return Number.isFinite(result) ? result : 0;
}
function statusRank(row: PatientQueueRow) {
  const rank = ["returned", "in_progress", "requested", "completed", "cancelled"].indexOf(patientQueueStatus(row.status));
  return rank < 0 ? 2 : rank;
}
export function comparePatientQueueRows(a: PatientQueueRow, b: PatientQueueRow, sort: PatientQueueOrderSort) {
  const urgent = Number(b.priority === "urgent") - Number(a.priority === "urgent");
  const status = statusRank(a) - statusRank(b);
  const ordering = sort === "assignee"
    ? (a.card.assigneeName ?? "zzzz").localeCompare(b.card.assigneeName ?? "zzzz", "ko")
    : sort === "wait" ? (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0)
    : queueTimestamp(a.requestedAt) - queueTimestamp(b.requestedAt);
  return urgent || status || ordering || a.id.localeCompare(b.id);
}
export function groupPatientQueue(rows: PatientQueueRow[], sort: PatientQueueSort, orderSort: PatientQueueOrderSort) {
  const groups = new Map<string, PatientQueueRow[]>();
  for (const row of rows) {
    const key = patientQueueKey(row);
    const items = groups.get(key) ?? [];
    items.push(row); groups.set(key, items);
  }
  return [...groups].map(([key, items]) => ({
    key, items: [...items].sort((a,b) => comparePatientQueueRows(a,b,orderSort)),
    urgentCount: items.filter(item => item.priority === "urgent").length,
    returnedCount: items.filter(item => patientQueueStatus(item.status) === "returned").length,
    latest: Math.max(...items.map(item => queueTimestamp(item.requestedAt))),
    rank: Math.min(...items.map(item => item.priority === "urgent" ? 0 : patientQueueStatus(item.status) === "returned" ? 1 : ["requested", "in_progress", "paused"].includes(patientQueueStatus(item.status)) ? 2 : 3)),
  })).sort((a,b) => (sort === "priority" ? a.rank-b.rank : 0) || b.latest-a.latest || a.key.localeCompare(b.key));
}
export function matchesPatientQueueFilter(row: PatientQueueRow, filter: string) {
  return filter === "all" || (filter === "unassigned" ? !row.assignedToUserId : patientQueueStatus(row.status) === filter);
}

export function patientQueueChartLabels(rows: PatientQueueRow[]) {
  const charts = new Map<string, Map<string, string | null | undefined>>();
  for (const row of rows) {
    const group = charts.get(patientQueueKey(row)) ?? new Map();
    if (row.originChartId) group.set(row.originChartId, row.originChartCreatedAt);
    charts.set(patientQueueKey(row), group);
  }
  const format = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const labels = new Map<string, string | undefined>();
  for (const row of rows) {
    const group = charts.get(patientQueueKey(row))!;
    if (!row.originChartId || !queueTimestamp(row.originChartCreatedAt)) {
      labels.set(row.id, "출처 차트 미확인");
      continue;
    }
    if (group.size < 2) continue;
    const date = format.format(new Date(row.originChartCreatedAt!));
    const sameMinute = [...group].filter(([, timestamp]) => queueTimestamp(timestamp) && format.format(new Date(timestamp!)) === date).map(([id]) => id).sort();
    const suffix = sameMinute.length > 1 ? ` · 기록 ${sameMinute.indexOf(row.originChartId) + 1}` : "";
    labels.set(row.id, `차트 ${date}${suffix}`);
  }
  return labels;
}
