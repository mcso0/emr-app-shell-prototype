import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scriptPath = path.join(
  repoRoot,
  "scripts/audit-clinical-master-order-semantic-completeness.mjs",
);
const contractPath = path.join(
  repoRoot,
  "docs/work/clinical-master/order-execution-defaults/artifacts/wp-00-field-ownership.v1.json",
);
const auditPath = path.join(
  repoRoot,
  "docs/work/clinical-master/order-execution-defaults/artifacts/wp-00-semantic-audit.v1.json",
);
const manifestPath = path.join(
  repoRoot,
  "docs/work/clinical-master/order-execution-defaults/artifacts/wp-00-frozen-manifest.v1.json",
);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

test("WP-00 freezes exactly 522 unique order identities and source species scopes", () => {
  const audit = readJson(auditPath);
  const manifest = readJson(manifestPath);

  assert.equal(audit.totalOrderCount, 522);
  assert.equal(audit.persistedMasterOrderCount, 510);
  assert.equal(audit.proposalOnlyOrderCount, 12);
  assert.deepEqual(audit.categoryCounts, {
    clinical_lab: 86,
    consultation: 55,
    dispensing: 159,
    hospitalization: 30,
    imaging: 30,
    other: 39,
    system_exam: 12,
    treatment: 111,
  });
  assert.deepEqual(audit.speciesScopeCounts, {
    cat: 45,
    "cat+dog": 420,
    dog: 45,
    unresolved: 12,
  });
  assert.deepEqual(audit.globalInputFindings, []);
  assert.deepEqual(audit.duplicatedIdentities, []);
  assert.equal(
    new Set(manifest.entries.map((entry) => entry.orderId)).size,
    522,
  );
  assert.equal(manifest.totalOrderCount, 522);
});

test("historical artifacts reproduce from the exact baseline source without relabeling current code", async () => {
  const { buildAudit } = await import(pathToFileURL(scriptPath).href);
  const first = await buildAudit({ sourceMode: "baseline" });
  const second = await buildAudit({ sourceMode: "baseline" });
  const checkedAudit = readJson(auditPath);
  const checkedManifest = readJson(manifestPath);

  assert.equal(
    first.audit.semanticFingerprint,
    second.audit.semanticFingerprint,
  );
  assert.equal(
    first.audit.semanticFingerprint,
    checkedAudit.semanticFingerprint,
  );
  assert.equal(
    first.manifest.semanticFingerprint,
    checkedManifest.semanticFingerprint,
  );

  const check = spawnSync(
    process.execPath,
    [scriptPath, "--baseline", "--check", "--allow-blocking"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(check.status, 0, check.stderr);
});

test("current source drift remains visible and historical replay cannot overwrite the frozen audit", async () => {
  const { buildAudit } = await import(pathToFileURL(scriptPath).href);
  const current = await buildAudit();
  assert.ok(current.audit.globalInputFindings.includes("schema_source_sha256_mismatch"));
  assert.notEqual(current.audit.semanticFingerprint, readJson(auditPath).semanticFingerprint);
  const write = spawnSync(process.execPath, [scriptPath, "--baseline", "--write", "--allow-blocking"], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(write.status, 1);
  assert.match(write.stderr, /historical_baseline_replay_is_read_only/);
});

test("blocking findings fail closed unless report generation explicitly allows them", () => {
  const strictRun = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const reportRun = spawnSync(
    process.execPath,
    [scriptPath, "--allow-blocking"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.equal(strictRun.status, 1);
  assert.equal(reportRun.status, 0, reportRun.stderr);
});

test("baseline separates each consequential blocker family", () => {
  const audit = readJson(auditPath);

  assert.equal(audit.passCount, 0);
  assert.equal(audit.blockingOrderCount, 522);
  assert.ok(audit.findingCounts.BLOCK_MISSING_MASTER_DEFAULT > 0);
  assert.equal(audit.findingCounts.BLOCK_MISSING_RESOLVER, 30);
  assert.equal(audit.findingCounts.BLOCK_MISOWNED_FIELD, 123);
  assert.equal(audit.findingCounts.BLOCK_INVALID_UNIT_OR_FORMULA, 2);
  assert.equal(audit.findingCounts.BLOCK_NOT_PERSISTED, 24);
  assert.equal(audit.findingCounts.BLOCK_UNAVAILABLE_OR_CONFLATED_STATUS, 522);
  assert.deepEqual(audit.runtimeFallbackInspection, {
    verified: false,
    reason:
      "Runtime and Hospital Admin/chart projection inspection is owned by WP-01B and is intentionally outside this local fixture audit.",
    fallbackAllowed: false,
  });
});

test("representative defects remain explicit instead of receiving fallback values", () => {
  const audit = readJson(auditPath);
  const genericDispensing = audit.orders.find(
    (order) => order.displayName === "경구제 조제",
  );
  const treatment = audit.orders.find(
    (order) => order.displayName === "치과 검진",
  );
  const hospitalization = audit.orders.find(
    (order) => order.displayName === "입원 1일 관리",
  );
  const systemExam = audit.orders.find(
    (order) => order.orderId === "cm.order.system-exam.general-vitals",
  );

  assert.equal(
    genericDispensing.fields.find((field) => field.fieldKey === "dose")
      .findingCode,
    "BLOCK_MISSING_MASTER_DEFAULT",
  );
  assert.equal(
    treatment.fields.find((field) => field.fieldKey === "administeredAmount")
      .findingCode,
    "BLOCK_MISOWNED_FIELD",
  );
  assert.equal(
    hospitalization.fields.find((field) => field.fieldKey === "wardOrCage")
      .findingCode,
    "BLOCK_MISSING_RESOLVER",
  );
  assert.ok(
    systemExam.orderFindings.some(
      (finding) => finding.findingCode === "BLOCK_NOT_PERSISTED",
    ),
  );
});

test("ownership contract covers schema fields and audit uses no remote I/O", () => {
  const contract = readJson(contractPath);
  const schemaSource = readFileSync(
    path.join(repoRoot, "src/features/chart/order-execution-domain.ts"),
    "utf8",
  );
  const auditSource = readFileSync(scriptPath, "utf8");

  for (const [orderType, fields] of Object.entries(contract.fieldContracts)) {
    assert.match(schemaSource, new RegExp(`${orderType}: \\{`));
    for (const field of fields) {
      assert.ok(schemaSource.includes(`key: "${field.key}"`));
    }
  }

  assert.doesNotMatch(
    auditSource,
    /fetch\(|createClient\(|supabase\.from\(|airtable/i,
  );
});
