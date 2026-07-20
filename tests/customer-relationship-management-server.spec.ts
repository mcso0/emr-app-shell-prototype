import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockCustomerRelationshipGateway,
  updateCustomerPatientGuardianRelationship,
} from "../src/features/customer/server-patient-guardian-relationship-core";
import type { Guardian, Patient, PatientGuardian } from "../src/types/emr-domain";

const now = "2026-05-20T00:00:00.000Z";
const patients: Patient[] = [
  { id: "patient-a", workspaceId: "workspace-a", patientNo: "P1", name: "콩이", species: "dog", sex: "female", handlingCautionLocked: true, status: "active", createdAt: now, updatedAt: now },
];
const guardians: Guardian[] = [
  { id: "guardian-a", workspaceId: "workspace-a", name: "김하늘", createdAt: now, updatedAt: now },
  { id: "guardian-b", workspaceId: "workspace-a", name: "이바다", createdAt: now, updatedAt: now },
  { id: "guardian-other", workspaceId: "workspace-other", name: "외부", createdAt: now, updatedAt: now },
];
const links: PatientGuardian[] = [
  { id: "link-a", patientId: "patient-a", guardianId: "guardian-a", relationship: "primary", isPrimary: true, canReceiveMessages: true, createdAt: now },
];

function permissionAdapter(options: { permissionIds?: ["*"] | string[] } = {}) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-front", status: "active" }],
    memberships: [{ id: "membership-front", workspaceId: "workspace-a", userId: "user-front", roles: ["front_desk"], status: "active" }],
    permissionPolicies: [{ workspaceId: "workspace-a", role: "front_desk", permissionIds: (options.permissionIds ?? ["patient:view", "patient_guardian_relationship:manage"]) as never }],
  });
}

test("relationship action requires the patient guardian relationship management permission", async () => {
  const result = await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "link", patientId: "patient-a", guardianId: "guardian-b" },
    gateway: createMockCustomerRelationshipGateway({ guardians, links, patients }, now),
    permissionAdapter: permissionAdapter({ permissionIds: ["patient:view", "patient:update"] }),
  });

  expect(result).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
});

test("relationship action blocks cross-workspace guardian links", async () => {
  const result = await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "link", patientId: "patient-a", guardianId: "guardian-other" },
    gateway: createMockCustomerRelationshipGateway({ guardians, links, patients }, now),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({ ok: false, status: 409, denialReason: "guardian_unavailable" });
});

test("relationship action links additional guardian and blocks duplicates", async () => {
  const gateway = createMockCustomerRelationshipGateway({ guardians, links, patients }, now);
  const first = await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "link", patientId: "patient-a", guardianId: "guardian-b", relationship: "family" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(first).toMatchObject({
    ok: true,
    status: 200,
    relationships: expect.arrayContaining([
      expect.objectContaining({ guardianId: "guardian-b", isPrimary: false, relationship: "family" }),
    ]),
  });

  const duplicate = await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "link", patientId: "patient-a", guardianId: "guardian-b" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(duplicate).toMatchObject({ ok: false, status: 409, denialReason: "duplicate_relationship" });
});

test("relationship action changes primary guardian without deleting master rows", async () => {
  const gateway = createMockCustomerRelationshipGateway({ guardians, links, patients }, now);
  await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "link", patientId: "patient-a", guardianId: "guardian-b" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  const result = await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "set_primary", patientId: "patient-a", guardianId: "guardian-b" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    relationships: expect.arrayContaining([
      expect.objectContaining({ guardianId: "guardian-a", isPrimary: false }),
      expect.objectContaining({ guardianId: "guardian-b", isPrimary: true }),
    ]),
  });
});

test("relationship action soft-unlinks additional guardians only", async () => {
  const gateway = createMockCustomerRelationshipGateway({ guardians, links, patients }, now);
  await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "link", patientId: "patient-a", guardianId: "guardian-b" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  const result = await updateCustomerPatientGuardianRelationship({
    actorUserId: "user-front",
    workspaceId: "workspace-a",
    input: { action: "unlink", patientId: "patient-a", guardianId: "guardian-b" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    relationships: [expect.objectContaining({ guardianId: "guardian-a", isPrimary: true })],
  });
});

test("relationship route denies a non-admin actor even when that role can update patients", async ({
  request,
}) => {
  const response = await request.patch(
    "/api/workspaces/clair-demo/customer/relationships",
    {
      headers: { "x-clair-demo-session-user-id": "user-vet" },
      data: {
        action: "set_primary",
        patientId: "patient-dubu",
        guardianId: "guardian-kang-seoyun",
      },
    },
  );

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "permission_missing",
  });
});

test("relationship route lets an admin change the primary guardian", async ({ request }) => {
  const response = await request.patch(
    "/api/workspaces/clair-demo/customer/relationships",
    {
      headers: { "x-clair-demo-session-user-id": "user-admin" },
      data: {
        action: "set_primary",
        patientId: "patient-dubu",
        guardianId: "guardian-kang-seoyun",
      },
    },
  );

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    relationships: expect.arrayContaining([
      expect.objectContaining({ guardianId: "guardian-kang-seoyun", isPrimary: true }),
    ]),
  });
});
