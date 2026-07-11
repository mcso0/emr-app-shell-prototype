import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { getAuthRuntimeMode } from "../src/lib/supabase/config";
import {
  canEditOrders,
  canManageHospital,
  canViewBilling,
  getMockAuthCapabilities,
} from "../src/features/auth/permissions";
import { resolveDemoMockAuthRoleFromEmail } from "../src/features/auth/mock-session";
import {
  PERSONAL_PROFILE_STORAGE_KEY,
  upsertSessionPersonalProfile,
  validatePersonalProfileInput,
  type PersonalProfilesState,
  type SessionPersonalProfile,
  type PersonalProfileInput,
  type PersonalProfileValidationResult,
} from "../src/features/auth/personal-profile-session";
import {
  SESSION_WORKSPACES_STORAGE_KEY,
  SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS,
  SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS,
  SESSION_WORKSPACE_PERMISSION_ROLES,
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG,
  appendSessionWorkspaceInvitation,
  createOrUpdateSessionWorkspaceCustomPermissionRole,
  cancelSessionWorkspaceInvitation,
  createSessionWorkspace,
  createSessionWorkspaceCustomJobPosition,
  createSessionWorkspaceInvitation,
  deactivateSessionWorkspaceMembership,
  getSessionWorkspaceJobPositions,
  getSessionWorkspacePermissionRoles,
  resolveSessionWorkspaceAccess,
  updateSessionWorkspaceMembershipRoles,
  validateWorkspaceInvitationInput,
  validateWorkspaceCreationInput,
} from "../src/features/auth/workspace-session";
import { readServerSessionFromSupabase } from "../src/features/auth/server-session-contract";
import { resolveRoleUpdateActorIdentity } from "../src/features/auth/server-role-update-identity";

const storageKey = "clair.mockAuth.session.v1";
const authUiFiles = [
  "src/features/auth/login-form.tsx",
  "src/features/auth/auth-gate.tsx",
  "src/shell/auth-profile-menu.tsx",
  "src/shell/top-menu.tsx",
];
const originalAuthEnv = {
  mode: process.env.NEXT_PUBLIC_AUTH_MODE,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

test.use({ storageState: { cookies: [], origins: [] } });

function withAuthRuntimeEnv(
  env: {
    mode?: string;
    url?: string;
    publishableKey?: string;
  },
  run: () => void
) {
  setOptionalEnv("NEXT_PUBLIC_AUTH_MODE", env.mode);
  setOptionalEnv("NEXT_PUBLIC_SUPABASE_URL", env.url);
  setOptionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.publishableKey);

  try {
    run();
  } finally {
    setOptionalEnv("NEXT_PUBLIC_AUTH_MODE", originalAuthEnv.mode);
    setOptionalEnv("NEXT_PUBLIC_SUPABASE_URL", originalAuthEnv.url);
    setOptionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", originalAuthEnv.publishableKey);
  }
}

function setOptionalEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

async function fillLoginCredentials(page: Page) {
  await page.getByPlaceholder("이메일을 입력해주세요").fill("front@clair.local");
  await page.getByPlaceholder("비밀번호를 입력해주세요").fill("local-pass-1");
}

async function expectTransparentButtonBackground(button: Locator) {
  const backgroundColor = await button.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );

  expect(backgroundColor).toBe("rgba(0, 0, 0, 0)");
}

test("auth runtime mode matrix keeps mock fallback and Supabase session sources explicit", () => {
  withAuthRuntimeEnv(
    {
      mode: "mock",
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_mock",
    },
    () => {
      expect(getAuthRuntimeMode()).toEqual({
        authMode: "mock",
        authProvider: "mock",
        supabaseConfigured: true,
        clientSessionSource: "mock_storage",
        serverSessionSource: "mock_fallback",
        missingConfigBehavior: "none",
      });
    }
  );

  withAuthRuntimeEnv({ mode: "auto" }, () => {
    expect(getAuthRuntimeMode()).toEqual({
      authMode: "auto",
      authProvider: "mock",
      supabaseConfigured: false,
      clientSessionSource: "mock_storage",
      serverSessionSource: "mock_fallback",
      missingConfigBehavior: "auto_mock_fallback",
    });
  });

  withAuthRuntimeEnv(
    {
      mode: "auto",
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_mock",
    },
    () => {
      expect(getAuthRuntimeMode()).toEqual({
        authMode: "auto",
        authProvider: "supabase",
        supabaseConfigured: true,
        clientSessionSource: "supabase_cookie",
        serverSessionSource: "supabase_claims",
        missingConfigBehavior: "none",
      });
    }
  );

  withAuthRuntimeEnv({ mode: "supabase" }, () => {
    expect(getAuthRuntimeMode()).toEqual({
      authMode: "supabase",
      authProvider: "supabase",
      supabaseConfigured: false,
      clientSessionSource: "supabase_cookie",
      serverSessionSource: "supabase_claims",
      missingConfigBehavior: "supabase_configuration_error",
    });
  });

  withAuthRuntimeEnv({ mode: "invalid" }, () => {
    expect(getAuthRuntimeMode()).toMatchObject({
      authMode: "auto",
      authProvider: "mock",
      missingConfigBehavior: "auto_mock_fallback",
    });
  });
});

test("production login does not expose mock development controls", () => {
  const source = readFileSync("src/features/auth/login-form.tsx", "utf8");

  expect(source).toContain("process.env.NODE_ENV === \"production\"");
  expect(source).toContain("showsMockDevelopmentControls");
  expect(source).toContain("resolveDemoMockAuthRoleFromEmail");
  expect(source).toContain("showsInviteSupportPanel");
  expect(source).toContain("(isInviteLogin || isInviteOtpLogin) && !isProductionRuntime");
});

test("production hidden mock fallback maps synthetic account emails to roles", () => {
  expect(resolveDemoMockAuthRoleFromEmail("admin@clair.local")).toBe("hospital_admin");
  expect(resolveDemoMockAuthRoleFromEmail(" VET@CLAIR.LOCAL ")).toBe("vet");
  expect(resolveDemoMockAuthRoleFromEmail("technician@clair.local")).toBe("nurse");
  expect(resolveDemoMockAuthRoleFromEmail("unknown@clair.local")).toBeNull();
});

test("auth gate uses workspace shell skeleton while checking access", () => {
  const source = readFileSync("src/features/auth/auth-gate.tsx", "utf8");

  expect(source).toContain("auth-gate-shell-skeleton");
  expect(source).toContain("AuthGateShellSkeleton");
  expect(source).toContain("@/components/ui/skeleton");
  expect(source).not.toContain("WorkspaceEntryLoadingScreen");
  expect(source).not.toContain("로그인 확인 중");
  expect(existsSync("src/app/w/[workspaceId]/[module]/loading.tsx")).toBe(false);
});

