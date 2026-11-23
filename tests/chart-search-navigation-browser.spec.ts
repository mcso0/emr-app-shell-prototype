import { expect, test, type Page } from "@playwright/test";
import { installChartSaveSession, patients, workspaceId } from "./fixtures/chart-order-save-session";
import { exampleChart } from "../src/features/chart/advanced-search/search.stories.fixture";
import type { PendingCopy } from "../src/features/chart/advanced-search/contract";
import type { SoapNote } from "../src/types/emr-domain";

async function setup(page: Page, emptyQueue = false, pendingCopy?: PendingCopy) {
  const session = await installChartSaveSession(page);
  const source = exampleChart("search-source");
  const target = pendingCopy && exampleChart(patients.a.chartId, {
    patient: patients.a.name,
    patientId: pendingCopy.patientId,
    encounterId: pendingCopy.encounterId,
    status: "draft",
    editable: true,
  });
  await page.route(url => url.pathname === `/api/workspaces/${workspaceId}/chart/advanced-search`, route => {
    const { action, input } = route.request().postDataJSON();
    if (action === "pending") {
      const pending = input.targetId === target?.id ? pendingCopy : undefined;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(pending ?? null) });
    }
    if (action === "discard") {
      expect(input.id).toBe(pendingCopy?.id);
      pendingCopy = undefined;
      return route.fulfill({ json: { ok: true } });
    }
    if (action === "patientCharts") return route.fulfill({ json: { items: [source], nextCursor: null } });
    if (action === "search") {
      const items = input.targets && target ? [target] : [source];
      return route.fulfill({ json: { items, total: 1, nextCursor: null, doctors: [] } });
    }
    return route.fulfill({ json: [] });
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

for (const timing of ["immediate", "settled"] as const) {
  test(`search close and ${timing} reopen keeps URL, tab and screen aligned`, async ({ page }) => {
    const session = await setup(page, true);
    const link = rail(page).getByRole("link", { name: "차트 상세 검색", exact: true });
    await link.click();
    await expect(searchTab(page)).toHaveAttribute("aria-selected", "true");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await searchTab(page).hover();
      await page.getByRole("button", { name: "차트 상세 검색 탭 닫기" }).click();
      await expect(searchTab(page)).toHaveCount(0);
      if (timing === "settled") {
        await expect(page).toHaveURL(/\/treatment(?:\?|$)/);
        await expect(page.getByRole("tab", { name: "진료/차트", exact: true })).toHaveAttribute("aria-selected", "true");
      }
      await link.click();
      await expect(page).toHaveURL(/\/chart-search(?:\?|$)/);
      await expect(searchTab(page)).toHaveAttribute("aria-selected", "true");
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("region", { name: "차트 검색 결과" })).toBeVisible();
    }
    session.assertNoUnexpectedTraffic();
  });
}

test("rail and global search share one independent tab, and closing starts a fresh search", async ({ page }) => {
  const session = await setup(page);
  const nav = rail(page);
  await expect.poll(async () => {
    const labels = await nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")));
    return labels[labels.indexOf("고객관리") - 1];
  }).toBe("차트 상세 검색");
  const link = nav.getByRole("link", { name: "차트 상세 검색", exact: true });
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

test("the chart header keeps history, and opening search from the rail saves the chart", async ({ page }) => {
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
  const toolbar = page.locator('[data-slot="chart-action-bar"]');
  await expect(toolbar.getByRole("button", { name: /차트 이력 패널/ })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "차트 상세 검색", exact: true })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "복사 이어가기" })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "복사 대기 취소" })).toHaveCount(0);
  const block = editor(page).locator('.bn-block-content[data-content-type="paragraph"]').first();
  await block.click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" 합성 저장 확인");
  await rail(page).getByRole("link", { name: "차트 상세 검색", exact: true }).click();
  await expect(searchTab(page)).toHaveAttribute("aria-selected", "true");
  expect(JSON.stringify(saved?.blockDocument)).toContain("합성 저장 확인");
  await expect(page.getByRole("button", { name: /차트로 돌아가기/ })).toHaveCount(0);
  await page.getByRole("tab", { name: "진료/차트", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(patients.a.chartId));
  await expect(block).toContainText("합성 저장 확인");
  session.assertNoUnexpectedTraffic();
});

