import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateNumeric, evaluateManual, expandSet, snapshotOrder, requestRetest, calculateDerived } from "../scripts/lib/oed-lab-02-contract.mjs";
const root = resolve(import.meta.dirname,"..");
const dir = resolve(root,"docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-02");
const read = async (file) => JSON.parse(await readFile(resolve(dir,file),"utf8"));
const [{orders,sets,idMap},{definitions},{profiles,manualProfile},fixtures,manifest,ledger] = await Promise.all([
  read("cbc-order-candidates.non-applied.v1.json"),read("cbc-result-definitions.non-applied.v1.json"),
  read("cbc-result-profiles.non-applied.v1.json"),read("cbc-functional-fixtures.v1.json"),read("artifact-manifest.v1.json"),read("source-ledger-and-gaps.v1.json")]);
const def = (code)=>definitions.find((row)=>row.code===code);
const profile = (species="dog",demo=false)=>profiles.find((row)=>row.species===species&&row.provenance===(demo?"synthetic_functional_fixture":"synthetic_research_informed"));
const check = (code,value,overrides={})=>evaluateNumeric({definition:def(code),profile:profile(),species:"dog",unit:def(code).unit,value,...overrides});

test("candidate IDs reuse exact existing meaning and never enter runtime/master data", async()=>{
  assert.equal(orders.length,26); assert.equal(definitions.length,26);
  assert.equal(new Set(orders.map((row)=>row.orderId)).size,26);
  assert.equal(new Set(definitions.map((row)=>row.resultDefinitionId)).size,26);
  for(const group of ["core","optional","manual_review"]) assert.equal(orders.filter((row)=>row.group===group).length,{core:20,optional:5,manual_review:1}[group]);
  const source=JSON.parse(await readFile(resolve(root,"tests/fixtures/clinical-master-operational-v4-authoring.json"),"utf8"));
  const keys=new Set(source.records.map((row)=>row.masterKey));
  for(const row of idMap){
    assert.ok(definitions.some((d)=>d.resultDefinitionId===row.resultDefinitionId));
    if(row.orderAction.startsWith("reuse")) assert.ok(keys.has(row.orderId),row.orderId);
    else assert.ok(!keys.has(row.orderId),row.orderId);
    if(row.resultAction.startsWith("reuse")) assert.ok(keys.has(row.resultDefinitionId));
    else assert.ok(!keys.has(row.resultDefinitionId));
  }
  assert.equal(def("RETIC_PCT").resultDefinitionId,"cm.lab-test.synthetic-13");
  assert.equal(def("RETIC_PCT").unit,"%");
  assert.notEqual(def("RETIC_ABS").resultDefinitionId,def("RETIC_PCT").resultDefinitionId);
  assert.equal(manifest.applicationAllowed,false);assert.equal(manifest.runtimeImportAllowed,false);
  for(const d of definitions){assert.equal(d.availability,"active");assert.equal(d.clinicalValidation,"not_clinically_validated");assert.equal(d.observationDefault,null);}
});

test("published range facts, species exceptions and unit semantics are pinned",()=>{
  const dog=profile(),cat=profile("cat");
  const rule=(p,c)=>p.rules.find((row)=>row.code===c);
  assert.deepEqual([rule(dog,"WBC").referenceInterval.low,rule(dog,"WBC").referenceInterval.high],[5.05,16.76]);
  assert.deepEqual([rule(cat,"WBC").referenceInterval.low,rule(cat,"WBC").referenceInterval.high],[2.87,17.02]);
  assert.deepEqual([rule(cat,"PLT").referenceInterval.low,rule(cat,"PLT").referenceInterval.high],[151,600]);
  assert.equal(rule(cat,"PDW").resultSupported,false);assert.equal(rule(cat,"PDW").referenceInterval,null);
  assert.equal(rule(dog,"NEU_PCT").resultSupported,true);assert.equal(rule(dog,"NEU_PCT").referenceInterval,null);
  assert.equal(def("RBC").unit,"10*6/uL");assert.equal(def("WBC").unit,"10*3/uL");
  assert.equal(manifest.counts.publishedSpeciesIntervals,37);
  for(const p of profiles){assert.equal(p.integrationStatus,"not_integrated");assert.equal(p.entryMode,"manual_entry");
    for(const r of p.rules){assert.equal(r.criticalThresholds,null);assert.equal(r.analyticalMeasurementRange,null);}}
});

