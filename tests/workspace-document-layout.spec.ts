import { expect, test } from "@playwright/test";

const labUrl = "/w/clair-demo/lab?labResultId=lab-result-coco-cbc&modulePanel=open&aside=closed&right=closed";
test.use({ viewport: { width: 1920, height: 1080 } });

test("adopted drawer preserves both open panels and permits document input", async ({ page }) => {
  await openLab(page, false);
  const input = page.getByRole("textbox", { name: "HCT 결과값" });
  const node = await input.elementHandle();
  await page.getByRole("button", { name: "임상병리검사 이력 패널 열기" }).click();
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  await expect.poll(async () => (await page.locator('[data-workspace-panel="right"]').boundingBox())!.width).toBe(280);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const side of ["left", "right"]) {
    const panel = page.locator(`[data-workspace-panel="${side}"]`);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-presentation", "drawer");
    await expect(panel).toHaveAttribute("role", "complementary");
    await expect(panel).not.toHaveAttribute("aria-modal", "true");
  }
  await input.fill("41");
  await input.press("Escape");
  await expect(page).toHaveURL(/aside=history/);
  await expect(page).toHaveURL(/right=open/);
  await expect(input).toHaveValue("41");
  expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator('[data-workspace-panel="left"]')).toHaveAttribute("data-presentation", "inline");
  await expect(page.locator('[data-workspace-panel="right"]')).toHaveAttribute("data-presentation", "inline");
});

test("adopted compact view conceals panels without closing or remounting them", async ({ page }) => {
  await openLab(page, false);
  const input = page.getByRole("textbox", { name: "HCT 결과값" });
  await page.getByRole("button", { name: "임상병리검사 이력 패널 열기" }).click();
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  const receipt = page.getByTestId("lab-receipt-panel");
  await receipt.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ }).click();
  const receiptNode = await receipt.elementHandle();
  await input.fill("42");
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByTestId("workspace-panel-switcher")).toBeVisible();
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "이력 보기", exact: true }).click();
  await expect(page.locator('[data-workspace-panel="left"]')).toBeVisible();
  await expect(page.locator('[data-workspace-panel="right"]')).toBeHidden();
  await page.getByRole("button", { name: "수신함 보기", exact: true }).click();
  await expect(receipt).toBeVisible();
  await expect(receipt.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "본문 보기", exact: true }).click();
  await expect(input).toHaveValue("42");
  await expect(page).toHaveURL(/aside=history/);
  await expect(page).toHaveURL(/right=open/);
  expect(await receiptNode!.evaluate((element) => element.isConnected)).toBe(true);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "이력 보기", exact: true }).click();
  const dimensions = await page.locator('[data-workspace-panel="left"]').evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(dimensions.scroll).toBe(dimensions.client);
  await page.getByRole("button", { name: "본문 보기", exact: true }).click();
  await expect(input).toHaveValue("42");
});

test("adopted geometry uses the work-area center without reserving a closed side", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1080 });
  await openLab(page);
  const area = page.getByTestId("workspace-document-area");
  const doc = page.getByTestId("workspace-document");
  const history = page.locator('button[aria-controls="lab-content-aside-surface"]');
  const receipt = page.locator('button[aria-controls="lab-receipt-panel-surface"]');
  for (const trigger of [null, history, receipt]) {
    if (trigger) await trigger.click();
    await expect.poll(async () => {
      const a = (await area.boundingBox())!; const d = (await doc.boundingBox())!;
      return Math.abs(d.x + d.width / 2 - a.x - a.width / 2);
    }).toBeLessThan(1);
    await expect.poll(async () => (await doc.boundingBox())!.width).toBe(1120);
  }
  await receipt.click();
  await page.getByRole("button", { name: "넓게 보기", exact: true }).click();
  await expect.poll(async () => {
    const a = (await area.boundingBox())!; const d = (await doc.boundingBox())!;
    return Math.abs(a.x + a.width - d.x - d.width - 16);
  }).toBeLessThan(1);
  await history.click();
  await receipt.click();
  await expect.poll(async () => {
    const a = (await area.boundingBox())!; const d = (await doc.boundingBox())!;
    return Math.abs(d.x - a.x - 16);
  }).toBeLessThan(1);
});

