import { expect, test } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import {
  handleMembershipStatusGet,
} from "../src/app/api/workspaces/[workspaceId]/memberships/route";
import {
  createMembershipStatusRouteHarness,
  persistedMembershipStatusBody,
} from "./workspace-membership-status-harness";

const workspaceLive = "workspace-live";

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
  await page.route("**/api/workspaces/clair-demo/memberships", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(persistedMembershipStatusBody("clair-demo")),
    });
  });

  await page.goto("/login?next=%2Fw%2Fclair-demo%2Forders%3FmodulePanel%3Dopen%26aside%3Dclosed");
  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("button", { name: "병원구성원 관리" }).click();

  await expect(page.getByText("활성 2명")).toBeVisible();
  await expect(page.getByText("대기 1건")).toBeVisible();
  await expect(page.getByText("비활성 1명")).toBeVisible();
  await expect(page.getByText("pending@clair.local")).toBeVisible();
  await expect(page.getByText("old@clair.local")).toBeVisible();
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
