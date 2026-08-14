import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockCustomerArchiveGateway,
  listCustomerArchiveRecords,
  updateCustomerArchiveState,
  type CustomerDepositBalance,
} from "../src/features/customer/server-customer-archive-core";
import type { Appointment, Encounter, Guardian, Invoice, Patient, PatientGuardian } from "../src/types/emr-domain";

const now = "2026-05-20T00:00:00.000Z";
const patients: Patient[] = [
  { id: "patient-open", workspaceId: "workspace-a", patientNo: "P1", name: "콩이", species: "dog", sex: "female", handlingCautionLocked: true, status: "active", createdAt: now, updatedAt: now },
  { id: "patient-clear", workspaceId: "workspace-a", patientNo: "P2", name: "별이", species: "cat", sex: "female", handlingCautionLocked: false, status: "active", createdAt: now, updatedAt: now },
  { id: "patient-other", workspaceId: "workspace-other", patientNo: "P3", name: "외부", species: "dog", sex: "male", handlingCautionLocked: false, status: "active", createdAt: now, updatedAt: now },
];
const guardians: Guardian[] = [
  { id: "guardian-primary", workspaceId: "workspace-a", name: "김하늘", createdAt: now, updatedAt: now },
  { id: "guardian-clear", workspaceId: "workspace-a", name: "이바다", createdAt: now, updatedAt: now },
  { id: "guardian-other", workspaceId: "workspace-other", name: "외부", createdAt: now, updatedAt: now },
];
const links: PatientGuardian[] = [
  { id: "link-primary", patientId: "patient-open", guardianId: "guardian-primary", relationship: "primary", isPrimary: true, canReceiveMessages: true, createdAt: now },
  { id: "link-clear", patientId: "patient-clear", guardianId: "guardian-clear", relationship: "family", isPrimary: false, canReceiveMessages: true, createdAt: now },
];
const appointments: Appointment[] = [
  { id: "appointment-open", workspaceId: "workspace-a", patientId: "patient-open", guardianId: "guardian-primary", scheduledStartAt: now, status: "confirmed", createdAt: now, updatedAt: now },
];
const encounters: Encounter[] = [
  { id: "encounter-open", workspaceId: "workspace-a", patientId: "patient-open", guardianId: "guardian-primary", encounterNo: "E1", status: "waiting", createdAt: now, updatedAt: now },
  { id: "encounter-clear", workspaceId: "workspace-a", patientId: "patient-clear", guardianId: "guardian-clear", encounterNo: "E2", status: "completed", createdAt: now, updatedAt: now },
];
const invoices: Invoice[] = [
  { id: "invoice-open", workspaceId: "workspace-a", encounterId: "encounter-open", guardianId: "guardian-primary", invoiceNo: "I1", status: "issued", subtotalAmount: 1000, discountAmount: 0, taxAmount: 0, totalAmount: 1000, paymentState: "unpaid", createdAt: now },
];
const depositBalances: CustomerDepositBalance[] = [
  { guardianId: "guardian-primary", workspaceId: "workspace-a", balanceAmount: 5000 },
];

function permissionAdapter(options: { permissionIds?: ["*"] | string[] } = {}) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-front", status: "active" }],
    memberships: [{ id: "membership-front", workspaceId: "workspace-a", userId: "user-front", roles: ["front_desk"], status: "active" }],
    permissionPolicies: [{ workspaceId: "workspace-a", role: "front_desk", permissionIds: (options.permissionIds ?? ["patient:view", "patient:update"]) as never }],
  });
}

function gateway() {
  return createMockCustomerArchiveGateway(
    { appointments, depositBalances, encounters, guardians, invoices, links, patients },
    now
  );
}

test("soft delete enforces patient update permission", async () => {
  const result = await updateCustomerArchiveState({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    target: "patient",
    targetId: "patient-clear",
    input: { action: "soft_delete" },
    gateway: gateway(),
    permissionAdapter: permissionAdapter({ permissionIds: ["patient:view"] }),
  });

  expect(result).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
});

test("patient soft delete is blocked by active appointment encounter and invoice locks", async () => {
  const result = await updateCustomerArchiveState({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    target: "patient",
    targetId: "patient-open",
    input: { action: "soft_delete" },
    gateway: gateway(),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({ ok: false, status: 409, denialReason: "deletion_locked" });
  expect(result.ok).toBe(false);
  if (!result.ok && "locks" in result) {
    expect(result.locks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: "appointment", reason: "active_appointment" }),
        expect.objectContaining({ sourceType: "encounter", reason: "active_encounter" }),
        expect.objectContaining({ sourceType: "invoice", reason: "open_invoice" }),
      ])
    );
  }
});

test("guardian soft delete is blocked by primary relationship active patient invoice and deposit locks", async () => {
  const result = await updateCustomerArchiveState({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    target: "guardian",
    targetId: "guardian-primary",
    input: { action: "soft_delete" },
    gateway: gateway(),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({ ok: false, status: 409, denialReason: "deletion_locked" });
  expect(result.ok).toBe(false);
  if (!result.ok && "locks" in result) {
    expect(result.locks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: "relationship", reason: "primary_guardian" }),
        expect.objectContaining({ sourceType: "relationship", reason: "active_patient" }),
        expect.objectContaining({ sourceType: "invoice", reason: "open_invoice" }),
        expect.objectContaining({ sourceType: "deposit", reason: "deposit_balance" }),
      ])
    );
  }
});

test("soft delete excludes records from default list and restore returns them to active list", async () => {
  const archiveGateway = gateway();
  const deleted = await updateCustomerArchiveState({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    target: "patient",
    targetId: "patient-clear",
    input: { action: "soft_delete" },
    gateway: archiveGateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(deleted).toMatchObject({
    ok: true,
    status: 200,
    record: expect.objectContaining({ id: "patient-clear", status: "soft_deleted", deletedByUserId: "user-front" }),
  });

  const activeList = await listCustomerArchiveRecords({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    gateway: archiveGateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(activeList).toMatchObject({ ok: true });
  if (activeList.ok) {
    expect(activeList.records.map((record) => record.id)).not.toContain("patient-clear");
  }

  const deletedList = await listCustomerArchiveRecords({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    status: "soft_deleted",
    gateway: archiveGateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(deletedList).toMatchObject({
    ok: true,
    records: [expect.objectContaining({ id: "patient-clear", status: "soft_deleted" })],
  });

  const restored = await updateCustomerArchiveState({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    target: "patient",
    targetId: "patient-clear",
    input: { action: "restore" },
    gateway: archiveGateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(restored).toMatchObject({
    ok: true,
    record: expect.objectContaining({ id: "patient-clear", status: "active", restoredByUserId: "user-front" }),
  });
});

test("archive mutation denies cross-workspace records", async () => {
  const result = await updateCustomerArchiveState({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    target: "patient",
    targetId: "patient-other",
    input: { action: "soft_delete" },
    gateway: gateway(),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({ ok: false, status: 404, denialReason: "customer_record_not_found" });
});

test("prepared Cheongdam demo workspace keeps archive read permission scoped to known members", async () => {
  const allowed = await listCustomerArchiveRecords({
    actorUserId: "playwright-default-session",
    workspaceId: "workspace-clair-cheongdam",
  });
  const denied = await listCustomerArchiveRecords({
    actorUserId: "unknown-user",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(allowed).toMatchObject({
    ok: true,
    status: 200,
    records: [],
    enforcedBy: "customer-archive-list",
  });
  expect(denied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
});
