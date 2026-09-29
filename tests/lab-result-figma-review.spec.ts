import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";

const rowId = "figma-review-row";
const resultId = "figma-review-result";
const instruction = "합성 검수용 직원 전달사항입니다.";

async function openReview(page: Page, count: number, canEdit = true) {
  await page.addInitScript(({ key, workspaceId }) => {
    localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: workspaceId,
      workspaces: [{ id: workspaceId, displayName: "합성 검수 공간", representativeName: "합성 관리자",
        contactEmail: "review@example.test", contactPhone: null, subscriptionStatus: "trialing",
        createdBySessionId: "playwright-default-session", createdAt: "2026-09-29T00:00:00Z" }],
      memberships: [{ id: "review-membership", workspaceId, userSessionId: "playwright-default-session",
        displayName: "합성 관리자", email: "review@example.test", roles: ["hospital_admin"], status: "active",
        createdAt: "2026-09-29T00:00:00Z", activatedAt: "2026-09-29T00:00:00Z" }], invitations: [] }));
  }, { key: SESSION_WORKSPACES_STORAGE_KEY, workspaceId });
  const workItem = { id: "review-work", workspaceId, orderId: "review-order", encounterId: "review-encounter",
    queueType: "lab", status: "in_progress", requestCycle: 1, rowRevision: 1,
    sourceSnapshot: { orderDisplayName: "합성 검사", patientName: "합성 환자", instruction, detail: { species: "dog" } } };
  const result = { ok: true, workspaceId, resultId, orderId: workItem.orderId,
    encounterId: workItem.encounterId, workItemId: workItem.id, entryWriteRevision: 0,
    resultDefinitionSnapshot: { schemaVersion: 1 },
    rows: [{ id: rowId, analyteName: "합성 항목", value: null, resultValueKind: "text", judgment: "not_judged", note: "" }] };
  const attachments = Array.from({ length: count }, (_, index) => ({ id: `review-file-${index}`, rowId,
    name: index === 0 ? "긴-첨부자료-파일명-겹침-검수-문서.pdf" : `합성첨부-${index}.txt`,
    mimeType: index === 0 ? "application/pdf" : "text/plain", size: 1024 * (index + 1),
    uploadedAt: "2026-09-29T00:00:00Z", uploadedByUserId: "review-actor", uploadedByName: "합성" }));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items**`, route => route.fulfill({ json: { ok: true, workItems: [workItem] } }));
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-entries**`, route => route.fulfill({ json: result }));
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-phase2**`, route => route.fulfill({ json: {
    ok: true, data: { resultId, orderId: workItem.orderId, overallFinding: "", overallRevision: 0, canEdit, events: [], attachments },
  } }));
  await page.goto(`/w/${workspaceId}/lab?date=2026-09-29&labResultId=live-lab-${workItem.id}&modulePanel=closed&aside=closed&right=closed`);
  const row = page.getByTestId(`lab-result-row-${rowId}`);
  await expect(row).toBeVisible();
  await expect(page.getByRole("button", { name: "수정이력", exact: true })).toBeEnabled();
  await row.getByRole("button", { name: /소견.*펼치기/ }).click();
  const detail = page.getByTestId(`lab-result-detail-${rowId}`);
  await expect(detail).toBeVisible();
  return { detail, row, attachments };
}


async function installUploadHarness(page: Page) {
  await page.addInitScript(() => {
    const requests: ReviewUpload[] = [];
    class ReviewUpload extends EventTarget {
      upload = new EventTarget(); status = 0; aborted = false; fileName = "";
      open() {} setRequestHeader() {}
      send(body: FormData) {
        this.fileName = (body.get("") as File).name;
        requests.push(this);
        (window as unknown as { reviewUpload: ReviewUpload }).reviewUpload = this;
      }
      abort() { this.aborted = true; this.dispatchEvent(new Event("abort")); }
    }
    (window as unknown as { reviewUploads: ReviewUpload[] }).reviewUploads = requests;
    window.XMLHttpRequest = ReviewUpload as unknown as typeof XMLHttpRequest;
  });
}

async function settleTransfer(page: Page, name: string, success = true) {
  await page.evaluate(({ name, success }) => {
    const request = (window as unknown as { reviewUploads: Array<EventTarget & { fileName: string; status: number }> }).reviewUploads.filter(r => r.fileName === name).at(-1)!;
    request.status = success ? 200 : 500;
    request.dispatchEvent(new Event(success ? "load" : "error"));
  }, { name, success });
}

const syntheticFile = (name: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from("synthetic local verification") });

test("accepted empty detail geometry preserves plain staff notice and text result input", async ({ page }, testInfo) => {
  const { detail } = await openReview(page, 0);
  await expect(page.getByRole("textbox", { name: "합성 항목 결과값", exact: true })).toBeVisible();
  const notice = detail.getByText(instruction, { exact: true });
  await expect(notice).toBeVisible();
  expect(await notice.evaluate(el => ({ shadow: getComputedStyle(el).boxShadow, tag: el.tagName, tab: el.tabIndex })))
    .toEqual({ shadow: "none", tag: "DIV", tab: -1 });
  const finding = detail.getByRole("textbox", { name: "검사 소견", exact: true });
  const drop = detail.getByRole("button", { name: "첨부자료 업로드", exact: true });
  await expect(finding).toHaveCSS("height", "76px");
  await expect(drop).toHaveCSS("height", "78px");
  const a = await finding.boundingBox(); const b = await drop.boundingBox();
  expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(1);
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
  await detail.screenshot({ path: testInfo.outputPath("empty-detail.png") });
});

for (const count of [1, 4, 5, 8, 9]) {
  test(`card viewport grows to two actual rows for ${count} files`, async ({ page }, testInfo) => {
    const { detail } = await openReview(page, count);
    const grid = detail.getByTestId("lab-attachment-card-grid");
    const cards = detail.getByTestId("lab-attachment-card");
    await expect(cards).toHaveCount(count);
    for (const icon of await cards.locator("img").all()) await expect.poll(() => icon.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    const region = detail.getByRole("region", { name: /첨부 카드 스크롤 영역/ });
    await expect.poll(async () => region.evaluate(el => el.clientHeight)).toBeGreaterThan(0);
    const metrics = await grid.evaluate(el => {
      const card = el.firstElementChild!.getBoundingClientRect();
      return { cardHeight: card.height, columns: getComputedStyle(el).gridTemplateColumns.split(" ").length,
        gap: parseFloat(getComputedStyle(el).rowGap) };
    });
    const rows = Math.ceil(count / metrics.columns);
    const expected = Math.min(2, rows) * metrics.cardHeight + (Math.min(2, rows) - 1) * metrics.gap;
    await expect.poll(async () => Math.abs((await region.boundingBox())!.height - expected)).toBeLessThan(1.5);
    if (rows > 2) {
      await expect(detail.getByTestId("lab-attachment-overflow-fade")).toBeVisible();
      await region.focus(); await page.keyboard.press("End");
      await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
    } else await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
    if (count === 4 || count === 9) await detail.screenshot({ path: testInfo.outputPath(`cards-${count}.png`) });
  });
}

test("list caps at six rows, keeps column labels fixed, and reveals no bottom fade at the end", async ({ page }, testInfo) => {
  const { detail } = await openReview(page, 7);
  await detail.hover();
  await detail.getByRole("button", { name: "목록 보기", exact: true }).click();
  const region = detail.getByRole("region", { name: /첨부 목록 스크롤 영역/ });
  await expect(region).toHaveCSS("max-height", "212px");
  await expect.poll(async () => region.evaluate(el => el.clientHeight)).toBe(212);
  const header = detail.getByText("파일 크기", { exact: true });
  const headerY = (await header.boundingBox())!.y;
  await expect(detail.getByTestId("lab-attachment-list-row")).toHaveCount(7);
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toBeVisible();
  await region.focus(); await page.keyboard.press("End");
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
  expect((await header.boundingBox())!.y).toBe(headerY);
  await expect(header).toHaveCSS("font-size", "10px");
  await expect(detail.getByTestId("lab-attachment-list-row").first()).toHaveCSS("font-size", "12px");
  await detail.screenshot({ path: testInfo.outputPath("list-seven-end.png") });
  await detail.getByRole("button", { name: "카드 보기", exact: true }).click();
  await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(7);
});

test("read-only detail exposes files but no upload or editing controls", async ({ page }) => {
  const { detail } = await openReview(page, 1, false);
  await expect(detail.getByRole("textbox", { name: "검사 소견", exact: true })).toBeDisabled();
  await detail.hover();
  await expect(detail.getByRole("button", { name: "첨부 자료 추가", exact: true })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: /미리보기$/ })).toBeEnabled();
});


test("measured uploads render distinct cards and full list fill without a gradient at 100%", async ({ page }, testInfo) => {
  await installUploadHarness(page);
  const { detail } = await openReview(page, 0);
  let releaseFinalize!: () => void;
  const finalized = new Promise<void>(resolve => { releaseFinalize = resolve; });
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments`, async route => {
    const body = route.request().postDataJSON();
    if (body.action === "prepare") await route.fulfill({ json: { ok: true, attachmentId: "synthetic-upload", objectPath: "synthetic/path", uploadToken: "synthetic-token", uploadUrl: "https://storage.example.test/signed" } });
    else if (body.action === "finalize") { await finalized; await route.fulfill({ json: { ok: true } }); }
    else await route.fulfill({ json: { ok: true } });
  });
  await detail.locator('input[type="file"]').setInputFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: Buffer.from("synthetic local verification") });
  const card = detail.getByTestId("lab-upload-card");
  await expect(card).toBeVisible();
  await expect(card.getByText("—%", { exact: true })).toBeVisible();
  const progress = async (loaded: number) => page.evaluate(loaded => {
    const request = (window as unknown as { reviewUpload: { upload: EventTarget } }).reviewUpload;
    request.upload.dispatchEvent(new ProgressEvent("progress", { lengthComputable: true, loaded, total: 100 }));
  }, loaded);
  await progress(25);
  await expect(card.getByText("25%", { exact: true })).toBeVisible();
  await expect(card.getByTestId("lab-upload-progress-fill")).toHaveCount(0);
  const cancelWidth = (await card.getByRole("button", { name: "synthetic.txt 업로드 취소" }).boundingBox())!.width;
  await expect(card.getByLabel("업로드 중", { exact: true })).toBeVisible();
  await detail.screenshot({ path: testInfo.outputPath("upload-card-25.png") });
  await detail.getByRole("button", { name: "목록 보기", exact: true }).click();
  const row = detail.getByTestId("lab-upload-list-row");
  const fill = row.getByTestId("lab-upload-progress-fill");
  for (const percent of [25, 50, 99, 100]) {
    await progress(percent);
    await expect.poll(() => fill.evaluate(el => el.style.width)).toBe(`${percent}%`);
    if (percent < 100) await expect(fill.locator("span")).toHaveCSS("opacity", String(Math.round(100 - percent) / 100));
    else await expect(fill.locator("span")).toHaveCount(0);
  }
  const innerWidth = await row.evaluate(el => el.clientWidth);
  expect(Math.abs((await fill.boundingBox())!.width - innerWidth)).toBeLessThan(1);
  await page.evaluate(() => {
    const request = (window as unknown as { reviewUpload: EventTarget & { status: number } }).reviewUpload;
    request.status = 200; request.dispatchEvent(new Event("load"));
  });
  await expect(row).toHaveAttribute("aria-label", /파일 확인 중/);
  await detail.screenshot({ path: testInfo.outputPath("upload-list-100.png") });
  releaseFinalize();
  await expect(row).toHaveCount(0);
  expect(cancelWidth).toBe(24);
});

