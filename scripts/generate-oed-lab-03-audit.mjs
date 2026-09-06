#!/usr/bin/env node
// Offline audit packaging only. Never connects to or changes a database.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dir=resolve(root,'docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-03');
const prev=resolve(dir,'../oed-lab-02');
const hash=s=>createHash('sha256').update(s).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const remote=await read(resolve(dir,'remote-evidence.v1.json'));
const candidate=await read(resolve(prev,'cbc-order-candidates.non-applied.v1.json'));
const definitions=await read(resolve(prev,'cbc-result-definitions.non-applied.v1.json'));
const byKey=new Map(remote.idMatches.rows.map(r=>[r.master_key,r]));
const byTest=new Map(remote.tests.rows.map(r=>[r.master_key,r]));
const idRows=candidate.orders.map(order=>{
  const existingOrder=byKey.get(order.orderId),existingTest=byTest.get(order.resultDefinitionId);
  const definition=definitions.definitions.find(d=>d.resultDefinitionId===order.resultDefinitionId);
  const codeMatches=remote.tests.rows.filter(t=>t.test_code===order.code || (order.code==='RETIC_PCT' && t.test_code==='RETIC' && t.unit_code==='percent'));
  return {code:order.code,candidateOrderKey:order.orderId,candidateTestKey:order.resultDefinitionId,
    orderDecision:existingOrder?.record_type==='order'?'preserve_existing_key_new_revision':'new_candidate_key_not_present',
    testDecision:existingTest?'preserve_existing_key_new_revision_if_changed':'new_candidate_key_not_present',
    observedOrderRevision:existingOrder?.current_revision??null,observedTestRevision:existingTest?.current_revision??null,
    observedTestCode:existingTest?.test_code??null,observedUnitCode:existingTest?.unit_code??null,
    observedDecimalScale:existingTest?.decimal_scale??null,candidateDecimalScale:definition?.decimalScale??null,
    precisionRevisionRequired:!!existingTest && existingTest.decimal_scale!==definition?.decimalScale,
    sameCodeMasterKeys:codeMatches.map(t=>t.master_key),
    decisionAuthority:'Exact keys, all live lab-test codes and scoped CBC synonym search; repeat collision and semantic review before application. Candidate IDs are not assigned runtime UUIDs.'};
});
const reconciliation={schemaVersion:'oed-lab-03-id-reconciliation/v1',observedAt:remote.observedAt,applicationAllowed:false,rows:idRows,
  counts:{atomicOrders:idRows.length,newOrderKeys:idRows.filter(r=>r.orderDecision.startsWith('new')).length,newTestKeys:idRows.filter(r=>r.testDecision.startsWith('new')).length},
  setIdentity:{candidateRootKey:'cm.order.lab.panel.cbc-basic',observedRecordType:byKey.get('cm.order.lab.panel.cbc-basic')?.record_type,
    decision:'Existing key is an order, NOT a generic order_set. Preserve old order/history. Publish a new versioned composition projection with an explicit master-composition to workspace-set bridge; do not silently change record_type.',
    newGroupingKeys:candidate.sets.map(s=>s.setId).filter(s=>s.startsWith('candidate.'))},
  reticPolicy:'cm.lab-test.synthetic-13 remains RETIC percentage. RETIC_ABS is a separate identity; never reinterpret old values.'};
await mkdir(dir,{recursive:true});
await writeFile(resolve(dir,'id-reconciliation.v1.json'),JSON.stringify(reconciliation,null,2)+'\n');
const sources=[
  'src/features/clinical-master/server-clinical-master-publisher-core.ts',
  'src/features/hospital-admin/server-order-catalog-core.ts',
  'src/features/hospital-admin/module.tsx','src/features/chart/module.tsx',
  'src/features/lab-imaging/module.tsx','src/types/emr-domain.ts',
  'src/features/billing/server-invoice-candidate-sync-core.ts',
  'src/features/fulfillment/server-fulfillment-work-item-core.ts',
  'supabase/migrations/20260819172501_clinical_master_phase1b1_laboratory_slice.sql',
  'supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql',
  'supabase/migrations/20260820140000_clinical_master_phase1b3_chart_set_runtime.sql',
  'supabase/migrations/20260820150000_clinical_master_phase1b3_confirm_lab_freeze.sql',
  'supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql',
  'supabase/migrations/20260825241000_chart_order_atomic_confirmation_contract.sql',
  'supabase/migrations/20260831070431_clinical_master_execution_preset_runtime_transport.sql',
  'supabase/migrations/20260831070512_clinical_master_execution_preset_publish_adopt.sql',
  'supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql',
  'docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-02/artifact-manifest.v1.json'];
const sourceHashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,hash(await readFile(resolve(root,p)))])));
const names=['remote-evidence.v1.json','id-reconciliation.v1.json','audit-and-transition-plan.md','report-source.ko.md'];
const artifactHashes=Object.fromEntries(await Promise.all(names.map(async p=>[p,hash(await readFile(resolve(dir,p)))])));
const manifest={schemaVersion:'oed-lab-03-manifest/v1',observedAt:remote.observedAt,localHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  localBoundary:'Dirty local checkout; sourceHashes, not HEAD alone, identify inspected content. Not deployed-app proof.',
  remoteBoundary:remote.scope,applicationAllowed:false,sourceHashes,artifactHashes,idCounts:reconciliation.counts,
  verificationBoundary:'Artifact consistency and static report QA only; no live mutation, authenticated UI or RLS replay.',
  nextWork:'WP-01B persisted admin/chart read parity, followed by CBC-first OED-LAB-04 slices and WP-02 inheritance.'};
await writeFile(resolve(dir,'artifact-manifest.v1.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({counts:reconciliation.counts,precisionChanges:idRows.filter(r=>r.precisionRevisionRequired).map(r=>r.code),sourceFiles:sources.length}));
