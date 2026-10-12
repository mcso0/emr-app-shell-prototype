import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";
import type { LabResultAttachment } from "../src/features/lab-imaging/use-lab-result-phase2";

const rowId = "figma-review-row";
const resultId = "figma-review-result";
const instruction = "합성 검수용 직원 전달사항입니다.";

async function openReview(page: Page, count: number, canEdit = true, rowCount = 1, overallCount = 0, customAttachments?: LabResultAttachment[], setupBeforeNavigate?: () => Promise<void>) {
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
    rows: Array.from({ length: rowCount }, (_, i) => ({ id: i === 0 ? rowId : `${rowId}-${i}`, analyteName: i === 0 ? "합성 항목" : `합성 항목 ${i + 1}`, value: null, resultValueKind: "text", judgment: "not_judged", note: "" })) };
  const attachments: LabResultAttachment[] = customAttachments ?? Array.from({ length: count }, (_, index) => ({ id: `review-file-${index}`, rowId,
    name: index === 0 ? "긴-첨부자료-파일명-겹침-검수-문서.pdf" : `합성첨부-${index}.txt`,
    mimeType: index === 0 ? "application/pdf" : "text/plain", size: 1024 * (index + 1),
    uploadedAt: "2026-09-29T00:00:00Z", uploadedByUserId: "review-actor", uploadedByName: "합성" }));
  attachments.push(...Array.from({ length: overallCount }, (_, index) => ({
    id: `overall-file-${index}`, rowId: null, name: `종합소견-첨부-${index}.txt`,
    mimeType: "text/plain", size: 1024, uploadedAt: "2026-09-29T00:00:00Z",
    uploadedByUserId: "review-actor", uploadedByName: "합성",
  })));
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items**`, route => route.fulfill({ json: { ok: true, workItems: [workItem] } }));
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-entries**`, route => route.fulfill({ json: result }));
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-phase2**`, route => route.fulfill({ json: {
    ok: true, data: { resultId, orderId: workItem.orderId, overallFinding: "", overallRevision: 0, canEdit, events: [], attachments },
  } }));
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments/**`, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    const item = attachments.find(file => file.id === id);
    if (!item) return route.fulfill({ status: 404 });
    await route.fulfill({ headers: { "Content-Type": item.mimeType, "Cache-Control": "private, no-store" },
      body: item.mimeType === "application/pdf" ? thumbnailPdf() : item.mimeType.startsWith("image/") ? thumbnailPng : "Synthetic attachment text" });
  });
  await setupBeforeNavigate?.();
  await page.goto(`/w/${workspaceId}/lab?date=2026-09-29&labResultId=live-lab-${workItem.id}&modulePanel=closed&aside=closed&right=closed`);
  const row = page.getByTestId(`lab-result-row-${rowId}`);
  await expect(row).toBeVisible();
  await expect(page.getByTestId("lab-result-table-anchor").locator("xpath=ancestor::section[1]").getByRole("button", { name: "수정이력", exact: true })).toBeEnabled();
  await row.getByRole("button", { name: /소견.*펼치기/ }).click();
  const detail = page.getByTestId(`lab-result-detail-${rowId}`);
  await expect(detail).toBeVisible();
  return { detail, row, attachments };
}

const thumbnailPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJxoAAAAASUVORK5CYII=", "base64");

function thumbnailPdf() {
  const streams = ["1 0 0 rg 0 0 200 300 re f", "0 0 1 rg 0 0 200 300 re f"];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << >> /Contents 4 0 R >>",
    `<< /Length ${streams[0].length} >>\nstream\n${streams[0]}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << >> /Contents 6 0 R >>",
    `<< /Length ${streams[1].length} >>\nstream\n${streams[1]}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

function thumbnailFiles(types: string[]) {
  return types.map((mimeType, index): LabResultAttachment => ({ id: `thumbnail-${index}`, rowId,
    name: `합성자료-${index}.${mimeType === "application/pdf" ? "pdf" : mimeType === "text/csv" ? "csv" : mimeType === "text/plain" ? "txt" : "png"}`,
    mimeType, size: 1024, uploadedAt: "2026-10-04T00:00:00Z", uploadedByUserId: "synthetic-actor", uploadedByName: "합성" }));
}

async function expectOpaqueCardAction(action: Locator, channel: number) {
  const { data, info } = await sharp(await action.screenshot({ animations: "disabled" })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (4 * info.width + 4) * info.channels;
  expect([...data.subarray(offset, offset + 3)]).toEqual([channel, channel, channel]);
}

test("attachment card actions stay opaque in both finding areas while focused, hovered and open", async ({ page }, testInfo) => {
  const files = thumbnailFiles(["image/png", "application/pdf", "text/plain"]);
  const { detail } = await openReview(page, 0, true, 1, 0, [
    ...files,
    ...files.map(file => ({ ...file, id: `overall-${file.id}`, rowId: null, name: `종합-${file.name}` })),
  ]);
  for (const region of [detail, page.getByTestId("lab-overall-finding")]) {
    for (const card of await region.getByTestId("lab-attachment-card").all()) {
      const action = card.getByRole("button", { name: /작업 메뉴$/ });
      await action.focus();
      await page.mouse.move(0, 0);
      await expect(action).toBeFocused();
      await expectOpaqueCardAction(action, 255);
      await action.hover();
      await expectOpaqueCardAction(action, 245);
      await action.click();
      await page.getByRole("menuitem", { name: "미리보기", exact: true }).hover();
      await expect(action).toHaveAttribute("aria-expanded", "true");
      await expect(action.locator("..")).toHaveCSS("opacity", "1");
      await expectOpaqueCardAction(action, 245);
      await page.keyboard.press("Escape");
      await expect(action).toBeFocused();
    }
  }
  await page.getByTestId("lab-overall-finding").screenshot({ path: testInfo.outputPath("opaque-card-actions.png") });
});

test("thumbnail: PDF renders the real first page while CSV and TXT stay type icons", async ({ page }, testInfo) => {
  const reads: string[] = [];
  page.on("request", request => { if (request.url().includes("/result-attachments/")) reads.push(request.url()); });
  const { detail } = await openReview(page, 0, false, 1, 0, thumbnailFiles(["application/pdf", "text/csv", "text/plain"]));
  const canvas = detail.getByTestId("lab-pdf-thumbnail").locator("canvas");
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    if (!element.width || !element.height) return false;
    const pixel = element.getContext("2d")!.getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data;
    return pixel[0] > 240 && pixel[1] < 20 && pixel[2] < 20;
  })).toBe(true);
  await expect(detail.getByText("PDF · 1페이지")).toBeVisible();
  expect(reads.every(url => url.includes("/thumbnail-0?resultId="))).toBe(true);
  const box = await canvas.boundingBox(); const thumb = await detail.getByTestId("lab-pdf-thumbnail").boundingBox();
  expect(box!.height).toBeLessThanOrEqual(thumb!.height + 1);
  expect(box!.width).toBeLessThanOrEqual(thumb!.width + 1);
  await detail.screenshot({ path: testInfo.outputPath("pdf-first-page-and-type-icons.png") });
  const cardReads = reads.length;
  await detail.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(detail.getByTestId("lab-pdf-thumbnail")).toHaveCount(0);
  expect(reads).toHaveLength(cardReads);
  await detail.getByTitle("합성자료-0.pdf", { exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "합성자료-0.pdf", exact: true });
  await expect(viewer.getByLabel("현재 PDF 페이지")).toHaveText("1 / 2");
  await viewer.getByRole("button", { name: "다음", exact: true }).click();
  await expect(viewer.getByLabel("현재 PDF 페이지")).toHaveText("2 / 2");
});

