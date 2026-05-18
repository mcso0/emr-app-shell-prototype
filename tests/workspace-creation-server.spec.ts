import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

async function postWorkspaceCreation(
  request: APIRequestContext,
  options: {
    actor?: string;
    hospitalName?: string;
    adminDisplayName?: string;
    contactEmail?: string;
    contactPhone?: string;
  } = {}
) {
  return request.post("/api/workspaces", {
    headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
    data: {
      hospitalName: options.hospitalName ?? "Hanbit Animal Hospital",
      adminDisplayName: options.adminDisplayName ?? "김승욱",
      contactEmail: options.contactEmail ?? "owner@hanbit.test",
      contactPhone: options.contactPhone ?? "010-1234-5678",
    },
  });
}

test("workspace creation server route creates workspace and creator admin in mock fallback", async ({
  request,
}) => {
  const response = await postWorkspaceCreation(request, { actor: "user-admin" });

  expect(response.status()).toBe(201);
  await expectJson(response, {
    ok: true,
    workspace: {
      id: "hanbit-animal-hospital",
      displayName: "Hanbit Animal Hospital",
      representativeName: "김승욱",
      contactEmail: "owner@hanbit.test",
    },
    membership: {
      workspaceId: "hanbit-animal-hospital",
      userSessionId: "user-admin",
      roles: ["hospital_admin"],
      status: "active",
    },
    enforcedBy: "workspace-creation-server-route",
  });
});

test("workspace creation server route denies missing actor and invalid input", async ({
  request,
}) => {
  const unauthenticated = await postWorkspaceCreation(request);
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const invalidInput = await postWorkspaceCreation(request, {
    actor: "user-admin",
    hospitalName: "",
    adminDisplayName: "",
    contactEmail: "not-an-email",
  });
  expect(invalidInput.status()).toBe(400);
  await expectJson(invalidInput, {
    ok: false,
    error: "invalid_input",
    fieldErrors: {
      hospitalName: "병원/워크스페이스 이름을 입력하세요.",
      adminDisplayName: "대표/관리자 이름을 입력하세요.",
      contactEmail: "올바른 이메일 형식으로 입력하세요.",
    },
  });
});

test("workspace creation route stays server-owned and defines local DB transaction RPC", () => {
  const routeSource = readFileSync("src/app/api/workspaces/route.ts", "utf8");
  const gatewaySource = readFileSync(
    "src/features/auth/server-workspace-creation.ts",
    "utf8"
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260518120000_workspace_creation_transaction.sql",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("createWorkspaceWithCreator");
  expect(gatewaySource).toContain('import "server-only"');
  expect(gatewaySource).not.toMatch(/service_role|sb_secret|SUPABASE_SECRET/);
  expect(migrationSource).toContain("create or replace function public.clair_create_workspace_with_creator");
  expect(migrationSource).toContain("security definer");
  expect(migrationSource).toContain("auth.uid()");
  expect(migrationSource).toContain("grant execute on function public.clair_create_workspace_with_creator");
  expect(migrationSource).not.toMatch(/service_role|sb_secret|SUPABASE_SECRET/);
});

async function expectJson(response: APIResponse, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
