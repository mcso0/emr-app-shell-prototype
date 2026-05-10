export type UserRole =
  | "owner"
  | "veterinarian"
  | "technician"
  | "desk"
  | "billing";

export type HomeTaskPriority = "urgent" | "high" | "normal" | "low";

export type HomeTaskStatus =
  | "requested"
  | "assigned"
  | "inProgress"
  | "overdue";

export type HomeTaskDomain =
  | "reception"
  | "chart"
  | "lab"
  | "imaging"
  | "dispensing"
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

export type HomeWorkspaceView = "hospital" | "mine";

export type HomeTaskAssignment = "assigned" | "roleQueue";

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
  receptionType?: "예약" | "접수";
  sourceLabel: string;
  requestedBy?: string;
  assigneeName?: string;
  requestedAt: string;
  dueAt?: string;
  status: HomeTaskStatus;
  priority: HomeTaskPriority;
  domain: HomeTaskDomain;
  assignment: HomeTaskAssignment;
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
  updatedAt: string;
}

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
