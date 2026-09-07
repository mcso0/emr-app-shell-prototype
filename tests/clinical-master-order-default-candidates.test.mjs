import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artifactDir = path.join(
  repoRoot,
  "docs/work/clinical-master/order-execution-defaults/artifacts",
);
const generatorPath = path.join(
  repoRoot,
  "scripts/generate-clinical-master-order-default-candidates-v1.mjs",
);
const candidatePath = path.join(
  artifactDir,
  "wp-01a-order-default-candidates.non-applied.v1.json",
);
const manifestPath = path.join(artifactDir, "wp-00-frozen-manifest.v1.json");
const ledgerPath = path.join(artifactDir, "wp-01a-source-ledger.v1.json");
const profilesPath = path.join(artifactDir, "wp-01a-research-profiles.v1.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function collectSourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const target = path.join(directory, name);
    if (statSync(target).isDirectory()) return collectSourceFiles(target);
    return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(name) ? [target] : [];
  });
}

test("WP-01A emits one deterministic non-applied candidate per frozen order", async () => {
  const artifact = readJson(candidatePath);
  const manifest = readJson(manifestPath);
  const { buildCandidates } = await import(pathToFileURL(generatorPath).href);
  const regenerated = await buildCandidates();

  assert.equal(artifact.totalOrderCount, 522);
  assert.equal(artifact.candidates.length, 522);
  assert.equal(
    new Set(artifact.candidates.map((row) => row.orderId)).size,
    522,
  );
  assert.deepEqual(
    artifact.candidates.map((row) => row.orderId),
    manifest.entries.map((row) => row.orderId),
  );
  assert.equal(regenerated.semanticFingerprint, artifact.semanticFingerprint);

  const check = spawnSync(process.execPath, [generatorPath, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr);
});

test("all candidates preserve species scope and the three-dimensional prototype status", () => {
  const artifact = readJson(candidatePath);
  const manifest = readJson(manifestPath);
  const manifestById = new Map(
    manifest.entries.map((entry) => [entry.orderId, entry]),
  );

  for (const candidate of artifact.candidates) {
    assert.equal(candidate.artifactState, "non_applied_candidate");
    assert.equal(candidate.applicationAllowed, false);
    assert.deepEqual(
      candidate.speciesApplicability,
      manifestById.get(candidate.orderId).speciesApplicability,
    );
    assert.deepEqual(candidate.targetStatus, {
      availability: "active",
      provenance: "synthetic_research_informed",
      clinicalValidation: "not_clinically_validated",
      runtimeFallbackAllowed: false,
    });
  }

  assert.equal(artifact.applicationAllowed, false);
  assert.equal(artifact.runtimeImportAllowed, false);
});

test("candidate dispositions keep every known blocking family explicit", () => {
  const artifact = readJson(candidatePath);

  assert.deepEqual(artifact.contentDispositionCounts, {
    candidate_ready_for_product_review: 161,
    candidate_ready_with_synthetic_assumption: 26,
    unresolved_blocking: 335,
  });
  assert.deepEqual(artifact.categoryDispositionCounts.dispensing, {
    candidate_ready_for_product_review: 106,
    unresolved_blocking: 53,
  });
  assert.equal(
    artifact.candidates.filter(
      (row) => row.profileRef === "dispensing.generic-unresolved.v1",
    ).length,
    51,
  );
  assert.equal(
    artifact.candidates.filter((row) =>
      row.unresolved.findings.some(
        (finding) => finding.code === "BLOCK_INVALID_UNIT_OR_FORMULA",
      ),
    ).length,
    2,
  );
  assert.ok(
    artifact.candidates.some((row) =>
      row.unresolved.findings.some(
        (finding) =>
          finding.code === "BLOCK_LEGACY_FALLBACK_CLASSIFICATION_KEY",
      ),
    ),
  );
});

test("all evidence references resolve to the frozen source ledger", () => {
  const artifact = readJson(candidatePath);
  const ledger = readJson(ledgerPath);
  const profiles = readJson(profilesPath);
  const claimIds = new Set(ledger.claims.map((claim) => claim.claimId));
  const sourceIds = new Set(ledger.sources.map((source) => source.sourceId));

  assert.equal(ledger.sources.length, 32);
  assert.equal(ledger.claims.length, 18);
  assert.equal(ledger.materialGaps.length, 6);
  assert.equal(ledger.evidenceReconciliation.length, 3);
  assert.equal(ledger.independentSpotChecks.length, 4);
  assert.match(ledger.sourceUsePolicy.licenseStatus, /재배포 라이선스/);

  for (const candidate of artifact.candidates) {
    const profile = profiles.profiles[candidate.profileRef];
    assert.ok(profile);
    assert.equal(candidate.workContractRef.profileRef, candidate.profileRef);
    assert.equal(
      candidate.workContractRef.profileSemanticFingerprint,
      sha256(canonicalize(profile)),
    );
    for (const claimId of candidate.evidence.claimIds) {
      assert.ok(claimIds.has(claimId), `${candidate.orderId}:${claimId}`);
    }
    for (const sourceId of candidate.evidence.sourceIds) {
      assert.ok(sourceIds.has(sourceId), `${candidate.orderId}:${sourceId}`);
    }
    for (const field of candidate.fieldAssessments) {
      assert.ok(
        [
          "direct_source",
          "derived_source",
          "synthetic_assumption",
          "unresolved",
        ].includes(field.evidenceClass),
        `${candidate.orderId}:${field.fieldKey}:${field.evidenceClass}`,
      );
      assert.equal(field.evidenceRef, "candidate.evidence");
    }
  }
});

test("rejected formula values are not retained as proposed defaults", () => {
  const artifact = readJson(candidatePath);
  const formulaBlocked = artifact.candidates.filter((candidate) =>
    candidate.unresolved.findings.some(
      (finding) => finding.code === "BLOCK_INVALID_UNIT_OR_FORMULA",
    ),
  );

  assert.equal(formulaBlocked.length, 2);
  for (const candidate of formulaBlocked) {
    assert.equal(
      Object.hasOwn(candidate.proposedMasterDefaults.values, "totalQuantity"),
      false,
      candidate.orderId,
    );
    assert.equal(
      Object.hasOwn(candidate.proposedMasterDefaults.policies, "totalQuantity"),
      false,
      candidate.orderId,
    );
  }
});

test("candidate artifact is not imported by runtime source", () => {
  const forbiddenName = path.basename(candidatePath);
  const offenders = collectSourceFiles(path.join(repoRoot, "src")).filter(
    (filePath) => readFileSync(filePath, "utf8").includes(forbiddenName),
  );
  assert.deepEqual(offenders, []);
});

test("candidate generator performs no remote or application writes", () => {
  const source = readFileSync(generatorPath, "utf8");
  assert.doesNotMatch(
    source,
    /fetch\(|createClient\(|supabase\.|airtable|order_catalog_items|INSERT\s+INTO/i,
  );
  assert.match(source, /non_applied_candidate_package/);
});
