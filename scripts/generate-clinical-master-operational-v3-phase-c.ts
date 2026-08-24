import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

const root = process.cwd();
const adapterPath = resolve(root, "tests/fixtures/clinical-master-operational-v3-adapter-output.json");
const pricingPath = resolve(root, "tests/fixtures/clinical-master-operational-v3-pricing-adoption.json");
const airtableManifestPath = resolve(root, "tests/fixtures/clinical-master-operational-v3-airtable-write-manifest.json");
const airtableReadbackPath = resolve(root, "tests/fixtures/clinical-master-airtable-operational-v3-current-readback.json");
const airtableFinalReadbackPath = resolve(root, "tests/fixtures/clinical-master-airtable-operational-v3-final-readback.json");
const airtableDeltaManifestPath = resolve(root, "tests/fixtures/clinical-master-operational-v3-airtable-delta-manifest.json");
const remotePreflightQueryPath = resolve(root, "supabase/snippets/clinical_master_operational_v3_phase_c_preflight.sql");
const rollbackSqlPath = resolve(root, "supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql");
const outputPath = resolve(root, "tests/fixtures/clinical-master-operational-v3-phase-c-operation-manifest.json");
const pureRollbackSqlPath = resolve(root, "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_rendered.sql");
const remotePureRollbackSqlPath = resolve(root, "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_remote_rendered.sql");
const persistentCommitSqlPath = resolve(root, "supabase/snippets/clinical_master_operational_v3_phase_c_commit_candidate.sql");
const releaseScopedMigrationPath = resolve(root, "supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql");
const releaseScopedSpecPath = resolve(root, "tests/clinical-master-release-scoped-workspace-adoption.spec.ts");
const releaseScopedReplayPath = resolve(root, "supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql");

const readJson = (path: string): JsonObject => JSON.parse(readFileSync(path, "utf8")) as JsonObject;
const sha256File = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");
const asArray = <T>(value: unknown, label: string): T[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value as T[];
};

const adapter = readJson(adapterPath);
const pricing = readJson(pricingPath);
const airtableManifest = readJson(airtableManifestPath);
const airtableFinalReadback = readJson(airtableFinalReadbackPath);
const airtableDeltaManifest = readJson(airtableDeltaManifestPath);
const payload = adapter.payload as JsonObject;
const records = asArray<JsonObject>(payload.records, "adapter.payload.records");
const orders = records.filter((record) => record.recordType === "order");
const pricingOrders = asArray<JsonObject>(pricing.orders, "pricing.orders");
const adoptionScope = String(payload.adoptionScope ?? "");
if (adoptionScope !== "payload") throw new Error("V3 publisher payload must opt into payload-scoped adoption.");

const expectedCategoryCounts: Record<string, number> = {
  consultation: 12,
  preventive: 12,
  lab: 30,
  imaging: 12,
  treatment: 18,
  dispensing: 16,
  "surgery/anesthesia": 8,
  inpatient: 6,
  emergency: 3,
  dental: 2,
  "certificate/misc": 1,
};

const collisionRules = [
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-consult-first", masterKey: "cm.order.consult.first-visit", expectedCustomName: "초진 진찰", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-consult-revisit", masterKey: "cm.order.consult.followup", expectedCustomName: "재진 진찰", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-dispensing-oral-basic", masterKey: "cm.order.dispensing.oral", expectedCustomName: "경구약 조제", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-imaging-us-abdomen", masterKey: "cm.order.imaging.abdominal-ultrasound", expectedCustomName: "복부 초음파", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-lab-cbc", masterKey: "cm.order.lab.panel.cbc-basic", expectedCustomName: "CBC 혈구검사", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-lab-chem10", masterKey: "cm.order.lab.panel.chemistry-basic", expectedCustomName: "혈액화학 10종", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-lab-ua", masterKey: "cm.order.lab.panel.urinalysis", expectedCustomName: "요검사", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-treatment-ear-clean", masterKey: "cm.order.treatment.ear-cleaning", expectedCustomName: "귀 세정", match: "exact_normalized_name" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-treatment-fluid-sc", masterKey: "cm.order.synthetic.treatment-02", expectedCustomName: "피하수액", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-vaccine-core", masterKey: "cm.order.synthetic.preventive-01", expectedCustomName: "종합백신", match: "reviewed_semantic_equivalence" },
  { workspaceId: "workspace-clair-cheongdam", customRowId: "cd-hospitalization-day", masterKey: "cm.order.synthetic.inpatient-01", expectedCustomName: "입원 1일", match: "reviewed_semantic_equivalence" },
] as const;

