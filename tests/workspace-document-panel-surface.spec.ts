import { expect, test } from "@playwright/test";

const labUrl = "/w/clair-demo/lab?labResultId=lab-result-coco-cbc&modulePanel=open&aside=history&right=open";
test.use({ viewport: { width: 1440, height: 900 } });

test("restored bilateral drawers keep opaque content, shared elevation and edge geometry", async ({ page }) => {
  await page.goto(labUrl);
  const input = page.getByRole("textbox", { name: "HCT 결과값" });
  await expect(input).toBeVisible();
  for (const side of ["left", "right"] as const) {
    const panel = page.locator(`[data-workspace-panel="${side}"]`);
    await expect(panel).toHaveAttribute("data-presentation", "drawer");
    await expect(panel).toHaveAttribute("data-shadow-instant", "true");
    const surface = await panel.evaluate((element) => {
      const content = getComputedStyle(element.firstElementChild!);
      const shadow = getComputedStyle(element, "::before");
      return {
        corners: [content.borderTopLeftRadius, content.borderTopRightRadius, content.borderBottomRightRadius, content.borderBottomLeftRadius],
        borders: [content.borderTopWidth, content.borderRightWidth, content.borderBottomWidth, content.borderLeftWidth],
        borderColors: [content.borderTopColor, content.borderRightColor, content.borderBottomColor, content.borderLeftColor],
        shadowCorners: [shadow.borderTopLeftRadius, shadow.borderTopRightRadius, shadow.borderBottomRightRadius, shadow.borderBottomLeftRadius],
        contentOpacity: content.opacity, shadowOpacity: shadow.opacity, duration: shadow.transitionDuration,
        shadow: shadow.boxShadow, token: getComputedStyle(element).getPropertyValue("--clair-shadow-lg").trim(),
        shadowPointerEvents: shadow.pointerEvents, width: element.getBoundingClientRect().width,
        portalClip: getComputedStyle(element.closest('[data-workspace-panel-portal]')!).clipPath,
      };
    });
    expect(surface.width).toBe(280);
    expect(surface.corners).toEqual(side === "left" ? ["0px", "12px", "12px", "0px"] : ["12px", "0px", "0px", "12px"]);
    expect(surface.shadowCorners).toEqual(surface.corners);
    expect(surface.borders).toEqual(side === "left" ? ["1px", "1px", "1px", "0px"] : ["1px", "0px", "1px", "1px"]);
    surface.borderColors.forEach((color, index) => {
      if (surface.borders[index] === "1px") expect(color).toBe("rgb(229, 229, 229)");
    });
    expect(surface.contentOpacity).toBe("1");
    expect(surface.shadowOpacity).toBe("1");
    expect(surface.duration).toBe("0s");
    expect(surface.token.toLowerCase().replace(/,\s*/g, ",")).toBe("0px 10px 15px -3px #0000001a,0px 4px 6px -4px #0000001a");
    expect(surface.shadow).not.toBe("none");
    expect(surface.shadowPointerEvents).toBe("none");
    expect(surface.portalClip).toBe("none");
  }
  await input.fill("43");
  await expect(input).toHaveValue("43");
});