test("zero, missing, invalid, censored and flagged results cannot turn into false normal",()=>{
  for(const value of [null,undefined,"", "  "]) assert.equal(check("WBC",value).state,"not_entered");
  for(const value of [NaN,Infinity,true,{},-1,"abc","0x10"]) assert.equal(check("WBC",value).state,"invalid_number");
  assert.equal(check("BASO_ABS",0).interpretation,"normal");
  assert.equal(check("WBC",5.05).interpretation,"normal");
  assert.equal(check("WBC",16.76).interpretation,"normal");
  assert.equal(check("WBC",5.049).interpretation,"low");
  assert.equal(check("WBC",16.761).interpretation,"high");
  assert.equal(check("WBC","--.--").state,"instrument_no_result");
  assert.equal(check("WBC",10,{deviceFlag:"*"}).interpretation,"not_evaluated");
  assert.equal(check("WBC",10,{qualifier:"greater_than"}).state,"qualified_result");
  assert.equal(check("WBC",1000).state,"outside_documented_display_range");
  assert.equal(check("NEU_PCT",101).state,"invalid_number");
  assert.equal(check("NEU_PCT",60).state,"recorded_without_interval");
});

test("explicit profile selection prevents missing/species/unit/unsupported fallback",()=>{
  assert.equal(check("WBC",10,{profile:null}).state,"profile_required");
  assert.equal(check("WBC",10,{species:"cat"}).state,"species_mismatch");
  assert.equal(check("WBC",10,{unit:"/uL"}).state,"unit_mismatch");
  assert.equal(check("PDW",15,{species:"cat",profile:profile("cat")}).state,"unsupported_parameter");
  assert.equal(check("PDW",15,{species:"cat",profile:profile("cat",true)}).interpretation,"normal");
  for(const p of profiles.filter((p)=>p.provenance==="synthetic_functional_fixture")) {
    assert.equal(p.equipment.manufacturer,"CLAiR");
    assert.ok(p.rules.every((rule)=>rule.resultSupported&&rule.referenceInterval&&rule.generationRule&&rule.sourceIds.length===0));
  }
});

test("nested core expansion, explicit optional selection and WBC-only retest",()=>{
  assert.equal(expandSet(sets[0].setId,sets,orders).length,20);
  assert.equal(expandSet(sets[0].setId,sets,orders,sets[0].members.filter((m)=>!m.defaultIncluded).map((m)=>m.memberId)).length,26);
  assert.equal(expandSet("cm.order.lab.test.cbc-wbc",sets,orders).length,1);
  const repeated={setId:"fixture.repeat",members:[{memberId:sets[0].setId,defaultIncluded:true},{memberId:"cm.order.lab.test.cbc-wbc",defaultIncluded:true}]};
  const expanded=expandSet(repeated.setId,[...sets,repeated],orders);
  assert.equal(expanded.length,20);assert.equal(expanded.find((x)=>x.orderId==="cm.order.lab.test.cbc-wbc").requestedPaths.length,2);
  assert.throws(()=>expandSet("fixture.cycle",[{setId:"fixture.cycle",members:[{memberId:"fixture.cycle",defaultIncluded:true}]}],orders),/Cycle/);
  assert.throws(()=>expandSet("unknown",sets,orders),/Unknown/);
});

test("immutable request/result snapshots preserve old profile and result during retest",()=>{
  const {initial,retestRequested,retestCompleted}=fixtures.timeline;
  const frozen=JSON.stringify(initial); const next=requestRetest(initial,{requestId:"fixture.new",previousResultId:initial.result.resultId,requestedAt:"2026-09-06T02:00:00Z",reason:"repeat",specimenDecision:"new_collection"});
  assert.equal(next.result,null);assert.equal(next.rootRequestId,initial.rootRequestId);
  assert.equal(next.previousRequestId,initial.requestId);assert.equal(next.previousResultId,initial.result.resultId);
  next.profileSnapshot.rule.referenceInterval.high=999;
  assert.equal(JSON.stringify(initial),frozen);
  assert.equal(retestRequested.result,null);assert.notEqual(retestCompleted.result.resultId,initial.result.resultId);
  assert.equal(initial.result.value,30);assert.equal(retestCompleted.result.value,10);
  assert.throws(()=>requestRetest(initial,{requestId:"x",previousResultId:"unrelated",reason:"repeat",specimenDecision:"new_collection"}),/context/);
  const p=structuredClone(profile());const order=orders.find((o)=>o.code==="WBC");
  const snap=snapshotOrder({order,definition:def("WBC"),profile:p,species:"dog",requestId:"fixture.snapshot",rootRequestId:"fixture.root",requestedAt:"2026-09-06T01:00:00Z"});
  p.rules.find((r)=>r.code==="WBC").referenceInterval.high=999;
  assert.equal(snap.profileSnapshot.rule.referenceInterval.high,16.76);
});

