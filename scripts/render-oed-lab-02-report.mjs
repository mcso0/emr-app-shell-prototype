#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { evaluateNumeric } from "./lib/oed-lab-02-contract.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dir=resolve(root,"docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-02");
const output=resolve(root,"docs/completed/clinical-master/2026-09-06-oed-lab-02-cbc-functional-specimen-report.html");
const read=async(name)=>JSON.parse(await readFile(resolve(dir,name),"utf8"));
const [source,{definitions},{profiles},fixtures,manifest,template]=await Promise.all([
  readFile(resolve(dir,"report-source.md"),"utf8"),read("cbc-result-definitions.non-applied.v1.json"),read("cbc-result-profiles.non-applied.v1.json"),
  read("cbc-functional-fixtures.v1.json"),read("artifact-manifest.v1.json"),readFile(resolve(root,"scripts/render-oed-lab-01-research-report.mjs"),"utf8")]);
// Reuse the existing report's visual system; no app/design-system changes.
const css=template.match(/<style>([\s\S]*?)<\/style>/)[1];
const headings=[...source.matchAll(/^## (.+)$/gm)].map((match,index)=>({title:match[1],id:`section-${index}`}));
let article=marked.parse(source.replace(/^---\n[\s\S]*?\n---\n/,""));
for(const heading of headings)article=article.replace(`<h2>${heading.title}</h2>`,`<h2 id="${heading.id}">${heading.title}</h2>`);
const artifactRelative="../../work/clinical-master/order-execution-defaults/artifacts/oed-lab-02/";
article=article.replaceAll('href="./',`href="${artifactRelative}`).replace(/<table>/g,'<div class="table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
const explorer=`<section class="explorer" aria-label="CBC 후보 프로필 확인">
  <label for="profile-choice">수행 프로필</label>
  <select id="profile-choice"><option value="">직접 선택해 주세요 — 자동 대체 없음</option>${profiles.map((p)=>`<option value="${p.profileId}">${p.equipment.model} · ${p.species==="dog"?"개":"고양이"} · ${p.provenance==="synthetic_functional_fixture"?"기능용 합성값":"2019 공개자료 참고값"}</option>`).join("")}</select>
  <div class="explorer-actions"><button id="fill-example" type="button">데모 정상 예시 채우기</button><button id="clear-values" type="button">입력 비우기</button></div>
  <p id="profile-description" class="muted">프로필을 선택하면 해당 단위와 범위를 표시해요.</p>
  <p id="sample-message" role="status" aria-live="polite"></p>
  <div class="table-scroll"><table id="candidate-table"><thead><tr><th scope="col">하위 오더</th><th scope="col">구분</th><th scope="col">결과 입력</th><th scope="col">단위</th><th scope="col">판별</th><th scope="col">정상범위 / 상태</th></tr></thead><tbody></tbody></table></div>
  <p class="muted">수기 혈액도말은 소견·판독 코드·첨부로 별도 기록해요. 이 표는 수치 25개만 보여줘요. 모든 입력은 이 보고서 안에서만 유지돼요.</p>
  <details><summary>WBC 단일 재검 예시 보기</summary><p>최초 WBC 30 → 새 WBC 요청 1개 → 새 WBC 10. 최초 결과는 그대로 남아요. 재검은 CBC 20개 전체를 다시 요청하지 않아요.</p><dl><dt>최초 결과 ID</dt><dd><code>${fixtures.timeline.initial.result.resultId}</code></dd><dt>재검의 직전 결과 연결</dt><dd><code>${fixtures.timeline.retestRequested.previousResultId}</code></dd><dt>새 결과 ID</dt><dd><code>${fixtures.timeline.retestCompleted.result.resultId}</code></dd></dl><p class="muted">CLAiR 개 데모 프로필 기준의 합성 예시예요. 실제 환자 기록이나 저장 동작은 없어요.</p></details>
</section>`;
article=article.replace("<!-- CBC_PROFILE_EXPLORER -->",explorer);
const payload=JSON.stringify({definitions,profiles,samples:fixtures.coherentSamples}).replaceAll("<","\\u003c");
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>CBC 후보 검토 · OED-LAB-02</title><style>${css}
  select,input,button{font:inherit} select{width:100%;padding:12px;border:1px solid #98a2b3;border-radius:8px;background:#fff;color:#172033} label{font-weight:700} button{border:1px solid #98a2b3;border-radius:8px;padding:8px 14px;background:#fff;color:#172033;cursor:pointer} button:hover{background:#eef4ff} input{width:108px;padding:8px;border:1px solid #98a2b3;border-radius:6px} button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #155eef;outline-offset:2px}.explorer{padding:18px;border:1px solid #b8d5ed;background:#f8fbff;border-radius:12px}.explorer-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.muted{font-size:13px;color:#475467}#sample-message{color:#344054}#candidate-table{min-width:720px}#candidate-table td{font-size:13px}.judgment{white-space:nowrap}.high,.low{color:#b42318;font-weight:700}.normal{color:#087443;font-weight:700}details{border-top:1px solid #cbd5e1;padding-top:14px}summary{cursor:pointer;font-weight:700}dd{margin-left:0;overflow-wrap:anywhere}article h1{font-size:25px}tbody th{font-weight:500}
  #candidate-table tbody th{position:static;z-index:auto;background:transparent}
  </style></head><body><main class="page-shell"><header class="hero"><p class="eyebrow">CLAiR · OED-LAB-02 · RESEARCH CANDIDATE</p><h1>CBC를 하위 오더까지<br>준비한 데이터 후보</h1><p class="hero-summary">단위·정상범위·판별·단일 항목 재검을 확인할 수 있어. 실제 마스터와 DB에는 아직 적용하지 않았어.</p><div class="status-row"><span class="chip">비적용 후보 완성</span><span class="chip caution">임상 검증 아님</span><span class="chip">수동 입력 · 연동 안 됨</span><span class="chip">다음 OED-LAB-03</span></div><div class="metrics"><div class="metric"><strong>${manifest.counts.atomicOrders}</strong><span>독립 하위 오더 후보</span></div><div class="metric"><strong>${manifest.counts.publishedSpeciesIntervals}</strong><span>공식 범위 전사 · 종별 항목 쌍</span></div><div class="metric"><strong>4 + 1</strong><span>수치 프로필 + 수기 프로필</span></div><div class="metric"><strong>${manifest.counts.numericBranchFixtures}</strong><span>수치 분기 검증 예시</span></div></div></header>
  <aside class="decision"><strong>이번 검토의 핵심</strong><p>프로필을 골라 후보값을 확인해 줘. 다음 단계에서 이 구조와 현재 코드·DB를 대조할 거야.</p></aside><div class="content-grid"><nav class="toc" aria-label="보고서 목차"><p class="toc-title">검토 순서</p>${headings.map((h)=>`<a href="#${h.id}">${h.title}</a>`).join("")}<div class="divider"></div><a href="${artifactRelative}report-source.md">MD 원문</a><a href="${artifactRelative}artifact-manifest.v1.json">JSON 산출물 목록</a></nav><article>${article}</article></div><footer class="footer">2026-09-06 · 연구 후보 · 앱·DB·마스터 비적용 · 공개 문서 버전 고정 · 임상용 아님</footer></main>
  <script>const data=${payload};const evaluateNumeric=${evaluateNumeric.toString()};
  const select=document.getElementById('profile-choice'),body=document.querySelector('#candidate-table tbody'),description=document.getElementById('profile-description'),message=document.getElementById('sample-message');
  const labels={profile_required:'프로필 선택 필요',species_mismatch:'동물종 불일치',unsupported_parameter:'제공하지 않는 항목',unit_mismatch:'단위 불일치',not_entered:'미입력',invalid_number:'입력 오류',instrument_no_result:'장비 결과 없음',qualified_result:'부등호 결과 · 판별 보류',flagged_result:'장비 플래그 · 판별 보류',outside_documented_display_range:'표시 범위 초과 · 판별 보류',recorded_without_interval:'범위 없음 · 판별 안 함'};
  const outcomeLabels={low:'미달',normal:'정상',high:'초과'};
  const selected=()=>data.profiles.find(p=>p.profileId===select.value);
  function render(){const profile=selected();body.replaceChildren();description.textContent=profile?profile.equipment.model+' · '+(profile.species==='dog'?'개':'고양이')+' · 수동 입력 · 연동 안 됨 · '+(profile.documentRevision||'CLAiR 기능용 합성 프로필 v1'):'프로필을 직접 선택해 주세요. 다른 프로필로 자동 대체하지 않아요.';
    for(const definition of data.definitions.filter(d=>d.kind==='quantity')){const rule=profile?.rules.find(r=>r.resultDefinitionId===definition.resultDefinitionId);const row=document.createElement('tr');row.dataset.code=definition.code;
      const name=document.createElement('th');name.scope='row';name.textContent=definition.code+' · '+definition.displayName;row.append(name);
      const group=document.createElement('td');group.textContent=definition.group==='core'?'기본':'선택';row.append(group);
      const entry=document.createElement('td');const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.setAttribute('aria-label',definition.code+' 결과');input.disabled=!profile||!rule?.resultSupported;entry.append(input);row.append(entry);
      const unit=document.createElement('td');unit.textContent=profile?definition.displayUnit:'—';row.append(unit);
      const judgment=document.createElement('td');judgment.className='judgment';row.append(judgment);
      const range=document.createElement('td');range.textContent=!profile?'프로필 미선택':!rule.resultSupported?'N/A · 결과·범위 미제공':rule.referenceInterval?rule.referenceInterval.low+'–'+rule.referenceInterval.high:'고정 문서에 범위 없음';row.append(range);
      const update=()=>{const output=evaluateNumeric({profile,definition,species:profile?.species,unit:rule?.unit,value:input.value});judgment.textContent=outcomeLabels[output.interpretation]||labels[output.state]||output.state;judgment.className='judgment '+(outcomeLabels[output.interpretation]?output.interpretation:'');};input.addEventListener('input',update);update();body.append(row);
    }}
  select.addEventListener('change',()=>{render();message.textContent='선택한 프로필로 표시했어요. 이전 입력은 비웠어요.';});
  document.getElementById('clear-values').addEventListener('click',()=>{render();message.textContent='입력을 비웠어요. 저장된 데이터는 없어요.';});
  document.getElementById('fill-example').addEventListener('click',()=>{const p=selected();if(!p||p.provenance!=='synthetic_functional_fixture'){message.textContent='CLAiR 데모 프로필을 직접 선택한 뒤 눌러 주세요. 자동으로 변경하지 않아요.';return;}const sample=data.samples.find(s=>s.profileId===p.profileId);for(const row of body.rows){const input=row.querySelector('input');const definition=data.definitions.find(d=>d.code===row.dataset.code);input.value=String(Number(sample.values[row.dataset.code].toFixed(definition.decimalScale)));input.dispatchEvent(new Event('input'));}message.textContent='합성 CBC 예시를 채웠어요. 실제 환자 값이 아니며 이 보고서 밖에 저장되지 않아요.';});render();
  </script></body></html>`;
await writeFile(output,html);console.log(output);
