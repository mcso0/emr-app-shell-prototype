import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockCustomerPatientProfileGateway,
  readCustomerPatientProfile,
  updateCustomerPatientProfile,
  type CustomerPatientProfile,
} from "../src/features/customer/server-patient-profile-core";

const now = "2026-05-20T00:00:00.000Z";

const profile: CustomerPatientProfile = {
  id: "patient-a",
  workspaceId: "workspace-a",
  patientNo: "P0001",
  name: "콩이",
  species: "dog",
  breed: "Poodle",
  primaryBreedId: "breed-poodle",
  primaryBreedName: "Poodle",
  isMixedBreed: false,
  additionalBreedIds: [],
  sex: "female",
  neutered: true,
  birthDate: "2021-01-01",
  ageIsEstimated: false,
  weightKg: 6.2,
  color: "cream",
  microchipNo: "999000000000001",
  microchipType: "internal",
  patientRegistrationNo: "REG-0001",
  specialNote: "특이사항",
  allergyNote: "알러지",
  handlingCautionNote: "핸들링",
  handlingCautionLocked: true,
  profileMemo: "프로필 메모",
  primaryAttendingVetId: "user-vet",
  messageConsentStatus: "granted",
  status: "active",
  createdAt: now,
  updatedAt: now,
};

function permissionAdapter(options: { workspaceId?: string; permissionIds?: ["*"] | string[] } = {}) {
  const workspaceId = options.workspaceId ?? "workspace-a";
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-front", status: "active" }],
    memberships: [
      {
        id: "membership-front",
        workspaceId,
        userId: "user-front",
        roles: ["front_desk"],
        status: "active",
      },
    ],
    permissionPolicies: [
      {
        workspaceId,
        role: "front_desk",
        permissionIds: (options.permissionIds ?? ["patient:view", "patient:update"]) as never,
      },
    ],
  });
}

test("patient profile read enforces active workspace membership and patient view permission", async () => {
  const result = await readCustomerPatientProfile({
    actorUserId: "user-front",
    patientId: "patient-a",
    workspaceId: "workspace-a",
    gateway: createMockCustomerPatientProfileGateway([profile]),
    permissionAdapter: permissionAdapter({ workspaceId: "workspace-other" }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
});

test("patient profile read returns a workspace-scoped DTO", async () => {
  const result = await readCustomerPatientProfile({
    actorUserId: "user-front",
    patientId: "patient-a",
    workspaceId: "workspace-a",
    gateway: createMockCustomerPatientProfileGateway([profile]),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "customer-patient-profile-read",
    profile: {
      id: "patient-a",
      workspaceId: "workspace-a",
      name: "콩이",
      species: "dog",
      primaryAttendingVetId: "user-vet",
    },
  });
});

test("patient profile update enforces patient update permission", async () => {
  const result = await updateCustomerPatientProfile({
    actorUserId: "user-front",
    patientId: "patient-a",
    workspaceId: "workspace-a",
    input: { name: "콩이" },
    gateway: createMockCustomerPatientProfileGateway([profile]),
    permissionAdapter: permissionAdapter({ permissionIds: ["patient:view"] }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("patient profile update validates profile values", async () => {
  const result = await updateCustomerPatientProfile({
    actorUserId: "user-front",
    patientId: "patient-a",
    workspaceId: "workspace-a",
    input: {
      name: "",
      weightKg: -1,
      messageConsentStatus: "maybe" as never,
    },
    gateway: createMockCustomerPatientProfileGateway([profile]),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: {
      messageConsentStatus: expect.any(String),
      name: expect.any(String),
      weightKg: expect.any(String),
    },
  });
});

test("patient profile update normalizes fields and writes through the gateway", async () => {
  const result = await updateCustomerPatientProfile({
    actorUserId: "user-front",
    patientId: "patient-a",
    workspaceId: "workspace-a",
    input: {
      additionalBreedIds: ["breed-poodle", "", "breed-maltese", "breed-poodle"],
      allergyNote: "  없음  ",
      breed: " Toy Poodle ",
      microchipNo: " 999000000000002 ",
      name: " 콩이 ",
      primaryAttendingVetId: " user-vet ",
      profileMemo: "  환자 메모  ",
      specialNote: "  온순함  ",
      weightKg: 6.4,
    },
    gateway: createMockCustomerPatientProfileGateway([profile], now),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    profile: {
      additionalBreedIds: ["breed-poodle", "breed-maltese"],
      allergyNote: "없음",
      breed: "Toy Poodle",
      microchipNo: "999000000000002",
      name: "콩이",
      primaryAttendingVetId: "user-vet",
      profileMemo: "환자 메모",
      specialNote: "온순함",
      weightKg: 6.4,
    },
  });
});
