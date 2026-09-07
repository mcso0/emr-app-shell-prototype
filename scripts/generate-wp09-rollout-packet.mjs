// Offline operator packet renderer. Does not connect, migrate, publish or adopt.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizePostgresJsonbText, hashCanonical } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { wp09WorkspaceAllowlist, wp09ForeignControl } from "./generate-wp09-workspace-configuration.mjs";

export const wp09FingerprintTables = ["order_catalog_items", "lab_test_items", "lab_test_item_versions",
  "order_catalog_lab_test_item_links", "orders", "order_tasks", "order_task_events", "order_confirmation_commands",
  "order_fulfillment_work_items", "order_billing_candidates", "lab_result_entries", "lab_result_entry_rows",
  "order_sets", "order_set_revisions", "order_execution_result_versions", "lab_atomic_retest_requests",
  "workspace_lab_devices", "workspace_lab_result_profile_bindings", "workspace_lab_profile_events",
  "workspace_lab_composition_revisions", "workspace_lab_composition_apply_requests", "workspace_lab_profile_override_versions",
  "audit_events", "workspace_master_updates", "workspace_lab_item_updates", "workspace_lab_catalog_updates", "lab_test_categories",
  "notification_events", "notification_user_states"];
const pgSha = value => createHash("sha256").update(canonicalizePostgresJsonbText(value)).digest("hex");
const hashPattern = /^[a-f0-9]{64}$/;

export function buildWp09RolloutPacket(source, configuration, combined, preflight) {
  if (source.applied !== false || configuration.applied !== false || combined.applied !== false
    || hashCanonical(source.payload) !== source.candidateSemanticSha256
    || hashCanonical(combined.payload) !== combined.candidateSemanticSha256
    || source.sourceCandidateSemanticSha256 !== combined.candidateSemanticSha256
    || configuration.sourceCandidateSemanticSha256 !== source.candidateSemanticSha256
    || configuration.sourceArtifactSha256 !== hashCanonical(source)) throw Error("rollout_source_chain_mismatch");
  const { artifactSha256, ...configurationBody } = configuration;
  if (hashCanonical(configurationBody) !== artifactSha256) throw Error("rollout_configuration_hash_mismatch");
  if (JSON.stringify(configuration.workspaceAllowlist) !== JSON.stringify(wp09WorkspaceAllowlist)
    || configuration.foreignControl !== wp09ForeignControl) throw Error("rollout_workspace_scope_mismatch");
  const expectedFingerprints = [...wp09WorkspaceAllowlist, wp09ForeignControl]
    .flatMap(workspaceId => wp09FingerprintTables.map(tableName => `${workspaceId}:${tableName}`));
  if (!Array.isArray(preflight?.fingerprints) || JSON.stringify(preflight.fingerprints.map(row => `${row.workspaceId}:${row.tableName}`)) !== JSON.stringify(expectedFingerprints)
    || preflight.fingerprints.some(row => !Number.isInteger(row.count) || row.count < 0 || !hashPattern.test(row.sha256))) throw Error("rollout_fingerprint_scope_mismatch");
  const orders = new Map(source.payload.records.filter(row => row.recordType === "order").map(row => [row.masterKey, row]));
  if (!Array.isArray(preflight.rebind) || preflight.rebind.length !== 324
    || !Array.isArray(preflight.labItems) || preflight.labItems.length !== 207) throw Error("rollout_frozen_targets_missing");
  for (const workspaceId of wp09WorkspaceAllowlist) {
    const rebind = preflight.rebind.filter(row => row.workspaceId === workspaceId);
    const labs = preflight.labItems.filter(row => row.workspaceId === workspaceId);
    if (rebind.length !== 108 || new Set(rebind.map(row => row.catalogId)).size !== 108 || new Set(rebind.map(row => row.masterKey)).size !== 108
      || labs.length !== 69 || new Set(labs.map(row => row.id)).size !== 69) throw Error("rollout_frozen_target_scope_mismatch");
    if (rebind.some(row => !hashPattern.test(row.catalogSha256) || !hashPattern.test(row.profileSha256)
      || row.presetSha256 !== orders.get(row.masterKey)?.detail.executionPreset.contentSha256
      || !Number.isInteger(row.catalogRevision) || row.catalogRevision < 1)
      || labs.some(row => !hashPattern.test(row.rowSha256))) throw Error("rollout_frozen_target_hash_mismatch");
  }
  const packet = { payload: source.payload, configuration,
    retiredKeys: combined.retirementPlan.map(row => row.originalMasterKey), newKeys: combined.newOrders,
    preflight: { fingerprints: preflight.fingerprints, rebind: preflight.rebind, labItems: preflight.labItems } };
  return { schemaVersion: 1, applied: false, runtimeImportAllowed: false,
    sourceCandidateSemanticSha256: source.candidateSemanticSha256, configurationSha256: artifactSha256,
    packetSha256: pgSha(packet), packet };
}

