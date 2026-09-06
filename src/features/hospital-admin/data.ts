"use client";

import type { ClinicalOrderType, ServiceItemType } from "@/types/emr-domain";
import { readPersistedOrderDefaults, type PersistedOrderDefaultsSource } from "./persisted-order-defaults";
import { isOrderTaxonomyValid, orderTaxonomySubcategories } from "./order-taxonomy";
import { parsePlanOrderAuthority, proposePlanOrderPreparation } from "@/features/chart/plan-order-authority-domain";
import type {
  OrderCatalogItem,
  OrderCatalogMutationInput,
  OrderCatalogPriceBasis,
  OrderCatalogSalesUnit,
} from "@/features/hospital-admin/server-order-catalog";
import {
  resolveClinicalOrderMasterContract,
} from "@/features/chart/order-execution-domain";

export type HospitalOrderCategoryId =
  | "unclassified"
  | "consultation"
  | "prevention"
  | "lab"
  | "imaging"
  | "treatment"
  | "surgery"
  | "hospitalization"
  | "therapy"
  | "dispensing"
  | "medical-supply"
  | "misc";
export type HospitalOrderSubcategoryId = import("./order-taxonomy").OrderAdminSubcategoryCode
  | "unclassified"
  | "basic-consultation"
  | "other-consultation"
  | "prevention"
  | "clinical-pathology"
  | "blood-chemistry"
  | "system-exam"
  | "external-lab"
  | "radiography"
  | "ultrasound"
  | "basic-treatment"
  | "anesthesia"
  | "surgery"
  | "hospitalization"
  | "therapy"
  | "oral-medication"
  | "injection"
  | "medical-supply"
  | "other";
export type HospitalOrderDelivery = "deliver" | "do-not-deliver";
export type HospitalOrderTarget = "all" | "dog-cat" | "dog" | "cat" | "other";
export type HospitalOrderSaleUnit = "each" | "day" | "session" | "pack";
export type HospitalOrderRoundRule = "none" | "round-10" | "round-100";
export type HospitalOrderType = "individual";
export type HospitalOrderPriceMode = "per_quantity" | "fixed";
export type HospitalDispensingReviewStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";
export type HospitalDispensingPreset = {
  ingredientName: string;
  doseBasis?: string;
  dose: number | undefined;
  doseUnit: string;
  route: string;
  frequency: string;
  durationDays: number | undefined;
  totalQuantity: number | undefined;
  totalQuantityUnit: string;
  medicationInstruction: string;
  storageMethod: string;
  compoundNote: string;
  guardianNote: string;
  autoDispenseQuantityEnabled: boolean | undefined;
  manualQuantityReason: string;
};
export type ClinicalPathologyCategoryId = import("./order-taxonomy").OrderLabFamilyCode
  | "in-house-blood"
  | "microbiology"
  | "electrolyte-abg"
  | "chemistry"
  | "cbc"
  | "csf"
  | "cell"
  | "fluid"
  | "urinalysis"
  | "etc";

export const clinicalPathologyCategoryOptions: Array<{
  label: string;
  value: ClinicalPathologyCategoryId;
}> = [
  { label: "원내 혈액 검사", value: "in-house-blood" },
  { label: "임상 미생물 검사", value: "microbiology" },
  { label: "전해질검사/동맥혈", value: "electrolyte-abg" },
  { label: "혈액화학검사", value: "chemistry" },
  { label: "CBC검사", value: "cbc" },
  { label: "CSF검사", value: "csf" },
  { label: "세포 검사", value: "cell" },
  { label: "체액 검사", value: "fluid" },
  { label: "요검사", value: "urinalysis" },
  { label: "기타 병리 검사", value: "etc" },
  { label: "분변·기생충", value: "fecal-parasitology" },
  { label: "응고", value: "coagulation" },
  { label: "장기·대사 평가", value: "organ-metabolic" },
  { label: "혈액형", value: "blood-typing" },
  { label: "망상적혈구", value: "reticulocyte" },
  { label: "혈액도말", value: "blood-smear" },
  { label: "췌장", value: "pancreatic" },
  { label: "염증", value: "inflammation" },
  { label: "갑상샘", value: "thyroid" },
  { label: "부신", value: "adrenal" },
  { label: "감염병", value: "infectious-disease" },
  { label: "복합 검사 평가", value: "composite-assessment" },
];

export type HospitalOrderCategory = {
  id: HospitalOrderCategoryId;
  label: string;
  description: string;
  sortOrder: number;
};

export type HospitalOrderSubcategory = {
  id: HospitalOrderSubcategoryId;
  categoryId: HospitalOrderCategoryId;
  label: string;
  description: string;
  sortOrder: number;
};

export type HospitalOrderReference = {
  label: string;
  value: string;
};

export type HospitalOrderCatalogItem = {
  id: string;
  aliases: string;
  billable: boolean;
  billingName: string;
  careGuide: string;
  categoryId: HospitalOrderCategoryId;
  classificationStatus?: "resolved" | "subcategory_missing" | "taxonomy_unavailable" | "type_missing" | "taxonomy_unclassified" | "taxonomy_conflict" | "taxonomy_retired";
  /** Effective master/workspace execution defaults (never schema defaults). */
  defaultDetailInputs?: Record<string, unknown>;
  defaultDetailInputsSource?: PersistedOrderDefaultsSource;
  clinicalOrderType?: ClinicalOrderType;
  detailSchemaVersion?: number;
  clinicalPathologyCategoryId?: ClinicalPathologyCategoryId;
  delivery: HospitalOrderDelivery;
  hospitalInstruction: string;
  inHospitalName: string;
  isActive: boolean;
  isTaxable: boolean;
  memo: string;
  orderType: HospitalOrderType;
  price: number;
  priceMode?: HospitalOrderPriceMode;
  dispensingDosageForm?: string;
  dispensingPreset?: HospitalDispensingPreset;
  dispensingStrength?: string;
  sourceKind?: "clair_master" | "hospital_created" | "legacy";
  dispensingReviewStatus?: HospitalDispensingReviewStatus;
  dispensingReviewRevision?: number;
  dispensingAuthoredBy?: string;
  dispensingReviewedBy?: string;
  referenceItems: HospitalOrderReference[];
  roundRule: HospitalOrderRoundRule;
  saleUnit: HospitalOrderSaleUnit;
  serviceItemType: ServiceItemType;
  sourceCatalogItem?: OrderCatalogItem;
  standardName: string;
  subcategoryId: HospitalOrderSubcategoryId;
  target: HospitalOrderTarget;
  updatedAtLabel: string;
  updatedBy: string;
};

export type HospitalOrderDraft = Omit<HospitalOrderCatalogItem, "id"> & {
  id?: string;
};

