import { expect, test } from "@playwright/test";
import { createSupabaseOrderCatalogGateway, type OrderCatalogClassificationPath } from "../src/features/hospital-admin/server-order-catalog-core";
import { createOrderPricingSnapshot } from "../src/features/hospital-admin/server-order-catalog-core";
import { isOrderTaxonomyValid, orderTaxonomySubcategories, orderTaxonomyLabFamilies } from "../src/features/hospital-admin/order-taxonomy";
import { readFileSync } from "node:fs";
import { buildWorkspaceCatalogMutationFromHospitalOrder, createEmptyHospitalOrderDraft, formatHospitalOrderClassification, isHospitalOrderInCategory, isHospitalOrderTaxonomyOnlyChange, mapWorkspaceCatalogItemToHospitalOrder } from "../src/features/hospital-admin/data";
import { useHospitalAdminStore } from "../src/features/hospital-admin/store";
import { parseExecutionCustomizedFields, parseExecutionMergeConflicts, parseExecutionSourceBaseline } from "../src/features/hospital-admin/order-execution-lineage";

const path: OrderCatalogClassificationPath = {
  id: "c5e3336c-b001-4000-8000-000000000001", key: "cm.path.laboratory",
  actionCode: "A000011", actionName: "임상병리 검사", itemType: "lab",
  tCategoryCode: "T-LAB", chartGroupCode: "CG_EXAM", taskRouteCode: "NT_LAB",
  isUnclassified: false, retired: false,
};
const row = {
  id: "order-lab", workspace_id: "test-workspace", standard_order_id: "master-lab",
  source_preset_version: "v1", category_group: "lab", category_label: "CBC검사",
  standard_order_name: "CBC", in_hospital_order_name: "CBC", billing_name: "CBC",
  availability_status: "active", price_krw: 0, sales_unit: "per_order",
  default_destination_module: "lab", default_task_required: true,
  billing_reflection_enabled: true, tax_included: false, rounding_rule: "as_is",
  updated_at: "2026-09-06T00:00:00.000Z", clinical_order_type: "clinical_lab",
  default_detail_inputs: { specimenType: "blood", testPanel: "CBC" },
  classification_path_id: path.id, classification_path: path,
};
async function read(patch: Record<string, unknown> = {}) {
  return createSupabaseOrderCatalogGateway({
    async rpc(name, args) {
      expect(name).toBe("clair_list_order_catalog_admin_v2");
      expect(args).toEqual({ p_workspace_id: "test-workspace" });
      return { data: [{ ...row, ...patch }], error: null };
    },
  }).listAdminCatalog({ workspaceId: "test-workspace" });
}

const executionSource = {
  cell: { present: true, policyPresent: true, value: "CBC source", policy: "preset_fixed" },
  masterRevision: 4, presetRevision: 3,
  presetId: "cb31e133-994d-5d51-94ee-202774b66820", sha256: "a".repeat(64),
};
test("field provenance is frozen into new snapshots, never substituted for local values", async () => {
  const baseline = { testPanel: structuredClone(executionSource) };
  const conflicts = { testPanel: { base: executionSource.cell, local: { ...executionSource.cell, value: "CBC" }, incoming: executionSource } };
  const result = await read({ execution_source_baseline: baseline, execution_merge_conflicts: conflicts,
    customized_fields: ["priceKrw", "defaultDetailInputs.testPanel"], target_species: ["dog"] });
  if (!result.ok) throw Error("read failed");
  expect(result.items[0].executionSourceBaseline).toEqual(baseline);
  expect(result.items[0].executionMergeConflicts).toEqual(conflicts);
  const snapshot = createOrderPricingSnapshot(result.items[0]);
  expect(snapshot.defaultDetailInputs?.testPanel).toBe("CBC");
  expect(snapshot.executionSourceBaseline).toEqual(baseline);
  expect(snapshot.executionCustomizedFields).toEqual(["defaultDetailInputs.testPanel"]);
  baseline.testPanel.cell.value = "future source";
  result.items[0].executionSourceBaseline!.testPanel.cell.value = "later copy";
  expect(snapshot.executionSourceBaseline?.testPanel.cell.value).toBe("CBC source");
  const search = await createSupabaseOrderCatalogGateway({ async rpc() { return { data: [{
    row_type: "individual", category_group: "lab", display_name: "CBC", billing_name: "CBC",
    source_preset_id: snapshot.sourcePresetId, source_preset_version: snapshot.sourcePresetVersion,
    target_species: ["dog"], applied_snapshot: snapshot,
  }], error: null }; } }).listChartSearch({ workspaceId: "test-workspace" });
  expect(search.ok).toBe(true);
  if (search.ok) expect(search.rows[0].appliedSnapshot.executionSourceBaseline).toEqual(snapshot.executionSourceBaseline);
});

