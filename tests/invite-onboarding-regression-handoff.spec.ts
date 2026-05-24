import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MOCK_AUTH_STORAGE_KEY } from "../src/features/auth/mock-session";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(
    ({ authKey, workspaceKey }) => {
      window.localStorage.removeItem(authKey);
      window.sessionStorage.removeItem(authKey);
      window.localStorage.removeItem(workspaceKey);
      window.sessionStorage.removeItem(workspaceKey);
    },
    {
      authKey: MOCK_AUTH_STORAGE_KEY,
      workspaceKey: SESSION_WORKSPACES_STORAGE_KEY,
    },
  );
});

test("accepted invite user can enter invited workspace but not another workspace", async ({
  page,
}) => {
  await page.goto(
    "/invite/invitation-pending?workspaceId=workspace-a&email=vet@hanbit.test",
  );
  await page.getByLabel("새 비밀번호").fill("local-pass-1");
  await page.getByLabel("비밀번호 확인").fill("local-pass-1");
  await page.getByRole("button", { name: "워크스페이스로 이동" }).click();
  await expect(page).toHaveURL(/\/w\/workspace-a\/reception/);

  await page.goto("/w/workspace-b/reception?modulePanel=open&aside=closed");

  await expect(page).toHaveURL(/\/login\?/);
  await expect(
    page.getByText("이 워크스페이스에 접근할 권한이 없습니다."),
  ).toBeVisible();
});

test("invite-based onboarding Project 04 handoff records scenarios blockers and tenant boundary inputs", () => {
  const handoff = readFileSync(
    "docs/engineering/auth-security/auth-login/invite-based-onboarding-regression-handoff.md",
    "utf8",
  );

  expect(handoff).toContain("Happy Path Regression");
  expect(handoff).toContain("Invalid Invite Regression");
  expect(handoff).toContain("Unauthorized Inviter Regression");
  expect(handoff).toContain("Workspace Isolation Smoke");
  expect(handoff).toContain("Project 04 Handoff");
  expect(handoff).toContain("production email delivery");
  expect(handoff).toContain("tenant boundary");
});
