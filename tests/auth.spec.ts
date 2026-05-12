import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  canEditOrders,
  canManageHospital,
  canViewBilling,
  getMockAuthCapabilities,
} from "../src/features/auth/permissions";

const storageKey = "clair.mockAuth.session.v1";
const authUiFiles = [
  "src/features/auth/login-form.tsx",
  "src/features/auth/auth-gate.tsx",
  "src/shell/auth-profile-menu.tsx",
  "src/shell/top-menu.tsx",
];

test.use({ storageState: { cookies: [], origins: [] } });

test("root starts at login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "CLAiR EMR에 로그인" })).toBeVisible();
  await expect(page.getByText("병원 워크스페이스에 접속하려면 계정 정보를 입력하세요.")).toBeVisible();
  await expect(page.getByPlaceholder("name@hospital.com")).toBeVisible();
  await expect(page.getByPlaceholder("비밀번호")).toBeVisible();
  await expect(page.getByRole("heading", { name: "MVP 테스트 옵션" })).toBeVisible();
  await expect(page.getByText("현재는 Supabase Auth 연결 전 mock session으로 진입합니다.")).toBeVisible();
  await expect(page.getByTestId("mock-session-status")).toBeVisible();
});

test("workspace routes require login and preserve the requested URL", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=closed");

  await expect(page).toHaveURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    "/w/clair-demo/billing?modulePanel=open&aside=closed"
  );
});

test("login creates a localStorage-backed session and opens the requested workspace", async ({ page }) => {
  await page.goto(
    "/login?next=%2Fw%2Fclair-demo%2Fbilling%3FmodulePanel%3Dopen%26aside%3Dclosed"
  );

  await expect(page.getByRole("heading", { name: "CLAiR EMR에 로그인" })).toBeVisible();
  await expect(page.getByTestId("mock-session-status")).toContainText("로그인 전");

  await page.getByRole("button", { name: /수의사/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/billing/);
  await expect(page.getByRole("heading", { name: "수납", exact: true })).toBeVisible();
  await expect(page.getByText("INV-260501-0001 · 코코 · 이지은")).toBeVisible();

  const stored = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, storageKey);

  expect(stored).toMatchObject({
    role: "vet",
    roleLabel: "수의사",
    storageMode: "local",
  });

  await page.goto("/login");
  await expect(page.getByTestId("mock-session-status")).toContainText("수의사 (vet)");
  await expect(page.getByTestId("mock-session-status")).toContainText("브라우저에 유지");
});

test("login without next opens the MVP default workspace", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "CLAiR EMR에 로그인" })).toBeVisible();

  await page.getByRole("button", { name: /프론트 데스크/ }).click();
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/reception/);
  await expect(page.getByRole("group", { name: "접수 목록 유형" })).toBeVisible();
  await expect(page.getByRole("button", { name: /코코 · 이지은/ })).toBeVisible();
});

test("logout clears mock session from both browser stores", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: /수납 관리자/ }).click();
  await page.getByLabel("이번 탭만").check();
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/reception/);
  await expect(page.getByTestId("top-menu-mock-user")).toBeVisible();
  await page.getByTestId("top-menu-mock-user").click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/login");
  await page.evaluate(
    ([key, session]) => {
      window.sessionStorage.setItem(key, session);
    },
    [
      storageKey,
      JSON.stringify({
        id: "test-session",
        role: "billing_admin",
        roleLabel: "수납 관리자",
        storageMode: "session",
        issuedAt: new Date().toISOString(),
      }),
    ]
  );
  await page.reload();
  await expect(page.getByTestId("mock-session-status")).toContainText(
    "수납 관리자 (billing_admin)"
  );
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByTestId("mock-session-status")).toContainText("로그인 전");

  const stored = await page.evaluate((key) => ({
    session: window.sessionStorage.getItem(key),
    local: window.localStorage.getItem(key),
  }), storageKey);

  expect(stored).toEqual({ session: null, local: null });
});

test("app shell displays the selected mock role after login", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: /간호사/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/reception/);
  await expect(page.getByTestId("top-menu-mock-user")).toBeVisible();
  await page.getByTestId("top-menu-mock-user").click();
  await expect(page.getByRole("menu")).toContainText("송하윤");
  await expect(page.getByRole("menu")).toContainText("간호사");
  await expect(page.getByRole("menu")).toContainText("활동중");
  await expect(page.getByRole("menu")).toContainText("접수/예약");
});

test("auth UI components use the auth client boundary", () => {
  for (const filePath of authUiFiles) {
    const source = readFileSync(filePath, "utf8");

    expect(source, `${filePath} should not import the mock store directly`).not.toContain(
      "@/features/auth/session-store"
    );
  }
});

test("supabase adapter keeps local demo fallback and public env boundary", () => {
  const authClient = readFileSync("src/features/auth/auth-client.ts", "utf8");
  const supabaseConfig = readFileSync("src/lib/supabase/config.ts", "utf8");
  const browserClient = readFileSync("src/lib/supabase/client.ts", "utf8");
  const proxy = readFileSync("src/proxy.ts", "utf8");

  expect(authClient).toContain("signInWithPassword");
  expect(authClient).toContain("signInWithMockRole");
  expect(supabaseConfig).toContain("NEXT_PUBLIC_AUTH_MODE");
  expect(supabaseConfig).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(browserClient).toContain("createBrowserClient");
  expect(proxy).toContain("updateSession");

  for (const source of [authClient, supabaseConfig, browserClient, proxy]) {
    expect(source).not.toMatch(/service_role|SECRET|SUPABASE_SECRET/i);
  }
});

test("playwright auth regressions pin mock auth mode", () => {
  const config = readFileSync("playwright.config.ts", "utf8");

  expect(config).toContain("NEXT_PUBLIC_AUTH_MODE");
  expect(config).toContain("mock");
});

test("login exposes pending and provider error states without creating a session", async ({
  page,
}) => {
  await page.goto("/login?mockProviderError=1");

  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByRole("button", { name: "로그인 중" })).toBeDisabled();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "로그인 처리 중 문제가 발생했습니다."
  );
  await expect(page).toHaveURL(/\/login\?mockProviderError=1/);
  await expect(page.getByTestId("mock-session-status")).toContainText("로그인 전");

  const stored = await page.evaluate((key) => ({
    session: window.sessionStorage.getItem(key),
    local: window.localStorage.getItem(key),
  }), storageKey);

  expect(stored).toEqual({ session: null, local: null });
});

test("mock auth permission helper exposes role capabilities without UI gating", () => {
  expect(canViewBilling("front_desk")).toBe(false);
  expect(canViewBilling("billing_admin")).toBe(true);
  expect(canEditOrders("vet")).toBe(true);
  expect(canEditOrders("billing_admin")).toBe(false);
  expect(canManageHospital("hospital_admin")).toBe(true);
  expect(getMockAuthCapabilities("hospital_admin")).toEqual(
    expect.arrayContaining(["view_billing", "edit_orders", "manage_hospital"])
  );
});
