#!/usr/bin/env node
// Non-applied research artifacts. No database, network or runtime imports.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateNumeric, expandSet, snapshotOrder, requestRetest, calculateDerived } from "./lib/oed-lab-02-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = resolve(root, "docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-02");
const date = "2026-09-06";
const revision = "oed-lab-02.v1";
const envelope = { generatedAt: date, revision, artifactState: "research_only_non_applied", applicationAllowed: false };
const hash = (body) => createHash("sha256").update(body).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const inputs = ["tests/fixtures/clinical-master-operational-v4-authoring.json",
  "docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-01/artifact-manifest.v1.json"];
const inputBodies = await Promise.all(inputs.map((path) => readFile(resolve(root, path), "utf8")));
const sourceFingerprints = Object.fromEntries(inputs.map((path, i) => [path, hash(inputBodies[i])]));
const authoring = JSON.parse(inputBodies[0]);

const sources = [
  ["IDEXX-RI", "IDEXX", "ProCyte Dx reference intervals", "https://www.idexx.com/files/procyte-dx-reference-ranges-en.pdf", "2019; 06-27445-12; VetLab Station 5.01", "p1 dog/cat columns visually checked; 19 parameters, cat PDW N/A; no percentage intervals", "turn148view0"],
  ["IDEXX-GUIDE", "IDEXX", "ProCyte Dx Operator’s Guide", "https://www.idexx.com/files/procyte-dx-operators-guide-en.pdf", "2021; 06-0002359-01", "pp16,32–33,46,50–51: parameters, specimen, flags, display/linearity distinction; microtube volume conflict retained", "turn153view0"],
  ["IDEXX-MENU", "IDEXX", "ProCyte Dx product parameters", "https://www.idexx.com/en/veterinary/analyzers/hematology/procyte-dx-analyzer/", null, "25 numeric outputs plus nRBC/BAND suspicion indicators; species may differ", "turn149view0"],
  ["CORNELL-CBC", "Cornell University AHDC", "Hematology", "https://www.vet.cornell.edu/animal-health-diagnostic-center/testing/testing-protocols-interpretations/hematology", null, "Automated vs smear-inclusive CBC; optional reticulocytes; independent tests; no Cornell numeric ranges transferred", "turn152view0"],
  ["CORNELL-INDICES", "Cornell University eClinpath", "MCHC/CHCM", "https://eclinpath.com/hematology/tests/mchc/", null, "MCH and MCHC calculation context; not ProCyte internal implementation", "turn156view0"],
  ["UCUM", "UCUM", "UCUM specification", "https://ucum.org/ucum", null, "case-sensitive unit syntax; 10*3/uL, 10*6/uL mappings are this candidate's explicit normalization", "turn156view1"],
  ["FHIR-REQUEST", "HL7", "FHIR R4 ServiceRequest", "https://hl7.org/fhir/R4/servicerequest.html", "4.0.1", "Request identity and references; retest policy is a CLAiR decision, not replaces mapping", "turn152view1"],
  ["FHIR-RESULT", "HL7", "FHIR R4 Observation", "https://hl7.org/fhir/R4/observation.html", "4.0.1", "Result type, absent data, specimen, device, reference range; no FHIR conformance claim", "turn156view3"],
].map(([sourceId, publisher, title, url, documentVersion, accessNotes, nativeReference]) =>
  ({ sourceId, publisher, title, url, documentVersion, accessedAt: date, accessNotes, nativeReference }));

