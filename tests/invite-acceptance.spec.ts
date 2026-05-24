import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
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
  await expect(
    page.getByRole("heading", { name: "계정 이메일 확인 후 워크스페이스에 입장" })
  ).toBeVisible();
  await expect(page.getByText("vet@hanbit.test", { exact: true })).toBeVisible();
  await expect(page.getByText("초대받은 이메일로 인증 코드를 확인하면")).toBeVisible();
  await expect(page.getByText("신규 계정으로 시작")).toHaveCount(0);
  await expect(page.getByText("기존 계정에 연결")).toHaveCount(0);
  await expect(page.getByText("staging Supabase")).toHaveCount(0);
  await expect(page.getByText("not_sent_approval_gated")).toHaveCount(0);

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
  await expect(page.getByText("신규 계정으로 시작")).toHaveCount(0);
  await expect(page.getByText("기존 계정에 연결")).toHaveCount(0);
  await expect(page.getByText("인증 코드 받기")).toHaveCount(0);

  await page.goto("/invite/invitation-canceled?workspaceId=workspace-a");
  await expect(page.getByRole("heading", { name: "취소된 초대입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" })).toHaveCount(0);
  await expect(page.getByText("신규 계정으로 시작")).toHaveCount(0);
  await expect(page.getByText("기존 계정에 연결")).toHaveCount(0);
  await expect(page.getByText("인증 코드 받기")).toHaveCount(0);

  await page.goto("/invite/invitation-accepted?workspaceId=workspace-a");
  await expect(page.getByRole("heading", { name: "이미 수락된 초대입니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "워크스페이스로 이동" })).toBeVisible();
  await expect(page.getByText("신규 계정으로 시작")).toHaveCount(0);
  await expect(page.getByText("기존 계정에 연결")).toHaveCount(0);
  await expect(page.getByText("인증 코드 받기")).toHaveCount(0);
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

test("invite account setup pages preserve invite context", async ({ page }) => {
  const invitePath =
    "/invite/invitation-pending?workspaceId=workspace-a&email=vet%40hanbit.test";

  await page.goto(
    `/login?reason=invite_email_otp&inviteEmail=vet%40hanbit.test&next=${encodeURIComponent(invitePath)}`
  );
  await expect(page.getByRole("heading", { name: "초대 이메일 인증" })).toBeVisible();
  await expect(page.getByTestId("auth-session-notice")).toContainText(
    "초대받은 이메일로 계속하세요."
  );
  await expect(page.getByLabel("이메일")).toHaveValue("vet@hanbit.test");

  await page.goto(
    `/login?reason=invite_existing_account&inviteEmail=vet%40hanbit.test&next=${encodeURIComponent(invitePath)}`
  );
  await expect(page.getByRole("heading", { name: "CLAiR EMR에 로그인" })).toBeVisible();
  await expect(page.getByTestId("auth-session-notice")).toContainText(
    "초대받은 이메일로 로그인하세요."
  );
  await expect(page.getByLabel("이메일")).toHaveValue("vet@hanbit.test");
  await expect(
    page.getByText("vet@hanbit.test 계정으로 로그인해야 이 초대를 수락할 수 있습니다.")
  ).toBeVisible();

  await page.goto(
    `/signup?reason=invite_new_account&inviteEmail=vet%40hanbit.test&next=${encodeURIComponent(invitePath)}`
  );
  await expect(page.getByRole("heading", { name: "초대 계정 생성 준비 중" })).toBeVisible();
  await expect(page.getByText("vet@hanbit.test")).toBeVisible();
  await expect(page.getByText("signup_not_ready")).toBeVisible();
  await expect(page.getByRole("link", { name: "기존 계정으로 로그인" })).toHaveAttribute(
    "href",
    new RegExp("/login\\?")
  );
  await expect(page.getByRole("link", { name: "초대 화면으로 돌아가기" })).toHaveAttribute(
    "href",
    /\/invite\/invitation-pending\?workspaceId=workspace-a&email=vet(@|%40)hanbit\.test/
  );
});

test("Supabase invite acceptance uses OTP-first handoff before server acceptance", async () => {
  const source = readFileSync("src/features/auth/invite-acceptance-screen.tsx", "utf8");

  expect(source).toContain("useAuthClient");
  expect(source).toContain("supabaseEmailMatchesInvite");
  expect(source).toContain("session.email");
  expect(source).toContain(
    "`/api/workspaces/${record.workspace.id}/invitations/${record.invitation.id}/accept`"
  );
  expect(source).toContain('denialReason === "active_membership_exists"');
  expect(source).toContain("현재 로그인한 계정은 이 초대 이메일과 일치하지 않습니다.");
  expect(source).toContain('reason: "invite_email_otp"');
  expect(source).toContain('reason: "invite_existing_account"');
  expect(source).toContain("인증 코드 받기");
  expect(source).toContain("이메일 인증 코드");
  expect(source).toContain("이메일 인증 후 비밀번호 설정");
  expect(source).toContain("워크스페이스로 이동");
  expect(source).not.toContain("신규 계정으로 시작");
  expect(source).not.toContain("기존 계정에 연결");
  expect(source).not.toContain("staging Supabase");
  expect(source).not.toContain("not_sent_approval_gated");
  expect(source).not.toContain("router.push(buildAccountPath(accountMode))");

  const supabaseBranch = source.slice(
    source.indexOf("if (usesSupabaseProvider)"),
    source.indexOf("const actorUserId = `invitee:${record.invitation.email}`")
  );

  expect(supabaseBranch).toContain("router.push(buildAccountPath())");
  expect(supabaseBranch).toContain("fetch(");
  expect(supabaseBranch).not.toContain("x-clair-demo-session-user-id");
});
