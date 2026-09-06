// Offline delivery rebase. Never publishes, activates, or changes clinical meaning.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashCanonical, publisherContentHash } from "./generate-clinical-master-execution-preset-release-v1.mjs";

export function rebaseRemoteCandidate(candidate, preflight) {
  if (hashCanonical(candidate.payload) !== candidate.candidateSemanticSha256) throw Error("candidate_hash_mismatch");
  const current = new Map(preflight.rows.map(row => [row.master_key, row]));
  if (current.size !== 522 || preflight.rows.length !== 522) throw Error("preflight_522_required");
  const payload = structuredClone(candidate.payload);
  const changes = [];
  for (const record of payload.records.filter(record => record.recordType === "order")) {
    const prior = current.get(record.masterKey);
    if (!prior) {
      if (!candidate.newOrders.includes(record.masterKey)) throw Error("unreconciled_new_identity");
      continue;
    }
    const preset = record.detail.executionPreset;
    const maxRevision = preflight.latestRevisionOverrides?.[record.masterKey] ?? prior.preset_revision;
    if (!Number.isInteger(maxRevision) || maxRevision < prior.preset_revision) throw Error("invalid_latest_revision");
    const before = { id: preset.presetId, key: preset.presetKey, revision: preset.presetRevision };
    // Existing identity is immutable. Historical revisions may exceed the current
    // pointer; always advance beyond all history, not merely current + 1.
    preset.presetId = prior.preset_id;
    preset.presetKey = prior.preset_key;
    preset.presetRevision = maxRevision + 1;
    preset.contentSha256 = publisherContentHash(preset);
    changes.push({ masterKey: record.masterKey, before, after: { id: preset.presetId, key: preset.presetKey, revision: preset.presetRevision },
      expectedMasterRevision: prior.current_revision, expectedPresetRevision: prior.preset_revision,
      expectedPresetContentSha256: prior.content_sha256, expectedLatestPresetRevision: maxRevision });
  }
  if (changes.length !== 471) throw Error("retained_471_required");
  return { schemaVersion: 1, applied: false, runtimeImportAllowed: false,
    sourceCandidateSemanticSha256: candidate.candidateSemanticSha256,
    preflightSha256: hashCanonical(preflight), capturedAt: preflight.capturedAt,
    payload, candidateSemanticSha256: hashCanonical(payload), changes,
    workspaceAllowlist: ["clair-demo", "workspace-clair-cheongdam", "workspace-clinical-master-pilot-v1"],
    foreignControl: "clair-foreign-demo", decisions: { profiles: "CLAiR synthetic manual; no device integration",
      compositionBillingPolicy: "preserve_parent_price", defaultRetestBillingPolicy: "no_charge" },
    retirementPlan: candidate.retirementPlan, ledger: candidate.ledger, counts: candidate.counts };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/";
  const read = name => JSON.parse(readFileSync(folder + name, "utf8"));
  const artifact = rebaseRemoteCandidate(read("combined-release.non-applied.v1.json"), read("remote-current-presets.preflight.v1.json"));
  writeFileSync(folder + "remote-release.non-applied.v1.json", JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ sourceSha: artifact.sourceCandidateSemanticSha256, deliverySha: artifact.candidateSemanticSha256,
    rebased: artifact.changes.length, ...artifact.counts, applied: false }));
}
