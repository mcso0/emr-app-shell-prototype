import { test, expect } from "@playwright/test";
import { defaultNotificationPreferences } from "../../src/features/notifications/notification-preferences";
const provider = "http://127.0.0.1:43113";
const origin = "http://127.0.0.1:43114";
const userId = "91000000-0000-4000-8000-000000000001";
const validPassword = {
  currentPassword: "synthetic-current-password",
  password: "synthetic-new-password",
  confirmation: "synthetic-new-password",
};
test.beforeEach(async ({ context, request }) => {
  await request.post(`${provider}/test/control`, { data: {} });
  const session = await (await request.get(`${provider}/test/session`)).json();
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
});
test("wrong current password never reaches password update", async ({
  context,
  request,
}) => {
  const result = await context.request.post("/api/users/me/password", {
    headers: { origin },
    data: { ...validPassword, currentPassword: "synthetic-wrong-password" },
  });
  expect(result.status()).toBe(400);
  expect((await result.json()).message).toContain("현재 비밀번호");
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(
    calls.filter((call: { method: string }) => call.method === "PUT"),
  ).toHaveLength(0);
});
test("verified identity must equal the original session identity", async ({
  context,
  request,
}) => {
  await request.post(`${provider}/test/control`, { data: { wrongUser: true } });
  const result = await context.request.post("/api/users/me/password", {
    headers: { origin },
    data: validPassword,
  });
  expect(result.status()).toBe(400);
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(
    calls.filter((call: { method: string }) => call.method === "PUT"),
  ).toHaveLength(0);
});
test("verified change updates through provider and closes temporary and original sessions", async ({
  context,
  request,
}) => {
  const result = await context.request.post("/api/users/me/password", {
    headers: { origin },
    data: validPassword,
  });
  expect(result.status()).toBe(200);
  expect(await result.json()).toEqual({ ok: true });
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(
    calls.find((call: { method: string }) => call.method === "PUT"),
  ).toMatchObject({ path: "/auth/v1/user", currentPasswordProvided: true });
  expect(
    calls.filter((call: { path: string }) => call.path === "/auth/v1/logout"),
  ).toHaveLength(2);
  expect(
    (await context.cookies()).filter(
      (cookie) => cookie.name === "sb-127-auth-token" && cookie.value,
    ),
  ).toHaveLength(0);
});
test("provider update errors never report success", async ({
  context,
  request,
}) => {
  await request.post(`${provider}/test/control`, {
    data: { failUpdate: true },
  });
  const result = await context.request.post("/api/users/me/password", {
    headers: { origin },
    data: validPassword,
  });
  expect(result.status()).toBe(400);
  expect((await result.json()).ok).toBe(false);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "sb-127-auth-token" && cookie.value,
    ),
  ).toBe(true);
});
test("preferences persist for the session user and requested workspace only", async ({
  context,
  request,
}) => {
  const alpha =
    "/api/workspaces/settings-alpha/members/me/notification-preferences";
  const beta =
    "/api/workspaces/settings-beta/members/me/notification-preferences";
  const initial = await context.request.get(alpha);
  expect(initial.status()).toBe(200);
  expect((await initial.json()).preferences).toEqual(
    defaultNotificationPreferences(),
  );
  const updated = {
    ...defaultNotificationPreferences(),
    popup: false,
    sound: true,
  };
  expect((await context.request.patch(alpha, { data: updated })).status()).toBe(
    200,
  );
  expect((await (await context.request.get(alpha)).json()).preferences).toEqual(
    updated,
  );
  expect((await (await context.request.get(beta)).json()).preferences).toEqual(
    defaultNotificationPreferences(),
  );
  expect(
    (
      await context.request.patch(alpha, {
        data: { ...updated, userId: "foreign" },
      })
    ).status(),
  ).toBe(400);
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(
    calls.find(
      (call: { path: string; method: string }) =>
        call.path.endsWith("/workspace_notification_preferences") &&
        call.method === "POST",
    ),
  ).toMatchObject({ userId, workspaceId: "settings-alpha" });
});
test("inactive membership or user cannot read default preferences", async ({
  context,
  request,
}) => {
  for (const control of [{ inactive: true }, { inactiveUser: true }]) {
    await request.post(`${provider}/test/control`, { data: control });
    expect(
      (
        await context.request.get(
          "/api/workspaces/settings-alpha/members/me/notification-preferences",
        )
      ).status(),
    ).toBe(403);
  }
});
test("live profile uses canonical data and all three categories render without overflow", async ({
  page,
}) => {
  await page.route("**/api/users/me/profile", (route) =>
    route.fulfill({
      json: {
        ok: true,
        profile: {
          sessionId: userId,
          displayName: "김예시",
          initials: "김예",
          phone: "010-0000-0000",
          notificationOptIn: false,
          updatedAt: "2026-09-08T00:00:00Z",
        },
      },
    }),
  );
  await page.route("**/operational-profile?*", (route) =>
    route.fulfill({
      json: {
        ok: true,
        profile: {
          displayName: "김예시",
          membershipStatus: "active",
          department: "진료부",
          jobPositionLabel: "수의사",
          statusMessage: "진료 중입니다.",
          statusMessageUpdatedAt: "2026-09-08T00:00:00Z",
        },
      },
    }),
  );
  await page.route("**/api/workspaces", (route) =>
    route.fulfill({
      json: {
        ok: true,
        workspaces: [
          {
            id: "settings-alpha",
            displayName: "예시 동물병원",
            status: "active",
          },
        ],
      },
    }),
  );
  await page.goto(
    "/profile?returnTo=%2Fw%2Fsettings-alpha%2Freception%3Faside%3Dclosed",
  );
  await expect(page.getByLabel("이름")).toHaveValue("김예시");
  for (const viewport of [
    { width: 1728, height: 1264 },
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const category of ["프로필", "계정·보안", "알림"]) {
      await page
        .getByRole("navigation", { name: "개인 설정" })
        .getByRole("button", { name: category, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: category, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (category === "알림")
        await expect(
          page.getByRole("switch", { name: "화면 알림", exact: true }),
        ).toBeChecked();
      await page.screenshot({
        path: `test-results/personal-settings-${viewport.width}-${category === "프로필" ? "profile" : category === "알림" ? "notifications" : "security"}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole("switch", { name: "화면 알림", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("변경사항을 저장했습니다.")).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "개인 설정" })
    .getByRole("button", { name: "알림", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "화면 알림", exact: true }),
  ).not.toBeChecked();
});
test("recovery requests use a separate callback and never send a real email", async ({
  page,
  request,
}) => {
  await page.goto("/reset-password");
  await page.getByLabel("로그인 이메일").fill("settings@example.test");
  await page.getByRole("button", { name: "재설정 메일 요청" }).click();
  await expect(page.getByRole("status")).toContainText("가입된 이메일이라면");
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(
    calls.some((call: { path: string }) => call.path === "/auth/v1/recover"),
  ).toBe(true);
});

test("ordinary login cannot use the password recovery endpoint", async ({
  context,
  request,
}) => {
  expect(
    (await context.request.get("/api/users/me/password/recovery")).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post("/api/users/me/password/recovery", {
        headers: { origin },
        data: {
          password: "synthetic-new-password",
          confirmation: "synthetic-new-password",
        },
      })
    ).status(),
  ).toBe(403);
  const calls = await (await request.get(`${provider}/test/calls`)).json();
  expect(
    calls.filter((call: { method: string }) => call.method === "PUT"),
  ).toHaveLength(0);
});
test("provider-confirmed recovery session can reset password and is signed out", async ({
  context,
  request,
  page,
}) => {
  await request.post(`${provider}/test/control`, { data: { recovery: true } });
  const session = await (await request.get(`${provider}/test/session`)).json();
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/reset-password/update");
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toBeEnabled();
  await page
    .getByLabel("새 비밀번호", { exact: true })
    .fill("synthetic-new-password");
  await page.getByLabel("새 비밀번호 확인").fill("synthetic-new-password");
  await page.getByRole("button", { name: "새 비밀번호 저장" }).click();
  await expect(page.getByRole("status")).toContainText(
    "비밀번호를 변경했습니다.",
  );
  expect(
    (await context.cookies()).filter(
      (cookie) => cookie.name === "sb-127-auth-token" && cookie.value,
    ),
  ).toHaveLength(0);
});
