import type { EmrId, IsoDateTime } from "@/types/emr-domain";
import type {
  BillingGuardianGroupReadModel,
  EmrReadRepository,
  EmrReadScope,
  EmrReadSnapshot,
  EncounterReadModel,
  GuardianReadModel,
  PatientReadModel,
} from "./read-repository";

type WithId = {
  id: EmrId;
};

type WithWorkspace = {
  workspaceId: EmrId;
};

export function findById<Item extends WithId>(
  items: ReadonlyArray<Item>,
  id: EmrId
): Item | undefined {
  return items.find((item) => item.id === id);
}

export function toIdSet<Item extends WithId>(items: ReadonlyArray<Item>): ReadonlySet<EmrId> {
  return new Set(items.map((item) => item.id));
}

export function inWorkspace<Item extends WithWorkspace>(
  items: ReadonlyArray<Item>,
  scope: EmrReadScope
): Item[] {
  return items.filter((item) => item.workspaceId === scope.workspaceId);
}

export function sortByIsoDateTimeDesc<Item>(
  items: ReadonlyArray<Item>,
  getValue: (item: Item) => IsoDateTime | undefined
): Item[] {
  return [...items].sort((a, b) => (getValue(b) ?? "").localeCompare(getValue(a) ?? ""));
}

export function selectPatientReadModel(
  snapshot: EmrReadSnapshot,
  scope: EmrReadScope,
  patientId: EmrId
): PatientReadModel | null {
  const patient = inWorkspace(snapshot.patients, scope).find((item) => item.id === patientId);

  if (!patient) return null;

  const patientGuardians = snapshot.patientGuardians.filter((item) => item.patientId === patientId);
  const guardianIds = new Set(patientGuardians.map((item) => item.guardianId));
  const guardians = inWorkspace(snapshot.guardians, scope).filter((item) => guardianIds.has(item.id));
  const primaryGuardian = guardians.find((guardian) =>
    patientGuardians.some((link) => link.guardianId === guardian.id && link.isPrimary)
  );
  const appointments = inWorkspace(snapshot.appointments, scope).filter(
    (item) => item.patientId === patientId
  );
  const encounters = inWorkspace(snapshot.encounters, scope).filter(
    (item) => item.patientId === patientId
  );
  const encounterIds = toIdSet(encounters);
  const prescriptions = snapshot.prescriptions.filter((item) =>
    encounterIds.has(item.encounterId)
  );
  const prescriptionIds = toIdSet(prescriptions);
  const orders = inWorkspace(snapshot.orders, scope).filter((item) =>
    encounterIds.has(item.encounterId)
  );
  const orderIds = toIdSet(orders);
  const invoices = inWorkspace(snapshot.invoices, scope).filter((item) =>
    encounterIds.has(item.encounterId)
  );
  const invoiceIds = toIdSet(invoices);
  const labResults = inWorkspace(snapshot.labResults, scope).filter(
    (item) => item.patientId === patientId
  );
  const labResultIds = toIdSet(labResults);
  const imagingStudies = inWorkspace(snapshot.imagingStudies, scope).filter(
    (item) => item.patientId === patientId
  );
  const imagingStudyIds = toIdSet(imagingStudies);

  return {
    patient,
    patientGuardians,
    guardians,
    primaryGuardian,
    consents: inWorkspace(snapshot.consents, scope).filter(
      (item) => item.patientId === patientId || guardianIds.has(item.guardianId)
    ),
    appointments: sortByIsoDateTimeDesc(appointments, (item) => item.scheduledStartAt),
    encounters: sortByIsoDateTimeDesc(encounters, (item) => item.updatedAt),
    waitingQueueEntries: inWorkspace(snapshot.waitingQueueEntries, scope).filter((item) =>
      encounterIds.has(item.encounterId)
    ),
    soapNotes: sortByIsoDateTimeDesc(
      snapshot.soapNotes.filter((item) => encounterIds.has(item.encounterId)),
      (item) => item.updatedAt
    ),
    diagnoses: snapshot.diagnoses.filter((item) => encounterIds.has(item.encounterId)),
    prescriptions,
    prescriptionItems: snapshot.prescriptionItems.filter((item) =>
      prescriptionIds.has(item.prescriptionId)
    ),
    orderGroups: snapshot.orderGroups.filter((item) => encounterIds.has(item.encounterId)),
    orders: sortByIsoDateTimeDesc(orders, (item) => item.updatedAt),
    orderAssignments: snapshot.orderAssignments.filter((item) => orderIds.has(item.orderId)),
    orderEvents: sortByIsoDateTimeDesc(
      snapshot.orderEvents.filter((item) => orderIds.has(item.orderId)),
      (item) => item.createdAt
    ),
    invoices: sortByIsoDateTimeDesc(invoices, (item) => item.issuedAt ?? item.createdAt),
    invoiceLines: snapshot.invoiceLines.filter((item) => invoiceIds.has(item.invoiceId)),
    payments: snapshot.payments.filter((item) => invoiceIds.has(item.invoiceId)),
    csHistories: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.csHistories, scope).filter(
        (item) =>
          item.patientId === patientId ||
          Boolean(item.guardianId && guardianIds.has(item.guardianId))
      ),
      (item) => item.occurredAt
    ),
    latestWorkShortcuts: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.latestWorkShortcuts ?? [], scope).filter(
        (item) => item.patientId === patientId
      ),
      (item) => item.occurredAt
    ),
    labResults,
    equipmentReceipts: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.equipmentReceipts, scope).filter(
        (item) =>
          item.patientId === patientId ||
          Boolean(item.encounterId && encounterIds.has(item.encounterId))
      ),
      (item) => item.receivedAt
    ),
    imagingStudies,
    attachments: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.attachments, scope).filter(
        (item) =>
          item.patientId === patientId ||
          Boolean(item.encounterId && encounterIds.has(item.encounterId)) ||
          labResultIds.has(item.ownerId) ||
          imagingStudyIds.has(item.ownerId)
      ),
      (item) => item.uploadedAt
    ),
    messageDeliveries: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.messageDeliveries, scope).filter(
        (item) =>
          item.patientId === patientId ||
          Boolean(item.encounterId && encounterIds.has(item.encounterId))
      ),
      (item) => item.createdAt
    ),
    auditLogs: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.auditLogs, scope).filter(
        (item) =>
          item.patientId === patientId ||
          Boolean(item.encounterId && encounterIds.has(item.encounterId))
      ),
      (item) => item.createdAt
    ),
  };
}

