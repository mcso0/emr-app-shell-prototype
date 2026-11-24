import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("chart history export prints and downloads full selected records only", async ({ page, context }, info) => {
  await page.addInitScript(() => {
    // Capture the app's actual outgoing print document; the browser's print-to-PDF
    // compositor can then save it without clicking the platform-specific dialog.
    new MutationObserver(() => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="선택한 차트 기록 인쇄"]');
      const target = frame?.contentWindow;
      if (frame && target && !frame.dataset.testPrintCapture) {
        frame.dataset.testPrintCapture = "true";
        target.print = () => {
          const output = document.createElement("script");
          output.type = "application/json";
          output.id = "saved-chart-print-document";
          output.textContent = JSON.stringify(frame.contentDocument?.documentElement.outerHTML);
          document.body.append(output);
          target.dispatchEvent(new Event("afterprint"));
        };
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/review/chart-search");
  for (const patient of ["모카", "솜이"]) {
    const checkbox = page.getByRole("checkbox", { name: patient + " 차트 선택", exact: true });
    await page.locator("[data-chart-id]").filter({ has: checkbox }).hover();
    await checkbox.click({ timeout: 8000 });
  }
  const menu = () => page.getByRole("button", { name: "내보내기 (2)", exact: true }).click();
  await menu();
  await page.getByRole("menuitem", { name: "PDF로 내보내기" }).click();
  const printDocument = page.locator("#saved-chart-print-document");
  await expect(printDocument).toHaveCount(1);
  const html = JSON.parse(await printDocument.textContent() || "null") as string;
  const printPage = await context.newPage();
  // Keep relative resources on the same origin as the iframe.
  await printPage.route("**/chart-export-print-harness", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  const appUrl = new URL(page.url());
  await printPage.goto(new URL("/chart-export-print-harness", appUrl).toString(), { waitUntil: "load" });
  await printPage.evaluate(() => document.fonts.ready);
  const paper = printPage.locator("[data-chart-print-root]");
  await expect(paper.locator("[data-print-chart]")).toHaveCount(2);
  for (const text of [
    "S · 문진", "O · 관찰", "Assessment", "Plan", "처방·오더",
    "긴 기록 마지막 줄 · 누락 여부 확인", "합성 관찰값", "합성 영상 판독: 이전 기록과 비교했습니다.",
  ]) await expect(paper.getByText(text, { exact: false }).first()).toBeVisible();
  await expect(paper.getByText("보리")).toHaveCount(0);
  await expect(paper.locator("button, a, input, img, video")).toHaveCount(0);
  const pdf = await printPage.pdf({ path: info.outputPath("chart-export.pdf"), preferCSSPageSize: true, printBackground: true });
  expect(pdf.length).toBeGreaterThan(20_000);
  await printPage.close();

  await menu();
  const downloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "CSV로 내보내기" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("차트-기록.csv");
  const csvPath = info.outputPath("chart-export.csv");
  await download.saveAs(csvPath);
  const csv = await readFile(csvPath, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  // Match whole quoted fields, including quotes, delimiters and embedded newlines.
  expect(csv).toMatch(/^\uFEFF"(?:[^"]|"")*"(?:(?:,|\r\n)"(?:[^"]|"")*")*$/u);
  const rows: string[][] = [[]];
  for (const match of csv.slice(1).matchAll(/(^|,|\r\n)"((?:[^"]|"")*)"/gu)) {
    if (match[1] === "\r\n") rows.push([]);
    rows.at(-1)!.push(match[2].replaceAll('""', '"'));
  }
  expect(rows).toHaveLength(3);
  expect(new Set(rows.map(row => row.length)).size).toBe(1);
  const header = rows[0];
  expect(rows.slice(1).map(row => row[header.indexOf("환자명")])).toEqual(["모카", "솜이"]);
  const selected = rows[1];
  expect(selected[header.indexOf("S · 문진")]).toContain("관찰 기록 31");
  expect(selected[header.indexOf("O · 관찰")]).toContain("긴장 반응");
  expect(selected[header.indexOf("A · 평가")]).toContain("증상 경과");
  expect(selected[header.indexOf("P · 계획")]).toContain("구토 일지");
  expect(selected[header.indexOf("자유 기록")]).toContain("'= \"검수용 자유 기록\"\n줄바꿈");
  expect(selected[header.indexOf("처방·오더")]).toContain("복부 초음파");
  expect(selected[header.indexOf("연결된 검사 결과 및 소견")]).toContain("합성 영상 판독");
});

test("a rejected PDF or CSV export reports permission denial without opening a file", async ({ page }) => {
  let downloads = 0;
  page.on("download", () => { downloads++; });
  await page.goto("/review/chart-search?export-denied=1");
  const checkbox = page.getByRole("checkbox", { name: "모카 차트 선택", exact: true });
  await page.locator("[data-chart-id]").filter({ has: checkbox }).hover();
  await checkbox.click();
  const button = page.getByRole("button", { name: "내보내기 (1)", exact: true });
  const denied = page.getByRole("status").filter({ hasText: "차트를 내보낼 권한이 없어요." });
  for (const format of ["PDF", "CSV"]) {
    await expect(button).toBeEnabled();
    await button.click();
    await page.getByRole("menuitem", { name: format + "로 내보내기" }).click();
    await expect(denied).toBeVisible();
    await expect(page.locator('iframe[title="선택한 차트 기록 인쇄"]')).toHaveCount(0);
    expect(downloads).toBe(0);
    await denied.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(denied).toHaveCount(0);
  }
});