const baseline = {
  projectRef: "qmerxgzrwaaahpkhjqlc",
  releases: {
    count: 4,
    maxReleaseNo: 6,
    latestSourceFingerprint: "85cb291602f3d177ae11a075b4203bdf9e7cb9a3ac68c5a8245a5a90f739b7c7",
    releaseNoSequence: {
      name: "master.master_releases_release_no_seq",
      lastValue: 8,
      isCalled: true,
      nextReleaseNo: 9,
      exactAtExecution: true,
    },
    fullFingerprintRequiredAtExecution: true,
    note: "Exact read-only value captured after rollback rehearsals; sequence state is nontransactional, so the operator must rerun preflight and repin it immediately before any future candidate.",
  },
  masterRecordTypeCounts: {
    chart_group: 6,
    clinical_action: 12,
    lab_panel: 5,
    lab_test: 14,
    order: 31,
    order_category: 8,
    result_input_type: 4,
    species: 2,
    specimen_type: 5,
    task_route: 6,
    unit: 8,
  },
  labPublishStageCount: 172,
  labPublishStageFingerprint: "eac749d40ab0f0e88f9dabed2a5123b85933367d3fae4a3828ad37893e1a45c4",
  catalogFingerprints: {
    "workspace-clinical-master-pilot-v1": { rowCount: 31, fingerprint: "5fe7ba9e93a045076157a77e5c852a5712660f99a0d2afbb3064a143c7586de0", fullFingerprintRequiredAtExecution: true },
    "workspace-clair-cheongdam": { rowCount: 13, fingerprint: "82b9b2a3e9722093a65709a5a9dbdff19f709a8c00616a8203ec0b55f7d1d3c4", fullFingerprintRequiredAtExecution: true },
    "clair-demo": { rowCount: 19, fingerprint: "c195d802a07ef3f820aed21809bc7d7bf84fa5013ed4e98e4951e64f5242bcf1", fullFingerprintRequiredAtExecution: true },
    "clair-foreign-demo": { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945", fullFingerprintRequiredAtExecution: true },
  },
};

const priceCategoryByKey = new Map(
  pricingOrders.map((order) => [String(order.masterKey), String(order.researchCategory)]),
);
const counts = Object.fromEntries(
  Object.keys(expectedCategoryCounts).map((category) => [
    category,
    orders.filter((record) => priceCategoryByKey.get(String(record.masterKey)) === category).length,
  ]),
);
const orderKeys = orders.map((record) => String(record.masterKey));
const priceKeys = pricingOrders.map((order) => String(order.masterKey));
const prices = pricingOrders.map((order) => Number(order.syntheticWorkspacePriceKrw));
if (orderKeys.includes("cm.order.consult.initial") || priceKeys.includes("cm.order.consult.initial") || !orderKeys.includes("cm.order.consult.first-visit") || !priceKeys.includes("cm.order.consult.first-visit")) {
  throw new Error("Legacy consultation key must remain nonpayload/nonpricing; fresh first-visit key must be in both payload and pricing.");
}
const readbackBaselineSha256 = String(airtableManifest.casBaselineGate && (airtableManifest.casBaselineGate as JsonObject).baselineSha256);
const pricingKeyPriceSha256 = createHash("sha256")
  .update(pricingOrders.slice().sort((a, b) => String(a.masterKey).localeCompare(String(b.masterKey))).map((order) => `${order.masterKey}=${order.syntheticWorkspacePriceKrw}`).join("\n"))
  .digest("hex");
// SHA-256 of PostgreSQL jsonb ::text from the migrated database canonicalizer.
// The tracked replay proves both this explicit-scope hash and the historical
// no-scope hash; this is deliberately not derived with JSON.stringify.
const publisherSourceFingerprint = "0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893";
const publisherSourceFingerprintDerivation = {
  canonicalizer: "private.clinical_master_canonicalize_payload(jsonb)",
  serialization: "PostgreSQL jsonb ::text UTF-8",
  digest: "sha256",
  replayEvidence: "supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql",
  scopeEffect: "explicit adoptionScope=payload is included; omitted scope preserves historical canonical bytes",
};
const supportedMasterIdentityHistorySha256 = "8bbbcdbcfab3bf15aa69bcee87be4caab7aefaf9c3a73998640a8332dbb0b6b1";
const preV3HistoryFingerprints = {
  releases: "8b1632cb9f5bf28bea2d8dadc33ca5d30a1afa2b65c1fe4c5bae548fc0653ed8",
  masterRecordVersions: "0c0c30f610bc41cac7b84c171d14e3361ae337e9b59895d309c9462b83593c07",
  masterReviewEvents: "35c04f8d47dca5085f9b59df8e57dec7a0ce78e3deafb5e71b3bb7839f4ca635",
};
const stageFingerprints = {
  clinicalMasterLabPublishStage: "eac749d40ab0f0e88f9dabed2a5123b85933367d3fae4a3828ad37893e1a45c4",
  clinicalMasterLabTestPublishStage: "14b1c866a3e05897599c7eaec649a42988291f5a7acee5472472136e07925d9d",
  clinicalMasterLabPanelPublishStage: "8018ba5b345e8c6c79380645380a5a0b665cec056228299e324697e025a01369",
  clinicalMasterLabOrderPublishStage: "482d17f250f17fa607115df64e9dc7c31c661b54a2948c10500986b5dec5aea4",
};
const foreignSurfaceFingerprints = {
  order_catalog_items: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  lab_test_items: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  lab_test_item_versions: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  order_catalog_lab_test_item_links: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  workspace_master_updates: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  workspace_lab_item_updates: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  workspace_lab_catalog_updates: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  notification_events: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  notification_user_states: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
  audit_events: { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945" },
};

const sqlJsonLiteral = (value: unknown): string => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

const renderPureRollbackSql = (scope: "publisher_only" | "full", baselineMode: "local" | "remote"): string => {
  const source = readFileSync(rollbackSqlPath, "utf8");
  const beginIndex = source.indexOf("begin;");
  const doIndex = source.indexOf("do $phase_c$", beginIndex);
  const doEnd = source.indexOf("\n$phase_c$;", doIndex) + "\n$phase_c$;".length;
  if (beginIndex < 0 || doIndex < 0 || doEnd < doIndex) throw new Error("rollback SQL template markers missing");
  const setup = source.slice(beginIndex, doIndex);
  const insertStart = setup.indexOf("insert into clinical_master_operational_v3_phase_c_input(");
  const insertEnd = setup.indexOf(";", insertStart) + 1;
  if (insertStart < 0 || insertEnd <= insertStart) throw new Error("rollback input insert marker missing");
  const renderedInsert = `insert into clinical_master_operational_v3_phase_c_input(payload,pricing,rehearsal_scope,baseline_mode,expected_release_fingerprint,expected_pilot_fingerprint,expected_cheongdam_fingerprint,expected_demo_fingerprint,expected_foreign_fingerprint,expected_stage_fingerprint)\nvalues (${sqlJsonLiteral(payload)}, ${sqlJsonLiteral(pricing)}, '${scope}', '${baselineMode}', '${baseline.releases.latestSourceFingerprint}', '${baseline.catalogFingerprints["workspace-clinical-master-pilot-v1"].fingerprint}', '${baseline.catalogFingerprints["workspace-clair-cheongdam"].fingerprint}', '${baseline.catalogFingerprints["clair-demo"].fingerprint}', '${baseline.catalogFingerprints["clair-foreign-demo"].fingerprint}', '${baseline.labPublishStageFingerprint}');`;
  const renderedSetup = `${setup.slice(0, insertStart)}${renderedInsert}${setup.slice(insertEnd)}`;
  const body = source.slice(doIndex, doEnd);
  return `-- GENERATED by scripts/generate-clinical-master-operational-v3-phase-c.ts; do not edit.\n-- Management-API-compatible pure SQL: no psql meta-commands, variables, or file interpolation.\n${renderedSetup}${body}\nrollback;\nselect 'clinical_master_operational_v3_phase_c_rendered_rollback_ok' as replay_result;\n`;
};

const renderedPureRollbackSql = renderPureRollbackSql("publisher_only", "local");
const renderedRemotePureRollbackSql = renderPureRollbackSql("full", "remote");
const renderPersistentCommitSql = (): string => {
  let rendered = renderedRemotePureRollbackSql;
  const replacements: Array<[string, string]> = [
    ["  v_sequence_restore_last_value bigint;\n  v_sequence_restore_is_called boolean;\n", ""],
    ["  v_sequence_restore_last_value := v_before_release_sequence_last_value;\n  v_sequence_restore_is_called := v_before_release_sequence_is_called;\n", ""],
    ["  -- nextval() is intentionally outside ordinary transaction rollback. Keep\n  -- every operation after the publisher inside this guarded block so every\n  -- error path restores the preflight sequence state before re-raising.\n", "  -- nextval() is nontransactional. Keep every operation after the publisher\n  -- inside this guarded block; failures abort data writes but may consume a gap.\n"],
    ["  -- the call itself. Restore the caller role/claims before the outer rollback.\n", "  -- the call itself. Restore the caller role/claims before the outer commit.\n"],
    [
      "  perform setval(v_release_sequence,v_sequence_restore_last_value,v_sequence_restore_is_called);\n  execute format('select last_value,is_called from %s',v_release_sequence) into v_before_release_sequence_last_value,v_before_release_sequence_is_called;\n  if v_before_release_sequence_last_value<>v_sequence_restore_last_value or v_before_release_sequence_is_called is distinct from v_sequence_restore_is_called then raise exception 'clinical_master_phase_c_release_sequence_restore_failed'; end if;\n",
      "  -- Persistent execution must never rewind a sequence below a committed release.\n  -- A failed attempt may consume a gap; rerun read-only preflight and regenerate.\n",
    ],
    ["    when query_canceled then\n      perform setval(v_release_sequence,v_sequence_restore_last_value,v_sequence_restore_is_called);\n      raise;", "    when query_canceled then\n      raise;"],
    ["    when others then\n      perform setval(v_release_sequence,v_sequence_restore_last_value,v_sequence_restore_is_called);\n      raise;", "    when others then\n      raise;"],
    ["rollback;\nselect 'clinical_master_operational_v3_phase_c_rendered_rollback_ok' as replay_result;", "commit;\nselect 'clinical_master_operational_v3_phase_c_commit_candidate_ok' as execution_result;"],
  ];
  for (const [before, after] of replacements) {
    if (!rendered.includes(before)) throw new Error(`commit candidate transform marker missing: ${before.slice(0, 80)}`);
    rendered = rendered.replace(before, after);
  }
  if (rendered.includes("perform setval(v_release_sequence")) throw new Error("commit candidate must not rewind the release sequence");
  if (rendered.includes("v_sequence_restore_")) throw new Error("commit candidate must not retain sequence-restore state");
  if (/^rollback;$/m.test(rendered)) throw new Error("commit candidate must not contain a top-level rollback");
  return rendered.replace(
    "-- GENERATED by scripts/generate-clinical-master-operational-v3-phase-c.ts; do not edit.",
    "-- GENERATED persistent COMMIT candidate; do not edit.\n-- One top-level atomic transaction contains three ordered workspace logical stop-on-error blocks.\n-- Any workspace failure aborts the whole transaction, so cross-workspace partial commit is impossible.\n-- First-run exact baseline only; after any failed attempt rerun preflight and regenerate because sequence gaps are not rewound.",
  );
};
const renderedPersistentCommitSql = renderPersistentCommitSql();

if (orders.length !== 120) throw new Error(`expected 120 orders, got ${orders.length}`);
if (records.length !== 230) throw new Error(`expected 230 supported records, got ${records.length}`);
if (JSON.stringify(counts) !== JSON.stringify(expectedCategoryCounts)) {
  throw new Error(`category distribution drift: ${JSON.stringify(counts)}`);
}
if (new Set(orderKeys).size !== 120 || new Set(priceKeys).size !== 120) throw new Error("order keys must be unique");
if (new Set(prices).size !== 120 || prices.some((price) => !Number.isInteger(price) || price <= 0)) {
  throw new Error("pricing fixture must contain 120 unique positive integer prices");
}
if (JSON.stringify([...orderKeys].sort()) !== JSON.stringify([...priceKeys].sort())) {
  throw new Error("pricing fixture must cover exactly the 120 publisher order keys");
}
if (String(pricing.releaseKey) !== String(payload.releaseKey)) throw new Error("pricing release key drift");
if (String(pricing.totalSyntheticWorkspacePriceKrw) !== "5529073") throw new Error("pricing total drift");
if (String(airtableManifest.writeAllowed) !== "false" || Number(airtableManifest.mutationsPerformed) !== 0) {
  throw new Error("Airtable manifest must remain no-write");
}
if (JSON.stringify(airtableFinalReadback.tableCounts) !== JSON.stringify({
  "Release Drafts": 1,
  Sources: 1,
  "Master Records": 254,
  Names: 254,
  "Classification Paths": 13,
  "Lab Panel Items": 60,
  "Lab Order Profiles": 30,
  "Diagnosis Category Links": 12,
}) || airtableFinalReadback.mutationScope !== "read-only-final-verified") {
  throw new Error("Final Airtable readback must be the exact post-write 254/254/13/60/30/12 read-only snapshot.");
}
const airtableDeltaMaster = ((airtableDeltaManifest.tables as JsonObject)?.["Master Records"] as JsonObject | undefined);
const airtableDeltaUpdates = (airtableDeltaMaster?.updatePayloads as JsonObject[] | undefined) ?? [];
if (airtableDeltaManifest.schemaVersion !== "clinical-master-airtable-final-delta-manifest/v1"
    || airtableDeltaManifest.writeAllowed !== false
    || airtableDeltaManifest.mutationsPerformed !== 0
    || airtableDeltaMaster?.updateExisting !== 1
    || airtableDeltaMaster?.create !== 0
    || (airtableDeltaUpdates[0] as JsonObject | undefined)?.recordId !== "recZW92s9i06wpNp0") {
  throw new Error("Final Airtable delta manifest must contain only the audited recZW92s9i06wpNp0 identity fork.");
}
if (collisionRules.find((rule) => rule.customRowId === "cd-consult-first")?.masterKey !== "cm.order.consult.first-visit") {
  throw new Error("Cheongdam custom-wins consultation collision must target the fresh v3 first-visit key.");
}

const manifest: JsonObject = {
  schemaVersion: "clinical-master-phase-c-operation-v1",
  status: "commit_candidate_pending_human_review",
  writeAllowed: false,
  mutationsPerformed: 0,
  remoteWritesPerformed: false,
  authorityBoundary: "synthetic-only; read-only remote preflight; local Docker rollback rehearsal only",
  inputs: {
    projectRef: baseline.projectRef,
    adapterFixture: "tests/fixtures/clinical-master-operational-v3-adapter-output.json",
    adapterFixtureSha256: sha256File(adapterPath),
    adapterAdoptionScope: adoptionScope,
    pricingFixture: "tests/fixtures/clinical-master-operational-v3-pricing-adoption.json",
    pricingFixtureSha256: sha256File(pricingPath),
    airtableWriteManifest: "tests/fixtures/clinical-master-operational-v3-airtable-write-manifest.json",
    airtableWriteManifestSha256: sha256File(airtableManifestPath),
    airtableReadbackFixture: "tests/fixtures/clinical-master-airtable-operational-v3-current-readback.json",
    airtableReadbackFixtureSha256: sha256File(airtableReadbackPath),
    airtableFinalReadbackFixture: "tests/fixtures/clinical-master-airtable-operational-v3-final-readback.json",
    airtableFinalReadbackFixtureSha256: sha256File(airtableFinalReadbackPath),
    airtableDeltaManifest: "tests/fixtures/clinical-master-operational-v3-airtable-delta-manifest.json",
    airtableDeltaManifestSha256: sha256File(airtableDeltaManifestPath),
    remotePreflightQuery: "supabase/snippets/clinical_master_operational_v3_phase_c_preflight.sql",
    remotePreflightQuerySha256: sha256File(remotePreflightQueryPath),
    rollbackSqlTemplate: "supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql",
    rollbackSqlTemplateSha256: sha256File(rollbackSqlPath),
    releaseScopedAdoptionMigration: "supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql",
    releaseScopedAdoptionMigrationSha256: sha256File(releaseScopedMigrationPath),
    releaseScopedAdoptionSpec: "tests/clinical-master-release-scoped-workspace-adoption.spec.ts",
    releaseScopedAdoptionSpecSha256: sha256File(releaseScopedSpecPath),
    releaseScopedAdoptionReplay: "supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql",
    releaseScopedAdoptionReplaySha256: sha256File(releaseScopedReplayPath),
    airtableCasBaselineSha256: readbackBaselineSha256,
    payloadRecordCount: records.length,
    orderCount: orders.length,
    categoryCounts: expectedCategoryCounts,
    publisherSourceFingerprint: publisherSourceFingerprint,
    publisherSourceFingerprintDerivation,
    pricingKeyPriceSha256,
  },
  preflight: {
    remoteReadOnlyBaseline: baseline,
    failClosedOnAnyMismatch: true,
    requiredChecks: [
      "project ref and approved release/source payload locks",
      "release count/max/fingerprint, release-number sequence name/last_value/is_called, and supported master type counts",
      "stage count plus per-existing-release stage fingerprint",
      "supported master identity and pre-v3 version/review history fingerprints",
      "pre-v3 workspace order/lab update history fingerprints",
      "workspace catalog row counts/fingerprints and foreign negative-control fingerprint",
      "foreign catalog, lab, update-ledger, notification, and audit fingerprints",
      "read-only query output for the full latest-release plus four workspace catalog fingerprints",
      "publisher/adopter/catalog/review function signatures, owner, security definer, fixed search_path, and ACL",
      "required named constraints and source-lineage indexes",
      "active hospital_admin membership selected deterministically per target without printing user IDs",
      "selected actor has service_catalog:manage and lab resolver has fixed search_path with anon/service_role denied",
    ],
  },
  rpcContracts: {
    publisher: { signature: "private.publish_clinical_master_release(jsonb,uuid)", securityBoundary: "private; effective EXECUTE denied for anon, authenticated, and service_role" },
    adopter: { signature: "private.clair_adopt_master_release_to_workspace(text,uuid)", securityBoundary: "private; effective EXECUTE denied for anon, authenticated, and service_role" },
    catalogWriter: { signature: "public.clair_update_order_catalog_item(text,text,integer,jsonb)", securityBoundary: "authenticated only; CAS revision" },
    orderReviewResolver: { signature: "public.clair_resolve_workspace_master_update(text,uuid,integer,text)", securityBoundary: "authenticated only; accept_source/dismiss" },
    labReviewResolver: { signature: "public.clair_resolve_workspace_lab_definition_update(text,uuid,uuid,integer,text)", securityBoundary: "authenticated only; accept/reject" },
  },
  authenticatedExecution: {
    actorSelection: "active hospital_admin with owner/admin role precedence, then created_at/user_id; user IDs are never printed",
    claimKeys: ["request.jwt.claim.sub", "request.jwt.claims"],
    claimShape: "{sub: selected actor UUID, role: authenticated}",
    roleBoundary: "set local role authenticated only for each public RPC; restore postgres role and caller claims after every call and before rollback",
  },
  publishPlan: {
    releaseKey: String(payload.releaseKey),
    adoptionScope,
    recordCount: records.length,
    sourceFingerprint: publisherSourceFingerprint,
    sourceFingerprintPolicy: "runtime publisher result and database canonicalizer digest must equal this exact replay-verified PostgreSQL jsonb fingerprint",
    calls: ["publish once", "retry exact identical payload once; require same releaseId/releaseNo/sourceFingerprint/recordCount and idempotent=true"],
    releaseNo: "derive as preflight releaseNoSequence.lastValue + 1; require it to be greater than maxReleaseNo and unique; fail if sequence or release baseline changes",
    preserve: ["all existing master_records, versions, review events, releases, and pre-existing stage rows"],
  },
  adoptionPlan: {
    allowlist: ["workspace-clinical-master-pilot-v1", "workspace-clair-cheongdam", "clair-demo"],
    excluded: [{ workspaceId: "clair-foreign-demo", policy: "read_only_pre_post_fingerprint_no_write" }],
    transactionBoundary: "persistent candidate uses one top-level atomic transaction with three ordered workspace logical stop-on-error blocks; any failure aborts all central and workspace writes, so cross-workspace partial commit is impossible",
    sequence: ["private payload-scoped adoption using the persisted release owner scope", "price all 120 payload orders through the public authenticated CAS RPC", "resolve the exact payload-linked pending/new review row at the current item/master revision through the public authenticated resolver with a fresh CAS/readback", "require version-backed accepted/new coverage for every payload order, including legacy v2-held rows, and reject any linked pending row outside the exact current-source join", "activate all 120 payload master orders through the public authenticated CAS RPC", "pause only the 11 reviewed Cheongdam collision master rows", "assert custom and lineage/lab/audit invariants"],
    orderReviewBoundary: "one strict review pass per workspace: pending/new rows are eligible only when item/source/master identity, source revision, previous/workspace snapshot nullability, independently published update and held-version releases, held releaseNo <= update releaseNo <= v3 releaseNo, exact source projection/fingerprint, and positive price all match; update release identity is never required to equal the held version release; legacy v2-held payload rows remain eligible, while the nonpayload legacy initial and metabolic rows are excluded from payload adoption and left pending",
    preActivationReviewCoverage: "every payload catalog must resolve to the exact current source revision and fingerprint; an accepted actor/time-bearing update_type=new row must be version-backed at the current item/master revision with separate published update/version releases ordered held <= update <= v3, the exact immutable version snapshot, resolvedAt and resolved actor evidence, at most one eligible pending row may exist, and no linked pending update may remain; missingAccepted and pendingLinked diagnostics remain explicit; legacy nonpayload rows are fingerprinted before/after and must remain untouched",
    finalCounts: "derive from live preflight rows, lineage, collision map, and RPC results; never assume 120 total catalog rows",
  },
  collisionPolicy: {
    matching: ["exact normalized display-name match", "reviewed semantic equivalence map below"],
    customWins: true,
    deleteCustomRows: false,
    existingMasterLineage: "update in place by source_master_record_id; never create a second active choice for the same master key",
    reviewedRules: collisionRules,
    pauseOnly: "newly adopted v3 master rows that map to a preserved workspace_custom row",
  },
  legacyNonPayloadGuard: {
    masterKey: "cm.order.consult.initial",
    policy: "capture exact item/version/name/source/type/species and all linked update rows before adoption; require identical post fingerprint and leave any pending legacy update unresolved",
    workspaceScope: "all allowlisted workspaces where the legacy row exists",
  },
  freshKeyPreflightAbsence: {
    masterKey: "cm.order.consult.first-visit",
    requireAbsentBeforePublish: true,
    surfaces: ["Airtable Master Records", "central master.master_records", "allowlisted order_catalog_items", "allowlisted workspace_master_updates", "workspace pricing", "collision map", "Order Set references"],
    postPublish: "exactly one canonical order master row at revision 1 with a published v3 version snapshot; all 120 v3 order catalogs resolve to the fresh/current payload key set",
  },
  pricingPlan: {
    orderCount: pricingOrders.length,
    totalSyntheticWorkspacePriceKrw: Number(pricing.totalSyntheticWorkspacePriceKrw),
    amountPolicy: "positive integer KRW; category base + category serial; workspace fixture only",
    priceRows: pricingOrders.map((order) => ({
      masterKey: order.masterKey,
      researchCategory: order.researchCategory,
      categoryPriceBase: order.categoryPriceBase,
      categoryPriceSerial: order.categoryPriceSerial,
      syntheticWorkspacePriceKrw: order.syntheticWorkspacePriceKrw,
    })),
    forbiddenPublisherKeys: ["priceKrw", "price_krw", "weightTier", "orderSet", "orderSetId"],
    keyPriceSha256: pricingKeyPriceSha256,
  },
  labPlan: {
    sourceLabRecords: { tests: 36, referencedTests: 30, panels: 10, panelItems: 60, profiles: 30 },
    expectedAdoptionProjection: {
      catalogCount: { v3Final: 30, rpcSemantics: "exact payload-manifest lab order owners only; existing nonpayload catalogs are excluded" },
      createdItemCount: { semantics: "new lab-test versions only; baseline plus delta must equal the exact 30-test payload target-ID set", strictV3ReferencedTests: 30 },
      createdLinkCount: { semantics: "projection attempts from exact payload-manifest catalog profiles only; not a creation delta", v3Final: 80 },
      workspaceLinkAttemptContract: { profiles: 30, directProfiles: 20, panelProfiles: 10, panelItems: 60, expandedLinks: 80, formula: "20 direct-test profiles + 60 panel items = 80 links" },
      finalUniqueProjection: { catalogs: 30, tests: 30, links: 80 },
      idempotentRetry: { catalogCount: "same exact payload total", createdItemCount: 0, createdLinkCount: "same exact payload attempt total", finalUniqueProjection: { catalogs: 30, tests: 30, links: 80 } },
    },
    frozenEligibleTargetSet: {
      semantics: "before each workspace adopter call, freeze the exact set of lab-test master IDs from v3 payload-manifest order profiles and pinned panel expansions; payload-scoped adoption excludes both missing and existing nonpayload initial/metabolic orders",
      identityPolicy: ["reject null target IDs or revisions", "reject duplicate targets within one pinned profile", "reject duplicate or ambiguous master-key/record-ID identities", "use the frozen target-ID set for every version count and semantic fingerprint"],
      retryPolicy: "after-before version-row count equals returned createdItemCount; retry createdItemCount is 0 with unchanged frozen-set count and fingerprint",
    },
    projectionAssertions: ["central payload defines 36 lab tests; only 30 referenced test keys are projected", "one source lab item per (workspace,source master test)", "one link per (workspace,catalog item,lab_test item,link origin)", "all links and profiles pin source master record and revision", "20 direct-test profiles plus 60 panel items expand to exactly 80 payload-linked workspace lab links", "payload mode does not create missing nonpayload initial/metabolic rows and leaves an existing pinned metabolic catalog, projection, versions, links, updates, and notifications byte-identical", "createdItemCount is baseline-plus-delta over the exact payload target-ID set; createdLinkCount is the exact payload projection-attempt total", "before/after/retry lab_test_item_versions counts and ordered semantic SHA use the exact payload target-ID set", "second adopter returns createdItemCount 0 and leaves the exact payload projection unchanged"],
    reviewBoundary: "resolve B1 item/catalog review targets only through public.clair_resolve_workspace_lab_definition_update",
  },
  rollbackRehearsal: {
    sql: "supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql",
    renderedSql: "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_rendered.sql",
    remoteRenderedSql: "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_remote_rendered.sql",
    defaultScope: "full",
    localScope: "publisher_only with baseline_mode=local when the local seed lacks the three approved target workspaces",
    order: ["capture baseline and protected fingerprints", "publish v3", "retry identical v3", "adopt target workspaces independently", "price/review/activate/pause through authenticated RPCs", "assert foreign unchanged and lineage/review/audit invariants", "ROLLBACK", "fresh-connection residual proof"],
    noDirectDml: true,
    noRemoteExecution: true,
    renderedSqlPolicy: "pure SQL generated from this fixture and SQL template; executable by supabase db query --linked; always ROLLBACK",
    renderedSqlSha256: createHash("sha256").update(renderedPureRollbackSql).digest("hex"),
    remoteRenderedSqlMode: { rehearsalScope: "full", baselineMode: "remote", execution: "human-approved remote read-only-gated candidate; never executed in this handoff" },
    remoteRenderedSqlSha256: createHash("sha256").update(renderedRemotePureRollbackSql).digest("hex"),
  },
  persistentCommitCandidate: {
    sql: "supabase/snippets/clinical_master_operational_v3_phase_c_commit_candidate.sql",
    sha256: createHash("sha256").update(renderedPersistentCommitSql).digest("hex"),
    transactionBoundary: "one top-level atomic transaction; three ordered workspace logical stop-on-error blocks; any failure aborts every central and workspace write",
    workspaceOrder: ["workspace-clinical-master-pilot-v1", "workspace-clair-cheongdam", "clair-demo"],
    retryPolicy: "first-run exact baseline only; publisher is exercised idempotently inside the transaction; after failure rerun read-only preflight and regenerate because sequence gaps are never rewound; after success the old baseline fails closed",
    sequencePolicy: "never call setval in persistent execution; committed release 9 leaves the sequence at 9; failed attempts may consume gaps",
    derivation: "exact full/remote rollback candidate with only sequence-rewind removal and terminal ROLLBACK-to-COMMIT/result-label transformation",
    noPsqlMetaCommands: true,
    noRemoteExecution: true,
  },
  protectedFingerprints: {
    supportedMasterIdentityHistorySha256,
    preV3HistoryFingerprints,
    stageFingerprints,
    foreignSurfaceFingerprints,
    sixExactRemoteConstants: {
      release: baseline.releases.latestSourceFingerprint,
      stage: baseline.labPublishStageFingerprint,
      pilot: baseline.catalogFingerprints["workspace-clinical-master-pilot-v1"].fingerprint,
      cheongdam: baseline.catalogFingerprints["workspace-clair-cheongdam"].fingerprint,
      demo: baseline.catalogFingerprints["clair-demo"].fingerprint,
      foreign: baseline.catalogFingerprints["clair-foreign-demo"].fingerprint,
    },
  },
  staticSafety: {
    noOrderSets: true,
    noClinicalClaimsDosingRanges: true,
    noRealHospitalPatientData: true,
    noAirtableWrites: true,
    noSupabaseRemoteWrites: true,
    noDirectCatalogReviewAuditDml: true,
    noPrintedUserIds: true,
  },
};

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
const check = process.argv.includes("--check");
if (check) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== serialized) throw new Error(`phase-c operation manifest drift: ${outputPath}`);
  const currentPureSql = readFileSync(pureRollbackSqlPath, "utf8");
  if (currentPureSql !== renderedPureRollbackSql) throw new Error(`rendered rollback SQL drift: ${pureRollbackSqlPath}`);
  const currentRemotePureSql = readFileSync(remotePureRollbackSqlPath, "utf8");
  if (currentRemotePureSql !== renderedRemotePureRollbackSql) throw new Error(`rendered remote rollback SQL drift: ${remotePureRollbackSqlPath}`);
  const currentPersistentCommitSql = readFileSync(persistentCommitSqlPath, "utf8");
  if (currentPersistentCommitSql !== renderedPersistentCommitSql) throw new Error(`persistent commit SQL drift: ${persistentCommitSqlPath}`);
  console.log(`phase-c operation manifest PASS ${sha256File(outputPath)}`);
  console.log(`phase-c rendered rollback PASS ${sha256File(pureRollbackSqlPath)}`);
  console.log(`phase-c remote rendered rollback PASS ${sha256File(remotePureRollbackSqlPath)}`);
  console.log(`phase-c persistent commit candidate PASS ${sha256File(persistentCommitSqlPath)}`);
} else {
  writeFileSync(outputPath, serialized);
  writeFileSync(pureRollbackSqlPath, renderedPureRollbackSql);
  writeFileSync(remotePureRollbackSqlPath, renderedRemotePureRollbackSql);
  writeFileSync(persistentCommitSqlPath, renderedPersistentCommitSql);
  console.log(`phase-c operation manifest written ${outputPath}`);
  console.log(`phase-c rendered rollback written ${pureRollbackSqlPath}`);
  console.log(`phase-c remote rendered rollback written ${remotePureRollbackSqlPath}`);
  console.log(`adapter=${sha256File(adapterPath)} pricing=${sha256File(pricingPath)} manifest=${sha256File(outputPath)} renderedRollback=${sha256File(pureRollbackSqlPath)} remoteRenderedRollback=${sha256File(remotePureRollbackSqlPath)} persistentCommit=${sha256File(persistentCommitSqlPath)}`);
}
