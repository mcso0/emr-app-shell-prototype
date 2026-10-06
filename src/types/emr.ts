import type { ComponentType, ReactNode } from "react";
import type { AppIcon } from "@/components/icons";

export type DrawerState = {
  type: string;
  id: string;
  hasUnsavedChanges?: boolean;
  initialOperatingDate?: string;
  initialPatientId?: string;
  profileTab?: "info" | "history" | "reservations" | "billing";
  returnTo?: {
    type: "patient" | "reception-patient";
    id: string;
    profileTab?: "info" | "history" | "reservations" | "billing";
  };
  subtitle?: string;
  rightPanelPresentation?: {
    gap?: number;
    mobileFullWidth?: boolean;
    persistToUrl?: boolean;
    returnFocusId?: string;
    surface?: "workspace-right-panel";
    width?: number;
  };
} | null;

export type ShellComponentProps = {
  workspaceId: string;
  moduleId: string;
  moduleLabel: string;
  hasContentAside?: boolean;
  hasRightPanel?: boolean;
  onNavigateWorkspaceSurface?: (href: string, moduleId: string) => void;
};

export type WorkspaceSlotAvailability = {
  readonly hasContentAside?: boolean;
  readonly hasRightPanel?: boolean;
};

export type WorkspaceSlotAvailabilityProviderProps = ShellComponentProps & {
  readonly children: (availability: WorkspaceSlotAvailability) => ReactNode;
};

export type WorkspaceSlotAvailabilityProvider =
  ComponentType<WorkspaceSlotAvailabilityProviderProps>;

export type PanelState = "open" | "closed";

export type ModuleDefinition = {
  id: string;
  label: string;
  icon: AppIcon;
  sidePanel?: ComponentType<ShellComponentProps>;
  contentHeader?: ComponentType<ShellComponentProps>;
  contentAside?: ComponentType<ShellComponentProps>;
  content: ComponentType<ShellComponentProps>;
  rightPanel?: ComponentType<ShellComponentProps>;
  slotAvailabilityProvider?: WorkspaceSlotAvailabilityProvider;
  rightPanelGap?: boolean;
  rightPanelWidth?: number;
  documentLayout?: {
    narrowWidth: number;
    historyPanelId: string;
    historyLabel: string;
    rightPanelId?: string;
    rightLabel?: string;
  };
  defaultContentAsideOpen?: boolean;
  defaultRightPanelOpen?: boolean;
  drawer?: ComponentType<ShellComponentProps>;
};

export type OrderStatus = "재요청" | "요청" | "조제중" | "완료" | "취소";

export type OrderWorkStatus = "대기" | "완료";

export type OrderGroupWorkStatus = "요청" | "진행중" | "일시중지" | "완료";

export type OrderQueueType = "dispensing" | "treatment";

export type OrderQueueStatusDefinition = {
  id: string;
  label: string;
  colorToken: string;
  sortOrder: number;
};

export type OrderQueueItem = {
  patientQueue?: {
    assignedToUserId?: string | null;
    patientId?: string | null;
    workspaceId?: string;
    status?: string;
    priority?: string;
    requestedAt?: string;
    originChartId?: string | null;
    originChartCreatedAt?: string | null;
  };
  id: string;
  instructionId: string;
  patientName: string;
  guardianName: string;
  patientAge?: string;
  patientBreed?: string;
  patientSex?: string;
  patientWeight?: string;
  patientTemperature?: string;
  patientRespiration?: string;
  patientBloodPressure?: string;
  receptionType: string;
  orderType: string;
  orderTypeCategory: OrderQueueType;
  orderName: string;
  requesterName: string;
  assigneeName?: string;
  startedAt?: string;
  time: string;
  statusId: string;
  waitMinutes?: number;
};

export type TechnicianUser = {
  id: string;
  name: string;
  initial: string;
  role: "technician";
};

export type OrderDiffField =
  | "dose"
  | "frequency"
  | "days"
  | "doseTiming"
  | "servings"
  | "amount"
  | "unit"
  | "quantity"
  | "dosageForm"
  | "storage"
  | "medicationGuide";

export type OrderDiffValue = {
  previous: string;
  current: string;
};

export type Order = {
  id: string;
  category: string;
  name: string;
  route: string;
  dose: string;
  frequency: string;
  status: OrderStatus;
  requestedAt: string;
  doctor: string;
  days: string;
  doseTiming: string;
  servings: string;
  amount: string;
  unit: string;
  quantity: string;
  dosageForm: string;
  storage: string;
  medicationGuide: string;
  assigneeId?: string;
  assignee: string;
  assigneeInitial: string;
  workStatus: OrderWorkStatus;
  warningMessage?: string;
  diffs?: Partial<Record<OrderDiffField, OrderDiffValue>>;
};
