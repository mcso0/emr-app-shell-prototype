import { expect, test } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import * as membershipRoute from "../src/app/api/workspaces/[workspaceId]/memberships/route-core";
import {
  handleMembershipStatusGet,
} from "../src/app/api/workspaces/[workspaceId]/memberships/route-core";
import * as workspaceSession from "../src/features/auth/workspace-session";
import {
  createMembershipStatusRouteHarness,
  persistedMembershipStatusBody,
} from "./workspace-membership-status-harness";

const workspaceLive = "workspace-live";

test("membership status normalizes legacy soft-deleted rows to archived", () => {
  const normalizer = (workspaceSession as typeof workspaceSession & {
    normalizeWorkspaceMembershipStatus?: (status: string) => string;
    isArchivedMembershipStatus?: (status: string) => boolean;
  }).normalizeWorkspaceMembershipStatus;
  const isArchived = (workspaceSession as typeof workspaceSession & {
    isArchivedMembershipStatus?: (status: string) => boolean;
  }).isArchivedMembershipStatus;

  expect(normalizer).toBeDefined();
  expect(isArchived).toBeDefined();

  if (!normalizer || !isArchived) return;

  expect(normalizer("soft_deleted")).toBe("archived");
  expect(normalizer("archived")).toBe("archived");
  expect(isArchived("inactive")).toBe(false);
  expect(isArchived("soft_deleted")).toBe(true);
});

test("membership list query accepts includeArchived while retaining includeDeleted compatibility", () => {
  const resolveIncludeArchived = (membershipRoute as typeof membershipRoute & {
    resolveMembershipStatusIncludeArchived?: (url: string) => boolean;
  }).resolveMembershipStatusIncludeArchived;

  expect(resolveIncludeArchived).toBeDefined();

  if (!resolveIncludeArchived) return;

  expect(resolveIncludeArchived("http://test.local/memberships?includeArchived=true")).toBe(true);
  expect(resolveIncludeArchived("http://test.local/memberships?includeDeleted=true")).toBe(true);
  expect(resolveIncludeArchived("http://test.local/memberships")).toBe(false);
});

async function getMembershipStatus(
  request: APIRequestContext,
  options: { actor?: string; workspaceId?: string } = {}
) {
  return request.get(`/api/workspaces/${options.workspaceId ?? "workspace-a"}/memberships`, {
    headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
  });
}

test("workspace membership status route returns auth outcomes from the server contract", async ({
  request,
}) => {
  const unauthenticated = await getMembershipStatus(request);
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const denied = await getMembershipStatus(request, { actor: "user-vet" });
  expect(denied.status()).toBe(403);
  await expectJson(denied, { ok: false, denialReason: "permission_missing" });

  const admin = await getMembershipStatus(request, { actor: "user-admin" });
  expect(admin.status()).toBe(200);
  await expectJson(admin, {
    ok: true,
    memberships: [],
    invitations: [],
    enforcedBy: "workspace-membership-status-reader",
  });
});

test("workspace membership status route denies Supabase session without manage permission", async () => {
  const deps = createMembershipStatusRouteHarness("denied");

  const response = await handleMembershipStatusGet(
    new Request(`http://test.local/api/workspaces/${workspaceLive}/memberships`),
    { workspaceId: workspaceLive },
    deps
  );

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({ ok: false, denialReason: "permission_missing" })
  );
});

test("workspace membership status route fails closed when DB permission load fails", async () => {
  const deps = createMembershipStatusRouteHarness("fail");

  const response = await handleMembershipStatusGet(
    new Request(`http://test.local/api/workspaces/${workspaceLive}/memberships`),
    { workspaceId: workspaceLive },
    deps
  );

  expect(response.status).toBe(500);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({ ok: false, error: "db_read_failed" })
  );
});

test("workspace membership status route returns persisted rows for authorized Supabase session", async () => {
  const deps = createMembershipStatusRouteHarness("authorized");

  const response = await handleMembershipStatusGet(
    new Request(`http://test.local/api/workspaces/${workspaceLive}/memberships`),
    { workspaceId: workspaceLive },
    deps
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({
      ok: true,
      memberships: [
        expect.objectContaining({
          id: "membership-persisted",
          workspaceId: workspaceLive,
          userSessionId: "user-persisted",
          displayName: "Persisted Member",
        }),
      ],
      invitations: [],
      enforcedBy: "workspace-membership-status-reader",
    })
  );
});

test("workspace membership UI can render persisted status rows from server", async ({
  page,
}) => {
  await page.route("**/api/workspaces/clair-demo/memberships**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(persistedMembershipStatusBody("clair-demo")),
    });
  });

  await page.goto("/login?next=%2Fw%2Fclair-demo%2Forders%3FmodulePanel%3Dopen%26aside%3Dclosed");
  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByPlaceholder("이메일을 입력해주세요").fill("admin@clair.local");
  await page.getByPlaceholder("비밀번호를 입력해주세요").fill("local-pass-1");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "병원 구성원", exact: true }).click();

  await expect(page.getByRole("button", { name: /전체 4/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /초대 대기 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /비활성 1/ })).toBeVisible();
  await expect(page.locator("p:visible", { hasText: "pending@clair.local" }).first()).toBeVisible();
  await expect(page.locator("p:visible", { hasText: "old@clair.local" }).first()).toBeVisible();
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
