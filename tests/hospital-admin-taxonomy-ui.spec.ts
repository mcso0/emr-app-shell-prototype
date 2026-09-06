import { expect, test, type Page } from "@playwright/test";
import type { OrderCatalogItem } from "../src/features/hospital-admin/server-order-catalog-core";
import { readFileSync } from "node:fs";
test.use({ viewport: { width: 1440, height: 1000 } });
test.beforeEach(async ({ page }) => {
  // Mock the unrelated shell contract explicitly, independent of host/port or env.
  await page.route("**/api/workspaces", async route => {
    if (route.request().method() !== "GET") throw Error("Unexpected workspace mutation");
    await route.fulfill({ json: { ok: true, workspaces: [{ id: "clair-demo", displayName: "합성 테스트 병원",
      membershipId: "taxonomy-ui-membership", roles: ["hospital_admin"], status: "active" }],
      enforcedBy: "workspace-membership-reader" } });
  });
  let tabsPayload: unknown = null;
  await page.route("**/api/workspaces/clair-demo/app-shell/workspace-tabs", async route => {
    const method = route.request().method();
    if (method === "PUT") tabsPayload = route.request().postDataJSON();
    else if (method !== "GET") throw Error("Unexpected workspace tabs mutation");
    await route.fulfill({ json: { ok: true, status: 200, payload: tabsPayload, enforcedBy: "workspace-tabs-session" } });
  });
  // A persisted empty configuration is distinct from an unauthenticated API.
  // Profile-specific tests register a later route with their exact fixture.
  await page.route("**/api/workspaces/clair-demo/lab-imaging/result-profiles**", async route => {
    if (route.request().method() !== "GET") throw Error("Unexpected laboratory profile mutation");
    await route.fulfill({ json: { ok: true, configuration: { workspaceId: "clair-demo", canManage: true,
      profiles: [], devices: [], bindings: [], overrides: [], compositions: [], selectedProfileVersionId: null, selectedDeviceId: null } } });
  });
});

const fixture: OrderCatalogItem = {
  id: "taxonomy-ui-lab", workspaceId: "clair-demo", standardOrderId: "synthetic-taxonomy-lab",
  sourcePresetVersion: "local-test", standardOrderName: "합성 검사 오더", inHospitalOrderName: "합성 검사 오더",
  billingName: "합성 검사 오더", aliases: [], categoryGroup: "lab", categoryLabel: "검사",
  clinicalOrderType: "clinical_lab", clinicalOrderTypeSource: "persisted", defaultDestinationModule: "lab",
  defaultTaskRequired: true, billingReflectionEnabled: true, availabilityStatus: "active", priceKrw: 0,
  salesUnit: "per_order", targetSpecies: ["dog"], taxIncluded: false, roundingRule: "as_is",
  linkedLabItemIds: [], linkedLabCategoryIds: [], pricingRule: {
    priceKrw: 0, priceBasis: "fixed_order_price", salesUnit: "per_order", taxIncluded: false,
    roundingRule: "as_is", billingReflectionEnabled: true,
  },
  defaultDetailInputs: { specimenType: "blood", testPanel: "CBC" },
  catalogRevision: 1, originType: "clair_master", sourceMasterRecordId: "11111111-1111-4111-8111-111111111111",
  customizationState: "unmodified", customizedFields: [], adminSubcategoryCode: "clinical-pathology", labFamilyCode: "cbc",
  updatedAt: "2026-09-06T00:00:00.000Z",
};

