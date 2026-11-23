import { expect, test, type Page } from "@playwright/test";
import { installChartSaveSession, patients, workspaceId } from "./fixtures/chart-order-save-session";
import { exampleChart } from "../src/features/chart/advanced-search/search.stories.fixture";
import type { SoapNote } from "../src/types/emr-domain";

async function setup(page: Page, emptyQueue = false) {
  const session = await installChartSaveSession(page);
  const source = exampleChart("search-source");
  await page.route(url => url.pathname === `/api/workspaces/${workspaceId}/chart/advanced-search`, route => {
    const { action } = route.request().postDataJSON();
    const json = action === "patientCharts" ? {items:[source],nextCursor:null} : action === "search" ? { items: [source], total: 1, nextCursor: null, doctors: [] } : action === "pending" ? null : [];
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
  await expect(page.getByRole("region", { name: "차트 상세 검색", exact: true }).locator('[data-slot="emr-main-content-header"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /차트로 돌아가기/ })).toHaveCount(0);
  await page.locator("header[data-emr-table-workspace-header]").getByRole("button", { name: "검색", exact: true }).click();
  await query(page).fill("구토");
  await page.getByRole("button", { name: "모카 차트 원본 열기" }).click();
  await page.getByRole("tab", { name: "진료/차트", exact: true }).click();
  await rail(page).getByRole("button", { name: /통합 검색/ }).click();
  await page.locator("#command-result-action-advanced-chart-search").click();
  await expect(searchTab(page)).toHaveCount(1);
  await expect(query(page)).toHaveValue("구토");
  await expect(page.getByRole("complementary", { name: "차트 원본" })).toBeVisible();
  await expect(page).toHaveURL(/\/chart-search(?:\?|$)/);
  await searchTab(page).focus();
  await searchTab(page).hover();
  await page.getByRole("button", { name: "차트 상세 검색 탭 닫기" }).click();
  await expect(searchTab(page)).toHaveCount(0);
  await link.click();
  await expect(page).toHaveURL(/\/chart-search(?:\?|$)/);
  await expect(page.locator("header[data-emr-table-workspace-header]").getByRole("button", { name: "검색", exact: true })).toBeVisible();
  await expect(query(page)).toHaveCount(0);
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
  await expect.poll(() => page.evaluate(() => {
    const selection = window.getSelection();
    return selection?.focusNode?.textContent?.slice(selection.focusOffset);
  })).toBe("EF");
  await page.getByRole("button", { name: "차트 상세 검색", exact: true }).click();
  await expect(searchTab(page)).toHaveAttribute("aria-selected", "true");
  expect(JSON.stringify(saved?.blockDocument)).toContain("ABCDEF");
  await page.locator("header[data-emr-table-workspace-header]").getByRole("button", { name: "검색", exact: true }).click();
  await query(page).fill("구토");
  await page.getByRole("button", { name: "모카 차트 원본 열기" }).click();
  await expect(page.getByRole("complementary", { name: "차트 원본" })).toBeVisible();
  // The SOAP read can finish while the enclosing chart still waits on orders.
  let releaseOrderRead!: () => void;
  const orderReadGate = new Promise<void>(resolve => { releaseOrderRead = resolve; });
  await page.route(url => url.pathname.endsWith("/chart/order-drafts"), async route => {
    await orderReadGate;
    await route.fallback();
  });
  await page.getByRole("button", { name: patients.a.name + " 차트로 돌아가기" }).click();
  try {
    await expect(editor(page).locator(".ProseMirror")).toBeAttached();
    await expect(editor(page).locator("xpath=ancestor::*[@data-page-content and @inert]").first()).toBeAttached();
  } finally {
    releaseOrderRead();
  }
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

test("검색 결과의 너비를 바꿔도 상단과 스크롤 위치가 유지되고 서랍이 전체 작업 영역에 열린다",async({page},testInfo)=>{
  await page.setViewportSize({width:1900,height:1200});
  await setup(page,true);
  await rail(page).getByRole("link",{name:"차트 상세 검색",exact:true}).click();
  const header=page.locator("[data-emr-table-workspace-header]");
  const result=page.getByRole("region",{name:"차트 검색 결과"});
  await expect(result).toBeVisible();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
  const before=await header.boundingBox(),wide=await result.boundingBox();
  await page.getByRole("button",{name:"좁게 보기"}).click();
  expect(await header.boundingBox()).toEqual(before);
  expect((await result.boundingBox())!.width).toBeLessThan(wide!.width);
  await page.getByRole("button",{name:"넓게 보기"}).click();
  await result.getByRole("button",{name:"모카 차트 원본 열기"}).click();
  const drawer=page.getByRole("complementary",{name:"차트 원본"});
  const work=page.getByRole("region",{name:"차트 상세 검색",exact:true});
  await expect(drawer).toBeVisible();
  expect(Math.abs((await drawer.boundingBox())!.y-(await work.boundingBox())!.y)).toBeLessThan(2);
  expect((await result.boundingBox())!.width).toEqual(wide!.width);
  for(const [width,height] of [[1900,1200],[1387,866]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>document.fonts.ready);
    await expect(drawer.locator("[data-history-chart-id]")).toBeVisible();
    expect(await drawer.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await testInfo.attach("chart-search-"+width,{body:await page.screenshot({path:testInfo.outputPath("chart-search-"+width+".png"),animations:"disabled"}),contentType:"image/png"});
  }
});

test("검색 결과에서 방문 환자와 보호자의 기존 프로필을 열고 목록으로 돌아온다", async ({page}) => {
  await page.setViewportSize({width:1387,height:868});
  const row = exampleChart("profile-source", {
    patient: "코코", patientId: "patient-coco", guardian: "이지은", guardianId: "guardian-lee-jieun",
  });
  await page.route("**/api/workspaces/clair-demo/chart/advanced-search", route =>
    route.fulfill({json:{items:[row],total:1,nextCursor:null,doctors:[]}}));
  await page.goto("/w/clair-demo/chart-search?modulePanel=closed");
  const card = page.locator("[data-chart-id=profile-source]");
  for (const [kind, name] of [["patient","코코 환자 프로필"], ["guardian","이지은 보호자 프로필"]]) {
    await card.getByRole("button",{name,exact:true}).click();
    const profile = page.getByTestId("profile-side-panel");
    await expect(profile).toHaveAttribute("data-profile-kind",kind);
    const close = profile.getByRole("button",{name:/닫기/}).first();
    await close.click();
    await expect(profile).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]drawer=/);
    await expect(card).toBeVisible();
  }
});
