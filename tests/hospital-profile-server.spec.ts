import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import {
  createHospitalProfileChangeRequest,
  createMockHospitalProfileGateway,
  readHospitalProfile,
  updateHospitalContact,
  type HospitalProfile,
} from "@/features/hospital-admin/settings/server-hospital-profile-core";

const profile: HospitalProfile = {
  workspaceId: "clair-demo",
  name: "VIP동물의료센터 청담점",
  representativeName: "김청담",
  address: "서울 강남구 도산대로 000",
  countryCode: "KR",
  timezone: "Asia/Seoul",
  contact: {
    phone: "02-6203-7582",
    fax: "02-6203-7583",
    homepage: "",
    instagram: "",
    customerGuideMemo: "",
  },
  logo: { hasCustomLogo: false, url: null },
  revision: 1,
  profileComplete: true,
  pendingChangeRequest: null,
};

const permissions = createMockWorkspacePermissionAdapter({
  users: [
    { id: "admin", status: "active" },
    { id: "member", status: "active" },
  ],
  memberships: [
    { id: "m-admin", workspaceId: "clair-demo", userId: "admin", roles: ["hospital_admin"], status: "active" },
    { id: "m-member", workspaceId: "clair-demo", userId: "member", roles: ["front_desk"], status: "active" },
  ],
});

test("hospital profile core requires membership to read and manage permission to mutate", async () => {
  const gateway = createMockHospitalProfileGateway([profile]);

  await expect(
    readHospitalProfile({ actorUserId: null, workspaceId: "clair-demo", gateway, permissionAdapter: permissions })
  ).resolves.toMatchObject({ ok: false, status: 401, denialReason: "unauthenticated" });

  await expect(
    readHospitalProfile({ actorUserId: "member", workspaceId: "clair-demo", gateway, permissionAdapter: permissions })
  ).resolves.toMatchObject({ ok: true, profile: { workspaceId: "clair-demo" } });

  await expect(
    updateHospitalContact({
      actorUserId: "member",
      workspaceId: "clair-demo",
      gateway,
      permissionAdapter: permissions,
      input: { revision: 1, contact: profile.contact },
      requestId: "req-denied",
    })
  ).resolves.toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
});

test("hospital contact core returns readback and maps stale revision to 409", async () => {
  const gateway = createMockHospitalProfileGateway([profile]);
  const updated = await updateHospitalContact({
    actorUserId: "admin",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissions,
    input: {
      revision: 1,
      contact: { ...profile.contact, customerGuideMemo: "주차는 건물 뒤편을 이용해 주세요." },
    },
    requestId: "req-update",
  });
  expect(updated).toMatchObject({
    ok: true,
    profile: { revision: 2, contact: { customerGuideMemo: "주차는 건물 뒤편을 이용해 주세요." } },
  });

  await expect(
    updateHospitalContact({
      actorUserId: "admin",
      workspaceId: "clair-demo",
      gateway,
      permissionAdapter: permissions,
      input: { revision: 1, contact: profile.contact },
      requestId: "req-stale",
    })
  ).resolves.toEqual({ ok: false, status: 409, error: "hospital_profile_stale" });
});

test("registered-information request is workspace scoped and gateway failures are redacted", async () => {
  const gateway = createMockHospitalProfileGateway([profile]);
  const created = await createHospitalProfileChangeRequest({
    actorUserId: "admin",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissions,
    input: { fields: ["hospital_name", "address"], detail: "사업자 등록 정보와 동일하게 변경해 주세요." },
    requestId: "req-change",
  });
  expect(created).toMatchObject({
    ok: true,
    request: { fields: ["hospital_name", "address"], status: "pending" },
  });

  await expect(
    readHospitalProfile({
      actorUserId: "admin",
      workspaceId: "clair-demo",
      permissionAdapter: permissions,
      gateway: {
        async read() {
          return { ok: false, error: "db_read_failed" };
        },
        async updateContact() {
          throw new Error("raw sql error should not escape");
        },
        async createChangeRequest() {
          throw new Error("raw sql error should not escape");
        },
      },
    })
  ).resolves.toEqual({ ok: false, status: 500, error: "db_read_failed" });
});