test("logo loading is scoped to post-login workspace entry", () => {
  const loginForm = readFileSync("src/features/auth/login-form.tsx", "utf8");
  const authGate = readFileSync("src/features/auth/auth-gate.tsx", "utf8");

  expect(loginForm).toContain("login-workspace-entry-loading");
  expect(loginForm).toContain("WorkspaceEntryLoadingScreen");
  expect(authGate).not.toContain("WorkspaceEntryLoadingScreen");
});

test("root starts at login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await expect(page.getByPlaceholder("이메일을 입력해주세요")).toBeFocused();
  await expect(page.getByPlaceholder("비밀번호를 입력해주세요")).toBeVisible();
  await expect(page.getByRole("button", { name: "인증번호로 로그인" })).toBeDisabled();
  await expect(page.getByText("계정이 필요하신가요?")).toBeVisible();
  await expect(page.getByText("관리자에게 문의")).toBeVisible();
  await expect(page.getByText("OTP로 로그인 하기")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "MVP 테스트 옵션" })).toBeVisible();
  await expect(page.getByText("현재는 Supabase Auth 연결 전 mock session으로 진입합니다.")).toBeVisible();
  await expect(page.getByTestId("mock-session-status")).toBeVisible();
});

test("login form guides empty submit and shows inline validation after user input", async ({
  page,
}) => {
  await page.goto("/login");

  const emailInput = page.getByLabel("이메일");
  const passwordInput = page.locator("#mock-password");
  const loginButton = page.getByRole("button", { name: "로그인", exact: true });

  await expect(emailInput).toBeFocused();

  await page.locator("main").click({ position: { x: 12, y: 12 } });
  await expect(page.getByText("이메일을 입력해 주세요.")).toHaveCount(0);
  await expect(emailInput).not.toHaveAttribute("aria-invalid", "true");

  await loginButton.click();
  await expect(emailInput).toBeFocused();
  await expect(page.getByText("이메일을 입력해 주세요.")).toHaveCount(0);
  await expect(emailInput).not.toHaveAttribute("aria-invalid", "true");
  await expect(passwordInput).not.toHaveAttribute("aria-invalid", "true");

  await emailInput.fill("1");
  await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("올바른 이메일 주소를 입력해 주세요.")).toBeVisible();
  await expect(page.getByText("비밀번호를 입력해 주세요.")).toHaveCount(0);

  await passwordInput.fill("local-pass-1");
  await loginButton.click();

  await expect(emailInput).toBeFocused();
  await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("올바른 이메일 주소를 입력해 주세요.")).toBeVisible();
  await expect(page.getByText("비밀번호를 입력해 주세요.")).toHaveCount(0);

  await emailInput.fill("front@clair.local");
  await passwordInput.fill("");
  await loginButton.click();

  await expect(passwordInput).toBeFocused();
  await expect(passwordInput).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("비밀번호를 입력해 주세요.")).toBeVisible();

  await passwordInput.fill("local-pass-1");

  await expect(page.getByText("올바른 이메일 주소를 입력해 주세요.")).toHaveCount(0);
  await expect(page.getByText("비밀번호를 입력해 주세요.")).toHaveCount(0);
});

test("login password field toggles text visibility", async ({ page }) => {
  await page.goto("/login");

  const passwordInput = page.locator("#mock-password");

  await expect(page.getByRole("button", { name: "비밀번호 보기" })).toHaveCount(0);

  await passwordInput.fill("local-pass-1");
  await expect(passwordInput).toHaveAttribute("type", "password");

  const showPasswordButton = page.getByRole("button", { name: "비밀번호 보기" });
  await expect(showPasswordButton).toHaveAttribute("aria-pressed", "false");
  await expectTransparentButtonBackground(showPasswordButton);

  await showPasswordButton.hover();
  await expectTransparentButtonBackground(showPasswordButton);

  await showPasswordButton.click();
  await expect(passwordInput).toHaveAttribute("type", "text");

  const hidePasswordButton = page.getByRole("button", { name: "비밀번호 숨기기" });
  await expect(hidePasswordButton).toHaveAttribute("aria-pressed", "true");
  await expectTransparentButtonBackground(hidePasswordButton);

  await hidePasswordButton.focus();
  await expectTransparentButtonBackground(hidePasswordButton);

  const visibleToggleIcon = hidePasswordButton.locator("svg");
  await expect(visibleToggleIcon).toBeVisible();
  await expect(visibleToggleIcon.locator("clipPath")).toHaveCount(0);

  const visibleIconBox = await visibleToggleIcon.locator("path").first().evaluate((path) => {
    const box = path.getBoundingClientRect();

    return {
      height: box.height,
      width: box.width,
    };
  });

  expect(visibleIconBox.width).toBeGreaterThan(0);
  expect(visibleIconBox.height).toBeGreaterThan(0);

  await hidePasswordButton.click();
  await expect(passwordInput).toHaveAttribute("type", "password");
});

test("workspace routes require login and preserve the requested URL", async ({ page }) => {
  await page.goto("/w/clair-demo/billing?modulePanel=open&aside=closed");

  await expect(page).toHaveURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    "/w/clair-demo/billing?modulePanel=open&aside=closed"
  );
  expect(new URL(page.url()).searchParams.get("reason")).toBe("session_required");
  await expect(page.getByTestId("auth-session-notice")).toContainText(
    "로그인이 필요하거나 세션이 만료되었습니다."
  );
});

test("login creates a localStorage-backed session and opens the requested workspace", async ({ page }) => {
  await page.goto(
    "/login?next=%2Fw%2Fclair-demo%2Fbilling%3FmodulePanel%3Dopen%26aside%3Dclosed"
  );

  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await expect(page.getByTestId("mock-session-status")).toContainText("로그인 전");

  await page.getByRole("button", { name: /수의사/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/billing/);
  await expect(page.getByRole("heading", { name: "수납", exact: true })).toBeVisible();
  await expect(page.getByText("INV-260501-0001 · E-260501-0001")).toBeVisible();

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

test("login ignores unsafe next redirects and opens the MVP default workspace", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fsteal");

  await page.getByRole("button", { name: /프론트 데스크/ }).click();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page).toHaveURL(/\/w\/workspace-clair-cheongdam\/reception/);
  await expect(page).not.toHaveURL(/evil\.example/);
});

test("login without next opens the MVP default workspace", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

  await page.getByRole("button", { name: /프론트 데스크/ }).click();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page).toHaveURL(/\/w\/workspace-clair-cheongdam\/reception/);
  await expect(page.getByRole("group", { name: "접수 목록 유형" })).toBeVisible();
  await expect(page.getByRole("button", { name: /코코 · 이지은/ })).toBeVisible();
});