test("field lineage distinguishes absent, explicit null, and invalid metadata", async () => {
  expect(parseExecutionSourceBaseline(undefined)).toBeUndefined();
  expect(parseExecutionSourceBaseline({ testPanel: { ...executionSource, cell: { present: false, policyPresent: true, policy: "workspace_resolved" } } })).not.toBeNull();
  expect(parseExecutionSourceBaseline({ testPanel: { ...executionSource, cell: { ...executionSource.cell, value: null } } })).not.toBeNull();
  for (const invalid of [null, [], { testPanel: { ...executionSource, presetRevision: 0 } },
    { testPanel: { ...executionSource, sha256: "unverified" } },
    { testPanel: { ...executionSource, cell: { ...executionSource.cell, present: false } } }]) {
    expect(parseExecutionSourceBaseline(invalid)).toBeNull();
    expect(await read({ execution_source_baseline: invalid })).toEqual({ ok: false, status: 500, error: "catalog_response_invalid" });
  }
  expect(parseExecutionMergeConflicts({ testPanel: { base: null, local: { present: false, policyPresent: false }, incoming: executionSource } })).not.toBeNull();
  expect(parseExecutionMergeConflicts({ testPanel: { incoming: executionSource } })).toBeNull();
  expect(parseExecutionCustomizedFields(["defaultDetailInputs.testPanel", "*"])).toEqual(["defaultDetailInputs.testPanel", "*"]);
  expect(parseExecutionCustomizedFields(["priceKrw"])).toBeNull();
});

test("exact saved descriptor is transported but broad lab path never invents CBC subtype", async () => {
  const result = await read();
  if (!result.ok) throw Error("read failed");
  expect(result.items).toHaveLength(1);
  expect(result.items[0].classificationPath).toEqual(path);
  const admin = mapWorkspaceCatalogItemToHospitalOrder(result.items[0]);
  expect(admin.sourceCatalogItem?.classificationPath).toEqual(path);
  expect(admin.classificationStatus).toBe("subcategory_missing");
  expect(admin.clinicalPathologyCategoryId).toBeUndefined();
  expect(formatHospitalOrderClassification(admin)).toBe("검사 / 세부 분류 미설정");
  expect(admin.defaultDetailInputs).toEqual(row.default_detail_inputs);
  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: { ...admin, inHospitalName: "renamed" }, source: result.items[0], workspaceId: row.workspace_id,
  });
  expect(mutation.action).toBe("update");
  if (mutation.action !== "update") throw Error("not update");
  expect(mutation.patch).not.toHaveProperty("classificationPath");
  expect(mutation.patch).not.toHaveProperty("classificationPathId");
});

for (const descriptor of [undefined, null]) {
  test(`missing descriptor (${descriptor}) remains explicit, never an empty success`, async () => {
    const result = await read({ classification_path: descriptor });
    if (!result.ok) throw Error("read failed");
    expect(result.items).toHaveLength(1);
    expect(mapWorkspaceCatalogItemToHospitalOrder(result.items[0]).classificationStatus).toBe("taxonomy_unavailable");
  });
}

for (const [name, descriptor] of Object.entries({
  "foreign path id": { ...path, id: "different-path" },
  "blank key": { ...path, key: " " },
  "invalid type": { ...path, itemType: "toString" },
  "string flag": { ...path, isUnclassified: "false" },
  "missing retirement": { ...path, retired: undefined },
  "invalid name": { ...path, actionName: 17 },
  "array": [],
})) {
  test(`malformed descriptor rejects entire read: ${name}`, async () => {
    expect(await read({ classification_path: descriptor })).toEqual({ ok: false, status: 500, error: "catalog_response_invalid" });
  });
}

