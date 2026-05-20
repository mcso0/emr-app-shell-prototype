import { expect, test } from "@playwright/test";
import {
  MOCK_AUTH_STORAGE_KEY,
  type MockAuthSession,
} from "../src/features/auth/mock-session";
import {
  SESSION_WORKSPACES_STORAGE_KEY,
  type SessionWorkspacesState,
} from "../src/features/auth/workspace-session";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ authKey, workspaceKey }) => {
      window.localStorage.removeItem(authKey);
      window.sessionStorage.removeItem(authKey);
      window.localStorage.removeItem(workspaceKey);
      window.sessionStorage.removeItem(workspaceKey);
    },
    {
      authKey: MOCK_AUTH_STORAGE_KEY,
      workspaceKey: SESSION_WORKSPACES_STORAGE_KEY,
    }
  );
});

test("valid invite acceptance creates a mock account membership and redirects to workspace", async ({
  page,
}) => {
  await page.goto(
    "/invite/invitation-pending?workspaceId=workspace-a&email=vet@hanbit.test"
  );

  await expect(page.getByRole("heading", { name: "초대 수락" })).toBeVisible();
  await expect(page.getByText("vet@hanbit.test")).toBeVisible();
  await expect(page.getByText("신규 계정으로 시작")).toBeVisible();
  await expect(page.getByText("기존 계정에 연결")).toBeVisible();

  const acceptResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workspaces/workspace-a/invitations/invitation-pending/accept") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" }).click();
  expect((await acceptResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/w\/workspace-a\/reception/);

  const authSession = await page.evaluate((storageKey) => {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as MockAuthSession | null;
  }, MOCK_AUTH_STORAGE_KEY);
  expect(authSession).toMatchObject({
    id: "invitee:vet@hanbit.test",
    role: "vet",
    storageMode: "local",
  });

  const workspaceState = await page.evaluate((storageKey) => {
    return JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null"
    ) as SessionWorkspacesState | null;
  }, SESSION_WORKSPACES_STORAGE_KEY);
  expect(workspaceState?.currentWorkspaceId).toBe("workspace-a");
  expect(workspaceState?.memberships).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        workspaceId: "workspace-a",
        userSessionId: "invitee:vet@hanbit.test",
        email: "vet@hanbit.test",
        roles: ["vet"],
        status: "active",
      }),
    ])
  );
});

test("invalid invite acceptance states do not expose account creation actions", async ({
  page,
}) => {
  await page.goto("/invite/invitation-expired?workspaceId=workspace-a");
  await expect(page.getByRole("heading", { name: "초대가 만료되었습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" })).toHaveCount(0);

  await page.goto("/invite/invitation-canceled?workspaceId=workspace-a");
  await expect(page.getByRole("heading", { name: "취소된 초대입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" })).toHaveCount(0);

  await page.goto("/invite/invitation-accepted?workspaceId=workspace-a");
  await expect(page.getByRole("heading", { name: "이미 수락된 초대입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" })).toHaveCount(0);
});

test("unknown invite link is denied without creating local session state", async ({ page }) => {
  await page.goto("/invite/unknown-invitation?workspaceId=workspace-a");

  await expect(page.getByRole("heading", { name: "초대 링크를 확인할 수 없습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" })).toHaveCount(0);

  const storage = await page.evaluate(
    ({ authKey, workspaceKey }) => ({
      auth: window.localStorage.getItem(authKey),
      workspaces: window.localStorage.getItem(workspaceKey),
    }),
    {
      authKey: MOCK_AUTH_STORAGE_KEY,
      workspaceKey: SESSION_WORKSPACES_STORAGE_KEY,
    }
  );
  expect(storage.auth).toBeNull();
  expect(storage.workspaces).toBeNull();
});
