import { expect, test } from "@playwright/test";

const labUrl = "/w/clair-demo/lab?labResultId=lab-result-coco-cbc&modulePanel=open&aside=closed&right=closed";
test.use({ viewport: { width: 1920, height: 1080 } });

test("pointer history slides and pushes the mounted title/body together, then slides back", async ({ page }) => {
  await page.goto(labUrl);
  const input = page.getByRole("textbox", { name: "HCT 결과값" });
  await expect(input).toBeVisible();
  await input.fill("35");
  const inputNode = await input.elementHandle();
  const doc = page.getByTestId("workspace-document");
  const toolbar = page.getByTestId("workspace-document-toolbar");
  const initial = (await doc.boundingBox())!;
  const trigger = page.getByRole("button", { name: "임상병리검사 이력 패널 열기" });
  // Dispatch a pointer click without Playwright's post-action settling so the midpoint is observable.
  await trigger.evaluate((button) => button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
  const panel = page.locator('[data-workspace-panel="left"]');
  await expect(panel).toBeVisible();
  const motion = await doc.evaluate((element) => {
    const animation = element.getAnimations()[0];
    const popup = document.querySelector<HTMLElement>('[data-workspace-panel="left"]')!;
    const title = document.querySelector<HTMLElement>('[data-testid="workspace-document-toolbar"]')!;
    return {
      active: Boolean(animation), keys: (animation?.effect as KeyframeEffect)?.getKeyframes(),
      duration: animation?.effect?.getTiming().duration,
      titleOffset: title.getBoundingClientRect().left - element.getBoundingClientRect().left,
      opacity: getComputedStyle(popup).opacity,
    };
  });
  expect(motion.active).toBe(true);
  expect(motion.duration).toBe(180);
  expect(motion.keys?.[0].transform).toBe("translateX(-280px)");
  expect(motion.titleOffset).toBe(0);
  expect(motion.opacity).toBe("1");
  await expect.poll(async () => (await doc.boundingBox())!.x).toBe(initial.x + 280);
  expect((await panel.boundingBox())!.y).toBe((await toolbar.boundingBox())!.y);
  await panel.locator('[data-workspace-history-collapse]').evaluate((button) => button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
  const closing = await panel.evaluate((element) => ({
    hidden: (element as HTMLElement).hidden, inert: (element as HTMLElement).inert,
    duration: getComputedStyle(element).transitionDuration,
    opacity: getComputedStyle(element).opacity,
  }));
  expect(closing.hidden).toBe(false);
  expect(closing.inert).toBe(true);
  expect(closing.duration).toBe("0.14s");
  expect(closing.opacity).toBe("1");
  await expect(panel).toBeHidden();
  await expect.poll(async () => (await doc.boundingBox())!.x).toBe(initial.x);
  expect(await inputNode!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(input).toHaveValue("35");
});

test("rapid reversal starts from the visible position and history group state survives reopening", async ({ page }) => {
  await page.goto(labUrl);
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  const trigger = page.getByRole("button", { name: "임상병리검사 이력 패널 열기" });
  await trigger.evaluate((button) => button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
  const continuity = await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const doc = document.querySelector<HTMLElement>('[data-testid="workspace-document"]')!;
    const opening = doc.getAnimations()[0];
    opening.pause();
    opening.currentTime = 60;
    const before = doc.getBoundingClientRect().left;
    document.querySelector<HTMLElement>('[data-workspace-panel="left"] [data-workspace-history-collapse]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const animation = doc.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    return { before, after: doc.getBoundingClientRect().left, duration: animation.effect?.getTiming().duration };
  });
  expect(Math.abs(continuity.after - continuity.before)).toBeLessThan(1);
  expect(continuity.duration).toBe(140);
  await page.getByTestId("workspace-document").evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
  await expect(page.locator('[data-workspace-panel="left"]')).toBeHidden();
  await trigger.click();
  const group = page.locator('[data-workspace-panel="left"] [data-slot="content-history-group-title"]').first();
  await group.click();
  const expanded = await group.getAttribute("aria-expanded");
  const groupNode = await group.elementHandle();
  await page.locator('[data-workspace-history-collapse]').click();
  await expect(page.locator('[data-workspace-panel="left"]')).toBeHidden();
  await trigger.click();
  expect(await groupNode!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(group).toHaveAttribute("aria-expanded", expanded!);
});

test("keyboard and reduced motion open/close immediately and leave no focus in hidden history", async ({ page }) => {
  await page.goto(labUrl);
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  const trigger = page.getByRole("button", { name: /임상병리검사 이력 패널/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const panel = page.locator('[data-workspace-panel="left"]');
  await expect(panel).toHaveCSS("transition-duration", "0s");
  expect(await page.getByTestId("workspace-document").evaluate((element) => element.getAnimations().length)).toBe(0);
  await trigger.press("Enter");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await expect(panel).toHaveCSS("transition-duration", "0s");
  expect(await page.getByTestId("workspace-document").evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel).toHaveAttribute("data-presentation", "modal");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("restored history and resize settle without slide animation", async ({ page }) => {
  await page.goto(labUrl.replace("aside=closed", "aside=history"));
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  const panel = page.locator('[data-workspace-panel="left"]');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("transition-duration", "0s");
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(panel).toHaveCSS("transition-duration", "0s");
  expect(await page.getByTestId("workspace-document").evaluate((element) => element.getAnimations().length)).toBe(0);
});
