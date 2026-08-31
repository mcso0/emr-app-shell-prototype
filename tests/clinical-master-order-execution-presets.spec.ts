import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(
  repoRoot,
  "scripts/generate-clinical-master-order-execution-presets-v1.mjs",
);
const artifactPath = path.join(
  repoRoot,
  "tests/fixtures/clinical-master-order-execution-presets-v1.json",
);
const systemExamAuthoringPath = path.join(
  repoRoot,
  "tests/fixtures/clinical-master-system-exam-authoring-v1.json",
);

type JsonRecord = Record<string, unknown>;
type V4Record = JsonRecord & {
  recordType: string;
  detail: JsonRecord;
};
type ArtifactEntry = JsonRecord & {
  masterKey: string;
  presetId: string;
  presetKey: string;
  presetRevision: number;
  clinicalOrderType: string;
  defaultDetailInputs: JsonRecord;
  fieldPolicies: JsonRecord;
  provenance: JsonRecord;
  contentSha256: string;
  sourceArtifactSha256: string;
  sourceEntriesSha256: string;
  profile?: JsonRecord;
};
type SystemExamProposal = JsonRecord & {
  stableKey: string;
  presetId: string;
  presetKey: string;
  profileKey: string;
  defaultDetailInputs: JsonRecord;
  fieldPolicies: JsonRecord;
  provenance: JsonRecord;
  profile: JsonRecord;
  contentSha256: string;
  sourceArtifactSha256: string;
  presetRevision: number;
  presetStatus: string;
};
type Artifact = JsonRecord & {
  entries: ArtifactEntry[];
  proposedSystemExamOrders: SystemExamProposal[];
  sourceEntriesSha256: string;
  proposedSystemExamOrdersSourceEntriesSha256: string;
  expectedInputLineageSha256: string;
  inputLineageSha256: string;
  inputLineage: InputLineageRecord[];
  lineagePolicy: JsonRecord;
  contentHashPolicy: {
    subsetFields: string[];
    excludedTransportFields: string[];
  };
  sourceArtifactHashPolicy: JsonRecord;
};
type PresetInput = JsonRecord & {
  orderMasterKey: string;
  detailInputs: JsonRecord;
};
type InputBundle = JsonRecord & {
  v4: JsonRecord & { records: V4Record[] };
  payload: JsonRecord & {
    genericReleasePayload: JsonRecord & { records: JsonRecord[] };
  };
  presets: JsonRecord & { entries: PresetInput[] };
  supplement: JsonRecord & { records: JsonRecord[] };
};
type InputLineageRecord = {
  masterKey: string;
  currentRevision: number;
  currentReleaseIdentity: {
    releaseKey: string | null;
    releaseId: string | null;
    releaseNo: number | null;
  };
};
type GeneratorModule = {
  canonicalize: (value: unknown) => string;
  canonicalizePostgresJsonbText: (value: unknown) => string;
  contentHashValue: (value: JsonRecord) => string;
  uuidV5: (value: string) => string;
  buildInputLineage: (inputs: InputBundle) => InputLineageRecord[];
  inputLineageHash: (lineage: InputLineageRecord[]) => string;
  generateArtifact: (options?: { inputs?: InputBundle }) => Promise<JsonRecord>;
  loadInputs: () => Promise<InputBundle>;
  validateArtifact: (
    artifact: unknown,
    options?: { expectedInputLineage?: InputLineageRecord[] | null },
  ) => true;
};

function readArtifact(): Artifact {
  return JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
}

function findEntry(entries: ArtifactEntry[], masterKey: string): ArtifactEntry {
  const entry = entries.find((candidate) => candidate.masterKey === masterKey);
  if (!entry) throw new Error(`fixture_entry_missing:${masterKey}`);
  return entry;
}

async function loadGenerator(): Promise<GeneratorModule> {
  return import(pathToFileURL(scriptPath).href) as Promise<{
    canonicalize: (value: unknown) => string;
    canonicalizePostgresJsonbText: (value: unknown) => string;
    contentHashValue: (value: JsonRecord) => string;
    uuidV5: (value: string) => string;
    buildInputLineage: (inputs: InputBundle) => InputLineageRecord[];
    inputLineageHash: (lineage: InputLineageRecord[]) => string;
    generateArtifact: (options?: {
      inputs?: InputBundle;
    }) => Promise<JsonRecord>;
    loadInputs: () => Promise<InputBundle>;
    validateArtifact: (
      artifact: unknown,
      options?: { expectedInputLineage?: InputLineageRecord[] | null },
    ) => true;
  }>;
}

