import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";

async function grant(page: Page) {
  await page.addInitScript(([key, workspaceId]) => localStorage.setItem(key, JSON.stringify({
    currentWorkspaceId: workspaceId,
    workspaces: [{ id: workspaceId, displayName: "합성 로딩 검증 병원", subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session" }],
    memberships: [{ id: "synthetic-loading-membership", workspaceId, userSessionId: "playwright-default-session", roles: ["hospital_admin"], status: "active" }], invitations: [],
  })), [SESSION_WORKSPACES_STORAGE_KEY, workspaceId]);
}
for (const { name, route, read } of [
  { name: "home", route: "home", read: "/operations/work-items" },
  { name: "reception staff", route: "reception", read: "/staff" },
  { name: "reception calendar", route: "reception", read: "/reception/calendar/day" },
  { name: "customer", route: "customer", read: "/reception/patient-guardian-lookup" },
  { name: "catalog", route: "orders", read: "/hospital-admin/order-catalog" },
  { name: "order sets", route: "orders?section=order-sets", read: "/hospital-admin/order-sets" },
  { name: "hospital profile", route: "orders?section=settings", read: "/hospital-admin/settings/profile" },
  { name: "hospital contact", route: "orders?section=settings-contact", read: "/hospital-admin/settings/profile" },
  { name: "hours", route: "orders?section=settings-hours", read: "/hospital-admin/basic-settings/operating-hours" },
  { name: "members", route: "orders?section=members", read: "/memberships" },
  { name: "vitals", route: "orders?section=vitals", read: "/vital-settings" },
  { name: "spaces", route: "orders?section=space-time", read: "/space-management" },
]) {
  test(`${name} hides the complete page during a required read and releases on denial`, async ({ page }) => {
    await grant(page);
    let release!: () => void; let requested = false;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    await page.route(`**/api/workspaces/${workspaceId}/**`, async request => {
      const path = new URL(request.request().url()).pathname;
      if (path.includes(read)) { requested = true; await gate; }
      await request.fulfill({ status: 403, json: { ok: false, error: "permission_missing" } });
    });
    await page.goto(`/w/${workspaceId}/${route}${route.includes("?") ? "&" : "?"}modulePanel=closed`);
    await expect.poll(() => requested).toBe(true);
    await expect(page.getByTestId("page-loading-state")).toBeVisible();
    const content = page.locator("[data-page-content]").first();
    await expect(content).toHaveAttribute("inert", "");
    await expect(content).not.toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`${name.replaceAll(" ", "-")}-loading.png`) });
    release();
    await expect(page.getByTestId("page-loading-state")).not.toBeVisible();
    await expect(content).toBeVisible();
    expect(errors).toEqual([]);
  });
}