// Pinned first-page facts. Null is explicitly N/A, not a missing zero.
// code, display unit, UCUM, canine low/high, feline low/high, UI decimals (product choice).
const published = [
  ["RBC","M/µL","10*6/uL",5.65,8.87,6.54,12.20,2],
  ["HCT","%","%",37.3,61.7,30.3,52.3,1],
  ["HGB","g/dL","g/dL",13.1,20.5,9.8,16.2,1],
  ["MCV","fL","fL",61.6,73.5,35.9,53.1,1],
  ["MCH","pg","pg",21.2,25.9,11.8,17.3,1],
  ["MCHC","g/dL","g/dL",32.0,37.9,28.1,35.8,1],
  ["RDW","%","%",13.6,21.7,15.0,27.0,1],
  ["RETIC_ABS","K/µL","10*3/uL",10.0,110.0,3.0,50.0,1],
  ["RETIC_HGB","pg","pg",22.3,29.6,13.2,20.8,1],
  ["WBC","K/µL","10*3/uL",5.05,16.76,2.87,17.02,2],
  ["NEU_ABS","K/µL","10*3/uL",2.95,11.64,2.30,10.29,2],
  ["LYM_ABS","K/µL","10*3/uL",1.05,5.10,0.92,6.88,2],
  ["MONO_ABS","K/µL","10*3/uL",0.16,1.12,0.05,0.67,2],
  ["EOS_ABS","K/µL","10*3/uL",0.06,1.23,0.17,1.57,2],
  ["BASO_ABS","K/µL","10*3/uL",0.00,0.10,0.01,0.26,2],
  ["PLT","K/µL","10*3/uL",148,484,151,600,0],
  ["MPV","fL","fL",8.7,13.2,11.4,21.6,1],
  ["PDW","fL","fL",9.1,19.4,null,null,1],
  ["PCT","%","%",0.14,0.46,0.17,0.86,2],
];
const percentageCodes = ["NEU_PCT","LYM_PCT","MONO_PCT","EOS_PCT","BASO_PCT","RETIC_PCT"];
const parameterRows = [...published, ...percentageCodes.map((code) => [code,"%","%",null,null,null,null,2])];
const existing = {
  WBC: ["cm.order.lab.test.cbc-wbc","cm.lab-test.cbc-wbc"],
  HCT: ["cm.order.lab.test.cbc-hct","cm.lab-test.cbc-hct"],
  PLT: ["cm.order.lab.test.cbc-plt","cm.lab-test.cbc-plt"],
  RBC: [null,"cm.lab-test.synthetic-01"], HGB: [null,"cm.lab-test.synthetic-02"],
  RETIC_PCT: ["cm.order.synthetic.lab-08","cm.lab-test.synthetic-13"],
  SMEAR: ["cm.order.synthetic.lab-09","cm.lab-test.synthetic-14"],
};
const names = { WBC:"백혈구 수", RBC:"적혈구 수", HCT:"헤마토크릿", HGB:"혈색소", MCV:"평균 적혈구 용적", MCH:"평균 적혈구 혈색소량", MCHC:"평균 적혈구 혈색소 농도", RDW:"적혈구 크기 분포", PLT:"혈소판 수", MPV:"평균 혈소판 용적", PDW:"혈소판 크기 분포", PCT:"혈소판 용적률", RETIC_ABS:"망상적혈구 절대수", RETIC_PCT:"망상적혈구 비율", RETIC_HGB:"망상적혈구 혈색소", SMEAR:"혈액도말 형태 검토" };
const differentialNames = {NEU:"호중구",LYM:"림프구",MONO:"단핵구",EOS:"호산구",BASO:"호염기구"};
for (const [code,name] of Object.entries(differentialNames)) { names[`${code}_ABS`] = `${name} 절대수`; names[`${code}_PCT`] = `${name} 비율`; }
const optional = new Set(["RETIC_ABS","RETIC_PCT","RETIC_HGB","PDW","PCT"]);
const derived = {
  HCT: { inputs:["RBC","MCV"], formula:"RBC * MCV / 10" },
  MCH: { inputs:["HGB","RBC"], formula:"HGB * 10 / RBC" },
  MCHC: { inputs:["HGB","HCT"], formula:"HGB * 100 / HCT" },
  PCT: { inputs:["PLT","MPV"], formula:"PLT * MPV / 10000" },
};
for (const code of Object.keys(differentialNames)) derived[`${code}_PCT`] = { inputs:[`${code}_ABS`,"WBC"], formula:`${code}_ABS / WBC * 100` };
derived.RETIC_PCT = {inputs:["RETIC_ABS","RBC"],formula:"RETIC_ABS / (RBC * 1000) * 100"};
const definitions = [...parameterRows.map(([code,displayUnit,unit,,,,,decimalScale]) => ({
  code, displayName:names[code], resultDefinitionId: existing[code]?.[1] ?? `candidate.lab-test.cbc.${code.toLowerCase()}.v1`,
  revision, kind:"quantity", unit, displayUnit, decimalScale, decimalPolicy:"prototype_display_only_preserve_raw_input",
  group: optional.has(code) ? "optional" : "core", availability:"active", clinicalValidation:"not_clinically_validated",
  provenance:"synthetic_research_informed", observationDefault:null,
  acquisition: derived[code] ? "derived_or_device_reported" : "device_reported_measurement_or_index",
  calculation: derived[code] ? {...derived[code], policy:"same_attempt_inputs_only_no_prior_value_fallback", authority:"prototype_arithmetic_relation_not_device_algorithm"} : null,
  sourceIds:["IDEXX-MENU","IDEXX-GUIDE",...(["MCH","MCHC"].includes(code) ? ["CORNELL-INDICES"] : [])],
})), {
  code:"SMEAR", displayName:names.SMEAR, resultDefinitionId:existing.SMEAR[1], revision,
  kind:"narrative_with_attachments", unit:null, displayUnit:null, decimalScale:null, group:"manual_review",
  availability:"active", clinicalValidation:"not_clinically_validated", provenance:"synthetic_research_informed",
  observationDefault:null, acquisition:"manual_review", calculation:null, sourceIds:["CORNELL-CBC"],
  structuredSections:["rbc_morphology","wbc_morphology","platelet_estimate","parasite_observation","overall_comment"],
  interpretationCodes:["unremarkable","abnormal","inconclusive","not_performed"],
  codeAuthority:"prototype_vocabulary_not_manufacturer_codes",
}];
const orders = definitions.map((definition) => ({
  orderId:existing[definition.code]?.[0] ?? `candidate.order.cbc.${definition.code.toLowerCase()}.v1`,
  code:definition.code, displayName:definition.displayName, resultDefinitionId:definition.resultDefinitionId,
  revision, category:"clinical_lab", availability:"active", clinicalValidation:"not_clinically_validated",
  directRequestAllowed:true, retestAllowed:true, selectedByDefault:definition.group === "core",
  group:definition.group, specimenKey:"cm.specimen.edta-whole-blood",
  executionDetail:"Requested output is independent; supporting measurements or a full physical analyzer run may still be required.",
  chargePolicy:"no_automatic_child_charge; explicit workspace billing decision later",
}));
const orderId = (code) => orders.find((row) => row.code === code).orderId;
const resultId = (code) => definitions.find((row) => row.code === code).resultDefinitionId;
const groupSet = (name,codes) => ({setId:`candidate.set.cbc.${name}.v1`,revision, members:codes.map((code) => ({memberId:orderId(code),defaultIncluded:true}))});
const sets = [
  groupSet("erythrocytes",["RBC","HGB","HCT","MCV","MCH","MCHC","RDW"]),
  groupSet("leukocytes",["WBC",...Object.keys(differentialNames).flatMap((code) => [`${code}_ABS`,`${code}_PCT`])]),
  groupSet("platelets",["PLT","MPV"]),
  groupSet("reticulocytes",["RETIC_ABS","RETIC_PCT","RETIC_HGB"]),
];
const rootSet = {setId:"cm.order.lab.panel.cbc-basic", existingLabPanelId:"cm.lab-panel.cbc-basic", revision,
  candidateMeaning:"CBC core with five-part differential; new revision of existing basic set, never rewrite historical membership",
  members:[...sets.slice(0,3).map((set) => ({memberId:set.setId,defaultIncluded:true})),
    {memberId:sets[3].setId,defaultIncluded:false},...["PDW","PCT","SMEAR"].map((code) => ({memberId:orderId(code),defaultIncluded:false}))]};
