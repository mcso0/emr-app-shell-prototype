import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as fixtureWorkspace } from "../src/lib/emr-domain/demo-workspaces";

const startRoute = "/w/clair-demo/reception?modulePanel=closed&right=closed&date=2026-05-01";
const rail = (page: Page) => page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" });
const host = (page: Page) => page.getByTestId("module-side-panel-host");
const shown = (page: Page, id: string) => host(page).locator(`[data-side-panel-module="${id}"]:not([hidden])`);
const menu = (page: Page, name: string) => rail(page).getByRole("link", { name, exact: true });

// Every API call stays in the browser fixture. These tests do not write a DB.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    if (new URL(route.request().url()).pathname === "/api/workspaces") {
      await route.fulfill({ json: { ok: true, workspaces: [{ id: "clair-demo", status: "active", displayName: "UI 검증 병원", roles: ["hospital_admin"] }] } });
      return;
    }
    await route.fulfill({ status: 403, json: { ok: false, status: 403, error: "fixture-denied" } });
  });
});

async function enter(page: Page, route = startRoute) {
  await page.goto(route);
  await expect(rail(page)).toBeVisible();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
}

async function hover(page: Page, name = "접수/예약", id = "reception") {
  await menu(page, name).hover();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await expect(shown(page, id)).toBeVisible();
}

async function outside(page: Page) {
  const box = await page.getByTestId("shell-right-section").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width - 30, box!.y + 10);
}

test("hover preserves the URL and content geometry; panel and bridge retain it", async ({ page }) => {
  await enter(page);
  const initialUrl = page.url();
  const mainBox = await page.getByTestId("shell-workspace-area").boundingBox();
  await hover(page);
  expect(page.url()).toBe(initialUrl);
  expect(await page.getByTestId("shell-workspace-area").boundingBox()).toEqual(mainBox);
  const panelBox = await host(page).boundingBox();
  expect(panelBox?.width).toBe(288);
  await page.mouse.move(panelBox!.x - 5, panelBox!.y + 175);
  await page.waitForTimeout(300);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await page.mouse.move(panelBox!.x + 150, panelBox!.y + 120);
  await page.waitForTimeout(300);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await outside(page);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  expect(page.url()).toBe(initialUrl);
});

test("other menu hover switches only the existing preview and does not select records", async ({ page }) => {
  await enter(page);
  const initialUrl = page.url();
  const mutations: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/") && request.method() !== "GET" && !request.url().endsWith("/app-shell/workspace-tabs")) mutations.push(request.url());
  });
  for (const [name, id] of [["접수/예약", "reception"], ["진료/차트", "treatment"], ["임상병리검사", "lab"], ["영상검사", "imaging"], ["조제/처치", "dispensing"], ["수납", "billing"], ["홈 화면", "home"], ["고객관리", "customer"], ["병원관리", "orders"]]) {
    await hover(page, name, id);
    await expect(host(page).locator("[data-side-panel-module]:not([hidden])")).toHaveCount(1);
    await page.waitForTimeout(250);
    expect(page.url()).toBe(initialUrl);
    await expect(menu(page, "접수/예약")).toHaveAttribute("aria-current", "page");
  }
  expect(mutations).toEqual([]);
});