test("logout clears mock session from both browser stores", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: /수납 관리자/ }).click();
  await page.getByLabel("이번 탭만").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page).toHaveURL(/\/w\/workspace-clair-cheongdam\/reception/);
  await expect(page.getByTestId("top-menu-mock-user")).toBeVisible();
  await page.getByTestId("top-menu-mock-user").click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed_out/);
  await expect(page.getByTestId("auth-session-notice")).toHaveCount(0);

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
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

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
  const loginForm = readFileSync("src/features/auth/login-form.tsx", "utf8");
  const supabaseConfig = readFileSync("src/lib/supabase/config.ts", "utf8");
  const browserClient = readFileSync("src/lib/supabase/client.ts", "utf8");
  const proxy = readFileSync("src/proxy.ts", "utf8");

  expect(authClient).toContain("signInWithPassword");
  expect(authClient).toContain("signInWithMockRole");
  expect(loginForm).toContain("invalid_credentials");
  expect(loginForm).toContain("이메일 또는 비밀번호를 확인해 주세요.");
  expect(loginForm).toContain("setLoginError(loginCredentialErrorMessage)");
  expect(loginForm).not.toContain("setFieldErrors({ password: loginCredentialErrorMessage })");
  expect(loginForm).toContain("비밀번호 보기");
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

test("server session mode regression keeps client guard and route identity boundaries explicit", async () => {
  const authGate = readFileSync("src/features/auth/auth-gate.tsx", "utf8");
  const route = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
    "utf8"
  );
  const identity = readFileSync("src/features/auth/server-role-update-identity.ts", "utf8");

  expect(authGate).toContain("useAuthClient");
  expect(authGate).not.toContain("readServerSession");
  expect(authGate).not.toContain("x-clair-demo-session-user-id");
  expect(route).toContain("readServerSession");
  expect(identity).toContain("demo_header_mock_mode");
  expect(identity).toContain("supabase_session");

  const mockFallback = await readServerSessionFromSupabase({
    authMode: "mock",
    hasSupabasePublicConfig: true,
  });
  const mockActor = resolveRoleUpdateActorIdentity({
    serverSession: mockFallback,
    demoHeaderUserId: "user-admin",
  });

  expect(mockActor).toEqual({
    ok: true,
    actorUserId: "user-admin",
    source: "demo_header_mock_mode",
  });

  const missingSupabaseSession = await readServerSessionFromSupabase({
    authMode: "supabase",
    hasSupabasePublicConfig: true,
    getClaims: async () => ({
      data: null,
      error: { name: "AuthSessionMissingError", message: "Auth session missing" },
    }),
  });
  const deniedActor = resolveRoleUpdateActorIdentity({
    serverSession: missingSupabaseSession,
    demoHeaderUserId: "user-admin",
  });

  expect(deniedActor).toEqual({
    ok: false,
    denialReason: "unauthenticated",
    sessionStatus: "unauthenticated",
    sessionReason: "no_session",
  });
});

test("login exposes pending and provider error states without creating a session", async ({
  page,
}) => {
  await page.goto("/login?mockProviderError=1");

  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

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

test("workspace creation route requires login and preserves the onboarding URL", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await expect(page).toHaveURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/workspace/new");
});

test("workspace creation validates required fields before creating state", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page).toHaveURL(/\/workspace\/new/);
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();

  await expect(page.getByText("병원/워크스페이스 이름을 입력하세요.")).toBeVisible();
  await expect(page).toHaveURL(/\/workspace\/new/);

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), SESSION_WORKSPACES_STORAGE_KEY);
  expect(stored).toBeNull();
});

test("hospital admin can create and select a route-backed workspace", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page.getByRole("heading", { name: "워크스페이스 만들기" })).toBeVisible();
  await page.getByLabel("병원/워크스페이스 이름").fill("Hanbit Animal Hospital");
  await page.getByLabel("대표/관리자 이름").fill("김승욱");
  await page.getByLabel("연락 이메일").fill("owner@hanbit.test");
  await page.getByLabel("연락처").fill("010-1234-5678");
  const creationResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workspaces") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  expect((await creationResponse).status()).toBe(201);

  await expect(page).toHaveURL(/\/w\/hanbit-animal-hospital\/home/);
  await expect(page.getByTestId("workspace-switcher")).toContainText(
    "Hanbit Animal Hospital"
  );
  await expect(page.getByTestId("top-menu-mock-user")).toBeVisible();

  const stored = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, SESSION_WORKSPACES_STORAGE_KEY);

  expect(stored).toMatchObject({
    currentWorkspaceId: "hanbit-animal-hospital",
    workspaces: [
      {
        id: "hanbit-animal-hospital",
        displayName: "Hanbit Animal Hospital",
        representativeName: "김승욱",
        contactEmail: "owner@hanbit.test",
        contactPhone: "010-1234-5678",
        subscriptionStatus: "trialing",
      },
    ],
    memberships: [
      {
        workspaceId: "hanbit-animal-hospital",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });
});

test("workspace route blocks session workspaces without active membership", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/reception/);

  const session = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, storageKey);
  expect(session?.id).toBeTruthy();

  await page.evaluate(
    ([key, sessionId]) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          currentWorkspaceId: "hanbit-animal-hospital",
          workspaces: [
            {
              id: "hanbit-animal-hospital",
              displayName: "Hanbit Animal Hospital",
              representativeName: "김승욱",
              contactEmail: "owner@hanbit.test",
              contactPhone: null,
              subscriptionStatus: "trialing",
              createdBySessionId: sessionId,
              createdAt: "2026-05-20T00:00:00.000Z",
            },
          ],
          memberships: [
            {
              id: "membership-inactive",
              workspaceId: "hanbit-animal-hospital",
              userSessionId: sessionId,
              displayName: "김승욱",
              email: "owner@hanbit.test",
              roles: ["hospital_admin"],
              status: "inactive",
              createdAt: "2026-05-20T00:00:00.000Z",
              deactivatedAt: "2026-05-20T01:00:00.000Z",
            },
          ],
          invitations: [],
          updatedAt: "2026-05-20T01:00:00.000Z",
        })
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, session.id]
  );

  await page.goto("/w/hanbit-animal-hospital/reception?modulePanel=open&aside=closed");

  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("reason")).toBe("unauthorized");
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    "/w/hanbit-animal-hospital/reception?modulePanel=open&aside=closed"
  );
  await expect(page.getByTestId("auth-session-notice")).toContainText(
    "이 워크스페이스에 접근할 권한이 없습니다."
  );
});