test("pointer entry, exit and interrupted shadow transition preserve content opacity", async ({ page }) => {
  await page.goto(labUrl.replace("right=open", "right=closed"));
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  const trigger = page.locator('button[aria-controls="lab-receipt-panel-surface"]');
  const result = await trigger.evaluate(async (button) => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await frame(); await frame();
    const panel = document.querySelector<HTMLElement>('[data-workspace-panel="right"]')!;
    const shadow = panel.getAnimations({ subtree: true }).find((animation) => (animation as CSSTransition).transitionProperty === "opacity");
    if (!shadow) throw new Error(JSON.stringify({ attributes: panel.outerHTML.slice(0, 650), opacity: getComputedStyle(panel, "::before").opacity, duration: getComputedStyle(panel, "::before").transitionDuration, animations: document.getAnimations().map((animation) => ({ property: (animation as CSSTransition).transitionProperty, duration: animation.effect?.getTiming().duration })) }));
    shadow.pause(); shadow.currentTime = 60;
    const before = Number(getComputedStyle(panel, "::before").opacity);
    const enterDuration = shadow.effect?.getTiming().duration;
    panel.querySelector<HTMLElement>("[data-workspace-receipt-collapse]")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await frame();
    const exit = panel.getAnimations({ subtree: true }).find((animation) => (animation as CSSTransition).transitionProperty === "opacity")!;
    exit.pause(); exit.currentTime = 0;
    const after = Number(getComputedStyle(panel, "::before").opacity);
    const result = { before, after, enterDuration, exitDuration: getComputedStyle(panel, "::before").transitionDuration,
      contentOpacity: getComputedStyle(panel.firstElementChild!).opacity, inert: panel.inert };
    panel.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
    return result;
  });
  expect(result.enterDuration).toBe(150);
  expect(result.before).toBeGreaterThan(0);
  expect(result.before).toBeLessThan(1);
  expect(Math.abs(result.after - result.before)).toBeLessThan(0.02);
  expect(result.exitDuration).toBe("0.14s");
  expect(result.contentOpacity).toBe("1");
  expect(result.inert).toBe(true);
  await expect(page.locator('[data-workspace-panel="right"]')).toHaveCount(0);
});

test("resize changes elevation without replaying drawer entry or replacing the input", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(labUrl);
  const input = page.getByRole("textbox", { name: "HCT 결과값" });
  await expect(input).toBeVisible();
  await input.fill("44");
  const node = await input.elementHandle();
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const side of ["left", "right"]) {
    const panel = page.locator(`[data-workspace-panel="${side}"]`);
    await expect(panel).toHaveAttribute("data-presentation", "drawer");
    await expect(panel).not.toHaveAttribute("data-shadow-instant", "true");
    const presentation = await panel.evaluate((element) => ({
      transform: getComputedStyle(element).transform,
      slideDuration: getComputedStyle(element).transitionDuration,
      shadowDuration: getComputedStyle(element, "::before").transitionDuration,
    }));
    expect(presentation.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expect(presentation.slideDuration).toBe("0s");
    expect(presentation.shadowDuration).toBe("0.15s");
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  const left = page.locator('[data-workspace-panel="left"]');
  await expect(left).toHaveAttribute("data-presentation", "inline");
  await expect.poll(() => left.evaluate((element) => getComputedStyle(element, "::before").opacity)).toBe("0");
  expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(input).toHaveValue("44");
});

test("keyboard opposite-panel changes, compact selection and reduced motion remain immediate", async ({ page }) => {
  await page.goto(labUrl);
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toBeVisible();
  const areaWidth = (await page.getByTestId("workspace-document-area").boundingBox())!.width;
  await page.setViewportSize({ width: 1440 + 1300 - areaWidth, height: 900 });
  const right = page.locator('[data-workspace-panel="right"]');
  await expect(right).toHaveAttribute("data-presentation", "drawer");
  const trigger = page.locator('button[aria-controls="lab-content-aside-surface"]');
  await trigger.focus();
  await trigger.press("Enter");
  await expect(right).toHaveAttribute("data-presentation", "inline");
  await expect(right).toHaveAttribute("data-shadow-instant", "true");
  await expect.poll(() => right.evaluate((element) => getComputedStyle(element, "::before").transitionDuration)).toBe("0s");
  await right.locator("[data-workspace-receipt-collapse]").focus();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(right).toHaveAttribute("data-shadow-instant", "true");
  await page.getByRole("button", { name: "본문 보기", exact: true }).click();
  await page.getByRole("button", { name: "수신함 보기", exact: true }).click();
  await expect(right).toHaveAttribute("data-shadow-instant", "true");
  await right.locator("[data-workspace-receipt-collapse]").click();
  await expect(right).toHaveCount(0);
  await page.locator('button[aria-controls="lab-receipt-panel-surface"]').click();
  await expect(right).toBeVisible();
  await expect(right).toHaveAttribute("data-shadow-instant", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(right).toHaveAttribute("data-shadow-instant", "true");
});
