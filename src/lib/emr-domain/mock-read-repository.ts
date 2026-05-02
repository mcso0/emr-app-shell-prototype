import {
  getMockLatestWorkShortcutsForPatient,
  mockAppointments,
  mockAttachments,
  mockAuditLogs,
  mockConsents,
  mockCsHistories,
  mockDiagnoses,
  mockEncounters,
  mockEquipmentReceipts,
  mockGuardians,
  mockImagingStudies,
  mockInvoiceLines,
  mockInvoices,
  mockLabResults,
  mockMessageDeliveries,
  mockOrderAssignments,
  mockOrderEvents,
  mockOrderGroups,
  mockOrders,
  mockPatientGuardians,
  mockPatients,
  mockPayments,
  mockPrescriptionItems,
  mockPrescriptions,
  mockSoapNotes,
  mockWaitingQueueEntries,
} from "@/mocks/emr-domain";
import type { EmrReadRepository, EmrReadScope, EmrReadSnapshot } from "./read-repository";
import { createSnapshotReadRepository } from "./read-selectors";

export function createMockEmrReadSnapshot(scope: EmrReadScope): EmrReadSnapshot {
  void scope;

  return {
    patients: mockPatients,
    guardians: mockGuardians,
    patientGuardians: mockPatientGuardians,
    consents: mockConsents,
    appointments: mockAppointments,
    encounters: mockEncounters,
    waitingQueueEntries: mockWaitingQueueEntries,
    soapNotes: mockSoapNotes,
    diagnoses: mockDiagnoses,
    prescriptions: mockPrescriptions,
    prescriptionItems: mockPrescriptionItems,
    orderGroups: mockOrderGroups,
    orders: mockOrders,
    orderAssignments: mockOrderAssignments,
    orderEvents: mockOrderEvents,
    invoices: mockInvoices,
    invoiceLines: mockInvoiceLines,
    payments: mockPayments,
    csHistories: mockCsHistories,
    labResults: mockLabResults,
    equipmentReceipts: mockEquipmentReceipts,
    imagingStudies: mockImagingStudies,
    attachments: mockAttachments,
    messageDeliveries: mockMessageDeliveries,
    auditLogs: mockAuditLogs,
    latestWorkShortcuts: mockPatients.flatMap((patient) =>
      getMockLatestWorkShortcutsForPatient(patient.id)
    ),
  };
}

export function createMockEmrReadRepository(): EmrReadRepository {
  return createSnapshotReadRepository(createMockEmrReadSnapshot);
}
