#!/usr/bin/env node

/**
 * Build the deterministic, local-only Clinical Master operational V4 package.
 *
 * V4 preserves the reviewed V3 fixture byte-for-byte at row level and adds:
 * - 280 atomic orders for an exact total of 400
 * - 36 lab tests, 8 panels, 60 panel links, and 55 order profiles
 * - workspace-owned synthetic pricing/adoption metadata
 * - a write-disabled Airtable additive manifest
 * - 20 Order Set templates and 60 workspace create-operation templates
 *
 * This script never contacts Airtable, Supabase, or an application API.
 *
 * Usage (Node 23+):
 *   node --experimental-strip-types scripts/generate-clinical-master-operational-v4.ts
 *   node --experimental-strip-types scripts/generate-clinical-master-operational-v4.ts --check
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
  names: Array<{ languageCode: string; nameKind: string; name: string; searchable: boolean; sortOrder: number }>;
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
type Species = "cat" | "dog";
type OrderCategory = keyof typeof targetCategoryCounts;
type NewOrderSeed = {
  masterKey: string;
  name: string;
  category: OrderCategory;
  classificationPathKey: string;
  itemType: string;
  species: Species[];
};
type LabTestSeed = {
  masterKey: string;
  name: string;
  testCode: string;
  resultInputTypeKey: string;
  canonicalUnitKey: string | null;
  decimalScale?: number;
  specimenMasterKey: string;
};
type LabProfileSeed = {
  orderMasterKey: string;
  orderName: string;
  labTestMasterKey: string | null;
  labPanelMasterKey: string | null;
  specimenMasterKey: string;
};

const ROOT = resolve(process.cwd());
const FIXTURE_DIR = resolve(ROOT, "tests/fixtures");
const V3_AUTHORING_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v3-authoring.json");
const V3_PRICING_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v3-pricing-adoption.json");
const V3_FINAL_READBACK_PATH = resolve(FIXTURE_DIR, "clinical-master-airtable-operational-v3-final-readback.json");
const AUTHORING_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v4-authoring.json");
const ADAPTER_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v4-adapter-output.json");
const PRICING_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v4-pricing-adoption.json");
const LAB_SEMANTICS_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v4-lab-semantics.json");
const AIRTABLE_MANIFEST_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v4-airtable-write-manifest.json");
const ORDER_SET_MANIFEST_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v4-order-set-manifest.json");
const PACKAGE_MANIFEST_PATH = resolve(FIXTURE_DIR, "clinical-master-operational-v4-package-manifest.json");

const RELEASE_KEY = "cm.release.airtable.operational-master.v4";
const SOURCE_KEY = "source.synthetic.operational-pilot.v1";
const LEGACY_INITIAL_MASTER_KEY = "cm.order.consult.initial";
const OPERATIONAL_INITIAL_MASTER_KEY = "cm.order.consult.first-visit";
const TARGET_WORKSPACE_IDS = [
  "workspace-clinical-master-pilot-v1",
  "workspace-clair-cheongdam",
  "clair-demo",
] as const;
const EXCLUDED_WORKSPACE_ID = "clair-foreign-demo";

const V4_AUTHORING_FIELDS = {
  authoringStatus: "approved",
  lifecycleStatus: "published",
  safetyStatus: "normal",
  safetyReason: null,
  changeSummary: "synthetic operational master v4 addition",
  sourceAssertionScope: "synthetic sales-demo system-flow testing only; no clinical authority",
  sourceNotes: "synthetic v4 additive operational draft; terminology scope checked against official veterinary workflow references",
  sourceKey: SOURCE_KEY,
};

const targetCategoryCounts = {
  consultation: 28,
  preventive: 26,
  lab: 85,
  imaging: 30,
  treatment: 45,
  dispensing: 53,
  "surgery/anesthesia": 42,
  inpatient: 30,
  emergency: 24,
  dental: 24,
  "certificate/misc": 13,
} as const;

const expectedAddedCategoryCounts: Record<OrderCategory, number> = {
  consultation: 16,
  preventive: 14,
  lab: 55,
  imaging: 18,
  treatment: 27,
  dispensing: 37,
  "surgery/anesthesia": 34,
  inpatient: 24,
  emergency: 21,
  dental: 22,
  "certificate/misc": 12,
};

const v4AddedCategoryPriceBases: Record<OrderCategory, number> = {
  consultation: 28000,
  preventive: 32000,
  lab: 36000,
  imaging: 50000,
  treatment: 60000,
  dispensing: 70000,
  "surgery/anesthesia": 100000,
  inpatient: 120000,
  emergency: 150000,
  dental: 180000,
  "certificate/misc": 200000,
};

const categoryConfig: Record<Exclude<OrderCategory, "lab">, { path: string; itemType: string; names: string[] }> = {
  consultation: {
    path: "cm.path.consultation",
    itemType: "consultation",
    names: [
      "건강검진 결과 상담", "검사 결과 상담", "수술 전 상담", "수술 후 경과 상담",
      "마취 위험도 상담", "만성질환 관리 상담", "체중 관리 상담", "치과 상담",
      "피부·귀 상담", "행동문제 초진 상담", "응급 퇴원 상담", "입원 경과 상담",
      "완화의료 상담", "해외이동 준비 상담", "다묘가정 건강관리 상담", "신규 입양 건강상담",
    ],
  },
  preventive: {
    path: "cm.path.preventive-consultation",
    itemType: "treatment",
    names: [
      "개 기초 건강검진", "고양이 기초 건강검진", "성견 정기 건강검진", "성묘 정기 건강검진",
      "노령견 종합 건강검진", "노령묘 종합 건강검진", "예방접종 이력 확인", "항체가 검사 상담",
      "심장사상충 예방관리", "진드기 매개질환 예방상담", "구강 건강 예방관리", "체중·영양 예방관리",
      "중성화 전 건강평가", "해외출국 예방관리",
    ],
  },
  imaging: {
    path: "cm.path.imaging",
    itemType: "imaging",
    names: [
      "흉부 방사선 정면 검사", "흉부 방사선 측면 검사", "복부 방사선 정면 검사", "복부 방사선 측면 검사",
      "두개골 방사선 검사", "슬관절 방사선 검사", "고관절 방사선 검사", "견관절 방사선 검사",
      "주관절 방사선 검사", "수근관절 방사선 검사", "족근관절 방사선 검사", "비강 방사선 검사",
      "방광 초음파 검사", "신장 초음파 검사", "간담도 초음파 검사", "위장관 초음파 검사",
      "응급 집중 초음파 검사", "CT 영상자료 판독 상담",
    ],
  },
  treatment: {
    path: "cm.path.treatment",
    itemType: "treatment",
    names: [
      "창상 세척·소독", "창상 봉합 준비", "배액관 관리", "비강 산소관 관리", "산소 케이지 관리",
      "기도 흡인 처치", "흉강 천자 준비", "복강 천자 준비", "방광 천자 준비", "요도 카테터 삽입 준비",
      "비위관 관리", "식도관 관리", "위루관 관리", "관장 처치", "안압 측정 처치",
      "형광염색 처치", "귀 세정·건조", "피부 약욕 처치", "발바닥 상처 처치", "화상 상처 처치",
      "온열 보온 처치", "전신 냉각 처치", "정맥 채혈 처치", "동맥 채혈 처치", "주사 처치",
      "피하 주입 처치", "재활 관절가동 처치",
    ],
  },
  dispensing: {
    path: "cm.path.dispensing",
    itemType: "medication",
    names: [
      "아목시실린 경구제 조제", "아목시실린·클라불란산 경구제 조제", "세팔렉신 경구제 조제", "독시사이클린 경구제 조제",
      "클린다마이신 경구제 조제", "메트로니다졸 경구제 조제", "엔로플록사신 경구제 조제", "마보플록사신 경구제 조제",
      "프레드니솔론 경구제 조제", "멜록시캄 경구제 조제", "카프로펜 경구제 조제", "로베나콕시브 경구제 조제",
      "가바펜틴 경구제 조제", "오메프라졸 경구제 조제", "파모티딘 경구제 조제", "마로피탄트 경구제 조제",
      "메토클로프라미드 경구제 조제", "우르소데옥시콜산 경구제 조제", "실리마린 경구제 조제", "레보티록신 경구제 조제",
      "메티마졸 경구제 조제", "베나제프릴 경구제 조제", "피모벤단 경구제 조제", "푸로세미드 경구제 조제",
      "스피로노락톤 경구제 조제", "락툴로오스 경구액 조제", "프로바이오틱스 분말 조제", "전해질 경구액 조제",
      "클로르헥시딘 외용액 조제", "포비돈요오드 외용액 조제", "무피로신 연고 조제", "실버설파디아진 크림 조제",
      "인공눈물 점안액 조제", "오플록사신 점안액 조제", "사이클로스포린 점안액 조제", "귀 세정액 조제",
      "피부 보습제 조제",
    ],
  },
  "surgery/anesthesia": {
    path: "cm.path.surgery-anesthesia",
    itemType: "treatment",
    names: [
      "개 수컷 중성화 수술", "개 암컷 중성화 수술", "고양이 수컷 중성화 수술", "고양이 암컷 중성화 수술",
      "피부 종괴 절제 수술", "피하 종괴 절제 수술", "창상 봉합 수술", "농양 절개·배농 수술",
      "소화기 이물 제거 수술 준비", "복강 탐색 수술 준비", "방광 절개 수술 준비", "요도루 조성 수술 준비",
      "비장 절제 수술 준비", "장 절개 수술 준비", "장 절제·문합 수술 준비", "위 절개 수술 준비",
      "탈장 교정 수술 준비", "슬개골 탈구 교정 수술 준비", "십자인대 수술 준비", "골절 수술 준비",
      "안구 적출 수술 준비", "제3안검 수술 준비", "외이도 수술 준비", "치과 전신마취 준비",
      "마취 유도 관리", "기관삽관 관리", "흡입마취 관리", "주사마취 관리",
      "마취 중 체온 모니터링", "마취 중 혈압 모니터링", "마취 중 호흡 모니터링", "마취 회복 모니터링",
      "수술기구 멸균 준비", "수술 후 통증 평가",
    ],
  },
  inpatient: {
    path: "cm.path.inpatient",
    itemType: "hospitalization",
    names: [
      "일반 입원 반일 관리", "격리 입원 관리", "산소 입원 관리", "고양이 전용 입원 관리",
      "대형견 입원 관리", "중환자 입원 관리", "수술 후 입원 관리", "수혈 입원 모니터링",
      "체온 집중 모니터링", "혈압 집중 모니터링", "호흡 집중 모니터링", "심전도 입원 모니터링",
      "산소포화도 입원 모니터링", "통증 점수 기록", "섭취량 기록", "배뇨량 기록",
      "배변 상태 기록", "체중 변화 기록", "입원 투약 기록", "입원 처치 기록",
      "입원 인계 기록", "격리실 소독 관리", "면회 관리", "퇴원 준비 관리",
    ],
  },
  emergency: {
    path: "cm.path.emergency",
    itemType: "misc",
    names: [
      "응급 중증도 분류", "심폐소생술 준비", "심폐소생술 모니터링", "응급 기도 확보 준비",
      "응급 산소 공급 관리", "쇼크 집중 모니터링", "응급 정맥로 확보", "응급 채혈 준비",
      "응급 수혈 준비", "응급 체온 관리", "응급 혈압 모니터링", "응급 심전도 모니터링",
      "응급 산소포화도 모니터링", "응급 혈당 확인", "응급 신경학적 평가", "응급 외상 평가",
      "응급 복부 평가", "응급 흉부 평가", "응급 중독 노출 확인", "응급 보호자 설명",
      "응급 이송 준비",
    ],
  },
  dental: {
    path: "cm.path.dental",
    itemType: "treatment",
    names: [
      "구강 상태 기록", "치주 차트 기록", "전악 치과 방사선 검사", "부분 치과 방사선 검사",
      "치면 세정", "치면 연마", "치주낭 세척", "치은하 스케일링",
      "단순 발치", "다근치 발치", "잔존 유치 발치", "파절치 발치",
      "치근 잔존 평가", "구강 종괴 평가", "구강 종괴 조직검사 준비", "치은 봉합",
      "구강 세척 처치", "치과 국소마취 준비", "치과 마취 모니터링", "치과 회복 모니터링",
      "치과 보호자 안내", "치과 재검 관리",
    ],
  },
  "certificate/misc": {
    path: "cm.path.certificate",
    itemType: "misc",
    names: [
      "건강진단서 발급", "예방접종 증명서 발급", "광견병 예방접종 증명서 발급", "해외이동 건강서류 발급",
      "마이크로칩 확인서 발급", "진료기록 사본 발급", "검사결과 사본 발급", "영상자료 사본 발급",
      "진료의뢰서 발급", "진료요약서 발급", "보험 제출서류 발급", "전자문서 전송 수수료",
    ],
  },
};

const labTests: LabTestSeed[] = [
  ["globulin", "혈청 글로불린 검사", "GLOB", "cm.result-input.numeric", "cm.unit.g-dl", 1, "cm.specimen.serum"],
  ["ag-ratio", "알부민·글로불린 비율 검사", "AG_RATIO", "cm.result-input.numeric", null, 2, "cm.specimen.serum"],
  ["direct-bilirubin", "직접 빌리루빈 검사", "DBIL", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.serum"],
  ["ggt", "감마글루타밀전이효소 검사", "GGT", "cm.result-input.numeric", "cm.unit.u-l", 0, "cm.specimen.serum"],
  ["ldh", "젖산탈수소효소 검사", "LDH", "cm.result-input.numeric", "cm.unit.u-l", 0, "cm.specimen.serum"],
  ["ck", "크레아틴키나아제 검사", "CK", "cm.result-input.numeric", "cm.unit.u-l", 0, "cm.specimen.serum"],
  ["cholesterol", "총콜레스테롤 검사", "CHOL", "cm.result-input.numeric", "cm.unit.mg-dl", 0, "cm.specimen.serum"],
  ["triglyceride", "중성지방 검사", "TG", "cm.result-input.numeric", "cm.unit.mg-dl", 0, "cm.specimen.serum"],
  ["amylase", "아밀라아제 검사", "AMYL", "cm.result-input.numeric", "cm.unit.u-l", 0, "cm.specimen.serum"],
  ["lipase", "리파아제 검사", "LIPA", "cm.result-input.numeric", "cm.unit.u-l", 0, "cm.specimen.serum"],
  ["sdma", "SDMA 검사", "SDMA", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.serum"],
  ["fructosamine", "프럭토사민 검사", "FRUCTOSAMINE", "cm.result-input.numeric", "cm.unit.mg-dl", 0, "cm.specimen.serum"],
  ["bile-acids", "총담즙산 검사", "TBA", "cm.result-input.numeric", null, 1, "cm.specimen.serum"],
  ["lactate", "젖산 검사", "LACTATE", "cm.result-input.numeric", "cm.unit.mmol-l", 1, "cm.specimen.edta-whole-blood"],
  ["crp", "C-반응단백 검사", "CRP", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.serum"],
  ["saa", "혈청 아밀로이드 A 검사", "SAA", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.serum"],
  ["total-t4", "총 T4 검사", "TT4", "cm.result-input.numeric", null, 2, "cm.specimen.serum"],
  ["free-t4", "유리 T4 검사", "FT4", "cm.result-input.numeric", null, 2, "cm.specimen.serum"],
  ["tsh", "갑상선자극호르몬 검사", "TSH", "cm.result-input.numeric", null, 2, "cm.specimen.serum"],
  ["cortisol", "코르티솔 검사", "CORTISOL", "cm.result-input.numeric", null, 2, "cm.specimen.serum"],
  ["urine-creatinine", "요 크레아티닌 검사", "UCREA", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.urine"],
  ["upc-ratio", "요단백·크레아티닌 비율 검사", "UPC", "cm.result-input.numeric", null, 2, "cm.specimen.urine"],
  ["urine-ph", "요 pH 검사", "UA_PH", "cm.result-input.numeric", null, 1, "cm.specimen.urine"],
  ["urine-glucose", "요당 검사", "UA_GLUCOSE", "cm.result-input.coded", null, undefined, "cm.specimen.urine"],
  ["urine-ketone", "요케톤 검사", "UA_KETONE", "cm.result-input.coded", null, undefined, "cm.specimen.urine"],
  ["urine-bilirubin", "요빌리루빈 검사", "UA_BILIRUBIN", "cm.result-input.coded", null, undefined, "cm.specimen.urine"],
  ["fecal-flotation", "분변 부유 검사", "FECAL_FLOAT", "cm.result-input.text", null, undefined, "cm.specimen.feces"],
  ["fecal-occult-blood", "분변 잠혈 검사", "FECAL_OB", "cm.result-input.coded", null, undefined, "cm.specimen.feces"],
  ["canine-parvovirus-antigen", "개 파보바이러스 항원 검사", "CPV_AG", "cm.result-input.coded", null, undefined, "cm.specimen.feces"],
  ["canine-distemper-antigen", "개 디스템퍼바이러스 항원 검사", "CDV_AG", "cm.result-input.coded", null, undefined, "cm.specimen.swab"],
  ["canine-heartworm-antigen", "개 심장사상충 항원 검사", "CHW_AG", "cm.result-input.coded", null, undefined, "cm.specimen.edta-whole-blood"],
  ["feline-panleukopenia-antigen", "고양이 범백혈구감소증 항원 검사", "FPV_AG", "cm.result-input.coded", null, undefined, "cm.specimen.feces"],
  ["feline-leukemia-antigen", "고양이 백혈병바이러스 항원 검사", "FELV_AG", "cm.result-input.coded", null, undefined, "cm.specimen.edta-whole-blood"],
  ["feline-immunodeficiency-antibody", "고양이 면역결핍바이러스 항체 검사", "FIV_AB", "cm.result-input.coded", null, undefined, "cm.specimen.edta-whole-blood"],
  ["feline-coronavirus-antibody", "고양이 코로나바이러스 항체 검사", "FCOV_AB", "cm.result-input.coded", null, undefined, "cm.specimen.serum"],
  ["babesia-pcr", "바베시아 PCR 검사", "BABESIA_PCR", "cm.result-input.coded", null, undefined, "cm.specimen.edta-whole-blood"],
].map(([slug, name, testCode, resultInputTypeKey, canonicalUnitKey, decimalScale, specimenMasterKey]) => ({
  masterKey: `cm.lab-test.v4.${slug}`,
  name: String(name),
  testCode: String(testCode),
  resultInputTypeKey: String(resultInputTypeKey),
  canonicalUnitKey: canonicalUnitKey === null ? null : String(canonicalUnitKey),
  ...(typeof decimalScale === "number" ? { decimalScale } : {}),
  specimenMasterKey: String(specimenMasterKey),
}));

const labPanels = [
  { slug: "expanded-chemistry", name: "확장 혈청화학 패널", panelCode: "CHEM_EXPANDED", specimenMasterKey: "cm.specimen.serum" },
  { slug: "lipid", name: "지질 검사 패널", panelCode: "LIPID", specimenMasterKey: "cm.specimen.serum" },
  { slug: "pancreatic", name: "췌장 평가 패널", panelCode: "PANCREATIC", specimenMasterKey: "cm.specimen.serum" },
  { slug: "inflammatory", name: "염증 표지 패널", panelCode: "INFLAMMATORY", specimenMasterKey: "cm.specimen.serum" },
  { slug: "thyroid", name: "갑상선 검사 패널", panelCode: "THYROID", specimenMasterKey: "cm.specimen.serum" },
  { slug: "adrenal", name: "부신 검사 패널", panelCode: "ADRENAL", specimenMasterKey: "cm.specimen.serum" },
  { slug: "urine-protein", name: "요단백 평가 패널", panelCode: "URINE_PROTEIN", specimenMasterKey: "cm.specimen.urine" },
  { slug: "infectious-screen", name: "감염성 질환 선별 패널", panelCode: "INFECTIOUS_SCREEN", specimenMasterKey: "cm.specimen.edta-whole-blood" },
].map((panel) => ({ ...panel, masterKey: `cm.lab-panel.v4.${panel.slug}` }));

const panelMembers: Array<{ panelSlug: string; displayGroup: string; testMasterKeys: string[] }> = [
  { panelSlug: "expanded-chemistry", displayGroup: "expanded_chemistry", testMasterKeys: [
    "cm.lab-test.chem-alt", "cm.lab-test.chem-alp", "cm.lab-test.synthetic-03", "cm.lab-test.synthetic-04",
    "cm.lab-test.v4.direct-bilirubin", "cm.lab-test.synthetic-05", "cm.lab-test.chem-total-protein", "cm.lab-test.v4.globulin",
    "cm.lab-test.v4.ag-ratio", "cm.lab-test.chem-bun", "cm.lab-test.chem-creatinine", "cm.lab-test.chem-glucose",
  ] },
  { panelSlug: "lipid", displayGroup: "lipid", testMasterKeys: [
    "cm.lab-test.v4.cholesterol", "cm.lab-test.v4.triglyceride", "cm.lab-test.synthetic-05", "cm.lab-test.chem-glucose",
  ] },
  { panelSlug: "pancreatic", displayGroup: "pancreatic", testMasterKeys: [
    "cm.lab-test.v4.amylase", "cm.lab-test.v4.lipase", "cm.lab-test.chem-glucose", "cm.lab-test.synthetic-05",
    "cm.lab-test.synthetic-06", "cm.lab-test.v4.triglyceride",
  ] },
  { panelSlug: "inflammatory", displayGroup: "inflammatory", testMasterKeys: [
    "cm.lab-test.v4.crp", "cm.lab-test.v4.saa", "cm.lab-test.cbc-wbc", "cm.lab-test.cbc-hct",
    "cm.lab-test.cbc-plt", "cm.lab-test.synthetic-05",
  ] },
  { panelSlug: "thyroid", displayGroup: "thyroid", testMasterKeys: [
    "cm.lab-test.v4.total-t4", "cm.lab-test.v4.free-t4", "cm.lab-test.v4.tsh", "cm.lab-test.v4.cholesterol", "cm.lab-test.v4.ck",
  ] },
  { panelSlug: "adrenal", displayGroup: "adrenal", testMasterKeys: [
    "cm.lab-test.v4.cortisol", "cm.lab-test.synthetic-08", "cm.lab-test.synthetic-09", "cm.lab-test.synthetic-10", "cm.lab-test.chem-glucose",
  ] },
  { panelSlug: "urine-protein", displayGroup: "urinalysis", testMasterKeys: [
    "cm.lab-test.v4.urine-creatinine", "cm.lab-test.v4.upc-ratio", "cm.lab-test.v4.urine-ph", "cm.lab-test.v4.urine-glucose",
    "cm.lab-test.v4.urine-ketone", "cm.lab-test.v4.urine-bilirubin", "cm.lab-test.synthetic-16", "cm.lab-test.synthetic-15",
    "cm.lab-test.ua-strip", "cm.lab-test.ua-sediment",
  ] },
  { panelSlug: "infectious-screen", displayGroup: "infectious", testMasterKeys: [
    "cm.lab-test.v4.fecal-flotation", "cm.lab-test.v4.fecal-occult-blood", "cm.lab-test.v4.canine-parvovirus-antigen",
    "cm.lab-test.v4.canine-distemper-antigen", "cm.lab-test.v4.canine-heartworm-antigen", "cm.lab-test.v4.feline-panleukopenia-antigen",
    "cm.lab-test.v4.feline-leukemia-antigen", "cm.lab-test.v4.feline-immunodeficiency-antibody", "cm.lab-test.v4.feline-coronavirus-antibody",
    "cm.lab-test.v4.babesia-pcr", "cm.lab-test.giardia-antigen", "cm.lab-test.fecal-microscopy",
  ] },
];

const individualLabProfiles: LabProfileSeed[] = labTests.map((test, index) => ({
  orderMasterKey: `cm.order.v4.lab-test.${String(index + 1).padStart(2, "0")}`,
  orderName: test.name,
  labTestMasterKey: test.masterKey,
  labPanelMasterKey: null,
  specimenMasterKey: test.specimenMasterKey,
}));
const panelLabProfiles: LabProfileSeed[] = labPanels.map((panel, index) => ({
  orderMasterKey: `cm.order.v4.lab-panel.${String(index + 1).padStart(2, "0")}`,
  orderName: panel.name,
  labTestMasterKey: null,
  labPanelMasterKey: panel.masterKey,
  specimenMasterKey: panel.specimenMasterKey,
}));
const serviceLabProfiles: LabProfileSeed[] = [
  ["basic-checkup", "기본 건강검진 검사 조합", "expanded-chemistry", "cm.specimen.serum"],
  ["senior-dog", "노령견 검사 조합", "expanded-chemistry", "cm.specimen.serum"],
  ["senior-cat", "노령묘 검사 조합", "thyroid", "cm.specimen.serum"],
  ["vomiting-diarrhea", "구토·설사 검사 조합", "pancreatic", "cm.specimen.serum"],
  ["weight-loss", "체중감소 검사 조합", "thyroid", "cm.specimen.serum"],
  ["pu-pd", "다뇨·다갈 검사 조합", "urine-protein", "cm.specimen.urine"],
  ["hepatobiliary", "간담도 평가 검사 조합", "expanded-chemistry", "cm.specimen.serum"],
  ["renal", "신장 평가 검사 조합", "urine-protein", "cm.specimen.urine"],
  ["emergency-initial", "응급 초기 검사 조합", "inflammatory", "cm.specimen.serum"],
  ["preanesthetic-expanded", "마취 전 확장 검사 조합", "expanded-chemistry", "cm.specimen.serum"],
  ["infectious-workup", "감염성 질환 검사 조합", "infectious-screen", "cm.specimen.edta-whole-blood"],
].map(([slug, orderName, panelSlug, specimenMasterKey]) => ({
  orderMasterKey: `cm.order.v4.lab-service.${slug}`,
  orderName,
  labTestMasterKey: null,
  labPanelMasterKey: `cm.lab-panel.v4.${panelSlug}`,
  specimenMasterKey,
}));
const labProfiles = [...individualLabProfiles, ...panelLabProfiles, ...serviceLabProfiles];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSort);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as JsonObject).sort().map((key) => [key, canonicalSort((value as JsonObject)[key])]));
  }
  return value;
}

function readbackBaselineSha256(readback: AirtableReadback) {
  const withoutHash = clone(readback) as unknown as JsonObject;
  delete withoutHash.baselineSha256;
  return sha256(JSON.stringify(canonicalSort(withoutHash)));
}

function deterministicUuid(seed: string) {
  const hex = sha256(seed).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function speciesForName(name: string): Species[] {
  if (/^(?:개 |강아지 )|성견|노령견|개 파보|개 디스템퍼|개 심장사상충/u.test(name)) return ["dog"];
  if (/^(?:고양이 )|성묘|노령묘|다묘|고양이 범백|고양이 백혈병|고양이 면역결핍|고양이 코로나/u.test(name)) return ["cat"];
  return ["cat", "dog"];
}

function record(masterKey: string, recordType: string, name: string, detail: JsonObject): JsonRecord {
  return {
    masterKey,
    recordType,
    ...clone(V4_AUTHORING_FIELDS),
    names: [{ languageCode: "ko", nameKind: "preferred", name, searchable: true, sortOrder: 0 }],
    detail,
  };
}

function makeNonLabOrderSeeds(): NewOrderSeed[] {
  return Object.entries(categoryConfig).flatMap(([rawCategory, config]) => {
    const category = rawCategory as Exclude<OrderCategory, "lab">;
    return config.names.map((name, index) => ({
      masterKey: `cm.order.v4.${category.replace("/", "-")}.${String(index + 1).padStart(2, "0")}`,
      name,
      category,
      classificationPathKey: config.path,
      itemType: config.itemType,
      species: speciesForName(name),
    }));
  });
}

function makeLabOrderSeeds(): NewOrderSeed[] {
  return labProfiles.map((profile) => ({
    masterKey: profile.orderMasterKey,
    name: profile.orderName,
    category: "lab",
    classificationPathKey: "cm.path.laboratory",
    itemType: "laboratory",
    species: speciesForName(profile.orderName),
  }));
}

function makeAuthoringFixture() {
  const fixture = clone(JSON.parse(readFileSync(V3_AUTHORING_PATH, "utf8")) as AuthoringFixture);
  fixture.release = {
    ...fixture.release,
    releaseKey: RELEASE_KEY,
    status: "approved",
    releaseNotes: "Synthetic operational master v4 with exactly 400 atomic orders; explicitly non-authoritative.",
    reviewReason: "Deterministic sales-demo catalog and workflow fixture; terminology scope review is not clinical approval.",
  };

  for (const test of labTests) {
    fixture.records.push(record(test.masterKey, "lab_test", test.name, {
      testCode: test.testCode,
      resultInputTypeKey: test.resultInputTypeKey,
      canonicalUnitKey: test.canonicalUnitKey,
      ...(test.decimalScale === undefined ? {} : { decimalScale: test.decimalScale }),
    }));
  }
  for (const panel of labPanels) {
    fixture.records.push(record(panel.masterKey, "lab_panel", panel.name, { panelCode: panel.panelCode }));
  }

  const newOrders = [...makeNonLabOrderSeeds(), ...makeLabOrderSeeds()];
  for (const order of newOrders) {
    fixture.records.push(record(order.masterKey, "order", order.name, {
      classificationPathKey: order.classificationPathKey,
      defaultSalesUnitCode: "case",
      defaultBillingReflectionEnabled: true,
      defaultQuantity: 1,
      species: order.species,
    }));
  }

  for (const panel of panelMembers) {
    const panelMasterKey = `cm.lab-panel.v4.${panel.panelSlug}`;
    panel.testMasterKeys.forEach((testMasterKey, index) => fixture.labPanelItems.push({
      panelMasterKey,
      testMasterKey,
      sortOrder: index,
      required: true,
      displayGroup: panel.displayGroup,
    }));
  }
  for (const profile of labProfiles) {
    fixture.labOrderProfiles.push({
      orderMasterKey: profile.orderMasterKey,
      labTestMasterKey: profile.labTestMasterKey,
      labPanelMasterKey: profile.labPanelMasterKey,
      specimenMasterKey: profile.specimenMasterKey,
    });
  }

  fixture.records.sort((left, right) => left.masterKey.localeCompare(right.masterKey));
  fixture.labPanelItems.sort((left, right) => String(left.panelMasterKey).localeCompare(String(right.panelMasterKey)) || Number(left.sortOrder) - Number(right.sortOrder));
  fixture.labOrderProfiles.sort((left, right) => String(left.orderMasterKey).localeCompare(String(right.orderMasterKey)));
  return { fixture, newOrders };
}

function makePricingFixture(newOrders: NewOrderSeed[]) {
  const v3Pricing = clone(JSON.parse(readFileSync(V3_PRICING_PATH, "utf8")) as JsonObject & { orders: JsonObject[] });
  const allOrders = clone(v3Pricing.orders);
  const nextSerial = Object.fromEntries(Object.keys(targetCategoryCounts).map((category) => [
    category,
    allOrders.filter((row) => row.researchCategory === category).length,
  ])) as Record<OrderCategory, number>;

  for (const order of newOrders) {
    const pathReference = allOrders.find((row) => row.classificationPathKey === order.classificationPathKey);
    if (!pathReference) throw new Error(`Missing V3 route reference for ${order.classificationPathKey}`);
    nextSerial[order.category] += 1;
    const serial = nextSerial[order.category];
    const categoryPriceBase = v4AddedCategoryPriceBases[order.category];
    allOrders.push({
      masterKey: order.masterKey,
      researchCategory: order.category,
      classificationPathKey: order.classificationPathKey,
      itemType: order.itemType,
      masterRouteCode: pathReference.masterRouteCode,
      ...(pathReference.heldSourceRouteCode ? { heldSourceRouteCode: pathReference.heldSourceRouteCode } : {}),
      workspaceDestinationModule: pathReference.workspaceDestinationModule,
      categoryPriceBase,
      categoryPriceSerial: serial,
      syntheticWorkspacePriceKrw: categoryPriceBase + serial * 100,
      salesUnit: "case",
    });
  }
  allOrders.sort((left, right) => String(left.masterKey).localeCompare(String(right.masterKey)));
  const categoryCounts = Object.fromEntries(Object.keys(targetCategoryCounts).map((category) => [
    category,
    allOrders.filter((row) => row.researchCategory === category).length,
  ]));
  return {
    ...v3Pricing,
    schemaVersion: "clinical-master-operational-workspace-pricing/v2",
    releaseKey: RELEASE_KEY,
    authorityBoundary: "Workspace-owned synthetic sales-demo pricing/adoption fixture only; central publisher payload has no price or Order Set authority.",
    pricingPolicy: {
      ...(v3Pricing.pricingPolicy as JsonObject),
      amountStyle: "rounded synthetic KRW fixtures; never describe as a hospital fee schedule or Korean standard fee",
      orderSetPolicy: "Order Set prices live only in the separate workspace-owned V4 Order Set manifest.",
    },
    adoptionPolicy: {
      ...(v3Pricing.adoptionPolicy as JsonObject),
      targetWorkspaceIds: TARGET_WORKSPACE_IDS,
      excludedWorkspaceIds: [EXCLUDED_WORKSPACE_ID],
      masterReleaseKey: RELEASE_KEY,
      foreignWorkspacePolicy: {
        workspaceId: EXCLUDED_WORKSPACE_ID,
        excludedFromAdoption: true,
        negativeControl: true,
        existingRowsUnchanged: true,
        fingerprintBoundary: "pre_post",
        noWrite: true,
        policy: "read_only_pre_post_fingerprint_no_write",
        action: "read_only_pre_post_fingerprint_no_write",
      },
    },
    categoryCounts,
    v4AddedCategoryPriceBases,
    totalSyntheticWorkspacePriceKrw: allOrders.reduce((sum, row) => sum + Number(row.syntheticWorkspacePriceKrw), 0),
    orders: allOrders,
  };
}

type StableLinkRef = { resolveBy: "stableKey"; table: string; stableKey: string; resolvedRecordId: null };

function stableLink(table: string, stableKey: string): StableLinkRef {
  return { resolveBy: "stableKey", table, stableKey, resolvedRecordId: null };
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
  const preferred = item.names[0];
  return {
    stableKey: item.masterKey,
    fields: {
      name: preferred?.name,
      languageCode: preferred?.languageCode,
      nameKind: preferred?.nameKind,
      searchable: preferred?.searchable,
      sortOrder: preferred?.sortOrder,
      masterKey: [stableLink("Master Records", item.masterKey)],
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

function withFieldIds(tableName: string, payloads: Array<{ stableKey: string; fields: Record<string, unknown> }>, readback: AirtableReadback) {
  const ids = readback.tables[tableName]?.fieldIdsByName;
  if (!ids) throw new Error(`Missing Airtable table mapping: ${tableName}`);
  return payloads.map((payload) => {
    const fields = Object.fromEntries(Object.entries(payload.fields).filter(([, value]) => value !== null && value !== undefined));
    const fieldsByFieldId = Object.fromEntries(Object.entries(fields).map(([fieldName, value]) => {
      const fieldId = ids[fieldName];
      if (!fieldId) throw new Error(`Missing Airtable field mapping: ${tableName}.${fieldName}`);
      return [fieldId, value];
    }));
    return { ...payload, fields, fieldsByFieldId };
  });
}

function linkedStableKey(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0 || typeof value[0] !== "object" || value[0] === null) return null;
  const row = value[0] as JsonObject;
  return typeof row.name === "string" ? row.name : null;
}

function makeAirtableManifest(fixture: AuthoringFixture, adapterOutput: JsonObject) {
  const readback = JSON.parse(readFileSync(V3_FINAL_READBACK_PATH, "utf8")) as AirtableReadback;
  const auditedInitialRow = readback.tables["Master Records"].records.find((row) => row.airtableRecordId === "recZW92s9i06wpNp0");
  const auditedInitialNameRow = readback.tables.Names.records.find((row) => row.airtableRecordId === "rec0Pw4CymPIed8ta");
  if (!auditedInitialRow || !auditedInitialNameRow || auditedInitialRow.fields.masterKey !== LEGACY_INITIAL_MASTER_KEY) {
    throw new Error("Airtable V3 final readback cannot be normalized to the audited identity-fork state.");
  }
  auditedInitialRow.fields.masterKey = OPERATIONAL_INITIAL_MASTER_KEY;
  auditedInitialNameRow.fields.masterKey = [{ id: auditedInitialRow.airtableRecordId, name: OPERATIONAL_INITIAL_MASTER_KEY }];
  readback.baselineSha256 = readbackBaselineSha256(readback);
  const liveMasterKeys = new Set(readback.tables["Master Records"].records.map((row) => String(row.fields.masterKey)));
  if (liveMasterKeys.has(LEGACY_INITIAL_MASTER_KEY) || !liveMasterKeys.has(OPERATIONAL_INITIAL_MASTER_KEY)) throw new Error("Airtable audited initial-consultation identity baseline drifted.");
  const livePanelLinks = new Set(readback.tables["Lab Panel Items"].records.map((row) => `${linkedStableKey(row.fields.panelMasterKey)}+${linkedStableKey(row.fields.testMasterKey)}`));
  const liveProfileKeys = new Set(readback.tables["Lab Order Profiles"].records.map((row) => linkedStableKey(row.fields.orderMasterKey)));
  const newMasterRecords = fixture.records.filter((item) => !liveMasterKeys.has(item.masterKey));
  const newPanelItems = fixture.labPanelItems.filter((item) => !livePanelLinks.has(`${item.panelMasterKey}+${item.testMasterKey}`));
  const newProfiles = fixture.labOrderProfiles.filter((item) => !liveProfileKeys.has(String(item.orderMasterKey)));
  const currentRelease = readback.tables["Release Drafts"].records[0];
  if (!currentRelease) throw new Error("V3 final readback is missing its Release Draft.");

  const releaseFields = Object.fromEntries(Object.entries({
    releaseKey: fixture.release.releaseKey,
    status: fixture.release.status,
    releaseNotes: fixture.release.releaseNotes,
    reviewReason: fixture.release.reviewReason,
    publishedByLabel: fixture.release.publishedByLabel,
    authoredByLabel: fixture.release.authoredByLabel,
    reviewedByLabel: fixture.release.reviewedByLabel,
    clinicalReviewerLabel: fixture.release.clinicalReviewerLabel,
  }).filter(([, value]) => value !== null && value !== undefined));
  const releaseFieldsByFieldId = Object.fromEntries(Object.entries(releaseFields).map(([fieldName, value]) => [
    readback.tables["Release Drafts"].fieldIdsByName[fieldName], value,
  ]));
  const tables = {
    "Release Drafts": {
      tableId: readback.tables["Release Drafts"].tableId,
      operation: "update_existing_by_record_id_after_exact_cas",
      currentRecordId: currentRelease.airtableRecordId,
      expectedBefore: 1,
      expectedAfter: 1,
      create: 0,
      updateExisting: 1,
      fields: releaseFields,
      fieldsByFieldId: releaseFieldsByFieldId,
      rollbackRestore: { recordId: currentRelease.airtableRecordId, fields: currentRelease.fields },
    },
    Sources: {
      tableId: readback.tables.Sources.tableId,
      operation: "verify_only_preserve_source_identity",
      expectedBefore: 1,
      expectedAfter: 1,
      create: 0,
      updateExisting: 0,
      createPayloads: [],
    },
    "Master Records": {
      tableId: readback.tables["Master Records"].tableId,
      operation: "additive_create_by_master_key",
      expectedBefore: 254,
      expectedAfter: 578,
      create: newMasterRecords.length,
      updateExisting: 0,
      updatePayloads: [],
      createPayloads: withFieldIds("Master Records", newMasterRecords.map(makeMasterCreatePayload), readback),
    },
    Names: {
      tableId: readback.tables.Names.tableId,
      operation: "additive_create_preferred_ko_name",
      expectedBefore: 254,
      expectedAfter: 578,
      create: newMasterRecords.length,
      updateExisting: 0,
      createPayloads: withFieldIds("Names", newMasterRecords.map(makeNameCreatePayload), readback),
    },
    "Classification Paths": {
      tableId: readback.tables["Classification Paths"].tableId,
      operation: "verify_only",
      expectedBefore: 13,
      expectedAfter: 13,
      create: 0,
      updateExisting: 0,
      createPayloads: [],
    },
    "Lab Panel Items": {
      tableId: readback.tables["Lab Panel Items"].tableId,
      operation: "additive_create_by_panel_test_pair",
      expectedBefore: 60,
      expectedAfter: 120,
      create: newPanelItems.length,
      updateExisting: 0,
      createPayloads: withFieldIds("Lab Panel Items", newPanelItems.map(makePanelItemCreatePayload), readback),
    },
    "Lab Order Profiles": {
      tableId: readback.tables["Lab Order Profiles"].tableId,
      operation: "additive_create_by_order_master_key",
      expectedBefore: 30,
      expectedAfter: 85,
      create: newProfiles.length,
      updateExisting: 0,
      createPayloads: withFieldIds("Lab Order Profiles", newProfiles.map(makeProfileCreatePayload), readback),
    },
    "Diagnosis Category Links": {
      tableId: readback.tables["Diagnosis Category Links"].tableId,
      operation: "verify_only_preserve_unchanged",
      expectedBefore: 12,
      expectedAfter: 12,
      create: 0,
      updateExisting: 0,
      createPayloads: [],
    },
  };

  return {
    schemaVersion: "clinical-master-airtable-additive-write-manifest/v4",
    generatedAt: "2026-08-25",
    releaseKey: RELEASE_KEY,
    baseId: readback.baseId,
    writeAllowed: false,
    mutationsPerformed: 0,
    authorityBoundary: "Local candidate only. A fresh exact Airtable readback and separate approval are required before execution.",
    casGate: {
      requiredBaselineSha256: readback.baselineSha256,
      requiredTableCounts: readback.tableCounts,
      requiredSourceIdentity: readback.sourceIdentity,
      sourcePayloadSha256: sha256(canonicalJson(adapterOutput)),
      failureMode: "abort_before_first_write",
    },
    dependencyOrder: [
      "CAS all eight V3 final-readback table counts and canonical hash",
      "Verify the preserved source identity",
      "Verify the already-applied audited initial-consultation identity fork by preserved record ID",
      "Create 324 Master Records",
      "Create 324 Names after resolving Master Record IDs",
      "Create 60 Lab Panel Items after resolving panel/test IDs",
      "Create 55 Lab Order Profiles after resolving order/test/panel/specimen IDs",
      "Update the single Release Draft only after additive readback passes",
      "Read back all eight tables and require exact V4 counts",
    ],
    rollbackOrder: [
      "Restore the Release Draft by its preserved record ID",
      "Delete only created Lab Order Profiles by journaled created record IDs",
      "Delete only created Lab Panel Items by journaled created record IDs",
      "Delete only created Names by journaled created record IDs",
      "Delete only created Master Records by journaled created record IDs",
    ],
    rollbackJournalTemplate: {
      mode: "created_record_id_only",
      entries: ["Master Records", "Names", "Lab Panel Items", "Lab Order Profiles"].flatMap((tableName) => {
        const table = tables[tableName as keyof typeof tables] as JsonObject;
        const payloads = (table.createPayloads ?? []) as JsonObject[];
        return payloads.map((payload) => ({ tableName, stableKey: payload.stableKey, createdRecordId: null, rollbackStatus: "not_started" }));
      }),
    },
    tables,
    safetyChecks: {
      additiveOnly: true,
      auditedIdentityForkAlreadyApplied: {
        masterRecordId: auditedInitialRow.airtableRecordId,
        linkedNameRecordId: auditedInitialNameRow.airtableRecordId,
        masterKey: OPERATIONAL_INITIAL_MASTER_KEY,
      },
      preserveExistingMasterRows: true,
      preserveExistingNames: true,
      preserveClassificationPaths: true,
      preserveDiagnosisData: true,
      noRemoteWritesPerformed: true,
    },
  };
}

type SetSeed = {
  templateKey: string;
  setName: string;
  setCategory: string;
  species: Species[];
  amountBasis: "included_order_sum" | "set_fixed_price" | "range_price";
  setPriceKrw?: number;
  memberNames: string[];
  nestedTemplateKey?: string;
};

function makeOrderSetManifest(fixture: AuthoringFixture) {
  const orderKeyByName = new Map(fixture.records.filter((item) => item.recordType === "order").map((item) => [item.names[0]?.name, item.masterKey]));
  const sets: SetSeed[] = [
    { templateKey: "dog-preventive-basic", setName: "개 예방·건강검진 기본", setCategory: "예방", species: ["dog"], amountBasis: "set_fixed_price", setPriceKrw: 180000, memberNames: ["개 기초 건강검진", "예방접종 이력 확인", "심장사상충 예방관리", "내부기생충 예방관리"] },
    { templateKey: "cat-preventive-basic", setName: "고양이 예방·건강검진 기본", setCategory: "예방", species: ["cat"], amountBasis: "set_fixed_price", setPriceKrw: 175000, memberNames: ["고양이 기초 건강검진", "예방접종 이력 확인", "고양이 예방접종 관리", "외부기생충 예방관리"] },
    { templateKey: "senior-dog-checkup", setName: "노령견 건강검진", setCategory: "건강검진", species: ["dog"], amountBasis: "set_fixed_price", setPriceKrw: 320000, memberNames: ["노령견 종합 건강검진", "노령견 검사 조합", "체중 관리 상담", "흉부 방사선 검사"] },
    { templateKey: "senior-cat-checkup", setName: "노령묘 건강검진", setCategory: "건강검진", species: ["cat"], amountBasis: "set_fixed_price", setPriceKrw: 310000, memberNames: ["노령묘 종합 건강검진", "노령묘 검사 조합", "체중 관리 상담", "복부 초음파 검사"] },
    { templateKey: "vomiting-diarrhea-basic", setName: "구토·설사 기본 평가", setCategory: "소화기", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["구토·설사 검사 조합", "복부 방사선 검사", "피하 수액 처치", "영양 상담"] },
    { templateKey: "feline-lower-urinary-basic", setName: "고양이 하부요로 기본 평가", setCategory: "비뇨기", species: ["cat"], amountBasis: "included_order_sum", memberNames: ["요검사 패널", "방광 초음파 검사", "요도 카테터 삽입 준비", "방광 세척"] },
    { templateKey: "skin-ear-basic", setName: "피부·외이 기본 평가", setCategory: "피부·외이", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["피부·귀 상담", "피부 세포검사", "귀 분비물 세포검사", "귀 세정·건조"] },
    { templateKey: "dental-evaluation-treatment", setName: "치과 평가·처치", setCategory: "치과", species: ["cat", "dog"], amountBasis: "range_price", memberNames: ["치과 상담", "구강 상태 기록", "전악 치과 방사선 검사", "치석 제거 처치"] },
    { templateKey: "preanesthetic-evaluation", setName: "마취 전 평가", setCategory: "마취", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["마취 위험도 상담", "수술 전 검사", "마취 유도 관리", "마취 모니터링"] },
    { templateKey: "dog-neuter", setName: "개 중성화 수술", setCategory: "수술", species: ["dog"], amountBasis: "included_order_sum", nestedTemplateKey: "preanesthetic-evaluation", memberNames: ["개 수컷 중성화 수술", "개 암컷 중성화 수술", "마취 회복 모니터링"] },
    { templateKey: "cat-neuter", setName: "고양이 중성화 수술", setCategory: "수술", species: ["cat"], amountBasis: "included_order_sum", nestedTemplateKey: "preanesthetic-evaluation", memberNames: ["고양이 수컷 중성화 수술", "고양이 암컷 중성화 수술", "마취 회복 모니터링"] },
    { templateKey: "small-mass-removal-prep", setName: "소형 종괴 제거 준비", setCategory: "수술", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["종괴 세포검사", "피부 종괴 절제 수술", "수술 전 준비", "수술 후 통증 평가"] },
    { templateKey: "wound-evaluation-treatment", setName: "상처 평가·처치", setCategory: "처치", species: ["cat", "dog"], amountBasis: "range_price", memberNames: ["창상 세척·소독", "상처 드레싱", "창상 봉합 준비", "붕대 교체"] },
    { templateKey: "cardiac-basic", setName: "심장 기본 평가", setCategory: "심장", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["심장 초음파 검사", "흉부 방사선 검사", "혈압 집중 모니터링", "검사 결과 상담"] },
    { templateKey: "respiratory-distress-basic", setName: "호흡곤란 기본 평가", setCategory: "호흡기", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["흉부 방사선 검사", "응급 산소 공급 관리", "산소포화도 입원 모니터링", "응급 흉부 평가"] },
    { templateKey: "emergency-initial-stabilization", setName: "응급 초기 안정화", setCategory: "응급", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["응급 중증도 분류", "응급 정맥로 확보", "응급 초기 검사 조합", "응급 산소 공급 관리"] },
    { templateKey: "inpatient-basic-monitoring", setName: "입원 기본 모니터링", setCategory: "입원", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["활력징후 기록", "섭취량 기록", "배뇨량 기록", "입원 처치 기록"] },
    { templateKey: "intensive-inpatient-monitoring", setName: "집중 입원 모니터링", setCategory: "입원", species: ["cat", "dog"], amountBasis: "included_order_sum", nestedTemplateKey: "inpatient-basic-monitoring", memberNames: ["중환자 입원 관리", "혈압 집중 모니터링", "호흡 집중 모니터링"] },
    { templateKey: "fluid-therapy-monitoring", setName: "수액 치료·모니터링", setCategory: "처치", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["정맥 수액 처치", "수액펌프 관리", "체중 변화 기록", "섭취량 기록"] },
    { templateKey: "discharge-recheck", setName: "퇴원·재진 관리", setCategory: "상담", species: ["cat", "dog"], amountBasis: "included_order_sum", memberNames: ["퇴원 상담", "재진 경과 상담", "퇴원 준비 관리", "보호자 교육 상담"] },
  ];

  const templateDefinitions = sets.map((set) => {
    const suppressChildBilling = set.amountBasis !== "included_order_sum";
    const atomicItems = set.memberNames.map((name, index) => {
      const masterKey = orderKeyByName.get(name);
      if (!masterKey) throw new Error(`Order Set member does not resolve: ${set.setName} / ${name}`);
      return {
        childKind: "atomic",
        childOrderCatalogItemId: { resolveBy: "workspace_catalog_master_key", masterKey, resolvedValue: null },
        childOrderCatalogRevision: { resolveBy: "workspace_catalog_current_revision", masterKey, resolvedValue: null },
        childOrderSetId: null,
        childSetRevisionId: null,
        sortOrder: index,
        defaultSelected: true,
        billingReflectionDefault: !suppressChildBilling,
        defaultQuantity: 1,
        quantitySource: "fixed_one",
      };
    });
    const nestedItem = set.nestedTemplateKey ? [{
      childKind: "order_set",
      childOrderCatalogItemId: null,
      childOrderCatalogRevision: null,
      childOrderSetId: { resolveBy: "created_template_key", templateKey: set.nestedTemplateKey, resolvedValue: null },
      childSetRevisionId: { resolveBy: "created_template_current_revision", templateKey: set.nestedTemplateKey, resolvedValue: null },
      sortOrder: atomicItems.length,
      defaultSelected: true,
      billingReflectionDefault: !suppressChildBilling,
      defaultQuantity: 1,
      quantitySource: "fixed_one",
    }] : [];
    const priceRanges = set.amountBasis === "range_price" ? [
      { sortOrder: 0, lowerBound: 1, upperBound: 2, priceKrw: set.templateKey.startsWith("dental") ? 220000 : 90000 },
      { sortOrder: 1, lowerBound: 2, upperBound: 3, priceKrw: set.templateKey.startsWith("dental") ? 320000 : 150000 },
      { sortOrder: 2, lowerBound: 3, upperBound: null, priceKrw: set.templateKey.startsWith("dental") ? 420000 : 210000 },
    ] : [];
    return {
      templateKey: set.templateKey,
      dependencyTemplateKeys: set.nestedTemplateKey ? [set.nestedTemplateKey] : [],
      availabilityStatus: "active",
      definitionTemplate: {
        setCategory: set.setCategory,
        setName: set.setName,
        billingName: set.setName,
        amountBasis: set.amountBasis,
        setPriceKrw: set.amountBasis === "set_fixed_price" ? set.setPriceKrw : null,
        rangeBasis: set.amountBasis === "range_price" ? "manual_value" : null,
        salesUnit: "case",
        billingReflectionEnabled: true,
        taxType: set.amountBasis === "included_order_sum" ? "derived" : "taxable",
        targetSpecies: set.species,
        careGuide: "합성 데모 세트입니다. 실제 진료 도입 전 병원별 검토가 필요합니다.",
        internalInstruction: "V4 세일즈 데모용 구성. 임상 추천이나 표준 수가로 사용하지 않습니다.",
        items: [...atomicItems, ...nestedItem],
        priceRanges,
      },
    };
  });

  const templateByKey = new Map(templateDefinitions.map((template) => [template.templateKey, template]));
  const orderedTemplateKeys = [
    "dog-preventive-basic", "cat-preventive-basic", "senior-dog-checkup", "senior-cat-checkup",
    "vomiting-diarrhea-basic", "feline-lower-urinary-basic", "skin-ear-basic", "dental-evaluation-treatment",
    "preanesthetic-evaluation", "dog-neuter", "cat-neuter", "small-mass-removal-prep", "wound-evaluation-treatment",
    "cardiac-basic", "respiratory-distress-basic", "emergency-initial-stabilization", "inpatient-basic-monitoring",
    "intensive-inpatient-monitoring", "fluid-therapy-monitoring", "discharge-recheck",
  ];
  const orderedTemplates = orderedTemplateKeys.map((key) => {
    const template = templateByKey.get(key);
    if (!template) throw new Error(`Missing Order Set template ${key}`);
    return template;
  });
  const operations = TARGET_WORKSPACE_IDS.flatMap((workspaceId) => orderedTemplates.map((template, index) => ({
    operationId: `${workspaceId}:${template.templateKey}`,
    sequence: index + 1,
    workspaceId,
    method: "POST",
    path: `/api/workspaces/${workspaceId}/hospital-admin/order-sets`,
    headers: {
      "If-None-Match": "*",
      "Idempotency-Key": deterministicUuid(`clinical-master-v4:${workspaceId}:${template.templateKey}`),
    },
    bodyTemplate: {
      availabilityStatus: template.availabilityStatus,
      definition: template.definitionTemplate,
    },
    dependencyOperationIds: template.dependencyTemplateKeys.map((key) => `${workspaceId}:${key}`),
    runtimeResolutionRequired: true,
  })));

  return {
    schemaVersion: "clinical-master-order-set-idempotency-manifest/v1",
    generatedAt: "2026-08-25",
    releaseKey: RELEASE_KEY,
    writeAllowed: false,
    mutationsPerformed: 0,
    syntheticOnly: true,
    authorityBoundary: "Workspace-owned local operation templates only. Resolve adopted catalog IDs/revisions immediately before a separately approved write.",
    targetWorkspaceIds: TARGET_WORKSPACE_IDS,
    excludedWorkspacePolicy: {
      workspaceId: EXCLUDED_WORKSPACE_ID,
      noWrite: true,
      operationCount: 0,
      verification: "require identical pre/post workspace fingerprint",
    },
    materializationContract: {
      definitionType: "OrderSetDefinition",
      atomicResolution: "Resolve masterKey to the target workspace catalog item ID and current catalog revision after V4 adoption.",
      nestedResolution: "Resolve dependency templateKey to the orderSetId and currentRevisionId returned by its earlier create operation.",
      conflictPolicy: "Never overwrite. On conflict, re-read current state and require a newly approved manifest.",
    },
    templates: orderedTemplates,
    operations,
  };
}

function makeLabSemanticsFixture() {
  return {
    schemaVersion: "clinical-master-operational-lab-semantics/v4",
    releaseKey: RELEASE_KEY,
    syntheticOnly: true,
    clinicalAuthority: false,
    scope: "Operational labels and relationship coverage only; no reference ranges, interpretation, dose, or treatment recommendation.",
    terminologyReferences: [
      { organization: "AAHA", topic: "preventive healthcare", url: "https://www.aaha.org/resources/2011-aaha-avma-preventive-healthcare-guidelines/" },
      { organization: "AAHA", topic: "anesthesia and monitoring", url: "https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/" },
      { organization: "AAHA", topic: "dental care", url: "https://www.aaha.org/resources/2019-aaha-dental-care-guidelines-for-dogs-and-cats/" },
      { organization: "AAHA", topic: "fluid therapy", url: "https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/" },
      { organization: "RECOVER", topic: "veterinary resuscitation", url: "https://recoverinitiative.org/2024-guidelines/" },
      { organization: "WSAVA", topic: "vaccination", url: "https://wsava.org/Global-Guidelines/Vaccination-Guidelines/" },
      { organization: "Cornell AHDC", topic: "clinical chemistry", url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/veterinary-resources/testing-guidelines/clinical-chemistry" },
    ],
    addedTests: labTests,
    addedPanels: labPanels,
    addedPanelLinks: panelMembers.flatMap((panel) => panel.testMasterKeys.map((testMasterKey, sortOrder) => ({
      panelMasterKey: `cm.lab-panel.v4.${panel.panelSlug}`,
      testMasterKey,
      sortOrder,
      required: true,
      displayGroup: panel.displayGroup,
    }))),
    addedOrderProfiles: labProfiles,
  };
}

function containsForbiddenCentralProperty(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenCentralProperty);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as JsonObject).some(([key, child]) =>
    /(?:price|pricing|weight|orderset|order_set)/iu.test(key) || containsForbiddenCentralProperty(child));
}

function validatePackage(fixture: AuthoringFixture, adapterOutput: JsonObject, pricing: JsonObject, airtable: JsonObject, orderSets: JsonObject) {
  const recordsByKey = new Map(fixture.records.map((item) => [item.masterKey, item]));
  const orders = fixture.records.filter((item) => item.recordType === "order");
  const v3Fixture = JSON.parse(readFileSync(V3_AUTHORING_PATH, "utf8")) as AuthoringFixture;
  for (const prior of v3Fixture.records) {
    const current = recordsByKey.get(prior.masterKey);
    if (canonicalJson(current) !== canonicalJson(prior)) throw new Error(`V3 authoring row changed: ${prior.masterKey}`);
  }
  if (fixture.records.length !== 578 || fixture.records.length !== new Set(fixture.records.map((item) => item.masterKey)).size) throw new Error("V4 Master Record total/uniqueness gate failed.");
  if (orders.length !== 400) throw new Error(`Expected 400 atomic orders, received ${orders.length}.`);
  if (fixture.records.filter((item) => item.recordType === "lab_test").length !== 72) throw new Error("Expected 72 lab tests.");
  if (fixture.records.filter((item) => item.recordType === "lab_panel").length !== 18) throw new Error("Expected 18 lab panels.");
  if (fixture.classificationPaths.length !== 13 || fixture.labPanelItems.length !== 120 || fixture.labOrderProfiles.length !== 85 || fixture.diagnosisCategoryLinks.length !== 12) throw new Error("V4 relationship count gate failed.");
  const supported = ((adapterOutput.payload as JsonObject).records as JsonObject[]).length;
  if (supported !== 554 || Number((adapterOutput.excluded as JsonObject).recordCount) !== 24) throw new Error("V4 publisher supported/excluded count gate failed.");
  if (containsForbiddenCentralProperty(adapterOutput.payload)) throw new Error("Central publisher payload contains workspace-owned authority.");

  const pricingOrders = pricing.orders as JsonObject[];
  const actualCounts = Object.fromEntries(Object.keys(targetCategoryCounts).map((category) => [category, pricingOrders.filter((row) => row.researchCategory === category).length]));
  if (canonicalJson(actualCounts) !== canonicalJson(targetCategoryCounts)) throw new Error(`V4 category totals drifted: ${JSON.stringify(actualCounts)}`);
  if (pricingOrders.length !== 400 || new Set(pricingOrders.map((row) => row.masterKey)).size !== 400 || new Set(pricingOrders.map((row) => row.syntheticWorkspacePriceKrw)).size !== 400) throw new Error("V4 pricing identity/amount uniqueness gate failed.");
  if (pricingOrders.some((row) => !Number.isInteger(row.syntheticWorkspacePriceKrw) || Number(row.syntheticWorkspacePriceKrw) <= 0)) throw new Error("V4 prices must be positive integer synthetic KRW.");
  const v3Pricing = JSON.parse(readFileSync(V3_PRICING_PATH, "utf8")) as { orders: JsonObject[] };
  const v4PriceByKey = new Map(pricingOrders.map((row) => [row.masterKey, row.syntheticWorkspacePriceKrw]));
  if (v3Pricing.orders.some((row) => v4PriceByKey.get(row.masterKey) !== row.syntheticWorkspacePriceKrw)) throw new Error("V4 pricing changed a preserved V3 price.");
  if (pricingOrders.filter((row) => String(row.masterKey).startsWith("cm.order.v4.")).some((row) => Number(row.syntheticWorkspacePriceKrw) % 100 !== 0)) throw new Error("V4 additive prices must be rounded to 100 KRW increments.");

  const normalizedNames = new Set<string>();
  for (const order of orders) {
    const name = String(order.names[0]?.name ?? "");
    const normalized = name.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/gu, "");
    if (!normalized || normalizedNames.has(normalized)) throw new Error(`Duplicate/empty order name: ${order.masterKey} / ${name}`);
    normalizedNames.add(normalized);
  }
  if (orders.some((order) => /(?:용량|mg\/kg|1일 \d회|마약|펜타닐|모르핀)/iu.test(String(order.names[0]?.name)))) throw new Error("Medication safety boundary failed.");

  for (const link of fixture.labPanelItems) {
    if (recordsByKey.get(String(link.panelMasterKey))?.recordType !== "lab_panel" || recordsByKey.get(String(link.testMasterKey))?.recordType !== "lab_test") throw new Error(`Broken lab panel link: ${JSON.stringify(link)}`);
  }
  for (const profile of fixture.labOrderProfiles) {
    if (recordsByKey.get(String(profile.orderMasterKey))?.recordType !== "order") throw new Error(`Broken lab order profile: ${profile.orderMasterKey}`);
    if (profile.labTestMasterKey && recordsByKey.get(String(profile.labTestMasterKey))?.recordType !== "lab_test") throw new Error(`Broken profile test: ${profile.orderMasterKey}`);
    if (profile.labPanelMasterKey && recordsByKey.get(String(profile.labPanelMasterKey))?.recordType !== "lab_panel") throw new Error(`Broken profile panel: ${profile.orderMasterKey}`);
    if (!profile.labTestMasterKey === !profile.labPanelMasterKey) throw new Error(`Profile must select exactly one test or panel: ${profile.orderMasterKey}`);
    if (recordsByKey.get(String(profile.specimenMasterKey))?.recordType !== "specimen_type") throw new Error(`Broken profile specimen: ${profile.orderMasterKey}`);
  }

  const airtableTables = airtable.tables as Record<string, JsonObject>;
  if (airtable.writeAllowed !== false || airtable.mutationsPerformed !== 0 || airtableTables["Master Records"]?.create !== 324 || airtableTables.Names?.create !== 324 || airtableTables["Lab Panel Items"]?.create !== 60 || airtableTables["Lab Order Profiles"]?.create !== 55) {
    throw new Error(`V4 Airtable manifest count/write boundary failed: ${JSON.stringify({
      master: airtableTables["Master Records"]?.create,
      names: airtableTables.Names?.create,
      panelItems: airtableTables["Lab Panel Items"]?.create,
      profiles: airtableTables["Lab Order Profiles"]?.create,
    })}`);
  }
  const createPayloads = ["Master Records", "Names", "Lab Panel Items", "Lab Order Profiles"].flatMap((tableName) => (airtableTables[tableName]?.createPayloads ?? []) as JsonObject[]);
  if (createPayloads.some((payload) => Object.values(payload.fieldsByFieldId as JsonObject).some((value) => value === null || value === undefined))) throw new Error("Airtable writable fields contain null/undefined.");
  if ((airtable.rollbackJournalTemplate as JsonObject).entries && ((airtable.rollbackJournalTemplate as JsonObject).entries as JsonObject[]).some((entry) => entry.createdRecordId !== null)) throw new Error("Airtable rollback journal contains a fabricated created ID.");

  const templates = orderSets.templates as JsonObject[];
  const operations = orderSets.operations as JsonObject[];
  if (templates.length !== 20 || operations.length !== 60 || orderSets.writeAllowed !== false || orderSets.mutationsPerformed !== 0) throw new Error("Order Set manifest count/write boundary failed.");
  const amountCounts = templates.reduce<Record<string, number>>((counts, template) => {
    const amountBasis = String((template.definitionTemplate as JsonObject).amountBasis);
    counts[amountBasis] = (counts[amountBasis] ?? 0) + 1;
    return counts;
  }, {});
  if (canonicalJson(amountCounts) !== canonicalJson({ set_fixed_price: 4, included_order_sum: 14, range_price: 2 })) throw new Error(`Order Set price distribution drifted: ${JSON.stringify(amountCounts)}`);
  const nestedParents = templates.filter((template) => (template.dependencyTemplateKeys as unknown[]).length > 0).map((template) => template.templateKey);
  if (canonicalJson(nestedParents) !== canonicalJson(["dog-neuter", "cat-neuter", "intensive-inpatient-monitoring"])) throw new Error("Order Set nesting contract drifted.");
  for (const template of templates) {
    const definition = template.definitionTemplate as JsonObject;
    const items = definition.items as JsonObject[];
    if (items.length === 0 || (definition.amountBasis !== "included_order_sum" && items.some((item) => item.billingReflectionDefault !== false))) throw new Error(`Order Set billing/member gate failed: ${template.templateKey}`);
  }
  if (operations.some((operation) => operation.workspaceId === EXCLUDED_WORKSPACE_ID) || new Set(operations.map((operation) => operation.operationId)).size !== 60) throw new Error("Order Set workspace allowlist gate failed.");
}

function writeOrCheck(path: string, value: unknown, checkOnly: boolean) {
  const output = canonicalJson(value);
  if (checkOnly) {
    if (readFileSync(path, "utf8") !== output) throw new Error(`Generated fixture drift: ${path}`);
  } else {
    writeFileSync(path, output, "utf8");
  }
  return { bytes: Buffer.byteLength(output), sha256: sha256(output) };
}

const { fixture, newOrders } = makeAuthoringFixture();
const adapted = adaptClinicalMasterAirtableAuthoringExport(fixture as never);
const adapterOutput = { payload: adapted.payload, excluded: adapted.excluded };
const pricing = makePricingFixture(newOrders);
const labSemantics = makeLabSemanticsFixture();
const airtableManifest = makeAirtableManifest(fixture, adapterOutput);
const orderSetManifest = makeOrderSetManifest(fixture);
validatePackage(fixture, adapterOutput, pricing, airtableManifest, orderSetManifest);

const counts = {
  authoringRecords: fixture.records.length,
  names: fixture.records.length,
  supportedRecords: (adapterOutput.payload.records as JsonObject[]).length,
  excludedRecords: adapterOutput.excluded.recordCount,
  orders: fixture.records.filter((item) => item.recordType === "order").length,
  labTests: fixture.records.filter((item) => item.recordType === "lab_test").length,
  labPanels: fixture.records.filter((item) => item.recordType === "lab_panel").length,
  classificationPaths: fixture.classificationPaths.length,
  labPanelItems: fixture.labPanelItems.length,
  labOrderProfiles: fixture.labOrderProfiles.length,
  diagnosisCategoryLinks: fixture.diagnosisCategoryLinks.length,
  orderSetTemplates: (orderSetManifest.templates as JsonObject[]).length,
  orderSetOperations: (orderSetManifest.operations as JsonObject[]).length,
};
const packageManifest = {
  schemaVersion: "clinical-master-operational-v4-package/v1",
  generatedAt: "2026-08-25",
  releaseKey: RELEASE_KEY,
  status: "local_review_candidate",
  remoteWritesPerformed: 0,
  counts,
  categoryCounts: targetCategoryCounts,
  addedCategoryCounts: expectedAddedCategoryCounts,
  targetWorkspaceIds: TARGET_WORKSPACE_IDS,
  excludedWorkspaceId: EXCLUDED_WORKSPACE_ID,
  boundaries: {
    syntheticOnly: true,
    clinicalAuthority: false,
    realHospitalPricing: false,
    medicationDoseOrFrequency: false,
    controlledDrugCatalog: false,
    remoteExecutionApproved: false,
  },
};

const checkOnly = process.argv.includes("--check");
const hashes = {
  authoring: writeOrCheck(AUTHORING_PATH, fixture, checkOnly),
  adapter: writeOrCheck(ADAPTER_PATH, adapterOutput, checkOnly),
  pricing: writeOrCheck(PRICING_PATH, pricing, checkOnly),
  labSemantics: writeOrCheck(LAB_SEMANTICS_PATH, labSemantics, checkOnly),
  airtableManifest: writeOrCheck(AIRTABLE_MANIFEST_PATH, airtableManifest, checkOnly),
  orderSetManifest: writeOrCheck(ORDER_SET_MANIFEST_PATH, orderSetManifest, checkOnly),
  packageManifest: writeOrCheck(PACKAGE_MANIFEST_PATH, packageManifest, checkOnly),
};

process.stdout.write(`${JSON.stringify({ checkOnly, counts, hashes }, null, 2)}\n`);
