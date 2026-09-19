import { expect, test, type Locator } from "@playwright/test";

const chartUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

const diagnosisCatalogResponse = {
  ok: true,
  status: 200,
  systems: [{ id: "system-digestive", name: "소화기계", count: 2 }],
  diseaseGroups: [
    {
      id: "group-gastrointestinal",
      name: "위장관 질환",
      systemId: "system-digestive",
      count: 2,
    },
  ],
  diagnoses: [
    {
      catalogId: "catalog-gastroenteritis",
      masterId: "master-gastroenteritis",
      masterRevision: 1,
      code: null,
      name: "위장염",
      synonyms: ["장염"],
      system: { id: "system-digestive", name: "소화기계" },
      diseaseGroup: { id: "group-gastrointestinal", name: "위장관 질환" },
    },
    {
      catalogId: "catalog-constipation",
      masterId: "master-constipation",
      masterRevision: 1,
      code: null,
      name: "변비",
      synonyms: [],
      system: { id: "system-digestive", name: "소화기계" },
      diseaseGroup: { id: "group-gastrointestinal", name: "위장관 질환" },
    },
  ],
  nextCursor: null,
};

const orderCatalogRow = {
  appliedSnapshot: {
    appliedAmountBasis: "unit_price",
    appliedBillingName: "Figma 리스트 검사",
    appliedDestinationModule: "lab",
    appliedDisplayName: "Figma 리스트 검사",
    appliedPriceKrw: 12000,
    appliedSalesUnit: "per_each",
    appliedStandardOrderName: "Figma 리스트 검사",
    appliedTargetSpecies: ["dog", "cat"],
    appliedTaskRequired: true,
    appliedTaxIncluded: true,
    billingEligible: true,
    billingReflectionEnabled: true,
    clinicalOrderType: "clinical_lab",
    defaultDetailInputs: {},
    destinationModule: "lab",
    detailSchemaVersion: 1,
    executionMode: "routed",
    sourcePresetId: "figma-list-order",
    sourcePresetVersion: "2026-08-30.1",
    workspaceCatalogItemId: "figma-list-order",
  },
  billingEligible: true,
  billingName: "Figma 리스트 검사",
  categoryGroup: "lab",
  clinicalOrderType: "clinical_lab",
  destinationModule: "lab",
  detailSchemaVersion: 1,
  displayName: "Figma 리스트 검사",
  executionMode: "routed",
  rowType: "individual",
  sourcePresetId: "figma-list-order",
  sourcePresetVersion: "2026-08-30.1",
  targetSpecies: ["dog", "cat"],
  workspaceCatalogItemId: "figma-list-order",
  workspaceCatalogRevision: 1,
};

async function expectBox(
  locator: Locator,
  expected: { height?: number; width?: number },
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (expected.width !== undefined) {
    expect(box!.width).toBeCloseTo(expected.width, 0);
  }
  if (expected.height !== undefined) {
    expect(box!.height).toBeCloseTo(expected.height, 0);
  }
}

test("classification list items expose Figma facet, result, and review contracts", async ({
  page,
}) => {
  await page.route("**/chart/diagnosis-catalog**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(diagnosisCatalogResponse),
    });
  });
  await page.goto(chartUrl);

  await page
    .getByLabel("진단명 관리")
    .getByRole("button", { name: "분류 검색" })
    .click();
  const dialog = page.getByRole("dialog", { name: "분류검색" });

  const facetOption = dialog.getByRole("option", { name: "전체 2" }).first();
  await expect(facetOption).toHaveAttribute("data-list-variant", "facet");
  await expect(facetOption).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0.06)",
  );
  await expect(
    facetOption.locator('[data-slot="classification-explorer-option-count"]'),
  ).toHaveCSS("font-size", "12px");
  await expect(
    facetOption.locator('[data-slot="classification-explorer-option-count"]'),
  ).toHaveCSS("font-weight", "500");

  const diagnosisOption = dialog.getByRole("option", { name: "위장염" });
  const unselectedOption = dialog.getByRole("option", { name: "변비" });
  await expect(diagnosisOption).toHaveAttribute("data-list-variant", "result");
  await expect(diagnosisOption).toHaveAttribute("aria-selected", "false");
  await expect(
    diagnosisOption.locator(
      '[data-slot="classification-explorer-option-indicator"]',
    ),
  ).toHaveCount(0);

  await diagnosisOption.click();
  await expect(diagnosisOption).toHaveAttribute("aria-selected", "true");
  await expect(diagnosisOption).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0.04)",
  );
  await expect(
    diagnosisOption.locator(
      '[data-slot="classification-explorer-option-indicator"]',
    ),
  ).toHaveCount(1);
  await expectBox(
    diagnosisOption.locator(
      '[data-slot="classification-explorer-option-indicator"]',
    ),
    { width: 24, height: 24 },
  );
  await expect(
    unselectedOption.locator(
      '[data-slot="classification-explorer-option-indicator"]',
    ),
  ).toHaveCount(0);

  const reviewRow = dialog
    .locator('[data-slot="classification-explorer-sortable-row"]')
    .filter({ hasText: "위장염" })
    .first();
  await expect(reviewRow).toHaveAttribute("data-list-variant", "review");
  await expectBox(reviewRow, { height: 46 });
  await expectBox(reviewRow.getByRole("button", { name: "위장염 순서 변경" }), {
    width: 24,
    height: 24,
  });
  await expectBox(reviewRow.getByRole("combobox"), { width: 60, height: 28 });
  await expect(reviewRow.locator("strong")).toHaveCSS(
    "letter-spacing",
    "0.247px",
  );
});

test("order candidate list uses result geometry and keeps the selected review contract", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog?mode=chart-search",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, rows: [orderCatalogRow], status: 200 },
        status: 200,
      });
    },
  );
  await page.goto(chartUrl);

  await page.getByRole("button", { name: "Order 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "오더 추가" });
  const candidate = page.getByTestId(
    "chart-order-catalog-candidate-figma-list-order",
  );

  await expect(candidate).toHaveAttribute("data-list-variant", "result");
  await expect(candidate).toHaveCSS("padding-left", "8px");
  await expect(
    candidate.locator('[data-slot="classification-explorer-option-indicator"]'),
  ).toHaveCount(0);

  await candidate.click();
  await expect(candidate).toHaveAttribute("aria-selected", "true");
  await expect(
    candidate.locator('[data-slot="classification-explorer-option-indicator"]'),
  ).toHaveCount(1);
  await expectBox(
    candidate.locator('[data-slot="classification-explorer-option-indicator"]'),
    { width: 24, height: 24 },
  );

  const selectedRow = dialog
    .locator('[data-slot="classification-explorer-sortable-row"]')
    .filter({ hasText: "Figma 리스트 검사" })
    .first();
  await expect(selectedRow).toHaveAttribute("data-list-variant", "review");
  await expectBox(selectedRow, { height: 46 });
  await expect(selectedRow).toContainText("검사");
  await expect(selectedRow).toContainText("12,000원");
});