test("thumbnail: image read failure is separate from upload and keyboard retry restores it", async ({ page }, testInfo) => {
  let reads = 0;
  const { detail } = await openReview(page, 0, false, 1, 0, thumbnailFiles(["image/png"]));
  await expect.poll(() => detail.locator('img[loading="lazy"]').evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments/thumbnail-0?*`, async route => {
    reads += 1;
    await route.fulfill(reads === 1 || reads === 3 ? { status: 500 } : { contentType: "image/png", headers: { "Cache-Control": "private, no-store" }, body: thumbnailPng });
  });
  await page.reload();
  await page.getByTestId(`lab-result-row-${rowId}`).getByRole("button", { name: /소견.*펼치기/ }).click();
  const failure = detail.getByText("읽기 실패", { exact: true });
  await expect(failure).toBeVisible();
  const failureBox = await failure.boundingBox();
  const previewBox = await detail.getByRole("button", { name: "합성자료-0.png 미리보기", exact: true }).boundingBox();
  expect(failureBox!.y).toBeGreaterThanOrEqual(previewBox!.y);
  expect(failureBox!.y + failureBox!.height).toBeLessThanOrEqual(previewBox!.y + (previewBox!.width * 107 / 190));
  await expect(detail.getByText("업로드 실패", { exact: false })).toHaveCount(0);
  await detail.screenshot({ path: testInfo.outputPath("thumbnail-read-failure.png") });
  const retry = detail.getByRole("button", { name: "합성자료-0.png 미리보기 다시 불러오기" });
  await retry.focus(); await page.mouse.move(0, 0); await expectOpaqueCardAction(retry, 255);
  await retry.hover(); await expectOpaqueCardAction(retry, 245);
  await retry.press("Enter");
  const image = detail.getByTestId("lab-attachment-card").locator('img[loading="lazy"]');
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  expect(reads).toBe(2);
  await expect(detail.getByRole("button", { name: "합성자료-0.png 미리보기", exact: true })).toBeFocused();
  await detail.getByRole("button", { name: "목록 보기", exact: true }).click();
  await expect(detail.getByLabel("이미지 미리보기 읽기 실패")).toBeVisible();
  await detail.getByRole("button", { name: "합성자료-0.png 작업 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "미리보기 다시 불러오기", exact: true }).click();
  await expect.poll(() => detail.getByTestId("lab-attachment-list-row").locator('img[loading="lazy"]').evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  expect(reads).toBe(4);
});

test("thumbnail: PDF load failure can retry without changing the stored attachment", async ({ page }) => {
  const { detail } = await openReview(page, 0, false, 1, 0, thumbnailFiles(["application/pdf"]));
  await expect.poll(() => detail.getByTestId("lab-pdf-thumbnail").locator("canvas").evaluate((element: HTMLCanvasElement) => element.width > 0)).toBe(true);
  let reads = 0;
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments/thumbnail-0?*`, async route => {
    reads += 1; await route.fulfill(reads === 1 ? { status: 403 } : { contentType: "application/pdf", body: thumbnailPdf() });
  });
  await page.reload();
  await page.getByTestId(`lab-result-row-${rowId}`).getByRole("button", { name: /소견.*펼치기/ }).click();
  await expect(detail.getByText("읽기 실패", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "합성자료-0.pdf 미리보기 다시 불러오기" }).click();
  await expect.poll(() => detail.getByTestId("lab-pdf-thumbnail").locator("canvas").evaluate((element: HTMLCanvasElement) => element.width > 0 && element.height > 0)).toBe(true);
  await expect(detail.getByText("읽기 실패", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("합성자료-0.pdf", { exact: true })).toBeVisible();
  expect(reads).toBe(2);
});

test("thumbnail: PDFs below the file viewport defer loading until scrolled into view", async ({ page }) => {
  const reads: string[] = [];
  page.on("request", request => { if (request.url().includes("/result-attachments/")) reads.push(request.url()); });
  const { detail } = await openReview(page, 0, false, 1, 0, thumbnailFiles(Array(9).fill("application/pdf")));
  await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(9);
  await expect.poll(() => reads.some(url => url.includes("/thumbnail-0?"))).toBe(true);
  expect(reads.some(url => url.includes("/thumbnail-8?"))).toBe(false);
  const viewport = detail.getByRole("region", { name: /첨부 카드 스크롤 영역/ });
  await viewport.focus(); await page.keyboard.press("End");
  await expect.poll(() => reads.some(url => url.includes("/thumbnail-8?"))).toBe(true);
});

test("overall finding uses equal text and upload columns without prototype subtext", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1386, height: 870 });
  const { detail } = await openReview(page, 0);
  const overall = page.getByTestId("lab-overall-finding");
  const input = overall.getByLabel("검사결과 종합소견", { exact: true });
  const upload = overall.getByRole("button", { name: "첨부자료 업로드", exact: true });
  await expect(input).toBeEnabled();
  await expect(upload).toBeEnabled();
  const textBox = (await input.boundingBox())!;
  const uploadBox = (await upload.boundingBox())!;
  expect(Math.abs(textBox.y - uploadBox.y)).toBeLessThan(1);
  expect(Math.abs(textBox.width - uploadBox.width)).toBeLessThan(1);
  expect(uploadBox.x).toBeGreaterThan(textBox.x + textBox.width);
  expect(textBox.height).toBe(128);
  expect(uploadBox.height).toBe(128);
  await expect(input).toHaveAttribute("maxlength", "10000");
  await expect(detail.getByLabel("검사 소견", { exact: true })).toHaveCSS("height", "76px");
  await expect(page.getByText("화면 시안 · 입력 내용과 선택한 파일은 서버로 전송되지 않습니다.", { exact: true })).toHaveCount(0);
  await overall.screenshot({ path: testInfo.outputPath("overall-empty-desktop.png") });
  await page.setViewportSize({ width: 740, height: 870 });
  await expect.poll(async () => {
    const text = (await input.boundingBox())!; const file = (await upload.boundingBox())!;
    return file.y > text.y + text.height && Math.abs(file.x - text.x) < 1;
  }).toBe(true);
});

test("overall attachments remain separate from item files and respect read-only access", async ({ page }) => {
  const { detail } = await openReview(page, 1, false, 1, 1);
  const overall = page.getByTestId("lab-overall-finding");
  await expect(overall.getByTestId("lab-attachment-card")).toHaveCount(1);
  await expect(overall.getByText("종합소견-첨부-0.txt", { exact: true })).toBeVisible();
  await expect(overall.getByText("긴-첨부자료-파일명-겹침-검수-문서.pdf", { exact: true })).toHaveCount(0);
  await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(1);
  await expect(detail.getByText("종합소견-첨부-0.txt", { exact: true })).toHaveCount(0);
  await expect(overall.getByLabel("검사결과 종합소견", { exact: true })).toBeDisabled();
  await overall.hover();
  await expect(overall.getByRole("button", { name: "첨부 자료 추가", exact: true })).toHaveCount(0);
  await expect(overall.getByRole("button", { name: /미리보기$/ })).toBeEnabled();
  await expect(overall.locator('input[type="file"]')).toBeDisabled();
});

