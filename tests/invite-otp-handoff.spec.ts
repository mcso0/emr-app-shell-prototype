import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const inviteNext =
  "/invite/invitation-pending?workspaceId=workspace-a&email=vet%40hanbit.test";

test("invite OTP request validates pending invite email and safe next", async ({ request }) => {
  const accepted = await request.post("/api/auth/invite-otp/request", {
    data: {
      email: "vet@hanbit.test",
      next: inviteNext,
    },
  });

  expect(accepted.status()).toBe(200);
  const acceptedBody = await accepted.json();
  expect(acceptedBody).toMatchObject({
    ok: true,
    delivery: "mock",
    email: "vet@hanbit.test",
    next: inviteNext,
  });
  expect(JSON.stringify(acceptedBody)).not.toMatch(/exists|not_found|user_missing/i);

  const mismatched = await request.post("/api/auth/invite-otp/request", {
    data: {
      email: "other@hanbit.test",
      next: inviteNext,
    },
  });
  expect(mismatched.status()).toBe(409);
  expect(await mismatched.json()).toMatchObject({
    ok: false,
    denialReason: "invite_email_mismatch",
  });

  const unsafe = await request.post("/api/auth/invite-otp/request", {
    data: {
      email: "vet@hanbit.test",
      next: "https://evil.example/steal",
    },
  });
  expect(unsafe.status()).toBe(400);

  const expired = await request.post("/api/auth/invite-otp/request", {
    data: {
      email: "expired@hanbit.test",
      next: "/invite/invitation-expired?workspaceId=workspace-a&email=expired%40hanbit.test",
    },
  });
  expect(expired.status()).toBe(409);
});

test("invite OTP login locks email and returns to invite after mock verification", async ({ page }) => {
  await page.goto(
    `/login?reason=invite_email_otp&inviteEmail=vet%40hanbit.test&next=${encodeURIComponent(
      inviteNext
    )}`
  );

  await expect(page.getByRole("heading", { name: "초대 이메일 인증" })).toBeVisible();
  await expect(page.getByTestId("auth-session-notice")).toContainText(
    "초대받은 이메일로 계속하세요."
  );
  await expect(page.getByLabel("이메일")).toHaveValue("vet@hanbit.test");
  await expect(page.getByLabel("이메일")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("비밀번호")).toHaveCount(0);

  await page.getByRole("button", { name: "인증 코드 받기" }).click();

  await expect(page.getByText("인증 코드를 보냈습니다.")).toBeVisible();
  await expect(page.getByText("데모 인증 코드: 000000")).toBeVisible();
  await page.getByLabel("인증 코드").fill("000000");
  await page.getByRole("button", { name: "인증하고 초대 화면으로 돌아가기" }).click();

  await expect(page).toHaveURL(/\/invite\/invitation-pending/);
  expect(new URL(page.url()).searchParams.get("email")).toBe("vet@hanbit.test");
});

test("invite OTP implementation keeps Supabase and redirect boundaries explicit", () => {
  const authClient = readFileSync("src/features/auth/auth-client.ts", "utf8");
  const loginForm = readFileSync("src/features/auth/login-form.tsx", "utf8");
  const requestRoute = readFileSync("src/app/api/auth/invite-otp/request/route.ts", "utf8");
  const requestCore = readFileSync("src/features/auth/server-invite-otp-request.ts", "utf8");
  const confirmRoute = readFileSync("src/app/auth/confirm/route.ts", "utf8");

  expect(authClient).toContain("signInWithOtp");
  expect(authClient).toContain("verifyOtp");
  expect(loginForm).toContain("reason === \"invite_email_otp\"");
  expect(loginForm).toContain("signInWithEmailOtp");
  expect(loginForm).toContain("verifyEmailOtp");
  expect(requestCore).toContain("getSafeInviteNextHref");
  expect(requestRoute).toContain("resolveInviteOtpRequest");
  expect(confirmRoute).toContain("token_hash");
  expect(confirmRoute).toContain("verifyOtp");
  expect(confirmRoute).toContain("getSafeInviteNextHref");
  expect(`${authClient}\n${requestRoute}\n${confirmRoute}`).not.toMatch(
    /service_role|SUPABASE_SECRET/i
  );
});