async function catalog(page: Page, options: { manage?: boolean; author?: boolean; dispensing?: boolean; preparation?: boolean; conflict?: boolean; stale?: boolean; execution?: boolean } = {}) {
  let item: OrderCatalogItem = structuredClone(fixture);
  if (options.dispensing) item = { ...item, categoryGroup: "medication", categoryLabel: "조제",
    clinicalOrderType: "dispensing", defaultDestinationModule: "dispensing", adminSubcategoryCode: "oral-medication", labFamilyCode: null,
    defaultDetailInputs: { doseBasis: "patient", dose: 0.5, doseUnit: "tablet", route: "PO", frequency: "once", durationDays: 1, totalQuantity: 0.5, totalQuantityUnit: "tablet" },
    medicationMetadata: { ingredientEnglishName: "Synthetic fixture" } };
  if (options.preparation) {
    const authority = { schemaVersion: 2 as const, calculationMode: "product_unit" as const, dispenseUnit: "tablet",
      preparationPolicy: { quantityScope: "course_total" as const, increment: 0.5, roundingMode: "up" as const, displayPrecision: 1 },
      productReference: { referenceKey: "synthetic.ui", productName: "Synthetic product 10 mg tablet", dosageForm: "tablet", strengthDescription: "10 mg/tablet",
        sourceUri: "https://example.org/synthetic-reference", referenceSpecies: ["dog"], clinicalUseAllowed: false as const } };
    item.planOrderAuthority = authority;
    item.defaultDetailInputs = { ...item.defaultDetailInputs, dose: 0.25, frequency: "tid", durationDays: 5, totalQuantity: 4, planOrderAuthority: authority };
  }
  if (options.conflict) item.taxonomyMergeConflict = { revision: 2, proposed: { adminSubcategoryCode: null, labFamilyCode: "cbc" } };
  if (options.execution) {
    const source = { cell: { present: true, policyPresent: true, value: "마스터 CBC", policy: "preset_fixed" },
      masterRevision: 4, presetRevision: 3, presetId: "cb31e133-994d-5d51-94ee-202774b66820", sha256: "a".repeat(64) };
    item.executionSourceBaseline = { testPanel: source };
    item.executionMergeConflicts = { testPanel: { base: source.cell, local: { ...source.cell, value: "CBC" }, incoming: source } };
    item.customizedFields = ["defaultDetailInputs.testPanel"];
    item.customizationState = "customized";
    if (options.dispensing) {
      const doseSource = { ...source, cell: { ...source.cell, value: 1 } };
      item.executionSourceBaseline = { dose: doseSource };
      item.executionMergeConflicts = { dose: { base: doseSource.cell, local: { ...doseSource.cell, value: 0.5 }, incoming: doseSource } };
      item.customizedFields = ["defaultDetailInputs.dose"];
    }
  }
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/workspaces/clair-demo/hospital-admin/order-catalog", async route => {
    if (route.request().method() !== "GET") {
      const body = route.request().postDataJSON();
      writes.push(body);
      if (options.manage === false) throw Error("read-only view attempted mutation");
      if (options.stale) {
        await route.fulfill({ status: 409, json: { ok: false, error: "catalog_revision_conflict" } });
        return;
      }
      if (body.action === "create") {
        item = { ...item, ...body.item, id: "taxonomy-ui-created", originType: "workspace_custom" };
        await route.fulfill({ json: { ok: true, item } });
        return;
      }
      item = { ...item, ...body.patch, catalogRevision: (item.catalogRevision ?? 0) + 1 };
      if (options.preparation && body.patch?.defaultDetailInputs?.planOrderAuthority) item.planOrderAuthority = body.patch.defaultDetailInputs.planOrderAuthority;
      if (body.patch?.resetTaxonomyFields) item = { ...item, adminSubcategoryCode: "clinical-pathology", labFamilyCode: "cbc", taxonomyMergeConflict: undefined };
      if (body.patch?.resetExecutionFields) item = { ...item, defaultDetailInputs: { ...item.defaultDetailInputs, testPanel: "마스터 CBC" }, customizedFields: [], executionMergeConflicts: {} };
      if (body.patch?.keepExecutionFields) item = { ...item, executionMergeConflicts: {} };
      await route.fulfill({ json: { ok: true, item } });
      return;
    }
    await route.fulfill({ json: { ok: true, items: [item], capabilities: {
      canManageCatalog: options.manage !== false, canAuthorDispensing: options.author === true, canApproveDispensing: false,
    } } });
  });
  await page.goto("/w/clair-demo/orders?modulePanel=open");
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: options.dispensing ? /^처방\/조제 전체/ : /^검사 전체/ }).click();
  await page.getByTestId(`hospital-order-row-${fixture.id}`).click();
  return { writes, current: () => item, drawer: page.getByTestId("hospital-order-drawer") };
}

