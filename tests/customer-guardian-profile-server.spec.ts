import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockCustomerGuardianProfileGateway,
  readCustomerGuardianProfile,
  updateCustomerGuardianProfile,
  type CustomerGuardianProfile,
} from "../src/features/customer/server-guardian-profile-core";

const now = "2026-05-20T00:00:00.000Z";

const profile: CustomerGuardianProfile = {
  id: "guardian-a",
  workspaceId: "workspace-a",
  name: "김하늘",
  mobilePhone: "010-1111-2222",
  phone: "02-1234-5678",
  email: "guardian@example.test",
  birthDate: "1990-01-01",
  address: "서울시 데모구",
  memo: "기존 메모",
  guardianCode: "C0001",
  additionalPhoneNumbers: ["010-3333-4444"],
  postalCode: "06000",
  addressLine1: "Synthetic road",
  addressLine2: "101",
  emailLocalPart: "guardian",
  emailDomainMode: "direct_input",
  emailDomain: "example.test",
  cashReceiptType: "none",
  residentRegistrationNumberMasked: "900101-1******",
  residentRegistrationNumberToken: "masked-demo-rrn-token",
  vehicleNumber: "DEMO-1234",
  status: "active",
  referralSources: ["homepage"],
  consents: [
    {
      consentType: "personal_data_collection",
      status: "granted",
      documentVersion: "customer-profile-demo-v1",
      sourceSurface: "guardian_registration",
    },
  ],
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
        permissionIds: (options.permissionIds ?? ["patient:view", "guardian_profile:manage"]) as never,
      },
    ],
  });
}

test("guardian profile read enforces active workspace membership and patient view permission", async () => {
  const result = await readCustomerGuardianProfile({
    actorUserId: "user-front",
    guardianId: "guardian-a",
    workspaceId: "workspace-a",
    gateway: createMockCustomerGuardianProfileGateway([profile]),
    permissionAdapter: permissionAdapter({ workspaceId: "workspace-other" }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
});

test("guardian profile read returns a display-safe DTO scoped to workspace", async () => {
  const result = await readCustomerGuardianProfile({
    actorUserId: "user-front",
    guardianId: "guardian-a",
    workspaceId: "workspace-a",
    gateway: createMockCustomerGuardianProfileGateway([profile]),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "customer-guardian-profile-read",
    profile: {
      id: "guardian-a",
      workspaceId: "workspace-a",
      name: "김하늘",
      residentRegistrationNumberMasked: "900101-1******",
      residentRegistrationNumberToken: "masked-demo-rrn-token",
    },
  });
});

test("guardian profile update requires the guardian profile management permission", async () => {
  const result = await updateCustomerGuardianProfile({
    actorUserId: "user-front",
    guardianId: "guardian-a",
    workspaceId: "workspace-a",
    input: { name: "김하늘" },
    gateway: createMockCustomerGuardianProfileGateway([profile]),
    permissionAdapter: permissionAdapter({ permissionIds: ["patient:view", "patient:update"] }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("guardian profile update rejects raw identifier-shaped values", async () => {
  const result = await updateCustomerGuardianProfile({
    actorUserId: "user-front",
    guardianId: "guardian-a",
    workspaceId: "workspace-a",
    input: {
      cashReceiptType: "personal_income_deduction",
      cashReceiptNumber: "01011112222",
      name: "김하늘",
      residentRegistrationNumberToken: "9001011234567",
    },
    gateway: createMockCustomerGuardianProfileGateway([profile]),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: {
      cashReceiptNumber: expect.any(String),
      residentRegistrationNumberToken: expect.any(String),
    },
  });
});

test("guardian profile update normalizes fields and writes through the gateway", async () => {
  const gateway = createMockCustomerGuardianProfileGateway([profile], now);

  const result = await updateCustomerGuardianProfile({
    actorUserId: "user-front",
    guardianId: "guardian-a",
    workspaceId: "workspace-a",
    input: {
      additionalPhoneNumbers: ["010-3333-4444", "", "010-5555-6666"],
      cashReceiptNumber: "cash-receipt-demo-placeholder",
      cashReceiptType: "personal_income_deduction",
      email: " guardian.updated@example.test ",
      memo: "  수정 메모  ",
      name: " 김하늘 ",
      referralSources: ["homepage", "referral", "homepage"],
      residentRegistrationNumberMasked: "900101-1******",
      residentRegistrationNumberToken: "masked-demo-rrn-token",
    },
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    profile: {
      name: "김하늘",
      email: "guardian.updated@example.test",
      memo: "수정 메모",
      cashReceiptType: "personal_income_deduction",
      cashReceiptNumber: "cash-receipt-demo-placeholder",
      additionalPhoneNumbers: ["010-3333-4444", "010-5555-6666"],
      referralSources: ["homepage", "referral"],
    },
  });
});