test("adopted drawer boundaries have a return buffer and preserve URL choices", async ({ page }) => {
  await openLab(page, false);
  await page.getByRole("button", { name: "임상병리검사 이력 패널 열기" }).click();
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  const area = page.getByTestId("workspace-document-area");
  const currentWidth = (await area.boundingBox())!.width;
  for (const [workWidth, presentation] of [[1439, "drawer"], [1440, "drawer"], [1471, "drawer"], [1472, "inline"], [1440, "inline"]] as const) {
    await page.setViewportSize({ width: 1920 + workWidth - currentWidth, height: 1080 });
    await expect.poll(async () => (await area.boundingBox())!.width).toBe(workWidth);
    await expect(area).toHaveAttribute("data-presentation", presentation);
    await expect(page).toHaveURL(/aside=history/);
    await expect(page).toHaveURL(/right=open/);
  }
});

test("adopted compact focus ownership and hidden guards remain safe", async ({ page }) => {
  await openLab(page, false);
  await page.getByRole("button", { name: "임상병리검사 이력 패널 열기" }).click();
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  const left = page.locator('[data-workspace-panel="left"]');
  const right = page.locator('[data-workspace-panel="right"]');
  const closeLeft = left.locator("[data-workspace-history-collapse]");
  await closeLeft.focus();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(left).toBeVisible();
  await expect(right).toBeHidden();
  await expect(closeLeft).toBeFocused();
  await page.keyboard.press("Escape");
  const body = page.getByRole("button", { name: "본문 보기", exact: true });
  await expect(body).toBeFocused();
  await page.getByRole("button", { name: "수신함 보기", exact: true }).click();
  await right.locator("[data-workspace-receipt-collapse]").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("workspace-panel-switcher")).toBeHidden();
  await expect(page.locator('button[aria-controls="lab-receipt-panel-surface"]')).toBeFocused();
  await page.locator('button[aria-controls="lab-content-aside-surface"]').click();
  await page.getByRole("button", { name: "본문 보기", exact: true }).click();
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let step = 0; step < 10; step += 1) {
      await page.keyboard.press(key);
      const reachable = await page.evaluate(() => !document.activeElement?.closest('[inert], .hidden'));
      expect(reachable).toBe(true);
    }
  }
});

test("adopted receipt confirmation stays above the outer profile across compact resize", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1080 });
  await openLab(page, false);
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  await page.getByRole("button", { name: "코코 환자 프로필 열기", exact: true }).click();
  await expect(page.getByTestId("workspace-right-panel").getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await page.getByTestId("lab-receipt-panel").getByRole("button", { name: "결과 붙여넣기", exact: true }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "이전에 입력된 수치가 있으면" });
  const cancel = confirmation.getByRole("button", { name: "취소", exact: true });
  await expect(confirmation).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(confirmation).toBeVisible();
  await expect(page.getByTestId("workspace-panel-switcher")).toBeVisible();
  await expect(page.locator('[data-workspace-panel="right"]')).toBeVisible();
  await expect.poll(() => cancel.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  await cancel.click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByTestId("lab-receipt-panel")).toBeVisible();
  await expect(page).toHaveURL(/right=open/);
});

