"use client";

import type { ServiceItemType } from "@/types/emr-domain";
import type {
  OrderCatalogItem,
  OrderCatalogMutationInput,
  OrderCatalogPriceBasis,
  OrderCatalogSalesUnit,
} from "@/features/hospital-admin/server-order-catalog";

export type HospitalOrderCategoryId =
  | "consultation"
  | "prevention"
  | "lab"
  | "imaging"
  | "treatment"
  | "surgery"
  | "hospitalization"
  | "therapy"
  | "dispensing"
  | "medical-supply";
export type HospitalOrderSubcategoryId =
  | "basic-consultation"
  | "other-consultation"
  | "prevention"
  | "clinical-pathology"
  | "blood-chemistry"
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
  | "medical-supply";
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
  dose: number;
  doseUnit: string;
  route: string;
  frequency: string;
  durationDays: number;
  totalQuantity: number;
  totalQuantityUnit: string;
  medicationInstruction: string;
  storageMethod: string;
  compoundNote: string;
  guardianNote: string;
  autoDispenseQuantityEnabled: boolean;
  manualQuantityReason: string;
};
export type ClinicalPathologyCategoryId =
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
  dispensingPreset?: HospitalDispensingPreset;
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
    id: "medical-supply",
    label: "의료물품",
    description: "진료와 조제에 쓰이는 의료물품입니다.",
    sortOrder: 90,
  },
];

export const hospitalOrderSubcategories: HospitalOrderSubcategory[] = [
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
];

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
  return {
    aliases: "",
    billable: true,
    billingName: "",
    careGuide: "",
    categoryId,
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
    serviceItemType: dispensing ? "medication" : "lab",
    standardName: "",
    subcategoryId,
    target: "all",
    updatedAtLabel: "방금",
    updatedBy: "송민재",
  };
}

function createEmptyHospitalDispensingPreset(): HospitalDispensingPreset {
  return {
    ingredientName: "",
    dose: 1,
    doseUnit: "tablet",
    route: "PO",
    frequency: "bid",
    durationDays: 5,
    totalQuantity: 10,
    totalQuantityUnit: "tablet",
    medicationInstruction: "after_meal",
    storageMethod: "room_temp",
    compoundNote: "",
    guardianNote: "식후 1회 1정씩 하루 2회, 5일간 투여하세요.",
    autoDispenseQuantityEnabled: true,
    manualQuantityReason: "",
  };
}

export function formatHospitalOrderAmount(amount: number) {
  return `${amount.toLocaleString()}원`;
}

