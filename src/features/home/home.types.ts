export type UserRole =
  | "owner"
  | "veterinarian"
  | "technician"
  | "desk"
  | "billing";

export type HomeTaskPriority = "urgent" | "high" | "normal" | "low";

export type HomeTaskStatus =
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "requested"
  | "assigned"
  | "inProgress"
  | "overdue";

export type HomeTaskDomain =
  | "reception"
  | "appointment"
  | "chart"
  | "lab"
  | "imaging"
  | "dispensing"
  | "treatment"
  | "billing"
  | "inpatient";

export type HomeKanbanColumnId =
  | "waiting"
  | "reservation"
  | "chart"
  | "lab"
  | "imaging"
  | "dispensing"
  | "treatment"
  | "billing";

export type HomeWorkspaceView = "home" | "hospital";

export type HomeTaskAssignment = "assigned" | "roleQueue";
export type HomeOperationsAssignmentState =
  | "assignmentMissing"
  | "assigned"
  | "roleQueue";

export type HomeOperationsProgressState =
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled";

export type HomeOperationsAttentionSignal =
  | "urgent"
  | "re_requested"
  | "assignment_missing"
  | "team_queue"
  | "long_stay";

export type HomeOperationsSourceType =
  | "reception"
  | "appointment"
  | "consultation"
  | "lab"
  | "imaging"
  | "dispensing"
  | "treatment"
  | "billing"
  | "inpatient";

export type HomeWorkFilter =
  | "all"
  | "urgent"
  | "dueToday"
  | "overdue"
  | "roleQueue";

export type HomeDomainFilter = "all" | HomeTaskDomain;

export interface HomeTask {
  id: string;
  title: string;
  kanbanColumn: HomeKanbanColumnId;
  patientId?: string;
  patientName?: string;
  clientName?: string;
  encounterLabel?: string;
  receptionType?: "예약" | "외래" | "접수";
  sourceLabel: string;
  requestedBy?: string;
  requesterUserId?: string;
  requesterAvatarUrl?: string;
  assigneeUserId?: string;
  assigneeUserIds?: string[];
  assigneeAvatarUrls?: Record<string, string>;
  assigneeNames?: string[];
  isRequestedWork?: boolean;
  stateEnteredAt?: string;
  assigneeName?: string;
  queueCardEventText?: string;
  queueCardSecondLineBadgeLabel?: string;
  queueCardSecondLineText?: string;
  requestedAt: string;
  dueAt?: string;
  status: HomeTaskStatus;
  priority: HomeTaskPriority;
  domain: HomeTaskDomain;
  assignment: HomeOperationsAssignmentState;
  attentionSignals?: HomeOperationsAttentionSignal[];
  isMyWork?: boolean;
  operatingDate?: string;
  permissionMode?: "full" | "hidden" | "redacted";
  progressState?: HomeOperationsProgressState;
  sourceId?: string;
  sourceStatus?: string;
  sourceType?: HomeOperationsSourceType;
  teamQueueId?: string;
  roleQueueLabel?: string;
  recommendedAction: string;
  actionHref: string;
  actionLabel: string;
}

export interface HomeKanbanColumn {
  id: HomeKanbanColumnId;
  label: string;
  description: string;
}

export interface HomeNotification {
  id: string;
  title: string;
  message: string;
  sourceLabel: string;
  createdAt: string;
  tone: "urgent" | "warning" | "info" | "success";
}

export interface HomeQuickStatus {
  id: HomeWorkFilter;
  label: string;
  count: number;
}

export interface HomeLauncherAction {
  id: string;
  label: string;
  href: string;
  domain: HomeTaskDomain;
}

export interface HomeFlowSummaryItem {
  id: string;
  label: string;
  count: number;
  detail?: string;
  href: string;
  tone?: "normal" | "warning" | "attention";
  slaLabel?: string;
  overdueCount?: number;
  unassignedCount?: number;
  nextActionLabel?: string;
}

export interface HomeNextAction {
  id: string;
  title: string;
  patientName?: string;
  clientName?: string;
  sourceLabel: string;
  priorityLabel: string;
  dueLabel: string;
  evidence: string[];
  actionHref: string;
  actionLabel: string;
  tone: "danger" | "warning" | "attention" | "normal";
}

export interface HomeRoleNextActionHypothesis {
  role: UserRole;
  roleLabel: string;
  hypothesis: string;
  primarySignal: string;
  successMetric: string;
  actions: HomeNextAction[];
}