test("hospital admin can manage route-backed member invitations", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await page.getByLabel("병원/워크스페이스 이름").fill("Hanbit Animal Hospital");
  await page.getByLabel("대표/관리자 이름").fill("김승욱");
  await page.getByLabel("연락 이메일").fill("owner@hanbit.test");
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();

  await expect(page).toHaveURL(/\/w\/hanbit-animal-hospital\/home/);
  await page.goto("/w/hanbit-animal-hospital/orders?modulePanel=open&aside=closed");
  await page.getByRole("button", { name: "병원구성원 관리" }).click();

  await expect(page.getByRole("heading", { name: "구성원 및 초대" })).toBeVisible();
  await expect(page.getByText("활성 1명")).toBeVisible();
  await expect(page.getByText("대기 0건")).toBeVisible();
  await expect(page.getByText("비활성 0명")).toBeVisible();
  const permissionRoleGroup = page.getByRole("group", { name: "권한 역할" });
  const jobPositionGroup = page.getByRole("group", { name: "직무" });
  await expect(permissionRoleGroup).toBeVisible();
  await expect(jobPositionGroup).toBeVisible();
  await expect(permissionRoleGroup.getByText("소유자", { exact: true })).toBeVisible();
  await expect(permissionRoleGroup.getByText("관리자", { exact: true })).toBeVisible();
  await expect(permissionRoleGroup.getByText("일반", { exact: true })).toBeVisible();
  await expect(
    page.getByText("커스텀 역할은 아직 없습니다. 필요한 권한만 골라 추가할 수 있습니다.")
  ).toBeVisible();
  await expect(jobPositionGroup.getByText("병원장", { exact: true })).toBeVisible();
  await expect(jobPositionGroup.getByText("수의사", { exact: true })).toBeVisible();
  await expect(jobPositionGroup.getByText("테크니션", { exact: true })).toBeVisible();
  await expect(jobPositionGroup.getByText("데스크", { exact: true })).toBeVisible();
  await expect(page.getByText("CS", { exact: true })).toHaveCount(0);
  await expect(page.getByText("마케터", { exact: true })).toHaveCount(0);
  await expect(page.getByText("디자이너", { exact: true })).toHaveCount(0);

  await page.getByLabel("초대 이메일").fill("vet@hanbit.test");
  await page.getByLabel("직책").fill("진료팀장");
  await page.getByLabel("부서").fill("진료팀");
  await page.getByRole("radio", { name: "일반" }).check();
  await page.getByRole("radio", { name: "수의사" }).check();
  const invitationRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/workspaces/hanbit-animal-hospital/invitations") &&
      request.method() === "POST"
  );
  const invitationResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspaces/hanbit-animal-hospital/invitations") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "초대 만들기" }).click();
  const invitationPayload = (await invitationRequest).postDataJSON();
  expect(invitationPayload).toMatchObject({
    permissionRoleKey: "general",
    jobPositionKey: "veterinarian",
    roles: ["vet"],
  });
  await expect((await invitationResponse).status()).toBe(201);

  await expect(page.getByText("vet@hanbit.test")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "vet@hanbit.test" })).toContainText(
    "일반"
  );
  await expect(page.getByRole("row").filter({ hasText: "vet@hanbit.test" })).toContainText(
    "수의사"
  );
  await expect(page.getByText("대기 1건")).toBeVisible();

  await page.getByLabel("초대 이메일").fill("VET@HANBIT.TEST");
  await page.getByRole("button", { name: "초대 만들기" }).click();
  await expect(page.getByText("이미 대기 중인 초대가 있습니다. 재발송을 사용하세요.")).toBeVisible();

  const resendResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspaces/hanbit-animal-hospital/invitations/") &&
      response.url().endsWith("/resend") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "초대 재발송" }).click();
  await expect((await resendResponse).status()).toBe(200);
  await expect(page.getByText("재발송 1회")).toBeVisible();

  const acceptResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspaces/hanbit-animal-hospital/invitations/") &&
      response.url().endsWith("/accept") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "수락 시뮬레이션" }).click();
  await expect((await acceptResponse).status()).toBe(200);
  await expect(page.getByText("활성 2명")).toBeVisible();
  await expect(page.getByText("대기 0건")).toBeVisible();
  await expect(page.getByText("accepted")).toBeVisible();

  const stored = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, SESSION_WORKSPACES_STORAGE_KEY);

  expect(stored.invitations).toEqual([
    expect.objectContaining({
      email: "vet@hanbit.test",
      invitedRoles: ["vet"],
      permissionRoleKey: "general",
      jobPositionKey: "veterinarian",
      status: "accepted",
    }),
  ]);
  expect(stored.memberships).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        workspaceId: "hanbit-animal-hospital",
        userSessionId: "invitee:vet@hanbit.test",
        roles: ["vet"],
        permissionRoleKey: "general",
        jobPositionKey: "veterinarian",
        status: "active",
      }),
    ])
  );
});

test("pending invitations can be canceled in session-only state", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await page.getByLabel("병원/워크스페이스 이름").fill("Hanbit Animal Hospital");
  await page.getByLabel("대표/관리자 이름").fill("김승욱");
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();

  await page.goto("/w/hanbit-animal-hospital/orders?modulePanel=open&aside=closed");
  await page.getByRole("button", { name: "병원구성원 관리" }).click();
  await page.getByLabel("초대 이메일").fill("desk@hanbit.test");
  await page.getByRole("radio", { name: "일반" }).check();
  await page.getByRole("radio", { name: "데스크" }).check();
  await page.getByRole("button", { name: "초대 만들기" }).click();

  await expect(page.getByText("desk@hanbit.test")).toBeVisible();
  const cancelResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspaces/hanbit-animal-hospital/invitations/") &&
      response.url().endsWith("/cancel") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "초대 취소" }).click();
  await expect((await cancelResponse).status()).toBe(200);

  await expect(page.getByText("canceled")).toBeVisible();
  await expect(page.getByText("대기 0건")).toBeVisible();
});

test("role_permission:view fixture can inspect roles but cannot manage invitations or catalogs", async ({
  page,
}) => {
  const creation = createSessionWorkspace(
    {
      hospitalName: "Role Viewer Hospital",
      adminDisplayName: "권한 조회자",
      contactEmail: "viewer@clair.local",
      contactPhone: "",
      subscriptionStatus: "trialing",
    },
    { sessionId: "role-viewer-session", storageMode: "local" },
    "2026-07-11T00:00:00.000Z"
  );
  const roleViewer = {
    ...creation.membership,
    roles: ["front_desk"] as const,
    permissionRoleKey: "role_viewer",
    jobPositionKey: "front_desk",
  };
  const roleViewerState = {
    currentWorkspaceId: creation.workspace.id,
    workspaces: [creation.workspace],
    memberships: [roleViewer],
    invitations: [],
    permissionRoles: [
      {
        workspaceId: creation.workspace.id,
        roleKey: "role_viewer",
        label: "권한 조회자",
        roleType: "custom" as const,
        permissionIds: ["role_permission:view"],
        isSystem: false,
        isAssignable: true,
        sortOrder: 100,
      },
    ],
    jobPositions: [],
    updatedAt: "2026-07-11T00:00:00.000Z",
  };

  await page.goto("/login");
  await page.evaluate(
    ({ authStorageKey, workspaceStorageKey, state }) => {
      window.localStorage.setItem(
        authStorageKey,
        JSON.stringify({
          id: "role-viewer-session",
          role: "front_desk",
          roleLabel: "원무/접수",
          storageMode: "local",
          issuedAt: "2026-07-11T00:00:00.000Z",
        })
      );
      window.localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
    },
    {
      authStorageKey: storageKey,
      workspaceStorageKey: SESSION_WORKSPACES_STORAGE_KEY,
      state: roleViewerState,
    }
  );

  await page.goto("/w/role-viewer-hospital/orders?modulePanel=open&aside=closed");
  await page.getByRole("button", { name: "병원구성원 관리" }).click();
  await expect(page.getByRole("heading", { name: "병원 구성원" })).toBeVisible();
  await expect(page.getByRole("button", { name: "직원 초대" })).toBeDisabled();

  await page.getByRole("button", { name: "역할 및 권한" }).click();
  const roleScreen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(roleScreen.getByRole("heading", { name: "역할 및 권한" })).toBeVisible();
  await expect(roleScreen.getByRole("button", { name: "새 커스텀 역할" })).toHaveCount(0);
  await roleScreen.getByRole("tab", { name: "직무" }).click();
  await expect(roleScreen.getByRole("button", { name: "직무 추가" })).toBeDisabled();
  await roleScreen.getByRole("tab", { name: "업무 기본값" }).click();
  await expect(roleScreen.getByLabel("기본 접수 담당")).toBeDisabled();
});

