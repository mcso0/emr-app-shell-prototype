import type {
  Appointment,
  AuditLogEntry,
  Consent,
  CsHistoryEntry,
  Diagnosis,
  EmrAttachment,
  EmrId,
  EmrOrder,
  Encounter,
  EquipmentReceipt,
  Guardian,
  ImagingStudy,
  Invoice,
  InvoiceLine,
  LabResult,
  LatestWorkShortcut,
  MessageDelivery,
  OrderAssignment,
  OrderEvent,
  OrderGroup,
  Patient,
  PatientGuardian,
  Payment,
  Prescription,
  PrescriptionItem,
  SoapNote,
  WaitingQueueEntry,
} from "@/types/emr-domain";

export type EmrReadScope = {
  workspaceId: EmrId;
};

export type EmrReadSnapshot = {
  patients: ReadonlyArray<Patient>;
  guardians: ReadonlyArray<Guardian>;
  patientGuardians: ReadonlyArray<PatientGuardian>;
  consents: ReadonlyArray<Consent>;
  appointments: ReadonlyArray<Appointment>;
  encounters: ReadonlyArray<Encounter>;
  waitingQueueEntries: ReadonlyArray<WaitingQueueEntry>;
  soapNotes: ReadonlyArray<SoapNote>;
  diagnoses: ReadonlyArray<Diagnosis>;
  prescriptions: ReadonlyArray<Prescription>;
  prescriptionItems: ReadonlyArray<PrescriptionItem>;
  orderGroups: ReadonlyArray<OrderGroup>;
  orders: ReadonlyArray<EmrOrder>;
  orderAssignments: ReadonlyArray<OrderAssignment>;
  orderEvents: ReadonlyArray<OrderEvent>;
  invoices: ReadonlyArray<Invoice>;
  invoiceLines: ReadonlyArray<InvoiceLine>;
  payments: ReadonlyArray<Payment>;
  csHistories: ReadonlyArray<CsHistoryEntry>;
  labResults: ReadonlyArray<LabResult>;
  equipmentReceipts: ReadonlyArray<EquipmentReceipt>;
  imagingStudies: ReadonlyArray<ImagingStudy>;
  attachments: ReadonlyArray<EmrAttachment>;
  messageDeliveries: ReadonlyArray<MessageDelivery>;
  auditLogs: ReadonlyArray<AuditLogEntry>;
  latestWorkShortcuts?: ReadonlyArray<LatestWorkShortcut>;
};

export type PatientReadModel = {
  patient: Patient;
  patientGuardians: ReadonlyArray<PatientGuardian>;
  guardians: ReadonlyArray<Guardian>;
  primaryGuardian?: Guardian;
  consents: ReadonlyArray<Consent>;
  appointments: ReadonlyArray<Appointment>;
  encounters: ReadonlyArray<Encounter>;
  waitingQueueEntries: ReadonlyArray<WaitingQueueEntry>;
  soapNotes: ReadonlyArray<SoapNote>;
  diagnoses: ReadonlyArray<Diagnosis>;
  prescriptions: ReadonlyArray<Prescription>;
  prescriptionItems: ReadonlyArray<PrescriptionItem>;
  orderGroups: ReadonlyArray<OrderGroup>;
  orders: ReadonlyArray<EmrOrder>;
  orderAssignments: ReadonlyArray<OrderAssignment>;
  orderEvents: ReadonlyArray<OrderEvent>;
  invoices: ReadonlyArray<Invoice>;
  invoiceLines: ReadonlyArray<InvoiceLine>;
  payments: ReadonlyArray<Payment>;
  csHistories: ReadonlyArray<CsHistoryEntry>;
  latestWorkShortcuts: ReadonlyArray<LatestWorkShortcut>;
  labResults: ReadonlyArray<LabResult>;
  equipmentReceipts: ReadonlyArray<EquipmentReceipt>;
  imagingStudies: ReadonlyArray<ImagingStudy>;
  attachments: ReadonlyArray<EmrAttachment>;
  messageDeliveries: ReadonlyArray<MessageDelivery>;
  auditLogs: ReadonlyArray<AuditLogEntry>;
};

export type EncounterReadModel = Omit<PatientReadModel, "patientGuardians" | "encounters"> & {
  encounter: Encounter;
  appointment?: Appointment;
  encounters: readonly [Encounter];
};

export type GuardianReadModel = {
  guardian: Guardian;
  patientGuardians: ReadonlyArray<PatientGuardian>;
  patients: ReadonlyArray<Patient>;
  consents: ReadonlyArray<Consent>;
  appointments: ReadonlyArray<Appointment>;
  encounters: ReadonlyArray<Encounter>;
  invoices: ReadonlyArray<Invoice>;
  invoiceLines: ReadonlyArray<InvoiceLine>;
  payments: ReadonlyArray<Payment>;
  csHistories: ReadonlyArray<CsHistoryEntry>;
  messageDeliveries: ReadonlyArray<MessageDelivery>;
  latestWorkShortcuts: ReadonlyArray<LatestWorkShortcut>;
  auditLogs: ReadonlyArray<AuditLogEntry>;
};

export type BillingGuardianGroupReadModel = {
  guardian: Guardian;
  patients: ReadonlyArray<Patient>;
  invoices: ReadonlyArray<Invoice>;
  invoiceLines: ReadonlyArray<InvoiceLine>;
  payments: ReadonlyArray<Payment>;
  totalDueAmount: number;
};

export type EmrReadRepository = {
  getSnapshot(scope: EmrReadScope): Promise<EmrReadSnapshot>;
  getPatient(scope: EmrReadScope, patientId: EmrId): Promise<PatientReadModel | null>;
  getEncounter(scope: EmrReadScope, encounterId: EmrId): Promise<EncounterReadModel | null>;
  getGuardian(scope: EmrReadScope, guardianId: EmrId): Promise<GuardianReadModel | null>;
  listBillingGroupsByGuardian(
    scope: EmrReadScope
  ): Promise<ReadonlyArray<BillingGuardianGroupReadModel>>;
};
