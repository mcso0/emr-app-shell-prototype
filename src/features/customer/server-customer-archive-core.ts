import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  mockAppointments,
  mockEncounters,
  mockGuardians,
  mockInvoices,
  mockPatientGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import type { Appointment, Encounter, Guardian, Invoice, Patient, PatientGuardian } from "@/types/emr-domain";

export type CustomerArchiveTarget = "guardian" | "patient";
export type CustomerArchiveStatus = "active" | "soft_deleted";
export type CustomerArchiveAction = "soft_delete" | "restore";
export type CustomerDeletionLockSource = "appointment" | "encounter" | "invoice" | "deposit" | "relationship";

export type CustomerDeletionLock = {
  sourceType: CustomerDeletionLockSource;
  sourceId: string;
  reason:
    | "active_appointment"
    | "active_encounter"
    | "open_invoice"
    | "deposit_balance"
    | "primary_guardian"
    | "active_patient";
};

export type CustomerArchiveRecord = {
  id: string;
  target: CustomerArchiveTarget;
  workspaceId: string;
  displayName: string;
  status: CustomerArchiveStatus;
  deletedAt?: string;
  deletedByUserId?: string;
  restoredAt?: string;
  restoredByUserId?: string;
  auditEvent: {
    action: CustomerArchiveAction;
    actorUserId: string;
    occurredAt: string;
    targetId: string;
    target: CustomerArchiveTarget;
  } | null;
};

export type CustomerDepositBalance = {
  guardianId: string;
  workspaceId: string;
  balanceAmount: number;
  holdAmount?: number;
};

export type CustomerArchiveActionInput = {
  action: CustomerArchiveAction;
};

export type CustomerArchiveGateway = {
  listArchiveRecords(input: {
    status?: CustomerArchiveStatus;
    workspaceId: string;
  }): Promise<{ ok: true; records: CustomerArchiveRecord[] } | { ok: false; status: 500; error: "db_read_failed" }>;
  updateArchiveState(input: {
    actorUserId: string;
    action: CustomerArchiveAction;
    target: CustomerArchiveTarget;
    targetId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; record: CustomerArchiveRecord; locks: CustomerDeletionLock[] }
    | { ok: false; status: 404; denialReason: "customer_record_not_found" }
    | { ok: false; status: 409; denialReason: "deletion_locked"; locks: CustomerDeletionLock[] }
    | { ok: false; status: 500; error: "db_write_failed" }
  >;
};

export type CustomerArchiveListResult =
  | {
      ok: true;
      status: 200;
      records: CustomerArchiveRecord[];
      enforcedBy: "customer-archive-list";
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 500; error: "db_read_failed" };

export type CustomerArchiveMutationResult =
  | {
      ok: true;
      status: 200;
      record: CustomerArchiveRecord;
      locks: CustomerDeletionLock[];
      enforcedBy: "customer-archive-mutation";
    }
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 404; denialReason: "customer_record_not_found" }
  | { ok: false; status: 409; denialReason: "deletion_locked"; locks: CustomerDeletionLock[] }
  | { ok: false; status: 500; error: "db_write_failed" };

export async function listCustomerArchiveRecords({
  actorUserId,
  gateway = createMockCustomerArchiveGateway(),
  permissionAdapter = createDemoCustomerArchivePermissionAdapter(),
  status,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerArchiveGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  status?: CustomerArchiveStatus;
  workspaceId: string;
}): Promise<CustomerArchiveListResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "patient:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.listArchiveRecords({ status, workspaceId });
  if (!result.ok) return result;
  return { ok: true, status: 200, records: result.records, enforcedBy: "customer-archive-list" };
}