test("overall upload prepares explicit null, survives refresh and deletes only its own file", async ({ page }) => {
  await installUploadHarness(page);
  const { detail, attachments } = await openReview(page, 1);
  const overall = page.getByTestId("lab-overall-finding");
  const actions: Array<{action: string; rowId?: string | null}> = [];
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments`, async route => {
    const body = route.request().postDataJSON(); actions.push(body);
    if (body.action === "prepare") {
      expect(body.resultId).toBe(resultId); expect(body.rowId).toBeNull();
      await route.fulfill({ json: { ok: true, attachmentId: "overall-upload", objectPath: "synthetic/overall", uploadToken: "synthetic-token", uploadUrl: "https://storage.example.test/signed" } });
    } else if (body.action === "finalize") {
      attachments.push({id: "overall-upload", rowId: null, name: "overall.txt", mimeType: "text/plain", size: 32,
        uploadedAt: "2026-10-04T00:00:00Z", uploadedByUserId: "review-actor", uploadedByName: "합성"});
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: { ok: true } });
  });
  await overall.locator('input[type="file"]').setInputFiles({name: "overall.txt", mimeType: "text/plain", buffer: Buffer.from("synthetic overall attachment")});
  await expect(overall.getByTestId("lab-upload-card")).toBeVisible();
  await page.evaluate(() => {
    const request = (window as unknown as { reviewUpload: EventTarget & { status: number } }).reviewUpload;
    request.status = 200; request.dispatchEvent(new Event("load"));
  });
  await expect(overall.getByTestId("lab-upload-card")).toHaveCount(0);
  await expect(overall.getByText("overall.txt", { exact: true })).toBeVisible();
  expect(actions.map(action => action.action)).toEqual(["prepare", "finalize"]);
  await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(1);
  await page.reload();
  await expect(overall.getByText("overall.txt", { exact: true })).toBeVisible();
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments/overall-upload?resultId=*`, async route => {
    expect(route.request().method()).toBe("DELETE");
    attachments.splice(attachments.findIndex(item => item.id === "overall-upload"), 1);
    await route.fulfill({ json: { ok: true } });
  });
  const file = overall.getByTestId("lab-attachment-card");
  await file.hover(); await file.getByRole("button", { name: /작업 메뉴$/ }).click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(overall.getByTestId("lab-attachment-card")).toHaveCount(0);
  expect(attachments).toHaveLength(1); expect(attachments[0].rowId).toBe(rowId);
});

test("result table fits narrow and wide containers while preserving drafts and minimum-width scrolling", async ({ page }, testInfo) => {
  const { row, detail } = await openReview(page, 0);
  await mockAutosave(page);
  const input = page.getByRole("textbox", { name: "합성 항목 결과값", exact: true });
  const finding = detail.getByRole("textbox", { name: "검사 소견", exact: true });
  const table = page.getByRole("table", { name: "임상병리 검사 결과 입력", exact: true });
  const viewport = page.getByTestId("lab-result-table-anchor").locator('[data-slot="table-container"]');
  const overflow = () => viewport.evaluate(el => el.scrollWidth - el.clientWidth);
  const appearance = () => input.evaluate(el => {
    const style = getComputedStyle(el);
    return { fontSize: style.fontSize, lineHeight: style.lineHeight, height: style.height,
      padding: style.padding, borderRadius: style.borderRadius, background: style.backgroundColor };
  });
  const originalAppearance = await appearance();
  await input.fill("responsive draft");
  await finding.fill("검사 소견 임시 입력");
  await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await expect(table.locator("thead th")).toHaveCount(7);
  expect((await table.boundingBox())!.width).toBeLessThan(1198);
  await table.screenshot({ path: testInfo.outputPath("responsive-narrow.png") });
  await page.getByRole("button", { name: "넓게 보기", exact: true }).click();
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1600, height: 1080 });
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "장비 검사 수신함", exact: true }).click();
  await expect(page.getByRole("button", { name: "장비 검사 수신함", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1366, height: 1080 });
  await expect.poll(overflow).toBeGreaterThan(0);
  await page.getByRole("button", { name: "장비 검사 수신함", exact: true }).click();
  await expect.poll(overflow).toBeLessThanOrEqual(1);
  await input.focus();
  await page.setViewportSize({ width: 800, height: 1080 });
  await expect.poll(overflow).toBeGreaterThan(0);
  await expect.poll(async () => (await table.boundingBox())!.width).toBeCloseTo(904, 0);
  await expect(input).toHaveValue("responsive draft");
  await expect(input).toBeFocused();
  await expect(finding).toHaveValue("검사 소견 임시 입력");
  await expect(row.getByRole("button", { name: /소견.*접기/ })).toHaveAttribute("aria-expanded", "true");
  expect(await appearance()).toEqual(originalAppearance);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await viewport.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  const header = table.locator('thead [data-column-id="assignee"]');
  const cell = row.locator('[data-column-id="assignee"]');
  const headerBox = (await header.boundingBox())!; const cellBox = (await cell.boundingBox())!;
  expect(Math.abs(headerBox.x - cellBox.x)).toBeLessThan(1);
  expect(Math.abs(headerBox.width - cellBox.width)).toBeLessThan(1);
  await viewport.screenshot({ path: testInfo.outputPath("responsive-minimum-scroll.png") });
});


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
  await expect(drop).toHaveCSS("height", "76px");
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
  // Focusing the list can scroll the outer result sheet; compare within this detail.
  const headerOffset = (await header.boundingBox())!.y - (await detail.boundingBox())!.y;
  await expect(detail.getByTestId("lab-attachment-list-row")).toHaveCount(7);
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toBeVisible();
  await region.focus(); await page.keyboard.press("End");
  await expect(detail.getByTestId("lab-attachment-overflow-fade")).toHaveCount(0);
  expect((await header.boundingBox())!.y - (await detail.boundingBox())!.y).toBe(headerOffset);
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
  expect(Math.abs(rect.width - 127.125)).toBeLessThan(1.5);
  expect(Math.abs(rect.height - 106.581)).toBeLessThan(1.5);
  await expect(page.getByRole("textbox", { name: "합성 항목 결과값", exact: true })).toHaveCSS("font-size", "12px");
  await group.screenshot({ path: testInfo.outputPath("reference-1246.png") });
});


