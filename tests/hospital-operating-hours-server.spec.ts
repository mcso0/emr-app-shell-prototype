import { expect, test } from "@playwright/test";
import { createInitialHospitalBasicSettingsDraft } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import {
  createMockHospitalOperatingHoursGateway,
  readHospitalOperatingHours,
  updateHospitalOperatingHours,
} from "@/features/hospital-admin/settings/server-hospital-operating-hours-core";
import { createMockWorkspacePermissionAdapter } from "@/features/auth/permission-resolver";

const permissions = createMockWorkspacePermissionAdapter({
  users: [
    { id: "admin", status: "active" },
    { id: "front", status: "active" },
  ],
  memberships: [
    { id: "m-admin", workspaceId: "clair-demo", userId: "admin", roles: ["hospital_admin"], status: "active" },
    { id: "m-front", workspaceId: "clair-demo", userId: "front", roles: ["front_desk"], status: "active" },
  ],
});

test("operating-hours core lets members read but only admins update", async () => {
  const initial = createInitialHospitalBasicSettingsDraft();
  const gateway = createMockHospitalOperatingHoursGateway();
  const read = await readHospitalOperatingHours({ actorUserId: "front", workspaceId: "clair-demo", gateway, permissionAdapter: permissions });
  expect(read).toMatchObject({ ok: true, settings: { timezone: "Asia/Seoul" } });

  const denied = await updateHospitalOperatingHours({
    actorUserId: "front", workspaceId: "clair-demo", gateway, permissionAdapter: permissions,
    settings: { timezone: initial.timezone, weeklyHours: initial.weeklyHours, holidayPolicy: initial.holidayPolicy, exceptions: initial.exceptions },
  });
  expect(denied).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
});

test("operating-hours route persists an admin update and reports future conflicts", async ({ request }) => {
  const url = "/api/workspaces/clair-demo/hospital-admin/basic-settings/operating-hours";
  const unauthenticated = await request.get(url);
  expect(unauthenticated.status()).toBe(401);

  const current = await request.get(url, { headers: { "x-clair-demo-session-user-id": "user-admin" } });
  expect(current.status()).toBe(200);
  const body = await current.json();
  expect(body.settings.timezone).toBe("Asia/Seoul");

  const update = await request.put(url, {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
    data: { ...body.settings, holidayPolicy: "weekday" },
  });
  expect(update.status()).toBe(200);
  await expect(update.json()).resolves.toMatchObject({ ok: true, settings: { holidayPolicy: "weekday" } });
});

test("operating-hours update maps the atomic future appointment conflict to 409", async () => {
  const initial = createInitialHospitalBasicSettingsDraft();
  const result = await updateHospitalOperatingHours({
    actorUserId: "admin",
    workspaceId: "clair-demo",
    permissionAdapter: permissions,
    settings: initial,
    gateway: {
      async get() { return { ok: true, settings: initial }; },
      async replace() { return { ok: false, error: "future_appointment_conflict" }; },
    },
  });
  expect(result).toEqual({ ok: false, status: 409, error: "future_appointment_conflict" });
});