for (const [status, descriptor] of Object.entries({
  taxonomy_unclassified: { ...path, isUnclassified: true },
  taxonomy_retired: { ...path, retired: true },
  taxonomy_conflict: { ...path, itemType: "imaging" },
})) {
  test(`${status} preserves discoverability without resolving a subtype`, async () => {
    const result = await read({ classification_path: descriptor });
    if (!result.ok) throw Error("read failed");
    const admin = mapWorkspaceCatalogItemToHospitalOrder(result.items[0]);
    expect(admin.classificationStatus).toBe(status);
    expect(admin.subcategoryId).toBe("unclassified");
    expect(isHospitalOrderInCategory(admin, "lab", "unclassified")).toBe(true);
    expect(isHospitalOrderInCategory(admin, "unclassified", "unclassified")).toBe(true);
  });
}

test("valid path metadata does not legitimize a foreign workspace row", async () => {
  expect((await read({ workspace_id: "foreign-workspace" })).ok).toBe(false);
});

for (const mode of ["saved", "failed", "foreign", "stale", "path_changed", "malformed", "thrown"] as const) {
  test(`committed mutation readback: ${mode}`, async () => {
    const gateway = createSupabaseOrderCatalogGateway({ async rpc(name) {
      if (name === "clair_list_order_catalog_admin_v2") {
        if (mode === "thrown") throw Error("offline");
        return { error: mode === "failed" ? { message: "offline" } : null,
          data: mode === "malformed" ? [{}] : [{ ...row, catalog_revision: mode === "stale" ? 1 : 2,
            ...(mode === "path_changed" ? { classification_path_id: "changed-path", classification_path: { ...path, id: "changed-path" } } : {}),
            workspace_id: mode === "foreign" ? "another-workspace" : row.workspace_id }] };
      }
      return { data: { item: { ...row, classification_path: undefined, catalog_revision: 2 }, databaseAuditWritten: true }, error: null };
    } });
    for (const mutation of [
      { action: "update" as const, itemId: row.id, expectedCatalogRevision: 1, patch: { inHospitalOrderName: "renamed" } },
      { action: "review" as const, itemId: row.id, expectedCatalogRevision: 1, decision: "approve" as const },
    ]) {
      const result = await gateway.mutateOrder({ actorUserId: "synthetic-user", workspaceId: row.workspace_id, mutation });
      if (!result.ok) throw Error("committed write must not invite a duplicate retry");
      expect(result.databaseAuditWritten).toBe(true);
      expect(result.item.classificationPath).toEqual(mode === "saved" ? path : undefined);
      const admin = mapWorkspaceCatalogItemToHospitalOrder(result.item);
      expect(admin.classificationStatus).toBe(mode === "saved" ? "subcategory_missing" : "taxonomy_unavailable");
      if (mode !== "saved") expect(formatHospitalOrderClassification(admin)).toBe("검사 / 저장 분류 조회 불가");
    }
  });
}

test("create returns the authoritative descriptor after persisted creation", async () => {
  const source = await read();
  if (!source.ok) throw Error("fixture failed");
  const calls: string[] = [];
  const gateway = createSupabaseOrderCatalogGateway({ async rpc(name) {
    calls.push(name);
    return { data: name === "clair_list_order_catalog_admin_v2" ? [row] : { ...row, classification_path: undefined }, error: null };
  } });
  const result = await gateway.mutateOrder({
    actorUserId: "synthetic-user", workspaceId: row.workspace_id,
    mutation: { action: "create", item: source.items[0] },
  });
  if (!result.ok) throw Error(JSON.stringify(result));
  expect(result.item.classificationPath).toEqual(path);
  expect(calls).toEqual(["clair_create_order_catalog_item", "clair_list_order_catalog_admin_v2"]);
});
test("dispensing creation uses the taxonomy-aware dispatcher and round-trips codes", async () => {
  const persisted = { ...row, category_group: "medication", clinical_order_type: "dispensing",
    default_destination_module: "dispensing", admin_subcategory_code: "oral-medication", lab_family_code: null,
    classification_path: { ...path, itemType: "medication", taskRouteCode: "NT_DISPENSING" } };
  const source = await read(persisted);
  if (!source.ok) throw Error("fixture failed");
  const calls: string[] = [];
  const gateway = createSupabaseOrderCatalogGateway({ async rpc(name, args) {
    calls.push(name);
    if (name === "clair_create_order_catalog_item") {
      if (!("p_item" in args)) throw Error("create payload missing");
      expect(args.p_item).toMatchObject({ adminSubcategoryCode: "oral-medication", labFamilyCode: null });
    }
    return { data: name === "clair_list_order_catalog_admin_v2" ? [persisted] : { item: persisted }, error: null };
  } });
  const result = await gateway.mutateOrder({ actorUserId: "synthetic-user", workspaceId: row.workspace_id,
    mutation: { action: "create", item: source.items[0] } });
  if (!result.ok) throw Error(JSON.stringify(result));
  expect(calls).toEqual(["clair_create_order_catalog_item", "clair_list_order_catalog_admin_v2"]);
  expect(result.item.adminSubcategoryCode).toBe("oral-medication");
});