export const hospitalOrderCategories: HospitalOrderCategory[] = [
  { id: "unclassified", label: "분류 미설정", description: "저장된 분류를 확인할 수 없는 오더", sortOrder: 100 },
  {
    id: "consultation",
    label: "진료",
    description: "진료비와 상담성 오더를 관리합니다.",
    sortOrder: 5,
  },
  {
    id: "prevention",
    label: "예방",
    description: "백신과 예방 관련 오더를 관리합니다.",
    sortOrder: 8,
  },
  {
    id: "lab",
    label: "검사",
    description: "임상병리, 혈액화학, 외부 의뢰 검사를 관리합니다.",
    sortOrder: 10,
  },
  {
    id: "dispensing",
    label: "처방/조제",
    description: "차트 처방과 조제 업무로 전달되는 항목입니다.",
    sortOrder: 20,
  },
  {
    id: "treatment",
    label: "처치",
    description: "진료실과 처치실로 전달되는 일감 항목입니다.",
    sortOrder: 30,
  },
  {
    id: "imaging",
    label: "영상",
    description: "영상 촬영과 판독 업무 항목입니다.",
    sortOrder: 40,
  },
  {
    id: "surgery",
    label: "수술",
    description: "마취와 수술 관련 오더를 관리합니다.",
    sortOrder: 50,
  },
  {
    id: "hospitalization",
    label: "입원",
    description: "입원료와 입원 중 관리 항목입니다.",
    sortOrder: 60,
  },
  {
    id: "therapy",
    label: "치료",
    description: "치료 프로그램과 반복 치료 항목입니다.",
    sortOrder: 70,
  },
  {
    id: "misc",
    label: "기타",
    description: "기타 임상 오더와 구조화 입력을 관리합니다.",
    sortOrder: 80,
  },
  {
    id: "medical-supply",
    label: "의료물품",
    description: "진료와 조제에 쓰이는 의료물품입니다.",
    sortOrder: 90,
  },
];

export const hospitalOrderSubcategories: HospitalOrderSubcategory[] = [
  { id: "unclassified", categoryId: "unclassified", label: "미설정", description: "세부 분류가 확인되지 않음", sortOrder: 100 },
  {
    id: "basic-consultation",
    categoryId: "consultation",
    label: "기본 진료비",
    description: "기본 진찰과 상담료",
    sortOrder: 10,
  },
  {
    id: "other-consultation",
    categoryId: "consultation",
    label: "기타 진료비",
    description: "기타 진료 관련 항목",
    sortOrder: 20,
  },
  {
    id: "prevention",
    categoryId: "prevention",
    label: "예방",
    description: "백신과 예방 관리 항목",
    sortOrder: 10,
  },
  {
    id: "clinical-pathology",
    categoryId: "lab",
    label: "임상병리",
    description: "CBC, 전해질, 기본 혈액 검사",
    sortOrder: 10,
  },
  {
    id: "blood-chemistry",
    categoryId: "lab",
    label: "혈액화학",
    description: "혈청화학, 간/신장 panel",
    sortOrder: 20,
  },
  {
    id: "system-exam",
    categoryId: "lab",
    label: "계통검사",
    description: "계통별 신체검사와 소견 입력",
    sortOrder: 25,
  },
  {
    id: "external-lab",
    categoryId: "lab",
    label: "외부의뢰",
    description: "외부 검사기관 의뢰 항목",
    sortOrder: 30,
  },
  {
    id: "oral-medication",
    categoryId: "dispensing",
    label: "경구",
    description: "정제, 캡슐, 산제",
    sortOrder: 10,
  },
  {
    id: "injection",
    categoryId: "dispensing",
    label: "주사",
    description: "주사제와 원내 투약",
    sortOrder: 20,
  },
  {
    id: "basic-treatment",
    categoryId: "treatment",
    label: "처치",
    description: "드레싱, 처치, 간호 업무",
    sortOrder: 10,
  },
  {
    id: "anesthesia",
    categoryId: "surgery",
    label: "마취",
    description: "마취 관련 항목",
    sortOrder: 10,
  },
  {
    id: "surgery",
    categoryId: "surgery",
    label: "수술",
    description: "수술 관련 항목",
    sortOrder: 20,
  },
  {
    id: "hospitalization",
    categoryId: "hospitalization",
    label: "입원",
    description: "입원료와 입원 관리 항목",
    sortOrder: 10,
  },
  {
    id: "therapy",
    categoryId: "therapy",
    label: "치료",
    description: "치료 프로그램 항목",
    sortOrder: 10,
  },
  {
    id: "radiography",
    categoryId: "imaging",
    label: "방사선",
    description: "X-ray 촬영",
    sortOrder: 10,
  },
  {
    id: "ultrasound",
    categoryId: "imaging",
    label: "초음파",
    description: "초음파 촬영과 판독",
    sortOrder: 20,
  },
  {
    id: "medical-supply",
    categoryId: "medical-supply",
    label: "의료물품",
    description: "소모품과 의료물품",
    sortOrder: 10,
  },
  {
    id: "other",
    categoryId: "misc",
    label: "기타",
    description: "기타 구조화 임상 오더",
    sortOrder: 10,
  },
];

// New vocabulary labels only; this adds no catalog rows or default values.
hospitalOrderSubcategories.push(
  { id: "image-interpretation", categoryId: "imaging", label: "영상 판독 상담", description: "영상 판독 상담", sortOrder: 50 },
  { id: "dental-care", categoryId: "treatment", label: "치과 진료·처치", description: "치과 진료·처치", sortOrder: 50 },
  { id: "document-service", categoryId: "misc", label: "서류 발급·기록 사본", description: "서류 발급·기록 사본", sortOrder: 50 },
  { id: "emergency-service", categoryId: "misc", label: "응급 서비스", description: "응급 서비스", sortOrder: 50 },
  { id: "topical", categoryId: "dispensing", label: "피부 외용", description: "피부 외용", sortOrder: 50 },
  { id: "ophthalmic", categoryId: "dispensing", label: "점안", description: "점안", sortOrder: 50 },
  { id: "otic", categoryId: "dispensing", label: "점이", description: "점이", sortOrder: 50 },
  { id: "transdermal", categoryId: "dispensing", label: "경피", description: "경피", sortOrder: 50 },
  { id: "oromucosal", categoryId: "dispensing", label: "구강점막", description: "구강점막", sortOrder: 50 },
  { id: "dispensing-packaging", categoryId: "dispensing", label: "조제 포장", description: "조제 포장", sortOrder: 50 },
);

