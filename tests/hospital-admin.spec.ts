import { expect, test } from "@playwright/test";

import {
  buildWorkspaceCatalogMutationFromHospitalOrder,
  mapWorkspaceCatalogItemToHospitalOrder,
} from "../src/features/hospital-admin/data";
import type { OrderCatalogItem } from "../src/features/hospital-admin/server-order-catalog-core";

function createServiceReviewDispensingMasterItem(index: number) {
  const productCode =
    index === 0 ? "a001270" : `a${String(index).padStart(6, "0")}`;
  const standardOrderId = `cm.order.dispensing-v1-uk-vmd-${productCode}`;
  const koreanName =
    index === 0
      ? "Amoxicillin 경구현탁용산제"
      : `검토용 조제 오더 ${index + 1}`;
  const englishName =
    index === 0
      ? "Betamox Palatable Drops Powder for Oral Suspension 50 mg/ml"
      : `Service Review Dispensing Product ${index + 1}`;
  const priceKrw = index === 0 ? 13_500 : 7_000 + (index % 30) * 500;
  const dose = 0.5 + (index % 4) * 0.5;
  const frequency = ["sid", "bid", "tid"][index % 3];
  const frequencyCount = [1, 2, 3][index % 3];
  const durationDays = 3 + (index % 5);
  const totalQuantity = dose * frequencyCount * durationDays;

  return {
    id: `master-workspace-clair-cheongdam-${standardOrderId}`,
    aliases: [],
    availabilityStatus: "pending_activation",
    billingName: standardOrderId,
    billingReflectionEnabled: true,
    catalogRevision: 2,
    categoryGroup: "medication",
    categoryLabel: "CG_MEDICATION_SUPPLY",
    careGuide: "",
    clinicalOrderType: "dispensing",
    customizationState: "unmodified",
    defaultDestinationModule: "dispensing",
    defaultTaskRequired: true,
    destinationModule: "dispensing",
    dispensingLineage: {
      schemaVersion: 1,
      sourceDispensingProfileId: `profile-${productCode}`,
      sourceDispensingProfileRevision: 1,
      sourceMedicationProductId: `product-${productCode}`,
      sourceMedicationProductRevision: 1,
      sourceClinicalReviewId: null,
      sourceEvidenceFingerprint: "a".repeat(64),
      clinicalUseAllowed: false,
      serviceReviewOnly: true,
      serviceReviewReleaseId: "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4",
      dispensingProfileSnapshot: {
        dosageForm: index === 0 ? "Powder for oral suspension" : "Tablet",
        englishProductName: englishName,
        koreanDraftName: koreanName,
        strengthSnapshot: [
          {
            numeratorValue: index === 0 ? 50 : 10,
            numeratorUnit: "mg",
            denominatorValue: index === 0 ? null : undefined,
            denominatorUnit: index === 0 ? "mL" : null,
          },
        ],
      },
      dispensingProfileSnapshotSha256: "b".repeat(64),
    },
    executionMode: "routed",
    inHospitalOrderName: standardOrderId,
    internalInstruction: "",
    medicationMetadata: {
      schemaVersion: 2,
      presetOrigin: "clair_master",
      presetStatus: "synthetic_unreviewed",
      ingredientEnglishName:
        index === 0 ? "Amoxicillin" : `Ingredient ${index + 1}`,
      autoDispenseQuantityEnabled: true,
      defaultDetailInputs: {
        doseBasis: "patient",
        dose,
        doseUnit: "tablet",
        route: "PO",
        frequency,
        durationDays,
        totalQuantity,
        totalQuantityUnit: "tablet",
        medicationInstruction: index % 2 === 0 ? "after_meal" : "any_time",
        storageMethod: "room_temp",
        compoundNote: `조제 확인 메모 ${index + 1}`,
        guardianNote: `보호자 복약 안내 ${index + 1}`,
      },
    },
    originType: "clair_master",
    presetMergeStatus: "current",
    priceKrw,
    pricingRule: {
      billingReflectionEnabled: true,
      priceBasis: "fixed_order_price",
      priceKrw,
      roundingRule: "as_is",
      salesUnit: "per_order",
      taxIncluded: true,
    },
    roundingRule: "as_is",
    salesUnit: "per_order",
    sourcePresetVersion: "master-r1",
    standardOrderId,
    standardOrderName: standardOrderId,
    targetSpecies: ["dog", "cat"],
    taxIncluded: true,
    updatedAt: "2026-08-26T01:19:38.373902Z",
    workspaceId: "workspace-clair-cheongdam",
  };
}

function createGenericCatalogItem(
  clinicalOrderType: NonNullable<OrderCatalogItem["clinicalOrderType"]>,
  defaultDetailInputs: Record<string, unknown>,
) {
  const base = createServiceReviewDispensingMasterItem(0);
  const categoryGroup = {
    clinical_lab: "lab",
    consultation: "consultation",
    dispensing: "medication",
    external_lab: "lab",
    hospitalization: "hospitalization",
    imaging: "imaging",
    other: "misc",
    system_exam: "lab",
    treatment: "treatment",
  }[clinicalOrderType];
  const categoryLabel = {
    clinical_lab: "임상병리",
    consultation: "기본 진료비",
    dispensing: "처방",
    external_lab: "의뢰 검사",
    hospitalization: "입원",
    imaging: "방사선",
    other: "기타",
    system_exam: "계통검사",
    treatment: "처치",
  }[clinicalOrderType];
  const destinationModule = {
    clinical_lab: "lab",
    consultation: "chart_only",
    dispensing: "dispensing",
    external_lab: "external_lab",
    hospitalization: "hospitalization",
    imaging: "imaging",
    other: "chart_only",
    system_exam: "chart_only",
    treatment: "treatment",
  }[clinicalOrderType];
  const immediateComplete = [
    "consultation",
    "other",
    "system_exam",
  ].includes(clinicalOrderType);

  return {
    ...base,
    id: `catalog-${clinicalOrderType}`,
    aliases: [],
    availabilityStatus: "active",
    categoryGroup,
    categoryLabel,
    clinicalOrderType,
    defaultDetailInputs,
    defaultDestinationModule: destinationModule,
    defaultTaskRequired: !immediateComplete,
    destinationModule,
    dispensingLineage: undefined,
    detailSchemaVersion: 1,
    executionMode: immediateComplete ? "immediate_complete" : "routed",
    medicationMetadata: undefined,
    originType: "clair_master",
    presetMergeStatus: "current",
    standardOrderId: `master-${clinicalOrderType}`,
    standardOrderName: `${clinicalOrderType} master order`,
  } as unknown as OrderCatalogItem;
}

test("priced service-review dispensing rows map to effective use without true activation", () => {
  const source = createServiceReviewDispensingMasterItem(
    0,
  ) as unknown as OrderCatalogItem;
  const hospitalOrder = mapWorkspaceCatalogItemToHospitalOrder(source);

  expect(hospitalOrder).toMatchObject({
    dispensingDosageForm: "Powder for oral suspension",
    dispensingStrength: "50 mg/mL",
    isActive: true,
    price: 13_500,
  });
  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: { ...hospitalOrder, price: 14_500 },
    source,
    workspaceId: "workspace-clair-cheongdam",
  });
  expect(mutation).toMatchObject({
    action: "update",
    patch: {
      availabilityStatus: "pending_activation",
      priceKrw: 14_500,
      pricingRule: { priceKrw: 14_500 },
    },
  });
});

test("hospital admin prefers generic dispensing defaults over legacy nested metadata", () => {
  const source = createServiceReviewDispensingMasterItem(
    0,
  ) as unknown as OrderCatalogItem;
  source.defaultDetailInputs = {
    doseBasis: "patient",
    dose: 2,
    doseUnit: "capsule",
    route: "PO",
    frequency: "sid",
    durationDays: 3,
    totalQuantity: 6,
    totalQuantityUnit: "capsule",
    medicationInstruction: "before_meal",
    storageMethod: "room_temp",
    compoundNote: "generic note",
    guardianNote: "generic guardian note",
  };
  source.medicationMetadata = {
    ...source.medicationMetadata!,
    defaultDetailInputs: {
      ...source.medicationMetadata!.defaultDetailInputs,
      dose: 0.25,
      doseUnit: "tablet",
    },
  };

  const hospitalOrder = mapWorkspaceCatalogItemToHospitalOrder(source);

  expect(hospitalOrder.dispensingPreset).toMatchObject({
    dose: 2,
    doseUnit: "capsule",
    medicationInstruction: "before_meal",
  });
});

test("hospital admin falls back to nested dispensing defaults when generic defaults are empty", () => {
  const source = createServiceReviewDispensingMasterItem(
    0,
  ) as unknown as OrderCatalogItem;
  source.defaultDetailInputs = {};

  const hospitalOrder = mapWorkspaceCatalogItemToHospitalOrder(source);

  expect(hospitalOrder.dispensingPreset).toMatchObject({
    dose: 0.5,
    doseUnit: "tablet",
    medicationInstruction: "after_meal",
  });
});

test("hospital admin mirrors edited dispensing defaults to generic and nested mutation fields", () => {
  const source = createServiceReviewDispensingMasterItem(
    0,
  ) as unknown as OrderCatalogItem;
  const hospitalOrder = mapWorkspaceCatalogItemToHospitalOrder(source);
  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: {
      ...hospitalOrder,
      dispensingPreset: {
        ...hospitalOrder.dispensingPreset!,
        dose: 2,
        doseUnit: "capsule",
      },
    },
    source,
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(mutation.action).toBe("update");
  if (mutation.action !== "update") {
    throw new Error("Expected an update mutation");
  }
  const genericDefaults = mutation.patch.defaultDetailInputs as Record<
    string,
    unknown
  >;
  const medicationDefaults = mutation.patch.medicationMetadata
    ?.defaultDetailInputs as Record<string, unknown>;

  expect(genericDefaults).toEqual(medicationDefaults);
  expect(genericDefaults).not.toBe(medicationDefaults);
  expect(genericDefaults).toMatchObject({ dose: 2, doseUnit: "capsule" });

  genericDefaults.dose = 99;
  expect(medicationDefaults.dose).toBe(2);
});

test("hospital admin maps and updates generic defaults for non-dispensing orders", () => {
  const source = createGenericCatalogItem("imaging", {
    bodyRegion: "흉부",
    position: "right_lateral",
    viewCount: 2,
    contrastRequired: false,
  });

  const hospitalOrder = mapWorkspaceCatalogItemToHospitalOrder(source);

  expect(hospitalOrder).toMatchObject({
    categoryId: "imaging",
    subcategoryId: "radiography",
    clinicalOrderType: "imaging",
    detailSchemaVersion: 1,
    defaultDetailInputs: source.defaultDetailInputs,
  });
  expect(hospitalOrder.defaultDetailInputs).not.toBe(
    source.defaultDetailInputs,
  );

  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: {
      ...hospitalOrder,
      defaultDetailInputs: {
        ...hospitalOrder.defaultDetailInputs,
        imagingProtocol: "흉부 2-view, 호기말 촬영",
      },
    },
    source,
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(mutation.action).toBe("update");
  if (mutation.action !== "update") {
    throw new Error("Expected an update mutation");
  }
  expect(mutation.patch.defaultDetailInputs).toEqual({
    bodyRegion: "흉부",
    position: "right_lateral",
    viewCount: 2,
    contrastRequired: false,
    imagingProtocol: "흉부 2-view, 호기말 촬영",
  });
  expect(mutation.patch.defaultDetailInputs).not.toBe(
    hospitalOrder.defaultDetailInputs,
  );
});

test("hospital admin preserves explicit system-exam and other catalog paths", () => {
  const systemExam = mapWorkspaceCatalogItemToHospitalOrder(
    createGenericCatalogItem("system_exam", {
      bodySystem: "호흡기계",
      examScope: "호흡기계 평가",
      examMethod: "청진",
    }),
  );
  const other = mapWorkspaceCatalogItemToHospitalOrder(
    createGenericCatalogItem("other", { structuredValue: "보호자 동의서" }),
  );

  expect(systemExam).toMatchObject({
    categoryId: "lab",
    subcategoryId: "system-exam",
    clinicalOrderType: "system_exam",
  });
  expect(other).toMatchObject({
    categoryId: "misc",
    subcategoryId: "other",
    clinicalOrderType: "other",
  });
});

test("hospital admin edits schema-backed generic defaults for an existing imaging order", async ({
  page,
}) => {
  const imagingItem = createGenericCatalogItem("imaging", {
    bodyRegion: "흉부",
    position: "right_lateral",
    viewCount: 2,
    contrastRequired: false,
    sedationRequired: false,
  });
  let updateBody: Record<string, unknown> | undefined;

  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            items: [imagingItem],
            capabilities: {
              canManageCatalog: true,
              canAuthorDispensing: true,
              canApproveDispensing: false,
            },
          }),
        });
        return;
      }
      if (route.request().method() === "PATCH") {
        updateBody = route.request().postDataJSON() as Record<string, unknown>;
        const patch = (updateBody.patch ?? {}) as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            item: {
              ...imagingItem,
              ...patch,
              catalogRevision: 2,
              defaultDetailInputs: patch.defaultDetailInputs,
            },
          }),
        });
        return;
      }
      await route.continue();
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");
  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: /^영상검사/ }).click();
  await page.getByTestId("hospital-order-row-catalog-imaging").click();

  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(
    drawer.getByTestId("hospital-order-default-details"),
  ).toBeVisible();
  await expect(drawer.getByLabel("부위")).toHaveValue("흉부");
  await expect(drawer.getByLabel("View 수")).toHaveValue("2");
  await drawer
    .getByLabel("촬영 프로토콜")
    .fill("흉부 2-view, 호기말 촬영");
  await drawer.getByRole("button", { name: "저장" }).click();
  await page.getByRole("button", { name: "저장" }).last().click();

  await expect(page.getByTestId("hospital-order-mutation-status")).toContainText(
    "저장했습니다",
  );
  expect(updateBody?.patch).toMatchObject({
    defaultDetailInputs: {
      bodyRegion: "흉부",
      position: "right_lateral",
      viewCount: 2,
      imagingProtocol: "흉부 2-view, 호기말 촬영",
    },
  });
});