sets.unshift(rootSet);
const interval = (low,high) => ({low,high,lowInclusive:true,highInclusive:true,boundaryPolicy:"prototype_inclusive_low_high"});
const displayRanges = {WBC:[0,999.99],RBC:[0,99.99],HGB:[0,35],HCT:[0,100],PLT:[0,9999],RETIC_PCT:[0,99.99],RETIC_ABS:[0,9999]};
const demoPercents = { dog:{NEU_PCT:[40,75],LYM_PCT:[10,45],MONO_PCT:[0,12],EOS_PCT:[0,12],BASO_PCT:[0,2],RETIC_PCT:[0,2]},
  cat:{NEU_PCT:[30,80],LYM_PCT:[15,60],MONO_PCT:[0,12],EOS_PCT:[0,15],BASO_PCT:[0,3],RETIC_PCT:[0,2]} };
const profiles = [];
for (const species of ["dog","cat"]) {
  const rules = parameterRows.map(([code,,unit,dl,dh,cl,ch,decimalScale]) => {
    const [low,high] = species === "dog" ? [dl,dh] : [cl,ch];
    const unavailable = code === "PDW" && species === "cat";
    return {code,resultDefinitionId:resultId(code),unit,resultSupported:!unavailable,
      referenceInterval:low === null ? null : interval(low,high),
      referenceStatus:unavailable ? "result_and_interval_not_reported_NA" : low === null ? "interval_not_in_pinned_document" : "source_found",
      sourceIds:["IDEXX-RI"],sourceLocator:low === null && !unavailable ? "p1 absence; parameter support: IDEXX-MENU" : `p1 ${species} ${code}`,
      displayRange:displayRanges[code] ? {low:displayRanges[code][0],high:displayRanges[code][1],sourceId:"IDEXX-GUIDE",page:50,meaning:"display_range_not_analytical_measurement_range"} : null,
      analyticalMeasurementRange:null, criticalThresholds:null, decimalScale,
    };
  });
  profiles.push({profileId:`candidate.profile.procyte-dx.${species}.2019.v1`,revision,species,
    equipment:{manufacturer:"IDEXX",model:"ProCyte Dx",ownedByWorkspace:false},
    method:"ProCyte Dx whole-blood CBC; numeric values manually transcribed",
    specimenKey:"cm.specimen.edta-whole-blood",population:{lifeStages:"all (as printed)",breed:null,sex:null,clinicalValidation:"not_clinically_validated"},
    documentRevision:"06-27445-12 / 2019 / VetLab Station 5.01",latestInstalledVersionVerified:false,
    availability:"active",provenance:"synthetic_research_informed",numericProvenance:"transcribed_published_facts",
    integrationStatus:"not_integrated",entryMode:"manual_entry",rules});
  const demoRules = rules.map((rule) => {
    const step = 10 ** rule.decimalScale;
    let demoInterval;
    if (demoPercents[species][rule.code]) demoInterval = interval(...demoPercents[species][rule.code]);
    else if (rule.referenceInterval) demoInterval = interval(Math.floor(rule.referenceInterval.low * 0.9 * step) / step, Math.ceil(rule.referenceInterval.high * 1.1 * step) / step);
    else if (rule.code === "PDW" && species === "cat") demoInterval = interval(9,25);
    else throw new Error(`Unspecified demo interval ${rule.code}`);
    return {...rule,resultSupported:true,referenceInterval:demoInterval,referenceStatus:"synthetic_functional_fixture",sourceIds:[],
      sourceLocator:null,displayRange:null,derivationContextSourceIds:rule.referenceInterval ? ["IDEXX-RI"] : [],
      generationRule:demoPercents[species][rule.code] ? "explicit_demo_percentage_bounds_v1" : rule.code === "PDW" && species === "cat" ? "explicit_demo_cat_pdw_9_25_fL" : "low=floor(public_low*0.9*10^scale)/10^scale; high=ceil(public_high*1.1*10^scale)/10^scale",
      sourceAuthority:"CLAiR synthetic only; not an IDEXX interval"};
  });
  profiles.push({profileId:`candidate.profile.clair-demo-cbc.${species}.v1`,revision,species,
    equipment:{manufacturer:"CLAiR",model:"프로토타입 혈구분석기",ownedByWorkspace:false},
    method:"synthetic functional scenario; manual entry",specimenKey:"cm.specimen.edta-whole-blood",
    population:{lifeStages:"prototype_only",breed:null,sex:null,clinicalValidation:"not_clinically_validated"},
    availability:"active",provenance:"synthetic_functional_fixture",numericProvenance:"explicit_generation_rules",
    integrationStatus:"not_integrated",entryMode:"manual_entry",rules:demoRules});
}
const manualProfile = {profileId:"candidate.profile.clair-demo-smear.v1",revision,species:["dog","cat"],
  equipment:{manufacturer:null,model:"수기 혈액도말 검토",ownedByWorkspace:false},method:"manual_microscopy",
  specimenKey:"cm.specimen.edta-whole-blood",preparation:"blood_smear_slide",integrationStatus:"not_integrated",entryMode:"manual_entry",
  provenance:"synthetic_functional_fixture",availability:"active",clinicalValidation:"not_clinically_validated",
  rules:[{resultDefinitionId:resultId("SMEAR"),resultSupported:true,unit:null,referenceInterval:null,referenceStatus:"not_applicable_narrative",codeSet:definitions.at(-1).interpretationCodes}]};