test("pending copy opens its saved review and can be discarded from the chart", async ({ page }) => {
  const session = await setup(page, false, {
    id: "synthetic-pending-copy",
    canDiscard: true,
    sourceId: "search-source",
    sourceVersion: "1",
    encounterId: patients.a.encounterId,
    patientId: "patient-a",
    selection: { paragraphs: [{ id: "1" }], diagnoses: [], orders: [] },
  });
  await page.getByRole("button", { name: "복사 이어가기" }).click();
  const review = page.getByRole("dialog", { name: "변경 내용 확인" });
  await expect(review).toBeVisible();
  await expect(review.getByText("어제 저녁부터 식후 구토가 세 차례 있었음.", { exact: true })).toBeVisible();
  await review.getByRole("button", { name: "다이얼로그 닫기" }).click();
  await expect(review).toBeHidden();
  await expect(page).toHaveURL(new RegExp(patients.a.chartId));
  const discard = page.getByRole("button", { name: "복사 대기 취소" });
  await discard.click();
  await expect(discard).toHaveCount(0);
  await expect(page.getByRole("button", { name: "복사 이어가기" })).toHaveCount(0);
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

test("검색 결과의 너비를 바꿔도 상단과 스크롤 위치가 유지되고 서랍이 검색 헤더 아래 본문에 열린다",async({page},testInfo)=>{
  await page.setViewportSize({width:1900,height:1200});
  await setup(page,true);
  await rail(page).getByRole("link",{name:"차트 상세 검색",exact:true}).click();
  const header=page.locator("[data-emr-table-workspace-header]");
  const result=page.getByRole("region",{name:"차트 검색 결과"});
  await expect(result).toBeVisible();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
  await page.screenshot({animations:"disabled"});
  const before=await header.boundingBox(),wide=await result.boundingBox();
  const receptionToolbarHeight = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--emr-calendar-toolbar-height")));
  expect(before!.height).toBe(receptionToolbarHeight);
  await page.getByRole("button",{name:"좁게 보기"}).click();
  expect(await header.boundingBox()).toEqual(before);
  expect((await result.boundingBox())!.width).toBeLessThan(wide!.width);
  await page.getByRole("button",{name:"넓게 보기"}).click();
  await result.getByRole("button",{name:"모카 차트 원본 열기"}).click();
  const drawer=page.getByRole("complementary",{name:"차트 원본"});
  const work=page.getByRole("region",{name:"차트 상세 검색",exact:true});
  await expect(drawer).toBeVisible();
  expect(Math.abs((await drawer.boundingBox())!.y - ((await header.boundingBox())!.y + (await header.boundingBox())!.height))).toBeLessThan(2);
  expect((await drawer.boundingBox())!.y).toBeGreaterThan((await work.boundingBox())!.y);
  await header.getByRole("button", {name: "검색", exact: true}).click();
  await expect(query(page)).toBeEditable();
  expect((await result.boundingBox())!.width).toEqual(wide!.width);
  for(const [width,height] of [[1900,1200],[1387,866],[800,900]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>document.fonts.ready);
    await expect(drawer.locator("[data-history-chart-id]")).toBeVisible();
    expect(Math.abs((await drawer.boundingBox())!.y - ((await header.boundingBox())!.y + (await header.boundingBox())!.height))).toBeLessThan(2);
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
    const trigger = card.getByRole("button",{name,exact:true});
    if (kind === "patient") {
      await expect(trigger).toHaveText("코코 (6세)");
      const box = (await trigger.boundingBox())!;
      await trigger.click({position:{x:box.width - 8,y:box.height / 2}});
    } else {
      await trigger.click();
    }
    await expect(page.getByRole("complementary", {name:"차트 원본"})).toHaveCount(0);
    const profile = page.getByTestId("profile-side-panel");
    await expect(profile).toHaveAttribute("data-profile-kind",kind);
    const close = profile.getByRole("button",{name:/닫기/}).first();
    await close.click();
    await expect(profile).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]drawer=/);
    await expect(card).toBeVisible();
  }
  await card.getByRole("button", { name: /차트 원본 열기$/ }).click();
  const history = page.getByRole("complementary", { name: "차트 원본" });
  for (const [kind, label] of [["patient", "환자 프로필 보기"], ["guardian", "보호자 프로필 보기"]]) {
    await history.getByRole("button", {name: "환자 차트 이력 더보기"}).click();
    await page.getByRole("menuitem", {name: label}).click();
    const profile = page.getByTestId("profile-side-panel");
    await expect(profile).toHaveAttribute("data-profile-kind", kind);
    await profile.getByRole("button", {name: /닫기/}).first().click();
    await expect(history.locator("[data-history-chart-id=profile-source]")).toBeVisible();
  }
});


test("복사·더보기 메뉴를 사용하는 동안 결과 버튼을 유지하고 즐겨찾기는 숨긴다", async ({page}) => {
  await setup(page, true);
  await rail(page).getByRole("link", {name:"차트 상세 검색", exact:true}).click();
  const card = page.locator('[data-chart-id="search-source"]');
  for (const view of ["리스트", "카드"]) {
    await page.getByRole("button", {name:view + " 보기", exact:true}).click();
    for (const action of ["복사", "더보기"]) {
      await card.hover();
      const trigger = card.getByRole("button", {name:"모카 차트 " + action, exact:true});
      await trigger.click();
      const item = page.getByRole("menuitem", {name:action === "복사" ? "기존 차트에 복사" : "원본 보기", exact:true});
      await item.hover();
      await expect.poll(() => trigger.evaluate(el => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          if (getComputedStyle(node).opacity === "0") return false;
        }
        return true;
      })).toBe(true);
      await expect(card.getByRole("button", {name:/즐겨찾기/})).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(item).toBeHidden();
      await expect(trigger).toBeFocused();
      await page.locator('[data-emr-table-workspace-header]').click({position:{x:10,y:10}});
      await expect.poll(() => trigger.evaluate(el => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          if (getComputedStyle(node).opacity === "0") return true;
        }
        return false;
      })).toBe(true);
    }
  }
});

test("선택 해제는 작은 보조 버튼으로 선택 상태를 초기화한다", async ({page}) => {
  await setup(page, true);
  await rail(page).getByRole("link", {name:"차트 상세 검색", exact:true}).click();
  const all = page.getByRole("checkbox", {name:"현재 결과 모두 선택"});
  await all.click();
  const clear = page.getByRole("button", {name:"선택 해제", exact:true});
  await expect(clear).toBeVisible();
  expect((await clear.boundingBox())!.height).toBe(24);
  const center = (box:{y:number;height:number}) => box.y + box.height/2;
  expect(Math.abs(center((await clear.boundingBox())!) - center((await all.boundingBox())!))).toBeLessThan(1);
  await clear.click();
  await expect(all).not.toBeChecked();
  await expect(clear).toHaveCount(0);
});