test("laboratory setup explicitly applies composition billing and preserves local interval versions", async ({ page }) => {
  const source = JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/cbc-runtime.non-applied.v1.json", "utf8"));
  const profile = source.profiles.find((p: { profileKey: string }) => p.profileKey === "cm.lab-profile.clair-demo-cbc.dog");
  const composition = source.compositions.find((c: { masterKey: string }) => c.masterKey === "cm.order.lab.panel.cbc-basic");
  const leaves = source.expandedCompositions.find((c: { masterKey: string }) => c.masterKey === composition.masterKey).leaves;
  const deviceId = "97050000-0000-4000-8000-000000000081";
  const config = { workspaceId: "clair-demo", catalogItemId: fixture.id, canConfigure: true, canSelect: false, order: null,
    profiles: [profile], devices: [{ id: deviceId, workspace_id: "clair-demo", name: "합성 수기 장비", ...profile.device,
      entry_mode: "manual_entry", integration_status: "not_integrated", active: true, row_revision: 1 }],
    bindings: [{ workspace_id: "clair-demo", order_catalog_item_id: fixture.id, species: "dog", device_id: deviceId,
      profile_version_id: profile.id, row_revision: 1, override_version_id: null as string | null }], overrides: [] as unknown[],
    compositions: [{ id: composition.id, masterKey: composition.masterKey, revision: 1, name: composition.displayName, leafCount: leaves.length,
      leaves, currentSetRevisionId: null as string | null, currentCompositionVersionId: null as string | null, billingPolicy: null as string | null }] };
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/workspaces/clair-demo/lab-imaging/result-profiles**", async route => {
    if (route.request().method() === "GET") { await route.fulfill({ json: { ok: true, configuration: config } }); return; }
    const body = route.request().postDataJSON(); writes.push(body);
    if (body.action === "apply_composition") Object.assign(config.compositions[0], { currentSetRevisionId: deviceId, currentCompositionVersionId: composition.id, billingPolicy: body.billingPolicy });
    if (body.action === "save_intervals") {
      config.bindings[0].row_revision++; config.bindings[0].override_version_id = body.requestId;
      config.overrides.push({ workspace_id: "clair-demo", id: body.requestId, order_catalog_item_id: fixture.id, base_profile_version_id: profile.id,
        revision: 1, rules_sha256: "a".repeat(64), rules: profile.rules.map((r: { testMasterKey: string }) => ({ ...r,
          referenceInterval: body.intervals.find((p: { testMasterKey: string }) => p.testMasterKey === r.testMasterKey)?.referenceInterval ?? null })) });
    }
    await route.fulfill({ json: { ok: true } });
  });
  const { drawer } = await catalog(page);
  const section = drawer.getByTestId("lab-result-profile-selection");
  await section.getByRole("combobox", { name: "검사 구성 버전 선택" }).click();
  await page.getByRole("option", { name: /CBC 검사 세트/ }).click();
  await expect(section.getByRole("button", { name: "선택한 구성과 청구 방식 적용" })).toBeDisabled();
  await section.getByRole("combobox", { name: "검사 세트 청구 방식 선택" }).click();
  await page.getByRole("option", { name: "이 세트 청구 안 함", exact: true }).click();
  await section.getByRole("button", { name: "선택한 구성과 청구 방식 적용" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ action: "apply_composition", versionId: composition.id, billingPolicy: "no_charge", expectedSetRevisionId: null });
  await section.getByRole("combobox", { name: "검사 결과 프로필 선택" }).click();
  await page.getByRole("option", { name: `${profile.name} · v1`, exact: true }).click();
  const editor = section.getByTestId("lab-profile-interval-editor");
  await editor.getByText("병원 정상범위 수정", { exact: true }).click();
  await editor.getByLabel("WBC 하한", { exact: true }).fill("2");
  await editor.getByLabel("WBC 상한", { exact: true }).fill("8");
  await editor.getByRole("button", { name: "새 병원 정상범위 버전 저장" }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toMatchObject({ action: "save_intervals", expectedBindingRevision: 1,
    intervals: expect.arrayContaining([{ testMasterKey: "cm.lab-test.cbc-wbc", referenceInterval: { low: 2, high: 8, lowInclusive: true, highInclusive: true } }]) });
  await editor.getByText("병원 정상범위 수정", { exact: true }).click();
  await expect(editor.getByLabel("WBC 상한", { exact: true })).toHaveValue("8");
});

