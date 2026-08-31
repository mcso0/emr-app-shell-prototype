#!/usr/bin/env node

/**
 * Build the transport-only execution-preset artifact for CLINICAL-MASTER-PR-022.
 *
 * This generator deliberately has no database or network dependency.  It accepts
 * only the two versioned repository inputs plus an explicit frozen supplement for
 * the two live rows that are not represented by either input.  Missing or drifted
 * input is an error; a partial artifact is never emitted.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

export const CLINICAL_ORDER_TYPES = Object.freeze([
  "consultation",
  "clinical_lab",
  "imaging",
  "external_lab",
  "dispensing",
  "treatment",
  "hospitalization",
  "other",
]);

const FIELD_POLICIES = Object.freeze([
  "preset_fixed",
  "derived_from_profile",
  "schema_default",
  "workspace_resolved",
  "runtime_resolved",
  "required_manual",
  "not_applicable",
]);

const SOURCE_PATHS = Object.freeze({
  v4: "tests/fixtures/clinical-master-operational-v4-authoring.json",
  dispensingPayload:
    "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json",
  dispensingPresets:
    "docs/work/clinical-master/clinical-master-pr-019/dispensing-master-presets.v1.json",
  supplement:
    "tests/fixtures/clinical-master-order-execution-presets-frozen-supplement.v1.json",
  output: "tests/fixtures/clinical-master-order-execution-presets-v1.json",
});

const EXPECTED_ORDER_COUNT = 510;
const EXPECTED_V4_ORDER_COUNT = 400;
const EXPECTED_DISPENSING_ORDER_COUNT = 108;
const EXPECTED_SUPPLEMENT_ORDER_COUNT = 2;
const EXPECTED_STABLE_KEY_SET_SHA256 =
  "2197c142243464c7d14ffc1ae921106ed609084fb960fd4eba2c309f6fe80164";
const EXPECTED_LIVE_IDENTITY_REVISION_SHA256 =
  "b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb";
/**
 * Hash of the strongest order lineage that the frozen repository inputs can
 * actually represent.  This is intentionally a checked-in value: deriving
 * the expected hash from the same potentially drifted input would make the
 * gate tautological.
 */
export const EXPECTED_INPUT_LINEAGE_SHA256 =
  "e8c5b28660efd3c6c0091a105fcd5e6234010a851f07cc4e16f1da91582b3198";
const DISPENSING_SOURCE_RELEASE_ID =
  "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4";
const PRESET_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
export const CONTENT_HASH_FIELDS = Object.freeze([
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
]);

/**
 * Evidence is a traceability registry, not a clinical approval list.  The
 * URLs identify the public source families used to shape safe field names and
 * workflow defaults; every generated preset remains synthetic and blocked
 * from clinical use.
 */
export const AUTHORITATIVE_EVIDENCE_REGISTRY = Object.freeze([
  {
    evidenceKey: "ucum.units",
    url: "https://ucum.org/",
    scope: "Unit symbols and machine-readable unit vocabulary; does not select a test-specific unit.",
  },
  {
    evidenceKey: "cornell.eclinpath.sample-collection",
    url: "https://eclinpath.com/test-basics/sample-collection-2/",
    scope: "Field and workflow shape reference for veterinary specimen collection; not a patient-specific protocol or analyzer-specific reference interval authority.",
  },
  {
    evidenceKey: "dicom.wg25",
    url: "https://www.dicomstandard.org/activity/wgs/wg-25",
    scope: "Field and workflow shape reference for DICOM veterinary imaging interoperability; not authority for patient positioning, contrast, or sedation.",
  },
  {
    evidenceKey: "aaha.life-stage",
    url: "https://www.aaha.org/resources/2021-aaha-aafp-feline-life-stage-guidelines/feline-life-stage-home/",
    scope: "Field and workflow shape reference for feline life-stage care; not authority for a patient-specific protocol, dose, or reference range.",
  },
  {
    evidenceKey: "aaha.anesthesia",
    url: "https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/",
    scope: "Field and workflow shape reference for anesthesia and monitoring; not authority for an individual patient protocol, dose, or range.",
  },
  {
    evidenceKey: "aaha.dental",
    url: "https://www.aaha.org/resources/2019-aaha-dental-care-guidelines-for-dogs-and-cats/",
    scope: "Field and workflow shape reference for dental care; not authority for patient-specific findings, protocol, or administered amount.",
  },
  {
    evidenceKey: "aaha.vaccination.feline-2020",
    url: "https://www.aaha.org/resources/2020-aaha-aafp-feline-vaccination-guidelines/",
    scope: "Field and workflow shape reference for feline vaccination; not authority for a patient-specific vaccine, dose, schedule, or indication.",
  },
  {
    evidenceKey: "aaha.vaccination.canine-2022",
    url: "https://www.aaha.org/resources/2022-aaha-canine-vaccination-guidelines/",
    scope: "Field and workflow shape reference for canine vaccination; not authority for a patient-specific vaccine, dose, schedule, or indication.",
  },
  {
    evidenceKey: "aaha.fluid-therapy",
    url: "https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/",
    scope: "Field and workflow shape reference for fluid therapy; not authority for a patient-specific rate, volume, or protocol.",
  },
  {
    evidenceKey: "recover.2024.cpr",
    url: "https://recoverinitiative.org/2024-guidelines/",
    scope: "Veterinary CPR and emergency workflow context; does not determine patient-specific resuscitation orders.",
  },
  {
    evidenceKey: "uk-vmd.product-information",
    url: "https://www.vmd.defra.gov.uk/ProductInformationDatabase/",
    scope: "Veterinary product identity, label, route, and storage evidence; does not replace local prescribing review.",
  },
]);

const EVIDENCE_BY_CATEGORY = Object.freeze({
  consultation: Object.freeze({
    evidenceKeys: ["aaha.life-stage"],
    unresolvedClinicalAuthority: [
      "responsibleClinicianId is runtime-resolved; diagnosis, interpretation, and patient-specific plan remain veterinarian-authored.",
    ],
  }),
  preventive: Object.freeze({
    evidenceKeys: [
      "aaha.life-stage",
      "aaha.vaccination.feline-2020",
      "aaha.vaccination.canine-2022",
    ],
    unresolvedClinicalAuthority: [
      "vaccine choice, indication, schedule, and patient-specific exclusions require veterinarian review.",
    ],
  }),
  laboratory: Object.freeze({
    evidenceKeys: ["ucum.units", "cornell.eclinpath.sample-collection"],
    unresolvedClinicalAuthority: [
      "unit, reference interval, analyzer, method, and clinical interpretation are method- and patient-resolved; none is inferred here.",
    ],
  }),
  imaging: Object.freeze({
    evidenceKeys: ["dicom.wg25", "aaha.anesthesia"],
    unresolvedClinicalAuthority: [
      "final protocol, contrast, sedation, positioning exceptions, and interpretation are patient-specific and require manual review.",
    ],
  }),
  dispensing: Object.freeze({
    evidenceKeys: ["uk-vmd.product-information"],
    unresolvedClinicalAuthority: [
      "dose, frequency, duration, total quantity, and patient-specific prescribing remain required manual decisions; source label evidence is not a prescription.",
    ],
  }),
  treatment: Object.freeze({
    evidenceKeys: ["aaha.anesthesia", "aaha.dental", "aaha.fluid-therapy"],
    unresolvedClinicalAuthority: [
      "administered amount and treatment site are manual; patient indication, contraindications, and execution details require veterinarian review.",
    ],
  }),
  inpatient: Object.freeze({
    evidenceKeys: ["aaha.life-stage", "aaha.fluid-therapy"],
    unresolvedClinicalAuthority: [
      "ward or cage is workspace-resolved; diet, isolation, escalation, and patient monitoring plan require runtime clinical review.",
    ],
  }),
  emergency: Object.freeze({
    evidenceKeys: ["recover.2024.cpr"],
    unresolvedClinicalAuthority: [
      "triage acuity, resuscitation indication, intervention sequence, and patient-specific orders require veterinarian review.",
    ],
  }),
  surgery_anesthesia: Object.freeze({
    evidenceKeys: ["aaha.anesthesia"],
    unresolvedClinicalAuthority: [
      "patient risk, anesthetic plan, monitoring threshold, and administered amount remain manual clinical decisions.",
    ],
  }),
  dental: Object.freeze({
    evidenceKeys: ["aaha.dental"],
    unresolvedClinicalAuthority: [
      "dental findings, site, anesthesia, and administered amount require patient-specific veterinarian review.",
    ],
  }),
  certificate: Object.freeze({
    evidenceKeys: ["aaha.life-stage"],
    unresolvedClinicalAuthority: [
      "certificate purpose, attestation, patient facts, and signer remain manually verified.",
    ],
  }),
  dispensing_supply: Object.freeze({
    evidenceKeys: ["uk-vmd.product-information"],
    unresolvedClinicalAuthority: [
      "supply selection, quantity, price, and dispensing context are workspace- and operator-resolved; no dose is implied.",
    ],
  }),
});