test("hospital profile routes enforce auth, strict input, permission, readback, and stale revision", async ({
  request,
}) => {
  const profileUrl =
    "/api/workspaces/clair-demo/hospital-admin/settings/profile";
  const requestUrl =
    "/api/workspaces/clair-demo/hospital-admin/settings/profile-change-requests";
  const adminHeaders = {
    "x-clair-demo-session-user-id": "user-admin",
  };

  expect((await request.get(profileUrl)).status()).toBe(401);

  const currentResponse = await request.get(profileUrl, {
    headers: adminHeaders,
  });
  expect(currentResponse.status()).toBe(200);
  const current = await currentResponse.json();
  expect(current.profile).toMatchObject({
    workspaceId: "clair-demo",
    revision: expect.any(Number),
  });

  const tampered = await request.patch(profileUrl, {
    headers: adminHeaders,
    data: {
      revision: current.profile.revision,
      workspaceId: "other-workspace",
      contact: current.profile.contact,
    },
  });
  expect(tampered.status()).toBe(400);
  await expect(tampered.json()).resolves.toMatchObject({
    error: "invalid_input",
    fieldErrors: { root: "unknown_field" },
  });

  const denied = await request.patch(profileUrl, {
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    data: {
      revision: current.profile.revision,
      contact: current.profile.contact,
    },
  });
  expect(denied.status()).toBe(403);

  const updated = await request.patch(profileUrl, {
    headers: adminHeaders,
    data: {
      revision: current.profile.revision,
      contact: { ...current.profile.contact, fax: "02-6203-7500" },
    },
  });
  expect(updated.status()).toBe(200);
  const updatedBody = await updated.json();
  expect(updatedBody.profile).toMatchObject({
    revision: current.profile.revision + 1,
    contact: { fax: "02-6203-7500" },
  });

  const stale = await request.patch(profileUrl, {
    headers: adminHeaders,
    data: {
      revision: current.profile.revision,
      contact: current.profile.contact,
    },
  });
  expect(stale.status()).toBe(409);
  await expect(stale.json()).resolves.toMatchObject({
    error: "hospital_profile_stale",
  });

  const requested = await request.post(requestUrl, {
    headers: adminHeaders,
    data: {
      fields: ["hospital_name"],
      detail: "사업자 등록 정보와 동일하게 변경해 주세요.",
    },
  });
  expect(requested.status()).toBe(201);
  await expect(requested.json()).resolves.toMatchObject({
    request: { fields: ["hospital_name"], status: "pending" },
  });
});

test("hospital profile mutation routes reject oversized bodies and return stable rate-limit shape", async ({
  request,
}) => {
  const requestUrl =
    "/api/workspaces/clair-demo/hospital-admin/settings/profile-change-requests";
  const headers = {
    "x-clair-demo-session-user-id": "user-admin",
    "x-forwarded-for": "hospital-profile-rate-test",
  };
  const oversized = await request.post(requestUrl, {
    headers,
    data: { fields: ["hospital_name"], detail: "가".repeat(9_000) },
  });
  expect(oversized.status()).toBe(413);
  await expect(oversized.json()).resolves.toEqual({
    ok: false,
    error: "request_too_large",
  });

  let limitedResponse;
  for (let index = 0; index < 61; index += 1) {
    limitedResponse = await request.post(requestUrl, {
      headers,
      data: {
        fields: ["address"],
        detail: `요청 ${index + 1}`,
      },
    });
  }
  expect(limitedResponse?.status()).toBe(429);
  await expect(limitedResponse!.json()).resolves.toMatchObject({
    ok: false,
    error: "rate_limited",
    retryAfterSeconds: expect.any(Number),
  });
});