test("hospital admin exposes only authored preset details across non-dispensing Order leaves", async ({
  page,
}) => {
  const items = [
    createGenericCatalogItem("consultation", {
      instructionSummary: "초진 기본 평가",
    }),
    createGenericCatalogItem("clinical_lab", {
      specimenType: "blood",
      testPanel: "CBC 5종",
      collectionCondition: "EDTA 전혈",
    }),
    createGenericCatalogItem("imaging", {
      bodyRegion: "흉부",
      position: "우측 측와",
      viewCount: 2,
      contrastRequired: false,
      sedationRequired: false,
      imagingProtocol: "흉부 2-view, 호기말 촬영",
    }),
    createGenericCatalogItem("external_lab", {}),
    createGenericCatalogItem("treatment", {
      method: "피하 수액",
      site: "견갑 사이",
      frequency: "once",
      schedule: "내원 중 1회",
      stagedInstructions: "체온 확인 후 시행",
    }),
    createGenericCatalogItem("hospitalization", {
      durationDays: 3,
      careLevel: "intensive",
      monitoringInterval: 30,
      nursingPlan: "2시간마다 활력 확인",
    }),
    createGenericCatalogItem("system_exam", {
      bodySystem: "호흡기계",
      examScope: "호흡기계 평가",
      examMethod: "청진",
    }),
    createGenericCatalogItem("other", {
      structuredValue: "보호자 동의서",
      description: "시술 전 서명 확인",
    }),
  ];

  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          items,
          capabilities: {
            canManageCatalog: true,
            canAuthorDispensing: true,
            canApproveDispensing: false,
          },
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");
  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  const cases = [
    {
      label: "기본 진료비",
      type: "consultation",
      columns: ["instructionSummary"],
      values: ["초진 기본 평가"],
      absent: ["담당자", "횟수", "실행 시점"],
    },
    {
      label: "임상병리 검사",
      type: "clinical_lab",
      columns: ["specimenType", "testPanel", "collectionCondition"],
      values: ["혈액", "CBC 5종", "EDTA 전혈"],
    },
    {
      label: "영상검사",
      type: "imaging",
      columns: [
        "bodyRegion",
        "position",
        "viewCount",
        "contrastRequired",
        "sedationRequired",
        "imagingProtocol",
      ],
      values: [
        "흉부",
        "우측 측와",
        "2 view",
        "아니오",
        "흉부 2-view, 호기말 촬영",
      ],
    },
    {
      label: "의뢰 검사",
      type: "external_lab",
      columns: [],
      values: [],
      absent: ["검사 기관"],
    },
    {
      label: "처치",
      type: "treatment",
      columns: [
        "method",
        "site",
        "frequency",
        "schedule",
        "stagedInstructions",
      ],
      values: [
        "피하 수액",
        "견갑 사이",
        "1회",
        "내원 중 1회",
        "체온 확인 후 시행",
      ],
      absent: ["투여량"],
    },
    {
      label: "입원",
      type: "hospitalization",
      columns: [
        "durationDays",
        "careLevel",
        "monitoringInterval",
        "nursingPlan",
      ],
      values: ["3일", "집중", "30분", "2시간마다 활력 확인"],
      absent: ["병동/케이지"],
    },
    {
      label: "계통 검사",
      type: "system_exam",
      columns: ["bodySystem", "examScope", "examMethod"],
      values: ["호흡기계", "호흡기계 평가", "청진"],
      absent: ["소견 요약"],
    },
    {
      label: "기타",
      type: "other",
      columns: ["structuredValue", "description"],
      values: ["보호자 동의서", "시술 전 서명 확인"],
    },
  ];

  for (const entry of cases) {
    await sidePanel
      .getByRole("button", {
        name: new RegExp(`^${entry.label}(?:\\s+\\d+)?$`),
      })
      .click();
    const table = page.getByTestId("hospital-order-table");
    await expect(table).toBeVisible();

    for (const key of entry.columns) {
      await expect(
        table.locator(
          `thead [data-column-id="detail-${entry.type}-${key}"]`,
        ),
      ).toBeVisible();
    }
    for (const value of entry.values) {
      await expect(table.locator("tbody")).toContainText(value);
    }
    for (const absentLabel of entry.absent ?? []) {
      await expect(
        table.getByRole("columnheader", { name: absentLabel }),
      ).toHaveCount(0);
    }
    await expect(
      table.locator('[data-emr-pinned-table-scroll-owner="true"]'),
    ).toHaveCount(1);
  }

  await sidePanel.getByRole("button", { name: /^영상검사/ }).click();
  const imagingTable = page.getByTestId("hospital-order-table");
  await page
    .getByTestId("hospital-order-page-header")
    .getByRole("button", { name: "영상검사 컬럼 표시 설정" })
    .click();
  const protocolOption = page.getByRole("menuitemcheckbox", {
    name: "촬영 프로토콜",
  });
  await expect(protocolOption).toBeChecked();
  await protocolOption.click();
  await expect(
    imagingTable.locator(
      '[data-column-id="detail-imaging-imagingProtocol"]',
    ),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await sidePanel.getByRole("button", { name: /^임상병리 검사/ }).click();
  const labTable = page.getByTestId("hospital-order-table");
  await expect(
    labTable.locator('[data-column-id="detail-clinical_lab-specimenType"]'),
  ).not.toHaveCount(0);
  await expect(
    labTable.locator('[data-column-id^="detail-imaging-"]'),
  ).toHaveCount(0);
});

test("hospital admin order management opens with category and subcategory navigation", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open&aside=history");

  await expect(page.getByTestId("nav-rail-active-item")).toHaveAttribute(
    "aria-label",
    "병원관리",
  );
  await expect(
    page.getByRole("heading", { name: "임상병리 검사" }),
  ).toBeVisible();
  await expect(page.locator("#hospital-admin-content-aside")).toHaveCount(0);
  await expect(
    page.getByTestId("hospital-admin-menu-order-management"),
  ).toContainText("개별 Order");
  await expect(
    page.locator('[data-testid^="hospital-admin-category-"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await expect(
    page
      .getByTestId("hospital-admin-side-panel")
      .getByRole("button", { name: /^전체/ }),
  ).toHaveCount(0);
  const orderSetMenuItem = page.getByTestId("order-set-placeholder");
  await expect(orderSetMenuItem).toContainText("세트 Order");
  await expect(orderSetMenuItem).toContainText("B2");
  await orderSetMenuItem.click();
  await expect(page.getByRole("heading", { name: "Order 세트" })).toBeVisible();
  await expect(
    page.locator('[data-emr-table-action-visibility="contextual"]'),
  ).toHaveCount(1);
  await page.goto("/w/clair-demo/orders?modulePanel=open&aside=history");
  await expect(
    page.getByRole("heading", { name: "임상병리 검사" }),
  ).toBeVisible();
  const expectedTopLevelMenuOrder = [
    "병원 기본 설정",
    "연락처 및 채널",
    "운영시간 관리",
    "공간 관리",
    "바이탈 관리",
    "진료과 분리운영",
    "병원 구성원",
    "역할 및 권한",
    "근무표",
    "감사 로그",
    "개별 Order",
    "세트 Order",
    "차트 템플릿",
    "장비 관리",
    "마약류 관리",
    "프린터 설정",
    "데이터랩",
  ];
  const actualTopLevelMenuOrder = await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button")
    .evaluateAll(
      (buttons, expectedLabels) =>
        buttons.flatMap((button) => {
          const text = button.textContent ?? "";
          const label = expectedLabels.find((candidate) =>
            text.includes(candidate),
          );
          return label ? [label] : [];
        }),
      expectedTopLevelMenuOrder,
    );
  expect(actualTopLevelMenuOrder).toEqual(expectedTopLevelMenuOrder);
  const sidePanelMetrics = await page
    .getByTestId("hospital-admin-menu-order-management")
    .evaluate((trigger) => {
      const section = trigger.closest("section");
      const panel = trigger.closest(
        '[data-testid="hospital-admin-side-panel"]',
      );
      const icon = trigger.querySelector(
        '[data-emr-module-list-section-icon="true"]',
      );
      const label = trigger.querySelector(
        '[data-emr-module-list-item-label="true"]',
      );
      const rail = section?.querySelector(
        '[data-emr-module-list-child-rail="true"]',
      );
      const childList = section?.querySelector(
        '[data-emr-module-list-child-list="true"]',
      );
      const selectedLeaf = section?.querySelector('[data-selected="true"]');
      const selectedLeafLabel = selectedLeaf?.querySelector(
        '[data-emr-module-list-item-label="true"]',
      );
      const selectedLeafBadge = selectedLeaf?.querySelector(
        '[data-emr-module-list-badge="true"]',
      );
      const action = trigger.querySelector(
        '[data-emr-module-list-action="true"]',
      );
      const body = panel?.querySelector('[data-emr-module-list-body="true"]');
      const groups = panel?.querySelectorAll(
        '[data-emr-module-list-group="true"]',
      );
      const groupLabel = panel?.querySelector(
        '[data-emr-module-list-group-label-size="md"]',
      );
      const groupLabelText = groupLabel?.firstElementChild;
      const topLevelItem = groups?.[0]?.querySelector("button");

      if (
        !section ||
        !panel ||
        !icon ||
        !label ||
        !rail ||
        !childList ||
        !selectedLeaf ||
        !selectedLeafLabel ||
        !selectedLeafBadge ||
        !action ||
        !body ||
        !groups ||
        groups.length < 2 ||
        !groupLabel ||
        !groupLabelText ||
        !topLevelItem
      ) {
        throw new Error("Missing module list side-panel layout target");
      }

      const sectionRect = section.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const iconStyle = getComputedStyle(icon);
      const labelRect = label.getBoundingClientRect();
      const labelStyle = getComputedStyle(label);
      const railRect = rail.getBoundingClientRect();
      const railStyle = getComputedStyle(rail);
      const childListRect = childList.getBoundingClientRect();
      const childListStyle = getComputedStyle(childList);
      const leafRect = selectedLeaf.getBoundingClientRect();
      const leafStyle = getComputedStyle(selectedLeaf);
      const leafLabelStyle = getComputedStyle(selectedLeafLabel);
      const leafBadgeRect = selectedLeafBadge.getBoundingClientRect();
      const leafBadgeStyle = getComputedStyle(selectedLeafBadge);
      const actionStyle = getComputedStyle(action);
      const bodyRect = body.getBoundingClientRect();
      const firstGroupRect = groups[0]!.getBoundingClientRect();
      const firstGroupStyle = getComputedStyle(groups[0]!);
      const secondGroupRect = groups[1]!.getBoundingClientRect();
      const groupLabelStyle = getComputedStyle(groupLabelText);
      const topLevelItemRect = topLevelItem.getBoundingClientRect();
      const topLevelItemStyle = getComputedStyle(topLevelItem);

      return {
        actionMarginLeft: actionStyle.marginLeft,
        bodyWidth: bodyRect.width,
        bodyTopInset: firstGroupRect.top - bodyRect.top,
        childListOffset: childListRect.left - sectionRect.left,
        childListRowGap: childListStyle.rowGap,
        firstGroupRowGap: firstGroupStyle.rowGap,
        groupGap: secondGroupRect.top - firstGroupRect.bottom,
        groupLabelFontSize: groupLabelStyle.fontSize,
        groupLabelColor: groupLabelStyle.color,
        groupLabelLetterSpacing: groupLabelStyle.letterSpacing,
        groupLabelLineHeight: groupLabelStyle.lineHeight,
        groupLabelWeight: groupLabelStyle.fontWeight,
        iconLabelGap: labelRect.left - iconRect.right,
        iconColor: iconStyle.color,
        iconWidth: iconRect.width,
        itemLabelColor: labelStyle.color,
        itemLabelFontSize: labelStyle.fontSize,
        itemLabelLetterSpacing: labelStyle.letterSpacing,
        itemLabelLineHeight: labelStyle.lineHeight,
        itemLabelWeight: labelStyle.fontWeight,
        leafBadgeBackground: leafBadgeStyle.backgroundColor,
        leafBadgeColor: leafBadgeStyle.color,
        leafBadgeFontSize: leafBadgeStyle.fontSize,
        leafBadgeHeight: leafBadgeRect.height,
        leafBadgeLineHeight: leafBadgeStyle.lineHeight,
        leafHeight: leafRect.height,
        leafBackground: leafStyle.backgroundColor,
        leafLabelColor: leafLabelStyle.color,
        leafLabelFontSize: leafLabelStyle.fontSize,
        leafLabelLineHeight: leafLabelStyle.lineHeight,
        leafPaddingBottom: leafStyle.paddingBottom,
        leafPaddingLeft: leafStyle.paddingLeft,
        leafPaddingRight: leafStyle.paddingRight,
        leafPaddingTop: leafStyle.paddingTop,
        leafRightInset: panelRect.right - leafRect.right,
        panelWidth: panelRect.width,
        railOffset: railRect.left + railRect.width / 2 - sectionRect.left,
        railHeight: railRect.height,
        railColor: railStyle.backgroundColor,
        childListHeight: childListRect.height,
        topLevelItemHeight: topLevelItemRect.height,
        topLevelItemLeftInset: topLevelItemRect.left - panelRect.left,
        topLevelItemPaddingBottom: topLevelItemStyle.paddingBottom,
        topLevelItemPaddingLeft: topLevelItemStyle.paddingLeft,
        topLevelItemPaddingRight: topLevelItemStyle.paddingRight,
        topLevelItemPaddingTop: topLevelItemStyle.paddingTop,
        topLevelItemRightInset: panelRect.right - topLevelItemRect.right,
        topLevelItemWidth: topLevelItemRect.width,
      };
    });
  expect(Math.round(sidePanelMetrics.panelWidth)).toBe(288);
  expect(Math.round(sidePanelMetrics.bodyWidth)).toBe(
    Math.round(sidePanelMetrics.panelWidth),
  );
  expect(Math.round(sidePanelMetrics.topLevelItemWidth)).toBe(272);
  expect(Math.round(sidePanelMetrics.topLevelItemLeftInset)).toBe(8);
  expect(Math.round(sidePanelMetrics.topLevelItemRightInset)).toBe(8);
  expect(Math.round(sidePanelMetrics.bodyTopInset)).toBe(8);
  expect(sidePanelMetrics.firstGroupRowGap).toBe("2px");
  expect(Math.round(sidePanelMetrics.groupGap)).toBe(16);
  expect(sidePanelMetrics.groupLabelFontSize).toBe("13px");
  expect(sidePanelMetrics.groupLabelLineHeight).toBe("18px");
  expect(sidePanelMetrics.groupLabelLetterSpacing).toBe("0.247px");
  expect(sidePanelMetrics.groupLabelWeight).toBe("500");
  expect(sidePanelMetrics.groupLabelColor).toBe("rgb(115, 115, 115)");
  expect(Math.round(sidePanelMetrics.iconWidth)).toBe(14);
  expect(Math.round(sidePanelMetrics.iconLabelGap)).toBe(8);
  expect(sidePanelMetrics.iconColor).toBe("rgb(115, 115, 115)");
  expect(sidePanelMetrics.itemLabelFontSize).toBe("13px");
  expect(sidePanelMetrics.itemLabelLineHeight).toBe("18px");
  expect(sidePanelMetrics.itemLabelLetterSpacing).toBe("0.247px");
  expect(sidePanelMetrics.itemLabelWeight).toBe("500");
  expect(sidePanelMetrics.itemLabelColor).toBe("rgb(64, 64, 64)");
  expect(sidePanelMetrics.actionMarginLeft).toBe("16px");
  expect(Math.round(sidePanelMetrics.topLevelItemHeight)).toBe(36);
  expect(sidePanelMetrics.topLevelItemPaddingLeft).toBe("8px");
  expect(sidePanelMetrics.topLevelItemPaddingRight).toBe("8px");
  expect(sidePanelMetrics.topLevelItemPaddingTop).toBe("6px");
  expect(sidePanelMetrics.topLevelItemPaddingBottom).toBe("6px");
  expect(Math.round(sidePanelMetrics.childListOffset)).toBe(26);
  expect(sidePanelMetrics.childListRowGap).toBe("2px");
  expect(Math.round(sidePanelMetrics.leafHeight)).toBe(32);
  expect(sidePanelMetrics.leafPaddingLeft).toBe("8px");
  expect(sidePanelMetrics.leafPaddingRight).toBe("8px");
  expect(sidePanelMetrics.leafPaddingTop).toBe("6px");
  expect(sidePanelMetrics.leafPaddingBottom).toBe("6px");
  expect(sidePanelMetrics.leafLabelFontSize).toBe("13px");
  expect(sidePanelMetrics.leafLabelLineHeight).toBe("18px");
  expect(sidePanelMetrics.leafLabelColor).toBe("rgb(23, 23, 23)");
  expect(sidePanelMetrics.leafBackground).toBe("rgba(0, 0, 0, 0.06)");
  expect(Math.round(sidePanelMetrics.leafBadgeHeight)).toBe(20);
  expect(sidePanelMetrics.leafBadgeFontSize).toBe("12px");
  expect(sidePanelMetrics.leafBadgeLineHeight).toBe("16px");
  expect(sidePanelMetrics.leafBadgeColor).toBe("rgb(23, 23, 23)");
  expect(sidePanelMetrics.leafBadgeBackground).toBe("rgba(0, 0, 0, 0.04)");
  expect(Math.round(sidePanelMetrics.leafRightInset)).toBe(8);
  expect(Math.round(sidePanelMetrics.railOffset)).toBe(14);
  expect(sidePanelMetrics.railColor).toBe("rgb(229, 229, 229)");
  expect(Math.round(sidePanelMetrics.railHeight)).toBe(
    Math.round(sidePanelMetrics.childListHeight),
  );
  const topItemMetrics = await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: /병원 구성원/ })
    .evaluate((trigger) => {
      const icon = trigger.querySelector(
        '[data-emr-module-list-item-icon="true"]',
      );
      const label = trigger.querySelector(
        '[data-emr-module-list-item-label="true"]',
      );

      if (!icon || !label) {
        throw new Error("Missing module list top item icon target");
      }

      const iconRect = icon.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();

      return {
        iconLabelGap: labelRect.left - iconRect.right,
        iconWidth: iconRect.width,
      };
    });
  expect(Math.round(topItemMetrics.iconWidth)).toBe(14);
  expect(Math.round(topItemMetrics.iconLabelGap)).toBe(8);
  const disabledTopItemColors = await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: /진료과 분리운영/ })
    .evaluate((trigger) => {
      const icon = trigger.querySelector(
        '[data-emr-module-list-item-icon="true"]',
      );
      const label = trigger.querySelector(
        '[data-emr-module-list-item-label="true"]',
      );

      if (!icon || !label) {
        throw new Error("Missing disabled module list color target");
      }

      return {
        iconColor: getComputedStyle(icon).color,
        labelColor: getComputedStyle(label).color,
      };
    });
  expect(disabledTopItemColors.iconColor).toBe(
    disabledTopItemColors.labelColor,
  );
  expect(disabledTopItemColors.labelColor).toBe("rgb(163, 163, 163)");
  await page
    .getByTestId("hospital-admin-menu-order-management")
    .locator("xpath=ancestor::section")
    .locator('[data-selected="true"]')
    .hover();
  await expect
    .poll(async () =>
      page
        .getByTestId("hospital-admin-menu-order-management")
        .evaluate((trigger) => {
          const panel = trigger.closest(
            '[data-testid="hospital-admin-side-panel"]',
          );
          const selectedLeaf = trigger
            .closest("section")
            ?.querySelector('[data-selected="true"]');

          if (!panel || !selectedLeaf) {
            throw new Error("Missing selected module list leaf");
          }

          const panelRect = panel.getBoundingClientRect();
          const leafRect = selectedLeaf.getBoundingClientRect();

          return Math.round(panelRect.right - leafRect.right);
        }),
    )
    .toBe(8);
  await expect(
    page.getByRole("heading", { name: "임상병리 검사" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("hospital-admin-side-panel")
      .getByRole("button", { name: /^임상병리 검사(?:\s+\d+)?$/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const orderHeader = page.getByTestId("hospital-order-page-header");
  await expect(
    orderHeader.getByRole("textbox", { name: "오더 검색" }),
  ).toBeVisible();
  await expect(orderHeader).not.toContainText("병원관리 / 개별 Order");
  await expect(
    page.getByRole("group", { name: "임상병리 검사 하위 타입" }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("hospital-order-catalog-read-status"),
  ).toContainText("Workspace catalog 기준");
  await expect(
    page.getByTestId("hospital-order-row-ord-lab-cbc-baso"),
  ).toBeVisible();

  await page.getByRole("button", { name: /처방/ }).click();
  await expect(page.getByRole("heading", { name: "처방" })).toBeVisible();
  await expect(
    page.getByTestId("hospital-order-row-ord-med-maropitant"),
  ).toBeVisible();
});

test("hospital admin Order management shows all service-review dispensing masters under 조제", async ({
  page,
}) => {
  const masterItems = Array.from({ length: 108 }, (_, index) =>
    createServiceReviewDispensingMasterItem(index),
  );
  const legacyPrescriptionItems = Array.from({ length: 54 }, (_, index) => {
    const base = createServiceReviewDispensingMasterItem(index + 108);
    return {
      ...base,
      id: `legacy-prescription-${index + 1}`,
      availabilityStatus: "active",
      billingName: `기존 처방 ${index + 1}`,
      clinicalOrderType: "medication",
      dispensingLineage: undefined,
      inHospitalOrderName: `기존 처방 ${index + 1}`,
      originType: "workspace_custom",
      priceKrw: 4500,
      pricingRule: { ...base.pricingRule, priceKrw: 4500 },
      standardOrderId: `legacy-prescription-${index + 1}`,
      standardOrderName: `기존 처방 ${index + 1}`,
    };
  });

  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          items: [...legacyPrescriptionItems, ...masterItems],
          capabilities: {
            canManageCatalog: true,
            canAuthorDispensing: true,
            canApproveDispensing: false,
          },
        }),
      });
    },
  );

  await page.goto(
    "/w/workspace-clair-cheongdam/orders?modulePanel=open&section=orders",
  );

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await expect(
    sidePanel.getByRole("button", { name: /^처방\s+54$/ }),
  ).toBeVisible();
  const dispensingLeaf = sidePanel.getByRole("button", {
    name: /^조제\s+108$/,
  });
  await expect(dispensingLeaf).toBeVisible();
  await dispensingLeaf.click();

  await expect(
    page.getByRole("heading", { level: 1, name: "조제", exact: true }),
  ).toBeVisible();
  const proofRow = page.getByTestId(
    "hospital-order-row-master-workspace-clair-cheongdam-cm.order.dispensing-v1-uk-vmd-a001270",
  );
  await expect(proofRow).toBeVisible();
  await expect(proofRow).toContainText(
    "Betamox Palatable Drops Powder for Oral Suspension 50 mg/ml",
  );
  await expect(proofRow).toContainText("Amoxicillin 경구현탁용산제");
  await expect(proofRow).toContainText("Amoxicillin · 50 mg/mL");
  await expect(proofRow).toContainText("Powder for oral suspension");
  await expect(proofRow).toContainText("0.5정");
  await expect(proofRow).toContainText("경구(PO)");
  await expect(proofRow).toContainText("하루 1회(SID)");
  await expect(proofRow).toContainText("3일");
  await expect(proofRow).toContainText("1.5정");
  await expect(proofRow).toContainText("식후");
  await expect(proofRow).toContainText("실온");
  await expect(proofRow).toContainText("임상 미검토");
  await expect(proofRow).toContainText("사용");
  await expect(proofRow).toContainText("13,500원");
  await expect(proofRow).not.toContainText("검토 대기");

  const table = page
    .getByTestId("hospital-order-table")
    .getByRole("table", { name: "병원관리 개별 Order 테이블" });
  await expect
    .poll(() =>
      table
        .locator("thead [data-column-id]")
        .evaluateAll((headers) =>
          headers.map((header) => header.getAttribute("data-column-id")),
        ),
    )
    .toEqual([
      "select",
      "standardName",
      "inHospitalName",
      "dispensingIngredient",
      "dispensingDosageForm",
      "dispensingDose",
      "dispensingRoute",
      "dispensingFrequency",
      "dispensingDuration",
      "dispensingTotalQuantity",
      "dispensingMedicationInstruction",
      "dispensingStorage",
      "target",
      "dispensingReview",
      "status",
      "billingName",
      "price",
      "actions",
    ]);
  await expect(table.locator('[data-column-id="type"]')).toHaveCount(0);
  await expect(
    page.locator('[data-emr-pinned-table-viewport="true"]'),
  ).toHaveCSS("--emr-table-left-pinned-column-width", "524px");
  await expect(table.locator('th[data-column-id="select"]')).toHaveCSS(
    "width",
    "44px",
  );
  await expect(table.locator('th[data-column-id="standardName"]')).toHaveCSS(
    "width",
    "260px",
  );
  await expect(table.locator('th[data-column-id="inHospitalName"]')).toHaveCSS(
    "width",
    "220px",
  );
  await expect(
    table.locator('th[data-column-id="inHospitalName"]'),
  ).toHaveAttribute("data-emr-column-pinned", "left");
  await expect(table.locator('th[data-column-id="billingName"]')).not.toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );

  const dispensingIngredientHeaderLabel = table.locator(
    'th[data-column-id="dispensingIngredient"] [data-emr-table-content="true"] > :first-child > span:first-child',
  );
  const dispensingIngredientBodyText = proofRow
    .locator(
      'td[data-column-id="dispensingIngredient"] [data-emr-cell-text-mode]',
    )
    .first();
  const [dispensingIngredientHeaderLabelBox, dispensingIngredientBodyTextBox] =
    await Promise.all([
      dispensingIngredientHeaderLabel.boundingBox(),
      dispensingIngredientBodyText.boundingBox(),
    ]);
  expect(dispensingIngredientHeaderLabelBox).not.toBeNull();
  expect(dispensingIngredientBodyTextBox).not.toBeNull();
  expect(
    Math.abs(
      dispensingIngredientHeaderLabelBox!.x -
        dispensingIngredientBodyTextBox!.x,
    ),
  ).toBeLessThanOrEqual(1);

  const tableScrollOwner = table.locator(
    "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']/*[@data-emr-pinned-table-scroll-owner='true']",
  );
  for (const viewportWidth of [1920, 1440, 1280, 1024]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await expect
      .poll(() =>
        tableScrollOwner.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      )
      .toBe(true);
    await expect(
      page.locator('[data-emr-pinned-table-viewport="true"]'),
    ).toHaveCSS("--emr-table-left-pinned-column-width", "524px");
  }
  await page.setViewportSize({ width: 1920, height: 1080 });

  const standardNameCell = proofRow.locator('[data-column-id="standardName"]');
  const inHospitalNameCell = proofRow.locator(
    '[data-column-id="inHospitalName"]',
  );
  const pinnedPositionsBeforeScroll = await Promise.all([
    standardNameCell.boundingBox(),
    inHospitalNameCell.boundingBox(),
  ]);
  await tableScrollOwner.evaluate((element) => {
    element.scrollLeft = 640;
  });
  const pinnedPositionsAfterScroll = await Promise.all([
    standardNameCell.boundingBox(),
    inHospitalNameCell.boundingBox(),
  ]);
  expect(pinnedPositionsBeforeScroll[0]?.x).toBe(
    pinnedPositionsAfterScroll[0]?.x,
  );
  expect(pinnedPositionsBeforeScroll[1]?.x).toBe(
    pinnedPositionsAfterScroll[1]?.x,
  );
  await tableScrollOwner.evaluate((element) => {
    element.scrollLeft = 0;
  });

  const identityHeader = table.locator('th[data-column-id="standardName"]');
  const identityResizeGrip = identityHeader.getByRole("button", {
    name: "표준 Order명 컬럼 너비 조절",
  });
  const widthBeforeKeyboardResize = (await identityHeader.boundingBox())?.width;
  await identityResizeGrip.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await identityHeader.boundingBox())?.width)
    .toBe((widthBeforeKeyboardResize ?? 260) + 8);

  const orderSearch = page.getByRole("textbox", { name: "오더 검색" });
  await orderSearch.fill("Amoxicillin");
  await expect(
    table.locator('[data-testid^="hospital-order-row-"]'),
  ).toHaveCount(1);
  await orderSearch.fill("");

  await page.getByRole("button", { name: "오더 필터 설정" }).click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await page.getByRole("option", { name: "제형" }).click({ force: true });
  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await page
    .getByRole("option", { name: "Powder for oral suspension" })
    .click({ force: true });
  await expect(
    table.locator('[data-testid^="hospital-order-row-"]'),
  ).toHaveCount(1);
  await filterBuilder.getByRole("button", { name: "초기화" }).click();
  await filterBuilder.getByRole("button", { name: "필터 닫기" }).click();

  await proofRow.click();
  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(drawer.getByText("기본 처방값", { exact: true })).toBeVisible();
  await expect(drawer.getByLabel("성분 또는 조제 내용")).toHaveValue(
    "Amoxicillin",
  );
  await expect(drawer.getByLabel("1회 용량")).toHaveValue("0.5");
  await expect(
    drawer.getByRole("combobox", { name: "투여 빈도" }),
  ).toContainText("하루 1회");
  await expect(drawer.getByLabel("투여 일수")).toHaveValue("3");
  await expect(drawer.getByLabel("처방 총량")).toHaveValue("1.5");
  await expect(
    drawer.getByRole("combobox", { name: "가격 방식" }),
  ).toContainText("처방 정액");
  await expect(drawer.getByLabel("판매 금액")).toHaveValue("13500");
});