const PATH_PROFILES = Object.freeze({
  "cm.path.consultation": {
    category: "consultation",
    clinicalOrderType: "consultation",
    destinationModule: null,
    executionMode: "immediate_complete",
    profileKey: "consultation.general.v1",
  },
  "cm.path.preventive-consultation": {
    category: "preventive",
    clinicalOrderType: "consultation",
    destinationModule: null,
    executionMode: "immediate_complete",
    profileKey: "consultation.preventive.v1",
  },
  "cm.path.dispensing": {
    category: "dispensing",
    clinicalOrderType: "dispensing",
    destinationModule: "dispensing",
    executionMode: "routed",
    profileKey: "dispensing.generic-order.v1",
  },
  "cm.path.imaging": {
    category: "imaging",
    clinicalOrderType: "imaging",
    destinationModule: "imaging",
    executionMode: "routed",
    profileKey: "imaging.named-procedure.v1",
  },
  "cm.path.laboratory": {
    category: "laboratory",
    clinicalOrderType: "clinical_lab",
    destinationModule: "lab",
    executionMode: "routed",
    profileKey: "laboratory.named-test.v1",
  },
  "phase1a2.fallback.path.lab": {
    category: "laboratory",
    clinicalOrderType: "clinical_lab",
    destinationModule: "lab",
    executionMode: "routed",
    profileKey: "laboratory.named-test.v1",
  },
  "cm.path.certificate": {
    category: "certificate",
    clinicalOrderType: "other",
    destinationModule: null,
    executionMode: "immediate_complete",
    profileKey: "other.certificate.v1",
  },
  "cm.path.dental": {
    category: "dental",
    clinicalOrderType: "treatment",
    destinationModule: "treatment",
    executionMode: "routed",
    profileKey: "treatment.dental.v1",
  },
  "cm.path.dispensing-billing": {
    category: "dispensing_supply",
    clinicalOrderType: "other",
    destinationModule: null,
    executionMode: "immediate_complete",
    profileKey: "other.dispensing-supply.v1",
  },
  "cm.path.emergency": {
    category: "emergency",
    clinicalOrderType: "other",
    destinationModule: null,
    executionMode: "immediate_complete",
    profileKey: "other.emergency-service.v1",
  },
  "cm.path.inpatient": {
    category: "inpatient",
    clinicalOrderType: "hospitalization",
    destinationModule: "hospitalization",
    executionMode: "routed",
    profileKey: "hospitalization.inpatient-care.v1",
  },
  "cm.path.preventive-consultation": {
    category: "preventive",
    clinicalOrderType: "consultation",
    destinationModule: null,
    executionMode: "immediate_complete",
    profileKey: "consultation.preventive.v1",
  },
  "cm.path.surgery-anesthesia": {
    category: "surgery_anesthesia",
    clinicalOrderType: "treatment",
    destinationModule: "treatment",
    executionMode: "routed",
    profileKey: "treatment.surgery-anesthesia.v1",
  },
  "cm.path.treatment": {
    category: "treatment",
    clinicalOrderType: "treatment",
    destinationModule: "treatment",
    executionMode: "routed",
    profileKey: "treatment.general.v1",
  },
});

const SCHEMA_FIELDS = Object.freeze({
  consultation: Object.freeze([
    "responsibleClinicianId",
    "occurrenceCount",
    "timing",
    "instructionSummary",
    "consultationNote",
    "attachments",
  ]),
  clinical_lab: Object.freeze([
    "specimenType",
    "testPanel",
    "collectionCondition",
    "pretreatment",
    "clinicalContext",
  ]),
  imaging: Object.freeze([
    "bodyRegion",
    "position",
    "viewCount",
    "contrastRequired",
    "sedationRequired",
    "imagingProtocol",
    "exceptions",
  ]),
  external_lab: Object.freeze([
    "providerId",
    "specimenType",
    "testItem",
    "shippingCondition",
    "providerForm",
    "packaging",
    "tracking",
  ]),
  dispensing: Object.freeze([
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
    "taperSchedule",
    "compoundNote",
    "guardianNote",
    "extraLabelSpeciesConfirmed",
    "extraLabelSpeciesReason",
  ]),
  treatment: Object.freeze([
    "method",
    "site",
    "administeredAmount",
    "frequency",
    "schedule",
    "stagedInstructions",
    "exceptions",
  ]),
  hospitalization: Object.freeze([
    "durationDays",
    "wardOrCage",
    "careLevel",
    "monitoringInterval",
    "nursingPlan",
    "dietPlan",
    "isolationPlan",
  ]),
  other: Object.freeze([
    "structuredValue",
    "description",
    "attachments",
    "exceptions",
  ]),
});

const SAFE_BODY_REGIONS = Object.freeze([
  ["흉부", "흉부"],
  ["복부", "복부"],
  ["두개골", "두개골"],
  ["슬관절", "슬관절"],
  ["고관절", "고관절"],
  ["견관절", "견관절"],
  ["주관절", "주관절"],
  ["수근관절", "수근관절"],
  ["족근관절", "족근관절"],
  ["비강", "비강"],
  ["경부", "경부"],
  ["근골격", "근골격계"],
  ["안구", "안구"],
  ["방광", "방광"],
  ["신장", "신장"],
  ["간담도", "간담도"],
  ["위장관", "위장관"],
  ["골반", "골반"],
  ["사지", "사지"],
  ["척추", "척추"],
  ["치과", "치과"],
]);

const HOSPITAL_CARE_LEVELS = Object.freeze([
  ["중환자", "intensive", 15],
  ["집중", "intensive", 15],
  ["격리", "isolation", 30],
  ["산소", "enhanced", 30],
  ["혈압", "enhanced", 30],
  ["호흡", "enhanced", 30],
  ["심전도", "enhanced", 30],
  ["산소포화도", "enhanced", 30],
]);

const DISPENSING_ROUTE_RULES = Object.freeze([
  ["경구제", "PO"],
  ["경구액", "PO"],
  ["시럽", "PO"],
  ["분말", "PO"],
  ["정제", "PO"],
  ["캡슐", "PO"],
  ["안약", "ophthalmic"],
  ["점안", "ophthalmic"],
  ["귀약", "otic"],
  ["귀 세정액", "otic"],
  ["외용액", "topical"],
  ["연고", "topical"],
  ["크림", "topical"],
  ["피부 보습제", "topical"],
]);

const TREATMENT_SITE_RULES = Object.freeze([
  ["귀", "ear"],
  ["안구", "eye"],
  ["눈", "eye"],
  ["흉강", "thorax"],
  ["복강", "abdomen"],
  ["방광", "bladder"],
  ["요도", "urethra"],
  ["비강", "nasal"],
  ["피부", "skin"],
  ["상처", "wound"],
  ["발바닥", "paw"],
  ["항문낭", "anal_sac"],
]);

const LAB_SPECIMEN_PROFILE_RULES = Object.freeze([
  {
    profileKeyPrefixes: [
      "cm.order.lab.panel.fecal",
      "cm.order.lab.test.fecal-",
      "cm.order.v4.lab-test.27",
      "cm.order.v4.lab-test.28",
    ],
    specimenType: "feces",
    profileKey: "laboratory.fecal.v1",
  },
  {
    profileKeyPrefixes: [
      "cm.order.lab.panel.urinalysis",
      "cm.order.lab.test.ua-",
      "cm.order.v4.lab-test.21",
      "cm.order.v4.lab-test.22",
      "cm.order.v4.lab-test.23",
      "cm.order.v4.lab-test.24",
      "cm.order.v4.lab-test.25",
      "cm.order.v4.lab-test.26",
    ],
    specimenType: "urine",
    profileKey: "laboratory.urine.v1",
  },
  {
    profileKeyPrefixes: [
      "cm.order.lab.panel.chemistry",
      "cm.order.lab.test.chem-",
      "cm.order.v4.lab-panel.",
    ],
    specimenType: "serum",
    profileKey: "laboratory.serum-chemistry.v1",
  },
  {
    profileKeyPrefixes: [
      "cm.order.lab.panel.cbc",
      "cm.order.lab.test.cbc-",
      "cm.order.v4.lab-test.",
      "cm.order.synthetic.lab-01",
      "cm.order.synthetic.lab-02",
      "cm.order.synthetic.lab-03",
      "cm.order.synthetic.lab-04",
      "cm.order.synthetic.lab-05",
      "cm.order.synthetic.lab-06",
      "cm.order.synthetic.lab-07",
      "cm.order.synthetic.lab-08",
      "cm.order.synthetic.lab-09",
    ],
    specimenType: "blood",
    profileKey: "laboratory.blood-or-serum.v1",
  },
]);

const LAB_NAME_SPECIMEN_RULES = Object.freeze([
  ["분변", "feces"],
  ["요검사", "urine"],
  ["요침사", "urine"],
  ["요시험지", "urine"],
  ["요단백", "urine"],
  ["요 크레아티닌", "urine"],
  ["혈청", "serum"],
  ["혈액", "blood"],
  ["혈소판", "blood"],
  ["백혈구", "blood"],
  ["헤마토크릿", "blood"],
  ["피부 세포", "swab"],
  ["귀 분비물", "swab"],
  ["관절액", "other"],
  ["종괴 세포", "tissue"],
]);