async function openLab(page: import("@playwright/test").Page, narrow = true) {
  await page.goto(labUrl);
  await expect(page.getByTestId("auth-gate-shell-skeleton")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  await expect(page.getByTestId("lab-receipt-panel")).toBeHidden();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  if (narrow) await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
}

test("workspace starts wide and reload resets a manual narrow choice", async ({ page }) => {
  await openLab(page, false);
  const doc = page.getByTestId("workspace-document");
  const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
  await expect.poll(async () => (await doc.boundingBox())!.width).toBe(available);
  await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  await expect(doc).toHaveAttribute("data-width-mode", "narrow");
  await page.reload();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await expect(page.getByRole("button", { name: "좁게 보기", exact: true })).toBeVisible();
});

test("available document width controls visibility and preserves selected mode and inputs", async ({ page }) => {
  await openLab(page);
  const doc = page.getByTestId("workspace-document");
  const widthButton = page.locator("[data-workspace-width-toggle]");
  const toolbar = page.getByTestId("workspace-document-toolbar");
  const resultContent = page.locator('[data-slot="instruction-result-scroll-content"]');
  await expect(toolbar).toHaveCSS("border-bottom-width", "0px");
  await expect.poll(async () => {
    const documentBox = (await doc.boundingBox())!;
    const contentBox = (await resultContent.locator(":scope > *").first().boundingBox())!;
    return [contentBox.x - documentBox.x, contentBox.width - documentBox.width];
  }).toEqual([0, 0]);
  await expect(doc).toHaveCSS("max-width", "1120px");
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("31");
  await widthButton.click();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(async () => (await doc.boundingBox())!.width).toBeGreaterThan(1120);
  await expect.poll(async () => {
    const documentBox = (await doc.boundingBox())!;
    const contentBox = (await resultContent.locator(":scope > *").first().boundingBox())!;
    const toolbarBox = (await toolbar.boundingBox())!;
    return [contentBox.x - documentBox.x, contentBox.width - documentBox.width, documentBox.x - toolbarBox.x, documentBox.width - toolbarBox.width];
  }).toEqual([0, 0, 0, 0]);
  await expect(widthButton).toBeVisible();
  await page.mouse.move(0, 0);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("implementation-1920-wide.png") });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await expect(widthButton).toBeHidden();
  await expect(doc).toHaveAttribute("data-width-mode", "wide");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(widthButton).toHaveText("좁게 보기");
  await widthButton.click();
  await expect(doc).toHaveCSS("max-width", "1120px");
  await expect.poll(async () => (await doc.boundingBox())!.width).toBe(1120);
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("31");
  await expect(page.getByTestId("workspace-document-toolbar").getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("implementation-1920-narrow.png") });
});

test("history and receipt share the document title hierarchy", async ({ page }) => {
  await openLab(page);
  await page.getByRole("button", { name: "임상병리검사 이력 패널 열기" }).click();
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  const panels = page.locator("[data-workspace-panel][data-presentation=inline]");
  await expect(panels).toHaveCount(2);
  await expect(page.locator("[data-workspace-panel=left]")).toBeVisible();
  await expect(page.locator("[data-workspace-panel=right]")).toBeVisible();
  await expect(page.locator("[data-workspace-width-toggle]")).toBeHidden();
  const toolbar = (await page.getByTestId("workspace-document-toolbar").boundingBox())!;
  for (const panel of await panels.all()) {
    const box = (await panel.boundingBox())!;
    expect(box.y).toBe(toolbar.y);
    expect(box.height).toBe((await page.getByTestId("workspace-document-area").boundingBox())!.height);
  }
  await expect(page.getByTestId("workspace-right-panel").locator("#lab-receipt-panel")).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("implementation-1920-panels.png") });
});

test("narrow drawer keeps the body interactive and closes only from panel focus", async ({ page }) => {
  await openLab(page);
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("32");
  await page.setViewportSize({ width: 1440, height: 900 });
  const trigger = page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ });
  await trigger.click();
  const dialog = page.getByRole("complementary", { name: "장비 검사 수신함", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("implementation-1440-modal.png") });
  await expect(trigger).toBeFocused();
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("32");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.locator("[data-workspace-receipt-collapse]").focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("lab-receipt-panel")).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("32");
  await expect(page).toHaveURL(/right=closed/);
});

