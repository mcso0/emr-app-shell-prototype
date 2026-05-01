import type { ComponentType } from "react";
import type { AppIcon } from "@/components/icons";

export type DrawerState = {
  type: string;
  id: string;
} | null;

export type ShellComponentProps = {
  workspaceId: string;
  moduleId: string;
  moduleLabel: string;
  hasContentAside?: boolean;
  hasRightPanel?: boolean;
};

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
  defaultRightPanelOpen?: boolean;
  drawer?: ComponentType<ShellComponentProps>;
};

export type OrderStatus = "재요청" | "요청" | "조제중" | "완료" | "취소";

export type OrderWorkStatus = "대기" | "완료";

export type OrderGroupWorkStatus = "요청" | "진행중" | "완료";

export type OrderQueueType = "dispensing" | "treatment";

export type OrderQueueStatusDefinition = {
  id: string;
  label: string;
  colorToken: string;
  sortOrder: number;
};

export type OrderQueueItem = {
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
};

export type TechnicianUser = {
  id: string;
  name: string;
  initial: string;
  role: "technician";
};

export type OrderDiffField =
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
