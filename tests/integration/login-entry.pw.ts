import { expect, test } from "@playwright/test";
const provider = "http://127.0.0.1:3224";
test.beforeEach(async ({ request }) => { await request.post(`${provider}/test/control`, { data: {} }); });

test("OTP requests existing accounts, preserves email and safe destination, verifies six digits", async ({ page, request }) => {
  await page.goto("/login?next=%2Ffind-id%3Ffrom%3Dotp");
  await page.getByLabel("이메일", { exact: true }).fill("login@example.test");
  await page.getByRole("button", { name: "OTP 로그인", exact: true }).click();
  await expect(page.getByLabel("이메일", { exact: true })).toHaveValue("login@example.test");
  await page.getByRole("button", { name: "인증번호 받기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "인증번호 입력" })).toBeVisible();
  await expect(page.getByLabel("인증번호", { exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: /다시 받기/ })).toBeDisabled();
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(calls.find((call: { path: string }) => call.path === "/auth/v1/otp")).toMatchObject({ createUser: false, email: "login@example.test" });
  expect(new URL(calls.find((call: { path: string }) => call.path === "/auth/v1/otp").redirectTo).pathname).toBe("/auth/login");
  await page.getByLabel("인증번호", { exact: true }).fill("12345");
  await expect(page.getByRole("button", { name: "확인하고 로그인" })).toBeDisabled();
  await page.getByLabel("인증번호", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "확인하고 로그인" }).click();
  await expect(page).toHaveURL(/\/find-id\?from=otp$/);
});

test("OTP invalid code, rate limit, resend and previous-code clearing", async ({ page, request }) => {
  await page.clock.install();
  await page.goto("/login?method=otp&next=%2Ffind-id");
  await page.getByLabel("이메일").fill("login@example.test");
  await page.getByRole("button", { name: "인증번호 받기" }).click();
  await page.getByLabel("인증번호").fill("99999999");
  await page.getByRole("button", { name: "확인하고 로그인" }).click();
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("만료되었거나");
  await page.clock.fastForward(61_000);
  await request.post(`${provider}/test/control`, { data: { sendError: "over_email_send_rate_limit" } });
  await page.getByRole("button", { name: "다시 받기", exact: true }).click();
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("요청이 많습니다");
  await expect(page.getByLabel("인증번호")).toHaveValue("99999999");
  await request.post(`${provider}/test/control`, { data: {} });
  await page.getByRole("button", { name: "다시 받기", exact: true }).click();
  await expect(page.getByLabel("인증번호")).toHaveValue("");
  await expect(page.getByLabel("인증번호")).toBeFocused();
  await page.getByLabel("인증번호").fill("12345678");
  await expect(page.getByRole("button", { name: "확인하고 로그인" })).toBeEnabled();
  await page.getByRole("button", { name: "확인하고 로그인" }).click();
  await expect(page).toHaveURL(/\/find-id$/);
});

test("OTP send failure is retryable and unknown account copy stays neutral", async ({ page, request }) => {
  await request.post(`${provider}/test/control`, { data: { sendError: "over_email_send_rate_limit" } });
  await page.goto("/login?method=otp");
  await page.getByLabel("이메일").fill("missing@example.test");
  await page.getByRole("button", { name: "인증번호 받기" }).click();
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("요청이 많습니다");
  await request.post(`${provider}/test/control`, { data: { sendError: "otp_disabled" } });
  await page.getByRole("button", { name: "인증번호 받기" }).click();
  await expect(page.getByText(/가입된 이메일이라면/)).toBeVisible();
});

test("invite still explicitly allows account creation after its guarded request", async ({ page, request }) => {
  await page.route("**/api/auth/invite-otp/request", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.goto("/login?reason=invite_email_otp&inviteEmail=invite%40example.test&next=%2Finvite%2Fsynthetic%3FworkspaceId%3Dsynthetic%26email%3Dinvite%2540example.test");
  await page.getByRole("button", { name: "인증 코드 받기" }).click();
  await expect(page.getByText("인증 코드를 보냈습니다.")).toBeVisible();
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(calls.find((call: { path: string }) => call.path === "/auth/v1/otp")).toMatchObject({ createUser: true });
  await expect(page.getByLabel("이메일")).toHaveAttribute("readonly", "");
  await expect(page.locator('[data-slot="input-otp-slot"]')).toHaveCount(8);
});

test("ID recovery reports missing verification and never calls a provider", async ({ page, request }) => {
  await page.goto("/find-id");
  await expect(page.getByRole("button", { name: "인증번호 받기" })).toBeDisabled();
  await page.getByLabel("휴대전화번호").fill("010-0000-0000");
  await expect(page.getByRole("button", { name: "인증번호 받기" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("본인확인 서비스를 준비");
  expect(await (await request.get(`${provider}/test/calls`)).json()).toHaveLength(0);
});

test("password recovery validates format, returns neutral result and separate callback", async ({ page, request }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("button", { name: "재설정 메일 요청" })).toBeDisabled();
  await page.getByLabel("로그인 이메일").fill("wrong");
  await expect(page.getByRole("button", { name: "재설정 메일 요청" })).toBeDisabled();
  await page.getByLabel("로그인 이메일").fill(" missing@example.test ");
  await page.getByRole("button", { name: "재설정 메일 요청" }).click();
  await expect(page.getByRole("status")).toContainText("가입된 이메일이라면");
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  const recovery = calls.find((call: { path: string }) => call.path === "/auth/v1/recover");
  expect(recovery.email).toBe("missing@example.test");
  expect(new URL(recovery.redirectTo).pathname).toBe("/auth/password-recovery");
  await expect(page.getByRole("button", { name: /다시 요청/ })).toBeDisabled();
});

test("password recovery rejects ordinary OTP sessions and invalid links", async ({ page, context, request }) => {
  const session = await (await request.get(`${provider}/test/session`)).json();
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
  await page.goto("/reset-password/update");
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("만료되었거나");
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toHaveCount(0);
  expect((await context.request.post("/api/users/me/password/recovery", { headers: { origin: "http://127.0.0.1:3223" }, data: { password: "synthetic-new-password", confirmation: "synthetic-new-password" } })).status()).toBe(403);
  await page.goto("/reset-password?error=expired");
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("링크를 확인할 수 없습니다");
});

test("provider-confirmed recovery enforces matching password, saves and signs out", async ({ page, context, request }) => {
  await request.post(`${provider}/test/control`, { data: { recovery: true } });
  const session = await (await request.get(`${provider}/test/session`)).json();
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
  await page.goto("/reset-password/update");
  const save = page.getByRole("button", { name: "새 비밀번호 저장" });
  await expect(save).toBeDisabled();
  await page.getByLabel("새 비밀번호", { exact: true }).fill("short");
  await page.getByLabel("새 비밀번호 확인").fill("short");
  await expect(save).toBeDisabled();
  await page.getByLabel("새 비밀번호", { exact: true }).fill("synthetic-new-password");
  await expect(save).toBeDisabled();
  await page.getByLabel("새 비밀번호 확인").fill("synthetic-new-password");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("status")).toContainText("비밀번호를 변경했습니다.");
  expect((await context.cookies()).filter(cookie => cookie.name === "sb-127-auth-token" && cookie.value)).toHaveLength(0);
  await page.getByRole("link", { name: "로그인으로 돌아가기" }).click();
  await expect(page.getByTestId("auth-session-notice")).toContainText("새 비밀번호로 다시 로그인");
});

test("OTP callback accepts PKCE link and rejects unsafe next and invalid link", async ({ page }) => {
  await page.goto("/login?method=otp");
  await page.getByLabel("이메일").fill("login@example.test");
  await page.getByRole("button", { name: "인증번호 받기" }).click();
  await expect(page.getByRole("heading", { name: "인증번호 입력" })).toBeVisible();
  await page.goto("/auth/login?code=synthetic-code&next=%2Ffind-id%3Ffrom%3Dlink");
  await expect(page).toHaveURL(/\/find-id\?from=link$/);
  await page.goto("/auth/login?next=%2F%5Cevil.example");
  await expect(page).toHaveURL(/reason=otp_link_invalid/);
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("로그인 링크가 만료");
  expect(new URL(page.url()).searchParams.get("next")).toBe("/w/workspace-clair-cheongdam/reception?modulePanel=open&aside=closed");
});

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`entry screens fit ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of ["/login", "/login?method=otp", "/find-id", "/reset-password", "/reset-password/update"]) {
      await page.goto(route);
      await expect(page.getByTestId("auth-entry-panel")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test("changing OTP email retains a visible resend cooldown", async ({ page }) => {
  await page.clock.install();
  await page.goto("/login?method=otp");
  await page.getByLabel("이메일").fill("login@example.test");
  await page.getByRole("button", { name: "인증번호 받기" }).click();
  await page.getByRole("button", { name: "다른 이메일로 받기" }).click();
  await page.getByLabel("이메일").fill("other@example.test");
  await expect(page.getByRole("button", { name: "인증번호 받기" })).toBeDisabled();
  await expect(page.getByText(/다시 요청하려면/)).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(page.getByRole("button", { name: "인증번호 받기" })).toBeEnabled();
});

test("recovery network failure and provider rejection remain retryable", async ({ page, request, context }) => {
  await request.post(`${provider}/test/control`, { data: { recoverError: true } });
  await page.goto("/reset-password");
  await page.getByLabel("로그인 이메일").fill("login@example.test");
  await page.getByRole("button", { name: "재설정 메일 요청" }).click();
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("요청이 많습니다");
  await expect(page.getByRole("button", { name: "재설정 메일 요청" })).toBeEnabled();
  await request.post(`${provider}/test/control`, { data: { recovery: true, updateError: true } });
  const session = await (await request.get(`${provider}/test/session`)).json();
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
  await page.route("**/api/users/me/password/recovery", async route => {
    if (route.request().method() === "GET") { await route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); return; }
    await route.continue();
  });
  await page.goto("/reset-password/update");
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("링크를 확인하지 못했습니다");
  await page.unroute("**/api/users/me/password/recovery");
  await page.getByRole("button", { name: "다시 확인" }).click();
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toBeEnabled();
  await page.getByLabel("새 비밀번호", { exact: true }).fill("synthetic-new-password");
  await page.getByLabel("새 비밀번호 확인").fill("synthetic-new-password");
  await page.getByRole("button", { name: "새 비밀번호 저장" }).click();
  await expect(page.getByTestId("auth-entry-panel").getByRole("alert")).toContainText("비밀번호를 변경하지 못했습니다");
  await expect(page.getByRole("button", { name: "새 비밀번호 저장" })).toBeEnabled();
});

test("OTP submission blocks duplicate requests while pending", async ({ page, request }) => {
  await request.post(`${provider}/test/control`, { data: { delayMs: 200 } });
  await page.goto("/login?method=otp");
  await page.getByLabel("이메일").fill("login@example.test");
  const form = page.getByTestId("auth-entry-panel").locator("form");
  await form.dispatchEvent("submit");
  await form.dispatchEvent("submit");
  await expect(page.getByRole("heading", { name: "인증번호 입력" })).toBeVisible();
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(calls.filter((call: { path: string }) => call.path === "/auth/v1/otp")).toHaveLength(1);
});