test("deleting the ninth synthetic card removes overflow and its fade", async ({ page }) => {
  const { detail, attachments } = await openReview(page, 9);
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-attachments/review-file-0?resultId=*`, async route => {
    if (route.request().method() === "GET") return route.fallback();
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


// Approved 2026-09-29 AS-IS → TO-BE follow-up: rendered outcomes, not CSS snapshots.
test("layout follow-up: toolbar has three aligned actions without manual save or reset menu", async ({ page }) => {
  await page.setViewportSize({ width: 1782, height: 1254 });
  await openReview(page, 0);
  const group = page.getByTestId("lab-result-table-anchor").locator("xpath=ancestor::section[1]");
  const actions = group.locator(":scope > div").first().locator(":scope > div").last();
  await expect(actions.getByRole("button")).toHaveCount(3);
  await expect(actions.getByRole("button")).toHaveText(["기본 간격", "수정이력", "링크 복사"]);
  const buttons = await actions.getByRole("button").all();
  for (const button of buttons) expect((await button.boundingBox())!.height).toBe(28);
  const boxes = await Promise.all(buttons.map(button => button.boundingBox()));
  expect(boxes[1]!.x - boxes[0]!.x - boxes[0]!.width).toBeCloseTo(8, 0);
  expect(boxes[2]!.x - boxes[1]!.x - boxes[1]!.width).toBeCloseTo(8, 0);
  await expect(page.getByTestId("lab-result-save-button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "검사 결과 추가 작업", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "종합소견 저장", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("lab-result-table-anchor").locator("xpath=ancestor::section[1]").getByRole("button", { name: "수정이력", exact: true })).toBeEnabled();
  await page.screenshot({ path: "output/lab-autosave/result-sheet.png" });
});

test("layout follow-up: only normal range grows and both table edges retain eight pixels", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await openReview(page, 0);
  const anchor = page.getByTestId("lab-result-table-anchor");
  const group = anchor.locator("xpath=ancestor::section[1]");
  await page.setViewportSize({ width: Math.round(1600 + 1246 - (await group.boundingBox())!.width), height: 1100 });
  await expect.poll(async () => (await group.boundingBox())!.width).toBe(1246);
  const table = page.getByRole("table", { name: "임상병리 검사 결과 입력" });
  const container = anchor.locator('[data-slot="table-container"]');
  const tableBox = (await table.boundingBox())!; const containerBox = (await container.boundingBox())!;
  expect(tableBox.width).toBeCloseTo(1198, 0);
  expect(tableBox.x - containerBox.x).toBeCloseTo(8, 0);
  expect(containerBox.x + containerBox.width - tableBox.x - tableBox.width).toBeCloseTo(8, 0);
  const widths = () => table.locator('thead [data-column-id]').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
  const baseline = await widths();
  [24, 280, 240, 120, 254, 120, 160].forEach((width, i) => expect(baseline[i]).toBeCloseTo(width, 0));
  const input = page.getByRole("textbox", { name: "합성 항목 결과값", exact: true });
  expect((await input.boundingBox())!.width).toBeCloseTo(220, 0);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width + 143, height: viewport.height });
  await expect.poll(async () => (await widths())[4] - baseline[4]).toBeCloseTo(143, 0);
  const wide = await widths();
  [0,1,2,3,5,6].forEach(i => expect(wide[i]).toBeCloseTo(baseline[i], 0));
  expect(wide[4] - baseline[4]).toBeCloseTo(143, 0);
});

test("layout follow-up: empty upload is transparent until hover and matches finding geometry", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1782, height: 1254 });
  const { detail } = await openReview(page, 0);
  const finding = detail.getByRole("textbox", { name: "검사 소견", exact: true });
  const upload = detail.getByRole("button", { name: "첨부자료 업로드", exact: true });
  await page.mouse.move(0,0);
  await expect(upload).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const a = (await finding.boundingBox())!; const b = (await upload.boundingBox())!;
  expect(a.height).toBe(76); expect(b.height).toBe(76);
  expect(a.y).toBe(b.y); expect(a.width).toBeCloseTo(b.width, 0);
  expect(b.x - a.x - a.width).toBeCloseTo(53, 0);
  expect((await detail.boundingBox())!.y + (await detail.boundingBox())!.height - a.y - a.height).toBeCloseTo(26, 0);
  await expect(finding).toHaveCSS("font-size", "12px");
  await expect(finding).toHaveCSS("line-height", "16px");
  await upload.hover();
  await expect(upload).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await upload.focus(); await expect(upload).toBeFocused();
  await detail.screenshot({ path: testInfo.outputPath("aligned-empty-hover.png") });
});

test("row dividers: a single order has no divider when expanded or collapsed", async ({ page }, testInfo) => {
  const { row, detail } = await openReview(page, 1);
  await expect(detail.getByRole("textbox", { name: "검사 소견", exact: true })).toBeVisible();
  await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(1);
  await expect(row).toHaveCSS("border-bottom-width", "0px");
  for (const cell of await row.locator(":scope > td").all()) {
    await expect(cell).toHaveCSS("border-bottom-width", "0px");
  }
  const expanded = detail.locator("xpath=ancestor::tr[1]");
  await expect(expanded).toHaveCSS("border-bottom-width", "0px");
  await expect(expanded.locator(":scope > td")).toHaveCSS("border-bottom-width", "0px");
  await page.getByTestId("lab-result-table-anchor").screenshot({ path: testInfo.outputPath("single-order-expanded.png") });
  await row.getByRole("button", { name: /소견.*접기/ }).press("Enter");
  await expect(detail).toHaveCount(0);
  await expect(row).toHaveCSS("border-bottom-width", "0px");
  for (const cell of await row.locator(":scope > td").all()) {
    await expect(cell).toHaveCSS("border-bottom-width", "0px");
  }
});

test("layout follow-up: dividers belong to complete row groups and disclosure remains single-open", async ({ page }, testInfo) => {
  const { row, detail } = await openReview(page, 1, true, 3);
  await expect(row).toHaveCSS("border-bottom-width", "0px");
  for (const cell of await row.locator(":scope > td").all()) {
    await expect(cell).toHaveCSS("border-bottom-width", "0px");
  }
  const expanded = detail.locator("xpath=ancestor::tr[1]");
  await expect(expanded).toHaveCSS("border-bottom-width", "1px");
  await expect(expanded.locator(":scope > td")).toHaveCSS("border-bottom-width", "1px");
  const table = page.getByTestId("lab-result-table-anchor");
  await table.screenshot({ path: testInfo.outputPath("multiple-orders-first-expanded.png") });
  const nextRow = page.getByTestId(`lab-result-row-${rowId}-1`);
  for (const cell of await nextRow.locator(":scope > td").all()) {
    await expect(cell).toHaveCSS("border-bottom-width", "1px");
  }
  await nextRow.getByRole("button", { name: /소견.*펼치기/ }).click();
  await expect(detail).toHaveCount(0);
  await expect(row.getByRole("button", { name: /소견.*펼치기/ })).toHaveAttribute("aria-expanded", "false");
  for (const cell of await row.locator(":scope > td").all()) {
    await expect(cell).toHaveCSS("border-bottom-width", "1px");
  }
  for (const cell of await nextRow.locator(":scope > td").all()) {
    await expect(cell).toHaveCSS("border-bottom-width", "0px");
  }
  const middleDetail = page.getByTestId(`lab-result-detail-${rowId}-1`);
  await expect(middleDetail.locator("xpath=ancestor::tr[1]")).toHaveCSS("border-bottom-width", "1px");
  await expect(middleDetail.locator("xpath=ancestor::tr[1]").locator(":scope > td")).toHaveCSS("border-bottom-width", "1px");
  const lastRow = page.getByTestId(`lab-result-row-${rowId}-2`);
  await lastRow.getByRole("button", { name: /소견.*펼치기/ }).click();
  await expect(middleDetail).toHaveCount(0);
  const lastDetail = page.getByTestId(`lab-result-detail-${rowId}-2`);
  await expect(lastDetail).toBeVisible();
  await expect(lastRow).toHaveCSS("border-bottom-width", "0px");
  for (const cell of await lastRow.locator(":scope > td").all()) {
    await expect(cell).toHaveCSS("border-bottom-width", "0px");
  }
  await expect(lastDetail.locator("xpath=ancestor::tr[1]")).toHaveCSS("border-bottom-width", "0px");
  await expect(lastDetail.locator("xpath=ancestor::tr[1]").locator(":scope > td")).toHaveCSS("border-bottom-width", "0px");
  await table.screenshot({ path: testInfo.outputPath("multiple-orders-last-expanded.png") });
  await lastRow.getByRole("button", { name: /소견.*접기/ }).press("Enter");
  await expect(lastDetail).toHaveCount(0);
});

// Stateful, synthetic API boundary: only this local browser test receives writes.
async function mockAutosave(page: Page, options: {
  entryStatus?: number;
  holdPost?: () => Promise<void>;
  holdReadback?: () => Promise<void>;
  holdFinding?: () => Promise<void>;
} = {}) {
  const entry = { ok: true, workspaceId, resultId, orderId: "review-order", encounterId: "review-encounter", workItemId: "review-work",
    entryWriteRevision: 0, resultDefinitionSnapshot: { schemaVersion: 1 },
    rows: [{ id: rowId, analyteName: "합성 항목", value: null as string | null, resultValueKind: "text", judgment: "not_judged", note: "" }] };
  const phase2 = { resultId, orderId: "review-order", overallFinding: "", overallRevision: 0, canEdit: true, events: [], attachments: [] };
  const posts: Array<{ requestId: string; expectedEntryWriteRevision: number; rows: Array<{ rowId: string; value: string; note: string }> }> = [];
  const findings: Array<{ finding: string; expectedRevision: number }> = [];
  let entryStatus = options.entryStatus;
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-entries**`, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); posts.push(body);
      if (posts.length === 1) await options.holdPost?.();
      if (entryStatus) {
        const status = entryStatus; entryStatus = undefined;
        await route.fulfill({ status, json: { ok: false, error: status === 409 ? "revision_conflict" : "save_failed" } }); return;
      }
      entry.entryWriteRevision++;
      entry.rows = entry.rows.map(row => ({ ...row, value: body.rows[0].value, note: body.rows[0].note ?? "" }));
    } else if (entry.entryWriteRevision > 0) await options.holdReadback?.();
    await route.fulfill({ json: entry });
  });
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-phase2**`, async route => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON(); findings.push(body);
      if (findings.length === 1) await options.holdFinding?.();
      phase2.overallFinding = body.finding; phase2.overallRevision++;
      await route.fulfill({ json: { ok: true, data: { finding: body.finding, revision: phase2.overallRevision } } });
    } else await route.fulfill({ json: { ok: true, data: phase2 } });
  });
  return { posts, findings, entry, phase2 };
}

function gate() {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  return { waiting, release };
}

test("autosave: result values and item findings persist without manual buttons", async ({ page }) => {
  await openReview(page, 0);
  const api = await mockAutosave(page);
  await expect(page.getByTestId("lab-result-save-button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "검사 결과 추가 작업" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "종합소견 저장" })).toHaveCount(0);
  expect(api.posts).toHaveLength(0); expect(api.findings).toHaveLength(0);
  const input = page.getByLabel("합성 항목 결과값", { exact: true });
  await input.fill("첫 입력"); await input.fill("최신 입력");
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  expect(api.posts).toHaveLength(1);
  await page.getByLabel("검사 소견", { exact: true }).fill("항목별 소견");
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  expect(api.posts.at(-1)).toMatchObject({ expectedEntryWriteRevision: 1, rows: [{ value: "최신 입력", note: "항목별 소견" }] });
  await page.reload();
  await expect(input).toHaveValue("최신 입력");
  await page.getByTestId(`lab-result-row-${rowId}`).getByRole("button", { name: /소견.*펼치기/ }).click();
  await expect(page.getByLabel("검사 소견", { exact: true })).toHaveValue("항목별 소견");
});

test("autosave: edits during an in-flight save use the acknowledged revision", async ({ page }) => {
  await openReview(page, 0); const pending = gate();
  const api = await mockAutosave(page, { holdPost: () => pending.waiting });
  const input = page.getByLabel("합성 항목 결과값", { exact: true });
  await input.fill("첫 입력"); await expect.poll(() => api.posts.length).toBe(1);
  await input.fill("저장 중 새 입력"); await expect(input).toHaveValue("저장 중 새 입력");
  pending.release();
  await expect.poll(() => api.posts.length).toBe(2);
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  expect(api.posts[1]).toMatchObject({ expectedEntryWriteRevision: 1, rows: [{ value: "저장 중 새 입력" }] });
  await expect(input).toHaveValue("저장 중 새 입력");
});

test("autosave: delayed readback never restores stale values or notes", async ({ page }) => {
  await openReview(page, 0); const pending = gate();
  const api = await mockAutosave(page, { holdReadback: () => pending.waiting });
  const input = page.getByLabel("합성 항목 결과값", { exact: true });
  await input.fill("유지할 결과값");
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  await expect(input).toHaveValue("유지할 결과값");
  await page.getByLabel("검사 소견", { exact: true }).fill("새 소견");
  await expect.poll(() => api.posts.length).toBe(2);
  expect(api.posts[1]).toMatchObject({ expectedEntryWriteRevision: 1, rows: [{ value: "유지할 결과값", note: "새 소견" }] });
  pending.release(); await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  // A newer server baseline must not resurrect the previously saved draft.
  api.entry.entryWriteRevision = 3; api.entry.rows[0].note = "서버의 새 소견";
  await page.reload();
  await expect(input).toHaveValue("유지할 결과값");
  await input.fill("다음 결과값");
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  expect(api.posts.at(-1)).toMatchObject({ expectedEntryWriteRevision: 3, rows: [{ value: "다음 결과값", note: "서버의 새 소견" }] });
});

test("autosave: failed requests retain drafts and retry before newer edits", async ({ page }) => {
  await openReview(page, 0); const api = await mockAutosave(page, { entryStatus: 500 });
  await page.getByLabel("합성 항목 결과값", { exact: true }).fill("첫 입력");
  await expect(page.getByTestId("lab-result-save-status")).toContainText("저장 실패");
  await page.getByLabel("합성 항목 결과값", { exact: true }).fill("실패 후 새 입력");
  await page.getByTestId("lab-result-save-retry-button").click();
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  expect(api.posts).toHaveLength(3);
  expect(api.posts[1].requestId).toBe(api.posts[0].requestId);
  expect(api.posts[2]).toMatchObject({ expectedEntryWriteRevision: 1, rows: [{ value: "실패 후 새 입력" }] });
});

test("autosave: revision conflicts preserve input and stop automatic writes", async ({ page }) => {
  await openReview(page, 0); const api = await mockAutosave(page, { entryStatus: 409 });
  const input = page.getByLabel("합성 항목 결과값", { exact: true });
  await input.fill("보존할 입력");
  await expect(page.getByTestId("lab-result-save-status")).toContainText("다른 수정이 저장됐습니다");
  await input.fill("추가 입력"); await input.blur();
  await expect(input).toHaveValue("추가 입력"); expect(api.posts).toHaveLength(1);
  await expect(page.getByTestId("lab-result-save-retry-button")).toHaveCount(0);
});

test("autosave: overall finding serializes edits without a save button", async ({ page }) => {
  await openReview(page, 0); const pending = gate();
  const api = await mockAutosave(page, { holdFinding: () => pending.waiting });
  const input = page.getByLabel("검사결과 종합소견", { exact: true });
  await input.fill("첫 종합소견"); await expect.poll(() => api.findings.length).toBe(1);
  await input.fill("저장 중 수정한 종합소견"); pending.release();
  await expect(page.getByTestId("lab-overall-save-status")).toHaveText("저장됨");
  expect(api.findings).toMatchObject([{ finding: "첫 종합소견", expectedRevision: 0 }, { finding: "저장 중 수정한 종합소견", expectedRevision: 1 }]);
  await expect(input).toHaveValue("저장 중 수정한 종합소견");
  await page.reload(); await expect(input).toHaveValue("저장 중 수정한 종합소견");
});

test("autosave: read-only results do not allow value or finding writes", async ({ page }) => {
  await openReview(page, 0, false); const api = await mockAutosave(page);
  await expect(page.getByLabel("합성 항목 결과값", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("검사 소견", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("검사결과 종합소견", { exact: true })).toBeDisabled();
  expect(api.posts).toHaveLength(0); expect(api.findings).toHaveLength(0);
});

test("autosave: switching modules retains a draft when the detached save fails", async ({ page }) => {
  await openReview(page, 0); const pending = gate();
  const api = await mockAutosave(page, { entryStatus: 500, holdPost: () => pending.waiting });
  const url = page.url();
  await page.getByLabel("합성 항목 결과값", { exact: true }).fill("이동해도 보존할 입력");
  await expect.poll(() => api.posts.length).toBe(1);
  await page.getByRole("link", { name: "홈 화면", exact: true }).click();
  await expect(page.getByLabel("합성 항목 결과값", { exact: true })).toHaveCount(0);
  pending.release();
  await expect(page.getByText("검사 결과를 저장하지 못했습니다. 검사를 다시 열어 입력을 확인해 주세요.", { exact: true })).toBeVisible();
  // App navigation preserves session memory; a full reload would deliberately
  // invoke the browser's unsaved-change guard instead.
  await page.getByRole("link", { name: "임상병리검사", exact: true }).click();
  const queue = page.getByTestId("lab-queue-item-live-lab-review-work");
  if (await queue.isVisible()) await queue.click();
  await expect(page.getByLabel("합성 항목 결과값", { exact: true })).toHaveValue("이동해도 보존할 입력");
  await expect(page.getByTestId("lab-result-save-status")).toContainText("저장 실패");
  await page.getByTestId("lab-result-save-retry-button").click();
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  expect(api.posts[1].requestId).toBe(api.posts[0].requestId);
  expect(new URL(url).searchParams.get("labResultId")).toBe("live-lab-review-work");
});

test("autosave: a failed result readback keeps the saved input and visible retry", async ({ page }) => {
  await openReview(page, 0); const api = await mockAutosave(page);
  let failRead = true;
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-entries?*`, async route => {
    if (failRead) await route.fulfill({ status: 500, json: { ok: false, error: "readback_failed" } });
    else await route.fulfill({ json: api.entry });
  });
  const input = page.getByLabel("합성 항목 결과값", { exact: true });
  await input.fill("재조회 실패에도 유지할 값");
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  await expect(page.getByTestId("lab-result-catalog-status")).toContainText("불러오지 못했습니다");
  await expect(input).toHaveValue("재조회 실패에도 유지할 값");
  failRead = false; await page.getByTestId("lab-result-catalog-retry-button").click();
  await expect(page.getByTestId("lab-result-catalog-status")).toHaveCount(0);
  await expect(input).toHaveValue("재조회 실패에도 유지할 값");
});