export const hospitalOrderSeedItems: HospitalOrderCatalogItem[] = [
  {
    id: "hospital-order-ecg",
    aliases: "심전도, ECG, electrocardiogram",
    billable: true,
    billingName: "심전도 검사",
    careGuide: "검사 전후 보호자 안내가 필요한 경우 케어가이드를 작성합니다.",
    categoryId: "lab",
    clinicalPathologyCategoryId: "etc",
    delivery: "deliver",
    hospitalInstruction: "검사 후 원장 확인 전까지 결과지를 임시 저장합니다.",
    inHospitalName: "심전도 기록",
    isActive: true,
    isTaxable: true,
    memo: "판독 문구는 검사결과지에서 별도 입력합니다.",
    orderType: "individual",
    price: 8000,
    referenceItems: [
      { label: "표준 검사코드", value: "#(더미 코드)ECG-001" },
      { label: "검사 장비명", value: "CardioVet Demo" },
      { label: "표준 검사단위", value: "mV" },
    ],
    roundRule: "none",
    saleUnit: "each",
    serviceItemType: "lab",
    standardName: "[심전도 검사] 기록 및 판독",
    subcategoryId: "clinical-pathology",
    target: "dog-cat",
    updatedAtLabel: "2026년 5월 6일 오전 09:00:32",
    updatedBy: "송민재",
  },
  {
    id: "hospital-order-cbc",
    aliases: "혈구검사, CBC",
    billable: true,
    billingName: "CBC 검사",
    careGuide: "",
    categoryId: "lab",
    clinicalPathologyCategoryId: "cbc",
    delivery: "deliver",
    hospitalInstruction: "장비결과 수신 후 검사결과지에 붙여넣습니다.",
    inHospitalName: "CBC",
    isActive: true,
    isTaxable: false,
    memo: "",
    orderType: "individual",
    price: 35000,
    referenceItems: [
      { label: "표준 검사코드", value: "LAB-CBC" },
      { label: "검사 장비명", value: "Hematology Demo" },
      { label: "표준 검사단위", value: "K/µL" },
    ],
    roundRule: "none",
    saleUnit: "each",
    serviceItemType: "lab",
    standardName: "CBC 검사",
    subcategoryId: "clinical-pathology",
    target: "all",
    updatedAtLabel: "2026년 5월 5일 오후 04:10:11",
    updatedBy: "송하윤",
  },
  {
    id: "hospital-order-chemistry",
    aliases: "혈청화학, chemistry, chem10",
    billable: true,
    billingName: "혈청화학 10종",
    careGuide: "",
    categoryId: "lab",
    delivery: "deliver",
    hospitalInstruction: "혈청 분리 후 장비에 접수합니다.",
    inHospitalName: "Chem 10",
    isActive: true,
    isTaxable: false,
    memo: "",
    orderType: "individual",
    price: 48000,
    referenceItems: [
      { label: "표준 검사코드", value: "LAB-CHEM-10" },
      { label: "검사 장비명", value: "Chemistry Demo" },
      { label: "표준 검사단위", value: "mg/dL" },
    ],
    roundRule: "none",
    saleUnit: "each",
    serviceItemType: "lab",
    standardName: "혈청화학 10종",
    subcategoryId: "blood-chemistry",
    target: "all",
    updatedAtLabel: "2026년 5월 5일 오후 02:22:19",
    updatedBy: "송민재",
  },
  {
    id: "hospital-order-maropitant",
    aliases: "세레니아, 구토억제, maropitant",
    billable: true,
    billingName: "항구토제 처방",
    careGuide: "식욕, 구토 횟수, 무기력 여부를 24시간 관찰하도록 안내합니다.",
    categoryId: "dispensing",
    delivery: "deliver",
    hospitalInstruction: "체중별 용량 확인 후 조제합니다.",
    inHospitalName: "Maropitant 16mg T",
    isActive: true,
    isTaxable: false,
    memo: "",
    orderType: "individual",
    price: 4500,
    referenceItems: [
      { label: "약품 코드", value: "MED-MARO-16T" },
      { label: "성분명", value: "Maropitant" },
      { label: "기본 단위", value: "정" },
    ],
    roundRule: "none",
    saleUnit: "each",
    serviceItemType: "medication",
    standardName: "Maropitant 16mg T",
    subcategoryId: "oral-medication",
    target: "dog-cat",
    updatedAtLabel: "2026년 5월 4일 오후 01:12:55",
    updatedBy: "송하윤",
  },
  {
    id: "hospital-order-vitamin",
    aliases: "비타민주, vitamin-in, vita-in",
    billable: true,
    billingName: "비타민 주사",
    careGuide: "",
    categoryId: "dispensing",
    delivery: "deliver",
    hospitalInstruction: "피하 주사 가능 여부를 담당 수의사에게 확인합니다.",
    inHospitalName: "비타민 주사",
    isActive: true,
    isTaxable: true,
    memo: "",
    orderType: "individual",
    price: 8000,
    referenceItems: [
      { label: "약품 코드", value: "MED-VITA-IN" },
      { label: "보관", value: "실온" },
      { label: "기본 단위", value: "회" },
    ],
    roundRule: "none",
    saleUnit: "each",
    serviceItemType: "medication",
    standardName: "카도살주",
    subcategoryId: "injection",
    target: "dog-cat",
    updatedAtLabel: "2022년 9월 21일 오전 09:00:32",
    updatedBy: "박민수",
  },
  {
    id: "hospital-order-fluid",
    aliases: "수액, 피하수액, SC fluid",
    billable: true,
    billingName: "피하 수액 처치",
    careGuide: "수액 후 주사 부위 팽창은 서서히 흡수된다고 안내합니다.",
    categoryId: "treatment",
    delivery: "deliver",
    hospitalInstruction: "수액량과 속도를 차트 지시사항과 대조합니다.",
    inHospitalName: "SC 수액",
    isActive: true,
    isTaxable: false,
    memo: "",
    orderType: "individual",
    price: 18000,
    referenceItems: [
      { label: "처치 코드", value: "TRT-FLUID-SC" },
      { label: "기본 소요시간", value: "15분" },
      { label: "기본 단위", value: "회" },
    ],
    roundRule: "none",
    saleUnit: "session",
    serviceItemType: "treatment",
    standardName: "피하 수액 처치",
    subcategoryId: "basic-treatment",
    target: "all",
    updatedAtLabel: "2026년 5월 3일 오전 10:31:08",
    updatedBy: "송민재",
  },
  {
    id: "hospital-order-radiography",
    aliases: "xray, 방사선, 흉부",
    billable: true,
    billingName: "흉부 방사선",
    careGuide: "",
    categoryId: "imaging",
    delivery: "deliver",
    hospitalInstruction: "촬영 후 판독 대기열로 전달합니다.",
    inHospitalName: "흉부 X-ray",
    isActive: true,
    isTaxable: false,
    memo: "",
    orderType: "individual",
    price: 42000,
    referenceItems: [
      { label: "영상 코드", value: "IMG-THORAX-XR" },
      { label: "촬영 부위", value: "흉부" },
      { label: "기본 단위", value: "회" },
    ],
    roundRule: "none",
    saleUnit: "session",
    serviceItemType: "imaging",
    standardName: "흉부 방사선",
    subcategoryId: "radiography",
    target: "all",
    updatedAtLabel: "2026년 5월 2일 오후 03:24:00",
    updatedBy: "송민재",
  },
  {
    id: "hospital-order-abdomen-us",
    aliases: "초음파, 복부초음파, abdomen sono",
    billable: true,
    billingName: "복부 초음파",
    careGuide: "",
    categoryId: "imaging",
    delivery: "deliver",
    hospitalInstruction: "금식 여부와 보호자 동의를 확인합니다.",
    inHospitalName: "Abdomen US",
    isActive: false,
    isTaxable: false,
    memo: "신규 장비 도입 전까지 일시중지",
    orderType: "individual",
    price: 77000,
    referenceItems: [
      { label: "영상 코드", value: "IMG-ABD-US" },
      { label: "촬영 부위", value: "복부" },
      { label: "기본 단위", value: "회" },
    ],
    roundRule: "none",
    saleUnit: "session",
    serviceItemType: "imaging",
    standardName: "복부 초음파",
    subcategoryId: "ultrasound",
    target: "dog-cat",
    updatedAtLabel: "2026년 5월 1일 오후 06:18:44",
    updatedBy: "송민재",
  },
];

