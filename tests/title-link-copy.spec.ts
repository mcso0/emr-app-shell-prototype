import { expect, test } from "@playwright/test";

test("chart, lab and imaging copy links reopen the selected document", async ({ page }) => {
  test.setTimeout(60_000);
  const cases = [
    {
      route: "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed",
      button: "차트 링크 복사",
      moduleId: "treatment",
      param: "encounterId",
      id: "encounter-kong-260501",
    },
    {
      route: "/w/clair-demo/lab?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc&modulePanel=open&aside=closed",
      button: "임상병리검사 결과지 링크 복사",
      moduleId: "lab",
      param: "labResultId",
      id: "lab-result-kong-cbc",
    },
    {
      route: "/w/clair-demo/imaging?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&imagingStudyId=imaging-kong-abdomen&modulePanel=open&aside=closed",
      button: "영상검사 Order 상세 링크 복사",
      moduleId: "imaging",
      param: "imagingStudyId",
      id: "imaging-kong-abdomen",
    },
  ] as const;

  for (const item of cases) {
    await page.goto(item.route);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
    const copyButton = page.getByRole("button", { name: item.button });
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    const copiedLink = await page.evaluate(() => navigator.clipboard.readText());
    const url = new URL(copiedLink);
    expect(url.pathname).toBe(`/w/clair-demo/${item.moduleId}`);
    expect(url.searchParams.get(item.param)).toBe(item.id);
    expect(url.searchParams.get("date")).toBe("2026-05-01");
    expect(url.searchParams.has("scenario")).toBe(false);
    expect(url.searchParams.has("patientId")).toBe(false);

    await page.goto(copiedLink);
    await expect(page.getByRole("button", { name: item.button })).toBeVisible();
  }
});
