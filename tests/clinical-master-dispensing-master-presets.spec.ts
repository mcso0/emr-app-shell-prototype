import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const artifactPath = resolve(
  process.cwd(),
  "docs/work/clinical-master/clinical-master-pr-019/dispensing-master-presets.v1.json",
);
const sourceExtractPath = resolve(
  process.cwd(),
  "docs/work/clinical-master/clinical-master-pr-019/dispensing-default-source-extracts.v1.json",
);
const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826200000_clinical_master_dispensing_master_presets.sql",
);
const releaseIndexMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826201000_clinical_master_dispensing_master_presets_release_index.sql",
);
const frequencyNormalizationMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826202000_clinical_master_dispensing_preset_frequency_normalization.sql",
);

type PresetArtifact = {
  clinicalUseAllowed: boolean;
  entries: Array<{
    clinicalUseAllowed: boolean;
    contentSha256: string;
    detailInputs: Record<string, unknown>;
    medicationMetadata: {
      defaultDetailInputs: Record<string, unknown>;
      presetStatus: string;
      schemaVersion: number;
    };
    orderMasterKey: string;
    presetId: string;
    presetStatus: string;
    provenance: {
      fieldEvidence: Record<string, string>;
      posologyExtractSha256: string;
      sourceExtractEntriesSha256: string;
      sourceUri: string;
      storageExtractSha256: string;
    };
  }>;
  entriesSha256: string;
  presetStatus: string;
  recordCount: number;
  sourceExtractEntriesSha256: string;
  uniqueDetailFingerprintCount: number;
};

