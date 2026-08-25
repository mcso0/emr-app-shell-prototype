import { expect, test } from "@playwright/test";
import type { AuthSession } from "../src/features/auth/auth-client";
import { resolveReceptionMockAssigneeUserId } from "../src/features/reception/reception-assignee";

test("reception defaults the assignee from mock and synthetic Supabase identities", () => {
  const mockAdminSession: AuthSession = {
    id: "mock-admin",
    issuedAt: "2026-08-25T00:00:00.000Z",
    role: "hospital_admin",
    roleLabel: "병원 관리자",
    storageMode: "local",
  };
  const supabaseAdminSession: AuthSession = {
    email: "admin@clair.local",
    id: "supabase-session-admin",
    issuedAt: "2026-08-25T00:00:00.000Z",
    provider: "supabase",
    role: "supabase",
    roleLabel: "admin@clair.local",
    storageMode: "cookie",
    userId: "admin",
  };
  const unknownSupabaseSession: AuthSession = {
    ...supabaseAdminSession,
    email: "unknown@clair.local",
    id: "supabase-session-unknown",
    roleLabel: "unknown@clair.local",
    userId: "unknown",
  };

  expect(resolveReceptionMockAssigneeUserId(mockAdminSession)).toBe(
    "user-admin-minjae",
  );
  expect(resolveReceptionMockAssigneeUserId(supabaseAdminSession)).toBe(
    "user-admin-minjae",
  );
  expect(resolveReceptionMockAssigneeUserId(unknownSupabaseSession)).toBeUndefined();
  expect(resolveReceptionMockAssigneeUserId(null)).toBeUndefined();
});