test("copied table link restores the queue result and focuses the table", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openReview(page, 0);
  await page.getByRole("button", { name: "검사 결과표 링크 복사", exact: true }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const url = new URL(link);
  expect(url.searchParams.get("labResultId")).toBe("live-lab-review-work");
  expect(url.searchParams.get("date")).toBe("2026-09-29");
  expect(url.hash).toBe("#lab-result-table");
  await page.goto(link);
  await expect(page.getByTestId(`lab-result-row-${rowId}`)).toBeVisible();
  await expect(page.getByTestId("lab-result-table-anchor")).toBeFocused();
  const input = page.getByRole("textbox", { name: "합성 항목 결과값", exact: true });
  await input.fill("draft");
  await expect(input).toBeFocused();
});


test("reference component width preserves accepted table and card geometry", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const { detail, row } = await openReview(page, 4);
  const group = page.getByTestId("lab-result-table-anchor").locator("xpath=ancestor::section[1]");
  const initialWidth = (await group.boundingBox())!.width;
  await page.setViewportSize({ width: Math.round(1600 + 1246 - initialWidth), height: 1100 });
  await expect.poll(async () => (await group.boundingBox())!.width).toBe(1246);
  await expect(group).toHaveCSS("padding-top", "12px");
  await expect(group).toHaveCSS("padding-bottom", "12px");
  await expect(group.locator(":scope > div").first()).toHaveCSS("height", "28px");
  const disclosureLabel = group.locator('thead [data-column-id="disclosure"] [data-emr-table-content]');
  expect((await disclosureLabel.boundingBox())!.width).toBeLessThanOrEqual(1);
  const toolbar = (await group.locator(":scope > div").first().boundingBox())!;
  const tableTop = (await page.getByTestId("lab-result-table-anchor").boundingBox())!.y;
  expect(Math.abs(tableTop - toolbar.y - toolbar.height - 12)).toBeLessThan(1);
  await expect(row).toHaveCSS("height", "40px");
  const card = detail.getByTestId("lab-attachment-card").first();
  const rect = (await card.boundingBox())!;
  expect(Math.abs(rect.width - 130.625)).toBeLessThan(1.5);
  expect(Math.abs(rect.height - 108.552)).toBeLessThan(1.5);
  await expect(page.getByRole("textbox", { name: "합성 항목 결과값", exact: true })).toHaveCSS("font-size", "12px");
  await group.screenshot({ path: testInfo.outputPath("reference-1246.png") });
});