test("autosave: result input retains keyboard focus while typing and saving", async ({ page }) => {
  await openReview(page, 0); await mockAutosave(page);
  const input = page.getByLabel("합성 항목 결과값", { exact: true });
  await input.click(); await page.keyboard.type("abc");
  await expect(input).toHaveValue("abc"); await expect(input).toBeFocused();
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
  await expect(input).toBeFocused(); await page.keyboard.type("def");
  await expect(input).toHaveValue("abcdef");
  await expect(page.getByTestId("lab-result-save-status")).toHaveText("저장됨");
});

// The dark viewer is verified at the existing result-sheet entry point with synthetic protected bytes.
test("viewer: dark actions, natural-pixel 1:1, rotation and per-file state are scoped to one modal", async ({ page }, testInfo) => {
  const files = thumbnailFiles(["image/png", "application/pdf", "text/csv", "text/plain"]);
  const png = await sharp({ create: { width: 1600, height: 900, channels: 4, background: { r: 250, g: 250, b: 255, alpha: 0.5 } } }).png().toBuffer();
  const { detail } = await openReview(page, 0, true, 1, 1, files);
  await page.route("**/result-attachments/thumbnail-0?**", route => route.fulfill({ contentType: "image/png", body: png }));
  const trigger = detail.getByRole("button", { name: "합성자료-0.png 미리보기", exact: true });
  await trigger.click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer).toHaveCSS("background-color", "rgb(23, 23, 23)");
  const viewport = page.viewportSize()!;
  await expect.poll(async () => (await viewer.boundingBox())!.width).toBeCloseTo(viewport.width * 0.8, 0);
  await expect.poll(async () => (await viewer.boundingBox())!.height).toBeCloseTo(viewport.height * 0.86, 0);
  await expect(viewer.locator("header")).toHaveCSS("height", "54px");
  await expect(viewer.locator("header")).toHaveCSS("background-color", "rgb(38, 38, 38)");
  await expect(viewer.locator("footer")).toHaveCSS("height", "40px");
  await expect(viewer.locator("header > svg")).toHaveCount(1);
  await expect(viewer.getByRole("button", { name: "미리보기 닫기" })).toBeFocused();
  await expect(viewer.getByRole("button", { name: "다운로드", exact: true }).locator("svg")).toHaveCount(1);
  await expect(viewer.getByRole("button", { name: "삭제", exact: true }).locator("svg")).toHaveCount(1);
  await expect(viewer.getByLabel("현재 첨부 파일")).toHaveText("1 / 4");
  await expect(viewer.getByLabel("이전 파일")).toBeDisabled();
  await viewer.getByRole("button", { name: "1:1", exact: true }).click();
  await expect(viewer.getByLabel("이미지 배율")).toHaveText("100%");
  const image = viewer.getByRole("img");
  expect((await image.boundingBox())!.width).toBeCloseTo(1600, 0);
  await viewer.getByLabel("배경", { exact: true }).selectOption("checker");
  await expect(viewer.getByTestId("lab-image-stage")).not.toHaveCSS("background-image", "none");
  await viewer.getByRole("button", { name: "시계 방향으로 90도 회전" }).click();
  await expect(viewer.getByText(/1600 × 900 px · 90°/)).toBeVisible();
  await viewer.getByRole("button", { name: "1:1", exact: true }).click();
  await expect(viewer.getByLabel("이미지 배율")).toHaveText("100%");
  const imageRegion = viewer.getByRole("region", { name: /^이미지 미리보기/ });
  await imageRegion.press("+");
  await expect(viewer.getByLabel("이미지 배율")).toHaveText("125%");
  await imageRegion.press("-");
  await expect(viewer.getByLabel("이미지 배율")).toHaveText("100%");
  const priorY = (await image.boundingBox())!.y;
  await imageRegion.press("ArrowDown");
  await expect.poll(async () => Math.abs((await image.boundingBox())!.y - priorY)).toBeGreaterThan(5);
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByLabel("현재 PDF 페이지")).toHaveText("1 / 2");
  await viewer.getByRole("button", { name: "다음", exact: true }).click();
  await viewer.getByLabel("PDF 확대").click();
  await expect(viewer.getByLabel("현재 PDF 페이지")).toHaveText("2 / 2");
  await expect(viewer.getByLabel("PDF 배율")).toHaveText("125%");
  await viewer.getByLabel("이전 파일").click();
  await expect(viewer.getByLabel("이미지 배율")).toHaveText("100%");
  await expect(viewer.getByLabel("배경", { exact: true })).toHaveValue("checker");
  await expect(viewer.getByText(/1600 × 900 px · 90°/)).toBeVisible();
  await viewer.screenshot({ path: testInfo.outputPath("dark-image-viewer.png") });
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByLabel("현재 PDF 페이지")).toHaveText("2 / 2");
  await expect(viewer.getByLabel("PDF 배율")).toHaveText("125%");
  await viewer.getByRole("button", { name: "미리보기 닫기" }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(viewer.getByText(/1600 × 900 px · 0°/)).toBeVisible();
  await expect(viewer.getByLabel("배경", { exact: true })).toHaveValue("dark");
  await viewer.getByRole("button", { name: "미리보기 닫기" }).press("Escape");
  await expect(trigger).toBeFocused();
});

