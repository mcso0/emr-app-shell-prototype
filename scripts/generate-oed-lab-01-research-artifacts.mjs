#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertReviewedOrderSet, familyForOrder } from "./lib/oed-lab-01-reviewed-classification.mjs";
import { compareSpecimenLabels } from "./lib/oed-lab-01-specimen-comparison.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-01",
);
const FROZEN_MANIFEST_PATH = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/artifacts/wp-00-frozen-manifest.v1.json",
);
const CANDIDATES_PATH = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/artifacts/wp-01a-order-default-candidates.non-applied.v1.json",
);
const AUTHORING_PATH = resolve(
  REPO_ROOT,
  "tests/fixtures/clinical-master-operational-v4-authoring.json",
);

const today = "2026-09-06";
const originalResearchDate = "2026-09-04";
const schemaPrefix = "oed-lab-01";

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function recordName(record) {
  return record?.names?.find((name) => name.languageCode === "ko")?.name
    ?? record?.names?.[0]?.name
    ?? record?.masterKey
    ?? null;
}

const sources = [
  {
    sourceId: "ASVCP-QALS",
    organization: "American Society for Veterinary Clinical Pathology",
    title: "Quality Assurance and Laboratory Standards Guidelines",
    url: "https://www.asvcp.org/page/QALS_Guidelines",
    sourceClass: "professional_guideline",
    supports: ["quality_governance", "reference_interval_governance", "cytology_reporting"],
  },
  {
    sourceId: "ASVCP-RI-GUIDELINE",
    organization: "ASVCP QALS",
    title: "Reference interval guidelines",
    url: "https://onlinelibrary.wiley.com/doi/full/10.1111/vcp.12006",
    sourceClass: "professional_guideline",
    supports: ["reference_interval_dimensions", "method_device_dependence", "interval_transference"],
  },
  {
    sourceId: "ASVCP-RI-TRANSFER",
    organization: "ASVCP QALS",
    title: "Reference Interval Transference Verification Checklist",
    url: "https://www.asvcp.org/resource/resmgr/qals/ref_interval_transference/transferenceverification-upd.pdf",
    sourceClass: "professional_guideline",
    supports: ["reference_interval_verification", "local_validation_required"],
  },
  {
    sourceId: "CORNELL-HEMATOLOGY",
    organization: "Cornell University AHDC",
    title: "Hematology testing protocols and interpretations",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/hematology",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["cbc_children", "reticulocyte", "blood_smear", "fecal_occult_blood"],
  },
  {
    sourceId: "CORNELL-HEMATOLOGY-RI",
    organization: "Cornell University AHDC",
    title: "Hematology reference intervals - ADVIA 2120",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/reference-intervals/hematology-advia-2120",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["cbc_units", "species_reference_intervals", "device_specific_profile"],
  },
  {
    sourceId: "IDEXX-PROCYTE-RI",
    organization: "IDEXX Laboratories",
    title: "ProCyte Dx reference intervals",
    url: "https://www.idexx.com/files/procyte-dx-reference-ranges-en.pdf",
    sourceClass: "manufacturer_manual",
    supports: ["cbc_device_profile", "species_reference_intervals", "cbc_units"],
  },
  {
    sourceId: "ZOETIS-HM5-MANUAL",
    organization: "Zoetis Diagnostics",
    title: "VETSCAN HM5 Operator's Manual",
    url: "https://www.zoetisdiagnostics.com/assets/Resources/PDF/VETSCAN-HM5-Blue-Version-Operators-Manual.pdf",
    sourceClass: "manufacturer_manual",
    supports: ["cbc_device_parameters", "hematology_equipment_class"],
  },
  {
    sourceId: "CORNELL-CHEMISTRY",
    organization: "Cornell University AHDC",
    title: "Clinical Chemistry",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/veterinary-resources/testing-guidelines/clinical-chemistry",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["chemistry_panels", "electrolytes", "organ_panels", "specimens"],
  },
  {
    sourceId: "CORNELL-CHEMISTRY-RI",
    organization: "Cornell University AHDC",
    title: "Chemistry reference intervals - Cobas",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/reference-intervals/chemistry-cobas",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["chemistry_units", "species_reference_intervals", "method_device_dependence"],
  },
  {
    sourceId: "IDEXX-CATALYST-MENU",
    organization: "IDEXX Laboratories",
    title: "Catalyst One test menu",
    url: "https://www.idexx.com/en/veterinary/analyzers/catalyst-one-chemistry-analyzer/test-menu/",
    sourceClass: "manufacturer_test_menu",
    supports: ["chemistry_device_menu", "single_analyte_recheck", "upc", "endocrine_poc"],
  },
  {
    sourceId: "ZOETIS-VS2-PROFILES",
    organization: "Zoetis Diagnostics",
    title: "VETSCAN VS2 testing profiles",
    url: "https://www.zoetisdiagnostics.com/IE/assets/pdf/Zoetis-Vetscan-VS2-Testing-Profiles-VTS-01169A-NOV2123.pdf",
    sourceClass: "manufacturer_test_menu",
    supports: ["chemistry_device_menu", "panel_composition", "species_scope"],
  },
  {
    sourceId: "IDEXX-COAG-DX",
    organization: "IDEXX Laboratories",
    title: "Coag Dx Analyzer",
    url: "https://www.idexx.com/en/veterinary/analyzers/coag-dx-analyzer/",
    sourceClass: "manufacturer_test_menu",
    supports: ["pt", "aptt", "coagulation_equipment", "species_scope"],
  },
  {
    sourceId: "CORNELL-COAG-PANEL",
    organization: "Cornell University AHDC",
    title: "Canine diagnostic plans and coagulation panels",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/diagnostic-services/diagnostic-plans-and-panels/canine-diagnostic-plans-and-panels",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["coagulation_panel", "panel_of_panels", "specimens"],
  },
  {
    sourceId: "CORNELL-URINALYSIS",
    organization: "Cornell University AHDC",
    title: "Urinalysis",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/urinalysis",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["urinalysis_children", "upc", "urine_specimen"],
  },
  {
    sourceId: "IDEXX-VETLAB-UA",
    organization: "IDEXX Laboratories",
    title: "VetLab UA Analyzer",
    url: "https://www.idexx.com/en/veterinary/analyzers/vetlab-ua-analyzer/",
    sourceClass: "manufacturer_test_menu",
    supports: ["urine_strip_device", "semiquantitative_results", "species_scope"],
  },
  {
    sourceId: "IDEXX-SEDIVUE",
    organization: "IDEXX Laboratories",
    title: "SediVue Dx Urine Sediment Analyzer",
    url: "https://www.idexx.com/en/veterinary/analyzers/sedivue-dx-analyzer/",
    sourceClass: "manufacturer_test_menu",
    supports: ["urine_sediment_children", "images", "sediment_device"],
  },
  {
    sourceId: "CORNELL-PARASITOLOGY",
    organization: "Cornell University AHDC",
    title: "Parasitology",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/parasitology",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["fecal_flotation", "organism_observations", "qualitative_quantitative_results"],
  },
  {
    sourceId: "IDEXX-SNAP-GIARDIA",
    organization: "IDEXX Laboratories",
    title: "SNAP Giardia Test",
    url: "https://www.idexx.com/en/veterinary/snap-tests/snap-giardia-test/",
    sourceClass: "manufacturer_test_menu",
    supports: ["giardia_antigen", "point_of_care_rapid_test", "qualitative_result"],
  },
  {
    sourceId: "IDEXX-SNAP-INFECTIOUS",
    organization: "IDEXX Laboratories",
    title: "SNAP rapid assay product inserts",
    url: "https://www.idexx.com/en/veterinary/support/rapid-assay-snap-product-inserts/",
    sourceClass: "manufacturer_manual_index",
    supports: ["parvo_antigen", "heartworm_antigen", "felv_antigen", "fiv_antibody", "panel_status"],
  },
  {
    sourceId: "UC-DAVIS-PCR",
    organization: "UC Davis Veterinary Genetics and Molecular Diagnostics",
    title: "Veterinary PCR tests and panels",
    url: "https://pcrlab.vetmed.ucdavis.edu/veterinary-diagnostics/veterinary-submission-formsdiagnostic-tests-and-panels",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["infectious_pcr", "babesia", "species_specific_panels", "external_lab_route"],
  },
  {
    sourceId: "CORNELL-PCR-INTERPRETATION",
    organization: "Cornell University AHDC",
    title: "Interpretation of PCR results",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/testing-laboratories/molecular-diagnostics/interpretation-pcr-results",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["pcr_result_shape", "assay_specific_interpretation", "inconclusive_results"],
  },
  {
    sourceId: "CORNELL-BLOOD-TYPE",
    organization: "Cornell University AHDC",
    title: "Canine and Feline Blood Typing",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/comparative-coagulation/clinical-topics/canine-feline-blood-typing",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["blood_type", "species_specific_codes", "edta_specimen"],
  },
  {
    sourceId: "CORNELL-CYTOLOGY",
    organization: "Cornell University AHDC",
    title: "Cytology - fluid samples",
    url: "https://www.vet.cornell.edu/animal-health-diagnostic-center/veterinary-resources/testing-guidelines/cytology-fluid-samples-only",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["joint_fluid", "cytology_specimen", "manual_external_route"],
  },
  {
    sourceId: "IDEXX-INVUE",
    organization: "IDEXX Laboratories",
    title: "inVue Dx Cellular Analyzer",
    url: "https://www.idexx.com/en/veterinary/analyzers/invue-dx-analyzer/",
    sourceClass: "manufacturer_test_menu",
    supports: ["ear_cytology", "blood_morphology", "images", "semiquantitative_results"],
  },
  {
    sourceId: "UC-DAVIS-ENDOCRINOLOGY",
    organization: "UC Davis Veterinary Medical Teaching Hospital",
    title: "Clinical chemistry and endocrinology services",
    url: "https://www.vetmed.ucdavis.edu/hospital/support-services/lab-services/clinical-laboratory-services/clinical-chemistry",
    sourceClass: "university_diagnostic_laboratory",
    supports: ["thyroid_tests", "cortisol", "crp", "endocrine_equipment"],
  },
  {
    sourceId: "IDEXX-CORTISOL",
    organization: "IDEXX Laboratories",
    title: "Catalyst Cortisol Test",
    url: "https://www.idexx.com/en/veterinary/analyzers/catalyst-one-chemistry-analyzer/test-menu/cortisol/",
    sourceClass: "manufacturer_test_menu",
    supports: ["cortisol_protocol", "timed_results", "canine_device_profile"],
  },
  {
    sourceId: "LOINC-PANELS",
    organization: "Regenstrief Institute",
    title: "LOINC Panels (Batteries)",
    url: "https://loinc.org/kb/users-guide/panels",
    sourceClass: "standards_body",
    supports: ["panel_children", "nested_panels", "conditionality"],
  },
  {
    sourceId: "LOINC-RESULT-TYPES",
    organization: "Regenstrief Institute",
    title: "Types of results found in panels",
    url: "https://loinc.org/kb/users-guide/panels/types-of-results",
    sourceClass: "standards_body",
    supports: ["primary_observation", "derived_observation", "panel_interpretation"],
  },
  {
    sourceId: "UCUM-2.2",
    organization: "UCUM Organization",
    title: "Unified Code for Units of Measure v2.2",
    url: "https://ucum.org/ucum",
    sourceClass: "standards_body",
    supports: ["machine_readable_units"],
  },
  {
    sourceId: "FHIR-SERVICE-REQUEST",
    organization: "HL7 International",
    title: "FHIR R5 ServiceRequest",
    url: "https://hl7.org/fhir/servicerequest.html",
    sourceClass: "standards_body",
    supports: ["order_instance", "panel_request", "requisition"],
  },
  {
    sourceId: "FHIR-OBSERVATION",
    organization: "HL7 International",
    title: "FHIR R5 Observation",
    url: "https://hl7.org/fhir/observation.html",
    sourceClass: "standards_body",
    supports: ["atomic_result", "has_member", "value_types", "reference_range"],
  },
  {
    sourceId: "FHIR-DIAGNOSTIC-REPORT",
    organization: "HL7 International",
    title: "FHIR R5 DiagnosticReport",
    url: "https://hl7.org/fhir/diagnosticreport.html",
    sourceClass: "standards_body",
    supports: ["report_grouping", "atomic_results", "images", "interpretation"],
  },
].map((source) => ({ ...source, accessedAt: originalResearchDate }));

