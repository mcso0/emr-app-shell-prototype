import {
  normalizeClinicalMasterAirtableAuthoringExport,
  type ClinicalMasterAirtableAuthoringExport,
  type ClinicalMasterAirtableAuthoringExportInput,
// @ts-expect-error -- explicit extension also supports the Node strip-types CLI.
} from "./server-clinical-master-airtable-export-core.ts";

export type ClinicalMasterDiagnosisPublishPayload = {
  releaseKey: string;
  releaseNotes: string | null;
  publishedByLabel: string;
  records: Array<{
    masterKey: string;
    recordType: "diagnosis_category" | "diagnosis";
    lifecycleStatus: "published";
    safetyStatus: "normal";
    safetyReason: string | null;
    changeSummary: string;
    sourceAssertionScope: string;
    sourceNotes: string | null;
    names: ClinicalMasterAirtableAuthoringExport["records"][number]["names"];
    source: ClinicalMasterAirtableAuthoringExport["records"][number]["source"];
    detail: Record<string, unknown>;
  }>;
  diagnosisCategoryLinks: ClinicalMasterAirtableAuthoringExport["diagnosisCategoryLinks"];
};

function isNormalizedAuthoringExport(
  value: ClinicalMasterAirtableAuthoringExportInput | ClinicalMasterAirtableAuthoringExport,
): value is ClinicalMasterAirtableAuthoringExport {
  return Array.isArray(value.records)
    && value.records.every((record) => "source" in record && Boolean(record.source));
}

export function adaptClinicalMasterDiagnosisPublishPayload(
  input: ClinicalMasterAirtableAuthoringExportInput | ClinicalMasterAirtableAuthoringExport,
): ClinicalMasterDiagnosisPublishPayload {
  const snapshot = isNormalizedAuthoringExport(input)
    ? input
    : normalizeClinicalMasterAirtableAuthoringExport(input);
  const records = snapshot.records
    .filter((record) => record.recordType === "diagnosis_category" || record.recordType === "diagnosis")
    .map((record) => ({
      masterKey: record.masterKey,
      recordType: record.recordType as "diagnosis_category" | "diagnosis",
      lifecycleStatus: "published" as const,
      safetyStatus: "normal" as const,
      safetyReason: record.safetyReason,
      changeSummary: record.changeSummary,
      sourceAssertionScope: record.sourceAssertionScope,
      sourceNotes: record.sourceNotes,
      names: record.names,
      source: record.source,
      detail: record.detail,
    }))
    .sort((left, right) => left.masterKey.localeCompare(right.masterKey));
  const diagnosisCategoryLinks = [...snapshot.diagnosisCategoryLinks]
    .sort((left, right) =>
      left.diagnosisMasterKey.localeCompare(right.diagnosisMasterKey)
      || left.sortOrder - right.sortOrder
      || left.categoryMasterKey.localeCompare(right.categoryMasterKey));

  const categoryCount = records.filter((record) => record.recordType === "diagnosis_category").length;
  const diagnosisCount = records.filter((record) => record.recordType === "diagnosis").length;
  if (categoryCount !== 12 || diagnosisCount !== 12 || diagnosisCategoryLinks.length !== 12) {
    throw new Error("The synthetic diagnosis runtime release must contain 12 categories, 12 diagnoses, and 12 links.");
  }

  return {
    releaseKey: `${snapshot.release.releaseKey}.diagnosis-runtime-v1`,
    releaseNotes: snapshot.release.releaseNotes,
    publishedByLabel: snapshot.release.publishedByLabel,
    records,
    diagnosisCategoryLinks,
  };
}