test("viewer: CSV and TXT are literal, bounded, searchable and usable on mobile", async ({ page }, testInfo) => {
  const { detail } = await openReview(page, 0, false, 1, 0, thumbnailFiles(["text/csv", "text/plain"]));
  const csv = 'name,value,note\n001,3.5 mg/dL,"a,b"\n=1+1,0,"<img src=x onerror=alert(1)>"';
  const text = '<script>alert("x")</script>\n한글 원문 검색\n' + "합성 내용 ".repeat(40000);
  await page.route("**/result-attachments/thumbnail-0?**", route => route.fulfill({ contentType: "text/csv", body: csv }));
  await page.route("**/result-attachments/thumbnail-1?**", route => route.fulfill({ contentType: "text/plain", body: text }));
  await detail.getByRole("button", { name: "합성자료-0.csv 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByRole("cell", { name: "001", exact: true })).toBeVisible();
  await expect(viewer.getByRole("cell", { name: "3.5 mg/dL", exact: true })).toBeVisible();
  await expect(viewer.getByRole("cell", { name: "=1+1", exact: true })).toBeVisible();
  await expect(viewer.getByRole("cell", { name: "a,b", exact: true })).toBeVisible();
  await expect(viewer.locator("tbody img, tbody script")).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toContainText('<script>alert("x")</script>');
  await expect(viewer.locator("pre script")).toHaveCount(0);
  await expect(viewer.getByText(/일부 미리보기: 앞 50,000자/)).toBeVisible();
  await viewer.getByRole("searchbox", { name: "텍스트에서 찾기" }).fill("원문");
  await expect(viewer.getByLabel("검색 결과 수")).toHaveText("1개");
  await expect(viewer.locator("mark")).toHaveText("원문");
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await viewer.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  for (const button of await viewer.locator("header button, footer button").all()) {
    const target = (await button.boundingBox())!;
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBeGreaterThanOrEqual(44);
  }
  await viewer.screenshot({ path: testInfo.outputPath("dark-text-viewer-mobile.png") });
  await viewer.getByRole("button", { name: "미리보기 닫기" }).press("Tab");
  expect(await page.evaluate(() => document.querySelector("[data-testid='lab-attachment-viewer']")!.contains(document.activeElement))).toBe(true);
});

test("viewer: a delayed old response cannot replace the current file", async ({ page }) => {
  const { detail } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain", "text/plain"]));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const requestStarted = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/result-attachments/thumbnail-0?**", async route => { started(); await gate; await route.fulfill({ contentType: "text/plain", body: "STALE FILE CONTENT" }).catch(() => {}); });
  await page.route("**/result-attachments/thumbnail-1?**", route => route.fulfill({ contentType: "text/plain", body: "CURRENT FILE CONTENT" }));
  await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
  await requestStarted;
  const viewer = page.getByTestId("lab-attachment-viewer");
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toHaveText("CURRENT FILE CONTENT");
  release();
  await expect(viewer).not.toContainText("STALE FILE CONTENT");
  await expect(viewer.getByRole("heading")).toHaveText("합성자료-1.txt");
});

for (const status of [403, 404, 500]) {
  test(`viewer: protected read ${status} clears sensitive metadata or permits retry`, async ({ page }) => {
    const { detail } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain"]));
    let fail = true;
    await page.route("**/result-attachments/thumbnail-0?**", route => route.fulfill({ status: fail ? status : 200, contentType: "text/plain", body: fail ? "" : "RECOVERED CONTENT" }));
    await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
    const viewer = page.getByTestId("lab-attachment-viewer");
    if (status === 500) {
      await expect(viewer.getByText("미리보기를 불러오지 못했습니다.", { exact: true })).toBeVisible();
      fail = false;
      await viewer.getByRole("button", { name: "다시 읽기", exact: true }).click();
      await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toHaveText("RECOVERED CONTENT");
    } else {
      await expect(viewer.getByText(status === 403 ? "파일을 열 수 있는 권한이 없습니다." : "파일을 찾을 수 없습니다.", { exact: true })).toBeVisible();
      await expect(viewer).not.toContainText("합성자료-0.txt");
      await expect(viewer.getByRole("button", { name: "다운로드", exact: true })).toHaveCount(0);
      await expect(viewer.getByLabel("현재 첨부 파일")).toHaveCount(0);
    }
    await viewer.getByRole("button", { name: "미리보기 닫기" }).click();
    await expect(detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true })).toBeFocused();
  });
}

