import { expect, test, type Page } from "@playwright/test";

const route = "/w/clair-demo/reception?modulePanel=open";

async function calendarGeometry(page: Page) {
  return page.getByTestId("reception-calendar-frame").evaluate((frame) => {
    const rect = frame.getBoundingClientRect();
    const viewport = frame.querySelector('[data-slot="scroll-area-viewport"]');
    return { width: rect.width, right: rect.right, top: rect.top, scrollTop: viewport?.scrollTop };
  });
}

test("reception overlay preserves calendar width and scroll across queue and calendar selection", async ({ page }) => {
  await page.goto(route);
  const calendar = page.getByTestId("reception-calendar-frame");
  await expect(page.getByTestId("appointment-card-appointment-nabi-260501")).toBeVisible();
  await calendar.locator('[data-slot="scroll-area-viewport"]').first().evaluate((el) => { el.scrollTop = 450; });
  const before = await calendarGeometry(page);
  await page.getByTestId("patient-card-patient-haru").click();
  const drawer = page.getByTestId("reception-calendar-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("접수 상세", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const geometry = await calendarGeometry(page);
    return { width: geometry.width, scrollTop: geometry.scrollTop };
  }).toEqual({ width: before.width, scrollTop: before.scrollTop });
  await expect.poll(async () => {
    const rect = await drawer.boundingBox();
    return Math.round((rect?.x ?? 0) + (rect?.width ?? 0));
  }).toBe(Math.round(before.right));
  const bounds = await drawer.boundingBox();
  expect(bounds?.width).toBe(380);
  expect(bounds?.y).toBe((await calendarGeometry(page)).top);
  const toolbar = await page.getByTestId("schedule-check-in-button").boundingBox();
  expect((toolbar?.y ?? 0) + (toolbar?.height ?? 0)).toBeLessThanOrEqual(bounds?.y ?? 0);

  await calendar.locator('[data-slot="scroll-area-viewport"]').first().evaluate((el) => { el.scrollTop = 0; });
  await page.getByTestId("appointment-card-appointment-nabi-260501").click();
  await expect(drawer.getByText("예약 상세", { exact: true })).toBeVisible();
  await expect(drawer).toHaveCount(1);
  await expect(page.getByTestId("workspace-right-panel").getByTestId("reception-right-panel")).toHaveCount(0);
  await drawer.getByRole("button", { name: "우측 사이드 패널 닫기" }).click();
  await expect(drawer).toHaveCount(0);
  expect((await calendarGeometry(page)).width).toBe(before.width);
  await page.getByTestId("appointment-card-appointment-nabi-260501").click();
  await expect(drawer.getByText("예약 상세", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/right=open/);
  await expect(page).toHaveURL(/drawer=reception-appointment/);
  await page.reload();
  await expect(drawer.getByText("예약 상세", { exact: true })).toBeVisible();
});

test("reception create cancellation keeps calendar full width and clears the drawer", async ({ page }) => {
  await page.goto(route);
  await expect(page.getByTestId("appointment-card-appointment-nabi-260501")).toBeVisible();
  const before = await calendarGeometry(page);
  for (const label of ["예약하기", "접수하기"]) {
    await page.getByTestId("schedule-check-in-button").click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    const drawer = page.getByTestId("reception-calendar-drawer");
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(label === "예약하기" ? /drawer=reception-reservation-form/ : /drawer=reception-form/);
    await expect.poll(async () => (await calendarGeometry(page)).width).toBe(before.width);
    await drawer.getByRole("button", { name: "취소", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByTestId("reception-right-panel")).toHaveCount(0);
    await expect(page).toHaveURL(/right=closed/);
    await expect(page).not.toHaveURL(/drawer=/);
    expect((await calendarGeometry(page)).width).toBe(before.width);
  }
});

test("reception drawer fits a narrow viewport and Escape restores opener focus with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${route}&right=open&drawer=reception-form%3Awalk-in`);
  const drawer = page.getByTestId("reception-calendar-drawer");
  await expect(drawer).toBeVisible();
  const rect = await drawer.boundingBox();
  expect(rect?.width).toBeLessThanOrEqual(390);
  expect(rect?.x).toBeGreaterThanOrEqual(0);
  await expect(drawer.getByRole("button", { name: "취소", exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "우측 사이드 패널 닫기" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/right=closed/);
  const opener = page.getByTestId("schedule-check-in-button");
  await opener.click();
  await page.getByRole("menuitem", { name: "접수하기", exact: true }).click();
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/right=open/);
  await drawer.getByRole("button", { name: "우측 사이드 패널 닫기" }).focus();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("appointment-to-reception creation uses the overlay while patient profiles keep the shell panel", async ({ page }) => {
  await page.goto(`${route}&right=open&drawer=reception-appointment-check-in-form%3Aappointment-nabi-260501`);
  const drawer = page.getByTestId("reception-calendar-drawer");
  await expect(drawer.getByTestId("appointment-check-in-form-drawer")).toBeVisible();
  await expect(drawer.locator("header").getByText("접수 생성", { exact: true })).toBeVisible();
  await page.goto(`${route}&drawer=reception-patient%3Apatient-dubu`);
  await expect(page.getByTestId("workspace-right-panel").getByTestId("profile-side-panel")).toBeVisible();
  await expect(drawer).toHaveCount(0);
});

test("reception profile-origin Escape respects the discard guard and restores the patient profile", async ({ page }) => {
  await page.goto(`${route}&drawer=reception-patient%3Apatient-dubu`);
  await page.getByRole("button", { name: "접수/예약", exact: true }).click();
  await page.getByRole("menuitem", { name: "접수하기", exact: true }).click();
  const drawer = page.getByTestId("reception-calendar-drawer");
  await expect(drawer).toBeVisible();
  await expect(page.getByTestId("workspace-right-panel").getByTestId("reception-right-panel")).toHaveCount(0);
  const purpose = drawer.getByRole("textbox", { name: "방문목적" });
  await purpose.fill("Synthetic drawer draft");
  await purpose.press("Escape");
  const confirm = page.getByRole("dialog", { name: "작성 중인 내용을 버릴까요?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "계속 작성", exact: true }).click();
  await expect(purpose).toHaveValue("Synthetic drawer draft");
  await purpose.press("Escape");
  await confirm.getByRole("button", { name: "나가기", exact: true }).click();
  await expect(page.getByTestId("workspace-right-panel").getByTestId("profile-side-panel")).toBeVisible();
  await expect(drawer).toHaveCount(0);
});