export const saleUnitLabels: Record<HospitalOrderSaleUnit, string> = {
  day: "일당",
  each: "개당",
  pack: "포장",
  session: "회당",
};

export const roundRuleLabels: Record<HospitalOrderRoundRule, string> = {
  none: "그대로",
  "round-10": "10원 단위",
  "round-100": "100원 단위",
};

export const deliveryLabels: Record<HospitalOrderDelivery, string> = {
  deliver: "전달",
  "do-not-deliver": "전달안함",
};

export const targetLabels: Record<HospitalOrderTarget, string> = {
  all: "전체",
  cat: "고양이",
  dog: "개",
  "dog-cat": "개, 고양이",
  other: "기타",
};

export const serviceItemTypeLabels: Record<ServiceItemType, string> = {
  consultation: "진료",
  hospitalization: "입원",
  imaging: "영상",
  lab: "검사",
  medication: "의약품",
  misc: "기타",
  treatment: "처치",
};

export function getHospitalOrderCategory(categoryId: HospitalOrderCategoryId) {
  return hospitalOrderCategories.find((category) => category.id === categoryId);
}

export function getHospitalOrderSubcategory(subcategoryId: HospitalOrderSubcategoryId) {
  return hospitalOrderSubcategories.find((subcategory) => subcategory.id === subcategoryId);
}

