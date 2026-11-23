import { expect, test, type Page, type Route } from "@playwright/test";
import { installChartSaveSession, workspaceId } from "./fixtures/chart-order-save-session";
import { exampleChart } from "../src/features/chart/advanced-search/search.stories.fixture";
import type { SearchParams } from "../src/features/chart/advanced-search/contract";

const rows = Array.from({ length: 61 }, (_, i) => exampleChart(`auto-${i}`, { patient: `합성환자 ${i + 1}` }));
const result = (page: Page) => page.getByRole("region", { name: "차트 검색 결과", exact: true });
const cards = (page: Page) => result(page).locator("[data-chart-id]");
const viewport = (page: Page) => page.getByRole("region", { name: "차트 상세 검색", exact: true }).locator('[data-slot="scroll-area-viewport"]').first();
const bottom = async (page: Page) => viewport(page).evaluate(el => { el.scrollTop = el.scrollHeight; });
function batch(input: SearchParams, total = 61, size = 25) {
  const offset = Number(input.cursor ?? 0);
  return { items: rows.slice(offset, offset + size), total, doctors: [], nextCursor: offset + size < Math.min(total, rows.length) ? String(offset + size) : null };
}
async function setup(page: Page, respond?: (route: Route, input: SearchParams) => Promise<void>) {
  const session = await installChartSaveSession(page);
  const calls: SearchParams[] = [];
  await page.route(url => url.pathname.endsWith("/chart/advanced-search"), async route => {
    const { action, input } = route.request().postDataJSON();
    if (action !== "search") return route.fulfill({ json: action === "pending" ? null : [] });
    calls.push(input);
    if (respond) return respond(route, input);
    await route.fulfill({ json: batch(input) });
  });
  await page.route("**/operations/work-items**", route => route.fulfill({ json: { ok: true, items: [] } }));
  await page.goto(`/w/${workspaceId}/chart-search?modulePanel=closed`);
  return { calls, session };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

for (const [width, height] of [[1387, 868], [1708, 1255]]) {
  for (const view of ["리스트 보기", "카드 보기"]) {
    test(`${width} ${view}: 25 → 50 → 61, selection and position persist`, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      const { calls, session } = await setup(page);
      await expect(cards(page)).toHaveCount(25);
      await page.getByRole("button", { name: view, exact: true }).click();
      await cards(page).first().getByRole("checkbox").focus();
      await page.keyboard.press("Space");
      await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
      await bottom(page);
      await expect(cards(page)).toHaveCount(50);
      await expect(cards(page).first().getByRole("checkbox")).toBeChecked();
      await expect(page.getByRole("button", { name: "더 보기", exact: true })).toHaveCount(0);
      const y = await viewport(page).evaluate(el => el.scrollTop);
      await page.getByRole("button", { name: "넓게 보기", exact: true }).click();
      expect(await viewport(page).evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      await bottom(page);
      await expect(cards(page)).toHaveCount(61);
      await bottom(page);
      await page.waitForTimeout(250); // Observe that the last page does not trigger another request.
      expect(calls.map(c => c.cursor ?? "first")).toEqual(["first", "25", "50"]);
      expect(await cards(page).evaluateAll(els => els.map(el => el.getAttribute("data-chart-id")))).toEqual(rows.map(row => row.id));
      expect(y).toBeGreaterThan(0);
      await viewport(page).evaluate(el => { el.scrollTop = 0; });
      await info.attach(`${width}-${view}`, { body: await page.screenshot({ path: info.outputPath(`${width}-${view}.png`), animations: "disabled" }), contentType: "image/png" });
      session.assertNoUnexpectedTraffic();
    });
  }
}

test("failed append keeps rows, selection and scroll; only manual retry resumes", async ({ page }) => {
  let fail = true;
  const { calls } = await setup(page, async (route, input) => {
    if (input.cursor && fail) { fail = false; await route.fulfill({ status: 503, json: { error: "request_failed" } }); }
    else await route.fulfill({ json: batch(input) });
  });
  await expect(cards(page)).toHaveCount(25);
  await cards(page).first().getByRole("checkbox").focus();
      await page.keyboard.press("Space");
  await bottom(page);
  const y = await viewport(page).evaluate(el => el.scrollTop);
  await expect(viewport(page).getByRole("alert")).toContainText("다음 차트를");
  await expect(cards(page)).toHaveCount(25);
  await expect(cards(page).first().getByRole("checkbox")).toBeChecked();
  expect(await viewport(page).evaluate(el => el.scrollTop)).toBe(y);
  await bottom(page);
  await page.waitForTimeout(300);
  expect(calls).toHaveLength(2);
  await page.getByRole("button", { name: "다시 시도", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(cards(page)).toHaveCount(50);
  expect(calls.map(c => c.cursor ?? "first")).toEqual(["first", "25", "25"]);
});

for (const failure of ["invalid_cursor", "same_cursor", "empty_page"]) {
  test(`${failure} offers a fresh search and does not loop`, async ({ page }) => {
    const { calls } = await setup(page, async (route, input) => {
      if (!input.cursor) return route.fulfill({ json: batch(input) });
      if (failure === "invalid_cursor") return route.fulfill({ status: 400, json: { error: failure } });
      return route.fulfill({ json: { ...batch(input), items: failure === "empty_page" ? [] : batch(input).items, nextCursor: failure === "same_cursor" ? input.cursor : "50" } });
    });
    await expect(cards(page)).toHaveCount(25);
    await bottom(page);
    await expect(page.getByRole("button", { name: "검색 다시 불러오기" })).toBeVisible();
    await page.waitForTimeout(250);
    expect(calls).toHaveLength(2);
    await page.getByRole("button", { name: "검색 다시 불러오기" }).click();
    await expect.poll(() => calls.length).toBe(3);
    await expect(cards(page)).toHaveCount(25);
    await expect(viewport(page).getByRole("alert")).toHaveCount(0);
    expect(await viewport(page).evaluate(el => el.scrollTop)).toBe(0);
  });
}

test("rapid intersections and view changes serialize requests; inactive tab pauses and resumes", async ({ page }) => {
  const held = gate();
  page.on("close", held.release);
  const { calls } = await setup(page, async (route, input) => {
    if (input.cursor === "25") await held.promise;
    await route.fulfill({ json: batch(input) });
  });
  await expect(cards(page)).toHaveCount(25);
  await bottom(page);
  await expect(page.getByRole("status", { name: "" }).filter({ hasText: "차트 불러오는 중" })).toBeVisible();
  for (let i = 0; i < 3; i++) await bottom(page);
  await page.getByRole("button", { name: "카드 보기" }).click();
  await page.getByRole("button", { name: "좁게 보기" }).click();
  expect(calls).toHaveLength(2);
  await page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }).getByRole("link", { name: "진료/차트", exact: true }).click();
  held.release();
  await page.waitForTimeout(350);
  expect(calls).toHaveLength(2);
  await page.getByRole("tab", { name: "차트 상세 검색", exact: true }).click();
  await expect(cards(page)).toHaveCount(50);
  await bottom(page);
  await expect(cards(page)).toHaveCount(61);
  expect(calls).toHaveLength(3);
});

for (const change of ["query", "mine", "drafts", "sort", "doctor"] as const) {
  test(`pending append is ignored after changing ${change}`, async ({ page }) => {
    const held = gate();
  page.on("close", held.release);
    const { calls } = await setup(page, async (route, input) => {
      if (input.cursor) await held.promise;
      const changed = input.query || input.mine || input.includeDrafts || input.sort === "oldest" || input.doctor;
      await route.fulfill({ json: changed ? { items: [exampleChart("new-search")], total: 1, nextCursor: null, doctors: [] } : { ...batch(input), doctors: [{ id: "vet-b", name: "합성 수의사" }] } });
    });
    await expect(cards(page)).toHaveCount(25);
    await bottom(page);
    await expect.poll(() => calls.length).toBe(2);
    if (change === "query") {
      await page.locator("header[data-emr-table-workspace-header]").getByRole("button", { name: "검색", exact: true }).click();
      await page.getByRole("textbox", { name: "차트 검색어" }).fill("새 검색");
    } else if (change === "mine") await page.getByRole("button", { name: "내 차트", exact: true }).click();
    else if (change === "drafts") await page.getByRole("switch").click();
    else {
      await page.getByRole("combobox", { name: change === "sort" ? "정렬" : "진료 담당의" }).click();
      await page.getByRole("option", { name: change === "sort" ? "오래된순" : "합성 수의사" }).click();
    }
    await expect(cards(page)).toHaveCount(1);
    held.release();
    await page.waitForTimeout(200);
    await expect(cards(page)).toHaveAttribute("data-chart-id", "new-search");
    expect(await viewport(page).evaluate(el => el.scrollTop)).toBe(0);
  });
}

test("select all owns pagination; append preserves full selection, deselect clears it", async ({ page }) => {
  const held = gate();
  page.on("close", held.release);
  const { calls } = await setup(page, async (route, input) => {
    if (input.cursor === "25") await held.promise;
    await route.fulfill({ json: batch(input) });
  });
  await expect(cards(page)).toHaveCount(25);
  await page.getByRole("checkbox", { name: "현재 결과 모두 선택" }).click();
  await expect.poll(() => calls.length).toBe(2);
  await bottom(page);
  await page.waitForTimeout(200);
  expect(calls).toHaveLength(2);
  held.release();
  await expect(page.getByText("61건 선택", { exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(50);
  await expect(cards(page).last().getByRole("checkbox")).toBeChecked();
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await expect(cards(page).first().getByRole("checkbox")).not.toBeChecked();
});

test("500 selection cap does not cap loading", async ({ page }) => {
  test.setTimeout(60_000);
  const many = Array.from({ length: 501 }, (_, i) => exampleChart(`many-${i}`));
  const { calls } = await setup(page, async (route, input) => {
    const offset = Number(input.cursor ?? 0);
    await route.fulfill({ json: { items: many.slice(offset, offset + 25), total: 501, doctors: [], nextCursor: offset + 25 < 501 ? String(offset + 25) : null } });
  });
  await expect(cards(page)).toHaveCount(25);
  await page.getByRole("checkbox", { name: "현재 결과 모두 선택" }).click();
  await expect(page.getByText(/한 번에 최대 500건까지 선택/)).toBeVisible();
  expect(calls).toHaveLength(1);
  for (let count = 50; count <= 525; count += 25) {
    await bottom(page);
    await expect(cards(page)).toHaveCount(Math.min(count, 501));
  }
  expect(calls).toHaveLength(21);
});

for (const total of [0, 1, 25]) {
  test(`${total} results stop at the first page`, async ({ page }) => {
    const { calls } = await setup(page, async (route) => route.fulfill({ json: { items: rows.slice(0, total), total, doctors: [], nextCursor: null } }));
    if (total) await expect(cards(page)).toHaveCount(total);
    else await expect(page.getByText("등록된 완료 차트가 없습니다", { exact: true })).toBeVisible();
    await bottom(page);
    await page.waitForTimeout(200);
    expect(calls).toHaveLength(1);
  });
}

test("underfilled viewport loads sequential pages without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1708, height: 1255 });
  const { calls } = await setup(page, async (route, input) => route.fulfill({ json: batch(input, 3, 1) }));
  await page.getByRole("button", { name: "카드 보기", exact: true }).click();
  await expect(cards(page)).toHaveCount(3);
  expect(calls.map(c => c.cursor ?? "first")).toEqual(["first", "1", "2"]);
});

test("a failed cursor restart waits for the first-page retry", async ({ page }) => {
  let firstRequests = 0;
  const { calls } = await setup(page, async (route, input) => {
    if (input.cursor) return route.fulfill({ status: 400, json: { error: "invalid_cursor" } });
    firstRequests++;
    if (firstRequests === 2) return route.fulfill({ status: 503, json: { error: "request_failed" } });
    return route.fulfill({ json: batch(input) });
  });
  await expect(cards(page)).toHaveCount(25);
  await bottom(page);
  await page.getByRole("button", { name: "검색 다시 불러오기" }).click();
  await expect(viewport(page).getByRole("alert")).toContainText("요청을 완료하지 못했습니다");
  await bottom(page);
  await page.waitForTimeout(250);
  expect(calls).toHaveLength(3);
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(viewport(page).getByRole("alert")).toHaveCount(0);
  expect(calls).toHaveLength(4);
  expect(calls[3].cursor).toBeUndefined();
  await expect(cards(page)).toHaveCount(25);
});