export async function updateCustomerArchiveState({
  actorUserId,
  gateway = createMockCustomerArchiveGateway(),
  input,
  permissionAdapter = createDemoCustomerArchivePermissionAdapter(),
  target,
  targetId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerArchiveGateway;
  input: CustomerArchiveActionInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  target: CustomerArchiveTarget;
  targetId: string;
  workspaceId: string;
}): Promise<CustomerArchiveMutationResult> {
  if (input.action !== "soft_delete" && input.action !== "restore") {
    return { ok: false, status: 400, error: "invalid_input" };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "patient:update",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.updateArchiveState({
    actorUserId: actorUserId ?? "",
    action: input.action,
    target,
    targetId,
    workspaceId,
  });
  if (!result.ok) return result;

  return {
    ok: true,
    status: 200,
    record: result.record,
    locks: result.locks,
    enforcedBy: "customer-archive-mutation",
  };
}

export function createMockCustomerArchiveGateway(
  dataset: {
    appointments?: Appointment[];
    depositBalances?: CustomerDepositBalance[];
    encounters?: Encounter[];
    guardians?: Guardian[];
    invoices?: Invoice[];
    links?: PatientGuardian[];
    patients?: Patient[];
  } = {},
  now = new Date().toISOString()
): CustomerArchiveGateway {
  const appointments = dataset.appointments ?? mockAppointments;
  const depositBalances = dataset.depositBalances ?? [];
  const encounters = dataset.encounters ?? mockEncounters;
  const invoices = dataset.invoices ?? mockInvoices;
  const links = dataset.links ?? mockPatientGuardians;
  const guardianRecords = new Map(
    (dataset.guardians ?? mockGuardians).map((guardian) => [
      guardian.id,
      toArchiveRecord({ item: guardian, target: "guardian" as const }),
    ])
  );
  const patientRecords = new Map(
    (dataset.patients ?? mockPatients).map((patient) => [
      patient.id,
      toArchiveRecord({ item: patient, target: "patient" as const }),
    ])
  );

  return {
    async listArchiveRecords({ status, workspaceId }) {
      const records = [...guardianRecords.values(), ...patientRecords.values()]
        .filter((record) => record.workspaceId === workspaceId)
        .filter((record) => (status ? record.status === status : record.status === "active"))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
      return { ok: true, records: records.map(cloneArchiveRecord) };
    },
    async updateArchiveState({ actorUserId, action, target, targetId, workspaceId }) {
      const store = target === "guardian" ? guardianRecords : patientRecords;
      const record = store.get(targetId);
      if (!record || record.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "customer_record_not_found" };
      }

      const locks =
        action === "soft_delete"
          ? calculateDeletionLocks({
              appointments,
              depositBalances,
              encounters,
              guardianRecords: [...guardianRecords.values()],
              invoices,
              links,
              patientRecords: [...patientRecords.values()],
              target,
              targetId,
              workspaceId,
            })
          : [];

      if (locks.length > 0) {
        return { ok: false, status: 409, denialReason: "deletion_locked", locks };
      }

      const next: CustomerArchiveRecord = {
        ...record,
        status: action === "restore" ? "active" : "soft_deleted",
        deletedAt: action === "soft_delete" ? now : record.deletedAt,
        deletedByUserId: action === "soft_delete" ? actorUserId : record.deletedByUserId,
        restoredAt: action === "restore" ? now : record.restoredAt,
        restoredByUserId: action === "restore" ? actorUserId : record.restoredByUserId,
        auditEvent: {
          action,
          actorUserId,
          occurredAt: now,
          target,
          targetId,
        },
      };
      store.set(targetId, next);
      return { ok: true, record: cloneArchiveRecord(next), locks };
    },
  };
}

export function createDemoCustomerArchivePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-front-desk", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
      { id: "membership-tech", workspaceId: "clair-demo", userId: "user-tech", roles: ["technician"], status: "active" },
    ],
  });
}

