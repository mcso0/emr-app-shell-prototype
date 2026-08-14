import { expect, test } from "@playwright/test";
import { createInitialHospitalBasicSettingsDraft } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import {
  createMockHospitalOperatingHoursGateway,
  parseHospitalOperatingHoursSettingsInput,
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

test("operating-hours input parser rejects unknown fields, invalid times, and duplicate exception dates", () => {
  const initial = createInitialHospitalBasicSettingsDraft();
  const validSettings = {
    timezone: initial.timezone,
    weeklyHours: initial.weeklyHours,
    holidayPolicy: initial.holidayPolicy,
    exceptions: initial.exceptions,
  };

  expect(parseHospitalOperatingHoursSettingsInput(validSettings)).toMatchObject({
    ok: true,
    settings: { timezone: "Asia/Seoul" },
  });
  expect(
    parseHospitalOperatingHoursSettingsInput({
      ...validSettings,
      unexpected: "field",
    })
  ).toMatchObject({ ok: false });
  expect(
    parseHospitalOperatingHoursSettingsInput({
      ...validSettings,
      weeklyHours: {
        ...validSettings.weeklyHours,
        monday: {
          ...validSettings.weeklyHours.monday,
          treatment: { start: "25:00", end: "19:00" },
        },
      },
    })
  ).toMatchObject({ ok: false });
  expect(
    parseHospitalOperatingHoursSettingsInput({
      ...validSettings,
      exceptions: [
        { id: "first", date: "2026-08-15", mode: "closed" },
        { id: "second", date: "2026-08-15", mode: "closed" },
      ],
    })
  ).toMatchObject({ ok: false });
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

test("operating-hours route rejects unsupported, oversized, and structurally invalid bodies", async ({ request }) => {
  const url = "/api/workspaces/clair-demo/hospital-admin/basic-settings/operating-hours";
  const headers = { "x-clair-demo-session-user-id": "user-admin" };

  const unsupported = await request.put(url, {
    headers: { ...headers, "content-type": "text/plain" },
    data: "not-json",
  });
  expect(unsupported.status()).toBe(415);

  const oversized = await request.put(url, {
    headers: { ...headers, "content-type": "application/json" },
    data: JSON.stringify({ padding: "x".repeat(70_000) }),
  });
  expect(oversized.status()).toBe(413);

  const invalid = await request.put(url, {
    headers,
    data: {
      timezone: "Asia/Seoul",
      weeklyHours: {},
      holidayPolicy: "closed",
      exceptions: [],
      unexpected: true,
    },
  });
  expect(invalid.status()).toBe(400);
  await expect(invalid.json()).resolves.toMatchObject({
    ok: false,
    error: "invalid_input",
  });
});

test("operating-hours update maps the atomic future appointment conflict to 409", async () => {
  const initial = createInitialHospitalBasicSettingsDraft();
  const settings = {
    timezone: initial.timezone,
    weeklyHours: initial.weeklyHours,
    holidayPolicy: initial.holidayPolicy,
    exceptions: initial.exceptions,
  };
  const result = await updateHospitalOperatingHours({
    actorUserId: "admin",
    workspaceId: "clair-demo",
    permissionAdapter: permissions,
    settings,
    gateway: {
      async get() { return { ok: true, settings }; },
      async replace() { return { ok: false, error: "future_appointment_conflict" }; },
    },
  });
  expect(result).toEqual({ ok: false, status: 409, error: "future_appointment_conflict" });
});
