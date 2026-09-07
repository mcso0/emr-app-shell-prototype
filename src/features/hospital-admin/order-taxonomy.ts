// Versioned code vocabulary only. No order identities, label matching or default data.
export const orderTaxonomySubcategories = {
  "basic-consultation": { parent: "consultation", label: "기본 진찰", clinicalType: "consultation" },
  "other-consultation": { parent: "consultation", label: "상담·기타 진료비", clinicalType: "consultation" },
  "prevention": { parent: "prevention", label: "예방", clinicalType: "consultation" },
  "clinical-pathology": { parent: "lab", label: "임상병리", clinicalType: "clinical_lab" },
  "system-exam": { parent: "lab", label: "계통검사", clinicalType: "system_exam" },
  "radiography": { parent: "imaging", label: "방사선", clinicalType: "imaging" },
  "ultrasound": { parent: "imaging", label: "초음파", clinicalType: "imaging" },
  "image-interpretation": { parent: "imaging", label: "영상 판독 상담", clinicalType: "imaging" },
  "dental-care": { parent: "treatment", label: "치과 진료·처치", clinicalType: "treatment" },
  "basic-treatment": { parent: "treatment", label: "처치", clinicalType: "treatment" },
  "anesthesia": { parent: "surgery", label: "마취", clinicalType: "treatment" },
  "surgery": { parent: "surgery", label: "수술", clinicalType: "treatment" },
  "therapy": { parent: "therapy", label: "치료", clinicalType: "treatment" },
  "hospitalization": { parent: "hospitalization", label: "입원", clinicalType: "hospitalization" },
  "document-service": { parent: "misc", label: "서류 발급·기록 사본", clinicalType: "other" },
  "emergency-service": { parent: "misc", label: "응급 서비스", clinicalType: "other" },
  "medical-supply": { parent: "medical-supply", label: "의료물품", clinicalType: "other" },
  "oral-medication": { parent: "dispensing", label: "경구", clinicalType: "dispensing" },
  "injection": { parent: "dispensing", label: "주사제 조제", clinicalType: "dispensing" },
  "topical": { parent: "dispensing", label: "피부 외용", clinicalType: "dispensing" },
  "ophthalmic": { parent: "dispensing", label: "점안", clinicalType: "dispensing" },
  "otic": { parent: "dispensing", label: "점이", clinicalType: "dispensing" },
  "transdermal": { parent: "dispensing", label: "경피", clinicalType: "dispensing" },
  "oromucosal": { parent: "dispensing", label: "구강점막", clinicalType: "dispensing" },
  "dispensing-packaging": { parent: "dispensing", label: "조제 포장", clinicalType: "dispensing" },
} as const;
export const orderTaxonomyLabFamilies = {
  "cbc": "CBC",
  "chemistry": "혈액화학",
  "fecal-parasitology": "분변·기생충",
  "urinalysis": "요검사",
  "electrolyte-abg": "전해질검사/동맥혈",
  "coagulation": "응고",
  "organ-metabolic": "장기·대사 평가",
  "blood-typing": "혈액형",
  "reticulocyte": "망상적혈구",
  "blood-smear": "혈액도말",
  "cell": "세포 검사",
  "pancreatic": "췌장",
  "inflammation": "염증",
  "thyroid": "갑상샘",
  "adrenal": "부신",
  "infectious-disease": "감염병",
  "composite-assessment": "복합 검사 평가",
  "in-house-blood": "원내 혈액 검사",
} as const;
export type OrderAdminSubcategoryCode = keyof typeof orderTaxonomySubcategories;
export type OrderLabFamilyCode = keyof typeof orderTaxonomyLabFamilies;
export type OrderTaxonomyFields = {
  adminSubcategoryCode?: string | null;
  labFamilyCode?: string | null;
};

export type OrderTaxonomyMergeConflict = {
  revision: number;
  proposed: { adminSubcategoryCode: string | null; labFamilyCode: string | null };
};

// A conflicting proposal may fail pair validation. This read-only envelope
// describes that conflict; it must never replace the saved workspace values.
export function parseOrderTaxonomyMergeConflict(value: unknown): OrderTaxonomyMergeConflict | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Number.isSafeInteger(raw.revision) || (raw.revision as number) < 1 ||
      !raw.proposed || typeof raw.proposed !== "object" || Array.isArray(raw.proposed)) return null;
  const proposed = raw.proposed as Record<string, unknown>;
  const scalar = (v: unknown) => v === null || (typeof v === "string" && v.length > 0 && v.length <= 100);
  if (!scalar(proposed.adminSubcategoryCode) || !scalar(proposed.labFamilyCode)) return null;
  return { revision: raw.revision as number, proposed: {
    adminSubcategoryCode: proposed.adminSubcategoryCode as string | null,
    labFamilyCode: proposed.labFamilyCode as string | null,
  } };
}

export function isOrderTaxonomyValid(type: unknown, sub: unknown, family: unknown): boolean {
  if (sub === undefined && family === undefined) return true; // Legacy snapshot has no fields.
  if (sub === null) return family === null; // Explicit clear, not inheritance.
  if (typeof sub !== "string" || !Object.hasOwn(orderTaxonomySubcategories, sub)) return false;
  if (orderTaxonomySubcategories[sub as OrderAdminSubcategoryCode].clinicalType !== type) return false;
  return sub === "clinical-pathology"
    ? typeof family === "string" && Object.hasOwn(orderTaxonomyLabFamilies, family)
    : family === null;
}

export function copyOrderTaxonomy(item: OrderTaxonomyFields): OrderTaxonomyFields {
  // Preserve absent old history; never enrich it from the current catalog.
  return {
    ...(item.adminSubcategoryCode !== undefined ? { adminSubcategoryCode: item.adminSubcategoryCode } : {}),
    ...(item.labFamilyCode !== undefined ? { labFamilyCode: item.labFamilyCode } : {}),
  };
}
