import { expect, test } from "@playwright/test";
import {
  canEditOrders,
  canManageHospital,
  canViewBilling,
  getMockAuthCapabilities,
} from "../src/features/auth/permissions";

const storageKey = "clair.mockAuth.session.v1";

test("login creates a localStorage-backed mock session and restores it", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "로그인 역할 선택" })).toBeVisible();
  await expect(page.getByTestId("mock-session-status")).toContainText("세션 없음");

  await page.getByRole("button", { name: /수의사/ }).click();
  await page.getByLabel("브라우저 localStorage").check();
  await page.getByRole("button", { name: "mock session 생성" }).click();

  await expect(page.getByTestId("mock-session-status")).toContainText("로그인됨");
  await expect(page.getByTestId("mock-session-status")).toContainText("수의사 (vet)");
  await expect(page.getByTestId("mock-session-status")).toContainText("브라우저 localStorage");

  const stored = await page.evaluate((key) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, storageKey);

  expect(stored).toMatchObject({
    role: "vet",
    roleLabel: "수의사",
    storageMode: "local",
  });

  await page.reload();
  await expect(page.getByTestId("mock-session-status")).toContainText("수의사 (vet)");
});

test("logout clears mock session from both browser stores", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: /수납 관리자/ }).click();
  await page.getByLabel("탭 세션").check();
  await page.getByRole("button", { name: "mock session 생성" }).click();
  await expect(page.getByTestId("mock-session-status")).toContainText(
    "수납 관리자 (billing_admin)"
  );

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByTestId("mock-session-status")).toContainText("세션 없음");

  const stored = await page.evaluate((key) => ({
    session: window.sessionStorage.getItem(key),
    local: window.localStorage.getItem(key),
  }), storageKey);

  expect(stored).toEqual({ session: null, local: null });
});

test("mock auth foundation does not guard the existing app shell", async ({ page }) => {
  await page.goto("/w/clair-demo/dispensing");

  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});

test("app shell displays the selected mock role without enforcing a guard", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: /간호사/ }).click();
  await page.getByLabel("브라우저 localStorage").check();
  await page.getByRole("button", { name: "mock session 생성" }).click();
  await page.getByRole("link", { name: "워크스페이스 열기" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/dispensing/);
  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();
  await expect(page.getByTestId("top-menu-mock-user")).toContainText("간호사");
  await expect(page.getByTestId("top-menu-mock-user")).toContainText("nurse");
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
