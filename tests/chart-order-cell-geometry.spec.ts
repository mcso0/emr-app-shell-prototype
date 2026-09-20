import { expect, test, type Locator } from "@playwright/test";

const route = "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";
async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

test("unconfirmed work state uses the exact muted hyphen and body typography", async ({ page }) => {
  await page.goto(route);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const cell = table.locator('tbody tr[data-emr-data-table-row="true"]').first().locator('td[data-column-id="status"]');
  const status = cell.getByLabel("확정 후 업무 상태가 표시됩니다");
  await expect(status).toBeVisible();
  await expect(status).toHaveText("-");
  await expect(status).toHaveCSS("color", "rgb(163, 163, 163)");
  await expect(status).toHaveCSS("font-size", "14px");
  await expect(status).toHaveCSS("line-height", "20px");
  await expect(status).toHaveCSS("letter-spacing", "0.196px");
  const hyphenLeft = await status.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.trim() !== "-") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    }
    throw new Error("Expected the unconfirmed ASCII hyphen text node");
  });
  expect(hyphenLeft - (await box(cell)).x).toBeCloseTo(12, 0);
});

test("approved cell geometry centers selection and keeps exact input insets", async ({ page }) => {
  await page.goto(route);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const row = table.locator('tbody tr[data-emr-data-table-row="true"]').first();
  await expect(row).toBeVisible();
  for (const cell of [table.locator('th[data-column-id="select"]'), row.locator('td[data-column-id="select"]')]) {
    const control = cell.getByRole("checkbox");
    const [cellBox, controlBox] = await Promise.all([box(cell), box(control)]);
    expect(controlBox.width).toBe(16);
    expect(controlBox.height).toBe(16);
    // A leading table inset may be allocated outside the logical 20px cell.
    expect(controlBox.x - cellBox.x).toBeCloseTo(2 + Math.max(0, cellBox.width - 28), 0);
    // The row's 1px bottom rule is not part of its flex content box.
    expect(Math.abs(controlBox.y + 8 - (cellBox.y + cellBox.height / 2))).toBeLessThanOrEqual(0.5);
  }
  for (const [id, width, inset] of [["billingName", 138, 0], ["quantity", 55, 10]] as const) {
    const cell = row.locator(`td[data-column-id="${id}"]`);
    const input = cell.locator("input");
    const [cellBox, inputBox] = await Promise.all([box(cell), box(input)]);
    expect(inputBox.width).toBeCloseTo(width, 0);
    expect(inputBox.height).toBe(28);
    expect(inputBox.x - cellBox.x).toBeCloseTo(inset, 0);
    await expect(input).toHaveCSS("padding-left", "10px");
    await expect(input).toHaveCSS("padding-right", "10px");
    await expect(input).toHaveCSS("border-radius", "8px");
    await expect(input).toHaveCSS("font-size", "12px");
    await expect(input).toHaveCSS("line-height", "16px");
  }
});

for (const [label, bodyHeight, headerHeight] of [["좁은 간격", 36, 36], ["기본 간격", 40, 36], ["넓은 간격", 52, 44]] as const) {
  test(`density ${label} keeps approved header/body heights and column widths`, async ({ page }) => {
    await page.goto(route);
    const table = page.getByRole("table", { name: "처방/오더 테이블" });
    await expect(table).toBeVisible();
    if (label !== "좁은 간격") {
      await page.getByRole("button", { name: /테이블 보기 밀도:/ }).click();
      const option = page.getByRole("menuitemradio", { name: label, exact: true });
      await expect(option).toBeVisible();
      await option.focus();
      await option.press("Enter");
    }
    await expect.poll(async () => (await box(table.locator('tbody tr[data-emr-data-table-row="true"]').first())).height).toBe(bodyHeight);
    expect((await box(table.locator("thead tr").first())).height).toBe(headerHeight);
    expect((await box(table.locator('th[data-column-id="orderType"]'))).width).toBe(96);
  });
}

test("requester identity uses the approved 24px avatar and 10px content inset", async ({ page }) => {
  await page.goto(route);
  const table = page.getByRole("table", { name: "처방/오더 테이블" });
  const row = table.locator('tbody tr[data-emr-data-table-row="true"]').first();
  await expect(row).toBeVisible();
  const cell = row.locator('td[data-column-id="requestedBy"]');
  await cell.scrollIntoViewIfNeeded();
  const avatar = cell.locator('[data-slot="avatar"]');
  await expect(avatar).toHaveCount(1);
  const [cellBox, avatarBox] = await Promise.all([box(cell), box(avatar)]);
  expect(avatarBox.width).toBe(24);
  expect(avatarBox.height).toBe(24);
  expect(avatarBox.x - cellBox.x).toBeCloseTo(10, 0);
  expect(Math.abs(avatarBox.y + 12 - (cellBox.y + cellBox.height / 2))).toBeLessThanOrEqual(0.5);
  const initials = avatar.locator('[data-slot="avatar-fallback"]');
  await expect(initials).toHaveCSS("font-size", "10px");
  await expect(initials).toHaveCSS("line-height", "14px");
  await expect(initials).toHaveCSS("background-color", "rgb(245, 245, 245)");
});