test("V2 preparation rule editing persists rounded planned total and recovers invalid draft input", async ({ page }) => {
  const ui = await catalog(page, { dispensing: true, author: true, preparation: true });
  await expect(ui.drawer.getByTestId("hospital-preparation-authority")).toBeVisible();
  await expect(ui.drawer.getByLabel("처방 총량", { exact: true })).toHaveValue("4");
  await expect(ui.drawer.getByLabel("총량 자동 계산", { exact: true })).toBeDisabled();
  await ui.drawer.getByLabel("준비 계량 단위", { exact: true }).fill("0");
  await expect(ui.drawer.getByTestId("hospital-preparation-authority")).toBeVisible();
  await expect(ui.drawer.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await ui.drawer.getByLabel("준비 계량 단위", { exact: true }).fill("1");
  await expect(ui.drawer.getByLabel("처방 총량", { exact: true })).toHaveValue("4");
  await expect(ui.drawer.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
  await ui.drawer.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => ui.writes.length).toBe(1);
  const patch = ui.writes[0].patch as { defaultDetailInputs: Record<string, unknown> };
  expect(patch.defaultDetailInputs.totalQuantity).toBe(4);
  expect(patch.defaultDetailInputs.planOrderAuthority).toMatchObject({ preparationPolicy: { increment: 1, quantityScope: "course_total" } });
  await page.reload();
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: /^처방\/조제 전체/ }).click();
  await page.getByTestId(`hospital-order-row-${fixture.id}`).click();
  await expect(page.getByTestId("hospital-order-drawer").getByLabel("준비 계량 단위", { exact: true })).toHaveValue("1");
});

