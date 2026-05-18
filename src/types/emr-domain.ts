export type EmrId = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type Species =
  | "dog"
  | "cat"
  | "rabbit"
  | "ferret"
  | "hamster"
  | "guinea_pig"
  | "hedgehog"
  | "bird"
  | "reptile"
  | "turtle"
  | "other";
export type PatientSex = "male" | "female" | "unknown";
export type PatientStatus = "active" | "inactive" | "deceased";
export type ConsentType =
  | "privacy"
  | "treatment"
  | "surgery"
  | "hospitalization"
  | "marketing"
  | "messaging";
export type ConsentStatus = "granted" | "revoked";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "changed"
  | "cancelled"
  | "checked_in"
  | "no_show";
export type EncounterStatus =
  | "waiting"
  | "in_consultation"
  | "ordered"
  | "ready_for_billing"
  | "completed"
  | "cancelled";
export type WaitingQueueStatus = "waiting" | "called" | "in_progress" | "done" | "cancelled";
export type WaitingQueueType = "reception" | "consultation" | "treatment" | "billing";
export type OrderPriority = "urgent" | "high" | "normal" | "low";

export type SoapNoteStatus = "draft" | "autosaved" | "signed" | "amended" | "voided";
export type DiagnosisType = "suspected" | "confirmed" | "differential";
export type PrescriptionStatus = "draft" | "ordered" | "sent" | "cancelled" | "completed";
export type PrescriptionItemStatus = "active" | "cancelled";

export type ServiceItemType =
  | "consultation"
  | "medication"
  | "treatment"
  | "lab"
  | "imaging"
  | "hospitalization"
  | "misc";
export type StaffRoleId =
  | "front_desk"
  | "vet"
  | "nurse"
  | "billing_admin"
  | "hospital_admin";
export type PermissionResource =
  | "reception"
  | "patient"
  | "encounter"
  | "chart"
  | "order"
  | "dispensing"
  | "lab"
  | "imaging"
  | "billing"
  | "service_catalog"
  | "role_permission";
export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "request"
  | "complete"
  | "issue"
  | "manage";
export type PermissionId = `${PermissionResource}:${PermissionAction}`;
export type OrderGroupType = "dispensing" | "treatment" | "lab" | "imaging" | "mixed";
export type OrderGroupStatus = "requested" | "in_progress" | "completed" | "cancelled";
export type EmrOrderType = "dispensing" | "treatment" | "lab" | "imaging";
export type EmrOrderStatus = "requested" | "re_requested" | "in_progress" | "completed" | "cancelled";
export type EmrOrderWorkStatus = "pending" | "completed";
export type OrderAssignmentStatus = "active" | "cancelled" | "completed";
export type OrderEventType =
  | "requested"
  | "sent"
  | "assigned"
  | "started"
  | "completed"
  | "cancelled"
  | "edited"
  | "result_entered";

export type InvoiceStatus = "draft" | "issued" | "paid" | "refund_requested" | "refunded" | "voided";
export type PaymentMethod = "card" | "cash" | "transfer" | "other";
export type PaymentStatus = "approved" | "cancelled" | "refunded" | "failed";

export type CsHistoryStatus = "queued" | "in_progress" | "completed" | "needs_follow_up";
export type CsHistoryChannel = "phone" | "kakao_alimtalk" | "sms" | "in_person";
export type CsHistoryDirection = "inbound" | "outbound";

export type LatestWorkType = "chart" | "lab" | "imaging" | "dispensing" | "billing";

export type LabResultStatus = "pending" | "received" | "entered" | "completed" | "reviewed";
export type LabResultJudgment = "low" | "normal" | "high" | "critical" | "not_judged";
export type EquipmentReceiptStatus = "received" | "matched" | "unmatched" | "ignored";
export type ImagingStudyStatus = "requested" | "captured" | "reading" | "read" | "reviewed";

export type AttachmentOwnerType =
  | "patient"
  | "guardian"
  | "encounter"
  | "lab_result"
  | "imaging_study"
  | "invoice";

export type MessageChannel = "kakao_alimtalk" | "sms" | "email";
export type MessageType =
  | "appointment"
  | "checkin"
  | "turn_notice"
  | "result"
  | "medication_guide"
  | "post_surgery"
  | "care";
export type MessageStatus = "queued" | "sent" | "delivered" | "failed" | "cancelled";

export type AuditLogAction =
  | "create"
  | "update"
  | "view"
  | "status_change"
  | "cancel"
  | "refund_request"
  | "refund_approve";