const cases = [];
for (const profile of profiles) for (const definition of definitions.filter((row) => row.kind === "quantity")) {
  const rule = profile.rules.find((row) => row.code === definition.code);
  const values = [["missing",null],["invalid","abc"],["instrument_no_result","--.--"],["negative",-1]];
  if (rule.referenceInterval) {
    const {low,high} = rule.referenceInterval, step = 10 ** -definition.decimalScale;
    values.push(["low_boundary",low],["high_boundary",high],["normal",Number(((low+high)/2).toFixed(definition.decimalScale))],["high",Number((high+step).toFixed(definition.decimalScale))]);
    if (low > 0) values.push(["low",Number((low-step).toFixed(definition.decimalScale))]);
  } else values.push(["no_interval_or_unsupported",1]);
  for (const [caseName,value] of values) {
    const input = {profile,definition,species:profile.species,unit:rule.unit,value};
    cases.push({caseId:`${profile.profileId}:${definition.code}:${caseName}`,profileId:profile.profileId,code:definition.code,caseName,
      input:{species:profile.species,unit:rule.unit,value},expected:evaluateNumeric(input)});
  }
}
const dogProfile = profiles.find((profile) => profile.profileId === "candidate.profile.clair-demo-cbc.dog.v1");
const wbcOrder = orders.find((order) => order.code === "WBC");
const wbcDef = definitions.find((definition) => definition.code === "WBC");
const initial = snapshotOrder({order:wbcOrder,definition:wbcDef,profile:dogProfile,species:"dog",
  requestId:"fixture.request.cbc.wbc.1",rootRequestId:"fixture.request.cbc.1",requestedAt:"2026-09-06T01:00:00Z"});
