import { expect, test } from "@playwright/test";

import {
  demoClientSessionIdHeader,
  demoSessionUserIdHeader,
  getDemoActorHeaders,
  getDemoActorUserId,
} from "../src/features/auth/demo-actor";
import type { AuthSession } from "../src/features/auth/auth-client";

function mockSession(role: AuthSession["role"], id = "random-mock-session"): AuthSession {
  if (role === "supabase") {
    return {
      provider: "supabase",
      id,
      userId: id,
      email: "demo@example.test",
      role,
      roleLabel: "Supabase 사용자",
      storageMode: "cookie",
      issuedAt: "2026-05-27T00:00:00.000Z",
    };
  }

  return {
    id,
    role,
    roleLabel: role,
    storageMode: "local",
    issuedAt: "2026-05-27T00:00:00.000Z",
  };
}

test("demo actor headers map random mock sessions to server fixture users", () => {
  expect(getDemoActorUserId(mockSession("hospital_admin"))).toBe("user-admin");
  expect(getDemoActorUserId(mockSession("vet"))).toBe("user-vet");
  expect(getDemoActorUserId(mockSession("front_desk"))).toBe("user-front-desk");
  expect(getDemoActorUserId(mockSession("nurse"))).toBe("user-tech");
  expect(getDemoActorUserId(mockSession("billing_admin"))).toBe("user-tech");
  expect(getDemoActorUserId(mockSession("supabase"))).toBeNull();
});

test("demo actor headers omit Supabase sessions and include mapped demo header", () => {
  expect(getDemoActorHeaders(mockSession("supabase"))).toBeUndefined();
  const headers = getDemoActorHeaders(mockSession("vet")) as Record<string, string>;
  expect(headers[demoSessionUserIdHeader]).toBe("user-vet");
  expect(headers[demoClientSessionIdHeader]).toBeTruthy();
});