export type Guardian = {
  id: EmrId;
  workspaceId: EmrId;
  name: string;
  mobilePhone?: string;
  phone?: string;
  email?: string;
  birthDate?: IsoDate;
  address?: string;
  occupation?: string;
  memo?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Patient = {
  id: EmrId;
  patientNo: string;
  workspaceId: EmrId;
  name: string;
  species: Species;
  breed?: string;
  birthDate?: IsoDate;
  estimatedAgeText?: string;
  sex: PatientSex;
  neutered?: boolean;
  microchipNo?: string;
  patientRegistrationNo?: string;
  allergyNote?: string;
  specialNote?: string;
  handlingCautionNote?: string;
  handlingCautionLocked: boolean;
  status: PatientStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PatientGuardian = {
  id: EmrId;
  patientId: EmrId;
  guardianId: EmrId;
  relationship?: string;
  isPrimary: boolean;
  canReceiveMessages: boolean;
  createdAt: IsoDateTime;
};

export type Consent = {
  id: EmrId;
  workspaceId: EmrId;
  guardianId: EmrId;
  patientId?: EmrId;
  consentType: ConsentType;
  status: ConsentStatus;
  signedAt?: IsoDateTime;
  revokedAt?: IsoDateTime;
  documentUrl?: string;
};

export type Appointment = {
  id: EmrId;
  workspaceId: EmrId;
  patientId: EmrId;
  guardianId?: EmrId;
  assignedVeterinarianId?: EmrId;
  scheduledStartAt: IsoDateTime;
  scheduledEndAt?: IsoDateTime;
  visitPurpose?: string;
  symptomNote?: string;
  status: AppointmentStatus;
  createdByUserId?: EmrId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Encounter = {
  id: EmrId;
  workspaceId: EmrId;
  patientId: EmrId;
  guardianId?: EmrId;
  appointmentId?: EmrId;
  primaryVeterinarianId?: EmrId;
  encounterNo: string;
  receptionType?: "walk_in" | "appointment";
  department?: string;
  durationMinutes?: number;
  chiefComplaint?: string;
  visitPurpose?: string;
  receptionMemo?: string;
  status: EncounterStatus;
  checkedInAt?: IsoDateTime;
  checkedInByUserId?: EmrId;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type WaitingQueueEntry = {
  id: EmrId;
  workspaceId: EmrId;
  encounterId: EmrId;
  queueType: WaitingQueueType;
  status: WaitingQueueStatus;
  priority: OrderPriority;
  sortOrder?: number;
  enteredAt: IsoDateTime;
  calledAt?: IsoDateTime;
  finishedAt?: IsoDateTime;
};

export type SoapNote = {
  id: EmrId;
  encounterId: EmrId;
  authorUserId: EmrId;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  status: SoapNoteStatus;
  signedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Diagnosis = {
  id: EmrId;
  encounterId: EmrId;
  diagnosisCatalogId?: EmrId;
  diagnosisText: string;
  diagnosisType: DiagnosisType;
  createdByUserId: EmrId;
  createdAt: IsoDateTime;
};

export type Prescription = {
  id: EmrId;
  encounterId: EmrId;
  prescriptionNo: string;
  prescriberUserId: EmrId;
  status: PrescriptionStatus;
  issuedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type PrescriptionItem = {
  id: EmrId;
  prescriptionId: EmrId;
  medicationId?: EmrId;
  medicationNameSnapshot: string;
  dose?: string;
  routeId?: EmrId;
  frequency?: string;
  durationDays?: number;
  quantity?: number;
  unitId?: EmrId;
  dosageFormId?: EmrId;
  instruction?: string;
  status: PrescriptionItemStatus;
};

export type ServiceCategory = {
  id: EmrId;
  workspaceId: EmrId;
  parentId?: EmrId;
  name: string;
  sortOrder: number;
};

export type ServiceItem = {
  id: EmrId;
  workspaceId: EmrId;
  categoryId?: EmrId;
  name: string;
  itemType: ServiceItemType;
  description?: string;
  defaultDurationMinutes?: number;
  isOrderable: boolean;
  isBillable: boolean;
  isActive: boolean;
};

export type ServiceItemPrice = {
  id: EmrId;
  serviceItemId: EmrId;
  price: number;
  currency: "KRW";
  effectiveFrom: IsoDate;
  effectiveTo?: IsoDate;
};

export type PermissionSeed = {
  id: PermissionId;
  resource: PermissionResource;
  action: PermissionAction;
  label: string;
  description?: string;
};

export type RoleSeed = {
  id: StaffRoleId;
  workspaceId: EmrId;
  name: string;
  description: string;
  permissionIds: PermissionId[];
  isSystem: boolean;
};

export type OrderGroup = {
  id: EmrId;
  encounterId: EmrId;
  prescriptionId?: EmrId;
  groupType: OrderGroupType;
  title: string;
  label?: string;
  status: OrderGroupStatus;
  priority: OrderPriority;
  sortOrder: number;
  createdByUserId: EmrId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type EmrOrder = {
  id: EmrId;
  orderGroupId?: EmrId;
  workspaceId: EmrId;
  encounterId: EmrId;
  serviceItemId?: EmrId;
  orderType: EmrOrderType;
  displayName: string;
  status: EmrOrderStatus;
  workStatus: EmrOrderWorkStatus;
  priority: OrderPriority;
  requestedByUserId: EmrId;
  requestedAt: IsoDateTime;
  dueAt?: IsoDateTime;
  currentAssigneeUserId?: EmrId;
  instruction?: string;
  warningMessage?: string;
  sortOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type OrderAssignment = {
  id: EmrId;
  orderId: EmrId;
  assigneeUserId: EmrId;
  assignedByUserId?: EmrId;
  status: OrderAssignmentStatus;
  assignedAt: IsoDateTime;
  completedAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
};

export type OrderEvent = {
  id: EmrId;
  orderId: EmrId;
  eventType: OrderEventType;
  performedByUserId?: EmrId;
  payload: Record<string, unknown>;
  createdAt: IsoDateTime;
};

export type Invoice = {
  id: EmrId;
  workspaceId: EmrId;
  encounterId: EmrId;
  guardianId?: EmrId;
  invoiceNo: string;
  status: InvoiceStatus;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  issuedAt?: IsoDateTime;
  createdAt: IsoDateTime;
};

export type InvoiceLine = {
  id: EmrId;
  invoiceId: EmrId;
  serviceItemId?: EmrId;
  orderId?: EmrId;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Payment = {
  id: EmrId;
  invoiceId: EmrId;
  paymentMethod: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  paidAt: IsoDateTime;
  metadata?: Record<string, unknown>;
};

export type CsHistoryEntry = {
  id: EmrId;
  workspaceId: EmrId;
  guardianId?: EmrId;
  patientId?: EmrId;
  encounterId?: EmrId;
  channel: CsHistoryChannel;
  direction: CsHistoryDirection;
  status: CsHistoryStatus;
  category: string;
  summary: string;
  handledByUserId?: EmrId;
  occurredAt: IsoDateTime;
  followUpAt?: IsoDateTime;
  createdAt: IsoDateTime;
};

export type LatestWorkShortcut = {
  id: EmrId;
  workspaceId: EmrId;
  patientId: EmrId;
  guardianId?: EmrId;
  encounterId?: EmrId;
  workType: LatestWorkType;
  title: string;
  description?: string;
  statusLabel?: string;
  occurredAt?: IsoDateTime;
  href?: string;
  enabled: boolean;
};

export type LabResultRow = {
  id: EmrId;
  analyteName: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  judgment: LabResultJudgment;
  note?: string;
};

export type LabResult = {
  id: EmrId;
  workspaceId: EmrId;
  patientId: EmrId;
  encounterId: EmrId;
  orderId?: EmrId;
  resultName: string;
  status: LabResultStatus;
  rows: LabResultRow[];
  collectedAt?: IsoDateTime;
  receivedAt?: IsoDateTime;
  enteredAt?: IsoDateTime;
  reviewedAt?: IsoDateTime;
  performedByUserId?: EmrId;
  reviewedByUserId?: EmrId;
};

export type EquipmentReceipt = {
  id: EmrId;
  workspaceId: EmrId;
  equipmentName: string;
  externalResultId: string;
  status: EquipmentReceiptStatus;
  patientId?: EmrId;
  encounterId?: EmrId;
  orderId?: EmrId;
  receivedAt: IsoDateTime;
  payloadSummary: string;
};

export type ImagingStudy = {
  id: EmrId;
  workspaceId: EmrId;
  patientId: EmrId;
  encounterId: EmrId;
  orderId?: EmrId;
  modality: string;
  bodyPart: string;
  status: ImagingStudyStatus;
  reading?: string;
  impression?: string;
  requestedAt: IsoDateTime;
  capturedAt?: IsoDateTime;
  readAt?: IsoDateTime;
  reviewedAt?: IsoDateTime;
  radiologistUserId?: EmrId;
};

export type EmrAttachment = {
  id: EmrId;
  workspaceId: EmrId;
  ownerType: AttachmentOwnerType;
  ownerId: EmrId;
  patientId?: EmrId;
  encounterId?: EmrId;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  url: string;
  uploadedByUserId?: EmrId;
  uploadedAt: IsoDateTime;
};

export type MessageTemplate = {
  id: EmrId;
  workspaceId: EmrId;
  channel: MessageChannel;
  messageType: MessageType;
  name: string;
  body: string;
  providerTemplateCode?: string;
  isActive: boolean;
};

export type MessageDelivery = {
  id: EmrId;
  workspaceId: EmrId;
  templateId?: EmrId;
  guardianId?: EmrId;
  patientId?: EmrId;
  encounterId?: EmrId;
  carePlanId?: EmrId;
  channel: MessageChannel;
  recipient: string;
  bodySnapshot: string;
  status: MessageStatus;
  providerMessageId?: string;
  failureReason?: string;
  retryCount: number;
  sentAt?: IsoDateTime;
  createdAt: IsoDateTime;
};

export type AuditLogEntry = {
  id: EmrId;
  workspaceId: EmrId;
  actorUserId?: EmrId;
  action: AuditLogAction;
  entityType: string;
  entityId: EmrId;
  patientId?: EmrId;
  encounterId?: EmrId;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  reason?: string;
  createdAt: IsoDateTime;
};