test("hospital admin Order Set uses the shared table workspace and revision drawer", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open&section=order-sets");

  await expect(page.getByTestId("order-set-page-header")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "병원관리 Order 세트 테이블" }),
  ).toBeVisible();
  const orderSetTable = page.getByRole("table", {
    name: "병원관리 Order 세트 테이블",
  });
  await expect(
    orderSetTable.getByRole("columnheader", { name: "작업" }),
  ).toHaveCount(0);
  await expect(
    orderSetTable.locator('[data-column-id="actions"]').first(),
  ).not.toHaveAttribute("data-emr-column-pinned", "right");
  const orderSetNameHeader = orderSetTable.locator(
    'th[data-column-id="setName"]',
  );
  const orderSetNameResizeGrip = orderSetNameHeader.getByRole("button", {
    name: "Order 세트명 컬럼 너비 조절",
  });
  const orderSetNameHeaderBox = await orderSetNameHeader.boundingBox();
  const orderSetNameResizeGripBox = await orderSetNameResizeGrip.boundingBox();

  expect(orderSetNameHeaderBox).not.toBeNull();
  expect(orderSetNameResizeGripBox).not.toBeNull();
  await page.mouse.move(
    orderSetNameResizeGripBox!.x + orderSetNameResizeGripBox!.width / 2,
    orderSetNameResizeGripBox!.y + orderSetNameResizeGripBox!.height / 2,
  );
  await page.mouse.down();
  try {
    await page.mouse.move(
      orderSetNameResizeGripBox!.x + orderSetNameResizeGripBox!.width / 2 + 32,
      orderSetNameResizeGripBox!.y + orderSetNameResizeGripBox!.height / 2,
      { steps: 4 },
    );
    await expect
      .poll(async () => (await orderSetNameHeader.boundingBox())?.width)
      .toBeGreaterThan(orderSetNameHeaderBox!.width + 24);
  } finally {
    await page.mouse.up();
  }
  const orderSetRow = page.getByTestId("order-set-row-set-vomit-basic");
  await orderSetRow.hover();
  const pinnedBackgroundAlpha = await orderSetRow
    .locator('[data-emr-column-pinned="left"]')
    .evaluateAll((cells) =>
      cells.map((cell) => {
        const color = getComputedStyle(cell).backgroundColor;
        const match = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
        return match ? Number(match[1]) : 1;
      }),
    );
  expect(pinnedBackgroundAlpha.every((alpha) => alpha === 1)).toBe(true);
  await expect(page.getByLabel("Order 세트 사용 여부 필터")).toContainText(
    "사용",
  );
  await expect(page.getByLabel("Order 세트 가격 방식 필터")).toContainText(
    "가격 전체",
  );
  await expect(
    page.getByRole("button", { name: "복제", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "+ Order 세트", exact: true }).click();
  const drawer = page.getByTestId("order-set-drawer");
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("heading", { name: "Order 세트 생성" }),
  ).toBeVisible();
  await expect(
    drawer.getByText("사용 안 함 상태로 만든 뒤 구성과 가격을 확인해 주세요."),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("tablist", { name: "Order 세트 편집 영역" }),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("combobox", { name: "Order 세트 사용 여부" }),
  ).toContainText("사용 안 함");
  await expect(
    drawer.getByRole("heading", { name: "기본 정보", exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("heading", { name: "구성항목", exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("heading", { name: "가격·안내", exact: true }),
  ).toBeVisible();

  await drawer.getByLabel("Order 세트명").fill("활성화 검증 세트");
  await drawer.getByLabel("청구서명").fill("활성화 검증 세트");
  await drawer.getByRole("combobox", { name: "Order 세트 사용 여부" }).click();
  await page.getByRole("option", { name: "사용", exact: true }).click();
  await drawer.getByRole("button", { name: "Order 세트 저장" }).click();
  await expect(
    page.getByText("사용 상태로 저장하려면 구성항목이 필요합니다.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("heading", { name: "구성항목", exact: true }),
  ).toBeVisible();
});

test("hospital admin settings hub opens static screens and role management", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  const plannedScreens = [
    {
      button: "공간 관리",
      heading: "공간 관리",
      testId: "hospital-admin-space-management-screen",
    },
  ];

  for (const screen of plannedScreens) {
    await sidePanel
      .getByRole("button", { name: new RegExp(screen.button) })
      .click();
    await expect(page.getByTestId(screen.testId)).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: screen.heading,
        exact: true,
      }),
    ).toBeVisible();
  }

  await sidePanel.getByRole("button", { name: "역할 및 권한" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "역할 및 권한" }),
  ).toBeVisible();
  await expect(
    page.getByText("권한 역할", { exact: true }).first(),
  ).toBeVisible();

  await expect(
    sidePanel.getByRole("button", { name: /진료과 분리운영/ }),
  ).toBeDisabled();
  await expect(
    sidePanel.getByRole("button", { name: /차트 템플릿/ }),
  ).toBeDisabled();
});

test("hospital admin pages keep WorkspaceFrame as the single outer border", async ({
  page,
}) => {
  const targetPages = [
    { section: "settings", heading: "병원 기본 설정" },
    { section: "settings-contact", heading: "연락처 및 채널" },
    { section: "settings-hours", heading: "운영시간 관리" },
    { section: "space-time", heading: "공간 관리" },
    { section: "vitals", heading: "바이탈 관리" },
    { section: "members", heading: "병원 구성원" },
    { section: "roles", heading: "역할 및 권한" },
    { section: "schedule", heading: "근무표" },
    { section: "audit", heading: "감사 로그" },
  ];
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const target of targetPages) {
      await page.goto(
        `/w/clair-demo/orders?modulePanel=open&section=${target.section}`,
      );
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: target.heading,
          exact: true,
        }),
      ).toBeVisible();

      const nestedOuterBorders = await page
        .getByTestId("workspace-main-content")
        .evaluate((root) => {
          const rootRect = root.getBoundingClientRect();

          return Array.from(root.querySelectorAll<HTMLElement>("*")).flatMap(
            (element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              const fillsWorkspace =
                Math.abs(rect.left - rootRect.left) <= 1 &&
                Math.abs(rect.top - rootRect.top) <= 1 &&
                Math.abs(rect.width - rootRect.width) <= 2 &&
                Math.abs(rect.height - rootRect.height) <= 2;

              if (!fillsWorkspace || style.borderTopWidth === "0px") {
                return [];
              }

              return [
                {
                  testId: element.dataset.testid ?? null,
                  borderTopWidth: style.borderTopWidth,
                  borderRadius: style.borderRadius,
                  boxShadow: style.boxShadow,
                },
              ];
            },
          );
        });

      expect(
        nestedOuterBorders,
        `${viewport.name} ${target.section} should not redraw the WorkspaceFrame border`,
      ).toEqual([]);
    }
  }
});