test("viewer: deletion cancel, failure and duplicate requests preserve preview; success restores fallback focus", async ({ page }) => {
  const { detail, attachments } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain"]));
  await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toBeVisible();
  await viewer.getByRole("button", { name: "삭제", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "첨부 파일 삭제", exact: true });
  await expect(confirm.getByRole("button", { name: "취소", exact: true })).toBeFocused();
  await confirm.getByRole("button", { name: "취소", exact: true }).press("Escape");
  await expect(viewer.getByRole("button", { name: "삭제", exact: true })).toBeFocused();
  let calls = 0;
  let succeed = false;
  let release!: () => void;
  await page.route("**/result-attachments/thumbnail-0?**", async route => {
    if (route.request().method() !== "DELETE") return route.fallback();
    calls += 1;
    if (!succeed) return route.fulfill({ status: 500, json: { ok: false } });
    await new Promise<void>(resolve => { release = resolve; });
    attachments.splice(0);
    await route.fulfill({ json: { ok: true } });
  });
  await viewer.getByRole("button", { name: "삭제", exact: true }).click();
  await confirm.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(confirm.getByRole("alert")).toContainText("삭제 결과를 확인하지 못했습니다.");
  await confirm.getByRole("button", { name: "취소", exact: true }).click();
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toBeVisible();
  succeed = true;
  await viewer.getByRole("button", { name: "삭제", exact: true }).click();
  await confirm.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(confirm.getByRole("button", { name: "삭제 중", exact: true })).toBeDisabled();
  await page.keyboard.press("Enter");
  expect(calls).toBe(2);
  release();
  await expect(viewer).toHaveCount(0);
  await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(0);
  await expect(detail.getByLabel("합성 항목 첨부 자료", { exact: true })).toBeFocused();
});

test("viewer: authoritative access loss removes content and closes the modal", async ({ page }) => {
  const { detail } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain"]));
  await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toBeVisible();
  await page.route("**/lab-imaging/result-phase2**", route => route.fulfill({ status: 403, json: { ok: false } }));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(viewer).toHaveCount(0);
  await expect(page.getByRole("region", { name: "텍스트 미리보기" })).toHaveCount(0);
});

for (const status of [404, 403]) {
  test(`viewer: delete ${status} has a distinct outcome and clears the modal`, async ({ page }) => {
    const { detail } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain"]));
    await page.route("**/result-attachments/thumbnail-0?**", route => route.request().method() === "DELETE"
      ? route.fulfill({ status, json: { ok: false } }) : route.fallback());
    await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
    await page.getByTestId("lab-attachment-viewer").getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("dialog", { name: "첨부 파일 삭제" }).getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByTestId("lab-attachment-viewer")).toHaveCount(0);
    await expect(detail.getByRole("alert")).toContainText(status === 404 ? "이미 삭제됐거나 사용할 수 없는 파일입니다." : "파일 삭제 권한 또는 로그인 상태를 확인해 주세요.");
    if (status === 404) await expect(detail.getByTestId("lab-attachment-card")).toHaveCount(0);
  });
}

test("viewer: empty files, corrupt images and encrypted PDFs have explicit fallbacks", async ({ page }) => {
  const { detail } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain", "image/png", "application/pdf"]));
  await page.route("**/result-attachments/thumbnail-0?**", route => route.fulfill({ contentType: "text/plain", body: "" }));
  await page.route("**/result-attachments/thumbnail-1?**", route => route.fulfill({ contentType: "image/png", body: "corrupt synthetic image" }));
  await page.route("**/result-attachments/thumbnail-2?**", route => route.fulfill({ contentType: "application/pdf", path: "tests/fixtures/lab-viewer-encrypted.pdf" }));
  await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByText("파일에 표시할 내용이 없습니다.", { exact: true })).toBeVisible();
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByText("이미지를 표시할 수 없습니다.", { exact: true })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "다시 읽기" })).toBeVisible();
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByText("암호로 보호된 PDF입니다.", { exact: true })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "다운로드", exact: true })).toBeEnabled();
  await expect(viewer.getByRole("textbox")).toHaveCount(0);
});

