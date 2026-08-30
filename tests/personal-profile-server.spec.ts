import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

async function patchProfile(
  request: APIRequestContext,
  options: { actor?: string; body?: Record<string, unknown> } = {}
) {
  return request.patch("/api/users/me/profile", {
    headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
    data: options.body ?? {
      displayName: "김승욱",
      initials: "SW",
      phone: "010-1234-5678",
      notificationOptIn: true,
    },
  });
}

test("personal profile read stays authenticated, live-only, and private no-store", async ({
  request,
}) => {
  const unauthenticated = await request.get("/api/users/me/profile");
  expect(unauthenticated.status()).toBe(401);
  expect(unauthenticated.headers()["cache-control"]).toContain("private");
  expect(unauthenticated.headers()["cache-control"]).toContain("no-store");

  const mockMode = await request.get("/api/users/me/profile", {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });
  expect(mockMode.status()).toBe(503);
  await expectJson(mockMode, {
    ok: false,
    error: "configured_data_source_required",
  });
});

test("personal profile route saves editable fields and rejects authority fields", async ({
  request,
}) => {
  const unauthenticated = await patchProfile(request);
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const saved = await patchProfile(request, { actor: "user-admin" });
  expect(saved.status()).toBe(200);
  await expectJson(saved, {
    ok: true,
    profile: {
      sessionId: "user-admin",
      displayName: "김승욱",
      initials: "SW",
      phone: "010-1234-5678",
      notificationOptIn: true,
    },
    enforcedBy: "personal-profile-server-route",
  });

  const forbidden = await patchProfile(request, {
    actor: "user-admin",
    body: {
      displayName: "권한 상승",
      initials: "UP",
      roles: ["hospital_admin"],
    },
  });
  expect(forbidden.status()).toBe(400);
  await expectJson(forbidden, {
    ok: false,
    denialReason: "profile_authority_field_forbidden",
  });
});

test("personal profile route defines DB persistence without auth authority fields", () => {
  const routeSource = readFileSync("src/app/api/users/me/profile/route.ts", "utf8");
  const serverSource = readFileSync("src/features/auth/server-personal-profile.ts", "utf8");
  const migrationSource = readFileSync(
    "supabase/migrations/20260518130000_personal_profile_persistence.sql",
    "utf8"
  );

  expect(routeSource).toContain("savePersonalProfile");
  expect(routeSource).toContain("readPersonalProfile");
  expect(routeSource).toContain('"Cache-Control": "private, no-store"');
  expect(serverSource).toContain('import "server-only"');
  expect(serverSource).toContain("avatar_storage_path");
  expect(serverSource).toContain("resolveProfileAvatarUrl");
  expect(serverSource).not.toMatch(/role_permission|membership|permissions/);
  expect(migrationSource).toContain("clair_save_personal_profile");
  expect(migrationSource).toContain("notification_preferences");
  expect(migrationSource).not.toMatch(/role_permission|membership|permissions|service_role|db_password/i);
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(shape);
}