function calculateDeletionLocks({
  appointments,
  depositBalances,
  encounters,
  guardianRecords,
  invoices,
  links,
  patientRecords,
  target,
  targetId,
  workspaceId,
}: {
  appointments: Appointment[];
  depositBalances: CustomerDepositBalance[];
  encounters: Encounter[];
  guardianRecords: CustomerArchiveRecord[];
  invoices: Invoice[];
  links: PatientGuardian[];
  patientRecords: CustomerArchiveRecord[];
  target: CustomerArchiveTarget;
  targetId: string;
  workspaceId: string;
}) {
  if (target === "patient") {
    return calculatePatientDeletionLocks({ appointments, encounters, invoices, targetId, workspaceId });
  }

  const guardianPatientIds = links
    .filter((link) => link.guardianId === targetId && !isSoftUnlinked(link))
    .map((link) => link.patientId);
  const activePatientIds = new Set(
    patientRecords
      .filter((record) => guardianPatientIds.includes(record.id) && record.workspaceId === workspaceId && record.status === "active")
      .map((record) => record.id)
  );
  const locks: CustomerDeletionLock[] = [];

  links
    .filter((link) => link.guardianId === targetId && link.isPrimary && !isSoftUnlinked(link) && activePatientIds.has(link.patientId))
    .forEach((link) => {
      locks.push({ sourceType: "relationship", sourceId: link.id, reason: "primary_guardian" });
    });

  activePatientIds.forEach((patientId) => {
    locks.push({ sourceType: "relationship", sourceId: patientId, reason: "active_patient" });
  });

  invoices
    .filter((invoice) => invoice.workspaceId === workspaceId && invoice.guardianId === targetId && isOpenInvoice(invoice))
    .forEach((invoice) => {
      locks.push({ sourceType: "invoice", sourceId: invoice.id, reason: "open_invoice" });
    });

  depositBalances
    .filter(
      (balance) =>
        balance.workspaceId === workspaceId &&
        balance.guardianId === targetId &&
        (balance.balanceAmount !== 0 || (balance.holdAmount ?? 0) !== 0)
    )
    .forEach((balance) => {
      locks.push({ sourceType: "deposit", sourceId: balance.guardianId, reason: "deposit_balance" });
    });

  void guardianRecords;
  return dedupeLocks(locks);
}

function calculatePatientDeletionLocks({
  appointments,
  encounters,
  invoices,
  targetId,
  workspaceId,
}: {
  appointments: Appointment[];
  encounters: Encounter[];
  invoices: Invoice[];
  targetId: string;
  workspaceId: string;
}) {
  const locks: CustomerDeletionLock[] = [];
  const activeEncounterIds = new Set<string>();

  appointments
    .filter((appointment) => appointment.workspaceId === workspaceId && appointment.patientId === targetId && isActiveAppointment(appointment))
    .forEach((appointment) => {
      locks.push({ sourceType: "appointment", sourceId: appointment.id, reason: "active_appointment" });
    });

  encounters
    .filter((encounter) => encounter.workspaceId === workspaceId && encounter.patientId === targetId && isActiveEncounter(encounter))
    .forEach((encounter) => {
      activeEncounterIds.add(encounter.id);
      locks.push({ sourceType: "encounter", sourceId: encounter.id, reason: "active_encounter" });
    });

  invoices
    .filter((invoice) => invoice.workspaceId === workspaceId && activeEncounterIds.has(invoice.encounterId) && isOpenInvoice(invoice))
    .forEach((invoice) => {
      locks.push({ sourceType: "invoice", sourceId: invoice.id, reason: "open_invoice" });
    });

  return dedupeLocks(locks);
}

function toArchiveRecord({
  item,
  target,
}: {
  item: Guardian | Patient;
  target: CustomerArchiveTarget;
}): CustomerArchiveRecord {
  const maybeStatus = "status" in item ? (item as { status?: string }).status : "active";
  return {
    id: item.id,
    target,
    workspaceId: item.workspaceId,
    displayName: item.name,
    status: maybeStatus === "soft_deleted" ? "soft_deleted" : "active",
    auditEvent: null,
  };
}

function cloneArchiveRecord(record: CustomerArchiveRecord) {
  return {
    ...record,
    auditEvent: record.auditEvent ? { ...record.auditEvent } : null,
  };
}

function dedupeLocks(locks: CustomerDeletionLock[]) {
  const seen = new Set<string>();
  return locks.filter((lock) => {
    const key = `${lock.sourceType}:${lock.sourceId}:${lock.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isActiveAppointment(appointment: Appointment) {
  return appointment.status === "requested" || appointment.status === "confirmed" || appointment.status === "changed" || appointment.status === "checked_in";
}

function isActiveEncounter(encounter: Encounter) {
  return (
    encounter.status === "waiting" ||
    encounter.status === "in_consultation" ||
    encounter.status === "ordered" ||
    encounter.status === "ready_for_billing"
  );
}

function isOpenInvoice(invoice: Invoice) {
  return (
    invoice.status === "draft" ||
    invoice.status === "issued" ||
    invoice.status === "refund_requested" ||
    invoice.paymentState === "unpaid" ||
    invoice.paymentState === "failed"
  );
}

function isSoftUnlinked(link: PatientGuardian) {
  return link.relationship?.includes("|unlinked:") ?? false;
}