export interface HomeDashboardData {
  role: UserRole;
  roleLabel: string;
  userName: string;
  hospitalName: string;
  todayLabel: string;
  columns: HomeKanbanColumn[];
  tasks: HomeTask[];
  hospitalTasks: HomeTask[];
  notifications: HomeNotification[];
  quickStatus: HomeQuickStatus[];
  emptyLaunchers: HomeLauncherAction[];
  flowSummary: HomeFlowSummaryItem[];
  roleNextActions: HomeRoleNextActionHypothesis[];
  updatedAt: string;
}

export type HomeOperationsSummary = {
  byAssignmentState: {
    assignmentMissing: number;
    personal: number;
    teamQueue: number;
  };
  byAttentionSignal: Record<HomeOperationsAttentionSignal, number>;
  byProgressState: Record<HomeOperationsProgressState, number>;
  bySourceType: Record<HomeOperationsSourceType, number>;
  cancelledCount: number;
  completedCount: number;
  mineCount: number;
  totalVisible: number;
};

export type HomeOperationsWorkItem = {
  assigneeName?: string;
  assigneeUserId?: string;
  assigneeUserIds?: string[];
  assigneeAvatarUrls?: Record<string, string>;
  assigneeNames?: string[];
  attentionSignals: HomeOperationsAttentionSignal[];
  drawerSummary?: string;
  encounterId?: string;
  guardianId?: string;
  guardianName?: string;
  id: string;
  isMyWork?: boolean;
  operatingDate: string;
  patientId?: string;
  patientName?: string;
  permissionMode: "full" | "hidden" | "redacted";
  progressState: HomeOperationsProgressState;
  queueCardEventText?: string;
  queueCardSecondLineBadgeLabel?: string;
  queueCardSecondLineText?: string;
  receptionType?: "예약" | "외래" | "접수";
  requestedAt: string;
  scheduledAt?: string;
  requesterUserId?: string;
  requesterAvatarUrl?: string;
  isRequestedWork?: boolean;
  requesterName?: string;
  sourceHref: string;
  sourceId: string;
  sourceStatus: string;
  sourceType: HomeOperationsSourceType;
  stateEnteredAt?: string;
  teamQueueId?: string;
  teamQueueLabel?: string;
  title: string;
  workspaceId: string;
};

export type HomeOperationsAccessIssue = {
  code: string;
  message: string;
  sourceType?: HomeOperationsSourceType;
};

export type HomeOperationsWorkItemsResponse =
  | {
      ok: true;
      accessIssues?: HomeOperationsAccessIssue[];
      generatedAt: string;
      currentPatients?: { present: number; waiting: number; inProgress: number } | null;
      items: HomeOperationsWorkItem[];
      operatingDate: string;
      sourceStatus: "empty" | "live" | "partial";
      summary: HomeOperationsSummary;
      workspaceId: string;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
      operatingDate: string;
      sourceStatus: "error" | "permission_denied";
      workspaceId: string;
    };

// Legacy component compatibility while Home v1 no longer renders the old
// role-widget/alert dashboard by default.
export type HomePriority = HomeTaskPriority | "critical" | "medium";

export type HomeSourceType =
  | "appointment"
  | "chart"
  | "lab"
  | "surgery"
  | "inpatient"
  | "payment"
  | "inventory"
  | "message"
  | "admin";

export interface HomeAlert {
  id: string;
  title: string;
  message?: string;
  severity: "critical" | "warning" | "info";
  sourceType: HomeSourceType;
  patientId?: string;
  visitId?: string;
  createdAt: string;
  actionHref?: string;
  actionLabel?: string;
  isRead?: boolean;
}

export interface HospitalFlowItem {
  status: string;
  label: string;
  count: number;
  delayedCount?: number;
  averageWaitMinutes?: number;
  topIssue?: string;
  actionHref?: string;
}

export type HomeWidgetId = string;

export interface HomeWidgetItem {
  id: string;
  title: string;
  meta?: string;
  value?: string;
  status?: string;
  priority?: HomePriority;
  href?: string;
}

export interface HomeWidget {
  id: HomeWidgetId;
  title: string;
  description?: string;
  value?: string;
  badge?: string;
  items: HomeWidgetItem[];
  primaryAction?: {
    label: string;
    href: string;
  };
  emptyState?: string;
}
