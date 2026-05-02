import type {
  AuditLogAction,
  AuditLogEntry,
  EmrId,
  EmrOrderStatus,
  EncounterStatus,
  InvoiceStatus,
  IsoDateTime,
  SoapNoteStatus,
} from "@/types/emr-domain";

export type AuditLogEventType =
  | "status_transition"
  | "profile_edit"
  | "soap_save"
  | "order_status_change"
  | "billing_action";

export type AuditLogEntityType =
  | "appointment"
  | "encounter"
  | "guardian"
  | "patient"
  | "soap_note"
  | "order"
  | "invoice"
  | "payment";

export type AuditLogValue = unknown;

export type AuditLogChange = {
  field: string;
  label?: string;
  before: AuditLogValue;
  after: AuditLogValue;
};

export type AuditLogSnapshot = Record<string, AuditLogValue>;

export type AuditLogMetadata = Record<string, AuditLogValue>;

export type AuditLogEventBase<
  EventType extends AuditLogEventType,
  Action extends AuditLogAction,
  EntityType extends AuditLogEntityType,
  Metadata extends AuditLogMetadata = AuditLogMetadata,
> = Omit<AuditLogEntry, "action" | "entityType" | "beforeValue" | "afterValue"> & {
  eventType: EventType;
  action: Action;
  entityType: EntityType;
  summary: string;
  changes: AuditLogChange[];
  beforeValue?: AuditLogSnapshot;
  afterValue?: AuditLogSnapshot;
  metadata: Metadata;
};

export type AuditStatusTransitionMetadata = {
  field: string;
  fromStatus: string;
  toStatus: string;
};

export type StatusTransitionAuditLogEvent = AuditLogEventBase<
  "status_transition",
  "status_change",
  "appointment" | "encounter",
  AuditStatusTransitionMetadata
>;

export type ProfileEditAuditLogEvent = AuditLogEventBase<
  "profile_edit",
  "update",
  "guardian" | "patient",
  {
    editedFieldCount: number;
  }
>;

export type SoapSaveMode = "autosave" | "manual_save" | "sign" | "amend";

export type SoapSaveAuditLogEvent = AuditLogEventBase<
  "soap_save",
  "create" | "update",
  "soap_note",
  {
    saveMode: SoapSaveMode;
    status?: SoapNoteStatus;
  }
>;

export type OrderStatusChangeAuditLogEvent = AuditLogEventBase<
  "order_status_change",
  "status_change",
  "order",
  {
    fromStatus: EmrOrderStatus;
    toStatus: EmrOrderStatus;
    orderType?: string;
  }
>;

export type BillingActionType =
  | "invoice_issued"
  | "payment_approved"
  | "refund_requested"
  | "refund_approved"
  | "discount_applied"
  | "invoice_voided";

export type BillingActionAuditLogEvent = AuditLogEventBase<
  "billing_action",
  "update" | "status_change" | "refund_request" | "refund_approve" | "cancel",
  "invoice" | "payment",
  {
    billingAction: BillingActionType;
    invoiceStatus?: InvoiceStatus;
    amount?: number;
  }
>;

export type AuditLogEvent =
  | StatusTransitionAuditLogEvent
  | ProfileEditAuditLogEvent
  | SoapSaveAuditLogEvent
  | OrderStatusChangeAuditLogEvent
  | BillingActionAuditLogEvent;

export type AuditLogContext = {
  workspaceId: EmrId;
  actorUserId?: EmrId;
  patientId?: EmrId;
  guardianId?: EmrId;
  encounterId?: EmrId;
  occurredAt: IsoDateTime;
  reason?: string;
};

export type BuildAuditLogEventInput<
  EventType extends AuditLogEventType,
  Action extends AuditLogAction,
  EntityType extends AuditLogEntityType,
  Metadata extends AuditLogMetadata,
> = AuditLogContext & {
  id?: EmrId;
  eventType: EventType;
  action: Action;
  entityType: EntityType;
  entityId: EmrId;
  summary: string;
  changes?: AuditLogChange[];
  metadata?: Metadata;
};

export type BuildStatusTransitionAuditLogInput = AuditLogContext & {
  id?: EmrId;
  entityType: StatusTransitionAuditLogEvent["entityType"];
  entityId: EmrId;
  field?: string;
  beforeStatus: EncounterStatus | string;
  afterStatus: EncounterStatus | string;
  summary: string;
};

export type BuildProfileEditAuditLogInput = AuditLogContext & {
  id?: EmrId;
  entityType: ProfileEditAuditLogEvent["entityType"];
  entityId: EmrId;
  beforeValue: AuditLogSnapshot;
  afterValue: AuditLogSnapshot;
  fieldLabels?: Record<string, string>;
  summary: string;
};

export type BuildSoapSaveAuditLogInput = AuditLogContext & {
  id?: EmrId;
  soapNoteId: EmrId;
  saveMode: SoapSaveMode;
  status?: SoapNoteStatus;
  beforeValue?: AuditLogSnapshot;
  afterValue?: AuditLogSnapshot;
  fieldLabels?: Record<string, string>;
  summary: string;
};

export type BuildOrderStatusChangeAuditLogInput = AuditLogContext & {
  id?: EmrId;
  orderId: EmrId;
  beforeStatus: EmrOrderStatus;
  afterStatus: EmrOrderStatus;
  orderType?: string;
  summary: string;
};

export type BuildBillingActionAuditLogInput = AuditLogContext & {
  id?: EmrId;
  entityType: BillingActionAuditLogEvent["entityType"];
  entityId: EmrId;
  billingAction: BillingActionType;
  action?: BillingActionAuditLogEvent["action"];
  invoiceStatus?: InvoiceStatus;
  amount?: number;
  beforeValue?: AuditLogSnapshot;
  afterValue?: AuditLogSnapshot;
  fieldLabels?: Record<string, string>;
  summary: string;
};