test("the checked-in transport artifact is generated and checked deterministically", async () => {
  const result = spawnSync(process.execPath, [scriptPath, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("(510 entries)");

  const generator = await loadGenerator();
  const artifact = readArtifact();
  const inputs = await generator.loadInputs();
  expect(
    generator.validateArtifact(artifact, {
      expectedInputLineage: generator.buildInputLineage(inputs),
    }),
  ).toBe(true);
});

test("coverage, category counts, eight transport types, and synthetic gate are explicit", async () => {
  const artifact = readArtifact();
  expect(artifact.expectedOrderCount).toBe(510);
  expect(artifact.expectedStableKeySetSha256).toBe(
    "2197c142243464c7d14ffc1ae921106ed609084fb960fd4eba2c309f6fe80164",
  );
  expect(artifact.expectedLiveIdentityRevisionSha256).toBe(
    "b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb",
  );
  expect(artifact.expectedInputLineageSha256).toBe(
    "e8c5b28660efd3c6c0091a105fcd5e6234010a851f07cc4e16f1da91582b3198",
  );
  expect(artifact.inputLineage).toHaveLength(510);
  expect(artifact.inputLineageSha256).toBe(
    artifact.expectedInputLineageSha256,
  );
  expect(artifact.lineagePolicy).toMatchObject({
    sourceKind: "frozen_local_inputs",
    remoteCurrentAssertion: false,
    externalPublishRequiresLiveCas: true,
    externalPublishLiveCasFields: [
      "masterKey",
      "currentRevision",
      "currentReleaseIdentity",
    ],
  });
  expect(artifact.clinicalOrderTypes).toEqual([
    "consultation",
    "clinical_lab",
    "imaging",
    "external_lab",
    "dispensing",
    "treatment",
    "hospitalization",
    "other",
  ]);
  expect(artifact.categoryCounts).toEqual({
    consultation: 31,
    dispensing: 159,
    imaging: 30,
    laboratory: 86,
    certificate: 13,
    dental: 24,
    dispensing_supply: 2,
    emergency: 24,
    inpatient: 30,
    preventive: 24,
    surgery_anesthesia: 42,
    treatment: 45,
  });
  expect(artifact.clinicalOrderTypeCounts).toEqual({
    consultation: 55,
    clinical_lab: 86,
    imaging: 30,
    dispensing: 159,
    treatment: 111,
    hospitalization: 30,
    other: 39,
  });
  for (const entry of artifact.entries) {
    expect(Object.keys(entry.defaultDetailInputs).length).toBeGreaterThan(0);
    expect(entry.defaultDetailInputs).not.toHaveProperty("administeredAmount");
    expect(entry.presetId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(entry).not.toHaveProperty("masterRecordId");
    expect(entry.presetStatus).toBe("synthetic_unreviewed");
    expect(entry.syntheticUnreviewed).toBe(true);
    expect(entry.clinicalUseAllowed).toBe(false);
    expect(entry.sourceEntriesSha256).toBe(artifact.sourceEntriesSha256);
    for (const [key, policy] of Object.entries(entry.fieldPolicies)) {
      expect(artifact.fieldPolicies).toContain(policy);
      expect(
        entry.defaultDetailInputs[key] === undefined || policy,
      ).toBeTruthy();
    }
  }
});

test("PR-019 dispensing defaults are reused exactly and billing supplies never receive dose fields", async () => {
  const generator = await loadGenerator();
  const inputs = await generator.loadInputs();
  const artifact = (await generator.generateArtifact({
    inputs,
  })) as Artifact;
  const sourceByKey = new Map(
    inputs.presets.entries.map((entry) => [entry.orderMasterKey, entry]),
  );
  const pr19Entries = artifact.entries.filter(
    (candidate) =>
      candidate.provenance.generatorProfileKey === "dispensing.pr19-exact.v1",
  );
  expect(pr19Entries).toHaveLength(108);
  for (const entry of pr19Entries) {
    const source = sourceByKey.get(entry.masterKey);
    if (!source) throw new Error(`pr19_source_missing:${entry.masterKey}`);
    expect(entry.presetId).toBe(source.presetId);
    expect(entry.presetKey).toBe(source.presetKey);
    expect(entry.presetRevision).toBe(2);
    expect(entry.provenance.sourcePresetId).toBe(source.presetId);
    expect(entry.provenance.sourcePresetKey).toBe(source.presetKey);
    expect(entry.provenance.sourcePresetRevision).toBe(1);
    expect(entry.defaultDetailInputs).toEqual(
      source.detailInputs,
    );
    expect(entry.provenance.sourcePresetArtifactSha256).toBe(
      "f522d39ed024849549987be5768b3be7b89f0e308d4658593e2cc266cffc90ae",
    );
  }
  const nonPr19Entries = artifact.entries.filter(
    (candidate) =>
      candidate.provenance.generatorProfileKey !== "dispensing.pr19-exact.v1",
  );
  expect(nonPr19Entries).toHaveLength(402);
  expect(nonPr19Entries.every((entry) => entry.presetRevision === 1)).toBe(
    true,
  );
  for (const entry of artifact.entries.filter(
    (candidate) =>
      candidate.provenance.generatorProfileKey === "other.dispensing-supply.v1",
  )) {
    expect(entry.clinicalOrderType).toBe("other");
    expect(entry.executionMode).toBe("immediate_complete");
    expect(entry.defaultDetailInputs).not.toHaveProperty("dose");
    expect(entry.defaultDetailInputs).not.toHaveProperty("route");
    expect(entry.defaultDetailInputs).not.toHaveProperty("frequency");
  }
});

test("contentSha256 matches the publisher's exact 11-field PostgreSQL JSONB subset", async () => {
  const generator = await loadGenerator();
  const artifact = readArtifact();
  const fields = [
    "presetId",
    "presetKey",
    "presetRevision",
    "clinicalOrderType",
    "detailSchemaVersion",
    "defaultDetailInputs",
    "fieldPolicies",
    "provenance",
    "presetStatus",
    "clinicalUseAllowed",
    "sourceArtifactSha256",
  ];
  expect(artifact.contentHashPolicy.subsetFields).toEqual(fields);
  expect(artifact.sourceArtifactHashPolicy).toMatchObject({
    entrySourceArtifactField: "sourceArtifactSha256",
    sourceEntriesField: "sourceEntriesSha256",
    proposedEntrySourceArtifactField: "sourceArtifactSha256",
    proposedSourceEntriesField: "proposedSystemExamOrdersSourceEntriesSha256",
  });
  expect(artifact.contentHashPolicy.excludedTransportFields).toEqual(
    expect.arrayContaining([
      "masterKey",
      "expectedOrderRevisionPolicy",
      "destinationModule",
      "executionMode",
      "syntheticUnreviewed",
      "contentSha256",
      "sourceEntriesSha256",
      "displayName",
    ]),
  );
  expect(
    generator.canonicalizePostgresJsonbText({
      z: 1,
      aa: [true, "x"],
      a: 2,
    }),
  ).toBe('{"a": 2, "z": 1, "aa": [true, "x"]}');

  for (const entry of [
    artifact.entries[0],
    artifact.entries.find(
      (candidate) =>
        candidate.provenance.generatorProfileKey === "dispensing.pr19-exact.v1",
    ),
    artifact.entries.find(
      (candidate) => candidate.clinicalOrderType === "imaging",
    ),
  ]) {
    if (!entry) throw new Error("hash_representative_missing");
    const subset = Object.fromEntries(
      fields.map((field) => [field, entry[field]]),
    );
    const expectedHash = createHash("sha256")
      .update(generator.canonicalizePostgresJsonbText(subset))
      .digest("hex");
    expect(entry.contentSha256).toBe(expectedHash);
    expect(entry.contentSha256).toBe(generator.contentHashValue(entry));
    expect(entry.sourceArtifactSha256).toBe(artifact.sourceEntriesSha256);

    const excludedFieldMutation = {
      ...entry,
      masterKey: `${entry.masterKey}.excluded-only-test`,
      destinationModule: "excluded-only-test",
      syntheticUnreviewed: false,
    };
    expect(generator.contentHashValue(excludedFieldMutation)).toBe(
      entry.contentSha256,
    );
  }
  expect(
    artifact.entries.find(
    (candidate) => candidate.masterKey === "cm.order.consult.initial",
    )?.contentSha256,
  ).toBe("a7240761fb832489a3ddc3ffd19f2e455f8e6363f75dbda5151e1dc74816dfc8");
  for (const proposal of artifact.proposedSystemExamOrders) {
    const subset = Object.fromEntries(
      fields.map((field) => [field, proposal[field]]),
    );
    const expectedHash = createHash("sha256")
      .update(generator.canonicalizePostgresJsonbText(subset))
      .digest("hex");
    expect(proposal.presetRevision).toBe(1);
    expect(proposal.presetStatus).toBe("synthetic_unreviewed");
    expect(proposal.sourceArtifactSha256).toBe(
      artifact.proposedSystemExamOrdersSourceEntriesSha256,
    );
    expect(proposal.contentSha256).toBe(expectedHash);
    expect(proposal.contentSha256).toBe(generator.contentHashValue(proposal));
  }
});

test("proposed system-exam identities and profile values match the authoring fixture", async () => {
  const generator = await loadGenerator();
  const artifact = readArtifact();
  const authoring = JSON.parse(
    readFileSync(systemExamAuthoringPath, "utf8"),
  ) as {
    executionPresets: Array<{
      orderKey: string;
      profileKey: string;
      profile: {
        label: string;
        examScope: string;
        examMethod: string;
        sortOrder: number;
        noNormalFindingDefaults: boolean;
      };
    }>;
  };
  const byOrderKey = new Map(
    authoring.executionPresets.map((preset) => [preset.orderKey, preset]),
  );
  for (const proposal of artifact.proposedSystemExamOrders) {
    const source = byOrderKey.get(proposal.stableKey);
    if (!source) throw new Error(`system_exam_authoring_missing:${proposal.stableKey}`);
    expect(proposal.profileKey).toBe(source.profileKey);
    expect(proposal.profile).toMatchObject({
      label: source.profile.label,
      instruction: source.profile.examScope,
      sortOrder: source.profile.sortOrder,
      noNormalFindingDefaults: source.profile.noNormalFindingDefaults,
    });
    expect(proposal.presetId).toBe(generator.uuidV5(String(proposal.presetKey)));
  }
});

test("treatment amounts and clinical findings stay manual, while proposed system exams stay outside live coverage", async () => {
  const artifact = readArtifact();
  for (const entry of artifact.entries.filter(
    (candidate) => candidate.clinicalOrderType === "treatment",
  )) {
    expect(entry.defaultDetailInputs).not.toHaveProperty("administeredAmount");
    expect(entry.fieldPolicies.administeredAmount).toBe("required_manual");
    expect(entry.defaultDetailInputs.frequency).toBe("once");
    expect(entry.defaultDetailInputs.schedule).toBe("now");
  }
  expect(artifact.proposedSystemExamOrders).toHaveLength(12);
  expect(
    artifact.proposedSystemExamOrders.every(
      (proposal) =>
        proposal.proposedClinicalOrderType === "system_exam" &&
        proposal.runtimeClinicalOrderType === "system_exam" &&
        proposal.stableKey.startsWith("cm.order.system-exam.") &&
        Object.keys(proposal.defaultDetailInputs).sort().join(",") ===
          "bodySystem,examMethod,examScope" &&
        proposal.fieldPolicies.findingSummary === "required_manual" &&
        proposal.profile?.noNormalFindingDefaults === true,
    ),
  ).toBe(true);
  expect(
    artifact.entries.some(
      (entry) => entry.proposedClinicalOrderType === "system_exam",
    ),
  ).toBe(false);
});

test("representative category defaults are operationally useful without inventing clinical facts", async () => {
  const artifact = readArtifact();
  const hospitalization = findEntry(
    artifact.entries,
    "cm.order.synthetic.inpatient-01",
  );
  expect(hospitalization.defaultDetailInputs).toMatchObject({
    durationDays: 1,
    careLevel: "standard",
    monitoringInterval: 60,
  });
  const legacyDispensing = findEntry(
    artifact.entries,
    "cm.order.v4.dispensing.01",
  );
  expect(legacyDispensing.defaultDetailInputs).toMatchObject({
    doseBasis: "patient",
    route: "PO",
    storageMethod: "room_temp",
  });
  expect(legacyDispensing.defaultDetailInputs).not.toHaveProperty("dose");
  const imaging = findEntry(
    artifact.entries,
    "cm.order.imaging.abdominal-radiography",
  );
  expect(imaging.defaultDetailInputs).toMatchObject({
    bodyRegion: "복부",
    position: "표준 직교 자세",
    viewCount: 2,
    contrastRequired: false,
    sedationRequired: false,
  });
  expect(imaging.defaultDetailInputs.imagingProtocol).toContain(
    "복부 방사선 검사",
  );
  const treatment = findEntry(
    artifact.entries,
    "cm.order.synthetic.treatment-01",
  );
  expect(treatment.defaultDetailInputs).toMatchObject({
    frequency: "once",
    schedule: "now",
  });
  expect(treatment.defaultDetailInputs).not.toHaveProperty(
    "administeredAmount",
  );
});

test("input order does not change the artifact", async () => {
  const generator = await loadGenerator();
  const inputs = await generator.loadInputs();
  const baseline = await generator.generateArtifact({ inputs });
  const shuffled = {
    ...inputs,
    v4: { ...inputs.v4, records: [...inputs.v4.records].reverse() },
    payload: {
      ...inputs.payload,
      genericReleasePayload: {
        ...inputs.payload.genericReleasePayload,
        records: [...inputs.payload.genericReleasePayload.records].reverse(),
      },
    },
    supplement: {
      ...inputs.supplement,
      records: [...inputs.supplement.records].reverse(),
    },
  };
  const reordered = await generator.generateArtifact({ inputs: shuffled });
  expect(generator.canonicalize(reordered)).toBe(
    generator.canonicalize(baseline),
  );
});

test("input lineage revision and release identity drift fail closed", async () => {
  const generator = await loadGenerator();
  const inputs = await generator.loadInputs();

  const revisionTampered = JSON.parse(JSON.stringify(inputs)) as InputBundle;
  const revisionRecord = revisionTampered.supplement.records[0];
  if (!revisionRecord) throw new Error("lineage_revision_source_missing");
  revisionRecord.currentRevision = Number(revisionRecord.currentRevision) + 1;
  await expect(
    generator.generateArtifact({ inputs: revisionTampered }),
  ).rejects.toThrow("input_lineage_expected_hash_mismatch");

  const releaseTampered = JSON.parse(JSON.stringify(inputs)) as InputBundle;
  const releaseRecord = releaseTampered.supplement.records[0];
  if (!releaseRecord) throw new Error("lineage_release_source_missing");
  releaseRecord.currentReleaseId = "98383567-0b0b-4114-b78b-e845d8932ea3";
  await expect(
    generator.generateArtifact({ inputs: releaseTampered }),
  ).rejects.toThrow("input_lineage_expected_hash_mismatch");

  const artifact = readArtifact();
  const artifactTampered = JSON.parse(JSON.stringify(artifact)) as Artifact;
  artifactTampered.inputLineage[0].currentRevision += 1;
  expect(() => generator.validateArtifact(artifactTampered)).toThrow(
    "input_lineage_expected_hash_mismatch",
  );
  expect(() =>
    generator.validateArtifact(artifact, {
      expectedInputLineage: generator.buildInputLineage(inputs),
    }),
  ).not.toThrow();
});

test("unknown paths, missing frozen supplement, and artifact drift fail closed", async () => {
  const generator = await loadGenerator();
  const inputs = await generator.loadInputs();
  await expect(
    generator.generateArtifact({
      inputs: {
        ...inputs,
        v4: {
          ...inputs.v4,
          records: inputs.v4.records.map((record, index) =>
            record.recordType === "order" &&
            index ===
              inputs.v4.records.findIndex(
                (candidate) => candidate.recordType === "order",
              )
              ? {
                  ...record,
                  detail: {
                    ...record.detail,
                    classificationPathKey: "unknown.path",
                  },
                }
              : record,
          ),
        },
      },
    }),
  ).rejects.toThrow("unknown_classification_path");
  await expect(
    generator.generateArtifact({
      inputs: { ...inputs, supplement: undefined } as unknown as InputBundle,
    }),
  ).rejects.toThrow("supplement_schema_drift");
  const artifact = readArtifact();
  artifact.entries[0].defaultDetailInputs.unexpectedField = true;
  expect(() => generator.validateArtifact(artifact)).toThrow(
    "default_unknown_schema_key",
  );
});