test("menu click and Enter navigate without pinning, including home", async ({ page }) => {
  await enter(page);
  await hover(page, "고객관리", "customer");
  await menu(page, "고객관리").click();
  await expect(page).toHaveURL(/\/customer\?.*modulePanel=closed/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await menu(page, "홈 화면").press("Enter");
  await expect(page).toHaveURL(/\/home\?.*modulePanel=closed/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await menu(page, "접수/예약").press("Enter");
  await expect(page).toHaveURL(/\/reception\?.*modulePanel=closed/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
});

test("top expand pins the current page even when a different preview is shown", async ({ page }) => {
  await enter(page);
  await hover(page, "임상병리검사", "lab");
  await rail(page).getByRole("button", { name: "사이드 패널 펼치기", exact: true }).click();
  await expect(page).toHaveURL(/\/reception\?.*modulePanel=open/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "docked");
  await expect(shown(page, "reception")).toBeVisible();
  await expect(shown(page, "reception").getByRole("button", { name: "사이드 패널 접기", exact: true })).toBeFocused();
  await outside(page);
  await page.keyboard.press("Escape");
  await expect(host(page)).toHaveAttribute("data-panel-mode", "docked");
});

test("existing right header pins without remounting search or changing geometry", async ({ page }) => {
  await enter(page);
  await hover(page);
  const button = shown(page, "reception").getByRole("button", { name: "사이드 패널 고정", exact: true });
  const header = shown(page, "reception").getByRole("button", { name: /사이드 패널 (고정|접기)/ }).locator("..");
  const before = await header.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(before?.height).toBe(56);
  expect(buttonBox?.width).toBe(24);
  expect(buttonBox?.height).toBe(24);
  expect(Math.round(before!.x + before!.width - buttonBox!.x - buttonBox!.width)).toBe(16);
  const floatingIcon = await button.locator("svg").evaluate(icon => ({ width: getComputedStyle(icon).width, height: getComputedStyle(icon).height, color: getComputedStyle(icon).color, rotate: getComputedStyle(icon).rotate }));
  expect(floatingIcon.width).toBe("16px");
  expect(floatingIcon.height).toBe("16px");
  expect(floatingIcon.rotate).toBe("-20deg");
  const headerNode = await header.elementHandle();
  await shown(page, "reception").getByRole("button", { name: "검색", exact: true }).click();
  const input = shown(page, "reception").getByRole("searchbox", { name: "대기열 검색", exact: true });
  await input.fill("하루");
  const inputNode = await input.elementHandle();
  await outside(page);
  await page.waitForTimeout(300);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await button.click();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "docked");
  await expect(page).toHaveURL(/modulePanel=open/);
  await expect(input).toHaveValue("하루");
  expect(await input.evaluate((node, old) => node === old, inputNode)).toBe(true);
  expect(await header.evaluate((node, old) => node === old, headerNode)).toBe(true);
  const dockedIcon = await shown(page, "reception").getByRole("button", { name: "사이드 패널 접기", exact: true }).locator("svg").evaluate(icon => ({ width: getComputedStyle(icon).width, height: getComputedStyle(icon).height, color: getComputedStyle(icon).color, rotate: getComputedStyle(icon).rotate }));
  expect(dockedIcon).toEqual({ ...floatingIcon, rotate: "none" });
  const after = await header.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  await shown(page, "reception").getByRole("button", { name: "사이드 패널 접기", exact: true }).click();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await expect(menu(page, "접수/예약")).toBeFocused();
});

test("foreign preview header explicitly navigates and pins its module", async ({ page }) => {
  await enter(page);
  await hover(page, "고객관리", "customer");
  await shown(page, "customer").getByRole("button", { name: "사이드 패널 고정", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\?.*modulePanel=open/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "docked");
  await expect(shown(page, "customer")).toBeVisible();
});

test("ArrowRight opens without navigation; Escape returns focus and prevents reopen", async ({ page }) => {
  await enter(page);
  const initialUrl = page.url();
  await menu(page, "고객관리").press("ArrowRight");
  await expect(shown(page, "customer")).toBeVisible();
  await expect(shown(page, "customer").getByRole("button", { name: "사이드 패널 고정", exact: true })).toBeFocused();
  expect(page.url()).toBe(initialUrl);
  await page.keyboard.press("Escape");
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await expect(menu(page, "고객관리")).toBeFocused();
  await page.waitForTimeout(300);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
});

test("owned card menu survives pointer exit and receives Escape before preview", async ({ page }) => {
  await enter(page);
  await hover(page);
  await shown(page, "reception").getByRole("button", { name: "하루 카드 작업", exact: true }).click();
  const popup = page.locator('[data-slot="dropdown-menu-content"][data-module-side-panel-owner="module-side-panel-reception"]');
  await expect(popup).toBeVisible();
  await outside(page);
  await page.waitForTimeout(300);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await page.keyboard.press("Escape");
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await hover(page);
  await expect(popup).not.toBeVisible();
});

for (const action of ["filter choice", "group toggle"] as const) {
  test(`mouse button focus after ${action} cannot block switching or reopening previews`, async ({ page }) => {
    await fixtureChartQueue(page);
    await enter(page, "/w/clair-demo/billing?modulePanel=closed&right=open&date=2026-05-01");
    await hover(page, "진료/차트", "treatment");
    const initialUrl = page.url();
    if (action === "filter choice") {
      const filter = shown(page, "treatment").getByRole("button", { name: "대기열 필터", exact: true });
      await filter.click();
      await page.getByRole("menuitemradio", { name: "담당 미정", exact: true }).click();
      await expect(page.locator('[data-slot="dropdown-menu-content"][data-module-side-panel-owner="module-side-panel-treatment"]')).not.toBeVisible();
      await expect(filter).toBeFocused();
    } else {
      await shown(page, "treatment").getByRole("button", { name: "진행중 접기", exact: true }).click();
      await expect(shown(page, "treatment").getByRole("button", { name: "진행중 펼치기", exact: true })).toBeFocused();
    }
    await hover(page, "영상검사", "imaging");
    await outside(page);
    await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
    await hover(page, "진료/차트", "treatment");
    if (action === "filter choice") {
      await expect(shown(page, "treatment").getByRole("button", { name: "대기열 필터", exact: true })).toHaveAttribute("data-filter", "unassigned");
    } else {
      await expect(shown(page, "treatment").getByRole("button", { name: "진행중 펼치기", exact: true })).toBeVisible();
    }
    await outside(page);
    await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
    await hover(page, "수납", "billing");
    expect(page.url()).toBe(initialUrl);
  });
}

test("keyboard focus retains preview until deliberate mouse hover switches it", async ({ page }) => {
  await enter(page);
  const initialUrl = page.url();
  await menu(page, "고객관리").press("ArrowRight");
  await expect(shown(page, "customer").getByRole("button", { name: "사이드 패널 고정", exact: true })).toBeFocused();
  await page.waitForTimeout(350);
  await expect(shown(page, "customer")).toBeVisible();
  await hover(page, "영상검사", "imaging");
  await outside(page);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  expect(page.url()).toBe(initialUrl);
});

test("focused search and IME retain preview while ordinary mouse focus does not", async ({ page }) => {
  await enter(page);
  await hover(page);
  await shown(page, "reception").getByRole("button", { name: "검색", exact: true }).click();
  const input = shown(page, "reception").getByRole("searchbox", { name: "대기열 검색", exact: true });
  await input.fill("하루");
  await input.dispatchEvent("compositionstart");
  await outside(page);
  await menu(page, "영상검사").hover();
  await page.waitForTimeout(350);
  await expect(shown(page, "reception")).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("하루");
  await input.dispatchEvent("compositionend");
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await input.press("Escape");
  await expect(input).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await outside(page);
  await hover(page, "영상검사", "imaging");
});

test("search and unavailable menu keep tooltips; unavailable menu cannot navigate", async ({ page }) => {
  await enter(page);
  await hover(page);
  await rail(page).getByRole("button", { name: "전역 통합 검색 열기" }).hover();
  await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: "검색" })).toBeVisible();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  const url = page.url();
  await rail(page).getByRole("button", { name: "입원(작업 중)", exact: true }).hover();
  await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: "입원" })).toBeVisible();
  await expect(rail(page).getByRole("button", { name: "입원(작업 중)", exact: true })).toBeDisabled();
  expect(page.url()).toBe(url);
});

