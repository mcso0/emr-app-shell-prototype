import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readServerSessionFromSupabase } from "../src/features/auth/server-session-contract";

test("server session reader returns mock mode without touching Supabase when auth mode is mock", async () => {
  let claimsCalls = 0;

  const result = await readServerSessionFromSupabase({
    authMode: "mock",
    hasSupabasePublicConfig: true,
    getClaims: async () => {
      claimsCalls += 1;
      return { data: null, error: null };
    },
  });

  expect(result).toEqual({
    ok: false,
    status: "mock_mode",
    reason: "mock_mode",
    sessionUserId: null,
    source: "mock_fallback",
  });
  expect(claimsCalls).toBe(0);
});

test("server session reader keeps auto mode in mock fallback when Supabase public env is missing", async () => {
  const result = await readServerSessionFromSupabase({
    authMode: "auto",
    hasSupabasePublicConfig: false,
  });

  expect(result).toMatchObject({
    ok: false,
    status: "mock_mode",
    reason: "supabase_env_missing_auto_fallback",
    sessionUserId: null,
  });
});

test("server session reader reports misconfigured Supabase mode without public env", async () => {
  const result = await readServerSessionFromSupabase({
    authMode: "supabase",
    hasSupabasePublicConfig: false,
  });

  expect(result).toMatchObject({
    ok: false,
    status: "misconfigured",
    reason: "supabase_env_missing",
    sessionUserId: null,
  });
});

test("server session reader returns verified user identity from Supabase claims", async () => {
  const result = await readServerSessionFromSupabase({
    authMode: "supabase",
    hasSupabasePublicConfig: true,
    getClaims: async () => ({
      data: {
        claims: {
          sub: "user-live-123",
          email: "vet@example.test",
          role: "authenticated",
          aal: "aal1",
          session_id: "session-123",
        },
      },
      error: null,
    }),
  });

  expect(result).toEqual({
    ok: true,
    status: "authenticated",
    sessionUserId: "user-live-123",
    email: "vet@example.test",
    role: "authenticated",
    aal: "aal1",
    sessionId: "session-123",
    source: "supabase_claims",
  });
});

test("server session reader maps missing session and malformed claims to typed denials", async () => {
  await expect(
    readServerSessionFromSupabase({
      authMode: "supabase",
      hasSupabasePublicConfig: true,
      getClaims: async () => ({
        data: null,
        error: { name: "AuthSessionMissingError", message: "Auth session missing" },
      }),
    })
  ).resolves.toMatchObject({
    ok: false,
    status: "unauthenticated",
    reason: "no_session",
    sessionUserId: null,
  });

  await expect(
    readServerSessionFromSupabase({
      authMode: "supabase",
      hasSupabasePublicConfig: true,
      getClaims: async () => ({
        data: { claims: { email: "missing-sub@example.test" } },
        error: null,
      }),
    })
  ).resolves.toMatchObject({
    ok: false,
    status: "unauthenticated",
    reason: "subject_missing",
    sessionUserId: null,
  });
});

test("server session reader entrypoint is server-only and avoids browser storage or getSession trust", () => {
  const serverSource = readFileSync("src/features/auth/server-session-reader.ts", "utf8");
  const contractSource = readFileSync("src/features/auth/server-session-contract.ts", "utf8");

  expect(serverSource).toContain('import "server-only"');
  expect(serverSource).toContain("getClaims");
  expect(serverSource).not.toMatch(/getSession\(/);

  for (const source of [serverSource, contractSource]) {
    expect(source).not.toMatch(/sessionStorage|localStorage|window\./);
  }
});
