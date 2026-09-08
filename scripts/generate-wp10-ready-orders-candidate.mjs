// Offline proposal only. Source/preset identities are pinned by a remote read;
// this generator never publishes or changes workspace data.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hashCanonical, publisherContentHash } from "./generate-clinical-master-execution-preset-release-v1.mjs";

const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/";
const read = name => JSON.parse(readFileSync(folder + name, "utf8"));
const source = read("wp-09/remote-release.non-applied.v1.json");
const preflight = read("wp-10/current-master.preflight.v1.json");
const current = new Map(preflight.rows.map(row => [row.master_key, row]));
const retired = read("wp-10/retired-records.preflight.v1.json");
const retiredPresets = new Map(read("wp-10/retired-presets.preflight.v1.json").map(row => [row.master_key, row.preset]));
const payload = structuredClone(source.payload);
payload.releaseKey = "cm.release.ready-orders.2026-09-08.v1";
payload.releaseNotes = "Synthetic planning defaults and retired legacy identities. Actual results remain explicit execution records.";
const retiredKeys = retired.map(row => row.master_key).sort();
const selectableKeys = payload.records.filter(row => row.recordType === "order").map(row => row.masterKey).sort();
if (current.size !== 575 || retiredKeys.length !== 51 || selectableKeys.length !== 524) throw Error("wp10_source_identity_mismatch");
for (const row of retired) {
  const { revision, labOrderProfiles, ...record } = row.snapshot;
  const preset = retiredPresets.get(row.master_key);
  if (!preset) throw Error("wp10_retired_preset_missing");
  record.detail.executionPreset = {
    presetId: preset.id, presetKey: preset.preset_key, presetRevision: preset.preset_revision,
    clinicalOrderType: preset.clinical_order_type, detailSchemaVersion: preset.detail_schema_version,
    defaultDetailInputs: preset.default_detail_inputs, fieldPolicies: preset.field_policies,
    provenance: preset.provenance, presetStatus: preset.preset_status, clinicalUseAllowed: preset.clinical_use_allowed,
    contentSha256: preset.content_sha256, sourceArtifactSha256: preset.source_artifact_sha256,
  };
  payload.records.push(record);
}
const changes = [];
for (const record of payload.records.filter(row => row.recordType === "order")) {
  const prior = current.get(record.masterKey);
  const preset = record.detail.executionPreset;
  if (!prior || preset.presetId !== prior.preset_id || preset.presetRevision !== prior.preset_revision
    || preset.contentSha256 !== prior.content_sha256) throw Error(`wp10_source_drift:${record.masterKey}`);
  const reasons = [];
  if (retiredKeys.includes(record.masterKey)) {
    record.lifecycleStatus = "deprecated";
    // A new retirement revision never inherits a historical clinical review.
    preset.presetStatus = "synthetic_unreviewed";
    preset.clinicalUseAllowed = false;
    reasons.push("retire_legacy_future_selection");
  } else if (["consultation", "system_exam", "other"].includes(preset.clinicalOrderType)) {
    preset.detailSchemaVersion = 2;
    if (preset.clinicalOrderType === "system_exam") {
      for (const key of ["findingSummary", "abnormalFindings"]) {
        delete preset.defaultDetailInputs[key]; delete preset.fieldPolicies[key];
      }
    }
    reasons.push("explicit_actual_after_plan_confirmation");
  } else if (preset.clinicalOrderType === "treatment" && preset.defaultDetailInputs.administrationPolicy === "separate_medication_order") {
    preset.detailSchemaVersion = 3;
    reasons.push("medication_link_required_before_execution");
  } else if (record.masterKey === "cm.order.lab.test.giardia-antigen") {
    preset.defaultDetailInputs.specimenType = "feces";
    preset.fieldPolicies.specimenType = "derived_from_profile";
    reasons.push("authored_feces_specimen");
  }
  if (!reasons.length) continue;
  preset.presetRevision = prior.latest_preset_revision + 1;
  preset.provenance = { ...preset.provenance, sourceType: "synthetic-ready-orders-v1",
    sourceNotes: `${preset.provenance.sourceNotes} WP10: ${reasons.join(", ")}; no actual result defaults.` };
  preset.sourceArtifactSha256 = hashCanonical({ source: source.candidateSemanticSha256, preflight: hashCanonical(preflight), reasons, masterKey: record.masterKey });
  preset.contentSha256 = publisherContentHash(preset);
  changes.push({ masterKey: record.masterKey, expectedMasterRevision: prior.current_revision,
    expectedPresetRevision: prior.preset_revision, nextPresetRevision: preset.presetRevision, reasons });
}

