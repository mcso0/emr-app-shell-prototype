#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/airtable",
);
const datasetPath = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/datasets/dispensing-order-master.v1.json",
);
const rows = JSON.parse(await readFile(datasetPath, "utf8"));

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const field = (name, type, options = undefined) => {
  const normalizedOptions =
    (type === "singleSelect" || type === "multipleSelects") && options?.choices
      ? { ...options, choices: options.choices.map((choice) => ({ name: choice })) }
      : options;
  return {
    name,
    type,
    ...(normalizedOptions ? { options: normalizedOptions } : {}),
  };
};
const linkField = (name, linkedTableName) =>
  field(name, "multipleRecordLinks", { linkedTableName });
const table = (name, primaryFieldName, fields) => ({
  name,
  primaryFieldName,
  fields,
});

const schema = {
  schemaVersion: "clair-dispensing-airtable-schema-v1",
  target: {
    baseId: "applMtgWwOxwPigB8",
    baseName: "CLAiR Clinical Master",
  },
  mutationPolicy: {
    mode: "create_new_tables_only",
    existingTableMutationAllowed: false,
    deletionAllowed: false,
    unknownFieldAllowed: false,
    linkedRecordsResolvedByExternalKey: true,
  },
  tables: [
    table("Active Ingredients V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Normalized Name", "singleLineText"),
      field("English Source Name", "singleLineText"),
      field("Korean Review Status", "singleSelect", { choices: ["pending", "approved", "rejected"] }),
      field("Lifecycle Status", "singleSelect", { choices: ["technical_validated", "clinical_review_pending", "approved", "blocked"] }),
    ]),
    table("Medication Products V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Source Product ID", "singleLineText"),
      field("Authorization Number", "singleLineText"),
      field("Authorization Territory", "singleLineText"),
      field("Distribution Category", "singleLineText"),
      field("English Product Name", "singleLineText"),
      field("Korean Draft Name", "singleLineText"),
      field("Dosage Form", "singleLineText"),
      field("Routes JSON", "multilineText"),
      field("Species JSON", "multilineText"),
      field("Strength JSON", "multilineText"),
      field("ATCvet Code", "singleLineText"),
      field("Coverage Category", "singleLineText"),
      field("Packaged Shelf Life JSON", "multilineText"),
      field("Opened Shelf Life JSON", "multilineText"),
      field("Storage Codes JSON", "multilineText"),
      field("Lifecycle Status", "singleSelect", { choices: ["technical_validated", "clinical_review_pending", "approved", "blocked"] }),
      field("Clinical Use Allowed", "checkbox", { icon: "check", color: "greenBright" }),
      linkField("Evidence Documents", "Evidence Documents V1"),
    ]),
    table("Product Ingredients V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Ordinal", "number", { precision: 0 }),
      field("Strength JSON", "multilineText"),
      field("Pairing Status", "singleSelect", { choices: ["ordinal_direct_pending_review", "manual_review_required"] }),
      linkField("Product", "Medication Products V1"),
      linkField("Ingredient", "Active Ingredients V1"),
    ]),
    table("Species Applicability V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Species Code", "singleSelect", { choices: ["dog", "cat"] }),
      field("Evidence Status", "singleSelect", { choices: ["direct", "inferred", "not_found"] }),
      field("Lifecycle Status", "singleSelect", { choices: ["technical_validated", "clinical_review_pending", "approved", "blocked"] }),
      linkField("Product", "Medication Products V1"),
      linkField("Evidence Document", "Evidence Documents V1"),
    ]),
    table("Evidence Documents V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Authority", "singleLineText"),
      field("Jurisdiction", "singleLineText"),
      field("Document Type", "singleSelect", { choices: ["SPC"] }),
      field("Source URL", "url"),
      field("SHA-256", "singleLineText"),
      field("Page Count", "number", { precision: 0 }),
      field("Revision Raw", "singleLineText"),
      field("Accessed At", "date", { dateFormat: { name: "iso" } }),
      field("Lifecycle Status", "singleSelect", { choices: ["captured", "superseded", "blocked"] }),
    ]),
    table("Evidence Assertions V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Field Path", "singleLineText"),
      field("Evidence Mode", "singleSelect", { choices: ["direct", "inferred", "not_found"] }),
      field("Locator", "singleLineText"),
      field("Extraction Status", "singleSelect", { choices: ["technical_validated", "clinical_review_pending", "approved", "rejected"] }),
      linkField("Product", "Medication Products V1"),
      linkField("Evidence Document", "Evidence Documents V1"),
    ]),
    table("Clinical Reviews V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Subject Revision", "number", { precision: 0 }),
      field("Decision", "singleSelect", { choices: ["pending", "approved", "rejected", "superseded"] }),
      field("Reviewer User ID", "singleLineText"),
      field("Reviewer Eligibility Proof", "multilineText"),
      field("Decision Reason", "multilineText"),
      field("Reviewed At", "dateTime", {
        dateFormat: { name: "iso" },
        timeFormat: { name: "24hour" },
        timeZone: "Asia/Seoul",
      }),
    ]),
    table("Regulatory Profiles V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Jurisdiction", "singleSelect", { choices: ["KR"] }),
      field("Authorization Status", "singleSelect", { choices: ["not_verified", "approved", "rejected"] }),
      field("Controlled Status", "singleSelect", { choices: ["not_screened", "not_controlled", "controlled", "excluded"] }),
      field("Policy Version", "singleLineText"),
      field("Review Status", "singleSelect", { choices: ["pending", "approved", "rejected"] }),
      field("Clinical Use Allowed", "checkbox", { icon: "check", color: "greenBright" }),
      linkField("Product", "Medication Products V1"),
    ]),
    table("Dispensing Orders V1", "External Key", [
      field("External Key", "singleLineText"),
      field("Master Order ID", "singleLineText"),
      field("Canonical Order Key", "multilineText"),
      field("Canonical Fingerprint", "singleLineText"),
      field("English Display Name", "singleLineText"),
      field("Korean Draft Name", "singleLineText"),
      field("Korean Review Status", "singleSelect", { choices: ["pending", "approved", "rejected"] }),
      field("Clinical Order Type", "singleSelect", { choices: ["dispensing"] }),
      field("Destination", "singleSelect", { choices: ["dispensing"] }),
      field("Lifecycle Status", "singleSelect", { choices: ["technical_validated", "clinical_review_pending", "approved", "blocked"] }),
      field("Clinical Use Allowed", "checkbox", { icon: "check", color: "greenBright" }),
      field("Activation Blocks JSON", "multilineText"),
      field("Dose Default", "singleLineText"),
      field("Frequency Default", "singleLineText"),
      field("Duration Default", "singleLineText"),
      field("BUD Rule", "singleLineText"),
      linkField("Product", "Medication Products V1"),
      linkField("Clinical Review", "Clinical Reviews V1"),
      linkField("Regulatory Profile", "Regulatory Profiles V1"),
    ]),
  ],
};