const SYSTEM_EXAM_PROPOSALS = Object.freeze([
  ["general-vitals", "전신상태·활력", "전신 상태와 활력 평가"],
  ["cardiovascular", "심혈관계", "심혈관계 평가"],
  ["respiratory", "호흡기계", "호흡기계 평가"],
  ["digestive-abdominal", "소화기·복부", "소화기 및 복부 평가"],
  ["urogenital", "비뇨생식기계", "비뇨생식기계 평가"],
  ["neurologic", "신경계", "신경계 평가"],
  ["musculoskeletal", "근골격계", "근골격계 평가"],
  ["dermatologic-coat", "피부·피모", "피부 및 피모 평가"],
  ["ophthalmic", "안과", "안과 평가"],
  ["otic", "이과", "이과 평가"],
  ["oral-dental", "구강·치과", "구강 및 치과 평가"],
  ["peripheral-lymphatic", "말초 림프계", "말초 림프계 평가"],
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** A deterministic JSON representation used for all fingerprints. */
export function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalizeOrderList(records) {
  return records
    .map((record) => deepClone(record))
    .sort((left, right) =>
      String(left.masterKey).localeCompare(String(right.masterKey)),
    )
    .map((record) => canonicalize(record));
}

function hashCanonical(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function uuidV5(name) {
  const namespace = Buffer.from(
    PRESET_UUID_NAMESPACE.replaceAll("-", ""),
    "hex",
  );
  const digest = createHash("sha1")
    .update(Buffer.concat([namespace, Buffer.from(name, "utf8")]))
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * PostgreSQL jsonb::text emits a canonical object representation with object
 * keys ordered by UTF-8 byte length and then bytewise, plus a single space
 * after object colons/commas.  Keep this
 * serializer separate from the compact artifact fingerprint serializer: the
 * publisher computes contentSha256 from the jsonb envelope itself.
 */
export function canonicalizePostgresJsonbText(value) {
  if (Array.isArray(value)) {
    return `[${value
      .map((entry) => canonicalizePostgresJsonbText(entry))
      .join(", ")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => {
        const lengthDelta =
          Buffer.byteLength(left, "utf8") - Buffer.byteLength(right, "utf8");
        return lengthDelta === 0
          ? Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
          : lengthDelta;
      })
      .map(
        (key) =>
          `${JSON.stringify(key)}: ${canonicalizePostgresJsonbText(value[key])}`,
      )
      .join(", ")}}`;
  }
  return JSON.stringify(value);
}

export function contentHashValue(content) {
  const subset = Object.fromEntries(
    CONTENT_HASH_FIELDS.map((field) => [field, content[field]]),
  );
  return createHash("sha256")
    .update(canonicalizePostgresJsonbText(subset))
    .digest("hex");
}

function withoutEntryContentHash(entry) {
  const content = { ...entry };
  delete content.contentSha256;
  delete content.sourceEntriesSha256;
  delete content.displayName;
  return content;
}

function withoutEntryTransportHashes(entry) {
  const content = withoutEntryContentHash(entry);
  delete content.sourceArtifactSha256;
  return content;
}

function hashOrderKeys(records) {
  return createHash("sha256")
    .update(
      records
        .map((record) => record.masterKey)
        .sort()
        .join("\n"),
    )
    .digest("hex");
}

function compareMasterKeys(left, right) {
  return Buffer.compare(
    Buffer.from(String(left.masterKey), "utf8"),
    Buffer.from(String(right.masterKey), "utf8"),
  );
}

function currentReleaseIdentity({ releaseKey = null, releaseId = null, releaseNo = null }) {
  return { releaseKey, releaseId, releaseNo };
}

/**
 * Project only lineage that is represented by the frozen local sources.  A
 * null identity component means that source did not carry that value; it is
 * never replaced with a generated UUID or an inferred remote value.
 */
export function buildInputLineage({ v4, payload, supplement }) {
  const v4ReleaseKey = v4?.release?.releaseKey ?? null;
  const payloadReleaseKey = payload?.genericReleasePayload?.releaseKey ?? null;
  const v4Orders =
    v4?.records?.filter((record) => record.recordType === "order") ?? [];
  const payloadOrders =
    payload?.genericReleasePayload?.records?.filter(
      (record) => record.recordType === "order",
    ) ?? [];
  const supplementRecords = supplement?.records ?? [];
  const lineage = [
    ...v4Orders.map((record) => ({
      masterKey: record.masterKey,
      currentRevision: 1,
      currentReleaseIdentity: currentReleaseIdentity({
        releaseKey: v4ReleaseKey,
      }),
    })),
    ...payloadOrders.map((record) => ({
      masterKey: record.masterKey,
      currentRevision: 1,
      currentReleaseIdentity: currentReleaseIdentity({
        releaseKey: payloadReleaseKey,
        releaseId: DISPENSING_SOURCE_RELEASE_ID,
      }),
    })),
    ...supplementRecords.map((record) => ({
      masterKey: record.masterKey,
      currentRevision: record.currentRevision,
      currentReleaseIdentity: currentReleaseIdentity({
        releaseId: record.currentReleaseId,
        releaseNo: record.releaseNo,
      }),
    })),
  ];
  return lineage.sort(compareMasterKeys);
}

export function inputLineageHash(lineage) {
  return hashCanonical(lineage);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function resolveInputPath(value, fallback) {
  return resolve(REPO_ROOT, value ?? fallback);
}

function preferredName(record) {
  const names = Array.isArray(record.names) ? record.names : [];
  const preferred = names.find(
    (name) => name.nameKind === "preferred" && name.languageCode === "ko",
  );
  return (
    preferred?.name ??
    names.find((name) => name.nameKind === "preferred")?.name ??
    record.name ??
    record.masterKey
  );
}

function sourceFingerprint(source, orderRecords) {
  const release = deepClone(
    source.release ?? source.genericReleasePayload ?? null,
  );
  if (isRecord(release)) delete release.records;
  return hashCanonical({
    release,
    orders: canonicalizeOrderList(orderRecords),
  });
}

function profileForPath(pathKey) {
  const profile = PATH_PROFILES[pathKey];
  assert(profile, `unknown_classification_path:${pathKey}`);
  return profile;
}

function evidenceForCategory(category, { species = [] } = {}) {
  const evidence = EVIDENCE_BY_CATEGORY[category];
  assert(evidence, `unknown_evidence_category:${category}`);
  let evidenceKeys = evidence.evidenceKeys;
  if (category === "preventive") {
    const speciesSet = new Set(species);
    const isCatOnly = speciesSet.has("cat") && !speciesSet.has("dog");
    const isDogOnly = speciesSet.has("dog") && !speciesSet.has("cat");
    evidenceKeys = [
      "aaha.life-stage",
      ...(isCatOnly ? ["aaha.vaccination.feline-2020"] : []),
      ...(isDogOnly ? ["aaha.vaccination.canine-2022"] : []),
      ...(!isCatOnly && !isDogOnly
        ? [
            "aaha.vaccination.feline-2020",
            "aaha.vaccination.canine-2022",
          ]
        : []),
    ];
  }
  return {
    evidenceKeys: [...evidenceKeys],
    unresolvedClinicalAuthority: [...evidence.unresolvedClinicalAuthority],
  };
}

function resolveLabSpecimen(masterKey, displayName) {
  const rule = LAB_SPECIMEN_PROFILE_RULES.find((candidate) =>
    candidate.profileKeyPrefixes.some((prefix) => masterKey.startsWith(prefix)),
  );
  if (rule)
    return { specimenType: rule.specimenType, profileKey: rule.profileKey };

  const nameRule = LAB_NAME_SPECIMEN_RULES.find(([label]) =>
    displayName.includes(label),
  );
  if (nameRule) {
    return {
      specimenType: nameRule[1],
      profileKey: `laboratory.${nameRule[1]}.name-derived.v1`,
    };
  }

  return { specimenType: null, profileKey: "laboratory.manual-specimen.v1" };
}

function resolveImagingBodyRegion(displayName) {
  const match = SAFE_BODY_REGIONS.find(([label]) =>
    displayName.includes(label),
  );
  return match?.[1] ?? null;
}

function resolveImagingProfile(masterKey, displayName) {
  const isRadiography =
    masterKey.includes("radiography") || displayName.includes("방사선");
  const isUltrasound =
    masterKey.includes("ultrasound") || displayName.includes("초음파");
  const isCt = displayName.includes("CT") || masterKey.includes("ct");
  if (isCt) {
    return {
      modality: "ct",
      position: "환자별 표준 자세",
      viewCount: 1,
      optionalFlags: false,
      profileKey: "imaging.ct-review.v1",
    };
  }
  if (isRadiography) {
    const position = displayName.includes("정면")
      ? "정면"
      : displayName.includes("측면")
        ? "측면"
        : displayName.includes("3방향")
          ? "표준 3방향 자세"
          : "표준 직교 자세";
    return {
      modality: "radiography",
      position,
      viewCount: displayName.includes("3방향") ? 3 : 2,
      optionalFlags: true,
      profileKey: "imaging.radiography.orthogonal.v1",
    };
  }
  if (isUltrasound) {
    return {
      modality: "ultrasound",
      position: "등쪽 또는 측면",
      viewCount: 1,
      optionalFlags: true,
      profileKey: "imaging.ultrasound.standard.v1",
    };
  }
  return {
    modality: "manual",
    position: null,
    viewCount: null,
    optionalFlags: false,
    profileKey: "imaging.manual-protocol.v1",
  };
}

function resolveLegacyDispensingProfile(displayName) {
  const routeMatch = DISPENSING_ROUTE_RULES.find(([label]) =>
    displayName.includes(label),
  );
  const route = routeMatch?.[1] ?? null;
  return {
    route,
    profileKey: route
      ? `dispensing.${route}.shape.v1`
      : "dispensing.manual-route.v1",
    storageMethod: "room_temp",
    medicationInstruction: "any_time",
  };
}

function resolveHospitalizationProfile(displayName) {
  const careLevelMatch = HOSPITAL_CARE_LEVELS.find(([label]) =>
    displayName.includes(label),
  );
  const careLevel = careLevelMatch?.[1] ?? "standard";
  const monitoringInterval = careLevelMatch?.[2] ?? 60;
  const durationMatch = displayName.match(/(\d+)일/);
  const durationDays = durationMatch ? Number(durationMatch[1]) : 1;
  return {
    careLevel,
    monitoringInterval,
    durationDays,
    profileKey: `hospitalization.${careLevel}.synthetic.v1`,
  };
}

function resolveTreatmentSite(displayName) {
  const match = TREATMENT_SITE_RULES.find(([label]) =>
    displayName.includes(label),
  );
  return match?.[1] ?? null;
}

function schemaPolicies(clinicalOrderType, overrides) {
  const fields = SCHEMA_FIELDS[clinicalOrderType];
  assert(fields, `unknown_schema_type:${clinicalOrderType}`);
  const policies = Object.fromEntries(
    fields.map((field) => [field, "required_manual"]),
  );
  for (const [key, value] of Object.entries(overrides)) {
    assert(
      fields.includes(key),
      `policy_unknown_schema_key:${clinicalOrderType}.${key}`,
    );
    assert(FIELD_POLICIES.includes(value), `unknown_field_policy:${value}`);
    policies[key] = value;
  }
  return policies;
}

function commonProvenance({
  sourceReleaseKey,
  sourceReleaseId = null,
  sourceFingerprintValue,
  sourceRecordFingerprint,
  profileKey,
  sourceType,
  sourceNotes,
  evidenceCategory,
  species,
}) {
  const evidence = evidenceForCategory(evidenceCategory, { species });
  return {
    sourceReleaseKey: sourceReleaseKey ?? null,
    sourceReleaseId,
    sourceFingerprint: sourceFingerprintValue,
    sourceRecordFingerprint,
    sourceType,
    generatorProfileKey: profileKey,
    sourceNotes,
    ...evidence,
    clinicalUseNotice:
      "Synthetic transport preset; veterinarian review is required before clinical use.",
  };
}

function genericDefaults({
  clinicalOrderType,
  displayName,
  masterKey,
  pathKey,
}) {
  if (clinicalOrderType === "consultation") {
    const preventive = pathKey === "cm.path.preventive-consultation";
    return {
      defaultDetailInputs: {
        occurrenceCount: 1,
        timing: "now",
        instructionSummary: preventive
          ? "예방 상담 진행"
          : `${displayName} 진행`,
      },
      fieldPolicies: schemaPolicies("consultation", {
        responsibleClinicianId: "runtime_resolved",
        occurrenceCount: "schema_default",
        timing: "schema_default",
        instructionSummary: "derived_from_profile",
        consultationNote: "required_manual",
        attachments: "not_applicable",
      }),
    };
  }

  if (clinicalOrderType === "clinical_lab") {
    const specimen = resolveLabSpecimen(masterKey, displayName);
    return {
      defaultDetailInputs: {
        ...(specimen.specimenType
          ? { specimenType: specimen.specimenType }
          : {}),
        testPanel: displayName,
        collectionCondition: "병원 표준 검체 채취 절차 확인 후 채취",
      },
      fieldPolicies: schemaPolicies("clinical_lab", {
        specimenType: specimen.specimenType
          ? "derived_from_profile"
          : "required_manual",
        testPanel: "derived_from_profile",
        collectionCondition: "preset_fixed",
        pretreatment: "required_manual",
        clinicalContext: "required_manual",
      }),
      profileKey: specimen.profileKey,
    };
  }

  if (clinicalOrderType === "imaging") {
    const bodyRegion = resolveImagingBodyRegion(displayName);
    const imaging = resolveImagingProfile(masterKey, displayName);
    return {
      defaultDetailInputs: {
        ...(bodyRegion ? { bodyRegion } : {}),
        ...(imaging.position ? { position: imaging.position } : {}),
        ...(imaging.viewCount ? { viewCount: imaging.viewCount } : {}),
        ...(imaging.optionalFlags
          ? { contrastRequired: false, sedationRequired: false }
          : {}),
        imagingProtocol: `${displayName} 표준 검사 프로토콜로 시행`,
      },
      fieldPolicies: schemaPolicies("imaging", {
        bodyRegion: bodyRegion ? "derived_from_profile" : "required_manual",
        position: imaging.position ? "derived_from_profile" : "required_manual",
        viewCount: imaging.viewCount
          ? "derived_from_profile"
          : "required_manual",
        contrastRequired: imaging.optionalFlags
          ? "derived_from_profile"
          : "required_manual",
        sedationRequired: imaging.optionalFlags
          ? "derived_from_profile"
          : "required_manual",
        imagingProtocol: "derived_from_profile",
        exceptions: "not_applicable",
      }),
      profileKey: imaging.profileKey,
    };
  }

  if (clinicalOrderType === "dispensing") {
    const dispensing = resolveLegacyDispensingProfile(displayName);
    return {
      defaultDetailInputs: {
        doseBasis: "patient",
        ...(dispensing.route ? { route: dispensing.route } : {}),
        medicationInstruction: dispensing.medicationInstruction,
        storageMethod: dispensing.storageMethod,
        extraLabelSpeciesConfirmed: false,
      },
      fieldPolicies: schemaPolicies("dispensing", {
        doseBasis: "derived_from_profile",
        dose: "required_manual",
        doseUnit: "required_manual",
        route: dispensing.route ? "derived_from_profile" : "required_manual",
        frequency: "required_manual",
        durationDays: "required_manual",
        totalQuantity: "required_manual",
        totalQuantityUnit: "required_manual",
        medicationInstruction: "derived_from_profile",
        storageMethod: "derived_from_profile",
        taperSchedule: "required_manual",
        compoundNote: "required_manual",
        guardianNote: "required_manual",
        extraLabelSpeciesConfirmed: "schema_default",
        extraLabelSpeciesReason: "required_manual",
      }),
      profileKey: dispensing.profileKey,
    };
  }

  if (clinicalOrderType === "treatment") {
    const site = resolveTreatmentSite(displayName);
    return {
      defaultDetailInputs: {
        method: displayName,
        ...(site ? { site } : {}),
        frequency: "once",
        schedule: "now",
        stagedInstructions: `${displayName} 실행 전 환자 상태와 처치 부위를 확인`,
      },
      fieldPolicies: schemaPolicies("treatment", {
        method: "derived_from_profile",
        site: site ? "derived_from_profile" : "required_manual",
        // Amount is intentionally never guessed from the service name.
        administeredAmount: "required_manual",
        frequency: "preset_fixed",
        schedule: "preset_fixed",
        stagedInstructions: "derived_from_profile",
        exceptions: "not_applicable",
      }),
    };
  }

  if (clinicalOrderType === "hospitalization") {
    const hospitalization = resolveHospitalizationProfile(displayName);
    return {
      defaultDetailInputs: {
        durationDays: hospitalization.durationDays,
        careLevel: hospitalization.careLevel,
        monitoringInterval: hospitalization.monitoringInterval,
        nursingPlan: `${displayName} 수행 전 환자 상태와 인계 지시를 확인`,
      },
      fieldPolicies: schemaPolicies("hospitalization", {
        durationDays: "derived_from_profile",
        wardOrCage: "workspace_resolved",
        careLevel: "derived_from_profile",
        monitoringInterval: "derived_from_profile",
        nursingPlan: "derived_from_profile",
        dietPlan: "required_manual",
        isolationPlan:
          hospitalization.careLevel === "isolation"
            ? "required_manual"
            : "not_applicable",
      }),
    };
  }

  if (clinicalOrderType === "other") {
    const supply = pathKey === "cm.path.dispensing-billing";
    const prefix = supply ? "조제 수납·소모품 처리" : displayName;
    return {
      defaultDetailInputs: {
        structuredValue: prefix,
        description: supply
          ? "청구용 소모품 또는 포장 처리"
          : `${displayName} 실행`,
      },
      fieldPolicies: schemaPolicies("other", {
        structuredValue: "derived_from_profile",
        description: "derived_from_profile",
        attachments: "not_applicable",
        exceptions: "not_applicable",
      }),
    };
  }

  throw new Error(`generic_profile_not_implemented:${clinicalOrderType}`);
}

function baseEntry({
  masterKey,
  orderRevision,
  sourceReleaseKey,
  sourceReleaseId,
  sourceFingerprintValue,
  sourceRecordFingerprint,
  sourceType,
  sourceNotes,
  displayName,
  profile,
  defaults,
  species,
}) {
  const presetKey = `preset:execution:${masterKey}`;
  const content = {
    presetId: uuidV5(presetKey),
    masterKey,
    expectedOrderRevisionPolicy: {
      kind: "source_current_revision",
      expectedRevision: orderRevision,
      sourceRevisionRequired: true,
    },
    presetKey,
    presetRevision: 1,
    clinicalOrderType: profile.clinicalOrderType,
    destinationModule: profile.destinationModule,
    executionMode: profile.executionMode,
    detailSchemaVersion: 1,
    defaultDetailInputs: defaults.defaultDetailInputs,
    fieldPolicies: defaults.fieldPolicies,
    provenance: commonProvenance({
      sourceReleaseKey,
      sourceReleaseId,
      sourceFingerprintValue,
      sourceRecordFingerprint,
      profileKey: defaults.profileKey ?? profile.profileKey,
      sourceType,
      sourceNotes,
      evidenceCategory: profile.category,
      species,
    }),
    presetStatus: "synthetic_unreviewed",
    syntheticUnreviewed: true,
    clinicalUseAllowed: false,
  };
  return {
    ...content,
    displayName,
  };
}

function dispensingEntry({
  sourceRecord,
  preset,
  orderRevision,
  sourceReleaseKey,
  sourceReleaseId,
  sourceFingerprintValue,
  sourceRecordFingerprint,
}) {
  assert(
    preset.orderMasterKey === sourceRecord.masterKey,
    `dispensing_key_mismatch:${sourceRecord.masterKey}`,
  );
  assert(
    typeof preset.presetId === "string" && preset.presetId.length === 36,
    `dispensing_preset_id_missing:${sourceRecord.masterKey}`,
  );
  assert(
    typeof preset.presetKey === "string" && preset.presetKey.length > 0,
    `dispensing_preset_key_missing:${sourceRecord.masterKey}`,
  );
  assert(
    preset.presetRevision === 1,
    `dispensing_source_revision:${sourceRecord.masterKey}`,
  );
  assert(
    preset.detailSchemaVersion === 1,
    `dispensing_schema_version:${sourceRecord.masterKey}`,
  );
  assert(
    preset.clinicalUseAllowed === false,
    `dispensing_clinical_gate:${sourceRecord.masterKey}`,
  );
  assert(
    isRecord(preset.detailInputs),
    `dispensing_detail_inputs_missing:${sourceRecord.masterKey}`,
  );
  const policies = schemaPolicies("dispensing", {
    doseBasis: "preset_fixed",
    dose: "preset_fixed",
    doseUnit: "preset_fixed",
    route: "preset_fixed",
    frequency: "preset_fixed",
    durationDays: "preset_fixed",
    totalQuantity: "preset_fixed",
    totalQuantityUnit: "preset_fixed",
    medicationInstruction: "preset_fixed",
    storageMethod: "preset_fixed",
    taperSchedule: "required_manual",
    compoundNote: "preset_fixed",
    guardianNote: "preset_fixed",
    extraLabelSpeciesConfirmed: "preset_fixed",
    extraLabelSpeciesReason: "required_manual",
  });
  const content = {
    // PR-019 is the existing foundation identity.  PR-022 appends a new
    // projection revision instead of minting a second identity for the same
    // order, so this UUID is deliberately copied verbatim from the source.
    presetId: preset.presetId,
    masterKey: sourceRecord.masterKey,
    expectedOrderRevisionPolicy: {
      kind: "source_current_revision",
      expectedRevision: orderRevision,
      sourceRevisionRequired: true,
    },
    presetKey: preset.presetKey,
    presetRevision: 2,
    clinicalOrderType: "dispensing",
    destinationModule: "dispensing",
    executionMode: "routed",
    detailSchemaVersion: 1,
    defaultDetailInputs: deepClone(preset.detailInputs),
    fieldPolicies: policies,
    provenance: {
      sourceReleaseKey,
      sourceReleaseId,
      sourceFingerprint: sourceFingerprintValue,
      sourceRecordFingerprint,
      sourcePresetArtifactSha256:
        "f522d39ed024849549987be5768b3be7b89f0e308d4658593e2cc266cffc90ae",
      sourcePresetId: preset.presetId,
      sourcePresetKey: preset.presetKey,
      sourcePresetRevision: preset.presetRevision,
      sourcePresetContentSha256: preset.contentSha256,
      sourceType: "official-plus-synthetic-service-review",
      generatorProfileKey: "dispensing.pr19-exact.v1",
      sourceNotes:
        "PR-017 release payload and PR-019 preset artifact reused without changing detailInputs.",
      ...evidenceForCategory("dispensing"),
      clinicalUseNotice:
        "Synthetic transport preset; veterinarian review is required before clinical use.",
    },
    presetStatus: "synthetic_unreviewed",
    syntheticUnreviewed: true,
    clinicalUseAllowed: false,
  };
  return {
    ...content,
    displayName: preferredName(sourceRecord),
  };
}

function supplementEntry({
  sourceRecord,
  supplement,
  sourceFingerprintValue,
  sourceRecordFingerprint,
}) {
  assert(
    sourceRecord.masterKey === supplement.masterKey,
    `supplement_key_mismatch:${sourceRecord.masterKey}`,
  );
  const pathProfile = profileForPath(supplement.classificationPathKey);
  const defaults = genericDefaults({
    clinicalOrderType: pathProfile.clinicalOrderType,
    displayName: supplement.name,
    masterKey: supplement.masterKey,
    pathKey: supplement.classificationPathKey,
  });
  return baseEntry({
    masterKey: supplement.masterKey,
    orderRevision: supplement.currentRevision,
    sourceReleaseKey: null,
    sourceReleaseId: supplement.currentReleaseId,
    sourceFingerprintValue,
    sourceRecordFingerprint,
    sourceType: "frozen-live-supplement",
    sourceNotes: `Explicit frozen supplement from Supabase release no. ${supplement.releaseNo}; no UUID was generated by this artifact.`,
    displayName: supplement.name,
    profile: pathProfile,
    defaults,
  });
}

function validateSourceShape({ v4, payload, presets, supplement }) {
  assert(
    v4?.schemaVersion === "clinical-master-airtable-authoring/v1",
    "v4_schema_drift",
  );
  assert(
    v4?.release?.releaseKey === "cm.release.airtable.operational-master.v4",
    "v4_release_key_drift",
  );
  const v4Orders =
    v4.records?.filter((record) => record.recordType === "order") ?? [];
  const payloadOrders =
    payload.genericReleasePayload?.records?.filter(
      (record) => record.recordType === "order",
    ) ?? [];
  assert(
    v4Orders.length === EXPECTED_V4_ORDER_COUNT,
    `v4_order_count:${v4Orders.length}`,
  );
  assert(
    payloadOrders.length === EXPECTED_DISPENSING_ORDER_COUNT,
    `dispensing_order_count:${payloadOrders.length}`,
  );
  assert(
    payload.recordCount === EXPECTED_DISPENSING_ORDER_COUNT,
    "dispensing_payload_record_count_drift",
  );
  assert(
    payload.genericReleasePayload?.releaseKey ===
      "cm.release.dispensing.v1.2026-08-26.1",
    "dispensing_release_key_drift",
  );
  assert(Array.isArray(presets.entries), "dispensing_preset_entries_missing");
  assert(
    presets.entries.length === EXPECTED_DISPENSING_ORDER_COUNT,
    `dispensing_preset_count:${presets.entries.length}`,
  );
  assert(
    presets.entriesSha256 ===
      "f522d39ed024849549987be5768b3be7b89f0e308d4658593e2cc266cffc90ae",
    "dispensing_preset_artifact_drift",
  );
  assert(
    createHash("sha256").update(JSON.stringify(presets.entries)).digest("hex") ===
      presets.entriesSha256,
    "dispensing_preset_entries_hash_invalid",
  );
  for (const preset of presets.entries) {
    assert(
      typeof preset.presetId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          preset.presetId,
        ),
      `dispensing_preset_id_drift:${preset.orderMasterKey}`,
    );
    assert(
      typeof preset.presetKey === "string" && preset.presetKey.length > 0,
      `dispensing_preset_key_drift:${preset.orderMasterKey}`,
    );
    assert(
      preset.presetRevision === 1,
      `dispensing_preset_revision_drift:${preset.orderMasterKey}`,
    );
  }
  assert(supplement?.schemaVersion === 1, "supplement_schema_drift");
  assert(Array.isArray(supplement.records), "supplement_records_missing");
  assert(
    supplement.records.length === EXPECTED_SUPPLEMENT_ORDER_COUNT,
    `supplement_order_count:${supplement.records.length}`,
  );
  const expectedV4OrderKeys = [
    "masterKey",
    "recordType",
    "authoringStatus",
    "lifecycleStatus",
    "safetyStatus",
    "safetyReason",
    "changeSummary",
    "sourceAssertionScope",
    "sourceNotes",
    "sourceKey",
    "names",
    "detail",
  ];
  const expectedOrderDetailKeys = [
    "classificationPathKey",
    "defaultSalesUnitCode",
    "defaultBillingReflectionEnabled",
    "defaultQuantity",
    "species",
  ];
  for (const record of v4Orders) {
    assert(
      canonicalize(Object.keys(record).sort()) ===
        canonicalize([...expectedV4OrderKeys].sort()),
      `v4_order_shape_drift:${record.masterKey}`,
    );
    assert(
      record.recordType === "order",
      `v4_record_type_drift:${record.masterKey}`,
    );
    assert(
      canonicalize(Object.keys(record.detail ?? {}).sort()) ===
        canonicalize([...expectedOrderDetailKeys].sort()),
      `v4_order_detail_shape_drift:${record.masterKey}`,
    );
  }
  const expectedPayloadOrderKeys = [
    "masterKey",
    "recordType",
    "lifecycleStatus",
    "safetyStatus",
    "safetyReason",
    "names",
    "source",
    "detail",
  ];
  for (const record of payloadOrders) {
    assert(
      canonicalize(Object.keys(record).sort()) ===
        canonicalize([...expectedPayloadOrderKeys].sort()),
      `dispensing_order_shape_drift:${record.masterKey}`,
    );
    assert(
      record.recordType === "order",
      `dispensing_record_type_drift:${record.masterKey}`,
    );
    assert(
      canonicalize(Object.keys(record.detail ?? {}).sort()) ===
        canonicalize([...expectedOrderDetailKeys].sort()),
      `dispensing_order_detail_shape_drift:${record.masterKey}`,
    );
  }
  for (const record of supplement.records) {
    assert(
      canonicalize(Object.keys(record).sort()) ===
        canonicalize(
          [
            "masterKey",
            "masterRecordId",
            "currentRevision",
            "classificationPathKey",
            "currentReleaseId",
            "releaseNo",
            "name",
          ].sort(),
        ),
      `supplement_shape_drift:${record.masterKey}`,
    );
    for (const key of [
      "masterKey",
      "masterRecordId",
      "currentRevision",
      "classificationPathKey",
      "currentReleaseId",
      "releaseNo",
      "name",
    ]) {
      assert(
        record[key] !== undefined && record[key] !== null && record[key] !== "",
        `supplement_field_missing:${key}`,
      );
    }
    assert(
      Number.isInteger(record.currentRevision) && record.currentRevision > 0,
      `supplement_revision_invalid:${record.masterKey}`,
    );
  }
  return { v4Orders, payloadOrders };
}

function validateDuplicateKeys(records) {
  const counts = new Map();
  for (const record of records)
    counts.set(record.masterKey, (counts.get(record.masterKey) ?? 0) + 1);
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  assert(
    duplicates.length === 0,
    `duplicate_master_keys:${duplicates.join(",")}`,
  );
}

function validateInputLineage(
  lineage,
  { expectedHash = EXPECTED_INPUT_LINEAGE_SHA256 } = {},
) {
  assert(
    Array.isArray(lineage) && lineage.length === EXPECTED_ORDER_COUNT,
    "input_lineage_count_invalid",
  );
  validateDuplicateKeys(lineage);
  for (const record of lineage) {
    assert(
      typeof record.masterKey === "string" && record.masterKey.length > 0,
      "input_lineage_master_key_missing",
    );
    assert(
      Number.isInteger(record.currentRevision) && record.currentRevision > 0,
      `input_lineage_revision_invalid:${record.masterKey}`,
    );
    assert(
      isRecord(record.currentReleaseIdentity),
      `input_lineage_release_identity_missing:${record.masterKey}`,
    );
    assert(
      canonicalize(Object.keys(record.currentReleaseIdentity).sort()) ===
        canonicalize(["releaseId", "releaseKey", "releaseNo"]),
      `input_lineage_release_identity_shape:${record.masterKey}`,
    );
    assert(
      record.currentReleaseIdentity.releaseKey !== null ||
        record.currentReleaseIdentity.releaseId !== null ||
        record.currentReleaseIdentity.releaseNo !== null,
      `input_lineage_release_identity_empty:${record.masterKey}`,
    );
  }
  assert(
    inputLineageHash(lineage) === expectedHash,
    "input_lineage_expected_hash_mismatch",
  );
}

function validateEntry(entry, { requireHashes = true } = {}) {
  assert(
    typeof entry.masterKey === "string" && entry.masterKey.length > 0,
    "entry_master_key_missing",
  );
  assert(
    CLINICAL_ORDER_TYPES.includes(entry.clinicalOrderType),
    `entry_type_invalid:${entry.masterKey}`,
  );
  assert(
    entry.detailSchemaVersion === 1,
    `entry_schema_invalid:${entry.masterKey}`,
  );
  assert(
    entry.presetRevision ===
      (entry.provenance?.generatorProfileKey === "dispensing.pr19-exact.v1"
        ? 2
        : 1),
    `entry_preset_revision_invalid:${entry.masterKey}`,
  );
  assert(
    entry.presetStatus === "synthetic_unreviewed",
    `entry_status_invalid:${entry.masterKey}`,
  );
  assert(
    entry.syntheticUnreviewed === true && entry.clinicalUseAllowed === false,
    `synthetic_gate_invalid:${entry.masterKey}`,
  );
  assert(
    isRecord(entry.defaultDetailInputs),
    `default_inputs_not_object:${entry.masterKey}`,
  );
  assert(
    isRecord(entry.fieldPolicies),
    `field_policies_not_object:${entry.masterKey}`,
  );
  const fields = SCHEMA_FIELDS[entry.clinicalOrderType];
  for (const key of Object.keys(entry.defaultDetailInputs)) {
    assert(
      fields.includes(key),
      `default_unknown_schema_key:${entry.masterKey}.${key}`,
    );
    assert(
      FIELD_POLICIES.includes(entry.fieldPolicies[key]),
      `default_policy_missing:${entry.masterKey}.${key}`,
    );
  }
  for (const [key, policy] of Object.entries(entry.fieldPolicies)) {
    assert(
      fields.includes(key),
      `policy_unknown_schema_key:${entry.masterKey}.${key}`,
    );
    assert(
      FIELD_POLICIES.includes(policy),
      `policy_invalid:${entry.masterKey}.${key}`,
    );
  }
  assert(
    entry.provenance?.sourceFingerprint,
    `provenance_fingerprint_missing:${entry.masterKey}`,
  );
  assert(
    Array.isArray(entry.provenance?.evidenceKeys) &&
      entry.provenance.evidenceKeys.length > 0,
    `provenance_evidence_missing:${entry.masterKey}`,
  );
  for (const evidenceKey of entry.provenance.evidenceKeys) {
    assert(
      AUTHORITATIVE_EVIDENCE_REGISTRY.some(
        (evidence) => evidence.evidenceKey === evidenceKey,
      ),
      `provenance_evidence_unknown:${entry.masterKey}.${evidenceKey}`,
    );
  }
  assert(
    Array.isArray(entry.provenance?.unresolvedClinicalAuthority) &&
      entry.provenance.unresolvedClinicalAuthority.length > 0,
    `provenance_unresolved_authority_missing:${entry.masterKey}`,
  );
  assert(
    typeof entry.presetId === "string" && entry.presetId.length === 36,
    `preset_id_missing:${entry.masterKey}`,
  );
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      entry.presetId,
    ),
    `preset_id_shape_invalid:${entry.masterKey}`,
  );
  if (entry.provenance?.generatorProfileKey !== "dispensing.pr19-exact.v1") {
    assert(
      entry.presetId === uuidV5(entry.presetKey),
      `preset_id_not_deterministic:${entry.masterKey}`,
    );
  }
  if (requireHashes) {
    assert(
      typeof entry.sourceArtifactSha256 === "string" &&
        /^[0-9a-f]{64}$/.test(entry.sourceArtifactSha256),
      `source_artifact_hash_missing:${entry.masterKey}`,
    );
    assert(
      typeof entry.sourceEntriesSha256 === "string" &&
        /^[0-9a-f]{64}$/.test(entry.sourceEntriesSha256),
      `source_entries_hash_missing:${entry.masterKey}`,
    );
    assert(
      entry.sourceArtifactSha256 === entry.sourceEntriesSha256,
      `source_artifact_hash_mismatch:${entry.masterKey}`,
    );
    assert(
      entry.contentSha256 ===
        contentHashValue(withoutEntryContentHash(entry)),
      `entry_hash_mismatch:${entry.masterKey}`,
    );
  }
}

function makeProposedSystemExamOrders() {
  return SYSTEM_EXAM_PROPOSALS.map(([slug, label, instruction], index) => {
    const presetKey = `preset:execution:cm.order.system-exam.${slug}`;
    return {
      proposedIdentity: `cm.order.system-exam.${slug}`,
      stableKey: `cm.order.system-exam.${slug}`,
      presetKey,
      presetId: uuidV5(presetKey),
      profileKey: `system_exam.${slug}.v1`,
      proposedClinicalOrderType: "system_exam",
      runtimeClinicalOrderType: "system_exam",
      clinicalOrderType: "system_exam",
      detailSchemaVersion: 1,
      defaultDetailInputs: {
        bodySystem: label,
        examScope: instruction,
        examMethod: "표준 신체검사",
      },
      fieldPolicies: {
        bodySystem: "derived_from_profile",
        examScope: "derived_from_profile",
        examMethod: "preset_fixed",
        findingSummary: "required_manual",
      },
      profile: {
        label,
        instruction,
        sortOrder: index + 1,
        noNormalFindingDefaults: true,
      },
      provenance: {
        sourceType: "proposed-taxonomy-profile",
        sourceNotes:
          "Proposal only. It is excluded from the 510 live-master coverage and does not encode a normal finding.",
        ...evidenceForCategory("consultation"),
      },
      presetRevision: 1,
      presetStatus: "synthetic_unreviewed",
      syntheticUnreviewed: true,
      clinicalUseAllowed: false,
    };
  });
}

function withoutProposalTransportHashes(proposal) {
  const content = { ...proposal };
  delete content.contentSha256;
  delete content.sourceArtifactSha256;
  return content;
}

function finalizeProposedSystemExamOrders(proposals) {
  const sourceEntriesSha256 = hashCanonical(
    proposals.map((proposal) => withoutProposalTransportHashes(proposal)),
  );
  return {
    sourceEntriesSha256,
    proposals: proposals.map((proposal) => {
      const withSourceHash = {
        ...proposal,
        sourceArtifactSha256: sourceEntriesSha256,
      };
      return {
        ...withSourceHash,
        contentSha256: contentHashValue(
          withoutEntryContentHash(withSourceHash),
        ),
      };
    }),
  };
}

function buildArtifact({ v4, payload, presets, supplement }) {
  const { v4Orders, payloadOrders } = validateSourceShape({
    v4,
    payload,
    presets,
    supplement,
  });
  const inputLineage = buildInputLineage({ v4, payload, supplement });
  validateInputLineage(inputLineage);
  assert(
    inputLineageHash(inputLineage) === EXPECTED_INPUT_LINEAGE_SHA256,
    "input_lineage_drift",
  );
  const inputLineageByMasterKey = new Map(
    inputLineage.map((record) => [record.masterKey, record]),
  );
  const supplementRecords = supplement.records;
  const allSourceRecords = [
    ...v4Orders,
    ...payloadOrders,
    ...supplementRecords,
  ];
  validateDuplicateKeys(allSourceRecords);
  assert(
    allSourceRecords.length === EXPECTED_ORDER_COUNT,
    `combined_order_count:${allSourceRecords.length}`,
  );
  assert(
    hashOrderKeys(allSourceRecords) === EXPECTED_STABLE_KEY_SET_SHA256,
    "stable_key_set_drift",
  );

  const v4SourceFingerprint = sourceFingerprint(v4, v4Orders);
  const payloadSourceFingerprint = sourceFingerprint(payload, payloadOrders);
  const presetSourceFingerprint = hashCanonical({
    sourceReleaseId: DISPENSING_SOURCE_RELEASE_ID,
    entries: canonicalizeOrderList(
      presets.entries.map((entry) => ({
        orderMasterKey: entry.orderMasterKey,
        presetKey: entry.presetKey,
        presetRevision: entry.presetRevision,
        detailInputs: entry.detailInputs,
        contentSha256: entry.contentSha256,
      })),
    ),
  });
  const supplementSourceFingerprint = sourceFingerprint(
    supplement,
    supplementRecords,
  );

  const entries = [];
  for (const record of v4Orders) {
    const lineage = inputLineageByMasterKey.get(record.masterKey);
    assert(lineage, `input_lineage_missing:${record.masterKey}`);
    const pathKey = record.detail?.classificationPathKey;
    const profile = profileForPath(pathKey);
    const displayName = preferredName(record);
    const defaults = genericDefaults({
      clinicalOrderType: profile.clinicalOrderType,
      displayName,
      masterKey: record.masterKey,
      pathKey,
    });
    entries.push(
      baseEntry({
        masterKey: record.masterKey,
        orderRevision: lineage.currentRevision,
        sourceReleaseKey: lineage.currentReleaseIdentity.releaseKey,
        sourceReleaseId: lineage.currentReleaseIdentity.releaseId,
        sourceFingerprintValue: v4SourceFingerprint,
        sourceRecordFingerprint: hashCanonical(record),
        sourceType: "synthetic-operational-v4",
        sourceNotes: "Synthetic operational master v4; no clinical authority.",
        displayName,
        profile,
        defaults,
        species: record.detail?.species,
      }),
    );
  }

  const payloadPresetByKey = new Map(
    presets.entries.map((entry) => [entry.orderMasterKey, entry]),
  );
  for (const record of payloadOrders) {
    const lineage = inputLineageByMasterKey.get(record.masterKey);
    assert(lineage, `input_lineage_missing:${record.masterKey}`);
    const preset = payloadPresetByKey.get(record.masterKey);
    assert(preset, `dispensing_preset_missing:${record.masterKey}`);
    entries.push(
      dispensingEntry({
        sourceRecord: record,
        preset,
        orderRevision: lineage.currentRevision,
        sourceReleaseKey: lineage.currentReleaseIdentity.releaseKey,
        sourceReleaseId: lineage.currentReleaseIdentity.releaseId,
        sourceFingerprintValue: payloadSourceFingerprint,
        sourceRecordFingerprint: hashCanonical({
          payloadRecord: record,
          preset: {
            detailInputs: preset.detailInputs,
            contentSha256: preset.contentSha256,
          },
        }),
      }),
    );
  }

  for (const record of supplementRecords) {
    entries.push(
      supplementEntry({
        sourceRecord: record,
        supplement: record,
        sourceFingerprintValue: supplementSourceFingerprint,
        sourceRecordFingerprint: hashCanonical(record),
      }),
    );
  }

  entries.sort((left, right) => left.masterKey.localeCompare(right.masterKey));
  for (const entry of entries) validateEntry(entry, { requireHashes: false });
  assert(
    entries.length === EXPECTED_ORDER_COUNT,
    "entry_count_after_generation",
  );

  const categoryCounts = {};
  const clinicalOrderTypeCounts = {};
  for (const entry of entries) {
    clinicalOrderTypeCounts[entry.clinicalOrderType] =
      (clinicalOrderTypeCounts[entry.clinicalOrderType] ?? 0) + 1;
    const sourceRecord = allSourceRecords.find(
      (record) => record.masterKey === entry.masterKey,
    );
    const pathKey =
      sourceRecord.detail?.classificationPathKey ??
      sourceRecord.classificationPathKey;
    const category = profileForPath(pathKey).category;
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  }
  const proposedSystemExam = finalizeProposedSystemExamOrders(
    makeProposedSystemExamOrders(),
  );
  const artifactWithoutHash = {
    schemaVersion: "clinical-master-order-execution-presets/v1",
    artifactRevision: 1,
    expectedOrderCount: EXPECTED_ORDER_COUNT,
    expectedStableKeySetSha256: EXPECTED_STABLE_KEY_SET_SHA256,
    expectedLiveIdentityRevisionSha256: EXPECTED_LIVE_IDENTITY_REVISION_SHA256,
    expectedInputLineageSha256: EXPECTED_INPUT_LINEAGE_SHA256,
    inputLineageSha256: inputLineageHash(inputLineage),
    inputLineage,
    inputLineageHashPolicy: {
      algorithm: "sha256",
      encoding: "utf8",
      canonicalization:
        "compact canonical JSON; object keys sorted lexicographically",
      sortOrder: "masterKey ascending by UTF-8 byte order",
      projectionFields: [
        "masterKey",
        "currentRevision",
        "currentReleaseIdentity",
      ],
      currentReleaseIdentityFields: ["releaseKey", "releaseId", "releaseNo"],
    },
    lineagePolicy: {
      sourceKind: "frozen_local_inputs",
      currentLineageSemantics:
        "Strongest exact order revision and release identity represented by the V4, PR-017/PR-019, and explicit frozen supplement inputs; this is not a remote current-state assertion.",
      currentRevisionSource:
        "V4 and PR-017 rows are represented at source revision 1; frozen supplement rows copy currentRevision exactly.",
      currentReleaseIdentitySource:
        "releaseKey/releaseId/releaseNo are copied when present in the frozen input; null means that component is not represented by the input.",
      remoteCurrentAssertion: false,
      externalPublishRequiresLiveCas: true,
      externalPublishLiveCasFields: [
        "masterKey",
        "currentRevision",
        "currentReleaseIdentity",
      ],
      externalPublishLiveCasNote:
        "Before external publish, re-read the live master row and compare all lineage fields; this transport artifact does not claim remote current state.",
    },
    clinicalOrderTypes: [...CLINICAL_ORDER_TYPES],
    fieldPolicies: [...FIELD_POLICIES],
    sourceReleases: [
      {
        sourceReleaseKey: v4.release.releaseKey,
        sourceFingerprint: v4SourceFingerprint,
        recordCount: v4Orders.length,
        expectedOrderRevisionPolicy:
          "source_current_revision; v4 fixture rows are expected at revision 1",
      },
      {
        sourceReleaseKey: payload.genericReleasePayload.releaseKey,
        sourceReleaseId: DISPENSING_SOURCE_RELEASE_ID,
        sourceFingerprint: payloadSourceFingerprint,
        presetArtifactFingerprint: presetSourceFingerprint,
        recordCount: payloadOrders.length,
        expectedOrderRevisionPolicy:
          "source_current_revision; PR-017 payload rows are expected at revision 1",
      },
      {
        sourceReleaseKey: null,
        sourceReleaseId: "explicit-frozen-supplement",
        sourceFingerprint: supplementSourceFingerprint,
        recordCount: supplementRecords.length,
      expectedOrderRevisionPolicy:
        "explicit currentRevision from the frozen supplement",
      },
    ],
    categoryCounts,
    clinicalOrderTypeCounts,
    evidenceRegistry: deepClone(AUTHORITATIVE_EVIDENCE_REGISTRY),
    sourceArtifactHashPolicy: {
      algorithm: "sha256",
      entrySourceArtifactField: "sourceArtifactSha256",
      sourceEntriesField: "sourceEntriesSha256",
      cycleFreePreimage:
        "entries sorted by masterKey with contentSha256, sourceEntriesSha256, sourceArtifactSha256, and displayName excluded",
      proposedEntrySourceArtifactField: "sourceArtifactSha256",
      proposedSourceEntriesField: "proposedSystemExamOrdersSourceEntriesSha256",
      proposedCycleFreePreimage:
        "proposedSystemExamOrders in stable order with contentSha256 and sourceArtifactSha256 excluded",
    },
    contentHashPolicy: {
      algorithm: "sha256",
      encoding: "utf8",
      serializer:
        "PostgreSQL jsonb::text-compatible canonical JSON (object keys ordered by UTF-8 byte length, then bytewise; PostgreSQL spacing)",
      subsetFields: [...CONTENT_HASH_FIELDS],
      excludedTransportFields: [
        "masterKey",
        "expectedOrderRevisionPolicy",
        "destinationModule",
        "executionMode",
        "syntheticUnreviewed",
        "contentSha256",
        "sourceEntriesSha256",
        "displayName",
      ],
    },
    proposedSystemExamOrdersSourceEntriesSha256:
      proposedSystemExam.sourceEntriesSha256,
    proposedSystemExamOrders: proposedSystemExam.proposals,
    entries,
  };
  const sourceEntriesSha256 = hashCanonical(
    entries.map((entry) => withoutEntryTransportHashes(entry)),
  );
  const entriesWithSourceHash = entries.map((entry) => {
    const withSourceHash = {
      ...entry,
      sourceArtifactSha256: sourceEntriesSha256,
      sourceEntriesSha256,
    };
    return {
      ...withSourceHash,
      contentSha256: contentHashValue(withoutEntryContentHash(withSourceHash)),
    };
  });
  artifactWithoutHash.sourceEntriesSha256 = sourceEntriesSha256;
  artifactWithoutHash.entries = entriesWithSourceHash;
  return {
    ...artifactWithoutHash,
    artifactSha256: hashCanonical(artifactWithoutHash),
  };
}

export function validateArtifact(artifact, { expectedInputLineage = null } = {}) {
  assert(
    artifact?.schemaVersion === "clinical-master-order-execution-presets/v1",
    "artifact_schema_invalid",
  );
  assert(artifact.artifactRevision === 1, "artifact_revision_invalid");
  assert(
    artifact.expectedOrderCount === EXPECTED_ORDER_COUNT,
    "artifact_expected_order_count_invalid",
  );
  assert(
    Array.isArray(artifact.entries) &&
      artifact.entries.length === EXPECTED_ORDER_COUNT,
    "artifact_entry_count_invalid",
  );
  assert(
    artifact.expectedInputLineageSha256 === EXPECTED_INPUT_LINEAGE_SHA256,
    "artifact_input_lineage_expected_hash_invalid",
  );
  assert(
    artifact.inputLineageSha256 === EXPECTED_INPUT_LINEAGE_SHA256,
    "artifact_input_lineage_hash_field_invalid",
  );
  validateInputLineage(artifact.inputLineage);
  assert(
    artifact.inputLineageSha256 === inputLineageHash(artifact.inputLineage),
    "artifact_input_lineage_hash_invalid",
  );
  assert(
    artifact.lineagePolicy?.sourceKind === "frozen_local_inputs" &&
      artifact.lineagePolicy.remoteCurrentAssertion === false &&
      artifact.lineagePolicy.externalPublishRequiresLiveCas === true &&
      canonicalize(artifact.lineagePolicy.externalPublishLiveCasFields) ===
        canonicalize([
          "masterKey",
          "currentRevision",
          "currentReleaseIdentity",
        ]),
    "artifact_lineage_policy_invalid",
  );
  if (expectedInputLineage) {
    assert(
      canonicalize(artifact.inputLineage) === canonicalize(expectedInputLineage),
      "artifact_input_lineage_source_mismatch",
    );
  }
  validateDuplicateKeys(artifact.entries);
  const inputLineageByMasterKey = new Map(
    artifact.inputLineage.map((record) => [record.masterKey, record]),
  );
  for (const entry of artifact.entries) {
    validateEntry(entry);
    const lineage = inputLineageByMasterKey.get(entry.masterKey);
    assert(lineage, `artifact_input_lineage_missing:${entry.masterKey}`);
    assert(
      entry.expectedOrderRevisionPolicy?.expectedRevision ===
        lineage.currentRevision,
      `artifact_input_lineage_revision_mismatch:${entry.masterKey}`,
    );
    assert(
      entry.provenance?.sourceReleaseKey ===
        lineage.currentReleaseIdentity.releaseKey,
      `artifact_input_lineage_release_key_mismatch:${entry.masterKey}`,
    );
    assert(
      entry.provenance?.sourceReleaseId ===
        lineage.currentReleaseIdentity.releaseId,
      `artifact_input_lineage_release_id_mismatch:${entry.masterKey}`,
    );
  }
  assert(
    typeof artifact.sourceEntriesSha256 === "string",
    "artifact_source_entries_hash_missing",
  );
  assert(
    artifact.entries.every(
      (entry) => entry.sourceEntriesSha256 === artifact.sourceEntriesSha256,
    ),
    "artifact_source_entries_hash_mismatch",
  );
  assert(
    artifact.sourceEntriesSha256 ===
      hashCanonical(
        artifact.entries.map((entry) => withoutEntryTransportHashes(entry)),
      ),
    "artifact_source_entries_hash_invalid",
  );
  assert(
    Array.isArray(artifact.evidenceRegistry) &&
      artifact.evidenceRegistry.length === AUTHORITATIVE_EVIDENCE_REGISTRY.length,
    "artifact_evidence_registry_invalid",
  );
  assert(
    canonicalize(artifact.evidenceRegistry) ===
      canonicalize(AUTHORITATIVE_EVIDENCE_REGISTRY),
    "artifact_evidence_registry_drift",
  );
  assert(
    Array.isArray(artifact.proposedSystemExamOrders) &&
      artifact.proposedSystemExamOrders.length === 12,
    "system_exam_proposal_count_invalid",
  );
  assert(
    typeof artifact.proposedSystemExamOrdersSourceEntriesSha256 === "string" &&
      artifact.proposedSystemExamOrdersSourceEntriesSha256 ===
        hashCanonical(
          artifact.proposedSystemExamOrders.map(
            (proposal) => withoutProposalTransportHashes(proposal),
          ),
        ),
    "system_exam_proposal_source_hash_invalid",
  );
  assert(
    artifact.contentHashPolicy?.subsetFields?.join(",") ===
      CONTENT_HASH_FIELDS.join(","),
    "artifact_content_hash_policy_drift",
  );
  assert(
    artifact.proposedSystemExamOrders.every((proposal) => {
      assert(
        proposal.presetId === uuidV5(proposal.presetKey),
        `proposal_preset_id_not_deterministic:${proposal.stableKey}`,
      );
      assert(
        proposal.profile.noNormalFindingDefaults === true,
        `system_exam_normal_finding_default:${proposal.stableKey}`,
      );
      assert(
        Array.isArray(proposal.provenance?.evidenceKeys) &&
          proposal.provenance.evidenceKeys.every((evidenceKey) =>
            AUTHORITATIVE_EVIDENCE_REGISTRY.some(
              (evidence) => evidence.evidenceKey === evidenceKey,
            ),
          ),
        `system_exam_provenance_evidence:${proposal.stableKey}`,
      );
      assert(
        Array.isArray(proposal.provenance?.unresolvedClinicalAuthority) &&
          proposal.provenance.unresolvedClinicalAuthority.length > 0,
        `system_exam_provenance_unresolved:${proposal.stableKey}`,
      );
      assert(
        proposal.runtimeClinicalOrderType === "system_exam",
        `system_exam_runtime_type:${proposal.stableKey}`,
      );
      assert(
        proposal.clinicalOrderType === "system_exam",
        `system_exam_clinical_type:${proposal.stableKey}`,
      );
      assert(
        proposal.presetRevision === 1,
        `system_exam_preset_revision:${proposal.stableKey}`,
      );
      assert(
        proposal.presetStatus === "synthetic_unreviewed",
        `system_exam_preset_status:${proposal.stableKey}`,
      );
      assert(
        proposal.syntheticUnreviewed === true &&
          proposal.clinicalUseAllowed === false,
        `system_exam_synthetic_gate:${proposal.stableKey}`,
      );
      assert(
        typeof proposal.sourceArtifactSha256 === "string" &&
          proposal.sourceArtifactSha256 ===
            artifact.proposedSystemExamOrdersSourceEntriesSha256,
        `system_exam_source_artifact_hash:${proposal.stableKey}`,
      );
      assert(
        proposal.contentSha256 ===
          contentHashValue(withoutEntryContentHash(proposal)),
        `system_exam_content_hash:${proposal.stableKey}`,
      );
      assert(
        canonicalize(Object.keys(proposal.defaultDetailInputs).sort()) ===
          canonicalize(["bodySystem", "examScope", "examMethod"].sort()),
        `system_exam_default_shape:${proposal.stableKey}`,
      );
      assert(
        proposal.fieldPolicies.findingSummary === "required_manual",
        `system_exam_finding_policy:${proposal.stableKey}`,
      );
      return true;
    }),
    "system_exam_proposal_invalid",
  );
  const withoutHash = { ...artifact };
  delete withoutHash.artifactSha256;
  assert(
    artifact.artifactSha256 === hashCanonical(withoutHash),
    "artifact_hash_mismatch",
  );
  return true;
}

export async function loadInputs({ supplementPath = null } = {}) {
  const [v4, payload, presets] = await Promise.all([
    readJson(resolveInputPath(null, SOURCE_PATHS.v4)),
    readJson(resolveInputPath(null, SOURCE_PATHS.dispensingPayload)),
    readJson(resolveInputPath(null, SOURCE_PATHS.dispensingPresets)),
  ]);
  const selectedSupplementPath = supplementPath
    ? resolveInputPath(supplementPath, SOURCE_PATHS.supplement)
    : resolveInputPath(null, SOURCE_PATHS.supplement);
  let supplement;
  try {
    supplement = await readJson(selectedSupplementPath);
  } catch {
    throw new Error(`frozen_supplement_required:${selectedSupplementPath}`);
  }
  return { v4, payload, presets, supplement };
}

export async function generateArtifact(options = {}) {
  const inputs =
    options.inputs ??
    (await loadInputs({ supplementPath: options.supplementPath }));
  const artifact = buildArtifact(inputs);
  validateArtifact(artifact, {
    expectedInputLineage: buildInputLineage(inputs),
  });
  return artifact;
}

function parseArgs(argv) {
  const args = new Set(argv);
  const option = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? null : argv[index + 1];
  };
  return {
    check: args.has("--check"),
    write: args.has("--write"),
    output: option("--output") ?? SOURCE_PATHS.output,
    supplementPath: option("--supplement"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assert(options.check || options.write, "usage: --check or --write");
  const artifact = await generateArtifact({
    supplementPath: options.supplementPath,
  });
  const outputPath = resolveInputPath(options.output, SOURCE_PATHS.output);
  if (options.write) {
    await writeFile(
      outputPath,
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(`wrote ${outputPath}\n`);
    return;
  }
  let existing;
  try {
    existing = await readJson(outputPath);
  } catch {
    throw new Error(`artifact_missing:${outputPath}`);
  }
  validateArtifact(existing, { expectedInputLineage: artifact.inputLineage });
  assert(canonicalize(existing) === canonicalize(artifact), "artifact_drift");
  process.stdout.write(
    `checked ${outputPath} (${artifact.entries.length} entries)\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