export function getSubcategoriesForCategory(categoryId: HospitalOrderCategoryId) {
  return hospitalOrderSubcategories
    .filter((subcategory) => subcategory.categoryId === categoryId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getDefaultSubcategoryId(categoryId: HospitalOrderCategoryId) {
  return getSubcategoriesForCategory(categoryId)[0]?.id;
}

export function createEmptyHospitalOrderDraft(
  categoryId: HospitalOrderCategoryId,
  subcategoryId: HospitalOrderSubcategoryId
): HospitalOrderDraft {
  const dispensing = categoryId === "dispensing";
  const serviceItemType = getHospitalOrderServiceItemType(categoryId);
  const clinicalOrderType = getHospitalOrderClinicalOrderType(
    categoryId,
    subcategoryId,
  );
  return {
    aliases: "",
    billable: true,
    billingName: "",
    careGuide: "",
    categoryId,
    clinicalOrderType,
    detailSchemaVersion: 1,
    delivery: "deliver",
    hospitalInstruction: "",
    inHospitalName: "",
    isActive: !dispensing,
    isTaxable: false,
    memo: "",
    orderType: "individual",
    price: 0,
    priceMode: dispensing ? "per_quantity" : "fixed",
    dispensingPreset: dispensing
      ? createEmptyHospitalDispensingPreset()
      : undefined,
    sourceKind: dispensing ? "hospital_created" : "legacy",
    dispensingReviewStatus: dispensing ? "pending" : "not_required",
    dispensingReviewRevision: dispensing ? 1 : 0,
    referenceItems: [
      { label: "관리 코드", value: "NEW-ORDER" },
      { label: "참조명", value: "-" },
      { label: "기본 단위", value: "-" },
    ],
    roundRule: "none",
    saleUnit: "each",
    serviceItemType,
    standardName: "",
    subcategoryId,
    target: "all",
    updatedAtLabel: "방금",
    updatedBy: "송민재",
  };
}

function getHospitalOrderServiceItemType(
  categoryId: HospitalOrderCategoryId,
): ServiceItemType {
  if (categoryId === "dispensing") {
    return "medication";
  }
  if (categoryId === "lab") return "lab";
  if (categoryId === "imaging") return "imaging";
  if (categoryId === "hospitalization") return "hospitalization";
  if (categoryId === "misc") return "misc";
  if (categoryId === "medical-supply") return "misc";
  if (categoryId === "prevention") return "consultation";
  if (categoryId === "consultation") return "consultation";
  return "treatment";
}

function getHospitalOrderClinicalOrderType(
  categoryId: HospitalOrderCategoryId,
  subcategoryId: HospitalOrderSubcategoryId,
): ClinicalOrderType {
  if (Object.hasOwn(orderTaxonomySubcategories, subcategoryId)) {
    return orderTaxonomySubcategories[subcategoryId as keyof typeof orderTaxonomySubcategories].clinicalType;
  }
  if (subcategoryId === "system-exam") return "system_exam";
  if (subcategoryId === "external-lab") return "external_lab";
  if (categoryId === "consultation" || categoryId === "prevention") return "consultation";
  if (categoryId === "lab") return "clinical_lab";
  if (categoryId === "imaging") return "imaging";
  if (categoryId === "hospitalization") return "hospitalization";
  if (categoryId === "misc" || categoryId === "medical-supply") return "other";
  if (categoryId === "dispensing") {
    return "dispensing";
  }
  return "treatment";
}

function createEmptyHospitalDispensingPreset(): HospitalDispensingPreset {
  return {
    ingredientName: "",
    doseBasis: "",
    dose: undefined,
    doseUnit: "",
    route: "",
    frequency: "",
    durationDays: undefined,
    totalQuantity: undefined,
    totalQuantityUnit: "",
    medicationInstruction: "",
    storageMethod: "",
    compoundNote: "",
    guardianNote: "",
    autoDispenseQuantityEnabled: undefined,
    manualQuantityReason: "",
  };
}

export function formatHospitalOrderAmount(amount: number) {
  return `${amount.toLocaleString()}원`;
}

/**
 * Return the authored execution defaults for a catalog row.
 *
 * The generic catalog column is authoritative when it contains values. Older
 * medication rows may only have the nested representation, so keep that as a
 * compatibility fallback. Every returned object is cloned so drawer edits
 * cannot mutate the server response kept in `sourceCatalogItem`.
 */
export function getEffectiveHospitalOrderDefaultDetailInputs(
  item: Pick<OrderCatalogItem, "defaultDetailInputs" | "medicationMetadata">,
): Record<string, unknown> | undefined {
  return readPersistedOrderDefaults(item).storedValues;
}

export function mapWorkspaceCatalogItemToHospitalOrder(item: OrderCatalogItem): HospitalOrderCatalogItem {
  const placement = resolveHospitalOrderPlacement(item);
  const dispensingProfile = readDispensingProfile(item);
  const executionContract = resolveClinicalOrderMasterContract({
    categoryGroup: item.categoryGroup,
    clinicalOrderType: item.clinicalOrderType,
    isExternalLab: item.isExternalLab,
    destinationModule: item.destinationModule,
    defaultDestinationModule: item.defaultDestinationModule,
    executionMode: item.executionMode,
    defaultTaskRequired: item.defaultTaskRequired,
    detailSchemaVersion: item.detailSchemaVersion,
    detailFieldSchema: item.detailFieldSchema,
    billingEligible: item.billingEligible,
    billingReflectionEnabled: item.billingReflectionEnabled,
  });

  return {
    id: item.id,
    aliases: item.aliases.join(", "),
    billable: item.billingReflectionEnabled,
    billingName: item.billingName,
    careGuide: item.careGuide ?? "",
    categoryId: placement.categoryId,
    clinicalOrderType: item.clinicalOrderTypeSource === "derived" ? undefined : item.clinicalOrderType,
    classificationStatus: placement.classificationStatus,
    // A persisted taxonomy UUID cannot establish a pathology family by itself.
    delivery: item.defaultTaskRequired ? "deliver" : "do-not-deliver",
    defaultDetailInputs: getEffectiveHospitalOrderDefaultDetailInputs(item),
    defaultDetailInputsSource: readPersistedOrderDefaults(item).source,
    detailSchemaVersion: executionContract.detailSchemaVersion,
    hospitalInstruction: item.internalInstruction ?? "",
    inHospitalName:
      dispensingProfile.korean ?? item.inHospitalOrderName,
    isActive:
      item.availabilityStatus === "active" ||
      (item.availabilityStatus === "pending_activation" &&
        item.dispensingLineage?.serviceReviewOnly === true &&
        item.priceKrw !== null),
    isTaxable: item.taxIncluded,
    memo: buildCatalogMemo(item),
    orderType: "individual",
    price: item.priceKrw ?? 0,
    priceMode:
      item.pricingRule.priceBasis === "unit_price"
        ? "per_quantity"
        : "fixed",
    dispensingDosageForm: dispensingProfile.dosageForm,
    dispensingPreset: readHospitalDispensingPreset(item),
    dispensingStrength: dispensingProfile.strength,
    sourceKind:
      item.originType === "clair_master"
        ? "clair_master"
        : item.originType === "workspace_custom" &&
            item.categoryGroup === "medication" &&
            item.defaultDestinationModule === "dispensing"
          ? "hospital_created"
          : "legacy",
    dispensingReviewStatus:
      item.workspaceDispensingReview?.status ?? "not_required",
    dispensingReviewRevision:
      item.workspaceDispensingReview?.revision ?? 0,
    dispensingAuthoredBy:
      item.workspaceDispensingReview?.authoredByUserId,
    dispensingReviewedBy:
      item.workspaceDispensingReview?.reviewedByUserId,
    referenceItems: [
      { label: "Source preset", value: item.standardOrderId },
      { label: "Preset version", value: item.sourcePresetVersion },
      { label: "Destination", value: item.defaultDestinationModule },
    ],
    roundRule: mapRoundRule(item.roundingRule),
    saleUnit: mapSaleUnit(item.salesUnit),
    serviceItemType: item.categoryGroup,
    sourceCatalogItem: item,
    standardName:
      dispensingProfile.english ?? item.standardOrderName,
    subcategoryId: placement.subcategoryId,
    clinicalPathologyCategoryId: placement.classificationStatus === "resolved" && item.labFamilyCode
      ? item.labFamilyCode as ClinicalPathologyCategoryId : undefined,
    target: mapTargetSpecies(item.targetSpecies),
    updatedAtLabel: formatCatalogUpdatedAt(item.updatedAt),
    updatedBy: item.lastCustomizedByUserId ?? "CLAiR preset",
  };
}

function readHospitalDispensingPreset(
  item: OrderCatalogItem,
): HospitalDispensingPreset | undefined {
  if (
    item.categoryGroup !== "medication" ||
    item.defaultDestinationModule !== "dispensing"
  ) {
    return undefined;
  }
  const metadata = item.medicationMetadata;
  const authority = item.planOrderAuthority;
  const detail =
    getEffectiveHospitalOrderDefaultDetailInputs(item) ?? {};
  const readString = (key: string, fallback = "") =>
    typeof detail[key] === "string" && detail[key].trim()
      ? detail[key].trim()
      : fallback;
  const readNumber = (key: string) =>
    typeof detail[key] === "number" && Number.isFinite(detail[key])
      ? detail[key]
      : undefined;
  return {
    ingredientName:
      authority?.schemaVersion === 2 && authority.productReference
        ? authority.productReference.productName :
      metadata?.ingredientKoreanName ??
      metadata?.ingredientEnglishName ??
      "",
    dose: readNumber("dose"),
    doseBasis: readString("doseBasis"),
    doseUnit: readString("doseUnit"),
    route: readString("route"),
    frequency: readString("frequency"),
    durationDays: readNumber("durationDays"),
    totalQuantity: readNumber("totalQuantity"),
    totalQuantityUnit: readString("totalQuantityUnit"),
    medicationInstruction: readString("medicationInstruction"),
    storageMethod: readString("storageMethod"),
    compoundNote: readString("compoundNote"),
    guardianNote: readString("guardianNote"),
    // Explicit persisted editor policy, not a clinical detail or a default literal.
    autoDispenseQuantityEnabled: authority?.schemaVersion === 2 && authority.preparationPolicy
      ? true : typeof metadata?.autoDispenseQuantityEnabled === "boolean"
      ? metadata.autoDispenseQuantityEnabled : undefined,
    manualQuantityReason: readString("manualQuantityReason"),
  };
}


export function mapWorkspaceCatalogItemsToHospitalOrders(items: OrderCatalogItem[]) {
  return items.map(mapWorkspaceCatalogItemToHospitalOrder);
}

export function buildWorkspaceCatalogMutationFromHospitalOrder({
  draft,
  source,
  workspaceId,
}: {
  draft: HospitalOrderDraft;
  source?: OrderCatalogItem;
  workspaceId: string;
}): OrderCatalogMutationInput {
  if (source) {
    const baseline = draft.sourceCatalogItem ?? source;
    if (baseline.id !== source.id || baseline.workspaceId !== workspaceId) {
      throw new Error("catalog_draft_source_mismatch");
    }
    return {
      action: "update",
      itemId: baseline.id,
      expectedCatalogRevision: baseline.catalogRevision ?? 1,
      patch: buildWorkspaceCatalogPatchFromHospitalOrder(draft, baseline),
    };
  }

  return {
    action: "create",
    item: buildWorkspaceCatalogCreateInputFromHospitalOrder(draft, workspaceId),
  };
}

export function buildWorkspaceCatalogPauseMutation(
  orderId: string,
  expectedCatalogRevision: number,
): OrderCatalogMutationInput {
  return { action: "pause", itemId: orderId, expectedCatalogRevision };
}

export function getHospitalOrderTaxonomyFields(draft: HospitalOrderDraft) {
  return {
    adminSubcategoryCode: draft.subcategoryId === "unclassified" ? null
      : draft.subcategoryId === "blood-chemistry" ? "clinical-pathology" : draft.subcategoryId,
    labFamilyCode: draft.subcategoryId === "blood-chemistry" ? "chemistry"
      : draft.subcategoryId === "clinical-pathology" ? draft.clinicalPathologyCategoryId ?? null : null,
  };
}

export function isHospitalOrderTaxonomyChanged(draft: HospitalOrderDraft, source: OrderCatalogItem) {
  const previous = mapWorkspaceCatalogItemToHospitalOrder(source);
  return draft.subcategoryId !== previous.subcategoryId ||
    draft.clinicalPathologyCategoryId !== previous.clinicalPathologyCategoryId;
}

export function isHospitalOrderTaxonomyOnlyChange(draft: HospitalOrderDraft, source: OrderCatalogItem) {
  const previous = mapWorkspaceCatalogItemToHospitalOrder(source);
  return isHospitalOrderTaxonomyChanged(draft, source) &&
    (Object.keys(previous) as Array<keyof HospitalOrderCatalogItem>)
      .filter(key => !["id", "categoryId", "subcategoryId", "clinicalPathologyCategoryId", "classificationStatus"].includes(key))
      .every(key => JSON.stringify(draft[key]) === JSON.stringify(previous[key]));
}

function buildWorkspaceCatalogPatchFromHospitalOrder(
  draft: HospitalOrderDraft,
  source: OrderCatalogItem
): Partial<OrderCatalogItem> {
  const salesUnit = mapHospitalSaleUnitToCatalogSalesUnit(draft.saleUnit);
  const pricingRule = {
    ...source.pricingRule,
    billingReflectionEnabled: draft.billable,
    priceBasis:
      draft.priceMode === "per_quantity"
        ? ("unit_price" as const)
        : ("fixed_order_price" as const),
    priceKrw: draft.price,
    salesUnit,
    taxIncluded: draft.isTaxable,
  };

  const medicationMetadata = buildMedicationMetadataFromHospitalOrder(
    draft,
    source.medicationMetadata,
  );
  const effectiveDefaultDetailInputs =
    draft.categoryId === "dispensing"
      ? medicationMetadata?.defaultDetailInputs
      : draft.defaultDetailInputs;

  const taxonomyChanged = isHospitalOrderTaxonomyChanged(draft, source);
  const taxonomyPatch = taxonomyChanged ? getHospitalOrderTaxonomyFields(draft) : {};
  // Do not resend unchanged clinical fields: the dispensing writer correctly
  // treats explicit clinical edits as substantive, even when values look equal.
  if (isHospitalOrderTaxonomyOnlyChange(draft, source)) return taxonomyPatch;

  return {
    ...taxonomyPatch,
    aliases: splitAliases(draft.aliases),
    availabilityStatus:
      source.dispensingLineage?.serviceReviewOnly === true
        ? draft.isActive
          ? "pending_activation"
          : "paused"
        : draft.isActive
          ? "active"
          : "paused",
    billingName: draft.billingName,
    billingReflectionEnabled: draft.billable,
    careGuide: draft.careGuide,
    inHospitalOrderName: draft.inHospitalName,
    internalInstruction: draft.hospitalInstruction,
    // Keep both representations in sync while older readers still consume
    // medicationMetadata.defaultDetailInputs. The generic copy is explicit,
    // deep-cloned, and authoritative for the new catalog/chart path.
    ...(effectiveDefaultDetailInputs !== undefined
      ? {
          defaultDetailInputs: structuredClone(
            effectiveDefaultDetailInputs,
          ),
        }
      : {}),
    medicationMetadata,
    priceKrw: draft.price,
    pricingRule,
    roundingRule: mapHospitalRoundRuleToCatalogRoundRule(draft.roundRule),
    salesUnit,
    targetSpecies: mapHospitalTargetToSpecies(draft.target),
    taxIncluded: draft.isTaxable,
  };
}

function buildWorkspaceCatalogCreateInputFromHospitalOrder(
  draft: HospitalOrderDraft,
  workspaceId: string
): Omit<OrderCatalogItem, "id" | "updatedAt"> & { id?: string } {
  const catalogDefaults = resolveCatalogDefaultsFromHospitalOrder(draft);
  const salesUnit = mapHospitalSaleUnitToCatalogSalesUnit(draft.saleUnit);
  const priceBasis: OrderCatalogPriceBasis =
    draft.priceMode === "per_quantity"
      ? "unit_price"
      : "fixed_order_price";

  return {
    id: draft.id,
    workspaceId,
    standardOrderId: `custom-${draft.id ?? Date.now().toString(36)}`,
    sourcePresetVersion: "custom-v1",
    initialImportedPresetVersion: "custom-v1",
    lastAutoMergedPresetVersion: undefined,
    customizationState: "detached",
    customizedFields: ["*"],
    presetMergeStatus: "detached",
    originType: "workspace_custom",
    ...getHospitalOrderTaxonomyFields(draft),
    categoryGroup: catalogDefaults.categoryGroup,
    ...(draft.clinicalOrderType
      ? { clinicalOrderType: draft.clinicalOrderType }
      : {}),
    ...(draft.detailSchemaVersion !== undefined
      ? { detailSchemaVersion: draft.detailSchemaVersion }
      : {}),
    categoryLabel: getHospitalOrderSubcategory(draft.subcategoryId)?.label ?? catalogDefaults.categoryLabel,
    standardOrderName: draft.standardName,
    inHospitalOrderName: draft.inHospitalName,
    billingName: draft.billingName,
    aliases: splitAliases(draft.aliases),
    availabilityStatus:
      draft.categoryId === "dispensing"
        ? "pending_activation"
        : draft.isActive
          ? "active"
          : "paused",
    priceKrw: draft.price,
    salesUnit,
    targetSpecies: mapHospitalTargetToSpecies(draft.target),
    defaultDestinationModule: catalogDefaults.defaultDestinationModule,
    defaultTaskRequired: draft.delivery === "deliver",
    billingReflectionEnabled: draft.billable,
    careGuide: draft.careGuide,
    internalInstruction: draft.hospitalInstruction,
    taxIncluded: draft.isTaxable,
    roundingRule: mapHospitalRoundRuleToCatalogRoundRule(draft.roundRule),
    linkedLabItemIds: [],
    linkedLabCategoryIds: [],
    medicationMetadata: buildMedicationMetadataFromHospitalOrder(draft),
    defaultDetailInputs: structuredClone(
      draft.dispensingPreset
        ? buildMedicationMetadataFromHospitalOrder(draft)?.defaultDetailInputs
        : draft.defaultDetailInputs,
    ),
    pricingRule: {
      priceBasis,
      priceKrw: draft.price,
      salesUnit,
      taxIncluded: draft.isTaxable,
      roundingRule: "as_is",
      billingReflectionEnabled: draft.billable,
    },
  };
}

export function buildWorkspaceDispensingReviewMutation(
  orderId: string,
  expectedCatalogRevision: number,
  decision: "approve" | "reject",
  note?: string,
): OrderCatalogMutationInput {
  return {
    action: "review",
    itemId: orderId,
    expectedCatalogRevision,
    decision,
    note,
  };
}

function buildMedicationMetadataFromHospitalOrder(
  draft: HospitalOrderDraft,
  source?: OrderCatalogItem["medicationMetadata"],
): OrderCatalogItem["medicationMetadata"] {
  const preset = draft.dispensingPreset;
  if (!preset) return source;
  const frequencyDailyCount = getHospitalFrequencyDailyCount(
    preset.frequency,
  );
  const defaultDetailInputs = structuredClone(draft.defaultDetailInputs ?? {});
  // Overlay the editor on the selected persisted object; clearing a field must
  // remove it from both representations, never revive the old nested value.
  const { ingredientName: _ingredient, autoDispenseQuantityEnabled: _auto, manualQuantityReason: _reason, ...editedDetails } = preset;
  void _ingredient;
  void _auto;
  void _reason;
  delete defaultDetailInputs.autoDispenseQuantityEnabled;
  if (preset.manualQuantityReason) defaultDetailInputs.manualQuantityReason = preset.manualQuantityReason;
  else delete defaultDetailInputs.manualQuantityReason;
  for (const [key, value] of Object.entries(editedDetails)) {
    if (value === undefined || value === "") delete defaultDetailInputs[key];
    else defaultDetailInputs[key] = value;
  }
  return {
    ...source,
    schemaVersion: 2,
    presetOrigin:
      draft.sourceKind === "clair_master" ? "clair_master" : "workspace",
    defaultDetailInputs,
    autoDispenseQuantityEnabled: preset.autoDispenseQuantityEnabled,
    administrationDays: preset.durationDays,
    dailyFrequencyCode: preset.frequency || undefined,
    frequencyDailyCount,
    doseAmount: preset.dose,
    doseAmountUnit: preset.doseUnit || undefined,
    administrationRoute:
      (preset.route || undefined) as NonNullable<
        OrderCatalogItem["medicationMetadata"]
      >["administrationRoute"],
    dispenseUnit: preset.totalQuantityUnit || undefined,
    medicationInstruction:
      (preset.medicationInstruction || undefined) as NonNullable<
        OrderCatalogItem["medicationMetadata"]
      >["medicationInstruction"],
    storageMethod:
      (preset.storageMethod || undefined) as NonNullable<
        OrderCatalogItem["medicationMetadata"]
      >["storageMethod"],
    ingredientKoreanName: preset.ingredientName,
    ingredientEnglishName: source?.ingredientEnglishName,
  };
}

export function getHospitalFrequencyDailyCount(frequency: string) {
  if (frequency === "bid") return 2;
  if (frequency === "tid") return 3;
  if (frequency === "qid") return 4;
  if (frequency === "qod") return 0.5;
  if (frequency === "once") return 1;
  if (frequency === "sid") return 1;
  return undefined;
}

export function calculateHospitalDispenseQuantity(
  preset: HospitalDispensingPreset,
  storedAuthority?: unknown,
) {
  const frequency = getHospitalFrequencyDailyCount(preset.frequency);
  // A per-patient same-unit quantity is the only conversion this editor owns.
  // Weight/BSA, strength and cross-unit conversions require explicit inputs.
  if (preset.doseBasis !== "patient" || !preset.doseUnit ||
    preset.doseUnit !== preset.totalQuantityUnit ||
    typeof preset.dose !== "number" || !Number.isFinite(preset.dose) ||
    typeof preset.durationDays !== "number" || !Number.isFinite(preset.durationDays) ||
    frequency === undefined) return undefined;
  if (storedAuthority !== undefined && storedAuthority !== null) {
    const parsed = parsePlanOrderAuthority(storedAuthority);
    if (!parsed.valid) return undefined;
    if (parsed.value?.schemaVersion === 2) {
      if (parsed.value.calculationMode !== "product_unit" || parsed.value.dispenseUnit !== preset.doseUnit) return undefined;
      return proposePlanOrderPreparation({ config: parsed.value, theoreticalPerAdministration: preset.dose,
        occurrences: { kind: "daily", durationDays: preset.durationDays, dailyCount: frequency } })?.plannedPracticalTotal;
    }
  }
  const quantity = preset.dose * frequency * preset.durationDays;
  return Number.isFinite(quantity) ? quantity : undefined;
}

export function resolveHospitalOrderPlacement(item: OrderCatalogItem): {
  categoryId: HospitalOrderCategoryId;
  subcategoryId: HospitalOrderSubcategoryId;
  classificationStatus: NonNullable<HospitalOrderCatalogItem["classificationStatus"]>;
} {
  // Clinical type is authoritative even for system_exam stored under misc.
  // Labels, names, provenance and opaque UUIDs cannot establish a subtype.
  const type = item.clinicalOrderTypeSource === "derived" ? undefined : item.clinicalOrderType;
  const categories: Partial<Record<ClinicalOrderType, HospitalOrderCategoryId>> = {
    consultation: "consultation", clinical_lab: "lab", system_exam: "lab",
    external_lab: "lab", imaging: "imaging", dispensing: "dispensing",
    treatment: "treatment", hospitalization: "hospitalization", other: "misc",
  };
  const groups: Partial<Record<ServiceItemType, HospitalOrderCategoryId>> = {
    consultation: "consultation", lab: "lab", imaging: "imaging",
    medication: "dispensing", treatment: "treatment", hospitalization: "hospitalization", misc: "misc",
  };
  const categoryId = type
    ? Object.hasOwn(categories, type) ? categories[type]! : "unclassified"
    : Object.hasOwn(groups, item.categoryGroup) ? groups[item.categoryGroup]! : "unclassified";
  const subcategories: Partial<Record<ClinicalOrderType, HospitalOrderSubcategoryId>> = {
    system_exam: "system-exam", external_lab: "external-lab",
    hospitalization: "hospitalization", other: "other",
  };
  const subcategoryId = type && Object.hasOwn(subcategories, type) ? subcategories[type]! : "unclassified";
  if (item.classificationPathReadFailed) {
    return { categoryId, subcategoryId: "unclassified", classificationStatus: "taxonomy_unavailable" };
  }
  const path = item.classificationPath;
  if (path && (path.id !== item.classificationPathId || path.itemType !== item.categoryGroup)) {
    return { categoryId, subcategoryId: "unclassified", classificationStatus: "taxonomy_conflict" };
  }
  if (path?.retired || path?.isUnclassified) {
    return { categoryId, subcategoryId: "unclassified", classificationStatus: path.retired ? "taxonomy_retired" : "taxonomy_unclassified" };
  }
  if (item.adminSubcategoryCode !== undefined || item.labFamilyCode !== undefined) {
    if (!isOrderTaxonomyValid(type, item.adminSubcategoryCode, item.labFamilyCode)) {
      return { categoryId, subcategoryId: "unclassified", classificationStatus: "taxonomy_conflict" };
    }
    if (item.adminSubcategoryCode === null) {
      return { categoryId, subcategoryId: "unclassified", classificationStatus: "subcategory_missing" };
    }
    const stored = orderTaxonomySubcategories[item.adminSubcategoryCode as keyof typeof orderTaxonomySubcategories];
    return { categoryId: stored.parent, subcategoryId: item.adminSubcategoryCode as HospitalOrderSubcategoryId, classificationStatus: "resolved" };
  }
  return { categoryId, subcategoryId, classificationStatus: !type || categoryId === "unclassified"
    ? "type_missing" : subcategoryId === "unclassified"
      ? item.classificationPathId && !path ? "taxonomy_unavailable" : "subcategory_missing"
      : "resolved" };
}

/** Category-wide views retain rows without a fine classification. */
export function isHospitalOrderInCategory(
  order: HospitalOrderCatalogItem, categoryId: string, subcategoryId: string,
) {
  if (categoryId === "unclassified") return order.classificationStatus !== "resolved" || Boolean(order.sourceCatalogItem?.taxonomyMergeConflict);
  return order.categoryId === categoryId &&
    (subcategoryId === "unclassified" || order.subcategoryId === subcategoryId);
}

export function formatHospitalOrderClassification(order: HospitalOrderDraft) {
  const category = getHospitalOrderCategory(order.categoryId)?.label ?? "미설정";
  const statusLabels = {
    taxonomy_unavailable: "저장 분류 조회 불가",
    taxonomy_unclassified: "미분류 경로 사용 중",
    taxonomy_conflict: "저장 분류 불일치",
    taxonomy_retired: "종료된 분류 경로",
  };
  const status = order.classificationStatus;
  const subcategory = status && Object.hasOwn(statusLabels, status)
    ? statusLabels[status as keyof typeof statusLabels]
    : order.sourceCatalogItem?.classificationPath && order.subcategoryId === "unclassified"
      ? "세부 분류 미설정" : getHospitalOrderSubcategory(order.subcategoryId)?.label ?? "미설정";
  const label = order.categoryId === "unclassified" ? "분류 미설정" : category + " / " + subcategory;
  return order.sourceCatalogItem?.taxonomyMergeConflict ? label + " · 갱신 충돌" : label;
}

function formatDispensingStrengthSnapshot(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  const expressions = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const numeratorValue = record.numeratorValue;
    const numeratorUnit = record.numeratorUnit;
    const denominatorValue = record.denominatorValue;
    const denominatorUnit = record.denominatorUnit;
    if (
      (typeof numeratorValue !== "number" &&
        typeof numeratorValue !== "string") ||
      typeof numeratorUnit !== "string" ||
      !numeratorUnit.trim()
    ) {
      return [];
    }

    const numerator = `${numeratorValue} ${numeratorUnit.trim()}`;
    if (typeof denominatorUnit !== "string" || !denominatorUnit.trim()) {
      return [numerator];
    }

    const denominator =
      typeof denominatorValue === "number" ||
      typeof denominatorValue === "string"
        ? `${denominatorValue} ${denominatorUnit.trim()}`
        : denominatorUnit.trim();
    return [`${numerator}/${denominator}`];
  });

  return expressions.length > 0 ? expressions.join(" · ") : undefined;
}

