// Offline authoring only. Never import this ID map into application/runtime code.
const numbered = (prefix, start, end) => Array.from({ length: end - start + 1 }, (_, i) => prefix + String(start + i).padStart(2, "0"));
const syn = (kind, start, end) => numbered(`cm.order.synthetic.${kind}-`, start, end);
const v4 = (kind, start, end) => numbered(`cm.order.v4.${kind}.`, start, end);

export const reviewedGroups = [
  ["basic-consultation", "Basic visit fee, including the explicitly authored night visit; no execution change.", ["cm.order.consult.first-visit", "cm.order.consult.followup", "cm.order.consult.initial", ...syn("consultation", 1, 1)]],
  ["other-consultation", "Named counseling and evaluation services; intentional consultation group, not unknown fallback.", [...syn("consultation", 2, 10), ...v4("consultation", 1, 16)]],
  ["prevention", "Preventive service intent only; retains consultation clinical type, including vaccine-named rows.", ["cm.order.consult.preventive-cat", "cm.order.consult.preventive-dog", ...syn("preventive", 1, 10), ...v4("preventive", 1, 14)]],
  ["radiography", "Explicitly authored radiography scope.", ["cm.order.imaging.abdominal-radiography", "cm.order.imaging.chest-radiography", ...syn("imaging", 1, 4), ...v4("imaging", 1, 12)]],
  ["ultrasound", "Explicitly authored ultrasound scope; includes echocardiography.", ["cm.order.imaging.abdominal-ultrasound", "cm.order.imaging.echocardiography", ...syn("imaging", 5, 8), ...v4("imaging", 13, 17)]],
  ["image-interpretation", "CT image interpretation consultation, not acquisition or proof of a CT device.", ["cm.order.v4.imaging.18"]],
  ["dental-care", "Dental service group includes examination, procedures and support; retains existing treatment type even for dental radiography.", [...syn("dental", 1, 2), ...v4("dental", 1, 22)]],
  ["surgery", "Surgical service scope includes preparation and observation, not a claim that every row performs surgery.", [...[1, 5, 6, 7].flatMap(n => syn("surgery-anesthesia", n, n)), ...v4("surgery-anesthesia", 1, 23), ...v4("surgery-anesthesia", 33, 34)]],
  ["anesthesia", "Anesthesia preparation, monitoring and recovery; no medication/route inference.", [...[2, 3, 4, 8].flatMap(n => syn("surgery-anesthesia", n, n)), ...v4("surgery-anesthesia", 24, 32)]],
  ["basic-treatment", "Explicit routine treatment and nursing group, preserving named scope and existing clinical type.", [...syn("treatment", 1, 10), ...syn("treatment", 13, 15), "cm.order.treatment.ear-cleaning", "cm.order.treatment.nail-trimming", "cm.order.treatment.wound-cleaning", ...v4("treatment", 1, 26)]],
  ["therapy", "Explicit rehabilitation/physical treatment browsing decision.", [...syn("treatment", 11, 12), ...v4("treatment", 27, 27)]],
  ["hospitalization", "Ward management, monitoring and hospitalization services; no patient result defaults.", [...syn("inpatient", 1, 6), ...v4("inpatient", 1, 24)]],
  ["document-service", "Document issuance and record-copy services; not a generic residual category.", [...syn("certificate-misc", 1, 1), ...v4("certificate-misc", 1, 12)]],
  ["medical-supply", "Medication syringe and packaging supplies, not an injection execution order.", [...syn("dispensing", 13, 14)]],
  ["emergency-service", "Emergency service intent; existing other clinical type is preserved and requires separate execution-semantic reconciliation.", [...syn("emergency", 1, 3), ...v4("emergency", 1, 21)]],
  ["system-exam", "Explicit twelve system-exam identities; not reconstructed from current shared path names.", ["cardiovascular", "dermatologic-coat", "digestive-abdominal", "general-vitals", "musculoskeletal", "neurologic", "ophthalmic", "oral-dental", "otic", "peripheral-lymphatic", "respiratory", "urogenital"].map(s => `cm.order.system-exam.${s}`)],
];

