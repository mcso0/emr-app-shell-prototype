import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import type { CommandSearchResult } from "../src/features/command/command-search";

const taskRequire = createRequire(`${process.cwd()}/package.json`);
const dialogName = "통합 검색과 빠른 실행";
const triggerName = "전역 통합 검색 열기";
const searchName = "통합 검색";
const resultName = "통합 검색 결과";
const query = "합성";
const results: CommandSearchResult[] = [
  { id: "staff-search-alpha", kind: "staff", title: "합성 첫째", subtitle: "수의사 · 합성팀", badge: "구성원", href: "/w/clair-demo/home?search-check=alpha" },
  { id: "staff-search-beta", kind: "staff", title: "합성 둘째", subtitle: "수의사 · 합성팀", badge: "구성원", href: "/w/clair-demo/home?search-check=beta" },
];

async function setup(page: Page, { held = false, fixtureResults = results }: { held?: boolean; fixtureResults?: CommandSearchResult[] } = {}) {
  const calls: Array<{ query: string; filter: string }> = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.addInitScript(() => {
    const pushes: string[] = [];
    Object.defineProperty(window, "__syntheticCommandPushes", { value: pushes });
    const push = history.pushState.bind(history);
    history.pushState = (data, unused, url) => {
      if (String(url).includes("search-check=")) pushes.push(String(url));
      return push(data, unused, url);
    };
  });
  await page.route("**/api/workspaces/clair-demo/command/search?*", async route => {
    expect(route.request().method()).toBe("GET");
    const params = new URL(route.request().url()).searchParams;
    const input = { query: params.get("query") ?? "", filter: params.get("filter") ?? "all" };
    calls.push(input);
    if (held) await gate;
    await route.fulfill({ status: 200, json: {
      ok: true, ...input, enforcedBy: "command-search",
      sourceState: { patientGuardian: "skipped", reception: "skipped", staff: "ready" },
      results: input.query === "무결과" ? [] : input.filter === "vet" ? fixtureResults.slice(0, 1) : fixtureResults,
    } });
  });
  await page.goto("/w/clair-demo/home?modulePanel=open");
  const trigger = page.getByRole("button", { name: triggerName, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
  const input = dialog.getByRole("textbox", { name: searchName, exact: true });
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  return { calls, release, dialog, input, trigger };
}

async function populated(page: Page) {
  const session = await setup(page);
  await session.input.fill(query);
  await expect(session.dialog.locator('[id^="command-result-staff-search-"]')).toHaveCount(2);
  return session;
}

async function pushes(page: Page) {
  return page.evaluate(() => Reflect.get(window, "__syntheticCommandPushes") as string[]);
}

async function audit(page: Page) {
  await page.addScriptTag({ path: taskRequire.resolve("axe-core/axe.min.js") });
  return page.evaluate(async () => {
    const scope = document.querySelector('[role="dialog"]');
    if (!scope) throw new Error("Search dialog required");
    const axe = Reflect.get(window, "axe") as { run: (element: Element, options: object) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }> };
    const result = await axe.run(scope, { runOnly: { type: "rule", values: ["aria-required-children", "aria-roles", "aria-allowed-attr", "aria-valid-attr-value", "aria-input-field-name", "button-name", "list", "listitem"] } });
    return result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }));
  });
}