const familyBlueprints = {
  hematology_cbc: {
    label: "혈구검사·CBC",
    targetShape: "test_panel",
    primaryRoutes: ["in_house_device", "in_house_manual", "external_lab"],
    equipmentClasses: ["hematology_analyzer", "microscope_or_cellular_analyzer"],
    sourceIds: ["CORNELL-HEMATOLOGY", "CORNELL-HEMATOLOGY-RI", "IDEXX-PROCYTE-RI", "ZOETIS-HM5-MANUAL"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_found",
    recommendedChildren: [
      "WBC", "NEU#", "LYM#", "MONO#", "EOS#", "BASO#",
      "NEU%", "LYM%", "MONO%", "EOS%", "BASO%",
      "RBC", "HGB", "HCT", "MCV", "MCH", "MCHC", "RDW",
      "PLT", "MPV", "RETIC#", "RETIC%", "RBC morphology",
      "WBC morphology", "platelet estimate", "hemoparasite", "plasma appearance", "total protein",
    ],
    note: "장비 결과와 수기 도말 결과를 한 패널에서 묶되 각 결과는 독립 항목으로 보존한다.",
  },
  clinical_chemistry: {
    label: "임상화학",
    targetShape: "test_panel_or_atomic",
    primaryRoutes: ["in_house_device", "external_lab"],
    equipmentClasses: ["chemistry_analyzer"],
    sourceIds: ["CORNELL-CHEMISTRY", "CORNELL-CHEMISTRY-RI", "IDEXX-CATALYST-MENU", "ZOETIS-VS2-PROFILES"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_found",
    recommendedChildren: [
      "ALB", "GLOB", "A/G", "TP", "ALT", "AST", "ALP", "GGT",
      "TBIL", "DBIL", "GLU", "BUN", "CREA", "BUN/CREA", "Ca", "PHOS",
      "CHOL", "TRIG", "AMYL", "LIPA", "CK", "LDH", "SDMA", "Mg", "bile acids",
    ],
    note: "패널 구성은 장비 SKU가 아니라 버전 있는 논리 세트로 관리하고 단일 분석항목도 독립 주문 가능하게 둔다.",
  },
  electrolytes: {
    label: "전해질",
    targetShape: "test_panel",
    primaryRoutes: ["in_house_device", "external_lab"],
    equipmentClasses: ["chemistry_or_electrolyte_analyzer"],
    sourceIds: ["CORNELL-CHEMISTRY", "IDEXX-CATALYST-MENU", "ZOETIS-VS2-PROFILES"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_found",
    recommendedChildren: ["Na", "K", "Cl", "HCO3/tCO2", "Na/K", "anion gap", "Mg"],
    note: "GLU·CREA는 기본 전해질 패널의 필수 구성으로 고정하지 않는다.",
  },
  coagulation: {
    label: "응고",
    targetShape: "test_panel",
    primaryRoutes: ["in_house_device", "external_lab"],
    equipmentClasses: ["coagulation_analyzer"],
    sourceIds: ["IDEXX-COAG-DX", "CORNELL-COAG-PANEL"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_found",
    recommendedChildren: ["PT", "aPTT", "TCT", "fibrinogen", "D-dimer"],
    note: "기본 원내 패널은 PT·aPTT, 확장 외부 패널은 TCT·fibrinogen·D-dimer를 선택 항목으로 둔다.",
  },
  urinalysis: {
    label: "요검사",
    targetShape: "panel_of_subpanels",
    primaryRoutes: ["in_house_manual", "in_house_device", "external_lab"],
    equipmentClasses: ["urine_strip_analyzer", "refractometer", "urine_sediment_analyzer", "microscope", "chemistry_analyzer"],
    sourceIds: ["CORNELL-URINALYSIS", "IDEXX-VETLAB-UA", "IDEXX-SEDIVUE", "IDEXX-CATALYST-MENU"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_partial",
    recommendedChildren: [
      "color", "turbidity", "specific gravity", "pH", "protein", "glucose", "ketone", "bilirubin", "blood/hemoglobin",
      "sediment RBC", "sediment WBC", "squamous epithelial", "nonsquamous epithelial",
      "rods", "cocci", "hyaline casts", "nonhyaline casts", "struvite crystals",
      "calcium oxalate crystals", "ammonium biurate crystals", "bilirubin crystals", "unclassified crystals",
      "UPRO", "UCRE", "UPC", "image", "comment",
    ],
    note: "시험지·비중·침사·UPC를 하위 세트로 나누고 결과 항목은 수치·반정량·이미지를 함께 지원한다.",
  },
  fecal_parasitology: {
    label: "분변·기생충",
    targetShape: "test_panel_or_repeatable_observation",
    primaryRoutes: ["in_house_manual", "point_of_care_rapid_test", "external_lab"],
    equipmentClasses: ["centrifuge_and_microscope", "rapid_immunoassay_reader"],
    sourceIds: ["CORNELL-PARASITOLOGY", "IDEXX-SNAP-GIARDIA", "CORNELL-HEMATOLOGY"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "not_applicable",
    recommendedChildren: ["direct smear", "centrifugal flotation", "organism/taxon", "life stage", "detected", "burden/count", "Giardia antigen", "occult blood", "comment"],
    note: "기생충 목록은 고정 열보다 반복 가능한 검출 결과로 저장한다.",
  },
  infectious_disease: {
    label: "감염성 질환",
    targetShape: "species_and_method_specific_panel",
    primaryRoutes: ["point_of_care_rapid_test", "external_lab"],
    equipmentClasses: ["rapid_immunoassay_reader", "external_molecular_or_serology_lab"],
    sourceIds: ["IDEXX-SNAP-INFECTIOUS", "UC-DAVIS-PCR", "CORNELL-PCR-INTERPRETATION"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "not_applicable",
    recommendedChildren: ["pathogen-specific antigen", "pathogen-specific antibody", "pathogen-specific PCR", "panel invalid", "inconclusive", "comment"],
    note: "항원·항체·PCR은 별도 오더다. 개·고양이 항목을 하나의 무조건 실행 패널로 묶지 않는다.",
  },
  blood_typing: {
    label: "혈액형",
    targetShape: "atomic_coded_result",
    primaryRoutes: ["in_house_manual", "external_lab"],
    equipmentClasses: ["blood_typing_kit_or_lab"],
    sourceIds: ["CORNELL-BLOOD-TYPE"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "not_applicable",
    recommendedChildren: ["species-specific blood type", "test validity", "comment"],
    note: "개 DEA와 고양이 A/B/AB는 같은 코드 목록을 공유하지 않는다.",
  },
  reticulocyte: {
    label: "망상적혈구",
    targetShape: "atomic_numeric_pair",
    primaryRoutes: ["in_house_device", "in_house_manual", "external_lab"],
    equipmentClasses: ["hematology_analyzer", "microscope"],
    sourceIds: ["CORNELL-HEMATOLOGY", "IDEXX-PROCYTE-RI"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_found",
    recommendedChildren: ["RETIC%", "RETIC#", "comment"],
    note: "절대 망상적혈구 수와 비율을 분리하며 절대값 계산에는 RBC가 필요하다.",
  },
  blood_smear: {
    label: "혈액도말",
    targetShape: "complex_report",
    primaryRoutes: ["in_house_manual", "in_house_device", "external_lab"],
    equipmentClasses: ["microscope_or_cellular_analyzer"],
    sourceIds: ["CORNELL-HEMATOLOGY", "IDEXX-INVUE"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "not_applicable",
    recommendedChildren: ["RBC morphology", "WBC morphology", "manual differential", "platelet estimate", "hemoparasite", "images", "interpretation"],
    note: "정상범위 하나가 아니라 형태·등급·서술·이미지 결과다.",
  },
  cytology: {
    label: "세포검사",
    targetShape: "complex_report",
    primaryRoutes: ["in_house_manual", "in_house_device", "external_lab"],
    equipmentClasses: ["microscope_or_cellular_analyzer", "external_cytopathology"],
    sourceIds: ["CORNELL-CYTOLOGY", "IDEXX-INVUE", "ASVCP-QALS"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "not_applicable",
    recommendedChildren: ["site", "collection method", "adequacy", "cell population", "organisms", "inflammation", "interpretation", "differentials", "images", "comment"],
    note: "관절액은 세포검사 서술 외에 단백·점도·세포수 등 수치 결과를 추가하는 복합 패널이다.",
  },
  thyroid: {
    label: "갑상선",
    targetShape: "test_panel",
    primaryRoutes: ["in_house_device", "external_lab"],
    equipmentClasses: ["chemistry_or_immunoassay_analyzer", "external_endocrinology_lab"],
    sourceIds: ["UC-DAVIS-ENDOCRINOLOGY", "IDEXX-CATALYST-MENU"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_partial",
    recommendedChildren: ["TT4", "fT4", "TSH", "TGAA", "interpretive comment"],
    note: "fT4 검사법과 TSH 종 적용은 별도 결과 프로필로 고정한다.",
  },
  adrenal: {
    label: "부신·코르티솔",
    targetShape: "protocol_panel",
    primaryRoutes: ["in_house_device", "external_lab"],
    equipmentClasses: ["chemistry_or_immunoassay_analyzer", "external_endocrinology_lab"],
    sourceIds: ["UC-DAVIS-ENDOCRINOLOGY", "IDEXX-CORTISOL"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_partial",
    recommendedChildren: ["basal cortisol", "protocol type", "timed cortisol samples", "stimulation/suppression agent", "interpretive comment"],
    note: "ACTH 자극·억제 검사는 시간점이 있는 프로토콜 결과로 다룬다.",
  },
  inflammation: {
    label: "염증 표지",
    targetShape: "species_conditional_panel",
    primaryRoutes: ["in_house_device", "external_lab"],
    equipmentClasses: ["chemistry_or_immunoassay_analyzer", "hematology_analyzer"],
    sourceIds: ["UC-DAVIS-ENDOCRINOLOGY", "IDEXX-CATALYST-MENU", "CORNELL-HEMATOLOGY"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_partial",
    recommendedChildren: ["canine CRP", "feline SAA", "CBC panel reference", "albumin", "interpretive comment"],
    note: "CRP와 SAA를 모든 종에 동일 적용하지 않고 종 조건을 둔다.",
  },
  pancreatic: {
    label: "췌장 평가",
    targetShape: "test_panel",
    primaryRoutes: ["in_house_device", "point_of_care_rapid_test", "external_lab"],
    equipmentClasses: ["chemistry_analyzer", "rapid_immunoassay_reader", "external_lab"],
    sourceIds: ["IDEXX-CATALYST-MENU", "CORNELL-CHEMISTRY"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_partial",
    recommendedChildren: ["amylase", "lipase", "species-specific pancreatic lipase", "glucose", "triglyceride", "comment"],
    note: "일반 lipase와 pancreas-specific lipase를 같은 검사로 취급하지 않는다.",
  },
  organ_or_metabolic_panel: {
    label: "장기·대사 평가",
    targetShape: "test_panel_or_panel_of_panels",
    primaryRoutes: ["in_house_device", "in_house_manual", "external_lab"],
    equipmentClasses: ["chemistry_analyzer", "hematology_analyzer", "urinalysis_equipment"],
    sourceIds: ["CORNELL-CHEMISTRY", "IDEXX-CATALYST-MENU", "CORNELL-COAG-PANEL"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_partial",
    recommendedChildren: ["versioned organ-specific chemistry panel", "optional CBC", "optional urinalysis", "optional endocrine or disease-specific tests"],
    note: "간·신장·수술 전·건강검진 조합은 목적과 종에 따라 하위 패널을 버전으로 고정한다.",
  },
  composite_diagnostic_plan: {
    label: "종합 검사 조합",
    targetShape: "panel_of_panels",
    primaryRoutes: ["mixed"],
    equipmentClasses: ["multiple"],
    sourceIds: ["CORNELL-COAG-PANEL", "CORNELL-CHEMISTRY", "LOINC-PANELS", "FHIR-DIAGNOSTIC-REPORT"],
    structureEvidenceStatus: "source_found",
    valueEvidenceStatus: "source_partial",
    recommendedChildren: ["CBC panel", "chemistry panel", "electrolyte panel", "urinalysis panel", "condition-specific atomic tests"],
    note: "현재 하나의 패널 별칭으로 축소된 서비스 조합을 실제 하위 패널 목록으로 바꿔야 한다.",
  },
  legacy_exception: {
    label: "레거시 예외",
    targetShape: "retire_or_redefine",
    primaryRoutes: [],
    equipmentClasses: [],
    sourceIds: [],
    structureEvidenceStatus: "source_partial",
    valueEvidenceStatus: "functional_fixture_required",
    recommendedChildren: [],
    note: "fallback 경로의 합성 오더다. 임의 연결하지 말고 제거 또는 명시적 재정의가 필요하다.",
  },
};

function resultShapeForTest(test) {
  const key = test.masterKey;
  const inputType = test.detail?.resultInputTypeKey ?? null;
  if (/ua-strip/.test(key)) return { targetResultShape: "subpanel", referencePolicy: "component_specific", unitPolicy: "component_specific" };
  if (/ua-sediment/.test(key)) return { targetResultShape: "complex_repeating_observations_with_images", referencePolicy: "method_specific", unitPolicy: "component_specific" };
  if (/fecal-microscopy|fecal-flotation/.test(key)) return { targetResultShape: "repeatable_organism_observation", referencePolicy: "not_applicable", unitPolicy: "optional_count_per_mass" };
  if (/cytology|smear/.test(key)) return { targetResultShape: "coded_narrative_with_attachments", referencePolicy: "not_applicable", unitPolicy: "not_applicable" };
  if (/blood-type/.test(key)) return { targetResultShape: "species_specific_code", referencePolicy: "not_applicable", unitPolicy: "not_applicable" };
  if (/antigen|antibody|pcr|occult-blood/.test(key)) return { targetResultShape: "coded_qualitative_with_invalid_or_inconclusive", referencePolicy: "not_applicable", unitPolicy: "not_applicable" };
  if (/urine-glucose|urine-ketone|urine-bilirubin/.test(key)) return { targetResultShape: "coded_or_semiquantitative", referencePolicy: "expected_value_or_device_profile", unitPolicy: "device_profile" };
  if (/synthetic-15/.test(key)) return { targetResultShape: "numeric", referencePolicy: "species_method_profile", unitPolicy: "unitless_specific_gravity" };
  if (inputType === "cm.result-input.numeric") return { targetResultShape: "numeric", referencePolicy: "species_method_device_profile", unitPolicy: test.detail?.canonicalUnitKey ? "ucum_mappable" : "source_partial" };
  if (inputType === "cm.result-input.coded") return { targetResultShape: "coded", referencePolicy: "expected_code_or_not_applicable", unitPolicy: "not_applicable" };
  return { targetResultShape: "narrative", referencePolicy: "not_applicable", unitPolicy: "not_applicable" };
}

function sourceStatusForOrder(order) {
  if (order.orderId === "phase1.optionb.v1.order.metabolic") return "functional_fixture_required";
  // Family literature is not verification of this order's exact method/profile.
  return "source_partial";
}

const inputBodies = await Promise.all([FROZEN_MANIFEST_PATH, CANDIDATES_PATH, AUTHORING_PATH].map((path) => readFile(path, "utf8")));
const [manifest, candidates, authoring] = inputBodies.map((body) => JSON.parse(body));
const sourceFileFingerprints = Object.fromEntries([FROZEN_MANIFEST_PATH, CANDIDATES_PATH, AUTHORING_PATH]
  .map((path, index) => [path.slice(REPO_ROOT.length + 1), sha256(inputBodies[index])]));
const clinicalOrders = manifest.entries.filter((entry) => entry.clinicalOrderType === "clinical_lab");
if (clinicalOrders.length !== 86) throw new Error(`Expected 86 clinical_lab orders, received ${clinicalOrders.length}`);
assertReviewedOrderSet(clinicalOrders);

const recordByKey = new Map(authoring.records.map((record) => [record.masterKey, record]));
const orderProfileByKey = new Map(authoring.labOrderProfiles.map((profile) => [profile.orderMasterKey, profile]));
const panelItemsByKey = new Map();
for (const item of authoring.labPanelItems) {
  const items = panelItemsByKey.get(item.panelMasterKey) ?? [];
  items.push(item);
  panelItemsByKey.set(item.panelMasterKey, items);
}
for (const items of panelItemsByKey.values()) items.sort((left, right) => left.sortOrder - right.sortOrder);
const directlyOrderableTestKeys = new Set(
  authoring.labOrderProfiles.map((profile) => profile.labTestMasterKey).filter(Boolean),
);
const candidateByOrderId = new Map(candidates.candidates.map((candidate) => [candidate.orderId, candidate]));

const inventoryRows = clinicalOrders.map((order) => {
  const profile = orderProfileByKey.get(order.orderId) ?? null;
  const panelKey = profile?.labPanelMasterKey ?? null;
  const testKey = profile?.labTestMasterKey ?? null;
  const members = panelKey ? (panelItemsByKey.get(panelKey) ?? []) : [];
  const familyId = familyForOrder(order);
  const blueprint = familyBlueprints[familyId];
  const candidate = candidateByOrderId.get(order.orderId) ?? null;
  return {
    ...order,
    familyId,
    familyLabel: blueprint.label,
    currentBinding: profile
      ? { bindingType: panelKey ? "lab_panel" : "lab_test", panelKey, testKey, specimenKey: profile.specimenMasterKey ?? null }
      : { bindingType: "none", panelKey: null, testKey: null, specimenKey: null },
    currentPanelMemberCount: members.length,
    currentPanelMembers: members.map((item) => ({
      testKey: item.testMasterKey,
      displayName: recordName(recordByKey.get(item.testMasterKey)),
      sortOrder: item.sortOrder,
      required: item.required,
      independentlyOrderable: directlyOrderableTestKeys.has(item.testMasterKey),
    })),
    bindingEvidence: "local_authoring_fixture",
    remoteStateVerified: false,
    priorCandidateDefaults: candidate?.proposedMasterDefaults?.values ?? null,
    priorCandidateProvenance: "wp-01a_non_applied_candidate_not_current_defaults",
    specimenComparisonStatus: compareSpecimenLabels(profile?.specimenMasterKey, candidate?.proposedMasterDefaults?.values?.specimenType),
    researchStatus: sourceStatusForOrder(order),
    evidenceScope: "family_landscape_only",
    orderSpecificMethodVerified: false,
    numericValuesExtracted: false,
    applicationAllowed: false,
  };
});

const sourceFingerprint = sha256(canonicalJson(sourceFileFingerprints));
const inventory = {
  schemaVersion: `${schemaPrefix}-order-inventory/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  sourcePaths: [
    "docs/work/clinical-master/order-execution-defaults/artifacts/wp-00-frozen-manifest.v1.json",
    "tests/fixtures/clinical-master-operational-v4-authoring.json",
    "docs/work/clinical-master/order-execution-defaults/artifacts/wp-01a-order-default-candidates.non-applied.v1.json",
  ],
  sourceFingerprint,
  sourceFileFingerprints,
  evidenceScope: "local_frozen_inputs_not_remote_state",
  counts: {
    clinicalLabOrders: inventoryRows.length,
    currentLabTestDefinitions: authoring.records.filter((record) => record.recordType === "lab_test").length,
    currentLabPanelDefinitions: authoring.records.filter((record) => record.recordType === "lab_panel").length,
    currentPanelMemberships: authoring.labPanelItems.length,
    currentOrderProfiles: authoring.labOrderProfiles.length,
    directlyOrderableLabTests: directlyOrderableTestKeys.size,
    labTestsWithoutDirectOrder: authoring.records.filter((record) => record.recordType === "lab_test" && !directlyOrderableTestKeys.has(record.masterKey)).length,
    unboundClinicalLabOrders: inventoryRows.filter((row) => row.currentBinding.bindingType === "none").length,
  },
  orders: inventoryRows,
};

const setAtomicMap = {
  schemaVersion: `${schemaPrefix}-set-atomic-map/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  modelingDecision: {
    hierarchy: "orderable_set_or_panel -> independently_orderable_atomic_order -> result_observation",
    nestedPanelsAllowed: true,
    cyclesAllowed: false,
    childOrderabilityMustBeExplicit: true,
    retestCreatesNewOrder: true,
    parentPanelCarriesResultValue: false,
    standardsBasis: ["LOINC-PANELS", "LOINC-RESULT-TYPES", "FHIR-SERVICE-REQUEST", "FHIR-OBSERVATION", "FHIR-DIAGNOSTIC-REPORT"],
  },
  familyBlueprints,
  orders: inventoryRows.map((row) => {
    const blueprint = familyBlueprints[row.familyId];
    const currentKind = row.currentBinding.bindingType === "none"
      ? "exception"
      : row.currentBinding.bindingType === "lab_test"
        ? "atomic_order"
        : "test_panel";
    const shouldBePanelOfPanels = row.orderId.includes(".lab-service.")
      || row.familyId === "composite_diagnostic_plan"
      || (row.familyId === "organ_or_metabolic_panel" && /수술 전/.test(row.displayName));
    return {
      orderId: row.orderId,
      displayName: row.displayName,
      familyId: row.familyId,
      currentKind,
      targetKind: row.familyId === "legacy_exception"
        ? "retire_or_redefine"
        : shouldBePanelOfPanels
          ? "panel_of_panels"
          : row.currentBinding.bindingType === "lab_test"
            ? "atomic_order"
            : blueprint.targetShape,
      currentChildren: row.currentPanelMembers,
      recommendedChildBlueprint: currentKind === "atomic_order" ? [] : blueprint.recommendedChildren,
      recommendationScope: "family_examples_not_final_membership",
      independentlyReorderableChildrenRequired: row.currentBinding.bindingType === "lab_panel" || shouldBePanelOfPanels,
      sourceIds: blueprint.sourceIds,
      researchStatus: row.researchStatus,
      applicationAllowed: false,
    };
  }),
};

const routeMatrix = {
  schemaVersion: `${schemaPrefix}-execution-route-matrix/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  routeVocabulary: {
    in_house_manual: "원내 수기·현미경·수동 판독",
    in_house_device: "원내 분석 장비를 사용하되 현재 프로토타입은 결과 수동 입력",
    point_of_care_rapid_test: "원내 신속 키트 수기 또는 판독 보조 장비",
    external_lab: "외부 검사실 의뢰 후 결과 수동 입력·첨부",
    mixed: "하위 검사별 수행 경로가 다른 복합 조합",
  },
  integrationContract: {
    currentState: "not_integrated",
    resultEntryMode: "manual_entry",
    noFallbackEquipmentSelection: true,
    workspaceMustSelectActiveExecutionProfile: true,
  },
  orders: inventoryRows.map((row) => {
    const blueprint = familyBlueprints[row.familyId];
    return {
      orderId: row.orderId,
      displayName: row.displayName,
      familyId: row.familyId,
      familyRouteCandidates: blueprint.primaryRoutes,
      familyEquipmentClassCandidates: blueprint.equipmentClasses,
      routeValidation: "per_order_method_unverified",
      defaultRouteDecision: "workspace_selection_required",
      integrationStatus: "not_integrated",
      resultEntryMode: "manual_entry",
      sourceIds: blueprint.sourceIds,
    };
  }),
};

const equipmentLandscape = {
  schemaVersion: `${schemaPrefix}-equipment-landscape/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  selectionRule: "대표 모델은 검사군 조사용 후보이며 모든 하위 검사 지원을 뜻하지 않는다. 검사법별 호환성을 별도 확인해야 하며 워크스페이스 보유·연동 장비라는 뜻도 아니다.",
  profiles: [
    { equipmentClass: "hematology_analyzer", representativeModels: ["IDEXX ProCyte Dx", "Zoetis VETSCAN HM5"], families: ["hematology_cbc", "reticulocyte"], sourceIds: ["IDEXX-PROCYTE-RI", "ZOETIS-HM5-MANUAL"], currentIntegrationStatus: "not_integrated" },
    { equipmentClass: "reference_hematology_analyzer", representativeModels: ["Siemens ADVIA 2120"], families: ["hematology_cbc", "reticulocyte"], sourceIds: ["CORNELL-HEMATOLOGY-RI"], currentIntegrationStatus: "external_reference_only" },
    { equipmentClass: "chemistry_analyzer", representativeModels: ["IDEXX Catalyst One", "Zoetis VETSCAN VS2"], families: ["clinical_chemistry", "electrolytes", "pancreatic", "inflammation", "thyroid", "adrenal"], sourceIds: ["IDEXX-CATALYST-MENU", "ZOETIS-VS2-PROFILES"], currentIntegrationStatus: "not_integrated" },
    { equipmentClass: "coagulation_analyzer", representativeModels: ["IDEXX Coag Dx"], families: ["coagulation"], sourceIds: ["IDEXX-COAG-DX"], currentIntegrationStatus: "not_integrated" },
    { equipmentClass: "urine_strip_analyzer", representativeModels: ["IDEXX VetLab UA"], families: ["urinalysis"], sourceIds: ["IDEXX-VETLAB-UA"], currentIntegrationStatus: "not_integrated" },
    { equipmentClass: "urine_sediment_analyzer", representativeModels: ["IDEXX SediVue Dx"], families: ["urinalysis"], sourceIds: ["IDEXX-SEDIVUE"], currentIntegrationStatus: "not_integrated" },
    { equipmentClass: "cellular_analyzer", representativeModels: ["IDEXX inVue Dx"], families: ["blood_smear", "cytology"], sourceIds: ["IDEXX-INVUE"], currentIntegrationStatus: "not_integrated" },
    { equipmentClass: "rapid_immunoassay", representativeModels: ["IDEXX SNAP kits", "IDEXX SNAP Pro"], families: ["fecal_parasitology", "infectious_disease"], sourceIds: ["IDEXX-SNAP-GIARDIA", "IDEXX-SNAP-INFECTIOUS"], currentIntegrationStatus: "not_integrated" },
    { equipmentClass: "manual_lab_equipment", representativeModels: ["microscope", "centrifuge", "refractometer"], families: ["urinalysis", "fecal_parasitology", "blood_smear", "cytology"], sourceIds: ["CORNELL-URINALYSIS", "CORNELL-PARASITOLOGY", "CORNELL-CYTOLOGY"], currentIntegrationStatus: "manual" },
    { equipmentClass: "external_laboratory", representativeModels: ["university or commercial reference laboratory"], families: Object.keys(familyBlueprints).filter((key) => key !== "legacy_exception"), sourceIds: ["CORNELL-CHEMISTRY", "UC-DAVIS-PCR", "UC-DAVIS-ENDOCRINOLOGY"], currentIntegrationStatus: "manual_result_entry_or_attachment" },
  ],
};

const labTests = authoring.records.filter((record) => record.recordType === "lab_test");
const resultShapeMatrix = {
  schemaVersion: `${schemaPrefix}-result-shape-matrix/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  commonResultContract: {
    valueTypes: ["quantity", "code", "boolean", "string", "range", "ratio", "attachment", "repeating_observation"],
    interpretationExamples: ["low", "normal", "high", "negative", "positive", "detected", "not_detected", "invalid", "inconclusive", "not_performed", "graded", "narrative"],
    requiredContext: ["species", "specimen", "method", "equipment_or_external_lab", "result_profile_revision", "performed_at", "performer", "status"],
    referenceProfileDimensions: ["species", "breed_if_needed", "age", "sex", "physiologic_state", "specimen", "preanalytics", "method", "manufacturer", "model", "unit", "effective_dates", "source", "validation_status"],
    unitsStandard: "UCUM",
    snapshotAtResultTime: true,
  },
  evidenceScope: "local_authoring_fixture_not_remote_schema_audit",
  currentLabTests: labTests.map((test) => ({
    labTestKey: test.masterKey,
    displayName: recordName(test),
    testCode: test.detail?.testCode ?? null,
    currentResultInputTypeKey: test.detail?.resultInputTypeKey ?? null,
    currentCanonicalUnitKey: test.detail?.canonicalUnitKey ?? null,
    currentDecimalScale: test.detail?.decimalScale ?? null,
    directlyOrderable: directlyOrderableTestKeys.has(test.masterKey),
    ...resultShapeForTest(test),
    currentReferenceProfilePresent: false,
    requiresVersionedResultProfile: true,
  })),
  proposedMissingAtomicExamples: {
    scope: "landscape examples only; exact IDs and full content belong to OED-LAB-02 and later family work",
    cbc: familyBlueprints.hematology_cbc.recommendedChildren,
    urinalysis: familyBlueprints.urinalysis.recommendedChildren,
    cytology: familyBlueprints.cytology.recommendedChildren,
  },
};

const sourceLedger = {
  schemaVersion: `${schemaPrefix}-source-ledger/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  sourcePolicy: {
    perOrderMethodVerificationComplete: false,
    sourceAccessDatesPreservedFromOriginalResearch: true,
    preferred: ["standards_body", "professional_guideline", "university_diagnostic_laboratory", "manufacturer_manual", "manufacturer_test_menu"],
    excludedAsSoleEvidence: ["search_snippet", "general_blog", "reseller_page"],
    numericValuesCopiedIntoMaster: false,
  },
  sources,
};

const orderIdsBy = (predicate) => inventoryRows.filter(predicate).map((row) => row.orderId);
const gapRows = [
  {
    gapId: "LAB-GAP-01",
    severity: "blocker",
    title: "86개 중 1개 오더에 검사 프로필 연결이 없다",
    impactedOrderIds: orderIdsBy((row) => row.currentBinding.bindingType === "none"),
    finding: "phase1.optionb.v1.order.metabolic은 fallback 경로에 있으며 lab order profile이 없다.",
    requiredAction: "임의 연결하지 말고 제거 또는 명시적 재정의 결정을 한다.",
    targetWork: "OED-LAB-03",
  },
  {
    gapId: "LAB-GAP-02",
    severity: "blocker",
    title: "로컬 V4 검사 정의 16개에 독립 주문 연결이 없다",
    impactedLabTestKeys: labTests.filter((test) => !directlyOrderableTestKeys.has(test.masterKey)).map((test) => test.masterKey),
    finding: "RBC, HGB, AST, albumin, Na, K, Cl, PT, aPTT 등은 패널 구성원으로 존재하지만 직접 주문할 order profile이 없다.",
    requiredAction: "독립 재검이 필요한 최종 항목마다 안정적인 order ID와 profile을 만든다.",
    targetWork: "OED-LAB-03",
  },
  {
    gapId: "LAB-GAP-03",
    severity: "blocker",
    title: "CBC 패널이 3개 항목으로 축소돼 있다",
    impactedOrderIds: ["cm.order.lab.panel.cbc-basic"],
    finding: "현재 WBC, HCT, PLT만 연결돼 있어 RBC, HGB, 적혈구 지수, 백혈구 감별계수와 형태 결과가 없다.",
    requiredAction: "OED-LAB-02에서 CBC 하위 항목, 결과형, 대표 장비 프로필과 수동 입력 예시를 고정한다.",
    targetWork: "OED-LAB-02",
  },
  {
    gapId: "LAB-GAP-04",
    severity: "blocker",
    title: "요시험지·요침사가 복합 결과를 한 필드로 축소한다",
    impactedOrderIds: orderIdsBy((row) => row.familyId === "urinalysis"),
    finding: "시험지 성분, 비중, 침사 입자, 이미지와 UPC가 독립 결과로 일관되게 모델링되지 않았다.",
    requiredAction: "시험지·비중·침사·UPC 하위 세트와 atomic result를 분리한다.",
    targetWork: "OED-LAB-03",
  },
  {
    gapId: "LAB-GAP-05",
    severity: "blocker",
    title: "로컬 V4 검사 패널 연결에 중첩 구성이 없다",
    impactedOrderIds: orderIdsBy((row) => row.orderId.includes(".lab-service.") || row.familyId === "composite_diagnostic_plan" || /수술 전/.test(row.displayName)),
    finding: "건강검진·노령·응급·증상별 조합이 실제 하위 패널 목록이 아니라 기존 패널 하나의 별칭으로 연결된다.",
    requiredAction: "순환 없는 nested membership과 실행 시 atomic expansion 계약을 설계한다.",
    targetWork: "OED-LAB-03",
  },
  {
    gapId: "LAB-GAP-06",
    severity: "blocker",
    title: "버전 있는 정상범위·판별 프로필이 없다",
    impactedOrderIds: inventoryRows.map((row) => row.orderId),
    finding: "현재 결과 정의에는 종·검체·방법·장비별 정상범위 출처와 버전, 검증 상태를 함께 저장하지 않는다.",
    requiredAction: "원자 결과 정의와 결과 프로필을 분리하고 결과 저장 시 적용 프로필을 스냅샷으로 남긴다.",
    targetWork: "OED-LAB-03",
  },
  {
    gapId: "LAB-GAP-07",
    severity: "high",
    title: "워크스페이스 수행 장비·수기·외부검사실 선택 계약이 없다",
    impactedOrderIds: inventoryRows.map((row) => row.orderId),
    finding: "현재 장비 보유와 연동 상태를 구분하지 않으며 결과 입력 경로가 검사 프로필에 고정되지 않는다.",
    requiredAction: "workspace execution profile과 integration status를 명시한다. 현재 프로토타입은 모두 수동 입력 또는 첨부다.",
    targetWork: "OED-LAB-03",
  },
  {
    gapId: "LAB-GAP-08",
    severity: "high",
    title: "감염성 선별 패널이 종과 검사법을 혼합한다",
    impactedOrderIds: ["cm.order.v4.lab-panel.08", "cm.order.v4.lab-service.infectious-workup"],
    finding: "개·고양이 항원·항체·PCR·분변 검사가 한 패널에 무조건 포함돼 있다.",
    requiredAction: "종·검사법별 패널과 조건부 구성을 분리하고 패널 revision을 저장한다.",
    targetWork: "later_family_research",
  },
  {
    gapId: "LAB-GAP-09",
    severity: "high",
    title: "부신 검사가 시간점이 있는 프로토콜을 표현하지 못한다",
    impactedOrderIds: ["cm.order.v4.lab-panel.06", "cm.order.v4.lab-test.20"],
    finding: "단회 cortisol 결과 자체는 유효한 구조다. ACTH 자극·억제검사로 확장하려면 여러 채혈 시간과 해석을 별도로 담아야 한다.",
    requiredAction: "protocol, timepoint, agent, 결과 묶음과 해석을 모델링한다.",
    targetWork: "later_family_research",
  },
  {
    gapId: "LAB-GAP-10",
    severity: "high",
    title: "췌장 평가에 pancreas-specific lipase 항목이 없다",
    impactedOrderIds: ["cm.order.v4.lab-panel.03", "cm.order.v4.lab-service.vomiting-diarrhea"],
    finding: "현재 amylase와 일반 lipase 중심이며 종 특이 pancreatic lipase를 구분하지 않는다.",
    requiredAction: "일반 효소와 췌장 특이 검사를 별도 atomic order로 정의한다.",
    targetWork: "later_family_research",
  },
  {
    gapId: "LAB-GAP-11",
    severity: "high",
    title: "정확한 상용 장비값이 없는 경우의 기능용 프로필이 아직 없다",
    impactedOrderIds: inventoryRows.filter((row) => ["source_partial", "functional_fixture_required"].includes(familyBlueprints[row.familyId].valueEvidenceStatus)).map((row) => row.orderId),
    finding: "구조는 확인됐지만 모든 장비·종·검사법 조합의 공개 수치가 확보된 것은 아니다.",
    requiredAction: "공식 값이 부족하면 상용 모델명이 아닌 CLAiR 데모 프로필에 synthetic_functional_fixture를 명시한다.",
    targetWork: "OED-LAB-02_and_later_family_research",
  },
];
const gapMatrix = {
  schemaVersion: `${schemaPrefix}-gap-matrix/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  evidenceScope: "local_v4_fixture_gaps_remote_schema_not_audited",
  counts: {
    total: gapRows.length,
    blocker: gapRows.filter((row) => row.severity === "blocker").length,
    high: gapRows.filter((row) => row.severity === "high").length,
  },
  gaps: gapRows,
};

const correctionAudit = {
  schemaVersion: `${schemaPrefix}-correction-audit/v1`,
  generatedAt: today,
  originalResearchDate,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  remoteStateVerified: false,
  sourceFileFingerprints,
  supersededInventoryFingerprint: "356a5931be0f1dca1b250fd4ae7341bde13793bfe5fe6e4d6bb1bde9871620f4",
  classificationCorrections: [
    { orderId: "cm.order.v4.lab-test.32", before: "hematology_cbc", after: "infectious_disease", reason: "Antigen test identity, not the disease-name substring 백혈구" },
    { orderId: "cm.order.v4.lab-service.preanesthetic-expanded", before: "clinical_chemistry", after: "composite_diagnostic_plan", reason: "Composite service intent was hidden by the chemistry default branch" },
  ],
  specimenPolicy: "Compare labels only; no source is promoted to a clinically validated specimen or applied automatically. Panel child specimens require separate review.",
  specimenStatusCounts: Object.fromEntries([...new Set(inventoryRows.map((row) => row.specimenComparisonStatus))]
    .map((status) => [status, inventoryRows.filter((row) => row.specimenComparisonStatus === status).length])),
  evidenceStatusCounts: Object.fromEntries([...new Set(inventoryRows.map((row) => row.researchStatus))]
    .map((status) => [status, inventoryRows.filter((row) => row.researchStatus === status).length])),
  orders: inventoryRows.map((row) => ({
    orderId: row.orderId,
    familyId: row.familyId,
    fixtureSpecimenKey: row.currentBinding.specimenKey,
    priorNonAppliedCandidateSpecimen: row.priorCandidateDefaults?.specimenType ?? null,
    comparisonStatus: row.specimenComparisonStatus,
    appliedSpecimen: null,
  })),
  nextWork: "OED-LAB-02: exact CBC method/profile candidates; OED-LAB-03: actual schema audit. Reconcile other candidate conflicts before any later application.",
};

const files = new Map([
  ["oed-lab-01-order-inventory.v1.json", inventory],
  ["oed-lab-01-set-atomic-map.v1.json", setAtomicMap],
  ["oed-lab-01-execution-route-matrix.v1.json", routeMatrix],
  ["oed-lab-01-equipment-landscape.v1.json", equipmentLandscape],
  ["oed-lab-01-result-shape-matrix.v1.json", resultShapeMatrix],
  ["oed-lab-01-source-ledger.v1.json", sourceLedger],
  ["oed-lab-01-gap-matrix.v1.json", gapMatrix],
  ["oed-lab-01-correction-audit.v1.json", correctionAudit],
]);

await mkdir(ARTIFACT_DIR, { recursive: true });
const artifactFingerprints = {};
for (const [name, value] of files) {
  const body = canonicalJson(value);
  await writeFile(resolve(ARTIFACT_DIR, name), body);
  artifactFingerprints[name] = sha256(body);
}

const manifestOutput = {
  schemaVersion: `${schemaPrefix}-artifact-manifest/v1`,
  generatedAt: today,
  artifactState: "research_only_non_applied",
  applicationAllowed: false,
  runtimeImportAllowed: false,
  databaseMutationAllowed: false,
  masterMutationAllowed: false,
  sourceFileFingerprints,
  researchCompletedScope: "broad_family_landscape_only",
  orderSpecificMethodVerificationComplete: false,
  counts: inventory.counts,
  artifactFingerprints,
  nextWork: "OED-LAB-02",
};
const manifestBody = canonicalJson(manifestOutput);
await writeFile(resolve(ARTIFACT_DIR, "artifact-manifest.v1.json"), manifestBody);

const markdownCell = (value) => String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
const orderRows = inventoryRows.map((row, index) => {
  const binding = row.currentBinding.bindingType === "lab_panel"
    ? `panel · ${row.currentPanelMemberCount}`
    : row.currentBinding.bindingType === "lab_test"
      ? "atomic test"
      : "연결 없음";
  return `| ${index + 1} | \`${markdownCell(row.orderId)}\` | ${markdownCell(row.displayName)} | ${markdownCell(row.familyLabel)} | ${binding} | \`${row.researchStatus}\` |`;
}).join("\n");
const familyRows = Object.entries(familyBlueprints).map(([familyId, blueprint]) =>
  `| \`${familyId}\` | ${markdownCell(blueprint.label)} | ${markdownCell(blueprint.targetShape)} | ${markdownCell(blueprint.primaryRoutes.join(", ") || "결정 필요")} | \`${blueprint.structureEvidenceStatus}\` | \`${blueprint.valueEvidenceStatus}\` |`,
).join("\n");
const gapReportRows = gapRows.map((gap) =>
  `| \`${gap.gapId}\` | ${gap.severity} | ${markdownCell(gap.title)} | ${(gap.impactedOrderIds ?? gap.impactedLabTestKeys ?? []).length} | \`${gap.targetWork}\` |`,
).join("\n");
const sourceRows = sources.map((source) =>
  `| \`${source.sourceId}\` | ${markdownCell(source.organization)} | [${markdownCell(source.title)}](${source.url}) | ${markdownCell(source.supports.join(", "))} |`,
).join("\n");
const reportDraft = `---
id: "CLINICAL-MASTER-OED-LAB-01-REPORT"
type: "Research Report"
title: "Clinical Laboratory 86-Order Landscape Research"
description: "임상병리 마스터 오더 86건의 현재 구조, 외부 근거, 목표 계층, 수행 경로, 장비 종류, 결과 모양과 다음 작업 인계를 정리한 AI용 조사 원문이다."
status: "draft"
area: "clinical-master"
tags: [clinical-master, laboratory, deep-research, order-set, atomic-result]
updated: "${today}"
---

# OED-LAB-01 임상병리 검사 86개 외부 전체 구조 조사

## 결론

86개를 로컬 고정 목록·V4 표본·기존 비적용 후보와 대조했다. 검사군별 외부 자료는 구조를 정리하는 데 사용했으며 개별 검사법·수치까지 검증한 것은 아니다. 로컬 표본에는 검사 세트와 개별 결과 정의가 일부 있지만 **세트 → 독립 하위 오더 → 결과값** 구조는 보완이 필요하다.

로컬 V4 표본의 CBC에는 WBC·HCT·PLT 세 항목만 연결돼 있다. 72개 검사 정의 중 16개는 독립 order profile이 없다. 건강검진·노령·응급 검사 조합은 기존 패널 하나를 가리키며, 종·검체·검사법·장비별 정상범위와 판별 규칙을 담은 버전 프로필도 이 표본에서 확인되지 않는다. 실제 DB와 앱의 지원 범위는 OED-LAB-03에서 별도로 확인한다.

이번 조사는 구조를 정리한 단계다. 앱, DB, Airtable, Supabase, 마스터 오더에는 아무것도 적용하지 않았다. 정확한 CBC 항목과 프로토타입용 대표 값을 고정하는 다음 작업은 \`OED-LAB-02\`다.

## 2026-09-06 보정 결과

86건의 분류와 검체 표기, 근거 연결을 다시 대조했다. 범백혈구감소증 항원 검사는 CBC에서 감염성 검사로, 마취 전 확장 검사 조합은 혈액화학에서 복합 검사 조합으로 바로잡았다. 미등록 ID를 혈액화학으로 자동 분류하던 처리도 제거했다.

이전 WP-01A 비적용 후보의 검체와 로컬 V4 표본의 검체 표기가 충돌하는 항목은 5건이다. 요단백 평가 패널, 감염성 선별 패널, 개 파보 항원, 개 디스템퍼 항원, 고양이 범백혈구감소증 항원 검사다. 두 자료를 비교한 결과이며 특정 제품에서 허용하는 검체를 확정한 것은 아니다. 패널은 하위 검사마다 검체가 다를 수 있다.

나머지는 같은 검체 표기 27건, 혈액 채취·처리 조건 미지정 38건, 후보 검체 없음 12건, 채취 검체와 표본 제작 형태의 구분 필요 2건, 후보가 other로만 지정된 항목 1건, 로컬 검사 연결 없음 1건이다. 검체가 일치해도 임상 검증 완료를 뜻하지 않는다. 원본 후보와 표본은 수정하지 않았다.

기존 currentDefaultSummary라는 이름 때문에 이전 후보가 현재 기본값처럼 보였다. 이를 priorCandidateDefaults로 바꾸고 비적용 후보라는 출처를 명시했다. 실제 원격 마스터·병원관리 값을 읽은 결과는 아니다.

검사군 자료가 있다는 이유로 개별 검사까지 확인 완료로 표시하던 처리도 수정했다. 85건은 source_partial, 레거시 예외 1건은 functional_fixture_required다. 이 상태는 조사 근거를 어디까지 확보했는지만 나타낸다. 오더 사용 가능 상태나 검수 대기 상태는 바꾸지 않는다. 검사별 정확한 방법과 정상범위 숫자는 이번 단계에서 추출하지 않았다.

수행 경로와 장비는 검사군 후보로만 표시한다. 개별 검사에 대한 지원 여부는 후속 조사에서 확인한다. 개별 오더에 검사군 전체 하위 목록을 붙이던 추천도 제거했다.

다음은 OED-LAB-02에서 CBC의 하위 항목, 대표 프로필, 단위·정상범위·판별, 단일 항목 재검 후보를 완성하는 일이다. 이번 보정은 조사 파일과 보고서에만 반영했다. 앱·DB·마스터에는 적용하지 않았다.

보정 검증은 로컬 회귀 테스트 7개 통과, 생성 원문과 최종 보고서 표 일치, 입력 파일·산출물 해시 일치까지 확인했다. HTML은 전체 86건, CBC 검색 4건, 범백 검색 1건이며 데스크톱·모바일 너비에서 가로 넘침과 브라우저 오류가 없었다. 실제 앱 화면 검증은 이번 범위에 포함하지 않았다. 전체 문서 검사는 기존 persona 안내서 링크 오류 1건으로 실패했고 해당 파일은 수정하지 않았다.

## 조사 범위와 경계

- 기준 목록은 WP-00의 \`clinical_lab\` 86건이다.
- 레포의 V4 authoring fixture에 있는 72개 검사 정의, 18개 패널, 120개 연결, 85개 오더 프로필을 함께 대조했다.
- 외부 근거는 표준기관, 수의임상병리 전문단체, 수의과대학 검사실, 제조사 공식 메뉴·설명서만 사용했다.
- 숫자 정상범위를 마스터 후보로 옮기지 않았다. 이 조사에서 확인한 것은 구조, 값의 형태, 자료 확보 가능성과 대표 수행 경로다.
- 실제 병원의 장비 보유나 시스템 연동을 가정하지 않았다. 장비 결과 입력은 현재 모두 \`not_integrated + manual_entry\`다.
- 찾지 못한 값은 런타임 fallback으로 채우지 않는다. 필요한 경우 후속 단계에서 CLAiR 데모 프로필의 \`synthetic_functional_fixture\`로 명시한다.

## 현재 구조를 숫자로 보면

| 항목 | 현재 확인값 | 의미 |
| --- | ---: | --- |
| 임상병리 오더 | 86 | 이번 조사 전체 범위 |
| 검사 결과 정의 | 72 | 수치·정성·서술 결과를 정의한 현재 lab_test 수 |
| 검사 패널 정의 | 18 | 현재 lab_panel 수 |
| 패널-검사 연결 | 120 | 평면 panel → lab_test 연결 수 |
| 오더-검사 프로필 | 85 | 86개 중 1개가 연결되지 않음 |
| 직접 주문 가능한 검사 정의 | 56 | lab_test와 직접 연결된 order profile 수 |
| 독립 주문 연결이 없는 검사 정의 | 16 | 로컬 V4 표본에 독립 order profile이 없음 |
| 중첩 검사 패널 | 0 | 로컬 V4 검사 연결 기준; 실제 DB 지원 여부는 별도 조사 |
| 앱·DB 적용 | 0 | 전부 비적용 조사 자료 |

## 외부 조사에서 확인한 공통 구조

### 1. 주문 세트와 결과를 분리해야 한다

LOINC는 패널을 여러 child 결과를 열거하는 주문 묶음으로 설명한다. FHIR도 검사 요청은 ServiceRequest, 최종 값은 Observation, 묶인 보고서는 DiagnosticReport로 나눈다. 따라서 CBC 부모에 결과값 하나를 넣는 방식보다, CBC를 주문하면 WBC·RBC·HGB 같은 독립 결과가 생성되는 방식이 맞다.

하위 항목이 독립 재검 대상이면 단순 component가 아니라 별도 order/result identity가 필요하다. 기존 결과를 덮어쓰지 않고 새 주문을 만들고, 최초 세트와 직전 결과를 연결해야 한다.

### 2. 정상범위는 검사명 하나에 붙는 값이 아니다

ASVCP와 대학 검사실 자료를 보면 정상범위는 동물종, 연령과 필요한 경우 품종·성별, 검체, 전처리, 검사법, 분석 장비와 시약에 따라 달라진다. 그래서 \`WBC 정상범위\` 하나를 전 병원 공통값으로 저장하면 안 된다.

마스터에는 버전 있는 결과 프로필 후보를 두고, 워크스페이스는 실제 사용하는 장비·수기·외부검사실 프로필을 선택해야 한다. 결과를 저장할 때 당시 단위, 정상범위, 판별 규칙, 프로필 버전을 함께 스냅샷으로 남겨야 한다.

### 3. 검사마다 결과 모양이 다르다

- CBC·화학·응고: 주로 수치, 단위, 미달·정상·초과, 장비 플래그
- 신속 항원·항체와 PCR: 양성·음성·검출·미검출·무효·판정 불가
- 요시험지: 항목별 반정량 코드와 일부 수치
- 요침사·분변 현미경: 반복 관찰값, 개수나 등급, 이미지, 소견
- 혈액도말·세포검사: 형태, 등급, 서술, 이미지와 종합 해석
- 코르티솔 동적검사: 프로토콜과 채혈 시간점별 여러 수치

하나의 \`numeric/text/coded\` 칸만으로는 이 결과들을 안전하게 표현할 수 없다.

## 검사군별 전체 지도

| family ID | 검사군 | 목표 구조 | 검사군 수행 경로 후보 | 구조 근거 | 검사군 수준 값 자료 상태 |
| --- | --- | --- | --- | --- | --- |
${familyRows}

### 대표 구조 예시

#### CBC

외부 자료에서 확인되는 CBC는 적혈구계, 백혈구계, 혈소판계와 형태 검토를 함께 가진다. 최소한 WBC, 백혈구 감별 절대수·비율, RBC, HGB, HCT, MCV, MCH, MCHC, RDW, PLT, MPV를 개별 결과로 다룰 수 있어야 한다. 망상적혈구와 혈액도말은 조건부 또는 별도 검사로 연결할 수 있다.

로컬 CBC 표본에는 WBC·HCT·PLT 세 항목만 연결돼 있다. RBC와 HGB 정의는 이미 fixture에 있지만 독립 order profile과 CBC 패널 연결이 없다. 먼저 이 부분을 기능 표본으로 바로잡는 것이 \`OED-LAB-02\`다.

#### 요검사

요검사는 물리적 관찰, 비중, 시험지, 침사, 필요 시 UPC가 합쳐진 세트다. 시험지 한 줄과 침사 한 줄만 두면 pH·단백·당·케톤·빌리루빈·혈액, RBC·WBC·세균·상피·원주·결정, 이미지와 소견을 각각 기록할 수 없다. 시험지·비중·침사·UPC를 하위 세트로 나누고 최종 관찰값을 독립 결과로 둬야 한다.

#### 감염성 검사

항원, 항체와 PCR은 같은 질환 이름을 쓰더라도 다른 검사다. 현재 감염성 질환 선별 패널은 개·고양이, 분변 검사, 신속키트와 PCR을 한 번에 묶는다. 실제 제품에서는 종·검사법·패널 버전을 나누고, 각 항목의 양성·음성·무효·판정 불가 상태를 따로 저장해야 한다.

#### 세포검사와 혈액도말

이 검사들은 보편적인 low/high 숫자 범위를 억지로 만들 대상이 아니다. 검체 부위와 채취법, 적합성, 세포·미생물·염증 소견, 진단과 감별, 이미지와 판독자 의견을 보존한다. 관절액은 여기에 단백, 점도, 세포수와 감별계수 같은 수치 결과가 더해지는 복합 패널이다.

## 현재 구조의 핵심 문제

| 갭 | 심각도 | 내용 | 영향 수 | 다음 작업 |
| --- | --- | --- | ---: | --- |
${gapReportRows}

## 86개 오더 전수 분류표

\`panel · N\`과 \`atomic test\`는 로컬 V4 표본의 연결이다. 조사 상태는 검사군 근거 확보 범위이며 개별 제품·검사법·정상범위 검증이나 오더 검수·사용 가능 상태가 아니다. 검사군 공통 자료로 개별 검사를 확인 완료 처리하지 않는다.

| # | order ID | 표시명 | 검사군 | 현재 연결 | 조사 상태 |
| ---: | --- | --- | --- | --- | --- |
${orderRows}

## 장비와 수행 경로 결론

대표 장비 후보는 기능 구조를 확인하기 위해 골랐다. 혈구분석기, 화학분석기, 응고분석기, 요시험지 분석기, 요침사 분석기, 세포 분석기, 신속키트 판독기와 수기 현미경·원심분리기·굴절계를 구분했다.

이름을 적어 둔 장비가 청담점이나 다른 워크스페이스에 있다는 뜻은 아니다. 프로토타입에서는 워크스페이스가 사용할 수행 프로필을 명시적으로 선택하고, 화면에는 \`수동 입력\`과 \`연동 안 됨\`을 그대로 보여줘야 한다. 선택하지 않은 장비 프로필이나 화면 목업값으로 자동 대체하지 않는다.

## 출처 원장

| source ID | 기관 | 문서 | 직접 뒷받침하는 범위 |
| --- | --- | --- | --- |
${sourceRows}

## 다음 작업 인계: OED-LAB-02

다음 작업은 CBC 하나를 끝까지 완성하는 기능 표본 조사다. 아래 순서로 진행한다.

1. CBC 하위 결과 항목을 core, optional, manual review로 나누고 각 항목의 안정적인 후보 ID를 만든다.
2. 개·고양이용 대표 장비 프로필 하나와 CLAiR 데모 프로필 사용 조건을 정한다.
3. 각 결과의 입력형, UCUM 단위, 소수점, 정상범위 차원, 판별과 장비 플래그를 확정한다.
4. CBC 전체 주문과 WBC 같은 단일 하위 오더 재검 흐름을 함께 그린다.
5. 결과 화면에 장비, 수동 입력, 연동 안 됨, 단위, 정상범위, 판별, 형태 소견과 이미지를 어떻게 보여줄지 정의한다.
6. 이 단계에서도 앱·DB·마스터에는 적용하지 않는다. 제품 검토 뒤 \`OED-LAB-03\`에서 목표 저장 구조와 전환 계획을 만든다.

### 다음 에이전트가 먼저 읽을 파일

1. \`OED-LAB-00-requirements-and-research-contract.md\`
2. \`OED-LAB-01-clinical-laboratory-landscape-research.md\`
3. 이 \`report-source.md\`
4. \`oed-lab-01-gap-matrix.v1.json\`
5. \`oed-lab-01-set-atomic-map.v1.json\`
6. \`oed-lab-01-result-shape-matrix.v1.json\`
7. \`oed-lab-01-source-ledger.v1.json\`

### 다음 작업에서 지켜야 할 금지선

- 실제 병원 데이터나 임상 검증값이라고 표현하지 않는다.
- 상용 장비 이름에 임의 정상범위를 붙이지 않는다.
- 값이 없을 때 런타임 fallback 또는 가라 오더를 만들지 않는다.
- 연구 후보를 앱, Airtable, Supabase, 마스터 또는 워크스페이스에 적용하지 않는다.
- 원격 DB 조사와 변경은 \`OED-LAB-03\`의 별도 범위와 승인 기준을 따른다.

## 산출물 목록

- \`artifact-manifest.v1.json\`
- \`oed-lab-01-order-inventory.v1.json\`
- \`oed-lab-01-set-atomic-map.v1.json\`
- \`oed-lab-01-execution-route-matrix.v1.json\`
- \`oed-lab-01-equipment-landscape.v1.json\`
- \`oed-lab-01-result-shape-matrix.v1.json\`
- \`oed-lab-01-source-ledger.v1.json\`
- \`oed-lab-01-gap-matrix.v1.json\`
- \`oed-lab-01-correction-audit.v1.json\`

모든 JSON은 \`research_only_non_applied\`, \`applicationAllowed: false\`다.
`;
await writeFile(resolve(ARTIFACT_DIR, "report-source.draft.md"), reportDraft);

console.log(JSON.stringify({ artifactDir: ARTIFACT_DIR, ...manifestOutput }, null, 2));