// code, parent, label, allowed clinical type, existing UI code (not persisted evidence)
export const subcategoryDefinitions = [
  ["basic-consultation", "consultation", "기본 진찰", "consultation", true],
  ["other-consultation", "consultation", "상담·기타 진료비", "consultation", true],
  ["prevention", "prevention", "예방", "consultation", true],
  ["clinical-pathology", "lab", "임상병리", "clinical_lab", true],
  ["system-exam", "lab", "계통검사", "system_exam", true],
  ["radiography", "imaging", "방사선", "imaging", true],
  ["ultrasound", "imaging", "초음파", "imaging", true],
  ["image-interpretation", "imaging", "영상 판독 상담", "imaging", false],
  ["dental-care", "treatment", "치과 진료·처치", "treatment", false],
  ["basic-treatment", "treatment", "처치", "treatment", true],
  ["anesthesia", "surgery", "마취", "treatment", true],
  ["surgery", "surgery", "수술", "treatment", true],
  ["therapy", "therapy", "치료", "treatment", true],
  ["hospitalization", "hospitalization", "입원", "hospitalization", true],
  ["document-service", "misc", "서류 발급·기록 사본", "other", false],
  ["emergency-service", "misc", "응급 서비스", "other", false],
  ["medical-supply", "medical-supply", "의료물품", "other", true],
  ["oral-medication", "dispensing", "경구", "dispensing", true],
  ["injection", "dispensing", "주사제 조제", "dispensing", true],
  ["topical", "dispensing", "피부 외용", "dispensing", false],
  ["ophthalmic", "dispensing", "점안", "dispensing", false],
  ["otic", "dispensing", "점이", "dispensing", false],
  ["transdermal", "dispensing", "경피", "dispensing", false],
  ["oromucosal", "dispensing", "구강점막", "dispensing", false],
  ["dispensing-packaging", "dispensing", "조제 포장", "dispensing", false],
];

// Research purpose is a separate input. Translation is an explicit offline decision.
export const labTranslations = [
  ["hematology_cbc", "cbc", "CBC", true],
  ["clinical_chemistry", "chemistry", "혈액화학", true],
  ["fecal_parasitology", "fecal-parasitology", "분변·기생충", false],
  ["urinalysis", "urinalysis", "요검사", true],
  ["electrolytes", "electrolyte-abg", "전해질검사/동맥혈", true],
  ["coagulation", "coagulation", "응고", false],
  ["organ_or_metabolic_panel", "organ-metabolic", "장기·대사 평가", false],
  ["blood_typing", "blood-typing", "혈액형", false],
  ["reticulocyte", "reticulocyte", "망상적혈구", false],
  ["blood_smear", "blood-smear", "혈액도말", false],
  ["cytology", "cell", "세포 검사", true],
  ["pancreatic", "pancreatic", "췌장", false],
  ["inflammation", "inflammation", "염증", false],
  ["thyroid", "thyroid", "갑상샘", false],
  ["adrenal", "adrenal", "부신", false],
  ["infectious_disease", "infectious-disease", "감염병", false],
  ["composite_diagnostic_plan", "composite-assessment", "복합 검사 평가", false],
  ["legacy_exception", "in-house-blood", "원내 혈액 검사", true],
];

export const syntheticDispensingDecisions = {
  "cm.order.dispensing.topical": "topical",
  "cm.order.synthetic.dispensing-07": "injection",
  "cm.order.synthetic.dispensing-11": "dispensing-packaging",
  "cm.order.synthetic.dispensing-12": "dispensing-packaging",
};

export const explicitNotes = {
  "cm.order.consult.initial": ["Frozen display name is Initial Consultation Changed; do not silently rename or reconcile by name."],
  "cm.order.v4.imaging.18": ["Interpretation only; no CT acquisition/device implied."],
  "cm.order.v4.dental.03": ["Dental radiography currently has treatment type; classification does not repair execution routing."],
  "cm.order.v4.dental.04": ["Dental radiography currently has treatment type; classification does not repair execution routing."],
  "cm.order.v4.lab-test.32": ["Feline panleukopenia antigen belongs to infectious disease, not CBC."],
  "cm.order.synthetic.lab-01": ["Existing electrolyte-abg browsing label does not assert arterial blood gas members."],
  "cm.order.synthetic.lab-03": ["Preserve organ-metabolic research purpose; existing panel has eight chemistry members, no nested-set inference."],
  "cm.order.v4.lab-service.preanesthetic-expanded": ["Composite service intent; currently bound chemistry panel is not a complete composite set."],
  "cm.order.v4.lab-service.renal": ["Shares urine-protein panel with pu-pd; primary service family differs, membership unchanged."],
  "cm.order.v4.lab-service.pu-pd": ["Shares urine-protein panel with renal; primary service family differs, membership unchanged."],
  "phase1.optionb.v1.order.metabolic": ["Unbound broad synthetic blood-test workflow; no CBC, chemistry, specimen or panel composition inferred."],
};