const tableRecords = Object.fromEntries(schema.tables.map((value) => [value.name, []]));
const push = (tableName, externalKey, fields, links = {}) => {
  tableRecords[tableName].push({ externalKey, fields: { "External Key": externalKey, ...fields }, links });
};
const ingredientNames = new Map();

for (const row of rows) {
  const productKey = `product:${row.product.sourceProductId}`;
  const evidenceKey = `evidence:${row.evidence.spcDocumentSha256}`;
  const orderKey = `order:${row.masterOrderId}`;
  const reviewKey = `review:${row.masterOrderId}:1`;
  const regulatoryKey = `regulatory:${row.product.sourceProductId}:KR`;

  push("Evidence Documents V1", evidenceKey, {
    Authority: row.evidence.authority,
    Jurisdiction: row.regulatory.sourceJurisdiction,
    "Document Type": "SPC",
    "Source URL": row.evidence.spcUrl,
    "SHA-256": row.evidence.spcDocumentSha256,
    "Page Count": row.evidence.spcPageCount,
    "Revision Raw": row.evidence.spcRevisionRaw,
    "Accessed At": row.evidence.sourceSnapshotAccessedAt,
    "Lifecycle Status": "captured",
  });

  push(
    "Medication Products V1",
    productKey,
    {
      "Source Product ID": row.product.sourceProductId,
      "Authorization Number": row.product.authorizationNumber,
      "Authorization Territory": row.product.authorizationTerritory,
      "Distribution Category": row.product.distributionCategory,
      "English Product Name": row.display.en,
      "Korean Draft Name": row.display.koDraft,
      "Dosage Form": row.product.dosageForm,
      "Routes JSON": JSON.stringify(row.product.route),
      "Species JSON": JSON.stringify(row.product.targetSpecies),
      "Strength JSON": JSON.stringify(row.product.strength.expressions),
      "ATCvet Code": row.product.atcVetCode,
      "Coverage Category": row.product.coverageCategory,
      "Packaged Shelf Life JSON": JSON.stringify(row.handling.packagedShelfLife),
      "Opened Shelf Life JSON": JSON.stringify(row.handling.shelfLifeAfterOpening),
      "Storage Codes JSON": JSON.stringify(row.handling.storageCodes),
      "Lifecycle Status": "clinical_review_pending",
      "Clinical Use Allowed": false,
    },
    { "Evidence Documents": [evidenceKey] },
  );

  row.product.normalizedActiveIngredients.forEach((ingredient, index) => {
    const ingredientKey = `ingredient:${ingredient}`;
    ingredientNames.set(ingredientKey, ingredient);
    const directPairing =
      row.product.normalizedActiveIngredients.length ===
      row.product.strength.expressions.length;
    const strength = directPairing ? row.product.strength.expressions[index] : null;
    push(
      "Product Ingredients V1",
      `product-ingredient:${row.product.sourceProductId}:${String(index + 1).padStart(2, "0")}`,
      {
        Ordinal: index + 1,
        "Strength JSON": strength ? JSON.stringify(strength) : "",
        "Pairing Status": directPairing
          ? "ordinal_direct_pending_review"
          : "manual_review_required",
      },
      { Product: [productKey], Ingredient: [ingredientKey] },
    );
  });

  for (const species of row.product.targetSpecies) {
    push(
      "Species Applicability V1",
      `species:${row.product.sourceProductId}:${species}`,
      {
        "Species Code": species,
        "Evidence Status": row.evidence.targetSpecies.status,
        "Lifecycle Status": "clinical_review_pending",
      },
      { Product: [productKey], "Evidence Document": [evidenceKey] },
    );
  }

  const assertions = [
    ["product.identity", "direct", "VMD product database row and SPC document"],
    ["product.strength", "direct", "Official product name"],
    ["product.dosageForm", "direct", "VMD pharmaceutical form"],
    ["product.route", "direct", row.evidence.routeEvidenceMode],
    ["product.targetSpecies", row.evidence.targetSpecies.status, row.evidence.targetSpecies.locator],
    ["handling.storage", row.evidence.storage.status, row.evidence.storage.locator],
  ];
  for (const [fieldPath, mode, locator] of assertions) {
    push(
      "Evidence Assertions V1",
      `assertion:${row.product.sourceProductId}:${fieldPath}`,
      {
        "Field Path": fieldPath,
        "Evidence Mode": mode,
        Locator: locator ?? "not_found",
        "Extraction Status": "clinical_review_pending",
      },
      { Product: [productKey], "Evidence Document": [evidenceKey] },
    );
  }

  push("Clinical Reviews V1", reviewKey, {
    "Subject Revision": 1,
    Decision: "pending",
    "Reviewer User ID": "",
    "Reviewer Eligibility Proof": "",
    "Decision Reason": "Named eligible veterinarian review required",
    "Reviewed At": "",
  });
  push(
    "Regulatory Profiles V1",
    regulatoryKey,
    {
      Jurisdiction: "KR",
      "Authorization Status": "not_verified",
      "Controlled Status": "not_screened",
      "Policy Version": "",
      "Review Status": "pending",
      "Clinical Use Allowed": false,
    },
    { Product: [productKey] },
  );
  push(
    "Dispensing Orders V1",
    orderKey,
    {
      "Master Order ID": row.masterOrderId,
      "Canonical Order Key": row.canonicalOrderKey,
      "Canonical Fingerprint": row.canonicalOrderFingerprint,
      "English Display Name": row.display.en,
      "Korean Draft Name": row.display.koDraft,
      "Korean Review Status": "pending",
      "Clinical Order Type": "dispensing",
      Destination: "dispensing",
      "Lifecycle Status": "clinical_review_pending",
      "Clinical Use Allowed": false,
      "Activation Blocks JSON": JSON.stringify(row.activationBlockReasons),
      "Dose Default": "",
      "Frequency Default": "",
      "Duration Default": "",
      "BUD Rule": "",
    },
    {
      Product: [productKey],
      "Clinical Review": [reviewKey],
      "Regulatory Profile": [regulatoryKey],
    },
  );
}