// A changed atomic owner must receive fresh immutable composition versions,
// including transitive parents. Unaffected source graphs retain their IDs.
const changedLeaves = new Set(changes.filter(row => row.reasons.includes("authored_feces_specimen")).map(row => row.masterKey));
const changedCompositions = new Set();
let expanded;
do {
  expanded = false;
  for (const node of payload.labCompositions) {
    if (!changedCompositions.has(node.masterKey) && node.members.some(member =>
      changedLeaves.has(member.memberKey) || changedCompositions.has(member.memberKey))) {
      changedCompositions.add(node.masterKey); expanded = true;
    }
  }
} while (expanded);
const compositionRevisions = new Map(read("wp-10/current-compositions.preflight.v1.json").map(row => [row.master_key, row.latest_revision]));
for (const node of payload.labCompositions) {
  if (!changedCompositions.has(node.masterKey)) continue;
  if (!compositionRevisions.has(node.masterKey)) throw Error("wp10_composition_source_missing");
  node.revision = compositionRevisions.get(node.masterKey) + 1;
  const bytes = createHash("sha256").update(`wp10:${node.masterKey}:${node.revision}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  node.id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const artifact = { schemaVersion: 1, applied: false, runtimeImportAllowed: false, candidateComplete: false,
  pending: ["four workspace normalization and rollback rehearsal"],
  sourceCandidateSha256: source.candidateSemanticSha256, preflightSha256: hashCanonical(preflight),
  payload, payloadSha256: hashCanonical(payload), selectableKeys, retiredKeys, changes,
  changedCompositionKeys: [...changedCompositions].sort() };
writeFileSync(folder + "wp-10/ready-orders.non-applied.v1.json", JSON.stringify(artifact, null, 2) + "\n");
console.log(JSON.stringify({ changedPresets: changes.length, selectable: selectableKeys.length, retired: retiredKeys.length,
  changedCompositions: changedCompositions.size, candidateComplete: false, applied: false }));

// Shared profile versions are reused. Only foreign workspace device/location
// identities are new; no actual device integration or clinical result is created.
const resourceSource = read("wp-09/workspace-configuration.non-applied.v1.json");
const targets = ["clair-demo", "clair-foreign-demo", "workspace-clair-cheongdam", "workspace-clinical-master-pilot-v1"];
const deterministicId = key => {
  const bytes = createHash("sha256").update(key).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
const resourceConfig = { schemaVersion: 1, applied: false, workspaceAllowlist: targets,
  devices: [], bindings: [], compositions: [], locations: [] };
const compositionByKey = new Map(payload.labCompositions.map(row => [row.masterKey, row]));
for (const workspaceId of targets) {
  const sourceWorkspace = workspaceId === "clair-foreign-demo" ? "clair-demo" : workspaceId;
  const devices = resourceSource.devices.filter(row => row.workspaceId === sourceWorkspace);
  const deviceIds = new Map(devices.map(row => [row.id, workspaceId === sourceWorkspace ? row.id : deterministicId(`wp10:device:${workspaceId}:${row.model}`)]));
  resourceConfig.devices.push(...devices.map(row => ({ ...row, workspaceId, id: deviceIds.get(row.id) })));
  resourceConfig.bindings.push(...resourceSource.bindings.filter(row => row.workspaceId === sourceWorkspace).map(row => ({
    workspaceId, orderMasterKey: row.orderMasterKey, species: row.species,
    profileVersionId: row.profileVersionId, deviceId: deviceIds.get(row.deviceId),
  })));
  resourceConfig.compositions.push(...resourceSource.compositionAssignments.filter(row => row.workspaceId === sourceWorkspace).map(row => {
    const source = compositionByKey.get(row.compositionMasterKey);
    if (!source) throw Error("wp10_resource_composition_missing");
    return { workspaceId, masterKey: source.masterKey, versionId: source.id, billingPolicy: "preserve_parent_price" };
  }));
  resourceConfig.locations.push({ workspaceId, id: deterministicId(`wp10:default-ward:${workspaceId}`), label: "기본 기능검증 병동", kind: "ward" });
}
writeFileSync(folder + "wp-10/resources.non-applied.v1.json", JSON.stringify(resourceConfig, null, 2) + "\n");
