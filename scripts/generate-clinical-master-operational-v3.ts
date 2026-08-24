#!/usr/bin/env node

/**
 * Build the deterministic Phase A operational authoring package.
 *
 * This generator is intentionally local-only.  It reads the already-reviewed
 * publisher fixture, adds synthetic operational rows, and emits authoring,
 * adapter, pricing/adoption, and manifest fixtures.  It never contacts
 * Airtable or Supabase and has no price fields in the publisher payload.
 *
 * Usage (Node 23+):
 *   node --experimental-strip-types scripts/generate-clinical-master-operational-v3.ts
 *   node --experimental-strip-types scripts/generate-clinical-master-operational-v3.ts --check
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

// Node's strip-types loader resolves this explicit TypeScript entrypoint.
// @ts-expect-error -- intentional Node strip-types CLI import.
import { adaptClinicalMasterAirtableAuthoringExport } from "../src/features/clinical-master/server-clinical-master-airtable-publish-adapter.ts";

type JsonObject = Record<string, unknown>;
type JsonRecord = JsonObject & {
  masterKey: string;
  recordType: string;
  names: JsonObject[];
  detail: JsonObject;
};
type AuthoringFixture = JsonObject & {
  schemaVersion: string;
  release: JsonObject;
  sources: JsonObject[];
  records: JsonRecord[];
  classificationPaths: JsonObject[];
  labPanelItems: JsonObject[];
  labOrderProfiles: JsonObject[];
  diagnosisCategoryLinks: JsonObject[];
};
type AirtableReadbackTable = {
  tableId: string;
  primaryFieldId: string;
  primaryFieldName: string;
  fieldIdsByName: Record<string, string>;
  recordCount: number;
  records: Array<{ airtableRecordId: string; createdTime?: string; fields: Record<string, unknown> }>;
};
type AirtableReadback = {
  schemaVersion: string;
  readAt: string;
  baseId: string;
  baselineSha256: string;
  mutationScope: string;
  tableCounts: Record<string, number>;
  sourceIdentity: JsonObject;
  tables: Record<string, AirtableReadbackTable>;
};
type OrderWorkspaceRow = {
  masterKey: string;
  researchCategory: string;
  classificationPathKey: string;
  itemType: string;
  masterRouteCode: string;
  heldSourceRouteCode?: string;
  workspaceDestinationModule: string;
  categoryPriceBase: number;
  categoryPriceSerial: number;
  syntheticWorkspacePriceKrw: number;
  salesUnit: "case";
};

const ROOT = resolve(process.cwd());
const BASE_FIXTURE_PATH = resolve(ROOT, "tests/fixtures/clinical-master-publisher-full-type-hotfix.fixture.json");
const AUTHORING_PATH = resolve(ROOT, "tests/fixtures/clinical-master-operational-v3-authoring.json");
const ADAPTER_PATH = resolve(ROOT, "tests/fixtures/clinical-master-operational-v3-adapter-output.json");
const PRICING_PATH = resolve(ROOT, "tests/fixtures/clinical-master-operational-v3-pricing-adoption.json");
const LAB_SEMANTICS_PATH = resolve(ROOT, "tests/fixtures/clinical-master-operational-v3-lab-semantics.json");
const READBACK_PATH = resolve(ROOT, "tests/fixtures/clinical-master-airtable-operational-v3-current-readback.json");
const MANIFEST_PATH = resolve(ROOT, "tests/fixtures/clinical-master-operational-v3-airtable-write-manifest.json");
const FINAL_READBACK_PATH = resolve(ROOT, "tests/fixtures/clinical-master-airtable-operational-v3-final-readback.json");
const DELTA_MANIFEST_PATH = resolve(ROOT, "tests/fixtures/clinical-master-operational-v3-airtable-delta-manifest.json");

const RELEASE_KEY = "cm.release.airtable.operational-master.v3";
const LEGACY_INITIAL_MASTER_KEY = "cm.order.consult.initial";
const V3_INITIAL_MASTER_KEY = "cm.order.consult.first-visit";
const AIRTABLE_INITIAL_KEY_MIGRATION = {
  airtableRecordId: "recZW92s9i06wpNp0",
  currentMasterKey: LEGACY_INITIAL_MASTER_KEY,
  newMasterKey: V3_INITIAL_MASTER_KEY,
  linkedNameRecordId: "rec0Pw4CymPIed8ta",
} as const;
// Preserve the one live synthetic Sources primary key.  v3 is a release
// revision, not a source-registry identity migration.
const SOURCE_KEY = "source.synthetic.operational-pilot.v1";
const SOURCE = {
  sourceType: "synthetic",
  title: "CLAiR operational pilot fixture",
  referenceUri: null,
  sourceVersion: "v1",
  accessedAt: "2026-08-23",
  licenseNotes: "Synthetic structural data; not for clinical use.",
};
const AUTHORING_FIELDS = {
  authoringStatus: "approved",
  lifecycleStatus: "published",
  safetyStatus: "normal",
  safetyReason: null,
  changeSummary: "synthetic operational pilot v1",
  sourceAssertionScope: "synthetic system-flow testing only; no clinical authority",
  sourceNotes: "no external clinical source",
  sourceKey: SOURCE_KEY,
};
const ADDITION_AUTHORING_FIELDS = {
  ...AUTHORING_FIELDS,
  changeSummary: "synthetic operational master v3 addition",
  sourceNotes: "synthetic v3 additive operational draft; no external clinical source",
};
const KNOWN_CENTRAL_BASELINE_KEYS = new Set([
  "phase1a2.fallback.chart.CG_INPATIENT",
  "phase1a2.fallback.route.NT_BILLING_ONLY",
]);

const categoryCounts: Record<string, number> = {
  consultation: 12,
  preventive: 12,
  lab: 30,
  imaging: 12,
  treatment: 18,
  dispensing: 16,
  "surgery/anesthesia": 8,
  inpatient: 6,
  emergency: 3,
  dental: 2,
  "certificate/misc": 1,
};

const priceBases: Record<string, number> = {
  consultation: 28000,
  preventive: 32000,
  lab: 36000,
  imaging: 42000,
  treatment: 48000,
  dispensing: 52000,
  "surgery/anesthesia": 68000,
  inpatient: 76000,
  emergency: 84000,
  dental: 90000,
  "certificate/misc": 96000,
};

// Concrete Korean display labels keep the synthetic package usable as a
// hospital-operations draft while the source boundary remains explicitly
// non-authoritative.  These labels describe services/results only; they do
// not encode dosing, schedules, ranges, or clinical claims.
const syntheticLabPanelNames = [
  "전해질 패널", "응고 패널", "수술 전 검사 패널", "간 검사 패널", "신장 검사 패널", "당대사 패널",
];
const syntheticOrderNames: Record<string, string[]> = {
  consultation: ["야간 진찰", "노령동물 상담", "영양 상담", "행동 상담", "통증 상담", "퇴원 상담", "진료 전 상태평가", "재진 경과 상담", "진료기록 상담", "보호자 교육 상담"],
  preventive: ["종합 예방접종", "광견병 예방접종", "호흡기 예방접종", "고양이 종합 예방접종", "고양이 백혈병 예방접종", "강아지 예방접종 관리", "고양이 예방접종 관리", "내부기생충 예방관리", "외부기생충 예방관리", "노령동물 예방검진"],
  lab: ["전해질 검사", "응고 검사", "수술 전 검사", "간 검사", "신장 검사", "당대사 패널", "혈액형 검사 서비스", "망상적혈구 검사 서비스", "혈액도말 검사 서비스", "피부 세포검사", "귀 분비물 세포검사", "종괴 세포검사", "관절액 세포검사"],
  imaging: ["사지 방사선 검사", "골반 방사선 검사", "척추 방사선 검사", "치과 방사선 검사", "경부 초음파 검사", "근골격 초음파 검사", "안구 초음파 검사", "임신 초음파 검사"],
  treatment: ["정맥 수액 처치", "피하 수액 처치", "산소 처치", "상처 드레싱", "네뷸라이저 처치", "요도 카테터 관리", "안구 세척", "정맥 카테터 관리", "붕대 교체", "항문낭 처치", "레이저 처치", "온·냉 찜질", "급여 튜브 관리", "방광 세척", "피부 준비 처치"],
  dispensing: ["경구액 조제", "안약 조제", "귀약 조제", "분말 조제", "정제 분할 조제", "캡슐 조제", "주사제 조제", "외용액 조제", "연고 조제", "시럽 조제", "1회 포장 조제", "다회 포장 조제", "복약용 주사기", "조제 소모품 포장"],
  "surgery/anesthesia": ["수술 전 준비", "마취 전 준비", "마취 모니터링", "회복실 관리", "소수술 준비", "수술 부위 처치", "수술 후 관찰", "마취 장비 점검"],
  inpatient: ["입원 1일 관리", "집중관찰 관리", "활력징후 기록", "수액펌프 관리", "급여 보조", "야간 입원 관리"],
  emergency: ["응급 초기 평가 서비스", "응급 모니터링 서비스", "응급 처치 준비 서비스"],
  dental: ["치과 검진", "치석 제거 처치"],
  "certificate/misc": ["진료확인서 발급"],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function names(ko: string, _en: string) {
  // The current Airtable authoring contract has one preferred display name per
  // master row.  Keep the English label as generator input for readability,
  // but do not create a second Names row and change the target 254-row table
  // shape.
  void _en;
  return [
    { languageCode: "ko", nameKind: "preferred", name: ko, searchable: true, sortOrder: 0 },
  ];
}

function record(
  masterKey: string,
  recordType: string,
  ko: string,
  en: string,
  detail: JsonObject,
  metadata: JsonObject = ADDITION_AUTHORING_FIELDS,
): JsonRecord {
  return {
    masterKey,
    recordType,
    ...clone(metadata),
    names: names(ko, en),
    detail,
  };
}

function existingRecord(
  masterKey: string,
  recordType: string,
  ko: string,
  en: string,
  detail: JsonObject,
) {
  return record(masterKey, recordType, ko, en, detail, AUTHORING_FIELDS);
}

function toAuthoringRecord(raw: JsonRecord): JsonRecord {
  const detail = raw.recordType === "task_route"
    ? { routeCode: raw.detail.routeCode }
    : clone(raw.detail);
  return {
    // The live Airtable row uses the legacy/test key.  v3 keeps that remote
    // workspace row out of the payload and gives the operational authoring
    // row a fresh stable identity; the write manifest records the exact
    // Airtable key mutation separately.
    masterKey: raw.masterKey === LEGACY_INITIAL_MASTER_KEY ? V3_INITIAL_MASTER_KEY : raw.masterKey,
    recordType: raw.recordType,
    ...clone(AUTHORING_FIELDS),
    names: clone(raw.names),
    detail,
  };
}

function addRecord(fixture: AuthoringFixture, value: JsonRecord) {
  fixture.records.push(value);
}

function makeBaseFixture(): AuthoringFixture {
  const base = JSON.parse(readFileSync(BASE_FIXTURE_PATH, "utf8")) as JsonObject & { records: JsonRecord[]; classificationPaths: JsonObject[]; labPanelItems: JsonObject[]; labOrderProfiles: JsonObject[] };
  const baseRecords = base.records.map(toAuthoringRecord);
  // The Airtable authoring baseline is supplemented by two shared central
  // publisher identities already owned by the Phase 1A runtime.  They are
  // preserved baseline rows, not v3 creates; paths may reuse their stable
  // keys, while this slice adds no duplicate natural keys.
  const baselineKeys = new Set(baseRecords.map((item) => item.masterKey));
  if (!baselineKeys.has("phase1a2.fallback.chart.CG_INPATIENT")) {
    baseRecords.push(record(
      "phase1a2.fallback.chart.CG_INPATIENT",
      "chart_group",
      "입원",
      "CG_INPATIENT",
      { groupCode: "CG_INPATIENT", sortOrder: 906 },
    ));
  }
  if (!baselineKeys.has("phase1a2.fallback.route.NT_BILLING_ONLY")) {
    baseRecords.push(record(
      "phase1a2.fallback.route.NT_BILLING_ONLY",
      "task_route",
      "수납",
      "Billing only",
      { routeCode: "NT_BILLING_ONLY" },
    ));
  }
  return {
    schemaVersion: "clinical-master-airtable-authoring/v1",
    release: {
      releaseKey: RELEASE_KEY,
      status: "approved",
      releaseNotes: "Synthetic operational master v3; explicitly non-authoritative.",
      publishedByLabel: "CLAiR synthetic operational master publisher",
      authoredByLabel: "CLAiR synthetic operational master author",
      reviewedByLabel: "CLAiR synthetic operational master reviewer",
      clinicalReviewerLabel: null,
      reviewReason: "Deterministic structural and operational-flow fixture; not clinical approval.",
    },
    sources: [{ sourceKey: SOURCE_KEY, ...clone(SOURCE) }],
    records: baseRecords,
    classificationPaths: clone(base.classificationPaths),
    labPanelItems: clone(base.labPanelItems),
    labOrderProfiles: clone(base.labOrderProfiles),
    diagnosisCategoryLinks: [],
  };
}

function addSupportingRecords(fixture: AuthoringFixture) {
  const categories = [
    ["cm.order-category.x.preventive", "예방 항목", "Preventive", "X-PREVENTIVE", "X", null, 5],
    ["cm.order-category.t.preventive", "예방 운영", "Preventive operations", "T-PREVENTIVE", "T", "cm.order-category.x.preventive", 5],
    ["cm.order-category.x.surgery", "수술·마취 항목", "Surgery and anesthesia", "X-SURGERY", "X", null, 6],
    ["cm.order-category.t.surgery", "수술·마취 운영", "Surgery and anesthesia operations", "T-SURGERY", "T", "cm.order-category.x.surgery", 6],
    ["cm.order-category.x.inpatient", "입원 항목", "Inpatient", "X-INPATIENT", "X", null, 7],
    ["cm.order-category.t.inpatient", "입원 모니터링", "Inpatient monitoring", "T-INPATIENT", "T", "cm.order-category.x.inpatient", 7],
    ["cm.order-category.x.emergency", "응급 항목", "Emergency", "X-EMERGENCY", "X", null, 8],
    ["cm.order-category.t.emergency", "응급 초기평가", "Emergency assessment", "T-EMERGENCY", "T", "cm.order-category.x.emergency", 8],
  ] as const;
  categories.forEach(([key, ko, en, code, level, parent, sortOrder]) => {
    addRecord(fixture, record(key, "order_category", ko, en, {
      categoryCode: code,
      categoryLevel: level,
      parentMasterKey: parent,
      sortOrder,
    }));
  });

  const support = [
    ["cm.action.preventive-consultation", "예방 상담", "Preventive consultation", "cm.order-category.t.preventive", "consultation"],
    ["cm.action.preventive-treatment", "예방 처치", "Preventive treatment", "cm.order-category.t.preventive", "treatment"],
    ["cm.action.surgery-anesthesia", "수술·마취", "Surgery and anesthesia", "cm.order-category.t.surgery", "treatment"],
    ["cm.action.inpatient", "입원 모니터링", "Inpatient monitoring", "cm.order-category.t.inpatient", "hospitalization"],
    ["cm.action.emergency", "응급 초기평가", "Emergency assessment", "cm.order-category.t.emergency", "misc"],
    // Dental uses the existing treatment category; the distinct dental
    // classification path supplies the chart semantics without creating a
    // duplicate category natural key for this bounded slice.
    ["cm.action.dental", "치과 처치", "Dental treatment", "cm.order-category.t.treatment", "treatment"],
    ["cm.action.certificate", "증명서·기타", "Certificate and miscellaneous", "cm.order-category.t.consultation", "misc"],
    ["cm.action.dispensing-billing", "조제 수납", "Dispensing billing", "cm.order-category.t.medication", "medication"],
  ] as const;
  support.forEach(([key, ko, en, tCategoryKey, itemType]) => {
    addRecord(fixture, record(key, "clinical_action", ko, en, { tCategoryKey, itemType, isOtherUnclassified: false }));
  });

  const charts = [
  ["cm.chart.prevention", "예방", "CG_PREVENTION"],
  ["cm.chart.surgery", "수술·마취", "CG_SURGERY"],
  ] as const;
  charts.forEach(([key, ko, groupCode], index) => {
    addRecord(fixture, record(key, "chart_group", ko, groupCode, { groupCode, sortOrder: 910 + index }));
  });

  addRecord(fixture, record("cm.unit.mmol-l", "unit", "밀리몰/리터", "Millimole per liter", {
    unitCode: "mmol_l",
    symbol: "mmol/L",
    decimalScale: 1,
  }));
  addRecord(fixture, record("cm.unit.million-per-ul", "unit", "백만/마이크로리터", "Million per microliter", {
    unitCode: "million_per_ul",
    symbol: "10^6/µL",
    decimalScale: 1,
  }));
  addRecord(fixture, record("cm.unit.seconds", "unit", "초", "Seconds", {
    unitCode: "seconds",
    symbol: "s",
    decimalScale: 1,
  }));
  addRecord(fixture, record("cm.specimen.cytology-slide", "specimen_type", "세포검체 슬라이드", "Cytology slide", { specimenCode: "cytology_slide" }));
  addRecord(fixture, record("cm.specimen.swab", "specimen_type", "면봉 검체", "Swab", { specimenCode: "swab" }));
  addRecord(fixture, record("cm.specimen.joint-fluid", "specimen_type", "관절액 검체", "Joint fluid", { specimenCode: "joint_fluid" }));
  addRecord(fixture, record("cm.specimen.citrate-plasma", "specimen_type", "구연산염 혈장", "Citrate plasma", { specimenCode: "citrate_plasma" }));

  // Held master route is intentionally retained as unreferenced support.  A
  // published path cannot point to a held route; adoption maps inpatient to
  // workspace billing_only using the current A2 contract.
  addRecord(fixture, record("cm.route.inpatient-held", "task_route", "입원 보류", "Inpatient held", { routeCode: "NT_INPATIENT" }));

  const paths = [
    { pathKey: "cm.path.preventive-consultation", clinicalActionKey: "cm.action.preventive-consultation", chartGroupKey: "cm.chart.prevention", taskRouteKey: "phase1a2.fallback.route.NT_CHART_ONLY" },
    { pathKey: "cm.path.preventive-treatment", clinicalActionKey: "cm.action.preventive-treatment", chartGroupKey: "cm.chart.prevention", taskRouteKey: "phase1a2.fallback.route.NT_TREATMENT" },
    { pathKey: "cm.path.surgery-anesthesia", clinicalActionKey: "cm.action.surgery-anesthesia", chartGroupKey: "cm.chart.surgery", taskRouteKey: "phase1a2.fallback.route.NT_TREATMENT" },
    { pathKey: "cm.path.inpatient", clinicalActionKey: "cm.action.inpatient", chartGroupKey: "phase1a2.fallback.chart.CG_INPATIENT", taskRouteKey: "phase1a2.fallback.route.NT_BILLING_ONLY" },
    { pathKey: "cm.path.emergency", clinicalActionKey: "cm.action.emergency", chartGroupKey: "phase1a2.fallback.chart.CG_EXAM", taskRouteKey: "phase1a2.fallback.route.NT_BILLING_ONLY" },
    { pathKey: "cm.path.dental", clinicalActionKey: "cm.action.dental", chartGroupKey: "phase1a2.fallback.chart.CG_PROCEDURE", taskRouteKey: "phase1a2.fallback.route.NT_TREATMENT" },
    { pathKey: "cm.path.certificate", clinicalActionKey: "cm.action.certificate", chartGroupKey: "phase1a2.fallback.chart.CG_CONSULTATION", taskRouteKey: "phase1a2.fallback.route.NT_BILLING_ONLY" },
    { pathKey: "cm.path.dispensing-billing", clinicalActionKey: "cm.action.dispensing-billing", chartGroupKey: "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY", taskRouteKey: "phase1a2.fallback.route.NT_BILLING_ONLY" },
  ];
  fixture.classificationPaths.push(...paths);
}

type LabSemanticRow = {
  masterKey: string;
  name: string;
  testCode: string;
  resultInputTypeKey: string;
  canonicalUnitKey: string | null;
  decimalScale?: number;
  specimenMasterKey: string;
};

const newLabTests: LabSemanticRow[] = [
  { masterKey: "cm.lab-test.synthetic-01", name: "CBC 적혈구 수 검사", testCode: "RBC", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.million-per-ul", decimalScale: 1, specimenMasterKey: "cm.specimen.edta-whole-blood" },
  { masterKey: "cm.lab-test.synthetic-02", name: "CBC 혈색소 검사", testCode: "HGB", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.g-dl", decimalScale: 1, specimenMasterKey: "cm.specimen.edta-whole-blood" },
  { masterKey: "cm.lab-test.synthetic-03", name: "혈청화학 AST 검사", testCode: "AST", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.u-l", decimalScale: 0, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-04", name: "혈청화학 총빌리루빈 검사", testCode: "TBIL", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mg-dl", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-05", name: "혈청화학 알부민 검사", testCode: "ALB", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.g-dl", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-06", name: "혈청화학 칼슘 검사", testCode: "CA", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mg-dl", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-07", name: "혈청화학 인 검사", testCode: "PHOS", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mg-dl", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-08", name: "전해질 나트륨 검사", testCode: "NA", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mmol-l", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-09", name: "전해질 칼륨 검사", testCode: "K", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mmol-l", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-10", name: "전해질 염소 검사", testCode: "CL", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mmol-l", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-11", name: "응고 프로트롬빈시간 검사", testCode: "PT", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.seconds", decimalScale: 1, specimenMasterKey: "cm.specimen.citrate-plasma" },
  { masterKey: "cm.lab-test.synthetic-12", name: "응고 활성화부분트롬보플라스틴시간 검사", testCode: "APTT", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.seconds", decimalScale: 1, specimenMasterKey: "cm.specimen.citrate-plasma" },
  { masterKey: "cm.lab-test.synthetic-13", name: "망상적혈구 검사", testCode: "RETIC", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.percent", decimalScale: 1, specimenMasterKey: "cm.specimen.edta-whole-blood" },
  { masterKey: "cm.lab-test.synthetic-14", name: "혈액도말 형태 검사", testCode: "SMEAR", resultInputTypeKey: "cm.result-input.text", canonicalUnitKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
  { masterKey: "cm.lab-test.synthetic-15", name: "요화학 비중 검사", testCode: "UA_SG", resultInputTypeKey: "cm.result-input.coded", canonicalUnitKey: null, specimenMasterKey: "cm.specimen.urine" },
  { masterKey: "cm.lab-test.synthetic-16", name: "요화학 단백 검사", testCode: "UA_PROTEIN", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mg-dl", decimalScale: 1, specimenMasterKey: "cm.specimen.urine" },
  { masterKey: "cm.lab-test.synthetic-17", name: "전해질 중탄산염 검사", testCode: "HCO3", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mmol-l", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-18", name: "피부 세포 검사", testCode: "SKIN_CYTOLOGY", resultInputTypeKey: "cm.result-input.text", canonicalUnitKey: null, specimenMasterKey: "cm.specimen.cytology-slide" },
  { masterKey: "cm.lab-test.synthetic-19", name: "귀 분비물 세포 검사", testCode: "EAR_CYTOLOGY", resultInputTypeKey: "cm.result-input.text", canonicalUnitKey: null, specimenMasterKey: "cm.specimen.swab" },
  { masterKey: "cm.lab-test.synthetic-20", name: "종괴 세포 검사", testCode: "MASS_CYTOLOGY", resultInputTypeKey: "cm.result-input.text", canonicalUnitKey: null, specimenMasterKey: "cm.specimen.cytology-slide" },
  { masterKey: "cm.lab-test.synthetic-21", name: "관절액 세포 검사", testCode: "JOINT_FLUID_CYTOLOGY", resultInputTypeKey: "cm.result-input.text", canonicalUnitKey: null, specimenMasterKey: "cm.specimen.joint-fluid" },
  { masterKey: "cm.lab-test.synthetic-22", name: "전해질 마그네슘 검사", testCode: "MG", resultInputTypeKey: "cm.result-input.numeric", canonicalUnitKey: "cm.unit.mmol-l", decimalScale: 1, specimenMasterKey: "cm.specimen.serum" },
  { masterKey: "cm.lab-test.synthetic-23", name: "혈액형 검사", testCode: "BLOOD_TYPE", resultInputTypeKey: "cm.result-input.coded", canonicalUnitKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
];

const newLabPanelLinks: Array<{ panelMasterKey: string; testMasterKeys: string[] }> = [
  {
    panelMasterKey: "cm.lab-panel.synthetic-01",
    testMasterKeys: ["cm.lab-test.synthetic-08", "cm.lab-test.synthetic-09", "cm.lab-test.synthetic-10", "cm.lab-test.synthetic-06", "cm.lab-test.synthetic-07", "cm.lab-test.chem-glucose", "cm.lab-test.chem-creatinine"],
  },
  {
    panelMasterKey: "cm.lab-panel.synthetic-02",
    testMasterKeys: ["cm.lab-test.synthetic-11", "cm.lab-test.synthetic-12"],
  },
  {
    panelMasterKey: "cm.lab-panel.synthetic-03",
    testMasterKeys: ["cm.lab-test.chem-glucose", "cm.lab-test.chem-creatinine", "cm.lab-test.chem-bun", "cm.lab-test.chem-alt", "cm.lab-test.chem-alp", "cm.lab-test.chem-total-protein", "cm.lab-test.synthetic-05", "cm.lab-test.synthetic-06"],
  },
  {
    panelMasterKey: "cm.lab-panel.synthetic-04",
    testMasterKeys: ["cm.lab-test.chem-alt", "cm.lab-test.chem-alp", "cm.lab-test.chem-total-protein", "cm.lab-test.synthetic-03", "cm.lab-test.synthetic-04", "cm.lab-test.synthetic-05", "cm.lab-test.synthetic-06", "cm.lab-test.chem-glucose"],
  },
  {
    panelMasterKey: "cm.lab-panel.synthetic-05",
    testMasterKeys: ["cm.lab-test.chem-bun", "cm.lab-test.chem-creatinine", "cm.lab-test.synthetic-07", "cm.lab-test.synthetic-08", "cm.lab-test.synthetic-09", "cm.lab-test.synthetic-10", "cm.lab-test.synthetic-06", "cm.lab-test.chem-glucose"],
  },
  {
    panelMasterKey: "cm.lab-panel.synthetic-06",
    testMasterKeys: ["cm.lab-test.chem-glucose", "cm.lab-test.chem-total-protein", "cm.lab-test.chem-alt", "cm.lab-test.chem-alp", "cm.lab-test.chem-bun", "cm.lab-test.chem-creatinine", "cm.lab-test.synthetic-03", "cm.lab-test.synthetic-04", "cm.lab-test.synthetic-05", "cm.lab-test.synthetic-06", "cm.lab-test.synthetic-07", "cm.lab-test.synthetic-08", "cm.lab-test.synthetic-09", "cm.lab-test.synthetic-10"],
  },
];

const newLabProfiles: Array<{ orderMasterKey: string; labTestMasterKey: string | null; labPanelMasterKey: string | null; specimenMasterKey: string }> = [
  { orderMasterKey: "cm.order.synthetic.lab-01", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-01", specimenMasterKey: "cm.specimen.serum" },
  { orderMasterKey: "cm.order.synthetic.lab-02", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-02", specimenMasterKey: "cm.specimen.citrate-plasma" },
  { orderMasterKey: "cm.order.synthetic.lab-03", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-03", specimenMasterKey: "cm.specimen.serum" },
  { orderMasterKey: "cm.order.synthetic.lab-04", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-04", specimenMasterKey: "cm.specimen.serum" },
  { orderMasterKey: "cm.order.synthetic.lab-05", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-05", specimenMasterKey: "cm.specimen.serum" },
  { orderMasterKey: "cm.order.synthetic.lab-06", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-06", specimenMasterKey: "cm.specimen.serum" },
  { orderMasterKey: "cm.order.synthetic.lab-07", labTestMasterKey: "cm.lab-test.synthetic-23", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
  { orderMasterKey: "cm.order.synthetic.lab-08", labTestMasterKey: "cm.lab-test.synthetic-13", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
  { orderMasterKey: "cm.order.synthetic.lab-09", labTestMasterKey: "cm.lab-test.synthetic-14", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
  { orderMasterKey: "cm.order.synthetic.lab-10", labTestMasterKey: "cm.lab-test.synthetic-18", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.cytology-slide" },
  { orderMasterKey: "cm.order.synthetic.lab-11", labTestMasterKey: "cm.lab-test.synthetic-19", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.swab" },
  { orderMasterKey: "cm.order.synthetic.lab-12", labTestMasterKey: "cm.lab-test.synthetic-20", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.cytology-slide" },
  { orderMasterKey: "cm.order.synthetic.lab-13", labTestMasterKey: "cm.lab-test.synthetic-21", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.joint-fluid" },
];

function addLabRows(fixture: AuthoringFixture) {
  newLabTests.forEach((labTest, index) => {
    const detail: JsonObject = {
      testCode: labTest.testCode,
      resultInputTypeKey: labTest.resultInputTypeKey,
      canonicalUnitKey: labTest.canonicalUnitKey,
    };
    if (labTest.decimalScale !== undefined) detail.decimalScale = labTest.decimalScale;
    addRecord(fixture, record(labTest.masterKey, "lab_test", labTest.name, `Operational lab result ${index + 1}`, detail));
  });

  syntheticLabPanelNames.forEach((name, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    addRecord(fixture, record(`cm.lab-panel.synthetic-${suffix}`, "lab_panel", name, `Operational lab panel ${index + 1}`, { panelCode: `SYNTH_PANEL_${suffix}` }));
  });

  newLabPanelLinks.forEach(({ panelMasterKey, testMasterKeys }) => {
    testMasterKeys.forEach((testMasterKey, sortOrder) => {
      fixture.labPanelItems.push({
        panelMasterKey,
        testMasterKey,
        sortOrder,
        required: true,
        displayGroup: `synthetic-${panelMasterKey.slice(-2)}`,
      });
    });
  });

  fixture.labOrderProfiles.push(...newLabProfiles);
}

function makeLabSemanticsFixture() {
  return {
    schemaVersion: "clinical-master-operational-lab-semantics/v1",
    releaseKey: RELEASE_KEY,
    syntheticOnly: true,
    authorityBoundary: "Explicit authoring-side lab semantic table; specimen is carried by the profile contract because publisher lab_test detail has no specimen field.",
    tests: newLabTests.map((labTest) => ({
      masterKey: labTest.masterKey,
      name: labTest.name,
      testCode: labTest.testCode,
      resultInputTypeKey: labTest.resultInputTypeKey,
      canonicalUnitKey: labTest.canonicalUnitKey,
      decimalScale: labTest.decimalScale ?? null,
      specimenMasterKey: labTest.specimenMasterKey,
    })),
    panelLinks: newLabPanelLinks.map((panel) => ({ panelMasterKey: panel.panelMasterKey, testMasterKeys: panel.testMasterKeys })),
    profiles: newLabProfiles,
  };
}

function addOrders(fixture: AuthoringFixture): OrderWorkspaceRow[] {
  const rows: OrderWorkspaceRow[] = [];
  const categorySerials: Record<string, number> = {};
  const nextPrice = (category: string) => {
    const categoryPriceSerial = (categorySerials[category] ?? 0) + 1;
    categorySerials[category] = categoryPriceSerial;
    const categoryPriceBase = priceBases[category];
    if (categoryPriceBase === undefined) throw new Error(`Missing category price base for ${category}`);
    return {
      categoryPriceBase,
      categoryPriceSerial,
      syntheticWorkspacePriceKrw: categoryPriceBase + categoryPriceSerial,
    };
  };
  const existingCategoryByKey: Record<string, string> = {
    "cm.order.consult.followup": "consultation",
    [V3_INITIAL_MASTER_KEY]: "consultation",
    "cm.order.consult.preventive-cat": "preventive",
    "cm.order.consult.preventive-dog": "preventive",
  };
  const pathDetails: Record<string, { itemType: string; routeCode: string; workspaceDestinationModule: string }> = {
    "cm.path.consultation": { itemType: "consultation", routeCode: "NT_CHART_ONLY", workspaceDestinationModule: "chart_only" },
    "cm.path.dispensing": { itemType: "medication", routeCode: "NT_DISPENSING", workspaceDestinationModule: "dispensing" },
    "cm.path.imaging": { itemType: "imaging", routeCode: "NT_IMAGING", workspaceDestinationModule: "imaging" },
    "cm.path.laboratory": { itemType: "lab", routeCode: "NT_LAB", workspaceDestinationModule: "lab" },
    "cm.path.treatment": { itemType: "treatment", routeCode: "NT_TREATMENT", workspaceDestinationModule: "treatment" },
    "cm.path.preventive-consultation": { itemType: "consultation", routeCode: "NT_CHART_ONLY", workspaceDestinationModule: "chart_only" },
    "cm.path.preventive-treatment": { itemType: "treatment", routeCode: "NT_TREATMENT", workspaceDestinationModule: "treatment" },
    "cm.path.surgery-anesthesia": { itemType: "treatment", routeCode: "NT_TREATMENT", workspaceDestinationModule: "treatment" },
    "cm.path.inpatient": { itemType: "hospitalization", routeCode: "NT_BILLING_ONLY", workspaceDestinationModule: "billing_only" },
    "cm.path.emergency": { itemType: "misc", routeCode: "NT_BILLING_ONLY", workspaceDestinationModule: "billing_only" },
    "cm.path.dental": { itemType: "treatment", routeCode: "NT_TREATMENT", workspaceDestinationModule: "treatment" },
    "cm.path.certificate": { itemType: "misc", routeCode: "NT_BILLING_ONLY", workspaceDestinationModule: "billing_only" },
    "cm.path.dispensing-billing": { itemType: "medication", routeCode: "NT_BILLING_ONLY", workspaceDestinationModule: "billing_only" },
  };

  fixture.records.filter((item) => item.recordType === "order").forEach((item) => {
    const category = existingCategoryByKey[item.masterKey]
      ?? (item.masterKey.includes("lab")
        ? "lab"
        : item.masterKey.includes("imaging")
          ? "imaging"
          : item.masterKey.includes("treatment")
            ? "treatment"
            : "dispensing");
    const pathKey = String(item.detail.classificationPathKey);
    const path = pathDetails[pathKey];
    rows.push({
      masterKey: item.masterKey,
      researchCategory: category,
      classificationPathKey: pathKey,
      itemType: path.itemType,
      masterRouteCode: path.routeCode,
      workspaceDestinationModule: path.workspaceDestinationModule,
      ...nextPrice(category),
      salesUnit: "case",
    });
  });

  const syntheticPlan: Array<{ category: string; count: number; pathKey: string }> = [
    { category: "consultation", count: 10, pathKey: "cm.path.consultation" },
    { category: "preventive", count: 10, pathKey: "cm.path.preventive-consultation" },
    { category: "lab", count: 13, pathKey: "cm.path.laboratory" },
    { category: "imaging", count: 8, pathKey: "cm.path.imaging" },
    { category: "treatment", count: 15, pathKey: "cm.path.treatment" },
    { category: "dispensing", count: 12, pathKey: "cm.path.dispensing" },
    { category: "dispensing", count: 2, pathKey: "cm.path.dispensing-billing" },
    { category: "surgery/anesthesia", count: 8, pathKey: "cm.path.surgery-anesthesia" },
    { category: "inpatient", count: 6, pathKey: "cm.path.inpatient" },
    { category: "emergency", count: 3, pathKey: "cm.path.emergency" },
    { category: "dental", count: 2, pathKey: "cm.path.dental" },
    { category: "certificate/misc", count: 1, pathKey: "cm.path.certificate" },
  ];
  const syntheticCategorySerials: Record<string, number> = {};
  syntheticPlan.forEach(({ category, count, pathKey }) => {
    const path = pathDetails[pathKey];
    for (let index = 1; index <= count; index += 1) {
      const price = nextPrice(category);
      const serial = (syntheticCategorySerials[category] ?? 0) + 1;
      syntheticCategorySerials[category] = serial;
      const suffix = String(serial).padStart(2, "0");
      const safeCategory = category.replaceAll("/", "-");
      const masterKey = `cm.order.synthetic.${safeCategory}-${suffix}`;
      const preferredName = syntheticOrderNames[category]?.[serial - 1];
      if (!preferredName) throw new Error(`Missing concrete operational name for ${category} #${serial}`);
      addRecord(fixture, record(masterKey, "order", preferredName, `Operational order ${serial}`, {
        classificationPathKey: pathKey,
        defaultSalesUnitCode: "case",
        defaultBillingReflectionEnabled: true,
        defaultQuantity: 1,
        species: ["cat", "dog"],
      }));
      rows.push({
        masterKey,
        researchCategory: category,
        classificationPathKey: pathKey,
        itemType: path.itemType,
        masterRouteCode: path.routeCode,
        heldSourceRouteCode: category === "inpatient" ? "NT_INPATIENT" : undefined,
        workspaceDestinationModule: path.workspaceDestinationModule,
        ...price,
        salesUnit: "case",
      });
    }
  });
  return rows;
}

function addDiagnoses(fixture: AuthoringFixture) {
  const categories = [
    ["cm.diagnosis-category.system.digestive", "소화기계", "Digestive system", "system", null, 0],
    ["cm.diagnosis-category.system.respiratory", "호흡기계", "Respiratory system", "system", null, 1],
    ["cm.diagnosis-category.system.urinary", "비뇨기계", "Urinary system", "system", null, 2],
    ["cm.diagnosis-category.system.dermatologic", "피부계", "Dermatologic system", "system", null, 3],
    ["cm.diagnosis-category.system.musculoskeletal", "근골격계", "Musculoskeletal system", "system", null, 4],
    ["cm.diagnosis-category.system.endocrine", "내분비계", "Endocrine system", "system", null, 5],
    ["cm.diagnosis-category.group.gastrointestinal", "위장관 질환", "Gastrointestinal disease", "disease_group", "cm.diagnosis-category.system.digestive", 0],
    ["cm.diagnosis-category.group.airway-lung", "기도·폐 질환", "Airway and lung disease", "disease_group", "cm.diagnosis-category.system.respiratory", 0],
    ["cm.diagnosis-category.group.lower-urinary", "하부요로 질환", "Lower urinary disease", "disease_group", "cm.diagnosis-category.system.urinary", 0],
    ["cm.diagnosis-category.group.skin-ear-inflammatory", "염증성 피부·외이 질환", "Inflammatory skin and ear disease", "disease_group", "cm.diagnosis-category.system.dermatologic", 0],
    ["cm.diagnosis-category.group.joint", "관절 질환", "Joint disease", "disease_group", "cm.diagnosis-category.system.musculoskeletal", 0],
    ["cm.diagnosis-category.group.glucose-metabolism", "당대사 질환", "Glucose metabolism disease", "disease_group", "cm.diagnosis-category.system.endocrine", 0],
  ] as const;
  categories.forEach(([key, ko, en, categoryKind, parentMasterKey, sortOrder]) => addRecord(fixture, existingRecord(key, "diagnosis_category", ko, en, { categoryKind, parentMasterKey, sortOrder })));

  const diagnoses = [
    ["cm.diagnosis.bronchitis", "기관지염", "Bronchitis", "cm.diagnosis-category.group.airway-lung"],
    ["cm.diagnosis.constipation", "변비", "Constipation", "cm.diagnosis-category.group.gastrointestinal"],
    ["cm.diagnosis.cystitis", "방광염", "Cystitis", "cm.diagnosis-category.group.lower-urinary"],
    ["cm.diagnosis.dermatitis", "피부염", "Dermatitis", "cm.diagnosis-category.group.skin-ear-inflammatory"],
    ["cm.diagnosis.diabetes-mellitus", "당뇨병", "Diabetes mellitus", "cm.diagnosis-category.group.glucose-metabolism"],
    ["cm.diagnosis.gastroenteritis", "위장염", "Gastroenteritis", "cm.diagnosis-category.group.gastrointestinal"],
    ["cm.diagnosis.hypoglycemia", "저혈당", "Hypoglycemia", "cm.diagnosis-category.group.glucose-metabolism"],
    ["cm.diagnosis.osteoarthritis", "골관절염", "Osteoarthritis", "cm.diagnosis-category.group.joint"],
    ["cm.diagnosis.otitis-externa", "외이염", "Otitis externa", "cm.diagnosis-category.group.skin-ear-inflammatory"],
    ["cm.diagnosis.patellar-luxation", "슬개골 탈구", "Patellar luxation", "cm.diagnosis-category.group.joint"],
    ["cm.diagnosis.pneumonia", "폐렴", "Pneumonia", "cm.diagnosis-category.group.airway-lung"],
    ["cm.diagnosis.urolithiasis", "요로결석", "Urolithiasis", "cm.diagnosis-category.group.lower-urinary"],
  ] as const;
  diagnoses.forEach(([key, ko, en, categoryMasterKey]) => {
    addRecord(fixture, existingRecord(key, "diagnosis", ko, en, {}));
    fixture.diagnosisCategoryLinks.push({ diagnosisMasterKey: key, categoryMasterKey, isPrimary: true, sortOrder: 0 });
  });
}

function makeFixture() {
  const fixture = makeBaseFixture();
  addSupportingRecords(fixture);
  addLabRows(fixture);
  const orders = addOrders(fixture);
  addDiagnoses(fixture);
  fixture.records.sort((left, right) => left.masterKey.localeCompare(right.masterKey));
  fixture.classificationPaths.sort((left, right) => String(left.pathKey).localeCompare(String(right.pathKey)));
  fixture.labPanelItems.sort((left, right) => String(left.panelMasterKey).localeCompare(String(right.panelMasterKey)) || Number(left.sortOrder) - Number(right.sortOrder) || String(left.testMasterKey).localeCompare(String(right.testMasterKey)));
  fixture.labOrderProfiles.sort((left, right) => String(left.orderMasterKey).localeCompare(String(right.orderMasterKey)));
  fixture.diagnosisCategoryLinks.sort((left, right) => String(left.diagnosisMasterKey).localeCompare(String(right.diagnosisMasterKey)));
  return { fixture, orders };
}

function makePricingAdoptionFixture(orders: OrderWorkspaceRow[]) {
  const categoryCount = orders.reduce<Record<string, number>>((counts, row) => {
    counts[row.researchCategory] = (counts[row.researchCategory] ?? 0) + 1;
    return counts;
  }, {});
  const existingCheongdamRows = [
    ["CBC 혈구검사", "cd-lab-cbc", null, "active"],
    ["X-ray 2컷", "cd-imaging-xray2", null, "active"],
    ["경구약 조제", "cd-dispensing-oral-basic", null, "active"],
    ["귀 세정", "cd-treatment-ear-clean", null, "active"],
    ["복부 초음파", "cd-imaging-us-abdomen", null, "active"],
    ["요검사", "cd-lab-ua", null, "active"],
    ["입원 1일", "cd-hospitalization-day", null, "active"],
    ["재진 진찰", "cd-consult-revisit", null, "active"],
    ["종합백신", "cd-vaccine-core", null, "active"],
    ["초진 진찰", "cd-consult-first", null, "active"],
    ["피하수액", "cd-treatment-fluid-sc", null, "active"],
    ["혈액화학 10종", "cd-lab-chem10", null, "active"],
    ["합성 기초 혈액검사", "master-workspace-clair-cheongdam-phase1.optionb.v1.order.metabolic", "phase1.optionb.v1.order.metabolic", "paused"],
  ].map(([displayName, observedCatalogRowId, observedMasterKey, status], index) => ({
    displayName,
    observedCatalogRowId,
    observedMasterKey,
    status,
    collisionAction: "preserve_no_delete",
    semanticFingerprintRequired: true,
    semanticCollisionStatus: "pending_exact_v3_name_fingerprint",
    order: index + 1,
  }));
  return {
    schemaVersion: "clinical-master-operational-workspace-pricing/v1",
    releaseKey: RELEASE_KEY,
    syntheticOnly: true,
    authorityBoundary: "Workspace pricing/adoption fixture only; publisher payload has no price or Order Set authority.",
    pricingPolicy: {
      owner: "workspace_order_catalog",
      currency: "KRW",
      amountKind: "integer",
      collisionPolicy: "same masterKey updates only after semantic fingerprint equality; mismatch aborts before write",
      updatePolicy: "workspace price may be updated by workspace policy; master identity and publisher payload remain unchanged",
      deletePolicy: "never delete existing custom workspace rows; retain and report collisions",
      orderSetPolicy: "no Order Set authoring in this Phase A slice",
    },
    adoptionPolicy: {
      targetWorkspaceId: "workspace-clair-cheongdam",
      targetWorkspaceIds: ["workspace-clinical-master-pilot-v1", "workspace-clair-cheongdam", "clair-demo"],
      excludedWorkspaceIds: ["clair-foreign-demo"],
      masterReleaseKey: RELEASE_KEY,
      heldMasterRouteMapping: { masterRouteCode: "NT_BILLING_ONLY", heldSourceRouteCode: "NT_INPATIENT", workspaceDestinationModule: "billing_only", runtimeStatus: "held" },
      classificationPathBoundary: "Use only current five paths plus the eight listed v3 paths; held route is support-only and never a published path.",
      existingCheongdamRows,
      clairDemoPolicy: { workspaceId: "clair-demo", existingRowAction: "preserve_no_delete", syntheticOnly: true },
      foreignWorkspacePolicy: {
        workspaceId: "clair-foreign-demo",
        excludedFromAdoption: true,
        negativeControl: true,
        existingRowsUnchanged: true,
        fingerprintBoundary: "pre_post",
        noWrite: true,
        policy: "read_only_pre_post_fingerprint_no_write",
        action: "read_only_pre_post_fingerprint_no_write",
      },
    },
    categoryCounts: categoryCount,
    categoryPriceBases: clone(priceBases),
    totalSyntheticWorkspacePriceKrw: orders.reduce((total, row) => total + row.syntheticWorkspacePriceKrw, 0),
    orders,
  };
}

type StableLinkRef = {
  resolveBy: "stableKey";
  table: string;
  stableKey: string;
  resolvedRecordId: null;
};

function stableLink(table: string, stableKey: string): StableLinkRef {
  return { resolveBy: "stableKey", table, stableKey, resolvedRecordId: null };
}

function firstLinkedName(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first = value[0];
  if (!first || typeof first !== "object") return null;
  const name = (first as JsonObject).name;
  return typeof name === "string" ? name : null;
}

function airtableOptionName(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return typeof value === "string" ? value : null;
  const name = (value as JsonObject).name;
  return typeof name === "string" ? name : null;
}

function makeMasterCreatePayload(item: JsonRecord) {
  return {
    stableKey: item.masterKey,
    fields: {
      masterKey: item.masterKey,
      recordType: item.recordType,
      authoringStatus: item.authoringStatus,
      lifecycleStatus: item.lifecycleStatus,
      safetyStatus: item.safetyStatus,
      safetyReason: item.safetyReason,
      changeSummary: item.changeSummary,
      sourceAssertionScope: item.sourceAssertionScope,
      sourceNotes: item.sourceNotes,
      detail: JSON.stringify(item.detail),
      sourceKey: [stableLink("Sources", SOURCE_KEY)],
    },
  };
}

function makeNameCreatePayload(item: JsonRecord) {
  const preferredName = item.names[0];
  return {
    stableKey: item.masterKey,
    fields: {
      name: preferredName?.name,
      languageCode: preferredName?.languageCode,
      nameKind: preferredName?.nameKind,
      searchable: preferredName?.searchable,
      sortOrder: preferredName?.sortOrder,
      masterKey: [stableLink("Master Records", item.masterKey)],
    },
  };
}

function makePathCreatePayload(path: JsonObject) {
  const pathKey = String(path.pathKey);
  return {
    stableKey: pathKey,
    fields: {
      pathKey,
      clinicalActionKey: [stableLink("Master Records", String(path.clinicalActionKey))],
      chartGroupKey: [stableLink("Master Records", String(path.chartGroupKey))],
      taskRouteKey: [stableLink("Master Records", String(path.taskRouteKey))],
    },
  };
}

function makePanelItemCreatePayload(item: JsonObject) {
  const panelMasterKey = String(item.panelMasterKey);
  const testMasterKey = String(item.testMasterKey);
  return {
    stableKey: `${panelMasterKey}+${testMasterKey}`,
    expectedComputedRowLabel: `${panelMasterKey} → ${testMasterKey}`,
    fields: {
      sortOrder: item.sortOrder,
      required: item.required,
      displayGroup: item.displayGroup,
      panelMasterKey: [stableLink("Master Records", panelMasterKey)],
      testMasterKey: [stableLink("Master Records", testMasterKey)],
    },
  };
}

function makeProfileCreatePayload(profile: JsonObject) {
  const orderMasterKey = String(profile.orderMasterKey);
  const labTestMasterKey = profile.labTestMasterKey ? String(profile.labTestMasterKey) : null;
  const labPanelMasterKey = profile.labPanelMasterKey ? String(profile.labPanelMasterKey) : null;
  const specimenMasterKey = profile.specimenMasterKey ? String(profile.specimenMasterKey) : null;
  return {
    stableKey: orderMasterKey,
    expectedComputedRowLabel: orderMasterKey,
    fields: {
      orderMasterKey: [stableLink("Master Records", orderMasterKey)],
      labTestMasterKey: labTestMasterKey ? [stableLink("Master Records", labTestMasterKey)] : null,
      labPanelMasterKey: labPanelMasterKey ? [stableLink("Master Records", labPanelMasterKey)] : null,
      specimenMasterKey: specimenMasterKey ? [stableLink("Master Records", specimenMasterKey)] : null,
    },
  };
}

function withFieldIdPayloads(
  tableName: string,
  payloads: Array<{ stableKey: string; fields: Record<string, unknown> }>,
  readback: AirtableReadback,
) {
  const fieldIdsByName = readback.tables[tableName].fieldIdsByName;
  return payloads.map((payload) => {
    const writableFields = Object.fromEntries(Object.entries(payload.fields).filter(([, value]) => value !== null && value !== undefined));
    const fieldsByFieldId = Object.fromEntries(Object.entries(writableFields).map(([fieldName, value]) => {
      const fieldId = fieldIdsByName[fieldName];
      if (!fieldId) throw new Error(`Missing live Airtable field ID for ${tableName}.${fieldName}`);
      return [fieldId, value];
    }));
    return { ...payload, fields: writableFields, fieldsByFieldId };
  });
}

function nonWritableAirtableFieldIds(readback: AirtableReadback) {
  return new Set(Object.values(readback.tables).flatMap((table) => Object.entries(table.fieldIdsByName)
    .filter(([fieldName]) => fieldName === "rowLabel" || fieldName.includes("display-only"))
    .map(([, fieldId]) => fieldId)));
}

const nullOmissionOnly = [
  { airtableRecordId: "recUngHfP9PsfZVK7", masterKey: "cm.diagnosis-category.system.dermatologic", field: "detail.parentMasterKey" },
  { airtableRecordId: "recknujIC2DAQIDpJ", masterKey: "cm.diagnosis-category.system.digestive", field: "detail.parentMasterKey" },
  { airtableRecordId: "recxoqUbKsoKFDh08", masterKey: "cm.diagnosis-category.system.endocrine", field: "detail.parentMasterKey" },
  { airtableRecordId: "recAbcvR9R8Pe538Z", masterKey: "cm.diagnosis-category.system.musculoskeletal", field: "detail.parentMasterKey" },
  { airtableRecordId: "recMuTcYxuEa8VK6t", masterKey: "cm.diagnosis-category.system.respiratory", field: "detail.parentMasterKey" },
  { airtableRecordId: "recVk5d14DqXPSm0q", masterKey: "cm.diagnosis-category.system.urinary", field: "detail.parentMasterKey" },
  { airtableRecordId: "recGXn5aY2dvoKHA0", masterKey: "cm.lab-test.fecal-microscopy", field: "detail.canonicalUnitKey" },
  { airtableRecordId: "recFWsRZuNbZCWJkX", masterKey: "cm.lab-test.giardia-antigen", field: "detail.canonicalUnitKey" },
  { airtableRecordId: "rec9ifzuGhxbuvSzY", masterKey: "cm.lab-test.ua-sediment", field: "detail.canonicalUnitKey" },
  { airtableRecordId: "recnOpU7LsZEmt9d3", masterKey: "cm.lab-test.ua-strip", field: "detail.canonicalUnitKey" },
  { airtableRecordId: "recBMnR0sLtSFoqap", masterKey: "cm.order-category.x.clinical", field: "detail.parentMasterKey" },
];

function makeWriteManifest(fixture: AuthoringFixture, adapterOutput: { payload: JsonObject }, readback: AirtableReadback) {
  const liveMasterKeys = new Set(readback.tables["Master Records"].records.map((row) => String(row.fields.masterKey)));
  if (liveMasterKeys.has(AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey)) {
    throw new Error("Airtable fresh consultation key must be absent from the live preflight baseline.");
  }
  const migratedLiveMasterKeys = new Set(liveMasterKeys);
  migratedLiveMasterKeys.delete(AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey);
  migratedLiveMasterKeys.add(AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey);
  const livePathKeys = new Set(readback.tables["Classification Paths"].records.map((row) => String(row.fields.pathKey)));
  const livePanelItemKeys = new Set(readback.tables["Lab Panel Items"].records.map((row) => {
    const panel = firstLinkedName(row.fields.panelMasterKey);
    const test = firstLinkedName(row.fields.testMasterKey);
    return `${panel}+${test}`;
  }));
  const liveProfileKeys = new Set(readback.tables["Lab Order Profiles"].records.map((row) => firstLinkedName(row.fields.orderMasterKey)));
  const newMasterRecords = fixture.records.filter((item) => !migratedLiveMasterKeys.has(item.masterKey) && item.recordType !== "diagnosis_category" && item.recordType !== "diagnosis");
  const newNames = fixture.records.filter((item) => !migratedLiveMasterKeys.has(item.masterKey));
  const newPaths = fixture.classificationPaths.filter((path) => !livePathKeys.has(String(path.pathKey)));
  const newPanelItems = fixture.labPanelItems.filter((item) => !livePanelItemKeys.has(`${item.panelMasterKey}+${item.testMasterKey}`));
  const newProfiles = fixture.labOrderProfiles.filter((profile) => !liveProfileKeys.has(String(profile.orderMasterKey)));
  const currentRelease = readback.tables["Release Drafts"].records[0];
  const currentSource = readback.tables.Sources.records[0];
  const currentInitialRow = readback.tables["Master Records"].records.find((row) => String(row.fields.masterKey) === AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey);
  const currentInitialNameRow = readback.tables.Names.records.find((row) => {
    const masterLinks = row.fields.masterKey;
    return Array.isArray(masterLinks) && masterLinks.some((link) => Boolean(link && typeof link === "object" && "id" in link && String((link as JsonObject).id) === AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId));
  });
  if (!currentRelease || !currentSource) throw new Error("Airtable readback must contain one Release Draft and one Source row.");
  if (!currentInitialRow || currentInitialRow.airtableRecordId !== AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId || !currentInitialNameRow || currentInitialNameRow.airtableRecordId !== AIRTABLE_INITIAL_KEY_MIGRATION.linkedNameRecordId) {
    throw new Error("Airtable legacy consultation identity fork readback drifted.");
  }
  const initialMasterKeyFieldId = readback.tables["Master Records"].fieldIdsByName.masterKey;
  if (!initialMasterKeyFieldId) throw new Error("Airtable Master Records.masterKey field ID is required for the audited identity fork.");
  const legacyInitialMutation = {
    operation: "update_existing_by_record_id_identity_fork",
    recordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId,
    currentMasterKey: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey,
    newMasterKey: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey,
    fields: { masterKey: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey },
    fieldsByFieldId: { [initialMasterKeyFieldId]: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey },
    preserveLinkedNameRecordId: AIRTABLE_INITIAL_KEY_MIGRATION.linkedNameRecordId,
    cas: "require the exact live recordId/current masterKey before the update; re-read exact after fields before continuing",
    rollbackRestore: {
      recordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId,
      fields: { masterKey: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey },
      order: "restore this identity fork before any created-ID rollback",
    },
  };
  const releaseAfter = {
    releaseKey: RELEASE_KEY,
    status: "approved",
    releaseNotes: fixture.release.releaseNotes,
    reviewReason: fixture.release.reviewReason,
    publishedByLabel: fixture.release.publishedByLabel,
    authoredByLabel: fixture.release.authoredByLabel,
    reviewedByLabel: fixture.release.reviewedByLabel,
    clinicalReviewerLabel: fixture.release.clinicalReviewerLabel,
  };
  const priorStatus = airtableOptionName(currentRelease.fields.status);
  if (!priorStatus) throw new Error("Release Draft readback status must normalize to a writable option name.");
  const releaseBefore = Object.fromEntries(Object.entries({
    releaseKey: currentRelease.fields.releaseKey,
    status: priorStatus,
    releaseNotes: currentRelease.fields.releaseNotes,
    reviewReason: currentRelease.fields.reviewReason,
    publishedByLabel: currentRelease.fields.publishedByLabel,
    authoredByLabel: currentRelease.fields.authoredByLabel,
    reviewedByLabel: currentRelease.fields.reviewedByLabel,
    clinicalReviewerLabel: currentRelease.fields.clinicalReviewerLabel,
  }).filter(([, value]) => value !== null && value !== undefined));
  const tables = {
    "Release Drafts": {
      tableId: readback.tables["Release Drafts"].tableId,
      fieldIdsByName: readback.tables["Release Drafts"].fieldIdsByName,
      operation: "update_existing_by_record_id",
      currentRecordId: currentRelease.airtableRecordId,
      expectedBefore: 1,
      expectedAfter: 1,
      updateExisting: 1,
      create: 0,
      preserveRecordId: true,
      fieldsToSet: Object.keys(releaseAfter),
      expectedBeforeFields: clone(currentRelease.fields),
      fieldsPayload: releaseAfter,
    },
    Sources: {
      tableId: readback.tables.Sources.tableId,
      fieldIdsByName: readback.tables.Sources.fieldIdsByName,
      operation: "verify_existing_by_sourceKey",
      currentRecordId: currentSource.airtableRecordId,
      expectedBefore: 1,
      expectedAfter: 1,
      updateExisting: 0,
      create: 0,
      preserveRecordId: true,
      fieldsToSet: [],
      expectedBeforeFields: clone(currentSource.fields),
    },
    "Master Records": {
      tableId: readback.tables["Master Records"].tableId,
      fieldIdsByName: readback.tables["Master Records"].fieldIdsByName,
      operation: "create_if_absent_by_masterKey_plus_one_audited_identity_fork",
      expectedBefore: readback.tableCounts["Master Records"],
      expectedAfter: 254,
      updateExisting: 1,
      create: newMasterRecords.length,
      preserveRecordIdsForExistingStableKeys: true,
      publisherSupportedBefore: 83,
      publisherSupportedAfter: 230,
      diagnosisAuthoringOnlyBefore: 24,
      diagnosisAuthoringOnlyAfter: 24,
      createPayloads: withFieldIdPayloads("Master Records", newMasterRecords.map(makeMasterCreatePayload), readback),
      updatePayloads: [legacyInitialMutation],
    },
    Names: {
      tableId: readback.tables.Names.tableId,
      fieldIdsByName: readback.tables.Names.fieldIdsByName,
      operation: "create_if_absent_by_masterKey",
      expectedBefore: readback.tableCounts.Names,
      expectedAfter: 254,
      updateExisting: 0,
      create: newNames.length,
      preserveRecordIdsForExistingStableKeys: true,
      onePreferredNamePerMasterRow: true,
      createPayloads: withFieldIdPayloads("Names", newNames.map(makeNameCreatePayload), readback),
    },
    "Classification Paths": {
      tableId: readback.tables["Classification Paths"].tableId,
      fieldIdsByName: readback.tables["Classification Paths"].fieldIdsByName,
      operation: "create_if_absent_by_pathKey",
      expectedBefore: readback.tableCounts["Classification Paths"],
      expectedAfter: 13,
      updateExisting: 0,
      create: newPaths.length,
      preserveRecordIdsForExistingStableKeys: true,
      heldRoutePolicy: "NT_INPATIENT remains held and is not referenced by an active path; inpatient path maps to NT_BILLING_ONLY.",
      createPayloads: withFieldIdPayloads("Classification Paths", newPaths.map(makePathCreatePayload), readback),
    },
    "Lab Panel Items": {
      tableId: readback.tables["Lab Panel Items"].tableId,
      fieldIdsByName: readback.tables["Lab Panel Items"].fieldIdsByName,
      operation: "create_if_absent_by_panelMasterKey+testMasterKey",
      expectedBefore: readback.tableCounts["Lab Panel Items"],
      expectedAfter: 60,
      updateExisting: 0,
      create: newPanelItems.length,
      preserveRecordIdsForExistingStableKeys: true,
      createPayloads: withFieldIdPayloads("Lab Panel Items", newPanelItems.map(makePanelItemCreatePayload), readback),
    },
    "Lab Order Profiles": {
      tableId: readback.tables["Lab Order Profiles"].tableId,
      fieldIdsByName: readback.tables["Lab Order Profiles"].fieldIdsByName,
      operation: "create_if_absent_by_orderMasterKey",
      expectedBefore: readback.tableCounts["Lab Order Profiles"],
      expectedAfter: 30,
      updateExisting: 0,
      create: newProfiles.length,
      preserveRecordIdsForExistingStableKeys: true,
      createPayloads: withFieldIdPayloads("Lab Order Profiles", newProfiles.map(makeProfileCreatePayload), readback),
    },
    "Diagnosis Category Links": {
      tableId: readback.tables["Diagnosis Category Links"].tableId,
      fieldIdsByName: readback.tables["Diagnosis Category Links"].fieldIdsByName,
      operation: "verify_existing_by_diagnosisMasterKey+categoryMasterKey",
      expectedBefore: readback.tableCounts["Diagnosis Category Links"],
      expectedAfter: 12,
      updateExisting: 0,
      create: 0,
      preserveRecordIdsForExistingStableKeys: true,
      diagnosisAuthoringOnly: true,
      createPayloads: [],
    },
  };
  const rollbackEntries = [
    ...newMasterRecords.map((item) => ({ tableName: "Master Records", stableKey: item.masterKey })),
    ...newNames.map((item) => ({ tableName: "Names", stableKey: item.masterKey })),
    ...newPaths.map((item) => ({ tableName: "Classification Paths", stableKey: String(item.pathKey) })),
    ...newPanelItems.map((item) => ({ tableName: "Lab Panel Items", stableKey: `${item.panelMasterKey}+${item.testMasterKey}` })),
    ...newProfiles.map((item) => ({ tableName: "Lab Order Profiles", stableKey: String(item.orderMasterKey) })),
  ].map((entry) => ({ ...entry, createdRecordId: null, rollbackStatus: "not_started" }));
  return {
    schemaVersion: "clinical-master-airtable-additive-write-manifest/v2",
    baseId: readback.baseId,
    releaseKey: RELEASE_KEY,
    sourceKey: SOURCE_KEY,
    writeAllowed: false,
    mutationsPerformed: 0,
    strategy: "Read-before-write exact stable-key create plan plus one audited identity fork; this package records executable payloads only and performs no mutation.",
    sourceOfTruth: {
      liveReadbackFixture: "tests/fixtures/clinical-master-airtable-operational-v3-current-readback.json",
      baselineSha256: readback.baselineSha256,
      readAt: readback.readAt,
      readOnlyAirtableCalls: 9,
      supabaseWrites: 0,
      airtableWrites: 0,
    },
    casBaselineGate: {
      baselineSha256: readback.baselineSha256,
      expectedTableCounts: clone(readback.tableCounts),
      failClosedOnHashOrCountMismatch: true,
      verification: "Re-read all scoped tables, hash the canonical readback, and compare every table count before any create/update call.",
    },
    identityPolicy: {
      stableKeys: ["masterKey", "sourceKey", "name", "pathKey", "panelMasterKey+testMasterKey", "orderMasterKey", "diagnosisMasterKey+categoryMasterKey"],
      preserveExistingAirtableRecordIds: true,
      stableKeyLinkResolution: "Resolve all stableLink tokens against the CAS readback first; existing IDs come only from that readback, new IDs come only from successful Airtable create responses.",
      legacyInitialIdentityFork: legacyInitialMutation,
      sourceRecord: {
        currentAirtableRecordId: currentSource.airtableRecordId,
        currentSourceKey: SOURCE_KEY,
        targetSourceKey: SOURCE_KEY,
        action: "no_update_required",
        reason: "Live source identity and descriptive fields already match the v3 synthetic boundary; do not remap the source primary key.",
      },
      releaseDraftRecord: {
        currentAirtableRecordId: currentRelease.airtableRecordId,
        action: "update_existing_by_record_id",
        reason: "Reuse the single existing Release Draft row while changing only release metadata to the v3 approved synthetic release.",
      },
    },
    releaseDraft: {
      tableId: readback.tables["Release Drafts"].tableId,
      airtableRecordId: currentRelease.airtableRecordId,
      beforeFields: clone(currentRelease.fields),
      beforeWritableFields: releaseBefore,
      afterFields: releaseAfter,
      updateOnlyFields: Object.keys(releaseAfter),
      rollbackRestore: {
        operation: "restore_existing_by_record_id_before_created_id_rollback",
        airtableRecordId: currentRelease.airtableRecordId,
        fields: releaseBefore,
        reason: "If the Release Draft update succeeds and a later create/verify step fails, restore the exact pre-update writable fields before reverting any created records.",
      },
    },
    semanticDiffAgainstLiveReadback: {
      comparedExistingMasterRows: 107,
      actionableFieldDifferences: 0,
      normalizedRepresentationDifferences: nullOmissionOnly.length,
      normalizationRule: "Airtable omits null-valued cells; omitted cells are equivalent to authoring null and are not written back.",
      nullOmissionOnly,
      stableKeyAndRecordIdPreservation: "106 current master rows remain byte/semantically unchanged; one audited legacy identity fork preserves the Master/Name record IDs while changing only the Master Records.masterKey from the legacy key to the fresh v3 key; 147 additive master/name rows and additive relation/path rows are planned.",
      auditedIdentityFork: legacyInitialMutation,
    },
    dependencyOrder: [
      "CAS baseline gate",
      "Sources verify by sourceKey",
      "CAS-and-semantic-readback identity fork for the legacy initial Airtable row",
      "Master Records create by masterKey",
      "Names create by masterKey",
      "Classification Paths create by pathKey",
      "Lab Panel Items create by panelMasterKey+testMasterKey",
      "Lab Order Profiles create by orderMasterKey",
      "Diagnosis Category Links verify by diagnosisMasterKey+categoryMasterKey",
      "Release Drafts update existing recordId after all creates and the identity fork verify",
    ],
    rollbackOrder: [
      "Restore Release Drafts by current recordId using releaseDraft.rollbackRestore.fields",
      "Restore the audited legacy initial Master Records identity fork by recordId",
      "Rollback created Lab Order Profiles by createdRecordId",
      "Rollback created Lab Panel Items by createdRecordId",
      "Rollback created Classification Paths by createdRecordId",
      "Rollback created Names by createdRecordId",
      "Rollback created Master Records by createdRecordId",
    ],
    tables,
    rollbackJournalTemplate: {
      mode: "created_id_only",
      rule: "Never delete by stable key alone. Populate createdRecordId only from a successful create response in this run; rollback only those IDs and leave all pre-existing IDs untouched.",
      entries: rollbackEntries,
    },
    expectedAirtableTableCounts: {
      "Release Drafts": 1,
      Sources: 1,
      "Master Records": 254,
      Names: 254,
      "Classification Paths": 13,
      "Lab Panel Items": 60,
      "Lab Order Profiles": 30,
      "Diagnosis Category Links": 12,
    },
    safetyChecks: {
      publisherPayloadHasNoCanonicalPricing: !JSON.stringify(adapterOutput.payload).toLowerCase().match(/(?:price|pricing|weight|orderset|order_set)/u),
      publisherPayloadHasNoWeightTier: true,
      publisherPayloadHasNoOrderSetFields: true,
      noClinicalClaimsDosingOrReferenceRanges: true,
      noRealHospitalOrPatientData: true,
      noAutomaticDeletionOfWorkspaceCustomRows: true,
      noOrderSetAuthoringInSlice: true,
    },
    nextAction: "Human-reviewed Airtable write only after this manifest, live readback hash, adapter payload, and focused validation are accepted.",
  };
}

function makeFinalDeltaManifest(readback: AirtableReadback) {
  const expectedTableCounts = {
    "Release Drafts": 1,
    Sources: 1,
    "Master Records": 254,
    Names: 254,
    "Classification Paths": 13,
    "Lab Panel Items": 60,
    "Lab Order Profiles": 30,
    "Diagnosis Category Links": 12,
  };
  if (JSON.stringify(readback.tableCounts) !== JSON.stringify(expectedTableCounts)) {
    throw new Error(`Final Airtable readback count gate failed: ${JSON.stringify(readback.tableCounts)}`);
  }
  const currentRow = readback.tables["Master Records"].records.find((row) => row.airtableRecordId === AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId);
  const freshRow = readback.tables["Master Records"].records.find((row) => String(row.fields.masterKey) === AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey);
  const linkedNameRow = readback.tables.Names.records.find((row) => {
    const links = row.fields.masterKey;
    return Array.isArray(links) && links.some((link) => Boolean(link && typeof link === "object" && "id" in link && String((link as JsonObject).id) === AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId));
  });
  if (!currentRow || String(currentRow.fields.masterKey) !== AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey || freshRow) {
    throw new Error("Final Airtable readback must contain the legacy identity row and no fresh consultation key before the audited fork.");
  }
  if (!linkedNameRow || linkedNameRow.airtableRecordId !== AIRTABLE_INITIAL_KEY_MIGRATION.linkedNameRecordId) {
    throw new Error("Final Airtable readback must preserve the linked preferred Name record ID for the audited fork.");
  }
  const linkedNameFieldId = readback.tables.Names.fieldIdsByName.masterKey;
  if (!linkedNameFieldId) throw new Error("Final Airtable readback is missing Names.masterKey lookup field ID.");
  const beforeLookup = linkedNameRow.fields.masterKey;
  if (!Array.isArray(beforeLookup)
      || beforeLookup.length !== 1
      || !beforeLookup[0]
      || typeof beforeLookup[0] !== "object"
      || String((beforeLookup[0] as JsonObject).id) !== AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId
      || String((beforeLookup[0] as JsonObject).name) !== AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey) {
    throw new Error("Final Airtable readback must contain exactly the expected legacy Master Records lookup on rec0Pw4CymPIed8ta.");
  }
  const masterKeyFieldId = readback.tables["Master Records"].fieldIdsByName.masterKey;
  if (!masterKeyFieldId) throw new Error("Final Airtable readback is missing Master Records.masterKey field ID.");
  const canonicalSort = (value: unknown): unknown => Array.isArray(value)
    ? value.map(canonicalSort)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value as JsonObject).sort().map((key) => [key, canonicalSort((value as JsonObject)[key])]))
      : value;
  const tableSha256 = (table: AirtableReadback["tables"][string]) => sha256(JSON.stringify(canonicalSort({
    ...table,
    records: table.records.slice().sort((left, right) => left.airtableRecordId.localeCompare(right.airtableRecordId)),
  })));
  const fullReadbackSha256 = (value: AirtableReadback) => {
    const withoutHash = clone(value) as JsonObject;
    delete withoutHash.baselineSha256;
    return sha256(JSON.stringify(canonicalSort(withoutHash)));
  };
  const expectedBeforeSha256 = Object.fromEntries(Object.entries(readback.tables).map(([tableName, table]) => [tableName, tableSha256(table)]));
  const expectedPostReadback = clone(readback);
  const expectedPostMaster = expectedPostReadback.tables["Master Records"].records.find((row) => row.airtableRecordId === AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId);
  const expectedPostName = expectedPostReadback.tables.Names.records.find((row) => row.airtableRecordId === AIRTABLE_INITIAL_KEY_MIGRATION.linkedNameRecordId);
  if (!expectedPostMaster || !expectedPostName) throw new Error("Final Airtable delta post-state clone could not resolve the audited identity rows.");
  expectedPostMaster.fields.masterKey = AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey;
  expectedPostName.fields.masterKey = [{ id: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId, name: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey }];
  const expectedPostSha256 = Object.fromEntries(Object.entries(expectedPostReadback.tables).map(([tableName, table]) => [tableName, tableSha256(table)]));
  const expectedPostFullReadbackSha256 = fullReadbackSha256(expectedPostReadback);
  const identityFork = {
    operation: "update_existing_by_record_id_identity_fork",
    tableName: "Master Records",
    recordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId,
    currentMasterKey: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey,
    newMasterKey: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey,
    fields: { masterKey: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey },
    fieldsByFieldId: { [masterKeyFieldId]: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey },
    preserveLinkedNameRecordId: AIRTABLE_INITIAL_KEY_MIGRATION.linkedNameRecordId,
    linkedNameLookup: {
      tableName: "Names",
      recordId: AIRTABLE_INITIAL_KEY_MIGRATION.linkedNameRecordId,
      fieldId: linkedNameFieldId,
      before: [{ id: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId, name: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey }],
      after: [{ id: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId, name: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey }],
      operation: "formula/lookup must recalculate from the Master Records identity fork; no separate Names write",
    },
    cas: {
      before: { recordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId, masterKey: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey },
      requireExactFinalReadbackHashAndIdentity: true,
      expectedBeforeSha256,
      expectedPostSha256,
      expectedPostFullReadbackSha256,
      after: { recordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId, masterKey: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey },
    },
    rollbackRestore: {
      recordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId,
      fields: { masterKey: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey },
      order: "restore this identity fork before any later rollback step",
    },
  };
  const noOpTable = (tableName: string) => ({
    tableId: readback.tables[tableName].tableId,
    fieldIdsByName: readback.tables[tableName].fieldIdsByName,
    operation: "verify_existing_final_readback",
    expectedBefore: expectedTableCounts[tableName as keyof typeof expectedTableCounts],
    expectedAfter: expectedTableCounts[tableName as keyof typeof expectedTableCounts],
    updateExisting: 0,
    create: 0,
    preserveRecordIdsForExistingStableKeys: true,
    createPayloads: [],
    updatePayloads: [],
  });
  return {
    schemaVersion: "clinical-master-airtable-final-delta-manifest/v1",
    baseId: readback.baseId,
    releaseKey: RELEASE_KEY,
    sourceKey: SOURCE_KEY,
    writeAllowed: false,
    mutationsPerformed: 0,
    executable: false,
    operationMode: "final_state_delta_identity_fork_only",
    strategy: "Use the current final 254/254/13/60/30/12 readback as the CAS baseline. The only planned mutation is the audited Master Records identity fork for recZW92s9i06wpNp0; the linked Names lookup must recalculate to the fresh key, with no separate Names write and no other table mutation.",
    executionEligibility: {
      eligible: false,
      status: "deferred_until_exact_before_after_gates",
      enableOnlyAfter: [
        "Read all eight scoped tables and require the exact baselineSha256 plus expectedBeforeSha256 map and table counts.",
        "Require recZW92s9i06wpNp0 to have the legacy key and rec0Pw4CymPIed8ta to have exactly the legacy linked lookup.",
        "Update only Master Records recZW92s9i06wpNp0 by record ID; never write Names, Sources, Release Drafts, or relation tables.",
        "Re-read all eight tables and require expectedPostSha256, expectedPostFullReadbackSha256, exact counts, fresh key exactly once, and linked Name ID/name exact.",
      ],
      blockedReason: "No Airtable write is authorized in this handoff; writeAllowed remains false until a separately approved execution re-runs every gate.",
    },
    expectedBeforeSha256,
    expectedPostSha256,
    expectedPostFullReadbackSha256,
    semanticDelta: {
      changedCells: [
        { tableName: "Master Records", recordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId, field: "masterKey", before: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey, after: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey },
        { tableName: "Names", recordId: AIRTABLE_INITIAL_KEY_MIGRATION.linkedNameRecordId, field: "masterKey.lookup.name", before: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey, after: AIRTABLE_INITIAL_KEY_MIGRATION.newMasterKey, source: "linked lookup recalculation", writable: false },
      ],
      unchangedTableNames: ["Release Drafts", "Sources", "Classification Paths", "Lab Panel Items", "Lab Order Profiles", "Diagnosis Category Links"],
      unchangedRecordPolicy: "Every other record and field must remain byte/semantic identical to the final readback; expectedPostSha256 and expectedPostFullReadbackSha256 are the gate.",
    },
    rollbackGate: {
      restoreRecordId: AIRTABLE_INITIAL_KEY_MIGRATION.airtableRecordId,
      restoreMasterKey: AIRTABLE_INITIAL_KEY_MIGRATION.currentMasterKey,
      expectedRestoredTableSha256: expectedBeforeSha256,
      expectedRestoredFullReadbackSha256: readback.baselineSha256,
      requireExactEightTableCounts: expectedTableCounts,
    },
    sourceOfTruth: {
      liveReadbackFixture: "tests/fixtures/clinical-master-airtable-operational-v3-final-readback.json",
      baselineSha256: readback.baselineSha256,
      readAt: readback.readAt,
      mutationScope: readback.mutationScope,
      readOnlyAirtableCalls: 8,
      supabaseWrites: 0,
      airtableWrites: 0,
      expectedTableCounts,
    },
    casBaselineGate: {
      baselineSha256: readback.baselineSha256,
      expectedTableCounts,
      failClosedOnHashOrCountMismatch: true,
      identity: { recordId: identityFork.recordId, currentMasterKey: identityFork.currentMasterKey, linkedNameRecordId: identityFork.preserveLinkedNameRecordId },
      expectedBeforeSha256,
      expectedPostSha256,
      expectedPostFullReadbackSha256,
      linkedNameBefore: [{ id: identityFork.recordId, name: identityFork.currentMasterKey }],
      linkedNameAfter: [{ id: identityFork.recordId, name: identityFork.newMasterKey }],
      verification: "Re-read all eight scoped tables, compare the full canonical final-readback hash, per-table expectedBeforeSha256, and exact counts, then compare recZW92s9i06wpNp0 plus its linked Name before the single update call; after the call require per-table expectedPostSha256 and full post hash.",
    },
    identityPolicy: {
      stableKeys: ["masterKey", "sourceKey", "name", "pathKey", "panelMasterKey+testMasterKey", "orderMasterKey", "diagnosisMasterKey+categoryMasterKey"],
      preserveExistingAirtableRecordIds: true,
      sourceRecord: { action: "no_update", sourceKey: SOURCE_KEY, recordId: String(readback.sourceIdentity.airtableRecordId) },
      releaseDraftRecord: { action: "no_update", recordId: readback.tables["Release Drafts"].records[0]?.airtableRecordId, releaseKey: RELEASE_KEY, status: "approved" },
      auditedIdentityFork: identityFork,
    },
    tables: {
      "Release Drafts": noOpTable("Release Drafts"),
      Sources: noOpTable("Sources"),
      "Master Records": {
        ...noOpTable("Master Records"),
        operation: "update_existing_by_record_id_identity_fork_only",
        updateExisting: 1,
        updatePayloads: [identityFork],
      },
      Names: noOpTable("Names"),
      "Classification Paths": noOpTable("Classification Paths"),
      "Lab Panel Items": noOpTable("Lab Panel Items"),
      "Lab Order Profiles": noOpTable("Lab Order Profiles"),
      "Diagnosis Category Links": noOpTable("Diagnosis Category Links"),
    },
    dependencyOrder: [
      "CAS final-readback hash/count gate",
      "CAS identity check for recZW92s9i06wpNp0 and linked Name rec0Pw4CymPIed8ta",
      "Update only Master Records.masterKey by record ID",
      "Re-read all eight tables and require exact final counts plus fresh key exactly once",
    ],
    rollbackOrder: ["Restore Master Records recZW92s9i06wpNp0.masterKey to cm.order.consult.initial by record ID"],
    rollbackJournalTemplate: {
      mode: "record_id_only",
      entries: [{ tableName: "Master Records", recordId: identityFork.recordId, priorMasterKey: identityFork.currentMasterKey, createdRecordId: null, rollbackStatus: "not_started" }],
    },
    historicalEvidence: {
      additiveManifest: "tests/fixtures/clinical-master-operational-v3-airtable-write-manifest.json",
      note: "The earlier 107-to-254 additive create plan remains historical evidence only and is not executable from this final-state delta manifest.",
    },
    safetyChecks: {
      noCreatePayloads: true,
      noUnknownGeneratedRecordIds: true,
      noSourcePrimaryKeyRemap: true,
      noReleaseDraftMutation: true,
      noAirtableWritesPerformed: true,
    },
  };
}

function canonicalJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function writeOrCheck(path: string, value: unknown, checkOnly: boolean) {
  const output = canonicalJson(value);
  if (checkOnly) {
    const current = readFileSync(path, "utf8");
    if (current !== output) throw new Error(`Generated fixture drift: ${path}`);
  } else {
    writeFileSync(path, output, "utf8");
  }
  return { bytes: Buffer.byteLength(output), sha256: sha256(output) };
}

const { fixture, orders } = makeFixture();
const adapter = adaptClinicalMasterAirtableAuthoringExport(fixture as never);
const adapterOutput = { payload: adapter.payload, excluded: adapter.excluded };
const pricingAdoption = makePricingAdoptionFixture(orders);
const labSemantics = makeLabSemanticsFixture();
const readback = JSON.parse(readFileSync(READBACK_PATH, "utf8")) as AirtableReadback;
const finalReadback = JSON.parse(readFileSync(FINAL_READBACK_PATH, "utf8")) as AirtableReadback;
const writeManifest = makeWriteManifest(fixture, adapterOutput, readback);
const deltaManifest = makeFinalDeltaManifest(finalReadback);
const checkOnly = process.argv.includes("--check");

const hashes = {
  authoring: writeOrCheck(AUTHORING_PATH, fixture, checkOnly),
  adapter: writeOrCheck(ADAPTER_PATH, adapterOutput, checkOnly),
  pricingAdoption: writeOrCheck(PRICING_PATH, pricingAdoption, checkOnly),
  labSemantics: writeOrCheck(LAB_SEMANTICS_PATH, labSemantics, checkOnly),
  writeManifest: writeOrCheck(MANIFEST_PATH, writeManifest, checkOnly),
  finalReadback: { bytes: Buffer.byteLength(readFileSync(FINAL_READBACK_PATH, "utf8")), sha256: sha256(readFileSync(FINAL_READBACK_PATH, "utf8")) },
  deltaManifest: writeOrCheck(DELTA_MANIFEST_PATH, deltaManifest, checkOnly),
};

const counts = {
  authoringRecords: fixture.records.length,
  supportedRecords: adapter.payload.records.length,
  diagnosisRecordsExcluded: adapter.excluded.recordCount,
  orders: orders.length,
  labTests: fixture.records.filter((item) => item.recordType === "lab_test").length,
  labPanels: fixture.records.filter((item) => item.recordType === "lab_panel").length,
  classificationPaths: fixture.classificationPaths.length,
  labPanelItems: fixture.labPanelItems.length,
  labOrderProfiles: fixture.labOrderProfiles.length,
  diagnosisCategoryLinks: fixture.diagnosisCategoryLinks.length,
  names: fixture.records.length,
};
if (counts.authoringRecords !== 254 || counts.supportedRecords !== 230 || counts.orders !== 120 || counts.labTests !== 36 || counts.labPanels !== 10 || counts.classificationPaths !== 13 || counts.labPanelItems !== 60 || counts.labOrderProfiles !== 30 || counts.diagnosisCategoryLinks !== 12) {
  throw new Error(`Operational v3 count gate failed: ${JSON.stringify(counts)}`);
}
if (JSON.stringify(adapter.payload).toLowerCase().match(/(?:price|pricing|weight|orderset|order_set)/u)) {
  throw new Error("Publisher payload contains a forbidden workspace pricing key.");
}
const actualCategoryCounts = orders.reduce<Record<string, number>>((counts, row) => {
  counts[row.researchCategory] = (counts[row.researchCategory] ?? 0) + 1;
  return counts;
}, {});
if (Object.keys(categoryCounts).some((key) => actualCategoryCounts[key] !== categoryCounts[key]) || Object.keys(actualCategoryCounts).some((key) => !(key in categoryCounts))) {
  throw new Error(`Operational category count gate failed: ${JSON.stringify(actualCategoryCounts)}`);
}
if (Object.values(actualCategoryCounts).reduce((sum, count) => sum + count, 0) !== 120) {
  throw new Error("Operational category count gate failed.");
}
const pricedKeys = new Set(orders.map((row) => row.masterKey));
const pricedValues = new Set(orders.map((row) => row.syntheticWorkspacePriceKrw));
const totalSyntheticWorkspacePriceKrw = orders.reduce((total, row) => total + row.syntheticWorkspacePriceKrw, 0);
if (pricedKeys.size !== 120 || pricedValues.size !== 120 || orders.some((row) => !Number.isInteger(row.syntheticWorkspacePriceKrw) || row.syntheticWorkspacePriceKrw <= 0)) {
  throw new Error("Workspace pricing fixture must contain one positive integer KRW price per order.");
}
if (totalSyntheticWorkspacePriceKrw !== 5529073 || pricingAdoption.totalSyntheticWorkspacePriceKrw !== totalSyntheticWorkspacePriceKrw) {
  throw new Error(`Workspace pricing total gate failed: ${totalSyntheticWorkspacePriceKrw}`);
}
if (orders.some((row) => !categoryCounts[row.researchCategory])) {
  throw new Error("Workspace pricing fixture contains an unknown order category.");
}
for (const row of orders) {
  if (row.syntheticWorkspacePriceKrw !== row.categoryPriceBase + row.categoryPriceSerial || row.categoryPriceBase !== priceBases[row.researchCategory]) {
    throw new Error(`Workspace pricing category base/serial gate failed for ${row.masterKey}`);
  }
}
const inpatientRows = orders.filter((row) => row.researchCategory === "inpatient");
if (inpatientRows.length !== 6 || inpatientRows.some((row) => row.masterRouteCode !== "NT_BILLING_ONLY" || row.heldSourceRouteCode !== "NT_INPATIENT" || row.workspaceDestinationModule !== "billing_only")) {
  throw new Error("Inpatient adoption route must map the held NT_INPATIENT source route to NT_BILLING_ONLY billing_only.");
}
const foreignPolicy = pricingAdoption.adoptionPolicy.foreignWorkspacePolicy as JsonObject;
if (foreignPolicy.policy !== "read_only_pre_post_fingerprint_no_write" || foreignPolicy.noWrite !== true || "expectedCatalogRowCount" in foreignPolicy) {
  throw new Error("Foreign workspace policy must be a read-only pre/post fingerprint negative control without an asserted row count.");
}
const normalizeOperationalName = (value: string) => value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/gu, "");
const knownCentralNaturalKeys = {
  chartGroup: "phase1a2.fallback.chart.CG_INPATIENT",
  billingRoute: "phase1a2.fallback.route.NT_BILLING_ONLY",
};
const validChartCodes = new Set(["CG_CONSULTATION", "CG_PREVENTION", "CG_EXAM", "CG_PROCEDURE", "CG_SURGERY", "CG_INPATIENT", "CG_THERAPY", "CG_MEDICATION_SUPPLY"]);
const chartRows = fixture.records.filter((item) => item.recordType === "chart_group");
if (chartRows.some((item) => !validChartCodes.has(String(item.detail.groupCode))) || chartRows.length !== 8) {
  throw new Error("Authoring chart groups must use the DB-valid chart code allowlist and exact eight-row total.");
}
const pathChartGroups = new Map(fixture.classificationPaths.map((path) => [String(path.pathKey), String(path.chartGroupKey)]));
const expectedPathChartGroups: Record<string, string> = {
  "cm.path.preventive-consultation": "cm.chart.prevention",
  "cm.path.preventive-treatment": "cm.chart.prevention",
  "cm.path.surgery-anesthesia": "cm.chart.surgery",
  "cm.path.inpatient": "phase1a2.fallback.chart.CG_INPATIENT",
  "cm.path.emergency": "phase1a2.fallback.chart.CG_EXAM",
  "cm.path.dental": "phase1a2.fallback.chart.CG_PROCEDURE",
  "cm.path.certificate": "phase1a2.fallback.chart.CG_CONSULTATION",
  "cm.path.dispensing-billing": "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY",
};
for (const [pathKey, chartKey] of Object.entries(expectedPathChartGroups)) {
  if (pathChartGroups.get(pathKey) !== chartKey) throw new Error(`Chart mapping mismatch for ${pathKey}`);
}
const pathByKey = new Map(fixture.classificationPaths.map((path) => [String(path.pathKey), path]));
for (const pathKey of ["cm.path.inpatient", "cm.path.emergency", "cm.path.certificate", "cm.path.dispensing-billing"]) {
  if (pathByKey.get(pathKey)?.taskRouteKey !== knownCentralNaturalKeys.billingRoute) throw new Error(`Billing route mapping mismatch for ${pathKey}`);
}
const unitsByCode = new Set(fixture.records.filter((item) => item.recordType === "unit").map((item) => String(item.detail.unitCode)));
const specimensByCode = new Set(fixture.records.filter((item) => item.recordType === "specimen_type").map((item) => String(item.detail.specimenCode)));
const recordsByMasterKey = new Map(fixture.records.map((item) => [item.masterKey, item]));
if (!unitsByCode.has("mmol_l") || !unitsByCode.has("seconds") || !unitsByCode.has("million_per_ul") || !specimensByCode.has("cytology_slide") || !specimensByCode.has("swab") || !specimensByCode.has("joint_fluid") || !specimensByCode.has("citrate_plasma")) {
  throw new Error("Required lab unit/specimen support rows are missing.");
}
if (![...KNOWN_CENTRAL_BASELINE_KEYS].every((key) => recordsByMasterKey.has(key)) || !recordsByMasterKey.has(knownCentralNaturalKeys.chartGroup) || !recordsByMasterKey.has(knownCentralNaturalKeys.billingRoute) || recordsByMasterKey.has("cm.chart.inpatient") || recordsByMasterKey.has("cm.route.billing-only")) {
  throw new Error("Central natural-key collision guard failed: use the existing fallback inpatient chart/billing route keys.");
}
for (const labTest of newLabTests) {
  const detail = recordsByMasterKey.get(labTest.masterKey)?.detail;
  if (!detail || detail.testCode !== labTest.testCode || detail.resultInputTypeKey !== labTest.resultInputTypeKey || detail.canonicalUnitKey !== labTest.canonicalUnitKey || (labTest.decimalScale !== undefined && detail.decimalScale !== labTest.decimalScale)) {
    throw new Error(`Explicit lab semantic mapping mismatch for ${labTest.masterKey}`);
  }
}
if (fixture.labPanelItems.filter((item) => String(item.panelMasterKey).startsWith("cm.lab-panel.synthetic-")).length !== 47 || fixture.labOrderProfiles.filter((item) => String(item.orderMasterKey).startsWith("cm.order.synthetic.lab-")).length !== 13) {
  throw new Error("Explicit lab additive relation counts must be 47 links and 13 profiles.");
}
const panelLinkCounts = newLabPanelLinks.map((panel) => panel.testMasterKeys.length);
if (JSON.stringify(panelLinkCounts) !== JSON.stringify([7, 2, 8, 8, 8, 14])) {
  throw new Error(`Explicit lab panel partition drifted: ${JSON.stringify(panelLinkCounts)}`);
}
const forbiddenChemistryPanelMembers = new Set([
  "cm.lab-test.synthetic-13", "cm.lab-test.synthetic-14", "cm.lab-test.synthetic-15", "cm.lab-test.synthetic-16", "cm.lab-test.synthetic-23",
  "cm.lab-test.fecal-microscopy", "cm.lab-test.giardia-antigen", "cm.lab-test.ua-sediment", "cm.lab-test.ua-strip",
]);
if (newLabPanelLinks.some((panel) => panel.testMasterKeys.some((testKey) => forbiddenChemistryPanelMembers.has(testKey)))) {
  throw new Error("Chemistry panel semantics must not contain hematology, urinalysis, fecal, or blood-type filler.");
}
if (newLabProfiles.find((profile) => profile.orderMasterKey === "cm.order.synthetic.lab-02")?.specimenMasterKey !== "cm.specimen.citrate-plasma" || newLabProfiles.find((profile) => profile.orderMasterKey === "cm.order.synthetic.lab-03")?.specimenMasterKey !== "cm.specimen.serum") {
  throw new Error("Coagulation/pre-op profile specimen semantics drifted.");
}
const normalizedLabNames = new Set<string>();
for (const item of fixture.records.filter((record) => record.recordType === "lab_test" && record.masterKey.startsWith("cm.lab-test.synthetic-"))) {
  const normalized = normalizeOperationalName(String(item.names[0]?.name ?? ""));
  if (normalizedLabNames.has(normalized)) throw new Error(`Synthetic lab test semantic name collision: ${item.masterKey}`);
  normalizedLabNames.add(normalized);
}
const normalizedPanelNames = new Set<string>();
for (const item of fixture.records.filter((record) => record.recordType === "lab_panel" && record.masterKey.startsWith("cm.lab-panel.synthetic-"))) {
  const normalized = normalizeOperationalName(String(item.names[0]?.name ?? ""));
  if (normalizedPanelNames.has(normalized)) throw new Error(`Synthetic lab panel semantic name collision: ${item.masterKey}`);
  normalizedPanelNames.add(normalized);
}
if (writeManifest.writeAllowed !== false || writeManifest.mutationsPerformed !== 0 || writeManifest.tables["Master Records"].create !== 147 || writeManifest.tables.Names.create !== 147 || writeManifest.tables["Classification Paths"].create !== 8 || writeManifest.tables["Lab Panel Items"].create !== 47 || writeManifest.tables["Lab Order Profiles"].create !== 13 || writeManifest.tables["Master Records"].updateExisting !== 1) {
  throw new Error("Airtable manifest must remain additive, write-disabled, and exact-count.");
}
if (writeManifest.tables["Master Records"].createPayloads.length !== 147 || writeManifest.tables.Names.createPayloads.length !== 147 || writeManifest.tables["Classification Paths"].createPayloads.length !== 8 || writeManifest.tables["Lab Panel Items"].createPayloads.length !== 47 || writeManifest.tables["Lab Order Profiles"].createPayloads.length !== 13) {
  throw new Error("Airtable manifest create payload arrays do not match additive counts.");
}
const manifestCreatePayloads = [
  ...writeManifest.tables["Master Records"].createPayloads,
  ...writeManifest.tables.Names.createPayloads,
  ...writeManifest.tables["Classification Paths"].createPayloads,
  ...writeManifest.tables["Lab Panel Items"].createPayloads,
  ...writeManifest.tables["Lab Order Profiles"].createPayloads,
] as JsonObject[];
const nonWritableFieldIds = nonWritableAirtableFieldIds(readback);
if (!nonWritableFieldIds.has("fld8GNoJTzlAYtGnF") || !nonWritableFieldIds.has("fld1KwiL9b4ipNtyX")) {
  throw new Error("Expected Lab Panel Items/Profile formula rowLabel field IDs are missing from the readback guard.");
}
if (manifestCreatePayloads.some((payload) => Object.keys((payload.fieldsByFieldId ?? {}) as JsonObject).some((fieldId) => nonWritableFieldIds.has(fieldId)))) {
  throw new Error("Airtable create payload contains a formula/display-only field ID.");
}
if (manifestCreatePayloads.some((payload) => Object.values((payload.fieldsByFieldId ?? {}) as JsonObject).some((value) => value === null || value === undefined))) {
  throw new Error("Airtable create payload contains a null/undefined writable field.");
}
if (JSON.stringify(writeManifest.rollbackOrder) !== JSON.stringify([
  "Restore Release Drafts by current recordId using releaseDraft.rollbackRestore.fields",
  "Restore the audited legacy initial Master Records identity fork by recordId",
  "Rollback created Lab Order Profiles by createdRecordId",
  "Rollback created Lab Panel Items by createdRecordId",
  "Rollback created Classification Paths by createdRecordId",
  "Rollback created Names by createdRecordId",
  "Rollback created Master Records by createdRecordId",
]) || writeManifest.releaseDraft.rollbackRestore.fields.status !== "approved") {
  throw new Error("Airtable rollback must restore the prior Release Draft before reverting created records.");
}
if ((writeManifest.rollbackJournalTemplate.entries as JsonObject[]).some((entry) => entry.createdRecordId !== null)) {
  throw new Error("Airtable rollback journal may contain only null created IDs before a write run.");
}
const currentLiveKeys = new Set(readback.tables["Master Records"].records.map((row) => String(row.fields.masterKey)));
const v3OrderKeys = new Set(orders.map((row) => row.masterKey));
if (v3OrderKeys.has(LEGACY_INITIAL_MASTER_KEY) || !v3OrderKeys.has(V3_INITIAL_MASTER_KEY) || fixture.records.some((item) => item.masterKey === LEGACY_INITIAL_MASTER_KEY)) {
  throw new Error("The legacy consultation key must remain outside the v3 authoring/pricing payload; the fresh first-visit key is required.");
}
if (writeManifest.tables["Master Records"].updatePayloads?.length !== 1 || writeManifest.identityPolicy.legacyInitialIdentityFork.currentMasterKey !== LEGACY_INITIAL_MASTER_KEY || writeManifest.identityPolicy.legacyInitialIdentityFork.newMasterKey !== V3_INITIAL_MASTER_KEY) {
  throw new Error("The Airtable legacy consultation identity fork must contain exactly one audited record-id mutation.");
}
for (const item of fixture.records) {
  const mappedExisting = item.masterKey === V3_INITIAL_MASTER_KEY && currentLiveKeys.has(LEGACY_INITIAL_MASTER_KEY);
  if (currentLiveKeys.has(item.masterKey) && item.changeSummary !== AUTHORING_FIELDS.changeSummary) throw new Error(`Existing live row metadata changed: ${item.masterKey}`);
  if (!mappedExisting && !currentLiveKeys.has(item.masterKey) && item.changeSummary !== ADDITION_AUTHORING_FIELDS.changeSummary) throw new Error(`New row v3 provenance missing: ${item.masterKey}`);
}
const genericOperationalName = /^합성 .*오더 \d+$|^합성 검사 \d+$|^합성 패널 \d+$/u;
if (fixture.records.some((record) => record.names.some((name) => genericOperationalName.test(String(name.name))))) {
  throw new Error("Operational names must be concrete hospital-style draft labels, not generic synthetic counters.");
}
const orderNameRows = fixture.records.filter((record) => record.recordType === "order").map((record) => ({ masterKey: record.masterKey, name: String(record.names[0]?.name ?? "") }));
const normalizedOrderNames = new Map<string, string>();
for (const row of orderNameRows) {
  const normalized = normalizeOperationalName(row.name);
  if (normalizedOrderNames.has(normalized)) throw new Error(`Operational order name collision: ${row.masterKey} duplicates ${normalizedOrderNames.get(normalized)}`);
  normalizedOrderNames.set(normalized, row.masterKey);
}
const semanticCollisionDenylist = new Set([
  "귀세정처치", "복부초음파추가", "흉부방사선추가", "복부방사선추가", "경구액조제수납", "안약조제수납", "귀약조제수납", "분말조제수납", "정제분할조제수납", "조제용소모품수납", "처방봉투라벨수납", "강아지예방접종추가", "고양이예방접종추가", "건강검진상담",
]);
const deniedSyntheticNames = orderNameRows.filter((row) => row.masterKey.startsWith("cm.order.synthetic.") && semanticCollisionDenylist.has(normalizeOperationalName(row.name)));
if (deniedSyntheticNames.length > 0) throw new Error(`Operational semantic collision denylist hit: ${deniedSyntheticNames.map((row) => row.masterKey).join(", ")}`);

process.stdout.write(`${JSON.stringify({ checkOnly, counts, hashes }, null, 2)}\n`);