test("viewer: file replacement and close release local object URLs", async ({ page }) => {
  await page.addInitScript(() => {
    const created: string[] = []; const revoked: string[] = [];
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = value => { const url = create(value); created.push(url); return url; };
    URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
    Object.assign(window, { syntheticViewerUrls: { created, revoked } });
  });
  const { detail } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["image/png", "image/png"]));
  await detail.getByRole("button", { name: "합성자료-0.png 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByRole("img")).toBeVisible();
  const originalUrl = await viewer.getByRole("img").getAttribute("src");
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByRole("img")).toBeVisible();
  const nextUrl = await viewer.getByRole("img").getAttribute("src");
  expect(nextUrl).not.toBe(originalUrl);
  await viewer.getByRole("button", { name: "미리보기 닫기" }).click();
  const urls = await page.evaluate(() => (window as unknown as { syntheticViewerUrls: { revoked: string[] } }).syntheticViewerUrls);
  expect(urls.revoked).toContain(originalUrl);
  expect(urls.revoked).toContain(nextUrl);
});

test("viewer: an authoritative attachment removal cannot leave cached content visible", async ({ page }) => {
  const { detail, attachments } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain"]));
  await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toBeVisible();
  attachments.splice(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(viewer).toHaveCount(0);
  await expect(detail.getByLabel("합성 항목 첨부 자료", { exact: true })).toBeFocused();
});

test("viewer: JPEG orientation and WebP preserve decoded dimensions", async ({ page }) => {
  const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "white" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const webp = await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 200, g: 220, b: 255, alpha: 0.5 } } }).webp().toBuffer();
  const files = thumbnailFiles(["image/jpeg", "image/webp"]);
  files[0].name = "합성 세로 사진.jpg"; files[1].name = "합성 투명 이미지.webp";
  const { detail } = await openReview(page, 0, true, 1, 0, files);
  await page.route("**/result-attachments/thumbnail-0?**", route => route.fulfill({ contentType: "image/jpeg", body: jpeg }));
  await page.route("**/result-attachments/thumbnail-1?**", route => route.fulfill({ contentType: "image/webp", body: webp }));
  await detail.getByRole("button", { name: "합성 세로 사진.jpg 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByText(/800 × 1200 px · 0°/)).toBeVisible();
  await viewer.getByLabel("다음 파일").click();
  await expect(viewer.getByText(/800 × 600 px · 0°/)).toBeVisible();
  await viewer.getByLabel("배경", { exact: true }).selectOption("gray");
  await expect(viewer.getByTestId("lab-image-stage")).toHaveCSS("background-color", "rgb(115, 115, 115)");
  await expect(viewer.getByRole("img")).toHaveCSS("filter", "none");
});

test("viewer: a transient metadata failure preserves the last confirmed preview and can recover", async ({ page }) => {
  const { detail } = await openReview(page, 0, true, 1, 0, thumbnailFiles(["text/plain"]));
  await detail.getByRole("button", { name: "합성자료-0.txt 미리보기", exact: true }).click();
  const viewer = page.getByTestId("lab-attachment-viewer");
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toHaveText("Synthetic attachment text");
  let fail = true;
  await page.route("**/lab-imaging/result-phase2**", route => fail ? route.fulfill({ status: 503, json: { ok: false } }) : route.fallback());
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(viewer.getByText("첨부 목록을 갱신하지 못했습니다. 마지막으로 확인한 미리보기입니다.")).toBeVisible();
  await expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toHaveText("Synthetic attachment text");
  await expect(viewer.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
  fail = false;
  await viewer.getByRole("button", { name: "목록 다시 불러오기", exact: true }).click();
  await expect(viewer.getByText("첨부 목록을 갱신하지 못했습니다. 마지막으로 확인한 미리보기입니다.")).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "삭제", exact: true })).toBeVisible();
});

test("lab ownership opens input on claim, locks on cancel and transfers on avatar reassignment", async ({ page }) => {
  let owner: string | null = null;
  let revision = 1;
  let currentActor = "user-tech";
  const setup = async () => {
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items**`, async route => {
    if (route.request().url().includes("/assignees")) return route.fulfill({ json: { ok: true, assignees: [{ userId: "user-tech", displayName: "합성 A" }, { userId: "user-admin", displayName: "합성 B" }] } });
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      if (body.action === "claim") owner = currentActor;
      else if (body.action === "unassign") owner = null;
      else if (body.action === "assign") owner = body.assignedToUserId;
      revision++;
    }
    return route.fulfill({ json: { ok: true, workItems: [{ id: "review-work", workspaceId, orderId: "review-order", encounterId: "review-encounter",
      queueType: "lab", status: "requested", requestCycle: 1, rowRevision: revision,
      assignedToUserId: owner, assignedToDisplayName: owner === "user-tech" ? "합성 A" : owner ? "합성 B" : null,
      canManage: !owner || owner === currentActor, sourceSnapshot: { orderDisplayName: "합성 검사", patientName: "합성 환자", detail: { species: "dog" } } }] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-phase2**`, route => route.fulfill({ json: {
    ok: true, data: { resultId, orderId: "review-order", overallFinding: "", overallRevision: 0, canEdit: Boolean(owner && owner === currentActor), events: [], attachments: [] },
  } }));
  };
  await openReview(page, 0, false, 1, 0, undefined, setup);
  const value = page.getByTestId(`lab-result-row-${rowId}`).getByRole("textbox");
  await expect(value).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "검사결과 종합소견" })).toBeDisabled();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await expect(page.getByText("담당자로 지정됐어요.", { exact: true })).toBeVisible();
  await expect(value).toBeEnabled();
  await expect(page.getByRole("button", { name: "검사 시작", exact: true })).toBeVisible();
  await page.mouse.move(20, 20);
  await expect.poll(async () => page.getByRole("group", { name: "검사 요청 상태 액션" }).evaluate(element => { const buttons = [...element.querySelectorAll("button")]; return getComputedStyle(buttons[0]).backgroundColor === getComputedStyle(buttons[1]).backgroundColor; })).toBe(true);
  const splitStyle = await page.getByRole("group", { name: "검사 요청 상태 액션" }).evaluate(element => [...element.querySelectorAll("button")].map(button => ({ height: button.getBoundingClientRect().height, color: getComputedStyle(button).backgroundColor })));
  expect(splitStyle[0].height).toBe(splitStyle[1].height);
  expect(splitStyle[0].color).toBe(splitStyle[1].color);
  await page.getByRole("button", { name: "검사 상태 액션 열기" }).click();
  await page.getByRole("menuitem", { name: "담당 취소", exact: true }).click();
  await expect(value).toBeDisabled();
  await page.getByRole("button", { name: "담당하기", exact: true }).click();
  await page.getByRole("button", { name: "담당자 합성 A 변경" }).click();
  await page.getByRole("menuitem", { name: "합성 B", exact: true }).click();
  await expect(value).toBeDisabled();
  await expect(page.getByRole("button", { name: "검사 시작", exact: true })).toBeDisabled();
  currentActor = "user-admin";
  await page.reload();
  await expect(value).toBeEnabled();
  await expect(page.getByRole("button", { name: "담당자 합성 B 변경" })).toBeEnabled();
  await page.screenshot({ path: "output/playwright/current-assignee-lab.png", fullPage: false });
});