export function selectEncounterReadModel(
  snapshot: EmrReadSnapshot,
  scope: EmrReadScope,
  encounterId: EmrId
): EncounterReadModel | null {
  const encounter = inWorkspace(snapshot.encounters, scope).find((item) => item.id === encounterId);

  if (!encounter) return null;

  const patientModel = selectPatientReadModel(snapshot, scope, encounter.patientId);

  if (!patientModel) return null;

  const prescriptions = snapshot.prescriptions.filter((item) => item.encounterId === encounterId);
  const prescriptionIds = toIdSet(prescriptions);
  const orders = inWorkspace(snapshot.orders, scope).filter(
    (item) => item.encounterId === encounterId
  );
  const orderIds = toIdSet(orders);
  const invoices = inWorkspace(snapshot.invoices, scope).filter(
    (item) => item.encounterId === encounterId
  );
  const invoiceIds = toIdSet(invoices);
  const labResults = inWorkspace(snapshot.labResults, scope).filter(
    (item) => item.encounterId === encounterId
  );
  const labResultIds = toIdSet(labResults);
  const imagingStudies = inWorkspace(snapshot.imagingStudies, scope).filter(
    (item) => item.encounterId === encounterId
  );
  const imagingStudyIds = toIdSet(imagingStudies);

  return {
    encounter,
    patient: patientModel.patient,
    guardians: patientModel.guardians,
    primaryGuardian: patientModel.primaryGuardian,
    appointment: encounter.appointmentId
      ? findById(inWorkspace(snapshot.appointments, scope), encounter.appointmentId)
      : undefined,
    encounters: [encounter],
    consents: patientModel.consents,
    appointments: patientModel.appointments,
    waitingQueueEntries: inWorkspace(snapshot.waitingQueueEntries, scope).filter(
      (item) => item.encounterId === encounterId
    ),
    soapNotes: sortByIsoDateTimeDesc(
      snapshot.soapNotes.filter((item) => item.encounterId === encounterId),
      (item) => item.updatedAt
    ),
    diagnoses: snapshot.diagnoses.filter((item) => item.encounterId === encounterId),
    prescriptions,
    prescriptionItems: snapshot.prescriptionItems.filter((item) =>
      prescriptionIds.has(item.prescriptionId)
    ),
    orderGroups: snapshot.orderGroups.filter((item) => item.encounterId === encounterId),
    orders: sortByIsoDateTimeDesc(orders, (item) => item.updatedAt),
    orderAssignments: snapshot.orderAssignments.filter((item) => orderIds.has(item.orderId)),
    orderEvents: sortByIsoDateTimeDesc(
      snapshot.orderEvents.filter((item) => orderIds.has(item.orderId)),
      (item) => item.createdAt
    ),
    invoices: sortByIsoDateTimeDesc(invoices, (item) => item.issuedAt ?? item.createdAt),
    invoiceLines: snapshot.invoiceLines.filter((item) => invoiceIds.has(item.invoiceId)),
    payments: snapshot.payments.filter((item) => invoiceIds.has(item.invoiceId)),
    csHistories: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.csHistories, scope).filter((item) => item.encounterId === encounterId),
      (item) => item.occurredAt
    ),
    latestWorkShortcuts: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.latestWorkShortcuts ?? [], scope).filter(
        (item) => item.encounterId === encounterId
      ),
      (item) => item.occurredAt
    ),
    labResults,
    equipmentReceipts: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.equipmentReceipts, scope).filter(
        (item) => item.encounterId === encounterId
      ),
      (item) => item.receivedAt
    ),
    imagingStudies,
    attachments: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.attachments, scope).filter(
        (item) =>
          item.encounterId === encounterId ||
          labResultIds.has(item.ownerId) ||
          imagingStudyIds.has(item.ownerId)
      ),
      (item) => item.uploadedAt
    ),
    messageDeliveries: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.messageDeliveries, scope).filter(
        (item) => item.encounterId === encounterId
      ),
      (item) => item.createdAt
    ),
    auditLogs: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.auditLogs, scope).filter((item) => item.encounterId === encounterId),
      (item) => item.createdAt
    ),
  };
}