function readDispensingProfile(item: OrderCatalogItem) {
  const snapshot = item.dispensingLineage?.dispensingProfileSnapshot;
  if (!snapshot) return {};

  const korean = snapshot.koreanDraftName;
  const english = snapshot.englishProductName;
  const dosageForm = snapshot.dosageForm;
  return {
    dosageForm:
      typeof dosageForm === "string" && dosageForm.trim()
        ? dosageForm.trim()
        : undefined,
    korean:
      typeof korean === "string" && korean.trim() ? korean.trim() : undefined,
    english:
      typeof english === "string" && english.trim()
        ? english.trim()
        : undefined,
    strength: formatDispensingStrengthSnapshot(snapshot.strengthSnapshot),
  };
}

function mapTargetSpecies(species: OrderCatalogItem["targetSpecies"]): HospitalOrderTarget {
  const values = new Set(species);
  if (values.has("dog") && values.has("cat") && values.has("other")) return "all";
  if (values.has("dog") && values.has("cat")) return "dog-cat";
  if (values.has("dog")) return "dog";
  if (values.has("cat")) return "cat";
  return "other";
}

function mapSaleUnit(unit: OrderCatalogItem["salesUnit"]): HospitalOrderSaleUnit {
  if (unit === "per_day") return "day";
  if (unit === "per_order" || unit === "per_frequency") return "session";
  return "each";
}