test("taxonomy UI saves only classification, survives reload and explicitly resets", async ({ page }) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    consoleErrors.push(`${message.location().url}: ${message.text()}`);
  });
  const { writes, current, drawer } = await catalog(page, { conflict: true });
  await expect(page).toHaveURL(/\/w\/clair-demo\/orders/);
  await expect(page).toHaveTitle(/CLAiR/);
  await expect(drawer.getByRole("heading", { name: "합성 검사 오더" })).toBeVisible();
  await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText(/마스터 분류 갱신 충돌/)).toBeVisible();
  await drawer.getByRole("combobox", { name: "오더 검사 계열" }).click();
  await page.getByRole("option", { name: "혈액화학", exact: true }).click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].patch).toEqual({ adminSubcategoryCode: "clinical-pathology", labFamilyCode: "chemistry" });
  expect(current().defaultDetailInputs).toEqual(fixture.defaultDetailInputs);
  await page.reload();
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: /^검사 전체/ }).click();
  await page.getByTestId(`hospital-order-row-${fixture.id}`).click();
  await expect(drawer.getByRole("combobox", { name: "오더 검사 계열" })).toContainText("혈액화학");
  await drawer.getByRole("button", { name: "마스터 분류로 초기화", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  expect(writes).toHaveLength(1);
  await expect(drawer.getByRole("combobox", { name: "오더 검사 계열" })).toContainText("혈액화학");
  await drawer.getByRole("button", { name: "마스터 분류로 초기화", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "분류 초기화", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].patch).toEqual({ resetTaxonomyFields: ["adminSubcategoryCode", "labFamilyCode"] });
  await expect(drawer.getByRole("combobox", { name: "오더 검사 계열" })).toContainText("CBC");
  await expect(drawer.getByText(/마스터 분류 갱신 충돌/)).toHaveCount(0);
  await drawer.getByTestId("hospital-order-taxonomy-editor").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/wp01b-taxonomy-ui-desktop.png" });
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("new order editor sends selected subtype and family in creation", async ({ page }) => {
  const { writes, drawer } = await catalog(page);
  await drawer.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByRole("button", { name: "+ Order", exact: true }).click();
  await drawer.getByRole("combobox", { name: "오더 세부 분류" }).click();
  await page.getByRole("option", { name: "임상병리", exact: true }).click();
  await drawer.getByRole("combobox", { name: "오더 검사 계열" }).click();
  await page.getByRole("option", { name: "CBC", exact: true }).click();
  await drawer.getByPlaceholder("표준 Order명을 입력해 주세요").fill("새 합성 검사");
  await drawer.getByPlaceholder("원내에서 사용할 Order명을 입력해 주세요").fill("새 합성 검사");
  await drawer.getByPlaceholder("청구서에 표시할 이름을 입력해 주세요").fill("새 합성 검사");
  await drawer.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "등록", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].item).toMatchObject({ adminSubcategoryCode: "clinical-pathology", labFamilyCode: "cbc" });
});

test("explicit clear stays visible in category-wide view and unresolved list", async ({ page }) => {
  const { writes, drawer } = await catalog(page);
  await drawer.getByRole("combobox", { name: "오더 세부 분류" }).click();
  await page.getByRole("option", { name: "미설정", exact: true }).click();
  await drawer.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].patch).toEqual({ adminSubcategoryCode: null, labFamilyCode: null });
  await drawer.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page.getByTestId(`hospital-order-row-${fixture.id}`)).toBeVisible();
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: /^분류 확인 필요/ }).click();
  await expect(page.getByTestId(`hospital-order-row-${fixture.id}`)).toBeVisible();
});

test("stale reset keeps existing values and shows conflict guidance", async ({ page }) => {
  const { drawer } = await catalog(page, { stale: true });
  await drawer.getByRole("button", { name: "마스터 분류로 초기화", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "분류 초기화", exact: true }).click();
  await expect(drawer.getByTestId("hospital-order-mutation-status")).toContainText("다른 관리자가 먼저 변경");
  await expect(drawer.getByRole("combobox", { name: "오더 검사 계열" })).toContainText("CBC");
});

test("taxonomy controls remain reachable in a narrow viewport", async ({ page }) => {
  const { drawer } = await catalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await drawer.getByRole("combobox", { name: "오더 검사 계열" }).scrollIntoViewIfNeeded();
  const bounds = await drawer.getByRole("combobox", { name: "오더 검사 계열" }).boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "/tmp/wp01b-taxonomy-ui-mobile.png" });
});