export function selectGuardianReadModel(
  snapshot: EmrReadSnapshot,
  scope: EmrReadScope,
  guardianId: EmrId
): GuardianReadModel | null {
  const guardian = inWorkspace(snapshot.guardians, scope).find((item) => item.id === guardianId);

  if (!guardian) return null;

  const patientGuardians = snapshot.patientGuardians.filter(
    (item) => item.guardianId === guardianId
  );
  const patientIds = new Set(patientGuardians.map((item) => item.patientId));
  const patients = inWorkspace(snapshot.patients, scope).filter((item) => patientIds.has(item.id));
  const encounters = inWorkspace(snapshot.encounters, scope).filter((item) =>
    patientIds.has(item.patientId)
  );
  const encounterIds = toIdSet(encounters);
  const invoices = inWorkspace(snapshot.invoices, scope).filter(
    (item) => item.guardianId === guardianId || encounterIds.has(item.encounterId)
  );
  const invoiceIds = toIdSet(invoices);

  return {
    guardian,
    patientGuardians,
    patients,
    consents: inWorkspace(snapshot.consents, scope).filter(
      (item) => item.guardianId === guardianId || Boolean(item.patientId && patientIds.has(item.patientId))
    ),
    appointments: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.appointments, scope).filter(
        (item) => item.guardianId === guardianId || patientIds.has(item.patientId)
      ),
      (item) => item.scheduledStartAt
    ),
    encounters: sortByIsoDateTimeDesc(encounters, (item) => item.updatedAt),
    invoices: sortByIsoDateTimeDesc(invoices, (item) => item.issuedAt ?? item.createdAt),
    invoiceLines: snapshot.invoiceLines.filter((item) => invoiceIds.has(item.invoiceId)),
    payments: snapshot.payments.filter((item) => invoiceIds.has(item.invoiceId)),
    csHistories: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.csHistories, scope).filter(
        (item) =>
          item.guardianId === guardianId ||
          Boolean(item.patientId && patientIds.has(item.patientId))
      ),
      (item) => item.occurredAt
    ),
    messageDeliveries: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.messageDeliveries, scope).filter(
        (item) =>
          item.guardianId === guardianId ||
          Boolean(item.patientId && patientIds.has(item.patientId))
      ),
      (item) => item.createdAt
    ),
    latestWorkShortcuts: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.latestWorkShortcuts ?? [], scope).filter((item) =>
        patientIds.has(item.patientId)
      ),
      (item) => item.occurredAt
    ),
    auditLogs: sortByIsoDateTimeDesc(
      inWorkspace(snapshot.auditLogs, scope).filter(
        (item) => Boolean(item.patientId && patientIds.has(item.patientId)) || invoiceIds.has(item.entityId)
      ),
      (item) => item.createdAt
    ),
  };
}