initial.result = {resultId:"fixture.result.wbc.1",value:30,unit:wbcDef.unit,status:"final",performedAt:"2026-09-06T01:10:00Z",performerId:"fixture.staff.technician",interpretation:"high"};
initial.status = "completed";
const retest = requestRetest(initial,{requestId:"fixture.request.wbc.retest.2",previousResultId:initial.result.resultId,requestedAt:"2026-09-06T01:15:00Z",reason:"프로토타입 단일 항목 재검 흐름 확인",specimenDecision:"new_collection"});
const completeResult = {resultId:"fixture.result.wbc.2",value:10,unit:wbcDef.unit,status:"final",performedAt:"2026-09-06T01:25:00Z",performerId:"fixture.staff.technician",interpretation:"normal"};
const timeline = {initial,retestRequested:retest,retestCompleted:{...structuredClone(retest),status:"completed",result:completeResult},
  retestLeafOrders:expandSet(wbcOrder.orderId,sets,orders),originalResultMustRemain:initial.result};
const coherentSamples = [
  {species:"dog",measurements:{RBC:7,HGB:16,MCV:67,RDW:18,WBC:10,NEU_ABS:6,LYM_ABS:3,MONO_ABS:0.5,EOS_ABS:0.4,BASO_ABS:0.1,PLT:300,MPV:11,PDW:14,RETIC_ABS:70,RETIC_HGB:26}},
  {species:"cat",measurements:{RBC:9,HGB:13.5,MCV:45,RDW:20,WBC:10,NEU_ABS:5,LYM_ABS:4,MONO_ABS:0.4,EOS_ABS:0.5,BASO_ABS:0.1,PLT:350,MPV:15,PDW:16,RETIC_ABS:30,RETIC_HGB:17}},
].map(({species,measurements})=>{
  const values={...measurements};
  for(const code of Object.keys(derived))values[code]=calculateDerived(code,values);
  return {sampleId:`fixture.coherent.${species}`,species,provenance:"synthetic_functional_fixture",patientId:null,
    profileId:`candidate.profile.clair-demo-cbc.${species}.v1`,generationRule:"explicit synthetic primary values; same-sample derived formulas; no patient data",values};
});
const idMap = orders.map((order) => ({code:order.code,orderId:order.orderId,resultDefinitionId:order.resultDefinitionId,
  orderAction:existing[order.code]?.[0] ? "reuse_id_add_version_no_historical_rewrite" : "new_candidate_order",
  resultAction:existing[order.code]?.[1] ? "reuse_id_new_version" : "new_candidate_definition",
  priorDefinition:authoring.records.find((record) => record.masterKey === order.resultDefinitionId)?.detail ?? null,
  requiredBackfill:"LAB-03 mapping audit only; never infer or overwrite prior results"}));