export function mapWorkspaceCatalogItemToHospitalOrder(item: OrderCatalogItem): HospitalOrderCatalogItem {
  const placement = resolveHospitalOrderPlacement(item);
  const dispensingProfileNames = readDispensingProfileNames(item);

  return {
    id: item.id,
    aliases: item.aliases.join(", "),
    billable: item.billingReflectionEnabled,
    billingName: item.billingName,
    careGuide: item.careGuide ?? "",
    categoryId: placement.categoryId,
    clinicalPathologyCategoryId:
      placement.subcategoryId === "clinical-pathology"
        ? resolveClinicalPathologyCategoryId(item.categoryLabel)
        : undefined,
    delivery: item.defaultTaskRequired ? "deliver" : "do-not-deliver",
    hospitalInstruction: item.internalInstruction ?? "",
    inHospitalName:
      dispensingProfileNames.korean ?? item.inHospitalOrderName,
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
    dispensingPreset: readHospitalDispensingPreset(item),
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
      dispensingProfileNames.english ?? item.standardOrderName,
    subcategoryId: placement.subcategoryId,
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
  const detail = metadata?.defaultDetailInputs ?? {};
  const readString = (key: string, fallback = "") =>
    typeof detail[key] === "string" && detail[key].trim()
      ? detail[key].trim()
      : fallback;
  const readNumber = (key: string, fallback: number) =>
    typeof detail[key] === "number" && Number.isFinite(detail[key])
      ? detail[key]
      : fallback;
  return {
    ingredientName:
      metadata?.ingredientKoreanName ??
      metadata?.ingredientEnglishName ??
      "",
    dose: readNumber("dose", metadata?.doseAmount ?? 1),
    doseUnit: readString(
      "doseUnit",
      metadata?.doseAmountUnit?.toLowerCase() ?? "tablet",
    ),
    route: readString("route", metadata?.administrationRoute ?? "PO"),
    frequency: readString(
      "frequency",
      metadata?.dailyFrequencyCode ?? "sid",
    ),
    durationDays: readNumber(
      "durationDays",
      metadata?.administrationDays ?? 1,
    ),
    totalQuantity: readNumber("totalQuantity", metadata?.doseAmount ?? 1),
    totalQuantityUnit: readString(
      "totalQuantityUnit",
      metadata?.dispenseUnit?.toLowerCase() ?? "tablet",
    ),
    medicationInstruction: readString(
      "medicationInstruction",
      metadata?.medicationInstruction ?? "any_time",
    ),
    storageMethod: readString(
      "storageMethod",
      metadata?.storageMethod ?? "room_temp",
    ),
    compoundNote: readString("compoundNote"),
    guardianNote: readString("guardianNote"),
    autoDispenseQuantityEnabled:
      metadata?.autoDispenseQuantityEnabled ?? true,
    manualQuantityReason: readString("manualQuantityReason"),
  };
}

function resolveClinicalPathologyCategoryId(
  categoryLabel: string,
): ClinicalPathologyCategoryId {
  const normalizedLabel = categoryLabel.replaceAll(" ", "").replace("/", "");
  const categoryByLabel: Record<string, ClinicalPathologyCategoryId> = {
    CBC검사: "cbc",
    CSF검사: "csf",
    기타병리검사: "etc",
    세포검사: "cell",
    요검사: "urinalysis",
    원내혈액검사: "in-house-blood",
    임상미생물검사: "microbiology",
    전해질검사동맥혈: "electrolyte-abg",
    전해질검사동맥혈검사: "electrolyte-abg",
    체액검사: "fluid",
    혈액화학검사: "chemistry",
  };

  return categoryByLabel[normalizedLabel] ?? "etc";
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
    return {
      action: "update",
      itemId: source.id,
      expectedCatalogRevision: source.catalogRevision ?? 1,
      patch: buildWorkspaceCatalogPatchFromHospitalOrder(draft, source),
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

  return {
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
    medicationMetadata: buildMedicationMetadataFromHospitalOrder(
      draft,
      source.medicationMetadata,
    ),
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
    categoryGroup: catalogDefaults.categoryGroup,
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
  return {
    ...source,
    schemaVersion: 2,
    presetOrigin:
      draft.sourceKind === "clair_master" ? "clair_master" : "workspace",
    presetStatus: source?.presetStatus ?? "synthetic_unreviewed",
    defaultDetailInputs: {
      ...(source?.defaultDetailInputs ?? {}),
      doseBasis: "patient",
      dose: preset.dose,
      doseUnit: preset.doseUnit,
      route: preset.route,
      frequency: preset.frequency,
      durationDays: preset.durationDays,
      totalQuantity: preset.totalQuantity,
      totalQuantityUnit: preset.totalQuantityUnit,
      medicationInstruction: preset.medicationInstruction,
      storageMethod: preset.storageMethod,
      compoundNote: preset.compoundNote,
      guardianNote: preset.guardianNote,
      manualQuantityReason: preset.manualQuantityReason,
    },
    autoDispenseQuantityEnabled: preset.autoDispenseQuantityEnabled,
    administrationDays: preset.durationDays,
    dailyFrequencyCode: preset.frequency,
    frequencyDailyCount,
    doseBasis: "prescribed_quantity",
    doseAmount: preset.dose,
    doseAmountUnit: preset.doseUnit,
    administrationRoute:
      preset.route as NonNullable<
        OrderCatalogItem["medicationMetadata"]
      >["administrationRoute"],
    dispenseUnit: preset.totalQuantityUnit,
    dispenseRoundingRule: source?.dispenseRoundingRule ?? "ceil_0_5",
    medicationInstruction:
      preset.medicationInstruction as NonNullable<
        OrderCatalogItem["medicationMetadata"]
      >["medicationInstruction"],
    storageMethod:
      preset.storageMethod as NonNullable<
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
  return 1;
}

export function calculateHospitalDispenseQuantity(
  preset: HospitalDispensingPreset,
) {
  return (
    preset.dose *
    getHospitalFrequencyDailyCount(preset.frequency) *
    preset.durationDays
  );
}

function resolveHospitalOrderPlacement(item: OrderCatalogItem): {
  categoryId: HospitalOrderCategoryId;
  subcategoryId: HospitalOrderSubcategoryId;
} {
  const label = item.categoryLabel;

  if (item.categoryGroup === "consultation") {
    return {
      categoryId: "consultation",
      subcategoryId: label.includes("기타") ? "other-consultation" : "basic-consultation",
    };
  }

  if (item.categoryGroup === "lab") {
    if (label.includes("화학")) return { categoryId: "lab", subcategoryId: "blood-chemistry" };
    if (label.includes("의뢰")) return { categoryId: "lab", subcategoryId: "external-lab" };
    return { categoryId: "lab", subcategoryId: "clinical-pathology" };
  }

  if (item.categoryGroup === "imaging") {
    return {
      categoryId: "imaging",
      subcategoryId: label.includes("초음파") ? "ultrasound" : "radiography",
    };
  }

  if (item.categoryGroup === "hospitalization") {
    return { categoryId: "hospitalization", subcategoryId: "hospitalization" };
  }

  if (item.categoryGroup === "medication") {
    if (item.dispensingLineage) {
      return { categoryId: "dispensing", subcategoryId: "injection" };
    }
    if (label.includes("주사")) return { categoryId: "dispensing", subcategoryId: "injection" };
    if (label.includes("물품")) return { categoryId: "medical-supply", subcategoryId: "medical-supply" };
    return { categoryId: "dispensing", subcategoryId: "oral-medication" };
  }

  if (item.categoryGroup === "treatment") {
    if (item.vaccineMetadata || label.includes("예방") || label.includes("백신")) {
      return { categoryId: "prevention", subcategoryId: "prevention" };
    }
    if (label.includes("마취")) return { categoryId: "surgery", subcategoryId: "anesthesia" };
    if (label.includes("수술")) return { categoryId: "surgery", subcategoryId: "surgery" };
    if (label.includes("치료")) return { categoryId: "therapy", subcategoryId: "therapy" };
    return { categoryId: "treatment", subcategoryId: "basic-treatment" };
  }

  return { categoryId: "medical-supply", subcategoryId: "medical-supply" };
}

function readDispensingProfileNames(item: OrderCatalogItem) {
  const snapshot = item.dispensingLineage?.dispensingProfileSnapshot;
  if (!snapshot) return {};

  const korean = snapshot.koreanDraftName;
  const english = snapshot.englishProductName;
  return {
    korean:
      typeof korean === "string" && korean.trim() ? korean.trim() : undefined,
    english:
      typeof english === "string" && english.trim()
        ? english.trim()
        : undefined,
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
  if (draft.categoryId === "consultation") {
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

  if (draft.categoryId === "dispensing" || draft.categoryId === "medical-supply") {
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