test("hospital admin manages custom role and job catalogs outside the invitation sheet", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await page.getByLabel("병원/워크스페이스 이름").fill("Hanbit Animal Hospital");
  await page.getByLabel("대표/관리자 이름").fill("김승욱");
  await page.getByLabel("연락 이메일").fill("owner@hanbit.test");
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();

  await page.goto("/w/hanbit-animal-hospital/orders?modulePanel=open&aside=closed");
  await page.getByRole("button", { name: "역할 및 권한" }).click();

  await expect(page.getByText("CS", { exact: true })).toHaveCount(0);
  await expect(page.getByText("마케터", { exact: true })).toHaveCount(0);
  await expect(page.getByText("디자이너", { exact: true })).toHaveCount(0);
  await expect(page.getByText("워크스페이스 삭제")).toBeVisible();
  await expect(page.getByText("소유권 이전")).toBeVisible();
  await expect(page.getByText("소유자 전용").first()).toBeVisible();

  await page.getByRole("button", { name: "새 커스텀 역할" }).click();
  await page.getByLabel("커스텀 역할 이름").fill("검사 보조");
  await page.getByRole("checkbox", { name: "접수/예약 조회" }).check();
  await page.getByRole("checkbox", { name: "검사/처치 결과 입력" }).check();
  await page.getByRole("button", { name: "역할 저장" }).click();
  await expect(page.getByRole("button", { name: /검사 보조.*0명/ })).toBeVisible();

  await page.getByRole("button", { name: /검사 보조.*0명/ }).click();
  await page.getByRole("button", { name: "역할 편집" }).click();
  const roleEditDialog = page.getByRole("dialog", { name: "커스텀 역할 편집" });
  await expect(roleEditDialog.getByRole("button", { name: "역할 저장" })).toBeDisabled();
  await roleEditDialog.getByRole("checkbox", { name: "차트 조회" }).check();
  await expect(roleEditDialog.getByRole("button", { name: "역할 저장" })).toBeEnabled();
  await roleEditDialog.getByRole("button", { name: "역할 저장" }).click();
  await expect(roleEditDialog).toHaveCount(0);

  await page.getByRole("tab", { name: "직무" }).click();
  await page.getByRole("button", { name: "직무 추가" }).click();
  const jobDialog = page.getByRole("dialog", { name: "직무 추가" });
  await expect(jobDialog).toBeVisible();
  await jobDialog.getByLabel("직무 이름").fill("CS");
  await jobDialog.getByRole("button", { name: "직무 저장" }).click();
  await expect(page.getByRole("button", { name: /CS.*0명/ })).toBeVisible();

  await page.getByRole("button", { name: "구성원 관리 열기" }).click();
  await page.getByRole("button", { name: "직원 초대" }).click();
  await expect(page.getByLabel("커스텀 역할 이름")).toHaveCount(0);
  await expect(page.getByLabel("직무 이름")).toHaveCount(0);

  await page.getByLabel("초대 이메일").fill("support@hanbit.test");
  await page.getByRole("radio", { name: "검사 보조" }).check();
  await page.getByRole("radio", { name: "CS" }).check();
  const invitationRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/workspaces/hanbit-animal-hospital/invitations") &&
      request.method() === "POST"
  );
  await page.getByRole("button", { name: "초대 만들기" }).click();
  const payload = (await invitationRequest).postDataJSON();
  expect(payload.permissionRoleKey).toMatch(/^custom:/);
  expect(payload.jobPositionKey).toMatch(/^custom:/);
  expect(payload.roles).toEqual(["front_desk"]);
});

test("hospital admin can edit active member permission role with permission summary", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await page.getByLabel("병원/워크스페이스 이름").fill("Hanbit Animal Hospital");
  await page.getByLabel("대표/관리자 이름").fill("김승욱");
  await page.getByLabel("연락 이메일").fill("owner@hanbit.test");
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();

  await page.goto("/w/hanbit-animal-hospital/orders?modulePanel=open&aside=closed");
  await page.getByRole("button", { name: "병원구성원 관리" }).click();
  await page.getByRole("button", { name: "직원 초대" }).click();

  await page.getByLabel("초대 이메일").fill("vet@hanbit.test");
  await page.getByLabel("직책").fill("진료팀장");
  await page.getByLabel("부서").fill("진료팀");
  await page.getByRole("radio", { name: "일반" }).check();
  await page.getByRole("radio", { name: "수의사" }).check();
  await page.getByRole("button", { name: "초대 만들기" }).click();
  await page.getByRole("button", { name: "vet@hanbit.test 작업" }).click();
  await page.getByRole("menuitem", { name: "수락 시뮬레이션" }).click();

  const memberRow = page.getByRole("row", { name: /vet@hanbit\.test 상세 보기/ });
  await memberRow.click();
  await page.getByRole("button", { name: "권한 수정" }).click();

  const roleDialog = page.getByRole("dialog", { name: "구성원 권한 역할 수정" });
  await expect(roleDialog.getByRole("heading", { name: "구성원 권한 역할 수정" })).toBeVisible();
  await expect(roleDialog.getByText("일반 운영 권한").first()).toBeVisible();
  await roleDialog.getByRole("radio", { name: "관리자" }).check();
  await expect(roleDialog.getByText("대부분의 병원 운영 권한").first()).toBeVisible();
  await page.getByRole("button", { name: "변경 검토" }).click();
  await expect(page.getByRole("heading", { name: "권한 역할 변경 확인" })).toBeVisible();
  const roleUpdateResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspaces/hanbit-animal-hospital/memberships/") &&
      response.url().endsWith("/roles") &&
      response.request().method() === "POST"
  );
  const roleUpdateRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/workspaces/hanbit-animal-hospital/memberships/") &&
      request.url().endsWith("/roles") &&
      request.method() === "POST"
  );
  await page.getByRole("button", { name: "권한 역할 변경" }).click();
  const roleUpdatePayload = (await roleUpdateRequest).postDataJSON();
  expect(roleUpdatePayload).toMatchObject({
    roles: ["hospital_admin"],
    permissionRoleKey: "admin",
    jobPositionKey: "veterinarian",
  });
  await expect((await roleUpdateResponse).status()).toBe(200);

  await expect(memberRow).toContainText("관리자");
  await expect(memberRow).toContainText("수의사");

  const stored = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, SESSION_WORKSPACES_STORAGE_KEY);

  expect(stored.memberships).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        email: "vet@hanbit.test",
        roles: ["hospital_admin"],
        permissionRoleKey: "admin",
        jobPositionKey: "veterinarian",
        status: "active",
      }),
    ])
  );
});