const gaps = [
  {id:"RI-REVISION",status:"bounded",finding:"2019 public ranges are pinned, not verified latest installed device settings.",action:"keep revision; real deployment needs local profile verification",sourceIds:["IDEXX-RI"]},
  {id:"PERCENT-RI",status:"bounded",finding:"Six percentage intervals absent from pinned table; result support exists.",action:"commercial profile records no-interval; demo has explicit synthetic bounds",sourceIds:["IDEXX-RI","IDEXX-MENU"]},
  {id:"CAT-PDW",status:"resolved",finding:"Cat PDW is N/A, including the result, not merely the interval.",action:"commercial profile unsupported; demo PDW is a different explicit profile",sourceIds:["IDEXX-RI"]},
  {id:"MICROTUBE-VOLUME",status:"bounded",finding:"Guide p32 says 200 µL for microtainers; p51 says minimum 90 µL dependent on manufacturer.",action:"do not set a universal microtube default; standard tube minimum 500 µL is not a target draw volume",sourceIds:["IDEXX-GUIDE"]},
  {id:"PRECISION-LINEARITY",status:"bounded",finding:"Display range is not analytical range; UI decimals are prototype policy.",action:"preserve raw input and source qualification; critical limits not invented",sourceIds:["IDEXX-GUIDE"]},
  {id:"MEASUREMENT-ORDER",status:"resolved",finding:"Independent requested output does not imply independent physical measurement.",action:"keep supporting measurements on execution attempt; do not silently order/charge them",sourceIds:["CORNELL-CBC"]},
  {id:"BILLING-DEPLOYMENT",status:"deferred",finding:"No live-schema audit or price policy implemented.",action:"LAB-03 audits required fields; later explicit workspace prices, no automatic retest charge",sourceIds:[]},
];
const workflow = {...envelope,schemaVersion:"oed-lab-02-workflow/v1",sets,orders,
  expansionPolicy:{cycles:"reject",duplicates:"same order within same request deduped, all paths preserved",separateRequests:"never dedupe retests",optional:"explicit selection"},
  rootDefaultLeaves:expandSet(rootSet.setId,sets,orders),
  workspaceCandidate:{workspaceId:null,settingsApplied:false,
    speciesDefaults:{dog:dogProfile.profileId,cat:"candidate.profile.clair-demo-cbc.cat.v1"},
    manualDefault:manualProfile.profileId,selectionAuthority:"explicit fixture configuration; not installed hospital settings",noFallback:true},
  snapshotContract:{atOrder:"effective workspace order, definition and result-profile revision",atResult:"same snapshot plus actual performer/time/specimen/flags",changes:"explicit new request/version, never reinterpret historical result"},
  completionPolicy:{missing:"partial",invalid:"partial_with_reason",canceled:"excluded_with_reason",allRequiredResultsFinal:"completed",profileMissing:"selection_required_not_review_pending"},
  retestPolicy:{singleAtomicAllowed:true,reasonRequired:true,specimenDecisionRequired:true,copyPriorResultValue:false,automaticBilling:false},
  screenContract:{adminColumns:["오더명","핵심 항목 수/구성","검체","기본 수행 프로필","단위/참고범위 요약"],
    chartRows:["세트와 하위 오더","선택한 프로필","기본 실행값","환자별 수정값"],
    resultColumns:["항목","검사 결과","단위","판별","정상범위/없음 사유","담당자"],
    resultContext:["장비/수기 프로필","수동 입력","연동 안 됨","프로토타입 합성 출처","버전"],
    expansion:["직원 전달사항","소견","첨부","재검"],
    flags:["NRBC_SUSPECTED","BAND_SUSPECTED","device_flag_raw"],flagAuthority:"local normalized labels; preserve raw device text; not independent numeric counts"},
  manualProfile,
  lab03AuditTargets:["master atomic order/definition version","set-to-set and set-to-order links","workspace field override provenance","workspace explicit equipment/result-profile binding","chart order snapshot","execution attempt and specimen","typed result and reference snapshot","retest links and immutable history","billing choice"],
};
const ledger = {...envelope,schemaVersion:"oed-lab-02-evidence/v1",sources,gaps,
  researchPlan:{audience:"승욱 and implementation agents",scope:"dog/cat CBC, one commercial model plus explicit demo profiles",
    queries:["IDEXX ProCyte Dx reference intervals PDF","ProCyte Dx operator guide EDTA and parameters","Cornell CBC individual tests and morphology","Cornell MCH MCHC calculations","UCUM syntax","FHIR R4 request and observation"],
    stopReason:"Chosen-model facts and exceptions bounded; other devices and exact patient-specific clinical suitability out of scope.",
    noNewBroadResearchNeeded:true},
  claimMap:[
    {claimId:"CBC-CONTENTS",sourceIds:["IDEXX-MENU","CORNELL-CBC"],confidence:"high_for_list_not_mandatory_clinical_panel",decision:"20 core, 5 optional, 1 manual are CLAiR prototype grouping"},
    {claimId:"REFERENCE-VALUES",sourceIds:["IDEXX-RI"],confidence:"high_for_transcription",decision:"37 numeric species/parameter intervals; no cross-device mixing"},
    {claimId:"SPECIMEN-FLAGS",sourceIds:["IDEXX-GUIDE"],confidence:"high_with_volume_exception",decision:"EDTA whole blood; preserve flags/no-result distinct from low/high"},
    {claimId:"UNITS",sourceIds:["UCUM"],confidence:"normalized_mapping",decision:"K/µL to 10*3/uL; M/µL to 10*6/uL; factor1"},
    {claimId:"IDENTITY-RETEST",sourceIds:["FHIR-REQUEST","FHIR-RESULT"],confidence:"design_inference",decision:"request/result separation; CLAiR previousRequestId is not FHIR replaces"},
  ]};