test("search results expose named native action lists without invalid widget roles", async ({ page }, info) => {
  const s = await populated(page);
  const violations = await audit(page);
  await info.attach("search-semantics-axe", { body: JSON.stringify(violations), contentType: "application/json" });
  expect(violations).toEqual([]);
  const region = s.dialog.getByRole("region", { name: resultName, exact: true });
  await expect(region).toBeVisible();
  const list = region.getByRole("list", { name: "병원 구성원", exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("button").first()).toHaveAccessibleName("합성 첫째 수의사 · 합성팀 구성원");
  await expect(s.dialog.getByRole("listbox")).toHaveCount(0);
  await expect(s.dialog.getByRole("option")).toHaveCount(0);
});

test("native arrow navigation wraps with input focus and Enter executes exactly once", async ({ page }) => {
  const s = await populated(page);
  const first = s.dialog.locator("#command-result-staff-search-alpha");
  const second = s.dialog.locator("#command-result-staff-search-beta");
  await expect(first).toHaveAttribute("data-active", "true");
  await s.input.press("ArrowDown");
  await expect(second).toHaveAttribute("data-active", "true");
  await expect(s.input).toBeFocused();
  await s.input.press("ArrowDown");
  await expect(first).toHaveAttribute("data-active", "true");
  await s.input.press("ArrowUp");
  await expect(second).toHaveAttribute("data-active", "true");
  await s.input.press("Enter");
  await expect(s.dialog).toBeHidden();
  await expect(page).toHaveURL(/search-check=beta/);
  await expect.poll(() => pushes(page)).toHaveLength(1);
  await expect(s.trigger).toBeFocused();
});

test("native Tab and Shift-Tab keep filters and action buttons keyboard reachable", async ({ page }) => {
  const s = await populated(page);
  await s.input.press("Tab");
  await expect(s.dialog.getByRole("button", { name: "전체", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(s.input).toBeFocused();
  const first = s.dialog.locator("#command-result-staff-search-alpha");
  for (let step = 0; step < 12 && !(await first.evaluate(element => element === document.activeElement)); step++) await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  expect(await first.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
  await page.keyboard.press("Space");
  await expect(s.dialog).toBeHidden();
  await expect(page).toHaveURL(/search-check=alpha/);
  await expect.poll(() => pushes(page)).toHaveLength(1);
});

test("pointer activation keeps one native action execution", async ({ page }) => {
  const s = await populated(page);
  await s.dialog.locator("#command-result-staff-search-beta").click();
  await expect(s.dialog).toBeHidden();
  await expect(page).toHaveURL(/search-check=beta/);
  await expect.poll(() => pushes(page)).toHaveLength(1);
});

test("filter results preserve the current query and reset the active native action", async ({ page }) => {
  const s = await populated(page);
  await s.dialog.getByRole("button", { name: "수의사", exact: true }).click();
  await expect.poll(() => s.calls.at(-1)).toEqual({ query, filter: "vet" });
  await expect(s.dialog.locator('[id^="command-result-staff-search-"]')).toHaveCount(1);
  await expect(s.input).toHaveValue(query);
  await expect(s.dialog.locator("#command-result-staff-search-alpha")).toHaveAttribute("data-active", "true");
  await s.input.focus();
  await s.input.press("Escape");
  await expect(s.dialog).toBeHidden();
  await expect(s.trigger).toBeFocused();
  await s.trigger.click();
  await expect(s.input).toHaveValue("");
  await expect(s.dialog.getByRole("button", { name: "전체", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("loading and empty results stay truthful and Enter cannot execute a missing action", async ({ page }) => {
  const s = await setup(page, { held: true });
  await s.input.fill("무결과");
  await expect(s.dialog.getByText("검색 중", { exact: true })).toBeVisible();
  await expect(s.dialog.getByText("검색 결과가 없습니다.", { exact: true })).toHaveCount(0);
  expect(await audit(page)).toEqual([]);
  s.release();
  await expect(s.dialog.getByText("검색 결과가 없습니다.", { exact: true })).toBeVisible();
  await expect(s.dialog.locator('[id^="command-result-"]')).toHaveCount(0);
  const before = page.url();
  await s.input.press("ArrowDown"); await s.input.press("ArrowUp"); await s.input.press("Enter");
  await expect(s.dialog).toBeVisible(); await expect(s.input).toBeFocused();
  expect(page.url()).toBe(before); expect(await pushes(page)).toHaveLength(0);
  expect(await audit(page)).toEqual([]);
  await s.input.press("Escape");
  await expect(s.trigger).toBeFocused();
});

test("active native command is announced when keyboard and pointer change the highlight", async ({ page }) => {
  const s = await populated(page);
  const status = s.dialog.getByRole("status");
  await expect(status).toHaveText("활성 실행 항목: 합성 첫째");
  await s.input.press("ArrowDown");
  await expect(status).toHaveText("활성 실행 항목: 합성 둘째");
  await s.dialog.locator("#command-result-staff-search-alpha").hover();
  await expect(status).toHaveText("활성 실행 항목: 합성 첫째");
  await expect(s.input).toBeFocused();
});

test("native patient action opens its named profile heading and selected information tab", async ({ page }) => {
  const s = await setup(page, { fixtureResults: [{
    id: "patient-search-kong", kind: "patient", title: "콩이", subtitle: "합성 환자", badge: "환자",
    href: "/w/clair-demo/reception?modulePanel=open&patientId=patient-kong&drawer=reception-patient%3Apatient-kong",
  }] });
  await s.input.fill("콩이");
  await s.dialog.getByRole("button", { name: "콩이 합성 환자 환자", exact: true }).click();
  await expect(s.dialog).toBeHidden();
  await expect(page).toHaveURL(/drawer=reception-patient%3Apatient-kong/);
  await expect(page.getByRole("heading", { name: "환자 정보", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "환자 정보", exact: true })).toHaveAttribute("aria-selected", "true");
});
