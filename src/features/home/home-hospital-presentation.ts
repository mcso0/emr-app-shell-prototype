import type { HomeTask } from "@/features/home/home.types";

export const hospitalStatuses = [
  { id: "waiting", label: "대기" },
  { id: "in_progress", label: "진행 중" },
  { id: "re_requested", label: "재요청" },
  { id: "completed", label: "완료" },
  { id: "cancelled", label: "취소" },
] as const;
export type HospitalStatus = (typeof hospitalStatuses)[number]["id"];
export type HospitalSort = "priority" | "oldest" | "newest";

export function getHospitalStatus(task: HomeTask): HospitalStatus {
  const state = task.progressState ?? task.status;
  if (state === "completed" || state === "cancelled") return state;
  if (task.attentionSignals?.includes("re_requested")) return "re_requested";
  return state === "in_progress" || state === "inProgress" ? "in_progress" : "waiting";
}

function requestMillis(task: HomeTask): number | null {
  const value = Date.parse(task.requestedAt);
  return Number.isFinite(value) ? value : null;
}

export function compareHospitalTasks(a: HomeTask, b: HomeTask, sort: HospitalSort): number {
  const aStatus = getHospitalStatus(a);
  const bStatus = getHospitalStatus(b);
  if (sort === "priority") {
    const rank = (task: HomeTask, status: HospitalStatus) => {
      if (status === "completed") return 4;
      if (status === "cancelled") return 5;
      if (task.attentionSignals?.includes("urgent")) return 0;
      return status === "re_requested" ? 1 : status === "in_progress" ? 2 : 3;
    };
    const difference = rank(a, aStatus) - rank(b, bStatus);
    if (difference) return difference;
  }
  const aTime = requestMillis(a);
  const bTime = requestMillis(b);
  if (aTime === null || bTime === null) {
    if (aTime === null && bTime !== null) return 1;
    if (bTime === null && aTime !== null) return -1;
  } else {
    const newest = sort === "newest" || (sort === "priority" && (aStatus === "completed" || aStatus === "cancelled"));
    const difference = newest ? bTime - aTime : aTime - bTime;
    if (difference) return difference;
  }
  return a.id.localeCompare(b.id);
}

export function countHospitalWorkTypes<T extends Pick<HomeTask, "kanbanColumn">>(tasks: T[]) {
  return tasks.reduce<Record<string, number>>((counts, task) => {
    counts[task.kanbanColumn] = (counts[task.kanbanColumn] ?? 0) + 1;
    return counts;
  }, {});
}