test("manual review is coded narrative without invented numeric interval",()=>{
  assert.equal(evaluateManual({profile:null,species:"dog"}).state,"profile_required");
  assert.equal(evaluateManual({profile:manualProfile,species:"dog"}).state,"not_entered");
  assert.equal(evaluateManual({profile:manualProfile,species:"dog",interpretation:"low",findings:"x"}).state,"invalid_code");
  const observation=evaluateManual({profile:manualProfile,species:"dog",interpretation:"abnormal",findings:"프로토타입 소견",attachments:[]});
  assert.equal(observation.state,"recorded");assert.equal(observation.referenceInterval,null);
  const order=orders.find((o)=>o.code==="SMEAR");
  assert.equal(snapshotOrder({order,definition:def("SMEAR"),profile:manualProfile,species:"cat",requestId:"fixture.manual",rootRequestId:"fixture.root",requestedAt:"2026-09-06T01:00:00Z"}).orderId,order.orderId);
});

test("all generated branches replay and independent range expectations hold",()=>{
  assert.equal(fixtures.cases.length,837);
  for(const c of fixtures.cases) {
    const p=profiles.find((row)=>row.profileId===c.profileId);
    const outcome=evaluateNumeric({...c.input,profile:p,definition:def(c.code)});
    assert.deepEqual(outcome,c.expected,c.caseId);
    const expected={low:"low",high:"high",normal:"normal",low_boundary:"normal",high_boundary:"normal"}[c.caseName];
    if(expected)assert.equal(outcome.interpretation,expected,c.caseId);
  }
});

test("sources, ID maps, profile rules and actual artifact/source hashes are consistent",async()=>{
  const known=new Set(ledger.sources.map((s)=>s.sourceId));
  for(const d of definitions)for(const id of d.sourceIds)assert.ok(known.has(id),id);
  for(const p of profiles)for(const r of p.rules){assert.ok(definitions.some((d)=>d.resultDefinitionId===r.resultDefinitionId));for(const id of r.sourceIds)assert.ok(known.has(id));}
  const hash=(body)=>createHash("sha256").update(body).digest("hex");
  for(const [name,value]of Object.entries(manifest.artifactFingerprints))assert.equal(hash(await readFile(resolve(dir,name))),value);
  for(const [name,value]of Object.entries(manifest.sourceFingerprints))assert.equal(hash(await readFile(resolve(root,name))),value);
});

test("two synthetic whole-CBC samples are mathematically consistent and all numeric demo values are normal",()=>{
  assert.equal(fixtures.coherentSamples.length,2);
  for(const sample of fixtures.coherentSamples){
    assert.equal(Object.keys(sample.values).length,25);
    const v=sample.values;
    assert.ok(Math.abs(v.NEU_ABS+v.LYM_ABS+v.MONO_ABS+v.EOS_ABS+v.BASO_ABS-v.WBC)<1e-9);
    assert.ok(Math.abs(v.HCT-v.RBC*v.MCV/10)<1e-9);
    assert.ok(Math.abs(v.MCHC-v.HGB*100/v.HCT)<1e-9);
    for(const [code,value]of Object.entries(v))assert.equal(check(code,value,{profile:profile(sample.species,true),species:sample.species}).interpretation,"normal",`${sample.species} ${code}`);
  }
  assert.throws(()=>calculateDerived("MCH",{HGB:16,RBC:0}),/supporting/);
  assert.throws(()=>calculateDerived("MCH",{HGB:16}),/supporting/);
  assert.throws(()=>calculateDerived("unknown",{}),/Unsupported/);
});
