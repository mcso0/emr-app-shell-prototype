import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const generatorPath = resolve(
  process.cwd(),
  "scripts/generate-clinical-master-execution-preset-release-v1.mjs",
);
const releasePath = resolve(
  process.cwd(),
  "tests/fixtures/clinical-master-execution-preset-release-v1.json",
);
const presetPath = resolve(
  process.cwd(),
  "tests/fixtures/clinical-master-order-execution-presets-v1.json",
);
const systemExamPath = resolve(
  process.cwd(),
  "tests/fixtures/clinical-master-system-exam-authoring-v1.json",
);
const frozenOrdersPath = resolve(
  process.cwd(),
  "tests/fixtures/clinical-master-execution-preset-release-frozen-orders.v1.json",
);
const liveLineagePath = resolve(
  process.cwd(),
  "tests/fixtures/clinical-master-order-execution-presets-live-lineage.v1.json",
);
const v4Path = resolve(
  process.cwd(),
  "tests/fixtures/clinical-master-operational-v4-adapter-output.json",
);
const dispensingPath = resolve(
  process.cwd(),
  "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json",
);

type JsonRecord = Record<string, unknown>;
type PublisherRecord = JsonRecord & {
  masterKey: string;
  recordType: string;
  detail: JsonRecord;
};
type PublisherPayload = {
  releaseKey: string;
  releaseNotes: string;
  adoptionScope: string;
  publishedByLabel: string;
  records: PublisherRecord[];
  classificationPaths: Array<{ pathKey: string }>;
  labPanelItems: JsonRecord[];
  labOrderProfiles: Array<{ orderMasterKey: string }>;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function withoutExecutionPreset(record: PublisherRecord): PublisherRecord {
  const clone = structuredClone(record);
  delete clone.detail.executionPreset;
  return clone;
}

async function compilerModule() {
  return import(pathToFileURL(generatorPath).href) as Promise<{
    EXECUTION_PRESET_ENVELOPE_KEYS: string[];
    buildReleasePayload: (inputs: JsonRecord) => PublisherPayload;
    canonicalize: (value: unknown) => string;
    canonicalizePostgresJsonbText: (value: unknown) => string;
    loadInputs: () => Promise<JsonRecord>;
    publisherContentHash: (value: JsonRecord) => string;
    validateReleasePayload: (payload: PublisherPayload) => boolean;
  }>;
}

test("publisher hash serializer matches PostgreSQL jsonb key ordering", async () => {
  const { canonicalizePostgresJsonbText } = await compilerModule();
  expect(
    canonicalizePostgresJsonbText({
      presetRevision: 1,
      presetId: "id",
      presetKey: "key",
      provenance: { sourceReleaseKey: null, sourceType: "synthetic" },
    }),
  ).toBe(
    '{"presetId": "id", "presetKey": "key", "provenance": {"sourceType": "synthetic", "sourceReleaseKey": null}, "presetRevision": 1}',
  );
});

test("compiler emits the existing exact publisher payload contract", async () => {
  const payload = readJson<PublisherPayload>(releasePath);
  expect(Object.keys(payload).sort()).toEqual([
    "adoptionScope",
    "classificationPaths",
    "labOrderProfiles",
    "labPanelItems",
    "publishedByLabel",
    "records",
    "releaseKey",
    "releaseNotes",
  ]);
  expect(payload).toMatchObject({
    releaseKey: "cm.release.execution-presets.v1.2026-08-31.1",
    adoptionScope: "payload",
    publishedByLabel: "CLAiR synthetic execution preset compiler",
  });
  const { validateReleasePayload } = await compilerModule();
  expect(validateReleasePayload(payload)).toBe(true);
});

test("all 522 orders have one exact synthetic-unreviewed execution preset", async () => {
  const payload = readJson<PublisherPayload>(releasePath);
  const presets = readJson<{
    entries: Array<{
      masterKey: string;
      presetRevision: number;
      contentSha256: string;
      sourceArtifactSha256: string;
    }>;
  }>(presetPath);
  const systemExam = readJson<{
    stableOrderKeys: string[];
    executionPresets: Array<{
      orderKey: string;
      preset: {
        contentSha256: string;
        sourceArtifactSha256: string;
      };
    }>;
  }>(systemExamPath);
  const orders = payload.records.filter((record) => record.recordType === "order");
  const { EXECUTION_PRESET_ENVELOPE_KEYS } = await compilerModule();
  expect(orders).toHaveLength(522);
  expect(new Set(orders.map((record) => record.masterKey)).size).toBe(522);
  expect(orders.map((record) => record.masterKey)).toEqual(
    [...orders.map((record) => record.masterKey)].sort(),
  );
  expect(orders.map((record) => record.masterKey)).toEqual(
    [
      ...presets.entries.map((entry) => entry.masterKey),
      ...systemExam.stableOrderKeys,
    ].sort(),
  );

  const presetByKey = new Map([
    ...presets.entries.map((entry) => [entry.masterKey, entry] as const),
    ...systemExam.executionPresets.map((entry) => [entry.orderKey, entry.preset] as const),
  ]);
  for (const order of orders) {
    const envelope = order.detail.executionPreset as JsonRecord;
    const sourcePreset = presetByKey.get(order.masterKey);
    expect(Object.keys(envelope).sort()).toEqual(
      [...EXECUTION_PRESET_ENVELOPE_KEYS].sort(),
    );
    expect(envelope).toMatchObject({
      presetStatus: "synthetic_unreviewed",
      clinicalUseAllowed: false,
      contentSha256: sourcePreset?.contentSha256,
      sourceArtifactSha256: sourcePreset?.sourceArtifactSha256,
    });
    expect(Object.keys(envelope.defaultDetailInputs as JsonRecord).length).toBeGreaterThan(0);
  }
  expect(
    orders.filter(
      (record) =>
        (record.detail.executionPreset as JsonRecord).presetRevision === 2,
    ),
  ).toHaveLength(108);
  expect(
    orders.filter(
      (record) =>
        (record.detail.executionPreset as JsonRecord).presetRevision === 1,
    ),
  ).toHaveLength(414);
});

test("compiler preserves every source order field and adds only executionPreset", () => {
  const payload = readJson<PublisherPayload>(releasePath);
  const v4 = readJson<{ payload: PublisherPayload }>(v4Path).payload;
  const dispensing = readJson<{ genericReleasePayload: PublisherPayload }>(
    dispensingPath,
  ).genericReleasePayload;
  const frozen = readJson<{
    entries: Array<{ record: PublisherRecord }>;
  }>(frozenOrdersPath);
  const systemExam = readJson<{ records: PublisherRecord[] }>(systemExamPath);
  const sourceByKey = new Map(
    [
      ...v4.records.filter((record) => record.recordType === "order"),
      ...dispensing.records.filter((record) => record.recordType === "order"),
      ...frozen.entries.map((entry) => entry.record),
      ...systemExam.records,
    ].map((record) => [record.masterKey, record]),
  );
  expect(sourceByKey.size).toBe(522);
  for (const order of payload.records.filter(
    (record) => record.recordType === "order",
  )) {
    expect(withoutExecutionPreset(order)).toEqual(sourceByKey.get(order.masterKey));
  }
});

test("live-only frozen orders retain exact lineage locks and metabolic profile", () => {
  const frozen = readJson<{
    artifactSha256: string;
    entries: Array<{
      masterKey: string;
      currentRevision: number;
      releaseKey: string;
      snapshotSha256: string;
      labOrderProfile: JsonRecord | null;
    }>;
  }>(frozenOrdersPath);
  expect(frozen.artifactSha256).toBe(
    "18cb04b939264fac974b62617ba8d6538429ecd23792bc342a04431abeb2d57f",
  );
  expect(frozen.entries).toMatchObject([
    {
      masterKey: "cm.order.consult.initial",
      currentRevision: 2,
      releaseKey: "cm.release.airtable.operational-pilot.v2",
      snapshotSha256:
        "a8f028ea29c6c24982ed7ead0d7c6c9778c49861e77c46a774435b3fbdc880fd",
      labOrderProfile: null,
    },
    {
      masterKey: "phase1.optionb.v1.order.metabolic",
      currentRevision: 1,
      releaseKey: "phase1-optionb-lab-v1",
      snapshotSha256:
        "50cec96dae46164bc6d9d09aaef8d20661c23fab3cc5162491e3819c769cbb00",
      labOrderProfile: {
        orderMasterKey: "phase1.optionb.v1.order.metabolic",
        labTestMasterKey: null,
        labPanelMasterKey: "phase1.optionb.v1.panel.metabolic",
        specimenMasterKey: "phase1.optionb.v1.specimen.serum",
      },
    },
  ]);
  const payload = readJson<PublisherPayload>(releasePath);
  expect(
    payload.labOrderProfiles.filter(
      (profile) =>
        profile.orderMasterKey === "phase1.optionb.v1.order.metabolic",
    ),
  ).toHaveLength(1);
});

test("publisher payload never carries generated master or release lineage", () => {
  const payload = readJson<PublisherPayload>(releasePath);
  expect(payload).not.toHaveProperty("releaseId");
  for (const order of payload.records.filter(
    (record) => record.recordType === "order",
  )) {
    expect(order).not.toHaveProperty("revision");
    expect(order).not.toHaveProperty("masterRecordId");
    expect(order).not.toHaveProperty("releaseId");
  }
});

test("compiler binds the base, live-lineage, and system-exam artifact hashes", async () => {
  const { buildReleasePayload, loadInputs } = await compilerModule();
  const inputs = await loadInputs();
  const presets = inputs.presets as {
    artifactSha256: string;
    sourceEntriesSha256: string;
    expectedLiveIdentityRevisionSha256: string;
    expectedInputLineageSha256: string;
    inputLineageSha256: string;
  };
  const liveLineage = readJson<{
    recordCount: number;
    stableKeySetSha256: string;
    lineageSha256: string;
  }>(liveLineagePath);
  const systemExam = inputs.systemExam as { artifactSha256: string };

  expect(presets).toMatchObject({
    artifactSha256:
      "02c4ad67463545fa502e263fd7681b203b3e866702d23cbf364edbfe6276f6c0",
    sourceEntriesSha256:
      "a3ea174d81325d993aa9cc233d714c4a3eee990392dd7e931f0433bb86c24a25",
    expectedLiveIdentityRevisionSha256:
      "b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb",
    expectedInputLineageSha256:
      "e8c5b28660efd3c6c0091a105fcd5e6234010a851f07cc4e16f1da91582b3198",
    inputLineageSha256:
      "e8c5b28660efd3c6c0091a105fcd5e6234010a851f07cc4e16f1da91582b3198",
  });
  expect(liveLineage).toMatchObject({
    recordCount: 510,
    stableKeySetSha256:
      "2197c142243464c7d14ffc1ae921106ed609084fb960fd4eba2c309f6fe80164",
    lineageSha256:
      "b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb",
  });
  expect(systemExam.artifactSha256).toBe(
    "594241e8d753a9117f18ffc392930f51e01976f6ed19f9f36f341d8f456521c6",
  );
  expect(() => buildReleasePayload(inputs)).not.toThrow();
});

test("all 108 PR-019 current preset identities advance in place to revision 2", async () => {
  const { loadInputs } = await compilerModule();
  const inputs = await loadInputs();
  const currentPresets = (
    inputs.dispensingPresets as {
      entries: Array<{
        orderMasterKey: string;
        presetId: string;
        presetKey: string;
        presetRevision: number;
        contentSha256: string;
      }>;
    }
  ).entries;
  const nextPresets = new Map(
    (
      inputs.presets as {
        entries: Array<{
          masterKey: string;
          presetId: string;
          presetKey: string;
          presetRevision: number;
          expectedOrderRevisionPolicy: { expectedRevision: number };
          provenance: JsonRecord;
        }>;
      }
    ).entries.map((entry) => [entry.masterKey, entry]),
  );
  const liveLineage = new Map(
    (
      inputs.liveLineage as {
        records: Array<{ masterKey: string; currentRevision: number }>;
      }
    ).records.map((entry) => [entry.masterKey, entry]),
  );

  expect(currentPresets).toHaveLength(108);
  for (const current of currentPresets) {
    const next = nextPresets.get(current.orderMasterKey);
    expect(next).toMatchObject({
      presetId: current.presetId,
      presetKey: current.presetKey,
      presetRevision: current.presetRevision + 1,
      provenance: {
        sourcePresetId: current.presetId,
        sourcePresetKey: current.presetKey,
        sourcePresetRevision: current.presetRevision,
        sourcePresetContentSha256: current.contentSha256,
      },
    });
    expect(next?.expectedOrderRevisionPolicy.expectedRevision).toBe(
      liveLineage.get(current.orderMasterKey)?.currentRevision,
    );
  }
});

test("compiler fails closed for tampered artifact and source-entry hashes", async () => {
  const { buildReleasePayload, loadInputs } = await compilerModule();
  const inputs = await loadInputs();

  const baseArtifact = structuredClone(inputs) as JsonRecord;
  (baseArtifact.presets as { artifactSha256: string }).artifactSha256 =
    "0".repeat(64);
  expect(() => buildReleasePayload(baseArtifact)).toThrow(
    /base_preset_artifact_exact_lock_mismatch/u,
  );

  const sourceEntries = structuredClone(inputs) as JsonRecord;
  (sourceEntries.presets as { sourceEntriesSha256: string }).sourceEntriesSha256 =
    "0".repeat(64);
  expect(() => buildReleasePayload(sourceEntries)).toThrow(
    /base_preset_source_entries_exact_lock_mismatch/u,
  );

  const systemArtifact = structuredClone(inputs) as JsonRecord;
  (systemArtifact.systemExam as { artifactSha256: string }).artifactSha256 =
    "0".repeat(64);
  expect(() => buildReleasePayload(systemArtifact)).toThrow(
    /system_exam_artifact_exact_lock_mismatch/u,
  );
});

test("compiler fails closed for tampered full lineage and order revision", async () => {
  const { buildReleasePayload, loadInputs } = await compilerModule();
  const inputs = await loadInputs();

  const baseLineage = structuredClone(inputs) as JsonRecord;
  (baseLineage.presets as { inputLineageSha256: string }).inputLineageSha256 =
    "0".repeat(64);
  expect(() => buildReleasePayload(baseLineage)).toThrow(
    /base_preset_input_lineage_exact_lock_mismatch/u,
  );

  const liveLineage = structuredClone(inputs) as JsonRecord;
  (liveLineage.liveLineage as { lineageSha256: string }).lineageSha256 =
    "0".repeat(64);
  expect(() => buildReleasePayload(liveLineage)).toThrow(
    /base_preset_live_lineage_exact_lock_mismatch|live_lineage_exact_lock_mismatch/u,
  );

  const revision = structuredClone(inputs) as JsonRecord;
  const revisionEntry = (
    revision.presets as {
      entries: Array<{
        expectedOrderRevisionPolicy: { expectedRevision: number };
      }>;
    }
  ).entries[0];
  revisionEntry.expectedOrderRevisionPolicy.expectedRevision += 1;
  expect(() => buildReleasePayload(revision)).toThrow(
    /base_preset_revision_lineage_mismatch:/u,
  );

  const dispensingIdentity = structuredClone(inputs) as JsonRecord;
  const dispensingEntry = (
    dispensingIdentity.presets as {
      entries: Array<{
        provenance: { generatorProfileKey?: string };
        presetId: string;
      }>;
    }
  ).entries.find(
    (entry) => entry.provenance.generatorProfileKey === "dispensing.pr19-exact.v1",
  );
  expect(dispensingEntry).toBeDefined();
  dispensingEntry!.presetId = "00000000-0000-5000-8000-000000000000";
  expect(() => buildReleasePayload(dispensingIdentity)).toThrow(
    /dispensing_current_preset_lineage_mismatch:/u,
  );
});

test("compiler fails closed for missing, duplicate, and unknown preset identities", async () => {
  const { buildReleasePayload, loadInputs } = await compilerModule();
  const inputs = await loadInputs();
  const entries = (inputs.presets as { entries: JsonRecord[] }).entries;

  const missing = structuredClone(inputs) as JsonRecord;
  (missing.presets as { entries: JsonRecord[] }).entries.pop();
  expect(() => buildReleasePayload(missing)).toThrow(/preset_entry_count:509/u);

  const duplicate = structuredClone(inputs) as JsonRecord;
  (duplicate.presets as { entries: JsonRecord[] }).entries[1] = structuredClone(
    (duplicate.presets as { entries: JsonRecord[] }).entries[0],
  );
  expect(() => buildReleasePayload(duplicate)).toThrow(/preset_entry_duplicate:/u);

  const unknown = structuredClone(inputs) as JsonRecord;
  (unknown.presets as { entries: JsonRecord[] }).entries[0] = {
    ...entries[0],
    masterKey: "cm.order.unknown.execution-preset-probe",
  };
  expect(() => buildReleasePayload(unknown)).toThrow(
    /base_preset_stable_key_hash_invalid/u,
  );
});

test("check, write, and hash CLI modes are deterministic", () => {
  const firstHash = execFileSync("node", [generatorPath, "--hash"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
  const secondHash = execFileSync("node", [generatorPath, "--hash"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
  expect(firstHash).toBe(secondHash);
  expect(firstHash).toMatch(/^[0-9a-f]{64}$/u);
  expect(
    execFileSync("node", [generatorPath, "--check"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }),
  ).toContain("checked");

  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "clinical-master-preset-release-"),
  );
  const output = join(temporaryDirectory, "payload.json");
  try {
    expect(
      execFileSync(
        "node",
        [generatorPath, "--write", "--output", output],
        { cwd: process.cwd(), encoding: "utf8" },
      ),
    ).toContain(firstHash);
    expect(readJson<PublisherPayload>(output)).toEqual(
      readJson<PublisherPayload>(releasePath),
    );
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
});
