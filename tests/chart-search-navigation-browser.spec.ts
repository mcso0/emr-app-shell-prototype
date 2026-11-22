import { expect, test, type Page } from "@playwright/test";
import { installChartSaveSession, patients, workspaceId } from "./fixtures/chart-order-save-session";
import { exampleChart } from "../src/features/chart/advanced-search/search.stories.fixture";
import type { SoapNote } from "../src/types/emr-domain";

async function setup(page: Page, emptyQueue = false) {
  const session = await installChartSaveSession(page);
  const source = exampleChart("search-source");
  await page.route(url => url.pathname === `/api/workspaces/${workspaceId}/chart/advanced-search`, route => {
    const { action } = route.request().postDataJSON();
    const json = action === "search" ? { items: [source], total: 1, nextCursor: null, doctors: [] } : action === "pending" ? null : [];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(json) });
  });
  await page.route(url => url.pathname.endsWith("/operations/work-items"), route => route.fulfill({ json: { ok: true, items: [] } }));
  if (emptyQueue) {
    await page.route(url => url.pathname === `/api/workspaces/${workspaceId}/chart/live-queue`, route =>
      route.fulfill({ json: { ok: true, queue: [], status: 200, enforcedBy: "chart-live-queue-read" } }));
    await page.goto(`/w/${workspaceId}/treatment?date=2026-10-05&modulePanel=open`);
  } else {
    await session.goto();
  }
  return session;
}
const rail = (page: Page) => page.getByRole("navigation", { name: "워크스페이스 주요 메뉴" });
const searchTab = (page: Page) => page.getByRole("tab", { name: "차트 상세 검색", exact: true });
const editor = (page: Page) => page.getByLabel("SOAP 블록 문서");
const query = (page: Page) => page.getByRole("textbox", { name: "차트 검색어" });

test("rail and global search share one independent tab, and closing starts a fresh search", async ({ page }) => {
  const session = await setup(page);
  const link = rail(page).getByRole("link", { name: "차트 상세 검색", exact: true });
  await expect(link).not.toHaveAttribute("href", /patientId|encounterId|chartId/);
  await link.click();
  await expect(searchTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("module-side-panel-host")).toBeHidden();
  await expect(page.getByRole("button", { name: /차트로 돌아가기/ })).toHaveCount(0);
  await query(page).fill("구토");
  await page.getByRole("button", { name: "모카 차트 원본 열기" }).click();
  await page.getByRole("tab", { name: "진료/차트", exact: true }).click();
  await rail(page).getByRole("button", { name: /통합 검색/ }).click();
  await page.locator("#command-result-action-advanced-chart-search").click();
  await expect(searchTab(page)).toHaveCount(1);
  await expect(query(page)).toHaveValue("구토");
  await expect(page.getByRole("complementary", { name: "차트 원본" })).toBeVisible();
  await searchTab(page).hover();
  await page.getByRole("button", { name: "차트 상세 검색 탭 닫기" }).click();
  await link.click();
  await expect(query(page)).toHaveValue("");
  await expect(page.getByRole("complementary", { name: "차트 원본" })).toHaveCount(0);
  session.assertNoUnexpectedTraffic();
});

test("return restores the exact saved SOAP paragraph, caret and search source", async ({ page }) => {
  const session = await setup(page);
  let saved: SoapNote | undefined;
  await page.route(url => url.pathname === `/api/workspaces/${workspaceId}/chart/soap-notes`, async route => {
    if (route.request().method() === "PATCH") {
      const input = route.request().postDataJSON();
      expect(input.chartId).toBe(patients.a.chartId);
      saved = { id: input.chartId, encounterId: input.encounterId, authorUserId: "user-vet",
        subjective: "", objective: "", assessment: "", plan: "", blockDocument: input.blockDocument,
        createdAt: "2026-10-05T00:00:00.000Z", updatedAt: "2026-10-05T00:01:00.000Z", status: "autosaved" };
    }
    if (!saved) return route.fallback();
    await route.fulfill({ json: { ok: true, status: 200, soapNote: saved, enforcedBy: "chart-soap-note-persistence" } });
  });
  const block = editor(page).locator('.bn-block-content[data-content-type="paragraph"]').first();
  await expect(editor(page).locator('[contenteditable="true"]').first()).toBeEditable();
  await block.click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" ABCDEF");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "차트 상세 검색", exact: true }).click();
  await expect(searchTab(page)).toHaveAttribute("aria-selected", "true");
  expect(JSON.stringify(saved?.blockDocument)).toContain("ABCDEF");
  await query(page).fill("구토");
  await page.getByRole("button", { name: "모카 차트 원본 열기" }).click();
  await page.getByRole("button", { name: patients.a.name + " 차트로 돌아가기" }).click();
  await expect(page).toHaveURL(new RegExp(patients.a.chartId));
  await expect(editor(page).locator(".ProseMirror")).toBeFocused();
  await expect.poll(() => editor(page).evaluate(() => {
    const selection = window.getSelection();
    return selection?.anchorNode?.textContent?.slice(selection.anchorOffset);
  })).toBe("EF");
  await page.keyboard.insertText("X");
  await expect(block).toContainText("ABCDXEF");
  await searchTab(page).click();
  await expect(query(page)).toHaveValue("구토");
  await expect(page.getByRole("complementary", { name: "차트 원본" })).toBeVisible();
  session.assertNoUnexpectedTraffic();
});

test("an empty treatment queue can open hospital search without a return patient", async ({ page }) => {
  await setup(page, true);
  const link = rail(page).getByRole("link", { name: "차트 상세 검색", exact: true });
  await link.click();
  await expect(searchTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "모카 차트 원본 열기" })).toBeVisible();
  await expect(page.getByRole("button", { name: /차트로 돌아가기/ })).toHaveCount(0);
});