test("hospital space management supports category and terminal space CRUD with feedback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "공간 관리" })
    .click();

  const screen = page.getByTestId("hospital-admin-space-management-screen");
  await expect(
    screen.getByRole("heading", { level: 1, name: "공간 관리" }),
  ).toBeVisible();
  await expect(screen).not.toContainText("시간");
  await expect(screen.getByTestId("space-category-row-consult")).toContainText(
    "진료 공간",
  );
  await expect(screen.getByTestId("space-category-row-consult")).toContainText(
    "2",
  );
  await expect(
    screen.locator('[data-testid^="space-category-icon-"]'),
  ).toHaveCount(4);
  await expect(
    screen.locator('[data-testid^="space-category-icon-"] svg'),
  ).toHaveCount(4);
  const consultIconKey = await screen
    .getByTestId("space-category-icon-consult")
    .getAttribute("data-icon-key");
  const examIconKey = await screen
    .getByTestId("space-category-icon-exam")
    .getAttribute("data-icon-key");
  expect(consultIconKey).not.toBeNull();
  expect(consultIconKey).not.toBe(examIconKey);

  const overviewFigmaMetrics = await screen.evaluate((root) => {
    const required = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element;
    };
    const box = (selector: string) =>
      required(selector).getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    const mainBox = box("main");
    const headerBox = box("main > header");
    const cardBox = box('[data-testid="space-management-card"]');
    return {
      mainWidth: Math.round(mainBox.width),
      contentTop: Math.round(headerBox.top - rootBox.top),
      headerHeight: Math.round(headerBox.height),
      headerGap: Math.round(cardBox.top - headerBox.bottom),
      cardWidth: Math.round(cardBox.width),
      cardHeaderHeight: Math.round(
        required(
          "#space-category-list-title",
        ).parentElement!.parentElement!.getBoundingClientRect().height,
      ),
      rowHeight: Math.round(
        box('[data-testid="space-category-row-consult"]').height,
      ),
      iconSize: Math.round(
        box('[data-testid="space-category-icon-consult"]').width,
      ),
      actionHeight: Math.round(
        required(
          '[data-testid="space-category-action"]',
        ).getBoundingClientRect().height,
      ),
    };
  });
  expect(overviewFigmaMetrics).toEqual({
    mainWidth: 720,
    contentTop: 56,
    headerHeight: 92,
    headerGap: 16,
    cardWidth: 720,
    cardHeaderHeight: 85,
    rowHeight: 85,
    iconSize: 44,
    actionHeight: 32,
  });

  await screen.getByRole("button", { name: "카테고리 설정" }).click();
  const categoryDialog = page.getByRole("dialog", { name: "카테고리 설정" });
  await expect(categoryDialog).toBeVisible();
  await expect(categoryDialog.getByText("2", { exact: true })).toHaveCount(0);

  await categoryDialog.getByRole("button", { name: "카테고리 추가" }).click();
  const categoryInput = categoryDialog.getByPlaceholder("예: 입원 공간");
  await expect(categoryInput).toBeVisible();
  await categoryInput.fill("입원 공간");
  await categoryDialog
    .getByRole("button", { name: "추가", exact: true })
    .click();
  await expect(page.getByText("카테고리를 추가했어요.")).toBeVisible();
  await expect(
    categoryDialog.getByText("입원 공간", { exact: true }),
  ).toBeVisible();

  await categoryDialog
    .getByRole("button", { name: "입원 공간 이름 수정" })
    .click();
  const renameInput = categoryDialog.getByRole("textbox", {
    name: "카테고리 이름",
  });
  await renameInput.fill("입원·격리 공간");
  await categoryDialog
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(page.getByText("카테고리 이름을 변경했어요.")).toBeVisible();
  await expect(
    categoryDialog.getByText("입원·격리 공간", { exact: true }),
  ).toBeVisible();

  await categoryDialog
    .getByRole("button", { name: "입원·격리 공간 삭제" })
    .click();
  const emptyCategoryDeleteDialog = page.getByRole("dialog", {
    name: "카테고리를 삭제할까요?",
  });
  await emptyCategoryDeleteDialog
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByText("카테고리를 삭제했어요.")).toBeVisible();
  await expect(
    categoryDialog.getByText("입원·격리 공간", { exact: true }),
  ).toHaveCount(0);
  await categoryDialog.getByRole("button", { name: "닫기" }).click();

  await screen.getByRole("button", { name: /진료 공간/ }).click();
  await expect(
    screen.getByRole("heading", { level: 1, name: "진료 공간" }),
  ).toBeVisible();
  await expect(screen).toContainText(
    "병원에서 사용하는 진료 공간을 묶어 관리합니다",
  );
  await expect(
    screen.getByRole("button", { name: "카테고리 설정" }),
  ).toHaveCount(0);
  await expect(
    screen.getByRole("button", { name: "진료실 1 수정" }),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "진료실 1 삭제" }),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "진료실 1", exact: true }),
  ).toHaveCount(0);

  const detailFigmaMetrics = await screen.evaluate((root) => {
    const required = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element;
    };
    const box = (selector: string) =>
      required(selector).getBoundingClientRect();
    return {
      cardWidth: Math.round(
        box('[data-testid="space-management-detail-card"]').width,
      ),
      rowHeight: Math.round(
        box('[data-testid="space-row-space-consult-1"]').height,
      ),
      editHeight: Math.round(
        required('[aria-label="진료실 1 수정"]').getBoundingClientRect().height,
      ),
      deleteHeight: Math.round(
        required('[aria-label="진료실 1 삭제"]').getBoundingClientRect().height,
      ),
      backHeight: Math.round(
        required('[aria-label="공간 관리로 돌아가기"]').getBoundingClientRect()
          .height,
      ),
    };
  });
  expect(detailFigmaMetrics).toEqual({
    cardWidth: 720,
    rowHeight: 85,
    editHeight: 32,
    deleteHeight: 32,
    backHeight: 32,
  });

  await screen.getByRole("button", { name: "공간 추가" }).click();
  const spaceInput = screen.getByPlaceholder("예: 진료실 3");
  await spaceInput.fill("진료실 3");
  await screen.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("공간을 추가했어요.")).toBeVisible();
  await expect(screen.getByText("진료실 3", { exact: true })).toBeVisible();

  await screen.getByRole("button", { name: "진료실 3 수정" }).click();
  const editSpaceInput = screen.getByRole("textbox", { name: "공간 이름" });
  await editSpaceInput.fill("진료실 3A");
  await screen.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("공간 정보를 변경했어요.")).toBeVisible();
  await expect(screen.getByText("진료실 3A", { exact: true })).toBeVisible();

  await screen.getByRole("button", { name: "진료실 3A 삭제" }).click();
  const spaceDeleteDialog = page.getByRole("dialog", {
    name: "공간을 삭제할까요?",
  });
  await spaceDeleteDialog
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByText("공간을 삭제했어요.")).toBeVisible();
  await expect(screen.getByText("진료실 3A", { exact: true })).toHaveCount(0);
  await screen.getByRole("button", { name: "공간 관리로 돌아가기" }).click();
  await expect(
    screen.getByRole("heading", { level: 1, name: "공간 관리" }),
  ).toBeVisible();
});

test("hospital space management moves spaces before deleting a populated category", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "공간 관리" })
    .click();

  const screen = page.getByTestId("hospital-admin-space-management-screen");
  await screen.getByRole("button", { name: "카테고리 설정" }).click();
  const categoryDialog = page.getByRole("dialog", { name: "카테고리 설정" });

  await categoryDialog.getByRole("button", { name: "카테고리 추가" }).click();
  await categoryDialog.getByPlaceholder("예: 입원 공간").fill("진료 공간");
  await categoryDialog
    .getByRole("button", { name: "추가", exact: true })
    .click();
  await expect(
    page.getByText("같은 이름의 카테고리가 이미 있습니다."),
  ).toBeVisible();
  await categoryDialog
    .getByRole("button", { name: "취소", exact: true })
    .click();

  await categoryDialog.getByRole("button", { name: "처치 공간 삭제" }).click();
  const deleteDialog = page.getByRole("dialog", {
    name: "카테고리를 삭제할까요?",
  });
  await expect(deleteDialog).toContainText(
    "등록된 공간은 선택한 카테고리로 이동",
  );
  await deleteDialog.getByRole("combobox", { name: "공간 이동 대상" }).click();
  await page.getByRole("option", { name: "진료 공간" }).click();
  await deleteDialog.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("카테고리를 삭제했어요.")).toBeVisible();
  await expect(
    categoryDialog.getByText("처치 공간", { exact: true }),
  ).toHaveCount(0);
  await categoryDialog.getByRole("button", { name: "닫기" }).click();

  await screen.getByRole("button", { name: /진료 공간/ }).click();
  await expect(screen.getByText("처치실 1", { exact: true })).toBeVisible();
});

test("hospital space management recovers from read failure and renders an empty read-only state", async ({
  page,
}) => {
  let serveSuccess = false;
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/space-management",
    async (route) => {
      if (!serveSuccess) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            status: 500,
            error: "db_read_failed",
          }),
        });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "workspace-space-management",
          workspaceId: "clair-demo",
          canManage: false,
          categories: [],
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "공간 관리" })
    .click();

  const screen = page.getByTestId("hospital-admin-space-management-screen");
  await expect(
    screen.getByText("공간 정보를 불러오지 못했습니다"),
  ).toBeVisible();
  serveSuccess = true;
  await screen.getByRole("button", { name: "다시 시도" }).click();
  await expect(screen.getByText("등록된 공간이 없습니다")).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "카테고리 추가" }),
  ).toBeDisabled();
  const emptyMetrics = await screen.evaluate((root) => {
    const card = root
      .querySelector<HTMLElement>('[data-testid="space-management-card"]')
      ?.getBoundingClientRect();
    const empty = root
      .querySelector<HTMLElement>('[data-testid="space-category-empty"]')
      ?.getBoundingClientRect();
    if (!card || !empty)
      throw new Error("Missing empty space management state");
    return {
      cardHeight: Math.round(card.height),
      emptyHeight: Math.round(empty.height),
    };
  });
  expect(emptyMetrics).toEqual({ cardHeight: 170, emptyHeight: 85 });
});

test("hospital space management empty administrator state opens the first category form", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/space-management",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "workspace-space-management",
          workspaceId: "clair-demo",
          canManage: true,
          categories: [],
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "공간 관리" })
    .click();

  const screen = page.getByTestId("hospital-admin-space-management-screen");
  await expect(screen.getByText("등록된 공간이 없습니다")).toBeVisible();
  const addCategory = screen.getByRole("button", { name: "카테고리 추가" });
  await expect(addCategory).toBeEnabled();
  await addCategory.click();

  const categoryDialog = page.getByRole("dialog", { name: "카테고리 설정" });
  await expect(categoryDialog).toBeVisible();
  await expect(
    categoryDialog.getByRole("textbox", { name: "새 카테고리 이름" }),
  ).toBeFocused();
});

test("hospital space management stays usable on a compact screen", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "공간 관리" })
    .click();
  await page.setViewportSize({ width: 720, height: 900 });

  const screen = page.getByTestId("hospital-admin-space-management-screen");
  await expect(
    screen.getByRole("button", { name: "카테고리 설정" }),
  ).toBeVisible();
  await expect(screen.getByTestId("space-category-row-consult")).toBeVisible();
  await expect
    .poll(() =>
      screen.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);

  await screen.getByRole("button", { name: "카테고리 설정" }).click();
  const categoryDialog = page.getByRole("dialog", { name: "카테고리 설정" });
  await expect(
    categoryDialog.getByRole("button", { name: "카테고리 추가" }),
  ).toBeVisible();
  await categoryDialog.getByRole("button", { name: "닫기" }).click();

  await screen.getByRole("button", { name: /진료 공간/ }).click();
  await expect(screen.getByRole("button", { name: "공간 추가" })).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "진료실 1 수정" }),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "진료실 1 삭제" }),
  ).toBeVisible();
});