test("stored fine codes drive Admin and new snapshots without clinical changes", async () => {
  const result = await read({ admin_subcategory_code: "clinical-pathology", lab_family_code: "cbc" });
  if (!result.ok) throw Error("read failed");
  const item = result.items[0];
  const admin = mapWorkspaceCatalogItemToHospitalOrder(item);
  expect(admin.subcategoryId).toBe("clinical-pathology");
  expect(admin.clinicalPathologyCategoryId).toBe("cbc");
  expect(admin.classificationStatus).toBe("resolved");
  const snapshot = createOrderPricingSnapshot(item);
  expect(snapshot.labFamilyCode).toBe("cbc");
  item.labFamilyCode = "chemistry";
  expect(snapshot.labFamilyCode).toBe("cbc");
  expect(snapshot.clinicalOrderType).toBe("clinical_lab");
});
test("explicit nulls stay unclassified and old snapshots remain absent", async () => {
  const cleared = await read({ admin_subcategory_code: null, lab_family_code: null });
  if (!cleared.ok) throw Error("read failed");
  expect(mapWorkspaceCatalogItemToHospitalOrder(cleared.items[0]).subcategoryId).toBe("unclassified");
  expect(createOrderPricingSnapshot(cleared.items[0]).labFamilyCode).toBeNull();
  const legacy = await read();
  if (!legacy.ok) throw Error("read failed");
  expect(createOrderPricingSnapshot(legacy.items[0])).not.toHaveProperty("labFamilyCode");
});
for (const [sub, family] of [
  ["made-up", null], ["clinical-pathology", "etc"], ["clinical-pathology", null],
  ["clinical-pathology", undefined], ["oral-medication", null], [null, "cbc"], [42, null],
] as const) test("invalid fine pair fails closed: " + String(sub) + "/" + String(family), async () => {
  expect(await read({ admin_subcategory_code: sub, lab_family_code: family })).toMatchObject({ ok: false, error: "catalog_response_invalid" });
});
test("taxonomy-only edit omits all clinical fields; rename omits unchanged taxonomy", async () => {
  const result = await read({ admin_subcategory_code: "clinical-pathology", lab_family_code: "cbc" });
  if (!result.ok) throw Error("read failed");
  const source = result.items[0], admin = mapWorkspaceCatalogItemToHospitalOrder(source);
  const changed = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: { ...admin, clinicalPathologyCategoryId: "chemistry" }, source, workspaceId: row.workspace_id,
  });
  expect(changed.action).toBe("update");
  if (changed.action !== "update") throw Error("update expected");
  expect(changed.patch).toEqual({ adminSubcategoryCode: "clinical-pathology", labFamilyCode: "chemistry" });
  const renamed = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: { ...admin, inHospitalName: "Renamed" }, source, workspaceId: row.workspace_id,
  });
  if (renamed.action !== "update") throw Error("update expected");
  expect(renamed.patch).not.toHaveProperty("adminSubcategoryCode");
  expect(renamed.patch).not.toHaveProperty("labFamilyCode");
});
test("runtime vocabulary validates exact reviewed522 without importing ID maps", () => {
  const mapping = JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-01b/taxonomy-mapping.non-applied.v1.json", "utf8"));
  expect(Object.keys(orderTaxonomySubcategories)).toHaveLength(25);
  expect(Object.keys(orderTaxonomyLabFamilies)).toHaveLength(18);
  for (const order of mapping.rows) expect(isOrderTaxonomyValid(order.clinicalOrderType, order.proposed.adminSubcategoryCode, order.proposed.labFamilyCode)).toBe(true);
  expect(orderTaxonomySubcategories.anesthesia.parent).toBe("surgery");
  expect(orderTaxonomySubcategories["medical-supply"].parent).toBe("medical-supply");
});

