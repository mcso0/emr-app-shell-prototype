import { expect, test, type Page } from "@playwright/test";

async function openRolePermissionHub(page: Page) {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "역할 및 권한" })
    .click();

  return page.getByTestId("hospital-admin-role-permission-screen");
}

test("role permission screens keep the Figma desktop geometry contract", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const screen = await openRolePermissionHub(page);

  const hubMetrics = await screen.evaluate((element) => {
    const content = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-content"]'
    );
    const title = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-page-title"]'
    );
    const surface = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-settings-surface"]'
    );
    const sectionHeader = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-section-header"]'
    );
    const firstRow = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-hub-roles"]'
    );
    const iconBox = firstRow?.firstElementChild as HTMLElement | null;

    if (!content || !title || !surface || !sectionHeader || !firstRow || !iconBox) {
      throw new Error("Missing role permission hub geometry target");
    }

    const contentRect = content.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const sectionHeaderRect = sectionHeader.getBoundingClientRect();
    const firstRowRect = firstRow.getBoundingClientRect();
    const iconBoxRect = iconBox.getBoundingClientRect();
    const surfaceStyle = getComputedStyle(surface);
    const rowStyle = getComputedStyle(firstRow);

    return {
      contentWidth: Math.round(contentRect.width),
      surfaceWidth: Math.round(surfaceRect.width),
      surfaceInset: Math.round(surfaceRect.left - contentRect.left),
      titleHeight: Math.round(titleRect.height),
      titleToSurfaceGap: Math.round(surfaceRect.top - titleRect.bottom),
      sectionHeaderHeight: Math.round(sectionHeaderRect.height),
      firstRowHeight: Math.round(firstRowRect.height),
      rowPaddingLeft: Math.round(Number.parseFloat(rowStyle.paddingLeft)),
      rowPaddingTop: Math.round(Number.parseFloat(rowStyle.paddingTop)),
      iconBoxSize: Math.round(iconBoxRect.width),
      borderRadius: Math.round(Number.parseFloat(surfaceStyle.borderRadius)),
      hasShadow: surfaceStyle.boxShadow !== "none",
    };
  });

  expect(hubMetrics).toEqual({
    contentWidth: 952,
    surfaceWidth: 920,
    surfaceInset: 16,
    titleHeight: 92,
    titleToSurfaceGap: 16,
    sectionHeaderHeight: 85,
    firstRowHeight: 85,
    rowPaddingLeft: 24,
    rowPaddingTop: 20,
    iconBoxSize: 44,
    borderRadius: 12,
    hasShadow: true,
  });

  await screen.getByTestId("role-permission-hub-roles").click();
  await expect(page).toHaveURL(/roleSettings=roles/);

  const roleMetrics = await screen.evaluate((element) => {
    const backHeader = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-detail-back-header"]'
    );
    const surface = element.querySelector<HTMLElement>('[data-testid="role-summary-grid"]');
    const roleRow = element.querySelector<HTMLElement>('[data-testid="role-item-owner"]');
    const group = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-group-admin-reception_customer"]'
    );
    const permissionRow = element.querySelector<HTMLElement>(
      '[data-testid="role-permission-row-admin-reception:view"]'
    );
    const groupCard = group?.lastElementChild as HTMLElement | null;

    if (!backHeader || !surface || !roleRow || !groupCard || !permissionRow) {
      throw new Error("Missing role detail geometry target");
    }

    const surfaceRect = surface.getBoundingClientRect();
    const roleRowRect = roleRow.getBoundingClientRect();
    const permissionStyle = getComputedStyle(permissionRow);

    return {
      backHeaderHeight: Math.round(backHeader.getBoundingClientRect().height),
      surfaceWidth: Math.round(surfaceRect.width),
      roleRowHeight: Math.round(roleRowRect.height),
      permissionPaddingX: Math.round(Number.parseFloat(permissionStyle.paddingLeft)),
      permissionPaddingY: Math.round(Number.parseFloat(permissionStyle.paddingTop)),
      groupRadius: Math.round(Number.parseFloat(getComputedStyle(groupCard).borderRadius)),
    };
  });

  expect(roleMetrics).toEqual({
    backHeaderHeight: 56,
    surfaceWidth: 920,
    roleRowHeight: 85,
    permissionPaddingX: 20,
    permissionPaddingY: 16,
    groupRadius: 8,
  });

  await screen.getByRole("button", { name: "역할 및 권한", exact: true }).click();
  await screen.getByTestId("role-permission-hub-positions").click();
  await expect(screen.getByTestId("role-permission-positions-surface")).toBeVisible();
  await expect(
    screen.getByTestId("job-position-readonly-hospital_director").evaluate((element) =>
      Math.round(element.getBoundingClientRect().height)
    )
  ).resolves.toBe(85);

  await screen.getByRole("button", { name: "역할 및 권한", exact: true }).click();
  await screen.getByTestId("role-permission-hub-work-defaults").click();

  const workDefaultMetrics = await screen
    .getByTestId("role-permission-work-default-row-receptionPositionKey")
    .evaluate((row) => {
      const trigger = row.querySelector<HTMLElement>('[data-slot="select-trigger"]');
      if (!trigger) throw new Error("Missing work default select trigger");

      return {
        rowHeight: Math.round(row.getBoundingClientRect().height),
        triggerWidth: Math.round(trigger.getBoundingClientRect().width),
      };
    });

  expect(workDefaultMetrics).toEqual({ rowHeight: 85, triggerWidth: 320 });
});

test("role permission screens avoid horizontal overflow on a narrow viewport", async ({ page }) => {
  const screen = await openRolePermissionHub(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(
    screen.evaluate(
      (element) =>
        element.scrollWidth <= element.clientWidth &&
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).resolves.toBe(true);

  await screen.getByTestId("role-permission-hub-roles").click();
  await expect(
    screen.evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).resolves.toBe(true);

  await screen.getByRole("button", { name: "역할 및 권한", exact: true }).click();
  await screen.getByTestId("role-permission-hub-work-defaults").click();
  await expect(
    screen.evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).resolves.toBe(true);
});
