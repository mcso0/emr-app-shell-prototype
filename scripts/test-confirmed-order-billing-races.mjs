// Owned, network-isolated PostgreSQL clones; no remote credentials or data.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const container = process.env.CONFIRMED_EDIT_TEST_CONTAINER;
const template = process.env.CONFIRMED_EDIT_TEST_DATABASE;
if (![container, template].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value))) throw Error('Disposable container/database required');
const invoke = (args, input) => spawnSync('docker', args, { input, encoding:'utf8', maxBuffer:4*1024*1024 });
assert.equal(invoke(['inspect','--format','{{.HostConfig.NetworkMode}}',container]).stdout.trim(),'none');
const workspace='synthetic-order-edit', encounter='84000000-0000-4000-8000-000000000001', chart='85000000-0000-4000-8000-000000000001', order='86000000-0000-4000-8000-000000000001';
const auth="select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',false);";
const seed=readFileSync(new URL('../tests/sql/confirmed-order-edit.sql',import.meta.url),'utf8').split('create function pg_temp.edit')[0]+`
select public.clair_request_selected_chart_order_billing('${workspace}',auth.uid(),'${encounter}',public.clair_get_chart_order_billing_summary('${workspace}','${encounter}')->>'etag','race-fixture-request',array['${order}'::uuid],true);
update public.invoices set assigned_to_user_id=auth.uid() where workspace_id='${workspace}';
commit;`;
const results=[];
for (const scenario of ['prepare_then_proposal','proposal_then_payment','payment_then_proposal']) {
 const database=`confirmed_edit_race_${process.pid}`;
 const created=invoke(['exec',container,'createdb','-U','supabase_admin','--template',template,database]);
 assert.equal(created.status,0,created.stderr);
 const args=['exec','-i',container,'psql','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'];
 const sql = source => { const r=invoke(args,source);assert.equal(r.status,0,r.stderr);return r.stdout.trim(); };
 let first;
 try {
  sql(seed);
  const invoice=sql(`select id from public.invoices where workspace_id='${workspace}';`);
  const version=sql(`select updated_at from public.invoices where id='${invoice}';`);
  const edit=`select public.clair_edit_confirmed_order('${workspace}','${chart}','${order}',jsonb_build_object('orderId','${order}','chartId','${chart}','commandId',gen_random_uuid(),'expectedVersion',public.clair_get_confirmed_order_edit('${workspace}','${chart}','${order}')->>'version','financial',jsonb_build_object('unitPriceKrw',7000),'reason',''));`;
  const prepare=`select public.clair_prepare_billing_checkout_session('${workspace}',auth.uid(),array['${invoice}'::uuid],'cash');`;
  const payment=`select public.clair_transition_billing_invoice_status('${workspace}',auth.uid(),'${invoice}','paid','cash','synthetic race confirmation','${version}'::timestamptz);`;
  const operationA=scenario==='prepare_then_proposal'?prepare:scenario==='proposal_then_payment'?edit:payment;
  const operationB=scenario==='proposal_then_payment'?payment:edit;
  first=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
  let output='',errors='';
  const ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('lock-holder timeout')),10000);first.stdout.on('data',chunk=>{output+=chunk;if(output.includes('RACE_LOCK_HELD')){clearTimeout(timeout);resolve();}});first.on('error',reject);first.on('exit',code=>{if(code)reject(Error(errors));});});
  first.stderr.on('data',chunk=>errors+=chunk);
  const completed=new Promise(resolve=>first.on('exit',resolve));
  first.stdin.end(`begin; ${auth} ${operationA} select 'RACE_LOCK_HELD'; select pg_sleep(1); commit;`);
  await ready;
  const started=Date.now();const second=invoke(args,`${auth} ${operationB}`);const elapsed=Date.now()-started;
  assert.equal(await completed,0,errors);
  assert.ok(elapsed>=500,'second operation must wait for held transaction lock');
  if(scenario==='prepare_then_proposal') {
   assert.equal(second.status,0,second.stderr);
   assert.equal(sql("select count(*) from public.billing_checkout_sessions where status='prepared';"),'0');
  } else {
   assert.notEqual(second.status,0);
   assert.match(second.stderr,scenario==='proposal_then_payment'?/billing_review_required|invoice_revision_conflict/:/payment_locked/);
  }
  const counts=sql("select jsonb_build_object('payments',(select count(*) from public.payments),'pending',(select count(*) from private.order_financial_edits where proposed_values is not null));");
  results.push({scenario,waitedForLock:elapsed>=500,result:scenario==='prepare_then_proposal'?'expired':scenario==='proposal_then_payment'?'payment_blocked':'edit_blocked',state:JSON.parse(counts)});
 } finally {
  first?.kill();
  const dropped=invoke(['exec',container,'dropdb','-U','supabase_admin','--force',database]);
  assert.equal(dropped.status,0,dropped.stderr);
 }
}
mkdirSync('.artifacts/confirmed-order-edit',{recursive:true});
writeFileSync('.artifacts/confirmed-order-edit/billing-races.json',JSON.stringify(results,null,2));
console.log('Three two-session billing races passed; owned database clones removed.');