test("non-modal receipt permits nested modal confirmation and returning to review", async ({ page }) => {
  await openLab(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  const receipt = page.getByTestId("lab-receipt-panel");
  await receipt.getByRole("button", { name: "결과 붙여넣기" }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "이전에 입력된 수치가 있으면" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "장비 검사 수신함", exact: true })).toBeVisible();
});

test("panel presentation changes preserve review state and both open choices", async ({ page }) => {
  await openLab(page);
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("33");
  const trigger = page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ });
  await trigger.click();
  const receipt = page.getByTestId("lab-receipt-panel");
  await receipt.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("complementary", { name: "장비 검사 수신함", exact: true })).toBeVisible();
  await expect(receipt.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator('[data-workspace-panel="right"]')).toHaveAttribute("data-presentation", "inline");
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("33");
  await expect(receipt.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "임상병리검사 이력 패널 열기" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("complementary", { name: "임상병리검사 이력", exact: true })).toBeVisible();
  await expect(receipt).toBeVisible();
  await page.getByRole("textbox", { name: "HCT 결과값" }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("33");
});

test("rapid width reversal and panel dismissal retain values", async ({ page }) => {
  await openLab(page);
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("34");
  const widthButton = page.locator("[data-workspace-width-toggle]");
  await widthButton.click();
  await expect(page.getByTestId("workspace-document")).toHaveCSS("transition-duration", "0.18s");
  await widthButton.click();
  await widthButton.click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await page.setViewportSize({ width: 1440, height: 900 });
  const trigger = page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ });
  await trigger.click();
  await page.locator('[data-workspace-panel="right"] [data-workspace-receipt-collapse]').focus();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("34");
});

test("width changes keep the document scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 600 });
  await openLab(page);
  const viewport = page.locator('[data-slot="lab-result-scroll-area"] [data-slot="scroll-area-viewport"]');
  await viewport.evaluate((element) => { element.scrollTop = 100; });
  const scrollTop = await viewport.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await page.locator("[data-workspace-width-toggle]").click();
  await expect(page.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "wide");
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(scrollTop);
});

test("viewport matrix and reduced motion retain accessible content", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLab(page);
  for (const width of [1366, 1440, 1600, 1920, 2560, 960]) {
    await page.setViewportSize({ width, height: 1080 });
    const button = page.locator("[data-workspace-width-toggle]");
    const available = await page.getByTestId("workspace-document-center").evaluate((element) => element.clientWidth - 32);
    if (available > 1120) await expect(button).toBeVisible();
    else await expect(button).toBeHidden();
    await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator("[data-workspace-width-toggle]").click();
  await expect(page.getByTestId("workspace-document")).toHaveCSS("transition-duration", "0s");
});

test("profile and receipt coexist and non-opt-in module stays unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1080 });
  await page.goto(labUrl.replace("right=closed", "right=open") + "&drawer=patient%3Apatient-coco");
  await expect(page.getByTestId("workspace-right-panel").getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await expect(page.getByTestId("lab-receipt-panel")).toBeVisible();
  await expect(page.locator('[data-workspace-panel="right"]')).toHaveAttribute("data-presentation", "inline");
  await expect.poll(async () => {
    const receipt = await page.getByTestId("lab-receipt-panel").boundingBox();
    const profile = await page.getByTestId("workspace-right-panel").boundingBox();
    return Boolean(receipt && profile && receipt.x + receipt.width <= profile.x + 1);
  }).toBe(true);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("implementation-2560-profile.png") });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.getByRole("complementary", { name: "장비 검사 수신함", exact: true })).toBeVisible();
  await page.locator('[data-workspace-panel="right"] [data-workspace-receipt-collapse]').focus();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("workspace-right-panel").getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await page.goto("/w/clair-demo/reception?modulePanel=open&aside=closed&right=open");
  await expect(page.getByTestId("workspace-document-area")).toHaveCount(0);
  await expect(page.getByTestId("workspace-right-panel")).toBeVisible();
});
