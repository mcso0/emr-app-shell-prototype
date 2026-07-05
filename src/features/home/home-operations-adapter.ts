import {
  formatCompactKoreanOperatingDateLabel,
} from "@/lib/emr-domain/demo-date";
import {
  PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME,
} from "@/lib/emr-domain/demo-workspaces";
import type {
  HomeDashboardData,
  HomeKanbanColumn,
  HomeKanbanColumnId,
  HomeOperationsSourceType,
  HomeOperationsWorkItem,
  HomeTask,
  UserRole,
} from "@/features/home/home.types";

const operationsColumns: HomeKanbanColumn[] = [
  {
    id: "waiting",
    label: "접수",
    description: "접수 후 진료 전 확인이 필요한 업무",
  },
  {
    id: "reservation",
    label: "예약",
    description: "오늘 운영일의 예약 업무",
  },
  {
    id: "chart",
    label: "진료",
    description: "진료 대기와 진행 중 업무",
  },
  {
    id: "lab",
    label: "임상병리검사",
    description: "검사 오더와 결과 입력 업무",
  },
  {
    id: "imaging",
    label: "영상검사",
    description: "영상 오더와 촬영/판독 준비 업무",
  },
  {
    id: "dispensing",
    label: "조제",
    description: "조제 업무",
  },
  {
    id: "treatment",
    label: "처치",
    description: "처치 실행 업무",
  },
  {
    id: "billing",
    label: "수납",
    description: "청구 후보와 수납 진행 업무",
  },
];

export function mapOperationsResponseToHomeDashboardData({
  items,
  operatingDate,
  role,
  roleLabel,
  userName,
}: {
  items: HomeOperationsWorkItem[];
  operatingDate: string;
  role: UserRole;
  roleLabel: string;
  userName: string;
}): HomeDashboardData {
  const tasks = items.map(mapOperationsItemToHomeTask);

  return {
    role,
    roleLabel,
    userName,
    hospitalName: PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME,
    todayLabel: formatCompactKoreanOperatingDateLabel(operatingDate),
    columns: operationsColumns,
    tasks: tasks.filter((task) =>
      items.some((item) => item.id === task.id && item.isMyWork),
    ),
    hospitalTasks: tasks,
    notifications: [],
    quickStatus: [],
    emptyLaunchers: [],
    flowSummary: [],
    roleNextActions: [],
    updatedAt: new Date().toISOString(),
  };
}

function mapOperationsItemToHomeTask(item: HomeOperationsWorkItem): HomeTask {
  const sourceLabel = getSourceLabel(item.sourceType);
  const assignment = item.attentionSignals.includes("assignment_missing")
    ? "assignmentMissing"
    : item.assigneeUserId
      ? "assigned"
      : "roleQueue";

  return {
    id: item.id,
    title: item.title,
    kanbanColumn: getKanbanColumnId(item.sourceType),
    patientId: item.patientId,
    patientName: item.patientName,
    clientName: item.guardianName,
    encounterLabel: item.encounterId,
    receptionType: getReceptionTypeLabel(item),
    sourceLabel,
    requestedBy: item.requesterName,
    assigneeName: item.assigneeName,
    queueCardEventText: item.queueCardEventText,
    queueCardSecondLineBadgeLabel: item.queueCardSecondLineBadgeLabel,
    queueCardSecondLineText: item.queueCardSecondLineText,
    requestedAt: item.requestedAt,
    dueAt: item.stateEnteredAt ?? item.requestedAt,
    status: item.progressState,
    priority: item.attentionSignals.includes("urgent")
      ? "urgent"
      : item.attentionSignals.some((signal) =>
          signal === "re_requested" ||
          signal === "assignment_missing" ||
          signal === "long_stay"
        )
        ? "high"
        : "normal",
    domain: getHomeTaskDomain(item.sourceType),
    assignment,
    attentionSignals: item.attentionSignals,
    isMyWork: item.isMyWork,
    operatingDate: item.operatingDate,
    permissionMode: item.permissionMode,
    progressState: item.progressState,
    sourceId: item.sourceId,
    sourceStatus: item.sourceStatus,
    sourceType: item.sourceType,
    teamQueueId: item.teamQueueId,
    roleQueueLabel: item.teamQueueLabel,
    recommendedAction: item.drawerSummary ?? `${sourceLabel} 원본 화면에서 상태를 확인합니다.`,
    actionHref: item.sourceHref,
    actionLabel: `${sourceLabel} 보러가기`,
  };
}

function getReceptionTypeLabel(item: HomeOperationsWorkItem): HomeTask["receptionType"] {
  if (item.receptionType) return item.receptionType;
  if (item.sourceType === "appointment") return "예약";
  if (item.sourceType === "reception") return "외래";
  if (item.sourceType === "inpatient") return undefined;

  return "외래";
}

function getKanbanColumnId(sourceType: HomeOperationsSourceType): HomeKanbanColumnId {
  if (sourceType === "appointment") return "reservation";
  if (sourceType === "reception") return "waiting";
  if (sourceType === "consultation") return "chart";
  if (sourceType === "lab") return "lab";
  if (sourceType === "imaging") return "imaging";
  if (sourceType === "dispensing") return "dispensing";
  if (sourceType === "treatment") return "treatment";
  return "billing";
}

function getHomeTaskDomain(sourceType: HomeOperationsSourceType): HomeTask["domain"] {
  if (sourceType === "consultation") return "chart";
  return sourceType === "inpatient" ? "inpatient" : sourceType;
}

function getSourceLabel(sourceType: HomeOperationsSourceType) {
  if (sourceType === "appointment") return "예약";
  if (sourceType === "reception") return "접수";
  if (sourceType === "consultation") return "진료";
  if (sourceType === "lab") return "임상병리";
  if (sourceType === "imaging") return "영상";
  if (sourceType === "dispensing") return "조제";
  if (sourceType === "treatment") return "처치";
  if (sourceType === "billing") return "수납";
  return "입원";
}