export function selectBillingGroupsByGuardian(
  snapshot: EmrReadSnapshot,
  scope: EmrReadScope
): BillingGuardianGroupReadModel[] {
  return inWorkspace(snapshot.guardians, scope)
    .map((guardian) => {
      const invoices = inWorkspace(snapshot.invoices, scope).filter(
        (invoice) => invoice.guardianId === guardian.id
      );
      const invoiceIds = toIdSet(invoices);
      const encounterIds = new Set(invoices.map((invoice) => invoice.encounterId));
      const patientIds = new Set(
        inWorkspace(snapshot.encounters, scope)
          .filter((encounter) => encounterIds.has(encounter.id))
          .map((encounter) => encounter.patientId)
      );

      return {
        guardian,
        patients: inWorkspace(snapshot.patients, scope).filter((patient) =>
          patientIds.has(patient.id)
        ),
        invoices: sortByIsoDateTimeDesc(invoices, (invoice) => invoice.issuedAt ?? invoice.createdAt),
        invoiceLines: snapshot.invoiceLines.filter((line) => invoiceIds.has(line.invoiceId)),
        payments: snapshot.payments.filter((payment) => invoiceIds.has(payment.invoiceId)),
        totalDueAmount: invoices
          .filter(
            (invoice) =>
              invoice.status !== "paid" &&
              invoice.status !== "refunded" &&
              invoice.status !== "voided"
          )
          .reduce((total, invoice) => total + invoice.totalAmount, 0),
      };
    })
    .filter((group) => group.invoices.length > 0);
}

export function createSnapshotReadRepository(
  getSnapshot: (scope: EmrReadScope) => EmrReadSnapshot | Promise<EmrReadSnapshot>
): EmrReadRepository {
  return {
    async getSnapshot(scope) {
      return getSnapshot(scope);
    },
    async getPatient(scope, patientId) {
      return selectPatientReadModel(await getSnapshot(scope), scope, patientId);
    },
    async getEncounter(scope, encounterId) {
      return selectEncounterReadModel(await getSnapshot(scope), scope, encounterId);
    },
    async getGuardian(scope, guardianId) {
      return selectGuardianReadModel(await getSnapshot(scope), scope, guardianId);
    },
    async listBillingGroupsByGuardian(scope) {
      return selectBillingGroupsByGuardian(await getSnapshot(scope), scope);
    },
  };
}