function mapRoundRule(rule: OrderCatalogItem["roundingRule"]): HospitalOrderRoundRule {
  return rule === "as_is" ? "none" : "round-100";
}

function mapHospitalTargetToSpecies(target: HospitalOrderTarget): OrderCatalogItem["targetSpecies"] {
  if (target === "all") return ["dog", "cat", "other"];
  if (target === "dog-cat") return ["dog", "cat"];
  if (target === "dog") return ["dog"];
  if (target === "cat") return ["cat"];
  return ["other"];
}

function mapHospitalSaleUnitToCatalogSalesUnit(unit: HospitalOrderSaleUnit): OrderCatalogSalesUnit {
  if (unit === "day") return "per_day";
  if (unit === "session") return "per_order";
  return "per_each";
}

function mapHospitalRoundRuleToCatalogRoundRule(rule: HospitalOrderRoundRule): OrderCatalogItem["roundingRule"] {
  return rule === "none" ? "as_is" : "round";
}

function splitAliases(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveCatalogDefaultsFromHospitalOrder(draft: HospitalOrderDraft): {
  categoryGroup: ServiceItemType;
  categoryLabel: string;
  defaultDestinationModule: OrderCatalogItem["defaultDestinationModule"];
} {
  if (draft.categoryId === "consultation" || draft.categoryId === "prevention") {
    return {
      categoryGroup: "consultation",
      categoryLabel: "진료",
      defaultDestinationModule: "chart_only",
    };
  }

  if (draft.categoryId === "lab") {
    return {
      categoryGroup: "lab",
      categoryLabel: getHospitalOrderSubcategory(draft.subcategoryId)?.label ?? "검사",
      defaultDestinationModule: "lab",
    };
  }

  if (draft.categoryId === "imaging") {
    return {
      categoryGroup: "imaging",
      categoryLabel: getHospitalOrderSubcategory(draft.subcategoryId)?.label ?? "영상",
      defaultDestinationModule: "imaging",
    };
  }

  if (draft.categoryId === "dispensing") {
    return {
      categoryGroup: "medication",
      categoryLabel: getHospitalOrderSubcategory(draft.subcategoryId)?.label ?? "처방/조제",
      defaultDestinationModule: "dispensing",
    };
  }

  if (draft.categoryId === "hospitalization") {
    return {
      categoryGroup: "hospitalization",
      categoryLabel: "입원",
      defaultDestinationModule: "chart_only",
    };
  }

  if (draft.categoryId === "misc" || draft.categoryId === "medical-supply") {
    return {
      categoryGroup: "misc",
      categoryLabel: "기타",
      defaultDestinationModule: "chart_only",
    };
  }

  return {
    categoryGroup: "treatment",
    categoryLabel: getHospitalOrderSubcategory(draft.subcategoryId)?.label ?? "처치",
    defaultDestinationModule: "treatment",
  };
}

function formatCatalogUpdatedAt(value: string) {
  return value.replace("T", " ").replace(".000Z", "Z");
}

function buildCatalogMemo(item: OrderCatalogItem) {
  const parts = [
    item.customizationState ? `customization:${item.customizationState}` : null,
    item.presetMergeStatus ? `merge:${item.presetMergeStatus}` : null,
    item.dispensingLineage?.serviceReviewOnly
      ? "서비스 검토용"
      : item.availabilityStatus === "pending_activation"
        ? "검토 후 활성화"
        : null,
    item.catalogRevision ? `revision:${item.catalogRevision}` : null,
  ];

  return parts.filter(Boolean).join(" / ");
}