test("deleting the ninth synthetic card removes overflow and its fade", async ({ page }) => {
  const { detail, attachments } = await openReview(page, 9);
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments/review-file-0?resultId=*`, async route => {
    expect(route.request().method()).toBe("DELETE");
    attachments.splice(0, 1);
    await route.fulfill({ json: { ok: true } });
  });
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toBeVisible();
  const first = detail.getByTestId("lab-attachment-card").first();
  await first.hover();
  await first.getByRole("button", { name: /작업 메뉴$/ }).click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(8);
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
});


test("upload queue remains two-wide and cancellation cleans transfer and finalize races", async ({ page }) => {
  await installUploadHarness(page);
  const { detail } = await openReview(page, 0);
  const actions: Array<{ action: string; name?: string; attachmentId?: string }> = [];
  const deleted: string[] = [];
  let releaseFinalize!: () => void;
  const finalized = new Promise<void>(resolve => { releaseFinalize = resolve; });
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments/**`, async route => {
    deleted.push(route.request().method()); await route.fulfill({ json: { ok: true } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments`, async route => {
    const body = route.request().postDataJSON(); actions.push(body);
    if (body.action === "prepare") await route.fulfill({ json: { ok: true, attachmentId: body.name, objectPath: "synthetic", uploadToken: "synthetic", uploadUrl: "https://storage.example.test/signed" } });
    else if (body.action === "finalize") { await finalized; await route.fulfill({ json: { ok: true } }); }
    else await route.fulfill({ json: { ok: true } });
  });
  await detail.locator('input[type="file"]').setInputFiles([syntheticFile("first.txt"), syntheticFile("second.txt"), syntheticFile("queued.txt")]);
  await expect(detail.getByTestId("lab-upload-card")).toHaveCount(3);
  await expect.poll(() => actions.filter(a => a.action === "prepare").length).toBe(2);
  await detail.getByRole("button", { name: "queued.txt 업로드 취소" }).click();
  await detail.getByRole("button", { name: "first.txt 업로드 취소" }).click();
  await expect.poll(() => actions.some(a => a.action === "discard" && a.attachmentId === "first.txt")).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { reviewUploads: Array<{ fileName: string; aborted: boolean }> }).reviewUploads.find(r => r.fileName === "first.txt")!.aborted)).toBe(true);
  await settleTransfer(page, "second.txt");
  await expect(detail.getByRole("status", { name: /second.txt: 파일 확인 중/ })).toBeVisible();
  await detail.getByRole("button", { name: "second.txt 업로드 취소" }).click();
  releaseFinalize();
  await expect.poll(() => deleted).toEqual(["DELETE"]);
  await expect(detail.getByTestId("lab-upload-card")).toHaveCount(0);
  expect(actions.filter(a => a.action === "prepare").map(a => a.name)).toEqual(["first.txt", "second.txt"]);
});

test("cancel during prepare discards the reservation without starting a transfer", async ({ page }) => {
  await installUploadHarness(page);
  const { detail } = await openReview(page, 0);
  let releasePrepare!: () => void;
  const prepared = new Promise<void>(resolve => { releasePrepare = resolve; });
  const actions: string[] = [];
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments`, async route => {
    const body = route.request().postDataJSON(); actions.push(body.action);
    if (body.action === "prepare") { await prepared; await route.fulfill({ json: { ok: true, attachmentId: "synthetic", objectPath: "synthetic", uploadToken: "synthetic", uploadUrl: "https://storage.example.test/signed" } }); }
    else await route.fulfill({ json: { ok: true } });
  });
  await detail.locator('input[type="file"]').setInputFiles(syntheticFile("prepare.txt"));
  await expect.poll(() => actions).toEqual(["prepare"]);
  await detail.getByRole("button", { name: "prepare.txt 업로드 취소" }).click();
  releasePrepare();
  await expect.poll(() => actions).toEqual(["prepare", "discard"]);
  expect(await page.evaluate(() => (window as unknown as { reviewUploads: unknown[] }).reviewUploads.length)).toBe(0);
  await expect(detail.getByTestId("lab-upload-card")).toHaveCount(0);
});

test("transfer failure is retryable and closing the detail aborts the retry", async ({ page }) => {
  await installUploadHarness(page);
  const { detail, row } = await openReview(page, 0);
  const actions: string[] = [];
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments`, async route => {
    const body = route.request().postDataJSON(); actions.push(body.action);
    await route.fulfill({ json: body.action === "prepare" ? { ok: true, attachmentId: "synthetic", objectPath: "synthetic", uploadToken: "synthetic", uploadUrl: "https://storage.example.test/signed" } : { ok: true } });
  });
  await detail.locator('input[type="file"]').setInputFiles(syntheticFile("retry.txt"));
  await expect.poll(() => page.evaluate(() => (window as unknown as { reviewUploads: unknown[] }).reviewUploads.length)).toBe(1);
  await settleTransfer(page, "retry.txt", false);
  const card = detail.getByTestId("lab-upload-card");
  await expect(card).toHaveAttribute("title", "파일을 업로드하지 못했습니다.");
  await card.getByRole("button", { name: "retry.txt 업로드 재시도" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { reviewUploads: unknown[] }).reviewUploads.length)).toBe(2);
  await expect(card.getByText("—%", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: /소견.*접기/ }).click();
  await expect.poll(() => actions.filter(a => a === "discard").length).toBe(2);
  expect(await page.evaluate(() => (window as unknown as { reviewUploads: Array<{ aborted: boolean }> }).reviewUploads.at(-1)!.aborted)).toBe(true);
  await row.getByRole("button", { name: /소견.*펼치기/ }).click();
  await expect(detail.getByTestId("lab-upload-card")).toHaveCount(0);
});


for (const count of [1, 6]) {
  test(`list with ${count} files grows without an overflow cue`, async ({ page }) => {
    const { detail } = await openReview(page, count);
    await detail.getByRole("button", { name: "목록 보기", exact: true }).click();
    const region = detail.getByRole("region", { name: /첨부 목록 스크롤 영역/ });
    await expect.poll(() => region.evaluate(el => el.clientHeight)).toBe(count * 32 + (count - 1) * 4);
    await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
  });
}

test("attachment container resize recomputes two-column row height and overflow", async ({ page }) => {
  const { detail } = await openReview(page, 5);
  const area = detail.getByLabel("합성 항목 첨부 자료", { exact: true });
  await area.evaluate(el => { el.style.width = "360px"; });
  const grid = detail.getByTestId("lab-attachment-card-grid");
  const region = detail.getByRole("region", { name: /첨부 카드 스크롤 영역/ });
  await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(2);
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toBeVisible();
  const cardHeight = (await detail.getByTestId("lab-attachment-card").first().boundingBox())!.height;
  await expect.poll(async () => Math.abs((await region.boundingBox())!.height - (cardHeight * 2 + 10))).toBeLessThan(1.5);
  await area.evaluate(el => { el.style.width = ""; });
  await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(4);
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
});