for (const [ingredientKey, ingredient] of [...ingredientNames.entries()].sort()) {
  push("Active Ingredients V1", ingredientKey, {
    "Normalized Name": ingredient,
    "English Source Name": ingredient,
    "Korean Review Status": "pending",
    "Lifecycle Status": "clinical_review_pending",
  });
}

for (const records of Object.values(tableRecords)) {
  records.sort((a, b) => a.externalKey.localeCompare(b.externalKey));
}

const payload = {
  schemaVersion: "clair-dispensing-airtable-records-v1",
  target: schema.target,
  datasetRevision: "2026-08-26.1",
  sourceDatasetSha256:
    "cc3ef6c977122bef5a708d5c6a800a3120b257584bd78ee72c26a67d2b95260f",
  importMode: "two_pass_create_then_resolve_links_by_external_key",
  clinicalUseAllowed: false,
  recordsByTable: tableRecords,
};

const schemaText = `${JSON.stringify(schema, null, 2)}\n`;
const payloadText = `${JSON.stringify(payload, null, 2)}\n`;
const counts = Object.fromEntries(
  Object.entries(tableRecords).map(([name, records]) => [name, records.length]),
);
const totalRecords = Object.values(counts).reduce((total, count) => total + count, 0);
const unresolvedLinks = Object.entries(tableRecords).flatMap(([tableName, records]) =>
  records.flatMap((record) =>
    Object.entries(record.links).flatMap(([fieldName, keys]) =>
      keys.map((key) => ({ tableName, externalKey: record.externalKey, fieldName, key })),
    ),
  ),
);
const allExternalKeys = new Set(
  Object.values(tableRecords).flatMap((records) => records.map((record) => record.externalKey)),
);
const missingLinkKeys = unresolvedLinks.filter((link) => !allExternalKeys.has(link.key));
const duplicateKeys = Object.entries(tableRecords).flatMap(([tableName, records]) => {
  const seen = new Set();
  return records
    .filter((record) => (seen.has(record.externalKey) ? true : (seen.add(record.externalKey), false)))
    .map((record) => `${tableName}:${record.externalKey}`);
});
const summary = {
  schemaVersion: "clair-dispensing-airtable-summary-v1",
  target: schema.target,
  newTableCount: schema.tables.length,
  existingTableMutationCount: 0,
  deletionCount: 0,
  counts,
  totalRecords,
  linkReferenceCount: unresolvedLinks.length,
  missingLinkKeyCount: missingLinkKeys.length,
  duplicateExternalKeyCount: duplicateKeys.length,
  clinicalUseAllowedCount: Object.values(tableRecords)
    .flat()
    .filter((record) => record.fields["Clinical Use Allowed"] === true).length,
  schemaSha256: sha256(schemaText),
  recordsSha256: sha256(payloadText),
};

if (missingLinkKeys.length || duplicateKeys.length) {
  throw new Error(
    JSON.stringify({ missingLinkKeys: missingLinkKeys.slice(0, 20), duplicateKeys: duplicateKeys.slice(0, 20) }),
  );
}

await mkdir(artifactDir, { recursive: true });
await Promise.all([
  writeFile(path.join(artifactDir, "dispensing-order-authoring-schema.v1.json"), schemaText),
  writeFile(path.join(artifactDir, "dispensing-order-authoring-records.v1.json"), payloadText),
  writeFile(
    path.join(artifactDir, "dispensing-order-authoring-summary.v1.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  ),
]);

console.log(JSON.stringify(summary, null, 2));
