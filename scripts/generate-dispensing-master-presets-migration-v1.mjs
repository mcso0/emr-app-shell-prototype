import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = JSON.parse(readFileSync(resolve(
  ROOT,
  "docs/work/clinical-master/clinical-master-pr-019/dispensing-master-presets.v1.json",
), "utf8"));
const template = readFileSync(resolve(
  ROOT,
  "scripts/templates/dispensing-master-presets-v1.sql.tmpl",
), "utf8");
const rows = artifact.entries.map((entry) => {
  const medicationMetadata = { ...entry.medicationMetadata };
  delete medicationMetadata.defaultDetailInputs;
  const provenance = { ...entry.provenance };
  const { fieldEvidence } = provenance;
  delete provenance.sourceExtractEntriesSha256;
  delete provenance.inferenceNotice;
  delete provenance.fieldEvidence;
  return {
    presetId: entry.presetId,
    presetKey: entry.presetKey,
    presetRevision: entry.presetRevision,
    dispensingProfileId: entry.dispensingProfileId,
    dispensingProfileRevision: entry.dispensingProfileRevision,
    presetStatus: entry.presetStatus,
    detailSchemaVersion: entry.detailSchemaVersion,
    detailInputs: entry.detailInputs,
    medicationMetadata,
    provenance,
    frequencyEvidenceMode: fieldEvidence.frequency,
    durationEvidenceMode: fieldEvidence.durationDays,
    medicationInstructionEvidenceMode: fieldEvidence.medicationInstruction,
    contentSha256: entry.contentSha256,
    clinicalUseAllowed: entry.clinicalUseAllowed,
  };
});
const sql = template
  .replace("__PRESET_ROWS_JSON__", JSON.stringify(rows))
  .replaceAll("__ENTRIES_SHA256__", artifact.entriesSha256)
  .replaceAll("__SOURCE_EXTRACT_SHA256__", artifact.sourceExtractEntriesSha256);
const output = resolve(
  ROOT,
  "supabase/migrations/20260826200000_clinical_master_dispensing_master_presets.sql",
);
writeFileSync(output, sql);
console.log(JSON.stringify({ output, rows: rows.length, entriesSha256: artifact.entriesSha256 }, null, 2));
