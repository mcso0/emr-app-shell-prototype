// Two real PostgreSQL connections; disposable synthetic clones only.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const container=process.env.CONFIRMED_EDIT_TEST_CONTAINER, template=process.env.CONFIRMED_EDIT_TEST_DATABASE;
assert.ok([container,template].every(v=>typeof v==='string' && /^[a-zA-Z0-9_-]+$/.test(v)),'Owned container/database required');
const invoke=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(invoke(['inspect','--format','{{.HostConfig.NetworkMode}}',container]).stdout.trim(),'none');
const w='synthetic-order-edit',e='84000000-0000-4000-8000-000000000001',chart='85000000-0000-4000-8000-000000000001',o='86000000-0000-4000-8000-000000000001';
const actor='81000000-0000-4000-8000-000000000001', auth=`select set_config('request.jwt.claim.sub','${actor}',false);`;
const seed=readFileSync(new URL('../tests/sql/confirmed-order-edit.sql',import.meta.url),'utf8').split('create function pg_temp.edit')[0]+`
select public.clair_request_selected_chart_order_billing('${w}',auth.uid(),'${e}',public.clair_get_chart_order_billing_summary('${w}','${e}')->>'etag','hold-race',array['${o}'::uuid],true);
update public.invoices set assigned_to_user_id=auth.uid() where workspace_id='${w}'; commit;`;
const results=[];
for(const scenario of ['begin_prepared','begin_expired','save_prepared']) {
 const db=`order_hold_race_${process.pid}`;
 assert.equal(invoke(['exec',container,'createdb','-U','supabase_admin','--template',template,db]).status,0);
 const args=['exec','-i',container,'psql','-X','-qAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'];
 const sql=source=>{const r=invoke(args,source);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const connection=()=>{
  const process=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
  const state={output:'',errors:'',process,done:null};
  process.stdout.on('data',chunk=>state.output+=chunk);process.stderr.on('data',chunk=>state.errors+=chunk);
  state.done=new Promise((resolve,reject)=>{process.on('error',reject);process.on('exit',resolve);});
  return state;
 };
 const until=async(check,label)=>{const deadline=Date.now()+6000;while(!check()){if(Date.now()>deadline)throw Error(label);await new Promise(resolve=>setTimeout(resolve,25));}};
 let a,b;
 try {
  sql(seed);
  const inv=sql(`select id from public.invoices where workspace_id='${w}';`);
  sql(`${auth} select public.clair_prepare_billing_checkout_session('${w}',auth.uid(),array['${inv}'::uuid],'cash');`);
  const checkout=sql(`select id from public.billing_checkout_sessions where workspace_id='${w}';`);
  if(scenario==='begin_expired') sql(`update public.billing_checkout_sessions set status='expired',completed_at=now() where id='${checkout}';`);
  b=connection();
  b.process.stdin.write(`begin; set lock_timeout='4s'; ${auth} select id from public.billing_checkout_sessions where id='${checkout}' for update; select 'SESSION_LOCK_HELD';\n`);
  await until(()=>b.output.includes('SESSION_LOCK_HELD'),'session holder failed');
  a=connection();
  const appName=`order-hold-race-${process.pid}`;
  const operation=scenario.startsWith('begin')
   ? `select public.clair_manage_confirmed_order_edit_session('${w}','${chart}','${o}',gen_random_uuid(),'begin');`
   : `select public.clair_edit_confirmed_order('${w}','${chart}','${o}',jsonb_build_object('orderId','${o}','chartId','${chart}','commandId',gen_random_uuid(),'expectedVersion',public.clair_get_confirmed_order_edit('${w}','${chart}','${o}')->>'version','financial',jsonb_build_object('unitPriceKrw',7000),'reason',''));`;
  a.process.stdin.end(`set application_name='${appName}';set lock_timeout='4s';${auth}${operation}`);
  await until(()=>sql(`select count(*) from pg_stat_activity where application_name='${appName}' and wait_event_type='Lock';`)==='1','editor did not wait on checkout');
  b.process.stdin.end(`update public.billing_checkout_sessions set status='payment_pending',completed_at=null where id='${checkout}';commit;`);
  const [aCode,bCode]=await Promise.all([a.done,b.done]);
  assert.equal(bCode,0,b.errors);assert.doesNotMatch(a.errors+b.errors,/deadlock detected|lock timeout/);
  if(scenario.startsWith('begin')) assert.equal(aCode,0,a.errors);
  else {assert.notEqual(aCode,0);assert.match(a.errors,/payment_locked|revision_conflict|permission_missing/);}
  assert.equal(sql(`select status from public.billing_checkout_sessions where id='${checkout}';`),'payment_pending');
  assert.equal(sql(`select count(*) from private.order_billing_edit_leases where workspace_id='${w}';`),'0');
  assert.equal(sql(`select count(*) from private.order_financial_edits where workspace_id='${w}' and proposed_values is not null;`),'0');
  results.push({scenario,checkoutWon:true,noDeadlock:true});
 } finally {
  a?.process.kill();b?.process.kill();
  const dropped=invoke(['exec',container,'dropdb','-U','supabase_admin','--force',db]);assert.equal(dropped.status,0,dropped.stderr);
 }
}
mkdirSync('.artifacts/confirmed-order-edit',{recursive:true});
writeFileSync('.artifacts/confirmed-order-edit/hold-races.json',JSON.stringify(results,null,2));
console.log('Three checkout/edit hold races passed; owned database clones removed.');
