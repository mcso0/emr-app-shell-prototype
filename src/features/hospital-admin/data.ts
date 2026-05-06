"use client";

import type { ServiceItemType } from "@/types/emr-domain";

export type HospitalOrderCategoryId = "lab" | "dispensing" | "treatment" | "imaging";
export type HospitalOrderSubcategoryId =
  | "clinical-pathology"
  | "blood-chemistry"
  | "external-lab"
  | "oral-medication"
  | "injection"
  | "fluid"
  | "basic-treatment"
  | "radiography"
  | "ultrasound";
export type HospitalOrderDelivery = "deliver" | "do-not-deliver";
export type HospitalOrderTarget = "all" | "dog-cat" | "dog" | "cat" | "other";
export type HospitalOrderSaleUnit = "each" | "day" | "session" | "pack";
export type HospitalOrderRoundRule = "none" | "round-10" | "round-100";
export type HospitalOrderType = "individual";
export type HospitalOrderStatusFilter = "all" | "active" | "inactive";
export type HospitalOrderBillingFilter = "all" | "billable" | "not-billable";
export type HospitalOrderWorkTypeFilter = "all" | ServiceItemType;

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
  delivery: HospitalOrderDelivery;
  hospitalInstruction: string;
  inHospitalName: string;
  isActive: boolean;
  isTaxable: boolean;
  memo: string;
  orderType: HospitalOrderType;
  price: number;
  referenceItems: HospitalOrderReference[];
  roundRule: HospitalOrderRoundRule;
  saleUnit: HospitalOrderSaleUnit;
  serviceItemType: ServiceItemType;
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
];

export const hospitalOrderSubcategories: HospitalOrderSubcategory[] = [
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
    id: "fluid",
    categoryId: "treatment",
    label: "수액",
    description: "피하/정맥 수액 처치",
    sortOrder: 10,
  },
  {
    id: "basic-treatment",
    categoryId: "treatment",
    label: "기본 처치",
    description: "드레싱, 처치, 간호 업무",
    sortOrder: 20,
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
];

export const hospitalOrderSeedItems: HospitalOrderCatalogItem[] = [
  {
    id: "hospital-order-ecg",
    aliases: "심전도, ECG, electrocardiogram",
    billable: true,
    billingName: "심전도 검사",
    careGuide: "검사 전후 보호자 안내가 필요한 경우 케어가이드를 작성합니다.",
    categoryId: "lab",
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
    subcategoryId: "fluid",
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
  return {
    aliases: "",
    billable: true,
    billingName: "신규 청구서명",
    careGuide: "",
    categoryId,
    delivery: "deliver",
    hospitalInstruction: "",
    inHospitalName: "신규 원내 Order",
    isActive: true,
    isTaxable: false,
    memo: "",
    orderType: "individual",
    price: 0,
    referenceItems: [
      { label: "관리 코드", value: "NEW-ORDER" },
      { label: "참조명", value: "-" },
      { label: "기본 단위", value: "-" },
    ],
    roundRule: "none",
    saleUnit: "each",
    serviceItemType: "lab",
    standardName: "신규 Order",
    subcategoryId,
    target: "all",
    updatedAtLabel: "방금",
    updatedBy: "송민재",
  };
}

export function formatHospitalOrderAmount(amount: number) {
  return `${amount.toLocaleString()}원`;
}
