import { expect, test } from "@playwright/test";

const labUrl = "/w/clair-demo/lab?labResultId=lab-result-coco-cbc&modulePanel=open&aside=closed&right=closed";
test.use({ viewport: { width: 1920, height: 1080 } });

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
    return [contentBox.x - documentBox.x, contentBox.width - documentBox.width, documentBox.x - toolbarBox.x - 16, documentBox.width - toolbarBox.width + 32];
  }).toEqual([0, 0, 0, 0]);
  await expect(widthButton).toBeVisible();
  await page.mouse.move(0, 0);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: "docs/completed/design/2026-09-29-workspace-width-proposal/assets/implementation-1920-wide.png" });
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
  await page.screenshot({ path: "docs/completed/design/2026-09-29-workspace-width-proposal/assets/implementation-1920-narrow.png" });
});

test("bilateral internal panels sit below full toolbar and hide ineffective width toggle", async ({ page }) => {
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
    expect(box.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  }
  await expect(page.getByTestId("workspace-right-panel").locator("#lab-receipt-panel")).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: "docs/completed/design/2026-09-29-workspace-width-proposal/assets/implementation-1920-panels.png" });
});

test("narrow fallback traps focus, restores trigger and preserves inputs", async ({ page }) => {
  await openLab(page);
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("32");
  await page.setViewportSize({ width: 1440, height: 900 });
  const trigger = page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "장비 검사 수신함", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-slot="tooltip-content"]:visible')).toHaveCount(0);
  await page.screenshot({ path: "docs/completed/design/2026-09-29-workspace-width-proposal/assets/implementation-1440-modal.png" });
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("lab-receipt-panel")).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("32");
  await expect(page).toHaveURL(/right=closed/);
});

test("modal receipt permits nested confirmation and returning to review", async ({ page }) => {
  await openLab(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ }).click();
  const receipt = page.getByTestId("lab-receipt-panel");
  await receipt.getByRole("button", { name: "결과 붙여넣기" }).click();
  const confirmation = page.getByRole("dialog").filter({ hasText: "이전에 입력된 수치가 있으면" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "장비 검사 수신함", exact: true })).toBeVisible();
});

test("panel presentation changes preserve review state and the latest panel owns narrow space", async ({ page }) => {
  await openLab(page);
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("33");
  const trigger = page.getByRole("button", { name: /장비 검사 수신함 새 장비결과/ });
  await trigger.click();
  const receipt = page.getByTestId("lab-receipt-panel");
  await receipt.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog", { name: "장비 검사 수신함", exact: true })).toBeVisible();
  await expect(receipt.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator('[data-workspace-panel="right"]')).toHaveAttribute("data-presentation", "inline");
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("33");
  await expect(receipt.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "임상병리검사 이력 패널 열기" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog", { name: "임상병리검사 이력", exact: true })).toBeVisible();
  await expect(receipt).toBeHidden();
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
  await page.screenshot({ path: "docs/completed/design/2026-09-29-workspace-width-proposal/assets/implementation-2560-profile.png" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.getByRole("dialog", { name: "장비 검사 수신함", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("workspace-right-panel").getByRole("heading", { name: "환자 정보" })).toBeVisible();
  await page.goto("/w/clair-demo/reception?modulePanel=open&aside=closed&right=open");
  await expect(page.getByTestId("workspace-document-area")).toHaveCount(0);
  await expect(page.getByTestId("workspace-right-panel")).toBeVisible();
});
