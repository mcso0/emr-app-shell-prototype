import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function evaluate(source, imports={}, globals={}) {
 const exports={};
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(js,{exports,Request,Response,URL,fetch:globalThis.fetch,require:name=>imports[name]??require(name),...globals});return exports;
}
function extract(path,name,globals={}) {
 const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const node=source.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text===name);
 assert.ok(node,`Missing actual function ${name}`);
 return evaluate(`${node.getText(source).replace(/^export /,'')}\nexports.${name}=${name};`,{},globals)[name];
}
const routePath='src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts';
const mapError=extract(routePath,'mapSupabaseLabResultError');
for(const [code,expected] of [['order_work_on_hold','held'],['lab_result_attempt_changed','superseded'],['entry_write_revision_conflict','conflict']]) {
 test(`actual row API ${code} response reaches the matching autosave state`,async()=>{
  const mapped=mapError(code,'write');
  const save=extract('src/features/lab-imaging/module.tsx','saveLabResultEntry',{fetch:async()=>Response.json(mapped,{status:mapped.status})});
  const outcome=await save({workspaceId:'synthetic',result:{id:'synthetic-result',orderId:'order',encounterId:'encounter'},rows:[],requestId:'request'});
  assert.equal(outcome.ok,false);assert.equal(outcome.reason,expected);
 });
 test(`actual overall finding API preserves ${code}`,async()=>{
  const source=readFileSync('src/app/api/workspaces/[workspaceId]/lab-imaging/result-phase2/route.ts','utf8');
  const route=evaluate(source,{
   '@/features/lab-imaging/server-lab-result-phase2-context':{loadLabResultPhase2Context:async()=>({ok:true,actorUserId:'synthetic-actor',client:{rpc:async()=>({data:null,error:{message:code,code:'40001'}})}})},
   '@/lib/security/rate-limit':{enforceWorkspaceMutationRateLimit:()=>null},
  });
  const response=await route.PUT(new Request('https://synthetic.invalid',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({resultId:'synthetic-result',finding:'Synthetic',expectedRevision:0})}),{params:Promise.resolve({workspaceId:'synthetic'})});
  assert.equal(response.status,409);assert.equal((await response.json()).error,expected==='conflict'?'revision_conflict':code);
 });
}
test('historical values retain qualifier, instrument-no-result and coded meaning',()=>{
 const format=extract('src/features/lab-imaging/components/prior-lab-results.tsx','formatLabHistoryValue');
 assert.equal(format({value:'5',qualifier:'less_than'}),'< 5');
 assert.equal(format({value:'5',qualifier:'greater_than'}),'> 5');
 assert.equal(format({resultPresence:'instrument_no_result'}),'측정 불가');
 assert.equal(format({value:'code',interpretationRule:{codes:[{code:'code',label:'합성 판정'}]}}),'합성 판정');
});
