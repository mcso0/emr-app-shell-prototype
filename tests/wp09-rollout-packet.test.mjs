import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWp09RolloutPacket, renderWp09RolloutSql, renderWp09PreflightSql, wp09FingerprintTables } from "../scripts/generate-wp09-rollout-packet.mjs";
const folder = new URL("../docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/", import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, folder), "utf8"));
const source = read("remote-release.non-applied.v1.json");
const configuration = read("workspace-configuration.non-applied.v1.json");
const combined = read("combined-release.non-applied.v1.json");
function fixture() {
  return { fingerprints: [...source.workspaceAllowlist, source.foreignControl].flatMap(workspaceId => wp09FingerprintTables.map(tableName => ({
    workspaceId, tableName, count: 0, sha256: "0".repeat(64),
  }))), rebind: read("remote-dispensing-rebind.preflight.v1.json").rows, labItems: read("remote-lab-targets.preflight.v1.json").rows };
}
test("rollout packet binds exact source/configuration and 324/207 frozen identities", () => {
  const artifact = buildWp09RolloutPacket(source, configuration, combined, fixture());
  assert.equal(artifact.packet.newKeys.length, 53);
  assert.equal(artifact.packet.retiredKeys.length, 51);
  assert.equal(artifact.applied, false);
  assert.match(artifact.packetSha256, /^[a-f0-9]{64}$/);
  const sql = renderWp09RolloutSql(artifact);
  assert.ok(sql.includes(`'${artifact.packetSha256}',false)`));
  assert.ok(sql.includes("as materialized"));
  assert.ok(renderWp09RolloutSql(artifact, true).includes(`'${artifact.packetSha256}',true)`));
  assert.equal(artifact.packet.configuration.pricingAssignments.length, 159);
  const preflightSql = renderWp09PreflightSql(source);
  assert.ok(preflightSql.includes("i.customization_state='unmodified'"));
  assert.ok(preflightSql.includes("private.clair_oed_20260906_fingerprints()"));
  assert.doesNotMatch(preflightSql, /\b(insert|update|delete|alter|create|drop)\b/i);
});
test("rollout rejects missing foreign fingerprint and duplicate eligible identity", () => {
  const preflight = fixture(); preflight.fingerprints.pop();
  assert.throws(() => buildWp09RolloutPacket(source, configuration, combined, preflight), /fingerprint_scope/);
  const duplicate = fixture(); duplicate.labItems[1] = duplicate.labItems[0];
  assert.throws(() => buildWp09RolloutPacket(source, configuration, combined, duplicate), /target_scope/);
});
test("rollout rejects changed preset/configuration and rendered packet", () => {
  const preflight = fixture(); preflight.rebind[0].presetSha256 = "0".repeat(64);
  assert.throws(() => buildWp09RolloutPacket(source, configuration, combined, preflight), /target_hash/);
  const changed = structuredClone(configuration); changed.pricingAssignments[0].priceKrw++;
  assert.throws(() => buildWp09RolloutPacket(source, changed, combined, fixture()), /configuration_hash/);
  const artifact = buildWp09RolloutPacket(source, configuration, combined, fixture()); artifact.packet.newKeys.pop();
  assert.throws(() => renderWp09RolloutSql(artifact, true), /packet_hash/);
});
test("fingerprint renderer uses the same ordered table allowlist as operator SQL", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260906141337_clinical_master_oed_scoped_rollout.sql", import.meta.url), "utf8");
  const literal = sql.match(/tables constant text\[\]:=array\[([\s\S]*?)\];/)[1];
  assert.deepEqual([...literal.matchAll(/'([^']+)'/g)].map(match => match[1]), wp09FingerprintTables);
});
