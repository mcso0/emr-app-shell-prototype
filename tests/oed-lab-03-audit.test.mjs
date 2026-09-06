import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
const root=resolve(import.meta.dirname,'..');
const dir=resolve(root,'docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-03');
const read=async name=>JSON.parse(await readFile(resolve(dir,name),'utf8'));
test('audit reconciles all candidate identities against recorded remote evidence',async()=>{
 const ids=await read('id-reconciliation.v1.json'),remote=await read('remote-evidence.v1.json');
 assert.deepEqual(ids.counts,{atomicOrders:26,newOrderKeys:21,newTestKeys:19});
 assert.equal(new Set(ids.rows.map(r=>r.code)).size,26);
 assert.equal(ids.setIdentity.observedRecordType,'order');
 assert.equal(ids.rows.find(r=>r.code==='RETIC_PCT').observedUnitCode,'percent');
 assert.equal(ids.rows.find(r=>r.code==='RETIC_ABS').testDecision,'new_candidate_key_not_present');
 assert.ok(ids.rows.filter(r=>r.testDecision.startsWith('new')).every(r=>r.sameCodeMasterKeys.length===0));
 assert.equal(remote.cbcProfiles.rows.find(r=>r.panel_key==='cm.lab-panel.cbc-basic').panel_members.length,3);
 assert.equal(remote.cheongdam.rows.length,6);
 assert.equal(remote.cheongdam.rows.find(r=>r.source_key==='cm.order.lab.panel.cbc-basic').links.length,3);
 const lines=remote.canonicalFunctions.rows;
 assert.ok(lines.some(r=>r.proname==='clair_assert_lab_result_definition_snapshot' && r.line.includes("coalesce(jsonb_typeof(v_row->'referenceRange'),'missing') <> 'null'")));
 assert.ok(lines.some(r=>r.proname==='clair_save_lab_result_entry_v2' && r.line.includes("judgment='not_judged'")));
 assert.ok(remote.grants.rows.every(r=>!r.anon_execute));
 assert.ok(remote.columns.rows.every(r=>!r.name.includes('patient')));
});
test('historical audit source and artifact hashes retain their exact captured boundary',async()=>{
 const m=await read('artifact-manifest.v1.json');assert.equal(m.applicationAllowed,false);
 // All17 inspected code/migration blobs match localHead. The LAB02 manifest
 // was untracked at capture, so its still-frozen artifact is checked directly.
 // Do not replace past evidence hashes with later implementation hashes.
 for(const [p,h] of Object.entries(m.sourceHashes)){
  const bytes=p.startsWith('src/')||p.startsWith('supabase/')
   ?execFileSync('git',['show',`${m.localHead}:${p}`],{cwd:root,maxBuffer:2e6})
   :await readFile(resolve(root,p));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),h,p);
 }
 for(const [p,h] of Object.entries(m.artifactHashes))assert.equal(createHash('sha256').update(await readFile(resolve(dir,p))).digest('hex'),h,p);
 const contract=JSON.parse(await readFile(resolve(dir,'../oed-lab-02/cbc-workflow-and-screen-contract.v1.json'),'utf8'));
 const md=await readFile(resolve(dir,'audit-and-transition-plan.md'),'utf8');
 for(const target of contract.lab03AuditTargets)assert.ok(md.includes(`| ${target} |`),target);
});
test('audit report links, navigation, desktop and mobile render without network access',async()=>{
 const file=resolve(root,'docs/completed/clinical-master/2026-09-06-oed-lab-03-cbc-schema-audit-report.html');
 const html=await readFile(file,'utf8');
 for(const match of html.matchAll(/href="([^"]+)"/g)){const href=match[1];if(href.startsWith('#'))continue;assert.ok(!/^https?:/.test(href));await access(resolve(dirname(file),href));}
 const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await page.setContent(html);
 await page.evaluate(()=>document.documentElement.style.scrollBehavior='auto');
 assert.equal(await page.locator('main section').count(),9);
 assert.match(await page.locator('.next').innerText(),/WP-01B/);
 for(const link of await page.locator('aside a').all()){const id=await link.getAttribute('href');assert.equal(await page.locator(id).count(),1);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/oed-lab-03-top.png'});
 await page.locator('#section-6').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/oed-lab-03-next.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/oed-lab-03-mobile.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 }finally{await browser.close();}
});