test("legacy owner opens the permission-role editor as owner", async ({ page }) => {
  const creation = createSessionWorkspace(
    {
      hospitalName: "Legacy Owner Hospital",
      adminDisplayName: "레거시 소유자",
      contactEmail: "legacy-owner@clair.local",
      contactPhone: "",
      subscriptionStatus: "trialing",
    },
    { sessionId: "legacy-owner-session", storageMode: "local" },
    "2026-07-11T00:00:00.000Z"
  );
  const legacyOwner = { ...creation.membership, roles: ["hospital_admin"] as const };
  delete legacyOwner.permissionRoleKey;
  delete legacyOwner.jobPositionKey;
  const legacyState = {
    currentWorkspaceId: creation.workspace.id,
    workspaces: [creation.workspace],
    memberships: [legacyOwner],
    invitations: [],
    permissionRoles: [],
    jobPositions: [],
    updatedAt: "2026-07-11T00:00:00.000Z",
  };

  await page.goto("/login");
  await page.evaluate(
    ({ authStorageKey, workspaceStorageKey, state }) => {
      window.localStorage.setItem(
        authStorageKey,
        JSON.stringify({
          id: "legacy-owner-session",
          role: "hospital_admin",
          roleLabel: "병원 관리자",
          storageMode: "local",
          issuedAt: "2026-07-11T00:00:00.000Z",
        })
      );
      window.localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
    },
    {
      authStorageKey: storageKey,
      workspaceStorageKey: SESSION_WORKSPACES_STORAGE_KEY,
      state: legacyState,
    }
  );

  await page.goto("/w/legacy-owner-hospital/orders?modulePanel=open&aside=closed");
  await page.getByRole("button", { name: "병원구성원 관리" }).click();

  const ownerRow = page.getByRole("row").filter({ hasText: "legacy-owner@clair.local" });
  await ownerRow.click();
  await page.getByRole("button", { name: "권한 수정" }).click();

  const roleDialog = page.getByRole("dialog", { name: "구성원 권한 역할 수정" });
  await expect(roleDialog.getByRole("radio", { name: "소유자" })).toBeChecked();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "역할 및 권한" }).click();
  const roleScreen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(roleScreen.getByRole("button", { name: /소유자.*1명/ })).toBeVisible();
  await roleScreen.getByRole("button", { name: /소유자.*1명/ }).click();
  await roleScreen.getByRole("button", { name: "지정 구성원 1명 보기" }).click();
  const memberSheet = page.getByRole("dialog", { name: "소유자 지정 구성원" });
  await expect(memberSheet).toContainText("레거시 소유자");
});

test("role management UI blocks last active workspace owner demotion and deactivation", async ({
  page,
}) => {
  await page.goto("/workspace/new");

  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByLabel("브라우저에 유지").check();
  await fillLoginCredentials(page);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await page.getByLabel("병원/워크스페이스 이름").fill("Hanbit Animal Hospital");
  await page.getByLabel("대표/관리자 이름").fill("김승욱");
  await page.getByLabel("연락 이메일").fill("owner@hanbit.test");
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();

  await page.goto("/w/hanbit-animal-hospital/orders?modulePanel=open&aside=closed");
  await page.getByRole("button", { name: "병원구성원 관리" }).click();

  const adminRow = page.getByRole("row").filter({ hasText: "owner@hanbit.test" });
  await adminRow.click();
  await page.getByRole("button", { name: "권한 수정" }).click();
  const roleDialog = page.getByRole("dialog", { name: "구성원 권한 역할 수정" });
  await roleDialog.getByRole("radio", { name: "일반" }).check();
  await page.getByRole("button", { name: "변경 검토" }).click();
  await expect(page.getByText("최소 1명의 활성 소유자가 필요합니다.")).toBeVisible();
  await page.getByRole("button", { name: "권한 수정 닫기" }).click();

  await adminRow.getByRole("button", { name: "owner@hanbit.test 작업" }).click();
  await expect(page.getByRole("menuitem", { name: "비활성화" })).toBeDisabled();
  await expect(adminRow).toContainText("활성");
});

test("profile menu opens personal profile settings with personal-only fields", async ({
  page,
}) => {
  await page.goto("/login");
  await page.evaluate((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        id: "profile-menu-admin-session",
        role: "hospital_admin",
        roleLabel: "병원 관리자",
        storageMode: "local",
        issuedAt: "2026-05-17T00:00:00.000Z",
      })
    );
  }, storageKey);
  await page.goto("/w/clair-demo/reception?modulePanel=open&aside=closed");

  await expect(page.getByTestId("top-menu-mock-user")).toBeVisible();
  await page.getByTestId("top-menu-mock-user").click();
  await page.getByRole("menuitem", { name: "개인 프로필 설정" }).click();

  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole("heading", { name: "개인 프로필" })).toBeVisible();
  await expect(page.getByLabel("이름")).toHaveValue("송민재");
  await expect(page.getByLabel("연락처")).toHaveValue("");
  await expect(page.getByLabel("이니셜")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "운영 알림 받기" })).toHaveCount(0);
  await expect(page.getByText("권한 정보는 워크스페이스 멤버십에서 관리됩니다.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /역할 변경/ })).toHaveCount(0);
});

test("personal profile settings validate editable fields and save session-only data", async ({
  page,
}) => {
  await page.goto("/login");
  await page.evaluate((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        id: "profile-save-admin-session",
        role: "hospital_admin",
        roleLabel: "병원 관리자",
        storageMode: "local",
        issuedAt: "2026-05-17T00:00:00.000Z",
      })
    );
  }, storageKey);
  await page.goto("/w/clair-demo/reception?modulePanel=open&aside=closed");
  await page.getByTestId("top-menu-mock-user").click();
  await page.getByRole("menuitem", { name: "개인 프로필 설정" }).click();

  await page.getByLabel("이름").fill("");
  await page.getByRole("button", { name: "저장하기" }).click();

  await expect(page.getByText("이름을 입력하세요.")).toBeVisible();

  await page.getByLabel("이름").fill("김승욱");
  await page.getByLabel("연락처").fill("010-1111-2222");
  const profileSaveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/users/me/profile") &&
      response.request().method() === "PATCH"
  );
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect((await profileSaveResponse).status()).toBe(200);

  await expect(page.getByText("프로필이 저장되었습니다.")).toBeVisible();

  const stored = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, PERSONAL_PROFILE_STORAGE_KEY);

  expect(stored.profiles[0]).toMatchObject({
    displayName: "김승욱",
    initials: "김승",
    phone: "010-1111-2222",
    notificationOptIn: false,
  });
  expect(stored.profiles[0]).not.toHaveProperty("roles");
  expect(stored.profiles[0]).not.toHaveProperty("roleLabel");

  await page.getByRole("link", { name: /VIP 동물의료센터 청담점/ }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/reception/);
  await page.getByTestId("top-menu-mock-user").click();
  await expect(page.getByRole("menu")).toContainText("김승욱");
});