test("short hover and a canceled preview cannot open later", async ({ page }) => {
  await enter(page);
  const box = await menu(page, "접수/예약").boundingBox();
  await page.mouse.move(box!.x + 16, box!.y + 16);
  await page.mouse.move(800, 55);
  await page.waitForTimeout(350);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await hover(page);
  await outside(page);
  await page.getByRole("button", { name: "새 업무 탭", exact: true }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.waitForTimeout(350);
  // A new tab keeps its existing default layout; the old preview is discarded.
  await expect(host(page)).not.toHaveAttribute("data-panel-mode", "floating");
  await expect(host(page).locator('[data-side-panel-module="reception"]')).toHaveCount(0);
});

test("compact viewport has no hover and uses the unchanged panel in an explicit sheet", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enter(page);
  await menu(page, "접수/예약").hover();
  await page.waitForTimeout(350);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  const expand = rail(page).getByRole("button", { name: "사이드 패널 펼치기", exact: true });
  await expand.click();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "sheet");
  await expect(host(page)).toHaveAttribute("role", "dialog");
  await expect(host(page)).toHaveAttribute("aria-modal", "true");
  expect((await host(page).boundingBox())?.width).toBe(288);
  await expect(shown(page, "reception").getByRole("button", { name: "사이드 패널 접기", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await host(page).evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await expect(expand).toBeFocused();
});


test("canceling a duplicate tab pin leaves the current page closed", async ({ page }) => {
  const currentRoute = "/w/clair-demo/home?patientId=patient-haru&modulePanel=closed";
  const duplicateRoute = "/w/clair-demo/customer?patientId=patient-haru&modulePanel=closed";
  const tab = (id: string, route: string, moduleId: string) => ({
    id, title: moduleId === "home" ? "원내 현황" : "고객관리", closable: true,
    history: [route], historyIndex: 0, moduleId, lastRoute: route,
    surfaceType: moduleId === "customer" ? "patient" : "module",
    surfaceId: moduleId === "customer" ? "patient-haru" : "home",
    dedupeKey: moduleId === "customer" ? "clair-demo:patient:patient-haru" : "clair-demo:module:home",
    updatedAt: "2026-10-06T00:00:00.000Z",
  });
  await page.route("**/api/workspaces/clair-demo/app-shell/workspace-tabs", async route => {
    await route.fulfill({ json: { ok: true, status: 200, payload: {
      activeTabId: "preview-current", tabs: [tab("preview-duplicate", duplicateRoute, "customer"), tab("preview-current", currentRoute, "home")],
    } } });
  });
  await enter(page, currentRoute);
  await expect(page.getByRole("tablist", { name: "열린 업무 탭" }).getByRole("tab")).toHaveCount(2);
  await hover(page, "고객관리", "customer");
  await shown(page, "customer").getByRole("button", { name: "사이드 패널 고정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "같은 업무가 이미 열려 있습니다" });
  await expect(dialog).toBeVisible();
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page).toHaveURL(/\/home\?.*modulePanel=closed/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
});

test("pointer drag over the rail cannot open a preview", async ({ page }) => {
  await enter(page);
  await page.mouse.move(800, 55);
  await page.mouse.down();
  const box = await menu(page, "접수/예약").boundingBox();
  await page.mouse.move(box!.x + 16, box!.y + 16);
  await page.waitForTimeout(350);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await page.mouse.up();
  await outside(page);
  await hover(page);
});

test("a late foreign queue response cannot change the current route or newer preview", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("**/chart/live-queue?*", async route => {
    started = true;
    await gate;
    await route.fulfill({ json: { ok: true, queue: [], status: 200 } });
  });
  await enter(page);
  const initialUrl = page.url();
  await hover(page, "진료/차트", "treatment");
  await expect.poll(() => started).toBe(true);
  await hover(page, "고객관리", "customer");
  release();
  await page.waitForTimeout(300);
  expect(page.url()).toBe(initialUrl);
  await expect(shown(page, "customer")).toBeVisible();
  await expect(menu(page, "접수/예약")).toHaveAttribute("aria-current", "page");
});

test.describe("touch pointer", () => {
  test.use({ hasTouch: true });
  test("tap navigates without preview; only explicit expand pins", async ({ page }) => {
    await enter(page);
    await menu(page, "고객관리").tap();
    await expect(page).toHaveURL(/\/customer\?.*modulePanel=closed/);
    await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
    await rail(page).getByRole("button", { name: "사이드 패널 펼치기", exact: true }).tap();
    await expect(host(page)).toHaveAttribute("data-panel-mode", "docked");
    await expect(page).toHaveURL(/modulePanel=open/);
  });
});


test("reopening a cached preview uses the current operating date", async ({ page }) => {
  const dates: string[] = [];
  await page.route("**/chart/live-queue?*", async route => {
    dates.push(new URL(route.request().url()).searchParams.get("date") ?? "");
    await route.fulfill({ json: { ok: true, queue: [], status: 200 } });
  });
  await enter(page);
  await hover(page, "진료/차트", "treatment");
  await expect.poll(() => dates.at(-1)).toBe("2026-05-01");
  await hover(page);
  await shown(page, "reception").getByRole("button", { name: "26.05.02 (토) 선택", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-05-02/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await expect(shown(page, "reception")).toBeVisible();
  await outside(page);
  await hover(page, "진료/차트", "treatment");
  await expect.poll(() => dates.at(-1)).toBe("2026-05-02");
  await expect(page).toHaveURL(/\/reception\?.*date=2026-05-02/);
});


test("an existing sidebar chart action navigates without implicit pin", async ({ page }) => {
  await enter(page);
  await hover(page);
  await shown(page, "reception").getByRole("button", { name: "하루 카드 작업", exact: true }).click();
  await page.getByRole("menuitem", { name: "차트 보러가기", exact: true }).click();
  await expect(page).toHaveURL(/\/treatment\?.*modulePanel=closed/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  expect(new URL(page.url()).searchParams.get("encounterId")).toBeTruthy();
});

test("the existing patient grouping view survives floating-to-pin", async ({ page }) => {
  await page.route("**/fulfillment/work-items?*", async route => {
    await route.fulfill({ json: { ok: true, workItems: [0, 1].map(n => ({
      id: `preview-lab-${n}`, workspaceId: "clair-demo", queueType: "lab", orderType: "lab",
      patientId: "preview-patient", patientName: "합성 환자", guardianName: "합성 보호자",
      encounterId: "preview-encounter", orderId: `preview-order-${n}`, status: "requested",
      priority: "normal", assignedToUserId: null, requestedByUserId: "user-vet", requesterName: "합성 요청자",
      requestCycle: 1, rowRevision: 1, originChartId: "preview-chart", originChartCreatedAt: "2026-05-01T01:00:00Z",
      createdAt: "2026-05-01T01:00:00Z", updatedAt: "2026-05-01T01:00:00Z",
      sourceSnapshot: { orderDisplayName: `합성 검사 ${n}`, inHospitalOrderName: `합성 검사 ${n}`, patientName: "합성 환자", guardianName: "합성 보호자" },
    })) } });
  });
  await enter(page);
  await hover(page, "임상병리검사", "lab");
  const toggle = shown(page, "lab").getByTestId("patient-queue-view-toggle");
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const group = shown(page, "lab").locator('section[data-testid^="patient-queue-group-"]');
  await expect(group.first()).toBeVisible();
  const count = await group.count();
  const firstGroup = group.first();
  const node = await firstGroup.elementHandle();
  await shown(page, "lab").getByRole("button", { name: "사이드 패널 고정", exact: true }).click();
  await expect(page).toHaveURL(/\/lab\?.*modulePanel=open/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "docked");
  await expect(group).toHaveCount(count);
  expect(await firstGroup.evaluate((current, previous) => current === previous, node)).toBe(true);
});

test("reopening a foreign preview reads a fresh queue on the same date", async ({ page }) => {
  let reads = 0;
  await page.route("**/chart/live-queue?*", async route => {
    reads += 1;
    await route.fulfill({ json: { ok: true, queue: [], status: 200 } });
  });
  await enter(page);
  await hover(page, "진료/차트", "treatment");
  await expect.poll(() => reads).toBeGreaterThan(0);
  const completedReads = reads;
  const header = shown(page, "treatment").getByRole("button", { name: "사이드 패널 고정", exact: true });
  const node = await header.elementHandle();
  await outside(page);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await hover(page, "진료/차트", "treatment");
  await expect.poll(() => reads).toBeGreaterThan(completedReads);
  expect(await header.evaluate((current, previous) => current === previous, node)).toBe(true);
  await expect(page).toHaveURL(/\/reception\?.*modulePanel=closed/);
});

test("reopening reception does not join an invalidated pending read", async ({ page }) => {
  let reads = 0;
  let firstCycle = true;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/reception/queue?*", async route => {
    reads += 1;
    if (firstCycle) {
      await gate;
      await route.fulfill({ status: 403, json: { ok: false, status: 403, denialReason: "permission_missing" } });
      return;
    }
    await route.fulfill({ json: {
      ok: true, status: 200, queue: [], enforcedBy: "reception-queue-read",
      summary: { appointmentCount: 0, receptionCount: 0, totalCount: 0, date: "2026-05-01", workspaceId: "clair-demo" },
    } });
  });
  await enter(page, startRoute.replace("/reception?", "/home?"));
  await hover(page);
  await expect.poll(() => reads).toBeGreaterThan(0);
  await outside(page);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  const pendingReads = reads;
  firstCycle = false;
  await hover(page);
  await expect.poll(() => reads).toBeGreaterThan(pendingReads);
  release();
  await page.waitForTimeout(300);
  await expect(shown(page, "reception").getByText("서버 대기열을 불러오지 못했습니다", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/home\?.*modulePanel=closed/);
});


test("current date changes retain the floating panel", async ({ page }) => {
  await enter(page);
  await hover(page);
  await shown(page, "reception").getByRole("button", { name: "26.05.02 (토) 선택", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-05-02/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await expect(shown(page, "reception")).toBeVisible();
});

test("foreign preview changes date without navigating the main page", async ({ page }) => {
  const dates: string[] = [];
  await page.route("**/chart/live-queue?*", async route => {
    dates.push(new URL(route.request().url()).searchParams.get("date") ?? "");
    await route.fulfill({ json: { ok: true, queue: [], status: 200 } });
  });
  await enter(page);
  const initialUrl = page.url();
  await hover(page, "진료/차트", "treatment");
  await expect.poll(() => dates.at(-1)).toBe("2026-05-01");
  await shown(page, "treatment").getByRole("button", { name: "다음 날짜", exact: true }).click();
  await expect.poll(() => dates.at(-1)).toBe("2026-05-02");
  expect(page.url()).toBe(initialUrl);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  await expect(shown(page, "treatment")).toContainText("26.05.02");
});


async function fixtureChartQueue(page: Page) {
  await page.route("**/chart/live-queue?*", route => route.fulfill({ json: {
    ok: true, status: 200, queue: [{
      encounter: { id: "synthetic-sidebar-chart", workspaceId: "clair-demo", patientId: "synthetic-sidebar-patient", encounterNo: "E-SYNTHETIC", chiefComplaint: "합성 진료", status: "in_consultation", checkedInAt: "2026-05-01T01:00:00Z", startedAt: "2026-05-01T01:00:00Z", createdAt: "2026-05-01T01:00:00Z", updatedAt: "2026-05-01T01:00:00Z" },
      patient: { id: "synthetic-sidebar-patient", workspaceId: "clair-demo", patientNo: "P-SYNTHETIC", name: "합성 환자", species: "dog", sex: "male", handlingCautionLocked: false, status: "active", createdAt: "2026-05-01T01:00:00Z", updatedAt: "2026-05-01T01:00:00Z" },
      queueEntry: { id: "synthetic-sidebar-queue", workspaceId: "clair-demo", encounterId: "synthetic-sidebar-chart", queueType: "consultation", status: "in_progress", priority: "normal", sortOrder: 1, enteredAt: "2026-05-01T01:00:00Z" },
    }],
  } }));
}
const datePanels = [["임상병리검사", "lab"], ["영상검사", "imaging"], ["조제/처치", "dispensing"], ["수납", "billing"]] as const;
for (const [name, id] of datePanels) {
  for (const current of [false, true]) {
    test(`${id} ${current ? "current" : "foreign"} date arrows keep the floating queue`, async ({ page }) => {
      const dates: string[] = [];
      await page.route(id === "billing" ? "**/billing/queue?*" : "**/fulfillment/work-items?*", async route => {
        const params = new URL(route.request().url()).searchParams;
        // Result detail and patient history can be outside this date.
        if (params.has("date")) dates.push(params.get("date")!);
        else expect(params.get("workItemId") || params.get("patientId")).toBeTruthy();
        await route.fulfill({ json: { ok: true, workItems: [], rows: [] } });
      });
      await enter(page, current ? `/w/clair-demo/${id}?modulePanel=closed&right=closed&date=2026-05-01` : startRoute);
      const initialUrl = page.url();
      await hover(page, name, id);
      await shown(page, id).getByRole("button", { name: "다음 날짜", exact: true }).click();
      await expect.poll(() => dates.at(-1)).toBe("2026-05-02");
      await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
      await expect(shown(page, id)).toContainText("26.05.02");
      if (current) await expect(page).toHaveURL(/date=2026-05-02/);
      else expect(page.url()).toBe(initialUrl);
      await shown(page, id).getByRole("button", { name: "이전 날짜", exact: true }).click();
      await expect.poll(() => dates.at(-1)).toBe("2026-05-01");
      await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
      if (!current) expect(page.url()).toBe(initialUrl);
    });
  }
}
test("foreign reception calendar changes only its preview date", async ({ page }) => {
  const dates: string[] = [];
  await page.route("**/reception/queue?*", async route => {
    dates.push(new URL(route.request().url()).searchParams.get("date") ?? "");
    await route.fulfill({ status: 403, json: { ok: false, status: 403, denialReason: "permission_missing" } });
  });
  await enter(page, "/w/clair-demo/customer?modulePanel=closed&date=2026-05-01");
  const initialUrl = page.url();
  await hover(page);
  await shown(page, "reception").getByRole("button", { name: "26.05.02 (토) 선택", exact: true }).click();
  await expect.poll(() => dates.at(-1)).toBe("2026-05-02");
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  expect(page.url()).toBe(initialUrl);
});
for (const [name, id] of [["진료/차트", "treatment"], ...datePanels] as const) {
  const api = id === "treatment" ? "**/chart/live-queue?*" : id === "billing" ? "**/billing/queue?*" : "**/fulfillment/work-items?*";
  test(`${id} floating read failure retries within its selected date`, async ({ page }) => {
    let failing = true;
    const dates: string[] = [];
    await page.route(api, async route => {
      dates.push(new URL(route.request().url()).searchParams.get("date") ?? "");
      await route.fulfill({ status: failing ? 500 : 200, json: failing ? { ok: false, status: 500, error: "fixture-failure" } : { ok: true, status: 200, queue: [], workItems: [], rows: [] } });
    });
    await grantFixtureWorkspace(page);
    await enter(page, startRoute.replace("clair-demo", fixtureWorkspace));
    const initialUrl = page.url();
    await hover(page, name, id);
    await expect(shown(page, id).getByText(/업무 대기열을 불러오지 못했습니다|수납 업무를 불러오지 못했습니다/)).toBeVisible();
    await expect(shown(page, id).getByText(/업무가 없습니다/)).toHaveCount(0);
    const before = dates.length;
    failing = false;
    await shown(page, id).getByRole("button", { name: "재시도", exact: true }).click();
    await expect.poll(() => dates.length).toBeGreaterThan(before);
    await expect(shown(page, id).getByText(/업무가 없습니다/).first()).toBeVisible();
    await expect(shown(page, id).getByRole("button", { name: "재시도", exact: true })).toHaveCount(0);
    await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
    expect(page.url()).toBe(initialUrl);
  });
  test(`${id} HTML permission denial is distinct from empty and has no retry`, async ({ page }) => {
    await page.route(api, route => route.fulfill({ status: 403, contentType: "text/html", body: "<p>fixture denied</p>" }));
    await enter(page);
    await hover(page, name, id);
    await expect(shown(page, id).getByText(/권한이 없습니다/)).toBeVisible();
    await expect(shown(page, id).getByRole("button", { name: "재시도", exact: true })).toHaveCount(0);
    await expect(shown(page, id).getByText(/업무가 없습니다/)).toHaveCount(0);
  });
}

async function grantFixtureWorkspace(page: Page) {
  await page.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: id, workspaces: [{ id, displayName: "합성 병원", subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session" }], memberships: [{ id: "synthetic-sidebar-membership", workspaceId: id, userSessionId: "playwright-default-session", roles: ["hospital_admin"], status: "active" }], invitations: [] }));
  }, [SESSION_WORKSPACES_STORAGE_KEY, fixtureWorkspace]);
  await page.route("**/api/workspaces", route => route.fulfill({ json: { ok: true, workspaces: [{ id: fixtureWorkspace, status: "active", displayName: "합성 병원", roles: ["hospital_admin"] }] } }));
}

test("floating date-picker portal closes after selection and reopening retains its date", async ({ page }) => {
  const dates: string[] = [];
  await page.route("**/fulfillment/work-items?*", route => {
    dates.push(new URL(route.request().url()).searchParams.get("date")!);
    return route.fulfill({ json: { ok: true, workItems: [] } });
  });
  await grantFixtureWorkspace(page);
  await enter(page, startRoute.replace("clair-demo", fixtureWorkspace));
  const initialUrl = page.url();
  await hover(page, "임상병리검사", "lab");
  await shown(page, "lab").getByRole("button", { name: /날짜 선택/ }).click();
  const popup = page.locator('[data-slot="popover-content"][data-module-side-panel-owner="module-side-panel-lab"]');
  await expect(popup).toBeVisible();
  await popup.getByRole("button", { name: /26\.05\.02/ }).click();
  await expect(popup).toBeHidden();
  await expect.poll(() => dates.at(-1)).toBe("2026-05-02");
  await expect(host(page)).toHaveAttribute("data-panel-mode", "floating");
  expect(page.url()).toBe(initialUrl);
  await outside(page);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "hidden");
  await hover(page, "임상병리검사", "lab");
  await expect(shown(page, "lab")).toContainText("26.05.02");
  await expect.poll(() => dates.at(-1)).toBe("2026-05-02");
  await shown(page, "lab").getByRole("button", { name: "사이드 패널 고정", exact: true }).click();
  await expect(page).toHaveURL(/\/lab\?.*date=2026-05-02/);
  await expect(host(page)).toHaveAttribute("data-panel-mode", "docked");
});