test("read-only taxonomy controls cannot edit or reset", async ({ page }) => {
  const { drawer, writes } = await catalog(page, { manage: false });
  await expect(drawer.getByRole("combobox", { name: "오더 세부 분류" })).toBeDisabled();
  await expect(drawer.getByRole("combobox", { name: "오더 검사 계열" })).toBeDisabled();
  await expect(drawer.getByRole("button", { name: "마스터 분류로 초기화", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("network failure exits saving state and preserves unsaved classification", async ({ page }) => {
  const { drawer } = await catalog(page);
  await page.route("**/api/workspaces/clair-demo/hospital-admin/order-catalog", async route => {
    if (route.request().method() === "PATCH") await route.abort("failed");
    else await route.fallback();
  });
  await drawer.getByRole("combobox", { name: "오더 검사 계열" }).click();
  await page.getByRole("option", { name: "혈액화학", exact: true }).click();
  await drawer.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByTestId("hospital-order-saving-dialog")).toHaveCount(0);
  await expect(drawer.getByTestId("hospital-order-mutation-status")).toBeVisible();
  await expect(drawer.getByRole("combobox", { name: "오더 검사 계열" })).toContainText("혈액화학");
  await expect(drawer.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
});

test("execution field conflict supports cancel, keep-local, reset-source and reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const { drawer, writes, current } = await catalog(page, { execution: true });
  const lineage = drawer.getByTestId("execution-lineage-testPanel");
  await lineage.scrollIntoViewIfNeeded();
  await expect(lineage).toContainText("병원 수정");
  await expect(lineage).toContainText("마스터 4 / 기본값 3");
  await expect(lineage.getByRole("status")).toBeVisible();
  await lineage.getByRole("button", { name: "마스터 값 적용", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
  expect(writes).toEqual([]);
  await lineage.getByRole("button", { name: "병원 값 유지", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "병원 값 유지", exact: true }).click();
  await expect(lineage.getByRole("status")).toHaveCount(0);
  expect(writes[0]).toMatchObject({ expectedCatalogRevision: 1, patch: { keepExecutionFields: ["testPanel"] } });
  expect(current().defaultDetailInputs?.testPanel).toBe("CBC");
  await lineage.getByRole("button", { name: "마스터 값 적용", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "마스터 값 적용", exact: true }).click();
  await expect(lineage).toContainText("마스터 상속");
  expect(writes[1]).toMatchObject({ expectedCatalogRevision: 2, patch: { resetExecutionFields: ["testPanel"] } });
  expect(current().defaultDetailInputs).toEqual({ ...fixture.defaultDetailInputs, testPanel: "마스터 CBC" });
  expect(current().priceKrw).toBe(0);
  await page.reload();
  await page.getByTestId("hospital-admin-side-panel").getByRole("button", { name: /^검사 전체/ }).click();
  await page.getByTestId(`hospital-order-row-${fixture.id}`).click();
  await expect(lineage).toContainText("마스터 상속");
  await lineage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/wp02-execution-lineage-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await lineage.scrollIntoViewIfNeeded();
  const bounds = await lineage.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "/tmp/wp02-execution-lineage-mobile.png" });
  expect(errors).toEqual([]);
});

test("execution reset stale response retains local values; read-only cannot resolve", async ({ page }) => {
  const { drawer, current } = await catalog(page, { execution: true, stale: true });
  const lineage = drawer.getByTestId("execution-lineage-testPanel");
  await lineage.getByRole("button", { name: "마스터 값 적용", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "마스터 값 적용", exact: true }).click();
  await expect(drawer.getByTestId("hospital-order-mutation-status")).toContainText("다른 관리자가 먼저 변경");
  expect(current().defaultDetailInputs?.testPanel).toBe("CBC");
  await page.unrouteAll();
  const readOnly = await catalog(page, { execution: true, manage: false });
  await expect(readOnly.drawer.getByTestId("execution-lineage-testPanel").getByRole("button", { name: "마스터 값 적용", exact: true })).toBeDisabled();
  await expect(readOnly.drawer.getByTestId("execution-lineage-testPanel").getByRole("button", { name: "병원 값 유지", exact: true })).toBeDisabled();
  expect(readOnly.writes).toEqual([]);
});

test("dispensing author without manage permission cannot resolve saved source fields", async ({ page }) => {
  const { drawer, writes } = await catalog(page, { execution: true, dispensing: true, author: true, manage: false });
  const field = drawer.getByTestId("execution-lineage-dose");
  await expect(field.getByRole("button", { name: "마스터 값 적용", exact: true })).toBeDisabled();
  await expect(field.getByRole("button", { name: "병원 값 유지", exact: true })).toBeDisabled();
  expect(writes).toEqual([]);
});