test("personal profile contract keeps user-editable profile separate from authorization source", () => {
  const input: PersonalProfileInput = {
    displayName: " ",
    initials: "ADMIN",
    phone: "",
    notificationOptIn: true,
  };

  expect(validatePersonalProfileInput(input)).toEqual({
    valid: false,
    fieldErrors: {
      displayName: "이름을 입력하세요.",
      initials: "이니셜은 1~3자로 입력하세요.",
    },
  } satisfies PersonalProfileValidationResult);

  const state: PersonalProfilesState = {
    profiles: [],
    updatedAt: "2026-05-17T00:00:00.000Z",
  };
  const saved = upsertSessionPersonalProfile(
    state,
    {
      sessionId: "admin-session",
      storageMode: "local",
      role: "hospital_admin",
      roleLabel: "병원 관리자",
    },
    {
      displayName: "김승욱",
      initials: "SW",
      phone: "010-1111-2222",
      notificationOptIn: true,
    },
    "2026-05-17T01:00:00.000Z"
  );

  expect(saved.profiles).toEqual([
    {
      sessionId: "admin-session",
      displayName: "김승욱",
      initials: "SW",
      phone: "010-1111-2222",
      notificationOptIn: true,
      updatedAt: "2026-05-17T01:00:00.000Z",
    } satisfies SessionPersonalProfile,
  ]);
  expect(JSON.stringify(saved.profiles[0])).not.toMatch(/hospital_admin|병원 관리자|roles?/);
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

test("workspace creation contract assigns the creator as active hospital admin", () => {
  const result = createSessionWorkspace(
    {
      hospitalName: "Hanbit Animal Hospital",
      adminDisplayName: "김승욱",
      contactEmail: "owner@hanbit.test",
      contactPhone: "010-1234-5678",
      subscriptionStatus: "trialing",
    },
    {
      sessionId: "mock-session-1",
      storageMode: "local",
    },
    "2026-05-17T00:00:00.000Z"
  );

  expect(result.workspace).toMatchObject({
    id: "hanbit-animal-hospital",
    displayName: "Hanbit Animal Hospital",
    representativeName: "김승욱",
    contactEmail: "owner@hanbit.test",
    contactPhone: "010-1234-5678",
    subscriptionStatus: "trialing",
    createdBySessionId: "mock-session-1",
  });
  expect(result.membership).toMatchObject({
    workspaceId: "hanbit-animal-hospital",
    userSessionId: "mock-session-1",
    roles: ["hospital_admin"],
    status: "active",
  });
});

test("workspace creation contract returns field errors for missing required fields", () => {
  expect(
    validateWorkspaceCreationInput({
      hospitalName: " ",
      adminDisplayName: " ",
      contactEmail: "not-an-email",
      contactPhone: "",
      subscriptionStatus: "trialing",
    })
  ).toEqual({
    valid: false,
    fieldErrors: {
      hospitalName: "병원/워크스페이스 이름을 입력하세요.",
      adminDisplayName: "대표/관리자 이름을 입력하세요.",
      contactEmail: "올바른 이메일 형식으로 입력하세요.",
    },
  });
});

test("workspace invitation contract blocks duplicate pending and active memberships", () => {
  const creation = createSessionWorkspace(
    {
      hospitalName: "Hanbit Animal Hospital",
      adminDisplayName: "김승욱",
      contactEmail: "owner@hanbit.test",
      contactPhone: "010-1234-5678",
      subscriptionStatus: "trialing",
    },
    {
      sessionId: "admin-session",
      storageMode: "local",
    },
    "2026-05-17T00:00:00.000Z"
  );
  const invitation = createSessionWorkspaceInvitation(
    {
      email: "VET@HANBIT.TEST",
      roles: ["vet", "technician"],
      title: "진료팀장",
      department: "진료팀",
    },
    creation.workspace.id,
    {
      sessionId: "admin-session",
      storageMode: "local",
    },
    "2026-05-17T00:00:00.000Z"
  );
  const state = appendSessionWorkspaceInvitation(
    {
      currentWorkspaceId: creation.workspace.id,
      workspaces: [creation.workspace],
      memberships: [creation.membership],
      invitations: [],
      updatedAt: "2026-05-17T00:00:00.000Z",
    },
    invitation,
    "2026-05-17T00:00:00.000Z"
  );

  expect(invitation).toMatchObject({
    email: "vet@hanbit.test",
    invitedRoles: ["vet", "technician"],
    status: "pending",
    invitedBySessionId: "admin-session",
  });
  expect(
    validateWorkspaceInvitationInput(
      {
        email: "vet@hanbit.test",
        roles: ["front_desk"],
        title: "",
        department: "",
      },
      state,
      creation.workspace.id
    )
  ).toEqual({
    valid: false,
    fieldErrors: {
      email: "이미 대기 중인 초대가 있습니다. 재발송을 사용하세요.",
    },
  });

  const canceledState = cancelSessionWorkspaceInvitation(
    state,
    invitation.id,
    "2026-05-17T01:00:00.000Z"
  );
  const activeState = {
    ...canceledState,
    memberships: [
      ...canceledState.memberships,
      {
        id: "hanbit-animal-hospital:invitee:vet@hanbit.test",
        workspaceId: creation.workspace.id,
        userSessionId: "invitee:vet@hanbit.test",
        displayName: "vet",
        email: "vet@hanbit.test",
        roles: ["vet" as const],
        status: "active" as const,
        createdAt: "2026-05-17T01:00:00.000Z",
      },
    ],
  };

  expect(
    validateWorkspaceInvitationInput(
      {
        email: "vet@hanbit.test",
        roles: ["front_desk"],
        title: "",
        department: "",
      },
      activeState,
      creation.workspace.id
    )
  ).toEqual({
    valid: false,
    fieldErrors: {
      email: "이미 활성 멤버로 등록된 이메일입니다.",
    },
  });
});

test("workspace permission role and job catalogs keep Korean defaults and safe custom boundaries", () => {
  expect(SESSION_WORKSPACE_PERMISSION_ROLES.map((role) => role.label)).toEqual([
    "소유자",
    "관리자",
    "일반",
  ]);
  expect(SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS.map((position) => position.label)).toEqual([
    "병원장",
    "수의사",
    "테크니션",
    "데스크",
  ]);
  expect(SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS.map((position) => position.label)).not.toEqual(
    expect.arrayContaining(["CS", "마케터", "디자이너"])
  );
  expect(SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG.map((item) => item.id)).not.toEqual(
    expect.arrayContaining([...SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS])
  );

  const creation = createSessionWorkspace(
    {
      hospitalName: "Hanbit Animal Hospital",
      adminDisplayName: "김승욱",
      contactEmail: "owner@hanbit.test",
      contactPhone: "010-1234-5678",
      subscriptionStatus: "trialing",
    },
    {
      sessionId: "admin-session",
      storageMode: "local",
    },
    "2026-05-17T00:00:00.000Z"
  );
  const baseState = {
    currentWorkspaceId: creation.workspace.id,
    workspaces: [creation.workspace],
    memberships: [creation.membership],
    invitations: [],
    permissionRoles: [],
    jobPositions: [],
    updatedAt: "2026-05-17T00:00:00.000Z",
  };

  const rejected = createOrUpdateSessionWorkspaceCustomPermissionRole(baseState, {
    workspaceId: creation.workspace.id,
    label: "위험 권한",
    permissionIds: ["workspace:delete"],
  });
  expect(rejected).toMatchObject({ success: false, reason: "owner_only_permission" });

  const customRole = createOrUpdateSessionWorkspaceCustomPermissionRole(baseState, {
    workspaceId: creation.workspace.id,
    label: "검사 보조",
    permissionIds: ["reception:view", "lab:complete"],
  });
  expect(customRole).toMatchObject({ success: true });
  if (!customRole.success) throw new Error("expected custom role creation to pass");
  expect(getSessionWorkspacePermissionRoles(customRole.state, creation.workspace.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: "검사 보조",
        roleType: "custom",
        permissionIds: ["reception:view", "lab:complete"],
      }),
    ])
  );

  const customJob = createSessionWorkspaceCustomJobPosition(customRole.state, {
    workspaceId: creation.workspace.id,
    label: "CS",
  });
  expect(customJob).toMatchObject({ success: true });
  if (!customJob.success) throw new Error("expected custom job creation to pass");
  expect(getSessionWorkspaceJobPositions(customJob.state, creation.workspace.id)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: "CS",
        positionKey: expect.stringMatching(/^custom:/),
      }),
    ])
  );
});