test("hospital vital settings matches CDS V2 while preserving the reviewed interaction", async ({
  page,
}) => {
  let items: Array<{
    key: string;
    enabled: boolean;
    displayUnit: string;
    sortOrder: number;
  }> = [
    { key: "weight", enabled: true, displayUnit: "kg", sortOrder: 0 },
    { key: "temperature", enabled: true, displayUnit: "°C", sortOrder: 1 },
    { key: "heart_rate", enabled: true, displayUnit: "bpm", sortOrder: 2 },
    { key: "blood_pressure", enabled: true, displayUnit: "mmHg", sortOrder: 3 },
    {
      key: "respiratory_rate",
      enabled: false,
      displayUnit: "rpm",
      sortOrder: 4,
    },
  ];
  const presets = [
    {
      key: "weight",
      label: "체중",
      description: "환자의 현재 체중",
      canonicalUnit: "kg",
      allowedDisplayUnits: ["kg", "g"],
      requiredInWorkspace: true,
    },
    {
      key: "temperature",
      label: "체온",
      description: "체온계로 측정한 체온",
      canonicalUnit: "°C",
      allowedDisplayUnits: ["°C", "°F"],
      requiredInWorkspace: true,
    },
    {
      key: "heart_rate",
      label: "심박수",
      description: "분당 심장 박동 수",
      canonicalUnit: "bpm",
      allowedDisplayUnits: ["bpm"],
      requiredInWorkspace: false,
    },
    {
      key: "respiratory_rate",
      label: "호흡수",
      description: "분당 호흡 횟수",
      canonicalUnit: "rpm",
      allowedDisplayUnits: ["rpm"],
      requiredInWorkspace: false,
    },
    {
      key: "blood_pressure",
      label: "혈압",
      description: "수축기 단독 또는 수축기/이완기",
      canonicalUnit: "mmHg",
      allowedDisplayUnits: ["mmHg"],
      requiredInWorkspace: false,
    },
  ];
  await page.route(
    "**/api/workspaces/clair-demo/vital-settings",
    async (route) => {
      if (route.request().method() === "PUT") {
        items = (
          (await route.request().postDataJSON()) as { items: typeof items }
        ).items;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          canManage: true,
          presets,
          items,
        }),
      });
    },
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: /바이탈 관리/ })
    .click();

  const screen = page.getByTestId("hospital-admin-vitals-screen");
  await expect(
    screen.getByRole("heading", { level: 1, name: "바이탈 관리" }),
  ).toBeVisible();
  await expect(screen).toContainText(
    "체중과 체온은 항상 사용되며, 실제 측정값 입력은 선택입니다.",
  );
  await expect(screen).not.toContainText("영향 범위");
  await expect(screen).not.toContainText("향후 데이터");
  await expect(screen).not.toContainText("기본 바이탈 정상 범위");
  const addButton = screen.getByRole("button", { name: "바이탈 추가" });
  await expect(addButton).toHaveCount(1);
  await expect(addButton).toBeDisabled();
  await expect(page.getByTestId("hospital-settings-change-bar")).toHaveCount(0);
  await expect(
    screen
      .getByTestId("vital-settings-list")
      .locator('[data-testid^="vital-setting-row-"]'),
  ).toHaveCount(5);
  await expect(screen.getByText("기본", { exact: true })).toHaveCount(2);
  await expect(screen.getByRole("switch", { name: "체중 사용" })).toHaveCount(
    0,
  );
  await expect(screen.getByRole("switch", { name: "체온 사용" })).toHaveCount(
    0,
  );
  await expect(screen.getByRole("button", { name: "체중 작업" })).toHaveCount(
    0,
  );
  await expect(
    screen.getByRole("button", { name: "체중 기본 항목" }),
  ).toBeDisabled();
  await expect(
    screen.getByRole("button", { name: "심박수 작업" }),
  ).toBeVisible();
  await expect(screen.getByLabel("심박수 표시 단위")).toBeEnabled();
  await expect(screen.getByLabel("호흡수 표시 단위")).toBeDisabled();

  const figmaMetrics = await screen.evaluate((root) => {
    const required = (selector: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element;
    };
    const box = (selector: string) =>
      required(selector).getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    const mainBox = box("main");
    const headerBox = box("main > header");
    const cardBox = box('[data-testid="vital-settings-card"]');
    return {
      mainWidth: Math.round(mainBox.width),
      contentTop: Math.round(headerBox.top - rootBox.top),
      headerHeight: Math.round(headerBox.height),
      headerGap: Math.round(cardBox.top - headerBox.bottom),
      cardWidth: Math.round(cardBox.width),
      cardHeight: Math.round(cardBox.height),
      cardHeaderHeight: Math.round(
        required(
          "#vital-settings-list-title",
        ).parentElement!.getBoundingClientRect().height,
      ),
      rowHeight: Math.round(
        box('[data-testid="vital-setting-row-weight"]').height,
      ),
      gripSize: Math.round(
        required('[aria-label="체중 순서 변경"]').getBoundingClientRect().width,
      ),
      unitWidth: Math.round(
        required('[aria-label="체중 표시 단위"]').getBoundingClientRect().width,
      ),
      switchWidth: Math.round(
        required('[aria-label="심박수 사용"]').getBoundingClientRect().width,
      ),
      actionSize: Math.round(
        required('[aria-label="심박수 작업"]').getBoundingClientRect().width,
      ),
      addHeight: Math.round(
        required('[data-testid="vital-settings-add"]').getBoundingClientRect()
          .height,
      ),
    };
  });

  expect(figmaMetrics).toEqual({
    mainWidth: 720,
    contentTop: 56,
    headerHeight: 92,
    headerGap: 16,
    cardWidth: 720,
    cardHeight: 582,
    cardHeaderHeight: 85,
    rowHeight: 85,
    gripSize: 18,
    unitWidth: 180,
    switchWidth: 38,
    actionSize: 32,
    addHeight: 32,
  });

  const weightGrip = screen.getByRole("button", { name: "체중 순서 변경" });
  await expect(weightGrip.locator(".oi-reorder-alt")).toBeVisible();
  await expect(weightGrip).toHaveCSS("cursor", "grab");
  const gripColors = await weightGrip.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }));
  await weightGrip.hover();
  await expect
    .poll(() =>
      weightGrip.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        color: getComputedStyle(element).color,
      })),
    )
    .toEqual(gripColors);
  const weightGripBox = await weightGrip.boundingBox();
  const temperatureRowBox = await screen
    .getByTestId("vital-setting-row-temperature")
    .boundingBox();
  if (!weightGripBox || !temperatureRowBox)
    throw new Error("바이탈 드래그 대상을 찾지 못했습니다.");
  await page.mouse.move(
    weightGripBox.x + weightGripBox.width / 2,
    weightGripBox.y + weightGripBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    temperatureRowBox.x + temperatureRowBox.width / 2,
    temperatureRowBox.y + temperatureRowBox.height - 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    screen
      .getByTestId("vital-settings-list")
      .locator('[data-testid^="vital-setting-row-"]')
      .nth(1),
  ).toHaveAttribute("data-testid", "vital-setting-row-weight");
  let changeBar = page.getByTestId("hospital-settings-change-bar");
  await expect(changeBar).toBeVisible();
  await changeBar.getByRole("button", { name: "변경 전으로 되돌리기" }).click();
  await page.getByRole("button", { name: "변경사항 되돌리기" }).click();
  await expect(
    screen
      .getByTestId("vital-settings-list")
      .locator('[data-testid^="vital-setting-row-"]')
      .nth(0),
  ).toHaveAttribute("data-testid", "vital-setting-row-weight");

  await screen.getByLabel("체중 표시 단위").click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  changeBar = page.getByTestId("hospital-settings-change-bar");
  await expect(
    changeBar.getByRole("button", { name: "변경 전으로 되돌리기" }),
  ).toBeEnabled();
  await expect(
    changeBar.getByRole("button", { name: "변경사항 저장" }),
  ).toBeEnabled();
  await changeBar
    .getByRole("button", { name: "변경 전으로 되돌리기" })
    .press("Enter");
  await page.getByRole("button", { name: "변경사항 되돌리기" }).click();
  await expect(screen.getByLabel("체중 표시 단위")).toContainText("kg");
  await expect(page.getByTestId("hospital-settings-change-bar")).toHaveCount(0);

  await screen.getByRole("button", { name: "심박수 작업" }).click();
  await page.getByRole("menuitem", { name: "목록에서 제거" }).click();
  await expect(screen.getByTestId("vital-setting-row-heart_rate")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("hospital-settings-change-bar")).toBeVisible();
  await page.getByRole("button", { name: "되돌리기", exact: true }).click();
  await expect(
    screen.getByTestId("vital-setting-row-heart_rate"),
  ).toBeVisible();

  await screen.getByRole("button", { name: "심박수 작업" }).click();
  await page.getByRole("menuitem", { name: "목록에서 제거" }).click();
  await expect(addButton).toBeEnabled();
  await addButton.click();
  const addDialog = page.getByRole("dialog", { name: "바이탈 추가" });
  await expect(addDialog.getByRole("button", { name: /심박수/ })).toBeVisible();
  await addDialog.getByRole("button", { name: /심박수/ }).click();
  await screen.getByRole("button", { name: "심박수 작업" }).click();
  await page.getByRole("menuitem", { name: "목록에서 제거" }).click();

  changeBar = page.getByTestId("hospital-settings-change-bar");
  await changeBar.getByRole("button", { name: "변경사항 저장" }).click();

  const saveDialog = page.getByTestId("vital-settings-save-dialog");
  await expect(saveDialog).toContainText(
    "접수와 진료 화면에 같은 설정이 적용됩니다.",
  );
  await expect(saveDialog).toContainText("목록에서 제거: 심박수");
  await expect(saveDialog).toContainText(
    "기존 기록은 삭제되지 않으며, 바이탈 추가에서 다시 추가할 수 있습니다.",
  );
  await expect(saveDialog).toContainText("체중 · 체온 · 혈압");
  await saveDialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByTestId("hospital-settings-change-bar")).toHaveCount(0);
  expect(items.some((item) => item.key === "heart_rate")).toBe(false);
  expect(items.find((item) => item.key === "weight")?.enabled).toBe(true);
  expect(items.find((item) => item.key === "temperature")?.enabled).toBe(true);
  expect(items.find((item) => item.key === "respiratory_rate")?.enabled).toBe(
    false,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      screen
        .locator('[data-slot="card-content"]')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
});

test("hospital schedule supports editing, personal requests, approval, and publish review", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: "근무표" }).click();

  await expect(
    page.getByTestId("hospital-admin-schedule-screen"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "근무표" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "근무표 보기" })
      .getByRole("button", { name: "주간 편성" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("hospital-schedule-weekly-grid")).toBeVisible();
  await expect(page.getByText("박수지").first()).toBeVisible();

  await page.getByRole("button", { name: "+ 근무" }).click();
  await expect(page.getByRole("heading", { name: "근무 추가" })).toBeVisible();
  await page.getByLabel("근무명").fill("야간 검사 보강");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("야간 검사 보강").first()).toBeVisible();

  await page.getByRole("button", { name: "야간 검사 보강 작업" }).click();
  await page.getByText("삭제", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "근무를 삭제하시겠습니까?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "삭제" }).last().click();
  await expect(page.getByText("야간 검사 보강")).toHaveCount(0);

  await page.getByRole("button", { name: "일간 커버리지" }).click();
  await expect(
    page.getByTestId("hospital-schedule-daily-coverage"),
  ).toBeVisible();

  await page.getByRole("button", { name: "게시하기" }).click();
  const publishDialog = page.getByRole("dialog");
  await expect(
    publishDialog.getByRole("heading", { name: "게시 전 충돌 검토" }),
  ).toBeVisible();
  await expect(
    publishDialog.getByRole("button", { name: "게시" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "내 근무" }).click();
  await expect(page.getByTestId("hospital-schedule-personal")).toBeVisible();
  await page.getByRole("button", { name: "휴무·변경 요청" }).click();
  await page.getByLabel("사유").fill("개인 일정으로 오후 휴무 요청");
  await page.getByRole("button", { name: "요청 제출" }).click();
  await expect(page.getByTestId("hospital-schedule-personal")).toContainText(
    "개인 일정으로 오후 휴무 요청",
  );
  await expect(page.getByTestId("hospital-schedule-personal")).toContainText(
    "승인 대기",
  );

  await page.getByRole("button", { name: "관리자 근무표" }).click();
  await page.getByRole("button", { name: /승인 대기 요청/ }).click();
  await expect(
    page.getByRole("heading", { name: "박수지 일정" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "승인" }).first().click();
  await expect(
    page.getByTestId("hospital-admin-schedule-screen"),
  ).toContainText("재게시 필요");
});

test.describe("hospital schedule on mobile", () => {
  test("uses an employee day list instead of shrinking the weekly matrix", async ({
    page,
  }) => {
    await page.goto("/w/clair-demo/orders?modulePanel=open");
    await page
      .getByTestId("hospital-admin-side-panel")
      .getByRole("button", { name: "근무표" })
      .click();
    await page.setViewportSize({ width: 390, height: 844 });

    await expect(
      page.getByTestId("hospital-schedule-mobile-day-list"),
    ).toBeVisible();
    await expect(
      page.getByTestId("hospital-schedule-weekly-grid"),
    ).toBeHidden();
    await expect(
      page.getByTestId("hospital-schedule-mobile-day-list"),
    ).toContainText("김도윤");
  });
});

test("hospital schedule restores keyboard focus after closing the shift sheet", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "근무표" })
    .click();

  const addShift = page.getByRole("button", { name: "+ 근무" });
  await addShift.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "근무 추가" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "근무 추가" })).toHaveCount(0);
  await expect(addShift).toBeFocused();
});

test("hospital admin role and permission screen replaces the static role-work concept", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: "역할 및 권한" }).click();

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(screen).toBeVisible();
  await expect(
    screen.getByRole("heading", { name: "역할 및 권한", exact: true }),
  ).toBeVisible();
  const roleSection = screen.getByTestId("role-permission-hub-roles");
  const positionSection = screen.getByTestId("role-permission-hub-positions");
  const workDefaultsSection = screen.getByTestId(
    "role-permission-hub-work-defaults",
  );
  await expect(roleSection).toContainText("3개 역할");
  await expect(positionSection).toContainText("직무");
  await expect(workDefaultsSection).toContainText("4개 업무");
  await expect(screen.getByText("향후 데이터")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "시안 저장" })).toHaveCount(0);
  await expect(screen.getByRole("button", { name: "역할 편집" })).toHaveCount(
    0,
  );
  await roleSection.click();
  await expect(page).toHaveURL(/roleSettings=roles/);
  await expect(
    screen.getByRole("heading", { name: "권한 역할", exact: true }),
  ).toBeVisible();
  await expect(screen.getByTestId("role-summary-grid")).toContainText("소유자");
  await expect(screen.getByTestId("role-summary-grid")).toContainText("관리자");
  await expect(screen.getByTestId("role-summary-grid")).toContainText("일반");
  const ownerRole = screen.getByTestId("role-item-owner");
  const adminRole = screen.getByTestId("role-item-admin");
  const generalRole = screen.getByTestId("role-item-general");
  await expect(adminRole).toHaveAttribute("aria-expanded", "true");
  await expect(ownerRole).toHaveAttribute("aria-expanded", "false");
  await ownerRole.click();
  await expect(ownerRole).toHaveAttribute("aria-expanded", "true");
  await expect(adminRole).toHaveAttribute("aria-expanded", "false");
  await ownerRole.click();
  await expect(ownerRole).toHaveAttribute("aria-expanded", "false");
  await expect(screen.locator('[data-testid^="role-panel-"]')).toHaveCount(0);
  await generalRole.click();
  await expect(generalRole).toHaveAttribute("aria-expanded", "true");
  await expect(screen.locator('[data-testid^="role-panel-"]')).toHaveCount(1);
  await expect(
    screen.getByRole("switch", { name: /워크스페이스 삭제/ }),
  ).toBeDisabled();
  await expect(
    screen.getByRole("checkbox", { name: /워크스페이스 삭제/ }),
  ).toHaveCount(0);
  await expect(screen.getByText("소유자 전용").first()).toBeVisible();
  await expect(
    screen
      .getByTestId("role-permission-content")
      .evaluate((element) => Math.round(element.getBoundingClientRect().width)),
  ).resolves.toBeLessThanOrEqual(752);
});

test("hospital admin saves role work defaults locally without changing permissions", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "역할 및 권한" })
    .click();

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await screen.getByTestId("role-permission-hub-work-defaults").click();
  await expect(screen.getByText("권한과 분리된 설정")).toBeVisible();

  await screen.getByLabel("기본 접수 담당").click();
  await page.getByRole("option", { name: "수의사" }).click();
  await expect(screen.getByRole("button", { name: "저장" })).toBeVisible();
  await screen.getByRole("button", { name: "저장" }).click();
  await expect(screen.getByRole("status")).toContainText(
    "이 브라우저의 업무 기본값을 저장했습니다.",
  );

  await page.reload();
  await expect(page).toHaveURL(/roleSettings=work-defaults/);
  await expect(screen.getByLabel("기본 접수 담당")).toContainText("수의사");
});

test("hospital admin preserves unsaved work defaults and confirms destructive navigation", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: "역할 및 권한" }).click();

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  const workDefaultsSection = screen.getByTestId(
    "role-permission-hub-work-defaults",
  );
  await workDefaultsSection.click();
  await screen.getByLabel("기본 접수 담당").click();
  await page.getByRole("option", { name: "수의사" }).click();

  await page.goBack();
  await expect(workDefaultsSection).toContainText("저장하지 않은 변경");
  await workDefaultsSection.click();
  await expect(screen.getByLabel("기본 접수 담당")).toContainText("수의사");

  await sidePanel.getByRole("button", { name: "병원 기본 설정" }).click();
  const sideNavigationDialog = page.getByRole("dialog", {
    name: "저장하지 않은 변경사항이 있습니다",
  });
  await expect(sideNavigationDialog).toBeVisible();
  await sideNavigationDialog.getByRole("button", { name: "계속 편집" }).click();
  await expect(
    screen.getByRole("heading", { name: "업무 기본값" }),
  ).toBeVisible();

  await screen
    .getByRole("button", { name: "역할 및 권한", exact: true })
    .click();
  const detailNavigationDialog = page.getByRole("dialog", {
    name: "저장하지 않은 변경사항이 있습니다",
  });
  await expect(detailNavigationDialog).toBeVisible();
  await detailNavigationDialog
    .getByRole("button", { name: "계속 편집" })
    .click();
  await expect(screen.getByLabel("기본 접수 담당")).toContainText("수의사");

  await screen
    .getByRole("button", { name: "역할 및 권한", exact: true })
    .click();
  await detailNavigationDialog
    .getByRole("button", { name: "변경사항 버리기" })
    .click();
  await expect(workDefaultsSection).toContainText("4개 업무");
  await expect(page).not.toHaveURL(/roleSettings=/);
});

test("hospital admin detail back always returns a direct deep link to the settings hub", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/orders?modulePanel=open&section=roles&roleSettings=roles",
  );

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(
    screen.getByRole("heading", { name: "권한 역할", exact: true }),
  ).toBeVisible();
  await screen
    .getByRole("button", { name: "역할 및 권한", exact: true })
    .click();

  await expect(page).not.toHaveURL(/roleSettings=/);
  await expect(screen.getByTestId("role-permission-hub-roles")).toBeVisible();
});

test("hospital admin syncs saved work defaults to another browser tab", async ({
  page,
  context,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "역할 및 권한" })
    .click();
  const firstScreen = page.getByTestId("hospital-admin-role-permission-screen");
  await firstScreen.getByTestId("role-permission-hub-work-defaults").click();

  const secondPage = await context.newPage();
  await secondPage.goto("/w/clair-demo/orders?modulePanel=open");
  await secondPage
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "역할 및 권한" })
    .click();
  const secondScreen = secondPage.getByTestId(
    "hospital-admin-role-permission-screen",
  );
  await secondScreen.getByTestId("role-permission-hub-work-defaults").click();

  await firstScreen.getByLabel("기본 접수 담당").click();
  await page.getByRole("option", { name: "수의사" }).click();
  await firstScreen.getByRole("button", { name: "저장" }).click();

  await expect(secondScreen.getByLabel("기본 접수 담당")).toContainText(
    "수의사",
  );
  await secondPage.close();
});

test("hospital admin role screen stays compact and keyboard-safe", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page
    .getByTestId("hospital-admin-side-panel")
    .getByRole("button", { name: "역할 및 권한" })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });

  const screen = page.getByTestId("hospital-admin-role-permission-screen");
  await expect(
    screen.evaluate(
      (element) => element.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).resolves.toBe(true);

  const roleSection = screen.getByTestId("role-permission-hub-roles");
  await roleSection.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/roleSettings=roles/);
  await screen.getByRole("button", { name: "새 커스텀 역할" }).click();
  const roleDialog = page.getByRole("dialog", { name: "새 커스텀 역할" });
  await expect(roleDialog).toBeVisible();
  await roleDialog.getByRole("button", { name: "역할 저장" }).click();
  await expect(roleDialog.getByRole("alert")).toContainText(
    "커스텀 역할 이름을 입력하세요.",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "새 커스텀 역할" }),
  ).toHaveCount(0);

  await screen
    .getByRole("button", { name: "역할 및 권한", exact: true })
    .click();
  const positionSection = screen.getByTestId("role-permission-hub-positions");
  await positionSection.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/roleSettings=positions/);
  await expect(
    screen.getByRole("heading", { name: "직무", exact: true }),
  ).toBeVisible();
  await expect(
    screen.getByRole("button", { name: /병원장 시스템 직무/ }),
  ).toHaveCount(0);
  await expect(screen.getByText("병원장", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(screen.getByTestId("role-permission-hub-roles")).toBeVisible();
});