test("conflict readback keeps saved placement and flags the review list without adopting proposal", async () => {
  const conflict = { revision: 2, proposed: { adminSubcategoryCode: null, labFamilyCode: "cbc" } };
  const result = await read({ admin_subcategory_code: "clinical-pathology", lab_family_code: "chemistry", taxonomy_merge_conflict: conflict });
  if (!result.ok) throw Error("read failed");
  const source = result.items[0], admin = mapWorkspaceCatalogItemToHospitalOrder(source);
  expect(source.labFamilyCode).toBe("chemistry");
  expect(source.taxonomyMergeConflict).toEqual(conflict);
  expect(admin.clinicalPathologyCategoryId).toBe("chemistry");
  expect(isHospitalOrderInCategory(admin, "unclassified", "unclassified")).toBe(true);
  expect(isHospitalOrderInCategory(admin, "lab", "clinical-pathology")).toBe(true);
  expect(formatHospitalOrderClassification(admin)).toContain("갱신 충돌");
  expect(createOrderPricingSnapshot(source)).not.toHaveProperty("taxonomyMergeConflict");
});
for (const conflict of [{ revision: -1, proposed: {} }, { revision: 1, proposed: { adminSubcategoryCode: [], labFamilyCode: null } }, "bad"])
  test(`malformed conflict evidence fails closed ${JSON.stringify(conflict)}`, async () => {
    expect(await read({ taxonomy_merge_conflict: conflict })).toMatchObject({ ok: false, error: "catalog_response_invalid" });
  });

test("new draft creation sends explicit selected taxonomy without clinical source substitution", () => {
  const draft = { ...createEmptyHospitalOrderDraft("lab", "clinical-pathology"), clinicalPathologyCategoryId: "cbc" as const };
  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({ draft, workspaceId: "test-workspace" });
  if (mutation.action !== "create") throw Error("create expected");
  expect(mutation.item).toMatchObject({ adminSubcategoryCode: "clinical-pathology", labFamilyCode: "cbc", clinicalOrderType: "clinical_lab" });
  expect(mutation.item.defaultDetailInputs).toBeUndefined();
  for (const [category, subcategory, clinicalType, group] of [
    ["medical-supply", "medical-supply", "other", "misc"], ["prevention", "prevention", "consultation", "consultation"],
  ] as const) {
    const created = buildWorkspaceCatalogMutationFromHospitalOrder({ draft: createEmptyHospitalOrderDraft(category, subcategory), workspaceId: "test-workspace" });
    if (created.action !== "create") throw Error("create expected");
    expect(created.item).toMatchObject({ adminSubcategoryCode: subcategory, labFamilyCode: null, clinicalOrderType: clinicalType, categoryGroup: group });
  }
});

test("save store preserves authoritative metadata so a reopened taxonomy-only edit stays taxonomy-only", async () => {
  const result = await read({ admin_subcategory_code: "clinical-pathology", lab_family_code: "cbc" });
  if (!result.ok) throw Error("read failed");
  const source = result.items[0], saved = mapWorkspaceCatalogItemToHospitalOrder(source);
  const previous = useHospitalAdminStore.getState().orders;
  try {
    useHospitalAdminStore.setState({ orders: [saved] });
    useHospitalAdminStore.getState().updateOrder(saved.id, saved);
    const reopened = useHospitalAdminStore.getState().orders[0];
    expect(reopened.updatedBy).toBe(saved.updatedBy);
    expect(isHospitalOrderTaxonomyOnlyChange({ ...reopened, clinicalPathologyCategoryId: "chemistry" }, source)).toBe(true);
  } finally { useHospitalAdminStore.setState({ orders: previous }); }
});

test("same-ID source refresh cannot upgrade an older draft CAS or resend old clinical fields", async () => {
  const result = await read({ catalog_revision: 1, admin_subcategory_code: "clinical-pathology", lab_family_code: "cbc" });
  if (!result.ok) throw Error("read failed");
  const first = result.items[0];
  const draft = { ...mapWorkspaceCatalogItemToHospitalOrder(first), clinicalPathologyCategoryId: "chemistry" as const };
  const refreshed = { ...first, catalogRevision: 2, priceKrw: 777, defaultDetailInputs: { specimenType: "serum", testPanel: "changed" } };
  const request = buildWorkspaceCatalogMutationFromHospitalOrder({ draft, source: refreshed, workspaceId: first.workspaceId });
  expect(request).toEqual({ action: "update", itemId: first.id, expectedCatalogRevision: 1,
    patch: { adminSubcategoryCode: "clinical-pathology", labFamilyCode: "chemistry" } });
  expect(() => buildWorkspaceCatalogMutationFromHospitalOrder({ draft, source: refreshed, workspaceId: "foreign" })).toThrow("catalog_draft_source_mismatch");
});