export function renderWp09RolloutSql(artifact, commit = false) {
  if (typeof commit !== "boolean" || artifact.applied !== false || pgSha(artifact.packet) !== artifact.packetSha256) throw Error("rollout_sql_packet_hash_mismatch");
  const delimiter = `$oed_${artifact.packetSha256}$`;
  const body = JSON.stringify(artifact.packet);
  if (body.includes(delimiter)) throw Error("rollout_sql_delimiter_collision");
  // The exact synthetic operator was verified active with manage permission in
  // all three workspaces. Transaction-local claims cannot leak to another call.
  return `-- ${commit ? "PERSISTENT apply: only after exact candidate approval and successful same-packet rehearsal." : "ROLLBACK rehearsal: helper retains only returned evidence."}\n`
    + `with actor as materialized (select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true))\n`
    + `select private.clair_apply_oed_20260906_candidate(${delimiter}${body}${delimiter}::jsonb,'${artifact.packetSha256}',${commit}) as outcome from actor;\n`;
}

export function renderWp09PreflightSql(source) {
  if (source.applied !== false || hashCanonical(source.payload) !== source.candidateSemanticSha256) throw Error("rollout_preflight_source_hash_mismatch");
  const hashes = Object.fromEntries(source.payload.records.filter(row => row.recordType === "order")
    .map(row => [row.masterKey, row.detail.executionPreset.contentSha256]));
  const literal = `'${JSON.stringify(hashes).replaceAll("'", "''")}'::jsonb`;
  const workspaces = wp09WorkspaceAllowlist.map(value => `'${value}'`).join(",");
  return `-- READ ONLY; run after reviewed prerequisite migrations, immediately before the same-packet rehearsal.\n`
    + `select jsonb_build_object('fingerprints',private.clair_oed_20260906_fingerprints(),\n`
    + `'rebind',(select jsonb_agg(jsonb_build_object('workspaceId',i.workspace_id,'catalogId',i.id,'catalogRevision',i.catalog_revision,\n`
    + `'catalogSha256',private.clinical_master_sha256(to_jsonb(i)),'masterKey',m.master_key,'profileId',p.id,'profileRevision',p.profile_revision,\n`
    + `'profileSha256',private.clinical_master_sha256(to_jsonb(p)),'presetSha256',(${literal})->>m.master_key) order by i.workspace_id,i.id)\n`
    + `from public.order_catalog_items i join master.master_records m on m.id=i.source_master_record_id\n`
    + `join master.dispensing_order_profiles p on p.id=i.source_dispensing_profile_id and p.profile_revision=i.source_dispensing_profile_revision\n`
    + `where i.workspace_id in (${workspaces})),\n`
    + `'labItems',(select jsonb_agg(jsonb_build_object('workspaceId',i.workspace_id,'id',i.id,'masterKey',m.master_key,\n`
    + `'sourceMasterRecordId',i.source_master_record_id,'sourceMasterRevision',i.source_master_revision,'workspaceResultRevision',i.workspace_result_revision,\n`
    + `'rowSha256',private.clinical_master_sha256(to_jsonb(i))) order by i.workspace_id,i.id)\n`
    + `from public.lab_test_items i join master.master_records m on m.id=i.source_master_record_id\n`
    + `where i.workspace_id in (${workspaces}) and i.customization_state='unmodified')) as preflight;\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [preflightPath, outputPrefix] = process.argv.slice(2);
  const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/";
  const read = name => JSON.parse(readFileSync(folder + name, "utf8"));
  if (preflightPath === "--preflight-sql" && outputPrefix) {
    writeFileSync(outputPrefix, renderWp09PreflightSql(read("remote-release.non-applied.v1.json")));
    console.log(JSON.stringify({ applied: false, networkOperations: 0, output: outputPrefix }));
    process.exit(0);
  }
  if (!preflightPath || !outputPrefix) throw Error("Usage: node scripts/generate-wp09-rollout-packet.mjs <fresh-post-migration-preflight.json|--preflight-sql> <output-prefix|query.sql>");
  const artifact = buildWp09RolloutPacket(read("remote-release.non-applied.v1.json"), read("workspace-configuration.non-applied.v1.json"),
    read("combined-release.non-applied.v1.json"), JSON.parse(readFileSync(preflightPath, "utf8")));
  writeFileSync(`${outputPrefix}.json`, JSON.stringify(artifact, null, 2) + "\n");
  writeFileSync(`${outputPrefix}.rehearsal.sql`, renderWp09RolloutSql(artifact));
  writeFileSync(`${outputPrefix}.apply.sql`, renderWp09RolloutSql(artifact, true));
  console.log(JSON.stringify({ packetSha256: artifact.packetSha256, applied: false, networkOperations: 0 }));
}