const files = new Map([
  ["cbc-order-candidates.non-applied.v1.json",{...envelope,schemaVersion:"oed-lab-02-orders/v1",orders,sets,idMap}],
  ["cbc-result-definitions.non-applied.v1.json",{...envelope,schemaVersion:"oed-lab-02-results/v1",definitions}],
  ["cbc-result-profiles.non-applied.v1.json",{...envelope,schemaVersion:"oed-lab-02-profiles/v1",profiles,manualProfile}],
  ["cbc-functional-fixtures.v1.json",{...envelope,schemaVersion:"oed-lab-02-fixtures/v1",cases,timeline,coherentSamples}],
  ["cbc-workflow-and-screen-contract.v1.json",workflow],
  ["source-ledger-and-gaps.v1.json",ledger],
]);
await mkdir(artifactDir,{recursive:true});
const artifactFingerprints = {};
for (const [name,value] of files) {const body=json(value);await writeFile(resolve(artifactDir,name),body);artifactFingerprints[name]=hash(body);}
const manifest = {...envelope,schemaVersion:"oed-lab-02-manifest/v1",runtimeImportAllowed:false,databaseMutationAllowed:false,
  sourceFingerprints,artifactFingerprints,
  counts:{atomicOrders:orders.length,core:20,optional:5,manual:1,sets:sets.length,numericProfiles:profiles.length,manualProfiles:1,
    publishedSpeciesIntervals:profiles.filter((p)=>p.provenance==="synthetic_research_informed").reduce((n,p)=>n+p.rules.filter((r)=>r.referenceInterval).length,0),
    numericBranchFixtures:cases.length,newOrderIds:idMap.filter((row)=>row.orderAction==="new_candidate_order").length,
    newResultIds:idMap.filter((row)=>row.resultAction==="new_candidate_definition").length},nextWork:"OED-LAB-03"};
await writeFile(resolve(artifactDir,"artifact-manifest.v1.json"),json(manifest));
console.log(JSON.stringify({artifactDir,counts:manifest.counts}));