test("hospital admin order table uses shared header and cell text primitives", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const workspace = page.getByTestId("hospital-admin-order-content");
  const table = page
    .getByTestId("hospital-order-table")
    .getByRole("table", { name: "병원관리 개별 Order 테이블" });
  const headers = table.locator("thead th");
  const identityHeader = headers.filter({ hasText: "표준 Order명" });

  await expect(workspace).toHaveAttribute(
    "data-emr-pinned-table-workspace",
    "true",
  );
  await expect(table).toHaveAttribute("data-emr-pinning", "columns");
  await expect(headers.nth(0)).toHaveAttribute(
    "data-emr-header-interaction",
    "static",
  );
  await expect(headers.nth(0)).toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(headers.nth(0)).toHaveAttribute(
    "data-emr-column-resize",
    "none",
  );
  await expect(headers.nth(1)).toContainText("표준 Order명");
  await expect(table.locator('[data-column-id="type"]')).not.toHaveCount(0);
  await expect(table.locator('[data-column-id^="dispensing"]')).toHaveCount(0);
  await expect(headers.nth(1)).toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(identityHeader).toHaveAttribute(
    "data-emr-header-interaction",
    "sortable",
  );
  await expect(identityHeader).toHaveAttribute(
    "data-emr-column-resize",
    "data-column",
  );
  const identityResizeGrip = identityHeader.getByRole("button", {
    name: "표준 Order명 컬럼 너비 조절",
  });
  await expect(identityResizeGrip).toBeVisible();
  await expect
    .poll(() =>
      identityResizeGrip.evaluate(
        (element) => getComputedStyle(element, "::before").opacity,
      ),
    )
    .toBe("0");
  await expect
    .poll(() =>
      identityResizeGrip.evaluate(
        (element) => getComputedStyle(element).cursor,
      ),
    )
    .toBe("col-resize");

  const identityHeaderBox = await identityHeader.boundingBox();
  const identityResizeGripBox = await identityResizeGrip.boundingBox();

  expect(identityHeaderBox).not.toBeNull();
  expect(identityResizeGripBox).not.toBeNull();
  await page.mouse.move(
    identityResizeGripBox!.x + identityResizeGripBox!.width / 2,
    identityResizeGripBox!.y + identityResizeGripBox!.height / 2,
  );
  await page.mouse.down();
  try {
    await page.mouse.move(
      identityResizeGripBox!.x + identityResizeGripBox!.width / 2 + 32,
      identityResizeGripBox!.y + identityResizeGripBox!.height / 2,
      { steps: 4 },
    );
    await expect
      .poll(async () => (await identityHeader.boundingBox())?.width)
      .toBeGreaterThan(identityHeaderBox!.width + 24);
  } finally {
    await page.mouse.up();
  }
  await expect(headers.filter({ hasText: "사용여부" })).toHaveAttribute(
    "data-emr-header-interaction",
    "static",
  );
  await expect(headers.filter({ hasText: "작업" })).toHaveAttribute(
    "data-emr-column-resize",
    "none",
  );

  const inHospitalNameHeader = table.locator(
    'th[data-column-id="inHospitalName"]',
  );
  const inHospitalNameResizeGrip = inHospitalNameHeader.getByRole("button", {
    name: "원내 Order명 컬럼 너비 조절",
  });
  await expect
    .poll(() =>
      inHospitalNameResizeGrip.evaluate(
        (element) => getComputedStyle(element, "::before").opacity,
      ),
    )
    .toBe("1");
  const inHospitalNameHeaderBox = await inHospitalNameHeader.boundingBox();
  const inHospitalNameResizeGripBox =
    await inHospitalNameResizeGrip.boundingBox();

  expect(inHospitalNameHeaderBox).not.toBeNull();
  expect(inHospitalNameResizeGripBox).not.toBeNull();
  await page.mouse.move(
    inHospitalNameResizeGripBox!.x + inHospitalNameResizeGripBox!.width / 2,
    inHospitalNameResizeGripBox!.y + inHospitalNameResizeGripBox!.height / 2,
  );
  await page.mouse.down();
  try {
    await page.mouse.move(
      inHospitalNameResizeGripBox!.x +
        inHospitalNameResizeGripBox!.width / 2 +
        32,
      inHospitalNameResizeGripBox!.y + inHospitalNameResizeGripBox!.height / 2,
      { steps: 4 },
    );
    await expect
      .poll(async () => (await inHospitalNameHeader.boundingBox())?.width)
      .toBeGreaterThan(inHospitalNameHeaderBox!.width + 24);
  } finally {
    await page.mouse.up();
  }

  await expect(
    page.getByTestId("hospital-order-catalog-read-status"),
  ).toContainText("Workspace catalog 기준");
  const row = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  const identityCell = row.locator('[data-column-id="standardName"]');
  const selectAllOrderBox = await table
    .getByRole("checkbox", { name: "보이는 오더 전체 선택" })
    .boundingBox();
  const firstOrderCheckboxBox = await row
    .getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" })
    .boundingBox();

  expect(selectAllOrderBox).not.toBeNull();
  expect(firstOrderCheckboxBox).not.toBeNull();
  expect(
    Math.abs(
      selectAllOrderBox!.x +
        selectAllOrderBox!.width / 2 -
        (firstOrderCheckboxBox!.x + firstOrderCheckboxBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);
  await expect(
    row
      .locator('[data-emr-cell-text-mode="two-line-if-long"]')
      .filter({ hasText: "[CBC 검사] #BASO" })
      .first(),
  ).toBeVisible();
  await expect(
    row
      .locator('[data-emr-cell-text-mode="one-line"]')
      .filter({ hasText: "사용" }),
  ).toBeVisible();
  await expect(
    row
      .locator('[data-emr-cell-text-mode="one-line"]')
      .filter({ hasText: "12,000원" }),
  ).toBeVisible();

  const alignment = await workspace.evaluate((element) => {
    const title = element.querySelector("h1");
    const headerText = element.querySelector(
      'thead [data-emr-table-identity-text="true"]',
    );
    const rowText = element.querySelector(
      'tbody [data-emr-table-identity-text="true"]',
    );
    const tableContainer = element.querySelector(
      '[data-slot="table-container"]',
    ) as HTMLElement | null;
    const tableRegion = tableContainer?.closest(
      '[data-emr-pinned-table-viewport="true"]',
    );
    const scrollOwner = tableRegion?.querySelector(
      '[data-emr-pinned-table-scroll-owner="true"]',
    );
    const horizontalOwners = Array.from(
      tableRegion?.querySelectorAll<HTMLElement>("*") ?? [],
    ).filter((candidate) => {
      const overflowX = getComputedStyle(candidate).overflowX;
      return overflowX === "auto" || overflowX === "scroll";
    });

    if (
      !title ||
      !headerText ||
      !rowText ||
      !tableContainer ||
      !tableRegion ||
      !scrollOwner
    ) {
      throw new Error("Order identity alignment targets are missing.");
    }

    return {
      headerLeft: headerText.getBoundingClientRect().left,
      ownerCount: horizontalOwners.length,
      ownerIsScrollViewport:
        horizontalOwners.length === 1 && horizontalOwners[0] === scrollOwner,
      rowLeft: rowText.getBoundingClientRect().left,
      titleLeft: title.getBoundingClientRect().left,
    };
  });
  expect(
    Math.abs(alignment.titleLeft - alignment.headerLeft),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(alignment.headerLeft - alignment.rowLeft),
  ).toBeLessThanOrEqual(1);
  expect(alignment.ownerCount).toBe(1);
  expect(alignment.ownerIsScrollViewport).toBe(true);
  await expect(
    workspace.locator('[data-emr-table-workspace-header="true"]'),
  ).toHaveCSS("padding-top", "0px");

  const scrollContainer = table.locator(
    "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']/*[@data-emr-pinned-table-scroll-owner='true']",
  );
  const initialPinnedLeft = (await identityCell.boundingBox())?.x;
  const initialSelectionLeft = firstOrderCheckboxBox?.x;
  await scrollContainer.evaluate((element) => {
    element.scrollLeft = 220;
  });
  await page.waitForTimeout(50);
  const scrolledPinnedLeft = (await identityCell.boundingBox())?.x;
  const scrolledSelectionLeft = (
    await row
      .getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" })
      .boundingBox()
  )?.x;
  expect(initialPinnedLeft).toBeDefined();
  expect(scrolledPinnedLeft).toBeDefined();
  expect(
    Math.abs(initialPinnedLeft! - scrolledPinnedLeft!),
  ).toBeLessThanOrEqual(1);
  expect(initialSelectionLeft).toBeDefined();
  expect(scrolledSelectionLeft).toBeDefined();
  expect(
    Math.abs(initialSelectionLeft! - scrolledSelectionLeft!),
  ).toBeLessThanOrEqual(1);

  await row.getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" }).click();
  await expect(identityCell).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
});

test("hospital admin Order table keeps long leaf rows vertically scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      const response = await route.fetch();
      const body = (await response.json()) as {
        items: Array<Record<string, unknown>>;
        ok: true;
      };
      const labSeed = body.items.find((item) => item.id === "ord-lab-cbc-baso");

      if (!labSeed) {
        throw new Error("Order table scroll fixture seed is missing.");
      }

      const items = Array.from({ length: 30 }, (_, index) => ({
        ...labSeed,
        billingName: `스크롤 검사 ${index + 1}`,
        id: `ord-lab-scroll-${index + 1}`,
        inHospitalOrderName: `스크롤 검사 ${index + 1}`,
        standardOrderId: `std-ord-lab-scroll-${index + 1}`,
        standardOrderName: `스크롤 검사 ${index + 1}`,
      }));

      await route.fulfill({
        response,
        json: { ...body, items },
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const table = page.getByTestId("hospital-order-table");
  const scrollOwner = table.locator(
    '[data-emr-pinned-table-scroll-owner="true"]',
  );
  await expect(
    table.locator('[data-testid^="hospital-order-row-"]'),
  ).toHaveCount(30);

  const initialMetrics = await scrollOwner.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  expect(initialMetrics.scrollHeight).toBeGreaterThan(
    initialMetrics.clientHeight,
  );
  expect(initialMetrics.scrollTop).toBe(0);

  await scrollOwner.hover();
  await page.mouse.wheel(0, 480);
  await expect
    .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
});

test("hospital admin Order table keeps the shared pinned boundary fixed over the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const table = page
    .getByTestId("hospital-order-table")
    .getByRole("table", { name: "병원관리 개별 Order 테이블" });
  const tableContainer = table.locator("xpath=..");
  const tableViewport = tableContainer.locator(
    "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']",
  );
  const scrollContainer = tableViewport.locator(
    '[data-emr-pinned-table-scroll-owner="true"]',
  );
  await expect(tableViewport).toHaveAttribute(
    "data-emr-pinned-table-viewport",
    "true",
  );
  await expect(
    page.locator('[data-emr-order-table-viewport="true"]'),
  ).toHaveCount(0);
  const pinnedDimmer = tableViewport.locator(
    '[data-emr-pinned-table-dimmer="true"]',
  );
  const pinnedDivider = tableViewport.locator(
    '[data-emr-pinned-table-divider="true"]',
  );
  await expect(pinnedDimmer).toHaveCount(1);
  await expect(pinnedDivider).toHaveCount(1);
  await expect(tableViewport).not.toHaveAttribute("data-overflow-x-start");
  await expect(tableViewport).toHaveAttribute("data-overflow-x-end");
  await expect(pinnedDimmer).toHaveCSS("opacity", "0");
  const firstOrderRow = table
    .locator('tbody tr[data-emr-data-table-row="true"]')
    .first();
  const firstPinnedOrderCell = firstOrderRow.locator(
    'td[data-emr-column-pinned="left"][data-emr-pinned-edge="true"]',
  );
  const firstScrollingOrderCell = firstOrderRow.locator(
    'td[data-emr-column-pinned="left"][data-emr-pinned-edge="true"] + td',
  );
  await expect(firstPinnedOrderCell).toHaveCSS("border-bottom-width", "1px");
  await expect(firstPinnedOrderCell).toHaveCSS(
    "border-bottom-color",
    "rgb(229, 229, 229)",
  );
  await expect(firstScrollingOrderCell).toHaveCSS("border-bottom-width", "1px");
  await expect(firstScrollingOrderCell).toHaveCSS(
    "border-bottom-color",
    "rgb(229, 229, 229)",
  );
  const metrics = await tableViewport.evaluate((element) => {
    const tableContainerElement = element.querySelector(
      '[data-slot="table-container"]',
    );
    const tableElement = tableContainerElement?.querySelector("table");
    const pinnedCell = tableElement?.querySelector(
      'tbody [data-emr-column-pinned="left"]',
    );
    const dimmer = element.querySelector(
      '[data-emr-pinned-table-dimmer="true"]',
    );
    const divider = element.querySelector(
      '[data-emr-pinned-table-divider="true"]',
    );
    const containerStyle = tableContainerElement
      ? getComputedStyle(tableContainerElement)
      : null;

    if (
      !tableContainerElement ||
      !tableElement ||
      !pinnedCell ||
      !(dimmer instanceof HTMLElement) ||
      !(divider instanceof HTMLElement) ||
      !containerStyle
    ) {
      throw new Error("Order table geometry targets are missing.");
    }

    const viewportRect = element.getBoundingClientRect();
    const dimmerRect = dimmer.getBoundingClientRect();
    const dividerRect = divider.getBoundingClientRect();
    const dimmerStyle = getComputedStyle(dimmer);
    const dividerStyle = getComputedStyle(divider);

    return {
      containerHeight: viewportRect.height,
      tableHeight: tableElement.getBoundingClientRect().height,
      pinnedBackground: getComputedStyle(pinnedCell).backgroundColor,
      scrollBackground: containerStyle.backgroundColor,
      backgroundImage: containerStyle.backgroundImage,
      pinnedDivider: {
        position: dividerStyle.position,
        left: dividerStyle.left,
        width: dividerStyle.width,
        height: dividerRect.height,
        leftOffset: dividerRect.left - viewportRect.left,
        backgroundColor: dividerStyle.backgroundColor,
        pointerEvents: dividerStyle.pointerEvents,
        zIndex: Number.parseInt(dividerStyle.zIndex, 10),
      },
      pinnedDimmer: {
        position: dimmerStyle.position,
        left: dimmerStyle.left,
        width: dimmerStyle.width,
        height: dimmerRect.height,
        leftOffset: dimmerRect.left - viewportRect.left,
        backgroundColor: dimmerStyle.backgroundColor,
        boxShadow: dimmerStyle.boxShadow,
        opacity: dimmerStyle.opacity,
        pointerEvents: dimmerStyle.pointerEvents,
        zIndex: Number.parseInt(dimmerStyle.zIndex, 10),
      },
      pinnedColumnWidth: getComputedStyle(element).getPropertyValue(
        "--emr-table-pinned-column-width",
      ),
    };
  });

  expect(metrics.containerHeight).toBeGreaterThanOrEqual(metrics.tableHeight);
  expect(metrics.pinnedBackground).toBe("rgb(255, 255, 255)");
  expect(metrics.scrollBackground).toBe("rgb(252, 252, 252)");
  expect(metrics.backgroundImage).toContain("rgb(255, 255, 255)");
  expect(metrics.backgroundImage).toContain("rgb(252, 252, 252)");
  expect(metrics.pinnedDivider).toMatchObject({
    position: "absolute",
    left: "223px",
    width: "1px",
    leftOffset: 223,
    pointerEvents: "none",
    backgroundColor: "rgb(229, 229, 229)",
  });
  expect(
    Math.abs(metrics.pinnedDivider.height - metrics.containerHeight),
  ).toBeLessThanOrEqual(0.5);
  expect(metrics.pinnedDimmer).toMatchObject({
    position: "absolute",
    left: "224px",
    width: "6px",
    leftOffset: 224,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    boxShadow: "none",
    opacity: "0",
    pointerEvents: "none",
  });
  expect(
    Math.abs(metrics.pinnedDimmer.height - metrics.containerHeight),
  ).toBeLessThanOrEqual(0.5);
  expect(metrics.pinnedDimmer.zIndex).toBeGreaterThan(12);
  expect(metrics.pinnedDivider.zIndex).toBeGreaterThan(
    metrics.pinnedDimmer.zIndex,
  );
  expect(metrics.pinnedColumnWidth.trim()).toBe("224px");

  const scrollMetrics = await scrollContainer.evaluate((element) => {
    const pinnedCell = element.querySelector(
      'tbody [data-emr-column-pinned="left"]',
    );
    const viewport = element.closest('[data-emr-pinned-table-viewport="true"]');
    const dimmer = viewport?.querySelector(
      '[data-emr-pinned-table-dimmer="true"]',
    );
    const divider = viewport?.querySelector(
      '[data-emr-pinned-table-divider="true"]',
    );

    if (!pinnedCell || !viewport || !dimmer || !divider) {
      throw new Error("Order table scroll targets are missing.");
    }

    const pinnedLeftBefore = pinnedCell.getBoundingClientRect().left;
    const dimmerLeftBefore = dimmer.getBoundingClientRect().left;
    const dividerLeftBefore = divider.getBoundingClientRect().left;
    element.scrollLeft = element.scrollWidth;

    return {
      scrollOwnerScrollLeft: element.scrollLeft,
      rootScrollLeft: viewport.scrollLeft,
      pinnedLeftBefore,
      pinnedLeftAfter: pinnedCell.getBoundingClientRect().left,
      dimmerLeftBefore,
      dimmerLeftAfter: dimmer.getBoundingClientRect().left,
      dividerLeftBefore,
      dividerLeftAfter: divider.getBoundingClientRect().left,
    };
  });

  expect(scrollMetrics.scrollOwnerScrollLeft).toBeGreaterThan(0);
  expect(scrollMetrics.rootScrollLeft).toBe(0);
  await expect(tableViewport).toHaveAttribute("data-overflow-x-start");
  await expect(tableViewport).not.toHaveAttribute("data-overflow-x-end");
  await expect(pinnedDimmer).toHaveCSS("opacity", "1");
  expect(
    Math.abs(scrollMetrics.pinnedLeftAfter - scrollMetrics.pinnedLeftBefore),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(scrollMetrics.dimmerLeftAfter - scrollMetrics.dimmerLeftBefore),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(scrollMetrics.dividerLeftAfter - scrollMetrics.dividerLeftBefore),
  ).toBeLessThanOrEqual(0.5);
});

test("all hospital admin Order leaves use the pinned standard Order identity table", async ({
  page,
}) => {
  const orderLeaves = [
    { hasRows: false, label: "기본 진료비" },
    { hasRows: false, label: "기타 진료비" },
    { hasRows: true, label: "예방" },
    { hasRows: false, label: "영상검사" },
    { hasRows: true, label: "임상병리 검사" },
    { hasRows: false, label: "계통 검사" },
    { hasRows: false, label: "의뢰 검사" },
    { hasRows: false, label: "처치" },
    { hasRows: false, label: "마취" },
    { hasRows: false, label: "수술" },
    { hasRows: false, label: "입원" },
    { hasRows: false, label: "치료" },
    { hasRows: true, label: "처방" },
    { hasRows: false, label: "조제" },
    { hasRows: false, label: "의료물품" },
  ];

  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  for (const { hasRows, label } of orderLeaves) {
    await sidePanel
      .getByRole("button", { name: new RegExp(`^${label}(?:\\s|$)`) })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: label, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("hospital-admin-order-content"),
    ).toHaveAttribute("data-emr-pinned-table-workspace", "true");
    const orderHeader = page.getByTestId("hospital-order-page-header");
    await expect(orderHeader).toHaveAttribute(
      "data-emr-table-workspace-header",
      "true",
    );
    await expect(
      orderHeader.getByRole("textbox", { name: "오더 검색" }),
    ).toBeVisible();
    await expect(
      orderHeader.getByRole("button", { name: "오더 필터 설정" }),
    ).toBeVisible();
    await expect(
      orderHeader.getByRole("button", {
        name: "테이블 보기 밀도: 기본 간격",
      }),
    ).toBeVisible();
    await expect(
      orderHeader.getByRole("button", {
        name: `${label} 컬럼 표시 설정`,
      }),
    ).toBeVisible();
    await expect(
      orderHeader.getByRole("button", { name: "+ Order" }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: `${label} 하위 타입` }),
    ).toHaveCount(0);
    if (!hasRows) {
      await expect(
        page.getByTestId("hospital-order-empty-state"),
      ).toBeVisible();
      await expect(page.getByTestId("hospital-order-table")).toHaveCount(0);
      continue;
    }
    const orderTable = page
      .getByTestId("hospital-order-table")
      .getByRole("table", { name: "병원관리 개별 Order 테이블" });
    await expect(orderTable).toHaveAttribute("data-emr-pinning", "columns");
    const orderScrollOwner = orderTable.locator(
      "xpath=ancestor::*[@data-emr-pinned-table-viewport='true']/*[@data-emr-pinned-table-scroll-owner='true']",
    );
    await expect(orderScrollOwner).toHaveCSS("overscroll-behavior-x", "none");
    await expect(orderScrollOwner).toHaveCSS("overscroll-behavior-y", "none");
    await expect(
      orderTable
        .locator("thead th")
        .first()
        .getByRole("checkbox", { name: "보이는 오더 전체 선택" }),
    ).toBeVisible();
    await expect(orderTable.locator("thead th").nth(1)).toContainText(
      "표준 Order명",
    );
  }
});