type SourceExtractArtifact = {
  clinicalUseAllowed: boolean;
  entries: Array<{
    observedPdfSha256: string;
    orderMasterKey: string;
    pageCount: number;
    pinnedEvidenceContentSha256: string;
    posologyExtract: string;
    posologyExtractionStatus: string;
    sourceUri: string;
    storageExtract: string;
    storageExtractionStatus: string;
  }>;
  entriesSha256: string;
  recordCount: number;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

test("108 master dispensing presets are complete, varied, traceable, and explicitly non-clinical", async () => {
  const [artifactSource, extractSource] = await Promise.all([
    readFile(artifactPath, "utf8"),
    readFile(sourceExtractPath, "utf8"),
  ]);
  const artifact = JSON.parse(artifactSource) as PresetArtifact;
  const extracts = JSON.parse(extractSource) as SourceExtractArtifact;

  expect(artifact).toMatchObject({
    recordCount: 108,
    uniqueDetailFingerprintCount: 108,
    presetStatus: "synthetic_unreviewed",
    clinicalUseAllowed: false,
  });
  expect(artifact.entries).toHaveLength(108);
  expect(extracts).toMatchObject({ recordCount: 108, clinicalUseAllowed: false });
  expect(extracts.entries).toHaveLength(108);
  expect(artifact.sourceExtractEntriesSha256).toBe(extracts.entriesSha256);
  expect(artifact.entriesSha256).toBe(
    sha256(JSON.stringify(artifact.entries)),
  );
  expect(extracts.entriesSha256).toBe(
    sha256(JSON.stringify(extracts.entries)),
  );

  const extractByOrderMasterKey = new Map(
    extracts.entries.map((entry) => [entry.orderMasterKey, entry]),
  );
  const requiredDetailKeys = [
    "doseBasis",
    "dose",
    "doseUnit",
    "route",
    "frequency",
    "durationDays",
    "totalQuantity",
    "totalQuantityUnit",
    "medicationInstruction",
    "storageMethod",
    "compoundNote",
    "guardianNote",
    "extraLabelSpeciesConfirmed",
  ];
  const detailFingerprints = new Set<string>();
  const frequencyValues = new Set<string>();
  const routeValues = new Set<string>();
  const doseUnitValues = new Set<string>();
  const storageValues = new Set<string>();
  const totalQuantities = new Set<number>();
  let onceMultiDayCount = 0;

  for (const entry of artifact.entries) {
    const extract = extractByOrderMasterKey.get(entry.orderMasterKey);
    expect(extract).toBeDefined();
    expect(entry.presetStatus).toBe("synthetic_unreviewed");
    expect(entry.clinicalUseAllowed).toBe(false);
    expect(entry.medicationMetadata).toMatchObject({
      schemaVersion: 2,
      presetStatus: "synthetic_unreviewed",
      defaultDetailInputs: entry.detailInputs,
    });
    expect(Object.keys(entry.detailInputs)).toEqual(
      expect.arrayContaining(requiredDetailKeys),
    );
    expect(entry.detailInputs.extraLabelSpeciesConfirmed).toBe(false);
    expect(Number(entry.detailInputs.dose)).toBeGreaterThan(0);
    expect(Number(entry.detailInputs.durationDays)).toBeGreaterThan(0);
    expect(Number(entry.detailInputs.totalQuantity)).toBeGreaterThan(0);
    expect(String(entry.detailInputs.compoundNote).trim().length).toBeGreaterThan(20);
    expect(String(entry.detailInputs.guardianNote).trim().length).toBeGreaterThan(20);
    expect(entry.provenance.sourceUri).toBe(extract?.sourceUri);
    expect(entry.provenance.sourceExtractEntriesSha256).toBe(
      extracts.entriesSha256,
    );
    expect(entry.provenance.posologyExtractSha256).toBe(
      sha256(extract?.posologyExtract ?? ""),
    );
    expect(entry.provenance.storageExtractSha256).toBe(
      sha256(extract?.storageExtract ?? ""),
    );
    expect(entry.provenance.fieldEvidence.dose).toBe(
      "synthetic_product_shaped_inference",
    );
    expect(entry.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(extract?.sourceUri).toMatch(
      /^https:\/\/www\.vmd\.defra\.gov\.uk\/productinformationdatabase\/files\/SPC_Documents\/SPC_\d+\.PDF$/,
    );
    expect(extract?.pinnedEvidenceContentSha256).toBe(
      extract?.observedPdfSha256,
    );
    expect(extract?.pageCount).toBeGreaterThan(0);
    expect(extract?.posologyExtractionStatus).toBe("captured");
    expect(extract?.storageExtractionStatus).toBe("captured");

    detailFingerprints.add(sha256(JSON.stringify(entry.detailInputs)));
    frequencyValues.add(String(entry.detailInputs.frequency));
    routeValues.add(String(entry.detailInputs.route));
    doseUnitValues.add(String(entry.detailInputs.doseUnit));
    storageValues.add(String(entry.detailInputs.storageMethod));
    totalQuantities.add(Number(entry.detailInputs.totalQuantity));
    if (
      entry.detailInputs.frequency === "once" &&
      Number(entry.detailInputs.durationDays) > 1
    ) {
      onceMultiDayCount += 1;
    }
  }

  expect(extractByOrderMasterKey.size).toBe(108);
  expect(new Set(artifact.entries.map((entry) => entry.presetId)).size).toBe(108);
  expect(detailFingerprints.size).toBe(108);
  expect(frequencyValues.size).toBeGreaterThanOrEqual(4);
  expect(routeValues.size).toBeGreaterThanOrEqual(6);
  expect(doseUnitValues.size).toBeGreaterThanOrEqual(8);
  expect(storageValues.size).toBeGreaterThanOrEqual(3);
  expect(totalQuantities.size).toBeGreaterThanOrEqual(20);
  expect(onceMultiDayCount).toBe(0);
});

test("master preset migration is allowlisted, fail-closed, and carries editable defaults through chart snapshots", async () => {
  const [migration, releaseIndexMigration, frequencyNormalizationMigration] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(releaseIndexMigrationPath, "utf8"),
    readFile(frequencyNormalizationMigrationPath, "utf8"),
  ]);

  expect(migration).toContain("master.dispensing_order_prescription_presets");
  expect(migration).toContain("preset_status in ('synthetic_unreviewed', 'clinically_reviewed')");
  expect(migration).toContain("or clinical_use_allowed = false");
  expect(migration).toContain("v_count <> 108 or v_unique_details <> 108");
  expect(migration).toContain("v_target_count <> 324");
  expect(migration).toContain("dispensing_master_preset_projection_customization_collision");
  expect(migration).toContain("'clair-demo'");
  expect(migration).toContain("'workspace-clair-cheongdam'");
  expect(migration).toContain("'workspace-clinical-master-pilot-v1'");
  expect(migration).toContain("'clair-foreign-demo'");
  expect(migration).toContain("dispensing_master_preset_foreign_workspace_changed");
  expect(migration).toContain("'defaultDetailInputs', catalog.medication_metadata -> 'defaultDetailInputs'");
  expect(migration).toContain("'medicationMetadata', c.medication_metadata");
  expect(migration).toContain("'schemaVersion', 2");
  expect(migration).toContain("security definer\nset search_path = ''");
  expect(migration).toContain("dispensing_order_prescription_presets_release_idx");
  expect(releaseIndexMigration).toContain(
    "on master.dispensing_order_prescription_presets (source_release_id)",
  );
  expect(frequencyNormalizationMigration).toContain(
    "dispensing_preset_once_multi_day_semantics_invalid",
  );
  expect(frequencyNormalizationMigration).toContain(
    "v_updated_count <> 324",
  );
  expect(migration).toContain(
    "revoke all on table master.dispensing_order_prescription_presets\n  from public, anon, authenticated, service_role",
  );
  expect(migration).not.toMatch(/clinical_use_allowed\s*=\s*true/i);
});
