import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rebaseRemoteCandidate } from "../scripts/generate-wp09-remote-candidate.mjs";
import { publisherContentHash } from "../scripts/generate-clinical-master-execution-preset-release-v1.mjs";
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/";
const candidate = JSON.parse(readFileSync(folder + "combined-release.non-applied.v1.json", "utf8"));
const preflight = JSON.parse(readFileSync(folder + "remote-current-presets.preflight.v1.json", "utf8"));
test("delivery rebase preserves all clinical meaning and immutable preset identity", () => {
  const result = rebaseRemoteCandidate(candidate, preflight);
  assert.equal(result.changes.length, 471);
  const originals = new Map(candidate.payload.records.map(row => [row.masterKey, row]));
  for (const record of result.payload.records) {
    const original = originals.get(record.masterKey);
    const reverted = structuredClone(record);
    if (record.recordType === "order") {
      const preset = record.detail.executionPreset;
      assert.equal(preset.contentSha256, publisherContentHash(preset));
      const previous = preflight.rows.find(row => row.master_key === record.masterKey);
      if (previous) {
        assert.equal(preset.presetId, previous.preset_id);
        assert.equal(preset.presetKey, previous.preset_key);
        assert.equal(preset.presetRevision, (preflight.latestRevisionOverrides?.[record.masterKey] ?? previous.preset_revision) + 1);
      }
      for (const key of ["presetId", "presetKey", "presetRevision", "contentSha256"]) reverted.detail.executionPreset[key] = original.detail.executionPreset[key];
    }
    assert.deepEqual(reverted, original);
  }
  assert.deepEqual(result.ledger, candidate.ledger);
});
test("delivery rebase rejects incomplete or corrupted source preflight", () => {
  assert.throws(() => rebaseRemoteCandidate({ ...candidate, candidateSemanticSha256: "bad" }, preflight), /candidate_hash_mismatch/);
  assert.throws(() => rebaseRemoteCandidate(candidate, { ...preflight, rows: preflight.rows.slice(1) }), /preflight_522_required/);
});