test("hospital admin table pages keep the adaptive main-content header and zero header-row gap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const orderContent = page.getByTestId("hospital-admin-order-content");
  const orderRow = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  await expect(orderContent).toBeVisible();
  await expect(orderRow).toBeVisible();

  const orderMetrics = await orderContent.evaluate((root) => {
    const slot = root.querySelector(
      '[data-slot="emr-main-content-header"]',
    ) as HTMLElement;
    const titleSection = slot.nextElementSibling as HTMLElement;
    const headerRow = root.querySelector("thead tr") as HTMLElement;
    const firstRow = root.querySelector(
      '[data-testid="hospital-order-row-ord-lab-cbc-baso"]',
    ) as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const headerRect = headerRow.getBoundingClientRect();

    return {
      background: getComputedStyle(root).backgroundColor,
      slotHeight: slotRect.height,
      titleOffset: titleSection.getBoundingClientRect().top - rootRect.top,
      headerRowGap: firstRow.getBoundingClientRect().top - headerRect.bottom,
    };
  });

  expect(orderMetrics).toMatchObject({
    background: "rgb(252, 252, 252)",
    slotHeight: 56,
    titleOffset: 56,
  });
  expect(Math.abs(orderMetrics.headerRowGap)).toBeLessThanOrEqual(0.5);

  await page.getByTestId("hospital-admin-menu-audit").click();

  const auditContent = page.getByTestId("hospital-admin-audit-review");
  const auditRow = auditContent
    .locator('[data-testid^="audit-review-row-"]')
    .first();
  await expect(auditContent).toBeVisible();
  await expect(auditRow).toBeVisible();

  const auditMetrics = await auditContent.evaluate((root) => {
    const slot = root.querySelector(
      '[data-slot="emr-main-content-header"]',
    ) as HTMLElement;
    const titleSection = slot.nextElementSibling as HTMLElement;
    const headerRow = root.querySelector("thead tr") as HTMLElement;
    const firstRow = root.querySelector(
      '[data-testid^="audit-review-row-"]',
    ) as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const headerRect = headerRow.getBoundingClientRect();
    return {
      background: getComputedStyle(root).backgroundColor,
      slotHeight: slotRect.height,
      titleOffset: titleSection.getBoundingClientRect().top - rootRect.top,
      headerRowGap: firstRow.getBoundingClientRect().top - headerRect.bottom,
    };
  });

  expect(auditMetrics).toMatchObject({
    background: "rgb(252, 252, 252)",
    slotHeight: 56,
    titleOffset: 56,
  });
  expect(Math.abs(auditMetrics.headerRowGap)).toBeLessThanOrEqual(0.5);
});

test("hospital audit table owns one fill viewport without an outer scroll area", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-audit").click();

  const auditContent = page.getByTestId("hospital-admin-audit-review");
  const auditTable = auditContent.getByRole("table", { name: "감사 로그" });
  const dataTableRoot = auditTable.locator(
    "xpath=ancestor::*[@data-emr-data-table='true']",
  );

  await expect(dataTableRoot).toBeVisible();
  await expect(dataTableRoot).toHaveAttribute(
    "data-emr-data-table-viewport-mode",
    "fill",
  );
  await expect(
    dataTableRoot.locator("xpath=ancestor::*[@data-slot='scroll-area']"),
  ).toHaveCount(0);

  const metrics = await dataTableRoot.evaluate((root) => {
    const parent = root.parentElement as HTMLElement;
    const horizontalOwners = Array.from(
      root.querySelectorAll<HTMLElement>("*"),
    ).filter((candidate) => {
      const overflowX = getComputedStyle(candidate).overflowX;
      return overflowX === "auto" || overflowX === "scroll";
    });

    return {
      bottomGap:
        parent.getBoundingClientRect().bottom -
        root.getBoundingClientRect().bottom,
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      horizontalOwnerCount: horizontalOwners.length,
      horizontalOwnerSlot: horizontalOwners[0]?.getAttribute("data-slot"),
    };
  });

  expect(metrics.horizontalOwnerCount).toBe(1);
  expect(metrics.horizontalOwnerSlot).toBe("table-container");
  expect(Math.abs(metrics.bottomGap)).toBeLessThanOrEqual(1);
  expect(metrics.documentOverflow).toBe(0);
});

test("hospital admin order drawer edits and saves a selected order", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByRole("button", { name: /처방/ }).click();
  await page.getByTestId("hospital-order-row-ord-med-maropitant").click();

  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(drawer).toContainText("Maropitant 16mg T");

  await drawer
    .getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요")
    .fill("Maropitant 변경");
  await drawer.getByRole("switch", { name: /오더 사용여부/ }).click();
  await drawer.getByRole("button", { name: "저장" }).click();
  await page.getByRole("button", { name: "저장" }).last().click();

  await expect(
    page.getByTestId("hospital-order-mutation-status"),
  ).toContainText("저장했습니다");
  await expect(
    drawer.getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요"),
  ).toHaveValue("Maropitant 변경");
  await drawer.getByRole("button", { name: "상세 닫기" }).click();
  await expect(
    page.getByTestId("hospital-order-row-ord-med-maropitant"),
  ).toContainText("Maropitant 변경");
  await expect(
    page.getByTestId("hospital-order-row-ord-med-maropitant"),
  ).toContainText("중지");
});

test("hospital admin order drawer use-stop keeps the order row after confirmation", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-order-row-ord-lab-cbc-baso").click();

  await expect(page.getByTestId("hospital-order-drawer")).toContainText(
    "[CBC 검사] #BASO",
  );
  await page.getByRole("button", { name: "사용 중지" }).click();
  await page.getByRole("button", { name: "사용 중지" }).last().click();

  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(0);
  await expect(
    page.getByTestId("hospital-order-row-ord-lab-cbc-baso"),
  ).toContainText("중지");
});

test("hospital admin order drawer creates a new workspace catalog order", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await expect(
    page.getByTestId("hospital-order-catalog-read-status"),
  ).toContainText("Workspace catalog 기준");
  await expect(
    page.getByTestId("hospital-order-row-ord-lab-cbc-baso"),
  ).toBeVisible();

  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(
    drawer.getByRole("heading", { name: "임상병리 오더 추가" }),
  ).toBeVisible();
  await expect(drawer.getByRole("button", { name: "저장" })).toBeDisabled();
  await drawer
    .getByPlaceholder("표준 Order명을 입력해 주세요")
    .fill("원내 신규 CBC");
  await drawer
    .getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요")
    .fill("원내 신규 CBC");
  await drawer
    .getByPlaceholder("청구서에 표시할 이름을 입력해 주세요")
    .fill("원내 신규 CBC 청구");
  await drawer.getByLabel("판매 금액").fill("22000");
  await expect(drawer.getByRole("button", { name: "저장" })).toBeEnabled();
  await drawer.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "차트의 Order 추가 검색 후보로 표시됩니다",
  );
  await page.getByRole("button", { name: "등록" }).click();

  await expect(
    page.getByTestId("hospital-order-mutation-status"),
  ).toContainText("등록했습니다");
  await expect(
    page
      .getByTestId("hospital-order-drawer")
      .getByRole("heading", { name: "원내 신규 CBC" }),
  ).toBeVisible();
  await expect(page.getByText("원내 신규 CBC").first()).toBeVisible();
  const createdRow = page
    .locator('[data-testid^="hospital-order-row-"]')
    .filter({ hasText: "원내 신규 CBC" })
    .first();
  await expect(createdRow).toHaveAttribute("data-detail-active", "true");
  await expect(createdRow).toHaveAttribute("data-state", "selected");
  await expect(createdRow).toHaveAttribute("aria-current", "true");
  await expect(
    createdRow.getByRole("checkbox", { name: "원내 신규 CBC 선택" }),
  ).not.toBeChecked();
  await expect(page.getByText(/선택한 오더 \d+개/)).toHaveCount(0);
});

test("hospital admin creates a workspace dispensing preset with defaults and pending veterinarian review", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByRole("button", { name: /처방/ }).click();
  await page.getByRole("button", { name: "+ Order", exact: true }).click();

  const createDialog = page.getByRole("dialog", { name: "조제 오더 추가" });
  await expect(createDialog).toContainText("마스터에서 추가");
  await createDialog
    .getByRole("button", { name: /새 조제 오더 만들기/ })
    .click();

  const drawer = page.getByTestId("hospital-order-drawer");
  await expect(drawer.getByText("기본 처방값", { exact: true })).toBeVisible();
  await expect(drawer.getByLabel("1회 용량")).toHaveValue("1");
  await expect(
    drawer.getByRole("combobox", { name: "투여 빈도" }),
  ).toContainText("하루 2회");
  await expect(drawer.getByLabel("투여 일수")).toHaveValue("5");
  await expect(drawer.getByLabel("처방 총량")).toHaveValue("10");

  await drawer
    .getByPlaceholder("표준 Order명을 입력해 주세요")
    .fill("원내 위장관 조제정");
  await drawer
    .getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요")
    .fill("원내 위장관 조제정");
  await drawer
    .getByPlaceholder("청구서에 표시할 이름을 입력해 주세요")
    .fill("위장관 조제 처방");
  await drawer.getByLabel("성분 또는 조제 내용").fill("Famotidine 조제정");
  await drawer.getByLabel("판매 금액").fill("1650");
  await drawer.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "수의사 승인 전에는 차트 검색에 표시되지 않습니다",
  );
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/hospital-admin/order-catalog"),
  );
  await page.getByRole("button", { name: "등록" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBe(true);
  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(1);
  const persistedDrawer = page.getByTestId("hospital-order-drawer");
  await expect(
    persistedDrawer.getByText("검토 대기", { exact: true }),
  ).toBeVisible();
  await expect(
    persistedDrawer.getByRole("button", { name: "수의사 승인" }),
  ).toBeDisabled();
  await expect(
    persistedDrawer.getByRole("combobox", { name: "가격 방식" }),
  ).toContainText("수량 연동");
  await expect(persistedDrawer.getByLabel("판매 금액")).toHaveValue("1650");
  await expect(persistedDrawer).toContainText("10tablet × 1,650원 = 16,500원");
});

test("hospital admin table selection drives bulk action instead of opening drawer", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const row = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  await row.getByRole("checkbox", { name: "[CBC 검사] #BASO 선택" }).click();
  await expect(row).toHaveAttribute("data-state", "selected");
  await expect(row).not.toHaveAttribute("data-detail-active", "true");
  await expect(
    row.locator(
      'td[data-column-id="actions"] > .emr-data-table-cell-content > *',
    ),
  ).toHaveCSS("opacity", "1");
  await expect(page.getByText("선택한 오더 1개")).toBeVisible();

  await row.click({ position: { x: 180, y: 20 } });
  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(0);

  await page.getByRole("button", { name: "선택 해제" }).click();
  await expect(page.getByText("선택한 오더 1개")).toBeHidden();
});