test("session workspace access contract allows only active membership for the current session", () => {
  const creation = createSessionWorkspace(
    {
      hospitalName: "Hanbit Animal Hospital",
      adminDisplayName: "김승욱",
      contactEmail: "owner@hanbit.test",
      contactPhone: "010-1234-5678",
      subscriptionStatus: "trialing",
    },
    {
      sessionId: "admin-session",
      storageMode: "local",
    },
    "2026-05-17T00:00:00.000Z"
  );
  const baseState = {
    currentWorkspaceId: creation.workspace.id,
    workspaces: [creation.workspace],
    memberships: [
      creation.membership,
      {
        id: "membership-pending",
        workspaceId: creation.workspace.id,
        userSessionId: "pending-session",
        displayName: "pending",
        email: "pending@hanbit.test",
        roles: ["vet" as const],
        status: "pending" as const,
        createdAt: "2026-05-17T01:00:00.000Z",
      },
      {
        id: "membership-suspended",
        workspaceId: creation.workspace.id,
        userSessionId: "suspended-session",
        displayName: "suspended",
        email: "suspended@hanbit.test",
        roles: ["front_desk" as const],
        status: "suspended" as const,
        createdAt: "2026-05-17T01:00:00.000Z",
      },
      {
        id: "membership-inactive",
        workspaceId: creation.workspace.id,
        userSessionId: "inactive-session",
        displayName: "inactive",
        email: "inactive@hanbit.test",
        roles: ["technician" as const],
        status: "inactive" as const,
        createdAt: "2026-05-17T01:00:00.000Z",
      },
    ],
    invitations: [],
    updatedAt: "2026-05-17T00:00:00.000Z",
  };

  expect(resolveSessionWorkspaceAccess(baseState, creation.workspace.id, "admin-session")).toBe(
    "active"
  );
  expect(resolveSessionWorkspaceAccess(baseState, creation.workspace.id, "pending-session")).toBe(
    "pending"
  );
  expect(resolveSessionWorkspaceAccess(baseState, creation.workspace.id, "inactive-session")).toBe(
    "inactive"
  );
  expect(resolveSessionWorkspaceAccess(baseState, creation.workspace.id, "suspended-session")).toBe(
    "suspended"
  );
  expect(resolveSessionWorkspaceAccess(baseState, creation.workspace.id, "missing-session")).toBe(
    "missing"
  );
  expect(resolveSessionWorkspaceAccess(baseState, "missing-workspace", "admin-session")).toBe(
    "missing"
  );
});

test("workspace membership role mutation contract protects the last active hospital admin", () => {
  const creation = createSessionWorkspace(
    {
      hospitalName: "Hanbit Animal Hospital",
      adminDisplayName: "김승욱",
      contactEmail: "owner@hanbit.test",
      contactPhone: "010-1234-5678",
      subscriptionStatus: "trialing",
    },
    {
      sessionId: "admin-session",
      storageMode: "local",
    },
    "2026-05-17T00:00:00.000Z"
  );
  const state = {
    currentWorkspaceId: creation.workspace.id,
    workspaces: [creation.workspace],
    memberships: [
      creation.membership,
      {
        id: "hanbit-animal-hospital:vet-session",
        workspaceId: creation.workspace.id,
        userSessionId: "vet-session",
        displayName: "vet",
        email: "vet@hanbit.test",
        roles: ["vet" as const],
        status: "active" as const,
        createdAt: "2026-05-17T01:00:00.000Z",
      },
    ],
    invitations: [],
    updatedAt: "2026-05-17T00:00:00.000Z",
  };

  expect(
    updateSessionWorkspaceMembershipRoles(
      state,
      creation.membership.id,
      ["vet"],
      "2026-05-17T02:00:00.000Z"
    )
  ).toMatchObject({
    success: false,
    reason: "last_admin_protected",
  });
  expect(
    deactivateSessionWorkspaceMembership(
      state,
      creation.membership.id,
      "2026-05-17T02:00:00.000Z"
    )
  ).toMatchObject({
    success: false,
    reason: "last_admin_protected",
  });

  const roleUpdate = updateSessionWorkspaceMembershipRoles(
    state,
    "hanbit-animal-hospital:vet-session",
    ["vet", "front_desk", "technician"],
    "2026-05-17T02:00:00.000Z"
  );

  expect(roleUpdate).toMatchObject({ success: true });
  expect(roleUpdate.state.memberships).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "hanbit-animal-hospital:vet-session",
        roles: ["vet", "front_desk", "technician"],
      }),
    ])
  );
});