test("hospital admin order drawer switches rows and closes from outside click", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-order-row-ord-lab-cbc-baso").click();
  const firstRow = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  await expect(firstRow).toHaveAttribute("data-state", "selected");
  await expect(firstRow).toHaveAttribute("aria-current", "true");
  await expect(firstRow.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByText(/선택한 오더 \d+개/)).toHaveCount(0);
  await expect(page.getByTestId("hospital-order-drawer")).toContainText(
    "[CBC 검사] #BASO",
  );

  await page
    .getByTestId("hospital-order-row-ord-paused-example")
    .click({ position: { x: 180, y: 20 } });
  await expect(page.getByTestId("hospital-order-drawer").last()).toContainText(
    "일시중지 예시",
  );
  await expect(
    page.getByTestId("hospital-order-row-ord-paused-example"),
  ).toHaveAttribute("data-state", "selected");
  await expect(firstRow).not.toHaveAttribute("data-state", "selected");

  const selectedRow = page.getByTestId("hospital-order-row-ord-paused-example");
  const selectedSurface = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.background =
      "linear-gradient(var(--emr-state-selected), var(--emr-state-selected)), var(--clair-color-atomic-common-100)";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const background = {
      color: style.backgroundColor,
      image: style.backgroundImage,
    };
    probe.remove();
    return background;
  });
  for (const target of [
    selectedRow,
    selectedRow.locator('td[data-column-id="standardName"]'),
  ]) {
    await expect(target).toHaveCSS("background-color", selectedSurface.color);
    await expect(target).toHaveCSS("background-image", selectedSurface.image);
  }

  await page
    .getByRole("heading", { level: 1, name: "임상병리 검사" })
    .click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId("hospital-order-drawer")).toHaveCount(0);
  await expect(selectedRow).not.toHaveAttribute("data-state", "selected");
  await expect(selectedRow).not.toHaveAttribute("aria-current", "true");
});

test("hospital admin order table shows skeleton rows while loading catalog", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() === "GET") {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const skeletonRow = page
    .locator('[data-emr-data-table-skeleton-row="true"]')
    .first();
  await expect(skeletonRow).toBeVisible();
  await expect(skeletonRow.locator("td").first()).toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(skeletonRow.locator("td").nth(1)).toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(
    skeletonRow
      .locator("td")
      .nth(1)
      .locator('[data-emr-table-identity-content="true"]'),
  ).toHaveCount(1);
  await expect(
    page.getByTestId("hospital-order-catalog-read-status"),
  ).toContainText("Workspace catalog 기준");
});

test("hospital admin Order no-data uses the shared empty state and create CTA", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, items: [] }),
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const emptyState = page.getByTestId("hospital-order-empty-state");
  await expect(emptyState).toHaveAttribute("data-kind", "no-data");
  await expect(emptyState).toContainText("등록된 Order가 없습니다");
  await expect(page.getByTestId("hospital-order-table")).toHaveCount(0);
  await emptyState
    .getByRole("button", { name: "+ Order", exact: true })
    .click();
  await expect(page.getByTestId("hospital-order-drawer")).toBeVisible();
});

test("hospital admin Order read error hides seed rows and retries the catalog", async ({
  page,
}) => {
  let readAttempts = 0;
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      readAttempts += 1;
      if (readAttempts === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "db_read_failed" }),
        });
        return;
      }

      await route.continue();
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const readError = page.getByTestId("hospital-order-read-error");
  await expect(readError).toHaveAttribute("data-kind", "read-error");
  await expect(page.getByTestId("hospital-order-table")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="hospital-order-row-"]'),
  ).toHaveCount(0);
  await readError.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByTestId("hospital-order-table")).toBeVisible();
  await expect(
    page.getByTestId("hospital-order-row-ord-lab-cbc-baso"),
  ).toBeVisible();
  expect(readAttempts).toBe(2);
});

test("hospital admin Order permission denial uses the no-permission state", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          denialReason: "permission_missing",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const denied = page.getByTestId("hospital-order-read-denied");
  await expect(denied).toHaveAttribute("data-kind", "no-permission");
  await expect(denied).toContainText("Order를 볼 권한이 없습니다");
  await expect(page.getByTestId("hospital-order-table")).toHaveCount(0);
});

test("hospital admin order drawer shows blocking progress dialog while saving", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByTestId("hospital-order-row-ord-lab-cbc-baso").click();
  const drawer = page.getByTestId("hospital-order-drawer");
  await drawer
    .getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요")
    .fill("[CBC 검사] #BASO 저장 모달");
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/order-catalog",
    async (route) => {
      if (route.request().method() === "PATCH") {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    },
  );

  await drawer.getByRole("button", { name: "저장" }).click();
  await page.getByRole("button", { name: "저장" }).last().click();

  await expect(page.getByTestId("hospital-order-saving-dialog")).toContainText(
    "Order 저장 중",
  );
  await expect(
    page.getByTestId("hospital-order-mutation-status"),
  ).toContainText("저장했습니다");
});

test("hospital admin order search filters the visible table", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByLabel("오더 검색").fill("BASO");
  await expect(
    page.getByTestId("hospital-order-row-ord-lab-cbc-baso"),
  ).toBeVisible();
  await expect(
    page.getByTestId("hospital-order-row-ord-paused-example"),
  ).toHaveCount(0);
});

test("hospital admin Order toolbar uses customer-style controls and working column visibility", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const header = page.getByTestId("hospital-order-page-header");
  const filterControl = header.getByRole("button", {
    name: "오더 필터 설정",
  });
  const densityControl = header.getByRole("button", {
    name: "테이블 보기 밀도: 기본 간격",
  });
  const columnControl = header.getByRole("button", {
    name: "임상병리 검사 컬럼 표시 설정",
  });
  const addControl = header.getByRole("button", { name: "+ Order" });

  await expect(
    header.getByRole("combobox", { name: "사용여부 필터" }),
  ).toHaveCount(0);
  await expect(header.getByRole("combobox", { name: "청구 필터" })).toHaveCount(
    0,
  );
  await expect(
    header.getByRole("combobox", { name: "업무유형 필터" }),
  ).toHaveCount(0);
  await expect(header.getByRole("button", { name: "복제" })).toHaveCount(0);

  const controlBoxes = await Promise.all(
    [filterControl, densityControl, columnControl, addControl].map((control) =>
      control.boundingBox(),
    ),
  );
  expect(controlBoxes.every((box) => box?.height === 32)).toBe(true);
  expect(controlBoxes.map((box) => box?.x)).toEqual(
    [...controlBoxes]
      .map((box) => box?.x)
      .sort((left, right) => Number(left) - Number(right)),
  );

  await columnControl.click();
  await expect(
    page.getByRole("menuitemcheckbox", { name: "표준 Order명" }),
  ).toBeDisabled();
  const targetColumnOption = page.getByRole("menuitemcheckbox", {
    name: "대상",
  });
  await expect(targetColumnOption).toBeChecked();
  await targetColumnOption.click();

  const table = page.getByTestId("hospital-order-table");
  await expect(table.locator('[data-column-id="target"]')).toHaveCount(0);

  await page.keyboard.press("Escape");
  await filterControl.click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await expect(page.getByRole("option", { name: "사용여부" })).toBeVisible();
  await expect(page.getByRole("option", { name: "청구" })).toBeVisible();
  await expect(page.getByRole("option", { name: "업무유형" })).toHaveCount(0);
});

test("hospital admin order table keeps the mg empty state contract for no matches", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByLabel("오더 검색").fill("없는 Order");

  const emptyState = page.getByTestId("hospital-order-empty-state");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-surface", "table");
  await expect(emptyState).toHaveAttribute("data-kind", "no-filter-results");
  await expect(emptyState).toContainText("조건에 맞는 Order가 없습니다");
  await expect(page.getByTestId("hospital-order-table")).toHaveCount(0);
  await emptyState.getByRole("button", { name: "조건 초기화" }).click();
  await expect(page.getByLabel("오더 검색")).toHaveValue("");
  await expect(page.getByTestId("hospital-order-table")).toBeVisible();
});

test("hospital member directory uses the mg table empty state for filtered results", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-menu-members").click();
  await page.getByPlaceholder("이름 또는 이메일 검색").fill("없는 구성원");

  const emptyState = page.getByTestId("hospital-members-empty-state-desktop");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-surface", "table");
  await expect(emptyState).toHaveAttribute("data-kind", "no-filter-results");
  await expect(emptyState).toContainText("조건에 맞는 구성원이 없습니다");
});

test("hospital admin order catalog supports single sort and section filter builder", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const table = page
    .getByTestId("hospital-order-table")
    .getByRole("table", { name: "병원관리 개별 Order 테이블" });
  const orderRows = table.locator('[data-testid^="hospital-order-row-"]');

  await table.getByRole("button", { name: /판매금액 오름차순 정렬/ }).click();
  await expect(orderRows.first()).toContainText("일시중지 예시");

  await table.getByRole("button", { name: /판매금액 내림차순 정렬/ }).click();
  await expect(orderRows.first()).toContainText("[CBC 검사] #BASO");

  await page.getByRole("button", { name: "오더 필터 설정" }).click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await expect(
    filterBuilder.getByRole("combobox", { name: "필터 필드" }),
  ).toHaveCount(1);
  await expect(page.getByRole("option", { name: "대상" })).toBeVisible();
  await page.getByRole("option", { name: "대상" }).click();
  await expect(
    page.getByRole("button", { name: "오더 필터 설정" }),
  ).toBeVisible();
  await expect(orderRows).toHaveCount(2);

  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "전체" }).click();
  await filterBuilder.getByRole("button", { name: "그룹 필터" }).click();
  await filterBuilder
    .getByRole("combobox", { name: "필터 필드" })
    .nth(1)
    .click();
  await page.getByRole("option", { name: "판매금액" }).click();
  await filterBuilder
    .getByRole("combobox", { name: "필터 조건" })
    .nth(1)
    .click();
  await page.getByRole("option", { name: "이하" }).click();
  await filterBuilder.getByRole("textbox", { name: "필터 값" }).fill("1000");

  await expect(
    page.getByRole("button", { name: "오더 필터 2개 설정" }),
  ).toBeVisible();
  await expect(orderRows).toHaveCount(1);
  await expect(orderRows.first()).toContainText("일시중지 예시");

  await filterBuilder.getByRole("button", { name: "초기화" }).click();
  await page.keyboard.press("Escape");

  await expect(
    page.getByRole("button", { name: "오더 필터 설정" }),
  ).toBeVisible();
  await expect(orderRows).toHaveCount(2);
});

test("hospital admin exposes 검사 카테고리 only for 임상병리 검사", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  await page.getByRole("button", { name: "오더 필터 설정" }).click();
  let filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await expect(
    page.getByRole("option", { name: "검사 카테고리" }),
  ).toBeVisible();
  await page
    .getByRole("option", { name: "검사 카테고리" })
    .click({ force: true });
  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await expect(page.getByRole("option", { name: "CBC검사" })).toBeVisible();
  await page.getByRole("option", { name: "CBC검사" }).click({ force: true });

  await expect(
    page.getByRole("button", { name: "오더 필터 1개 설정" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid^="hospital-order-row-"]'),
  ).toHaveCount(1);
  await expect(
    page.getByTestId("hospital-order-row-ord-lab-cbc-baso"),
  ).toBeVisible();

  await filterBuilder.getByRole("button", { name: "필터 닫기" }).click();
  const sidePanel = page.getByTestId("hospital-admin-side-panel");
  await sidePanel.getByRole("button", { name: /^처방(?:\s|$)/ }).click();
  await page.getByRole("button", { name: "오더 필터 설정" }).click();
  filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await filterBuilder.getByRole("combobox", { name: "필터 필드" }).click();
  await expect(page.getByRole("option", { name: "검사 카테고리" })).toHaveCount(
    0,
  );
});

test("hospital admin row action menu opens details and closes on Escape", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/orders?modulePanel=open");

  const row = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
  const actionCell = row.locator('td[data-column-id="actions"]');
  const actionSurface = actionCell.locator(
    "> .emr-data-table-cell-content > *",
  );
  const actionButton = row.getByRole("button", {
    name: "[CBC 검사] #BASO Order 행 작업",
  });

  await expect(actionCell).toHaveAttribute(
    "data-emr-table-action-visibility",
    "contextual",
  );
  await expect(actionSurface).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(actionSurface).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await actionButton.focus();
  await expect(actionSurface).toHaveCSS("opacity", "1");

  await actionButton.click();
  await expect(page.getByRole("menu")).toContainText("상세 보기");
  await page.mouse.move(0, 0);
  await expect(actionButton).toHaveAttribute("data-popup-open");
  await expect(actionSurface.first()).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await row
    .getByRole("button", { name: "[CBC 검사] #BASO Order 행 작업" })
    .click();
  await page.getByText("상세 보기", { exact: true }).click();
  await expect(page.getByTestId("hospital-order-drawer")).toContainText(
    "[CBC 검사] #BASO",
  );
  await expect(row).toHaveAttribute("data-state", "selected");
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(actionSurface).toHaveCSS("opacity", "1");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("hospital member row actions are contextual and preserve the active row", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/memberships?includeArchived=true",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          enforcedBy: "workspace-membership-status-reader",
          memberships: [
            {
              id: "membership-vet",
              workspaceId: "clair-demo",
              userSessionId: "user-vet",
              displayName: "이수지",
              email: "vet@clair.local",
              roles: ["vet"],
              permissionRoleKey: "general",
              jobPositionKey: "veterinarian",
              status: "active",
              title: "수의사",
              department: "진료팀",
              createdAt: "2026-05-01T00:00:00.000Z",
              activatedAt: "2026-05-01T00:00:00.000Z",
              deactivatedAt: null,
            },
          ],
          invitations: [],
        }),
      });
    },
  );
  await page.goto("/w/clair-demo/orders?modulePanel=open&section=members");

  const row = page.locator('[data-testid^="hospital-member-row-"]').first();
  const actionCell = row.locator('td[data-column-id="actions"]');
  const actionSurface = actionCell.locator(
    "> .emr-data-table-cell-content > *",
  );

  await expect(row).toBeVisible();
  await expect(actionCell).toHaveAttribute(
    "data-emr-table-action-visibility",
    "contextual",
  );
  await expect(actionSurface).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(actionSurface).toHaveCSS("opacity", "1");

  await row.click({ position: { x: 200, y: 20 } });
  await expect(page.getByTestId("hospital-member-profile-panel")).toBeVisible();
  await expect(row).toHaveAttribute("data-state", "selected");
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(actionSurface).toHaveCSS("opacity", "1");
});

test.describe("hospital admin contextual actions on touch", () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  test("keeps the order action visible without hover", async ({ page }) => {
    await page.goto("/w/clair-demo/orders?modulePanel=open");

    const row = page.getByTestId("hospital-order-row-ord-lab-cbc-baso");
    const actionSurface = row.locator(
      'td[data-column-id="actions"] > .emr-data-table-cell-content > *',
    );

    await expect(actionSurface).toHaveCSS("opacity", "1");
  });
});

test("hospital settings screens render dividers only between section rows", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/hospital-admin/settings/profile",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          profile: {
            workspaceId: "clair-demo",
            name: "테스트 동물병원",
            representativeName: "홍길동",
            address: "서울시 테스트구 123",
            countryCode: "KR",
            timezone: "Asia/Seoul",
            contact: {
              phone: "02-1111-2222",
              fax: "",
              homepage: "",
              instagram: "",
              customerGuideMemo: "",
            },
            logo: {
              hasCustomLogo: false,
              url: null,
            },
            revision: 1,
            profileComplete: true,
            pendingChangeRequest: null,
          },
        }),
      });
    },
  );

  const dividerDisplay = async (testId: string) =>
    page
      .getByTestId(testId)
      .locator('[data-slot="separator"]')
      .evaluate((separator) => window.getComputedStyle(separator).display);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/w/clair-demo/orders?modulePanel=open&section=settings");
  await expect(
    page.getByTestId("hospital-admin-settings-screen"),
  ).toBeVisible();

  expect(await dividerDisplay("hospital-settings-row-address")).toBe("block");
  expect(await dividerDisplay("hospital-settings-row-timezone")).toBe("block");
  expect(await dividerDisplay("hospital-settings-row-change-request")).toBe(
    "none",
  );
  expect(await dividerDisplay("hospital-settings-row-region")).toBe("none");

  await page.setViewportSize({ width: 390, height: 844 });

  expect(await dividerDisplay("hospital-settings-row-address")).toBe("block");
  expect(await dividerDisplay("hospital-settings-row-change-request")).toBe(
    "none",
  );
  expect(await dividerDisplay("hospital-settings-row-region")).toBe("none");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(
    "/w/clair-demo/orders?modulePanel=open&section=settings-contact",
  );
  await expect(
    page.getByTestId("hospital-admin-settings-contact-screen"),
  ).toBeVisible();

  expect(await dividerDisplay("hospital-settings-fax-row")).toBe("block");
  expect(
    await dividerDisplay("hospital-settings-row-customer-guide-memo"),
  ).toBe("block");
  expect(await dividerDisplay("hospital-settings-row-phone-change")).toBe(
    "none",
  );
  expect(await dividerDisplay("hospital-settings-homepage-row")).toBe("block");
  expect(await dividerDisplay("hospital-settings-instagram-row")).toBe("none");

  await page.setViewportSize({ width: 390, height: 844 });

  expect(await dividerDisplay("hospital-settings-row-phone-change")).toBe(
    "none",
  );
  expect(await dividerDisplay("hospital-settings-instagram-row")).toBe("none");
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
});
