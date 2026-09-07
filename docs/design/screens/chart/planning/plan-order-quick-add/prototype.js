'use strict';

// Frontend-only design fixture. No network, storage, patient data, or app imports.
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value).replace(/[&<>"']/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const money = (amount) => amount.toLocaleString('ko-KR');
const catalog = [
  {id:'visit',name:'재진',category:'진료',billing:'재진',detail:'진료 · 단일 오더',price:28000},
  {id:'rabies',name:'광견병 예방접종',category:'진료',billing:'광견병 예방접종',detail:'예방접종 · 단일 오더',price:32000},
  {id:'checkup',name:'개 기초 건강검진',category:'진료',billing:'개 기초 건강검진',detail:'진료 · 단일 오더',price:33300},
  {id:'cbc',name:'CBC · 전혈구검사',category:'검사',billing:'전혈구검사 CBC',detail:'전혈 · 원내 검사',price:35000},
  {id:'cbc-retic',name:'CBC + 망상적혈구',category:'검사',billing:'CBC 및 망상적혈구 검사',detail:'전혈 · CBC + Reticulocyte',price:47000},
  {id:'cbc-out',name:'CBC · 외부 의뢰',category:'검사',billing:'외부 전혈구검사 CBC',detail:'전혈 · 외부 의뢰 검사',price:39000},
  {id:'chemistry',name:'혈액화학검사',category:'검사',billing:'혈액화학검사',detail:'혈청 · 원내 검사',price:65000},
  {id:'crp',name:'CRP · 염증 지표',category:'검사',billing:'CRP 검사',detail:'혈청 · 원내 검사',price:40000},
  {id:'urine',name:'요검사',category:'검사',billing:'요검사',detail:'소변 · 원내 검사',price:20000},
  {id:'xray',name:'흉부 방사선',category:'영상',billing:'흉부 방사선 검사',detail:'흉부 · 단일 오더',price:45000},
  {id:'xray-abd',name:'복부 방사선',category:'영상',billing:'복부 방사선 검사',detail:'복부 · 단일 오더',price:45000},
  {id:'ultrasound',name:'복부 초음파',category:'영상',billing:'복부 초음파 검사',detail:'복부 · 단일 오더',price:80000},
  {id:'eye',name:'안과 기본검사',category:'검사',billing:'안과 기본검사',detail:'안과 · 단일 오더',price:25000},
  {id:'ear',name:'귀 세정',category:'처치',billing:'귀 세정 처치',detail:'처치 · 단일 오더',price:15000},
  {id:'dressing',name:'드레싱',category:'처치',billing:'드레싱 처치',detail:'처치 · 단일 오더',price:15000},
  {id:'suture',name:'발사',category:'처치',billing:'발사 처치',detail:'처치 · 단일 오더',price:10000},
  {id:'ecg',name:'심전도',category:'검사',billing:'심전도 검사',detail:'원내 검사 · 단일 오더',price:30000},
  {id:'bloodpressure',name:'혈압 측정',category:'검사',billing:'혈압 측정',detail:'원내 검사 · 단일 오더',price:10000},
  {id:'cytology',name:'세포검사',category:'검사',billing:'세포검사',detail:'현미경 검사 · 단일 오더',price:30000},
  {id:'consult',name:'영양 상담',category:'진료',billing:'영양 상담',detail:'진료 · 단일 오더',price:20000},
  {id:'set-basic',name:'기본 검사 세트',category:'세트',billing:'기본 검사 세트',detail:'CBC · 혈액화학 · 요검사 / 구성 선택',price:null,parts:['cbc','chemistry','urine']},
];
const baseIds = ['rabies','visit','checkup'];
let orders = [], activeCategory = '전체', opened = false, lookupError = false, readonly = false;
let activeIndex = -1, matches = [], epoch = 0, latestAdded = '', toastTimer, selectedSet, removeId, returnToComposer = false;
let selectedCatalog = new Set();
const widths = [28,68,74,190,180,86,50,50,60,80,70,80,80,80,70,100,85,85,55,85,110,60,100,80,60,85,80];
const headers = ['', '분류','상태','Order 명','청구서명','청구반영','일수','횟수','총횟수','head/kg당','1회당','성분량','조제량','실조제량','보관','투여/복약','담당자','단가','수량','합계','할인할증(금액)','(%)','청구금액','사유','과세','수의사',''];
$('columns').innerHTML = widths.map(w => `<col style="width:${w}px">`).join('');
$('headers').innerHTML = headers.map((h,i) => `<th scope="col">${i===0?'<span class="selection-box" aria-hidden="true"></span>':esc(h)}</th>`).join('');
$('tableScroll').querySelector('table').style.width = `${widths.reduce((a,b)=>a+b,0)}px`;
function item(id) { return catalog.find(c=>c.id===id); }
function present(id) { return orders.some(o=>o.id===id); }
function announce(message) {
  clearTimeout(toastTimer); $('announcement').textContent=message; $('announcement').classList.add('visible');
  toastTimer=setTimeout(()=>$('announcement').classList.remove('visible'),2600);
}
function renderCategories() {
  $('categories').innerHTML = ['전체','진료','검사','영상','처치','세트'].map(category => {
    const count = orders.filter(o=>category==='전체'||o.category===category).length;
    return `<button data-category="${category}" class="${category===activeCategory?'active':''}" aria-pressed="${category===activeCategory}">${category}<span>${count}</span></button>`;
  }).join('');
}
function renderRows() {
  const visible = orders.filter(o=>activeCategory==='전체'||o.category===activeCategory);
  $('rows').innerHTML = visible.map(o=>{
    const state=o.save==='saving'?'저장 중':o.save==='failed'?'저장 실패':'미확정';
    const cells = [
      '<span class="selection-box" aria-hidden="true"></span>',`<span class="type">${o.category}</span>`,
      `<span class="row-state ${o.save==='failed'?'failed':''}">${state}</span>`,esc(o.name),
      `<span class="billing-name">${esc(o.billing)}</span>`,'반영','—','1','—','—','—','—','—','—','—','—','—',
      money(o.price||0),'1',money(o.price||0),'0','0 %',money(o.price||0),'—','—','—',
      `<button class="row-remove" data-remove="${o.id}" ${readonly?'disabled':''} aria-label="${esc(o.name)} 삭제">삭제</button>`
    ];
    return `<tr data-order-id="${o.id}" class="${o.id===latestAdded?'new-row':''}">${cells.map((c,i)=>`<td class="${i===3?'name':i===17||i===19||i===22?'amount-cell':''}">${c}</td>`).join('')}</tr>`;
  }).join('');
  $('emptyTable').hidden=visible.length>0;
  $('emptyTable').querySelector('strong').textContent=orders.length?'이 분류에 추가한 오더가 없습니다':'아직 추가한 오더가 없습니다';
  $('emptyHint').textContent=orders.length?'다른 분류를 선택하거나 오더를 추가해 주세요.':'오더를 추가해 주세요.';
  $('emptyCatalogButton').hidden=orders.length>0;
  $('emptyCatalogButton').disabled=readonly;
  $('composer').hidden=orders.length===0;
  if(!orders.length) closeSearch(false);
  renderCategories();renderFooter();positionComposer();
}
function renderFooter() {
  const saving=orders.some(o=>o.save==='saving'), failed=orders.some(o=>o.save==='failed');
  $('orderCount').textContent=`오더 ${orders.length}건`; $('draftCount').textContent=orders.length;
  $('saveState').textContent=failed?'저장 실패':saving?'저장 중':latestAdded?'저장됨':'변경 없음';
  $('saveState').classList.toggle('failed',failed);
  const total=orders.filter(o=>o.save==='saved').reduce((a,o)=>a+(o.price||0),0);
  $('amount').textContent=`${money(total)}원`;
  const hiddenNew=latestAdded&&activeCategory!=='전체'&&orders.some(o=>o.id===latestAdded&&o.category!==activeCategory);
  $('notice').hidden=!(failed||hiddenNew||readonly);
  if(readonly) $('notice').innerHTML='읽기 전용 차트입니다. 오더 추가·수정 권한이 없습니다.';
  else if(failed) $('notice').innerHTML='오더를 저장하지 못했습니다. 입력한 항목은 유지됩니다.<button id="retrySave">다시 저장</button>';
  else if(hiddenNew) $('notice').innerHTML='다른 분류에 오더를 추가했어요.<button id="showAll">전체에서 보기</button>';
}
function positionComposer() {
  const wrap=$('tableWrap'), scroll=$('tableScroll');
  const categoryBounds=$('headers').children[1].getBoundingClientRect();
  const pinnedEnd=$('headers').children[3].getBoundingClientRect().right;
  $('composer').style.setProperty('--order-offset',`${categoryBounds.left-wrap.getBoundingClientRect().left}px`);
  $('composer').style.setProperty('--order-entry-width',`${pinnedEnd-categoryBounds.left}px`);
  const rowCount=orders.filter(o=>activeCategory==='전체'||o.category===activeCategory).length;
  const natural=32+(rowCount?rowCount*38:108)-scroll.scrollTop;
  const limit=wrap.clientHeight-54;
  const docked=natural>limit||natural<32;
  $('composer').classList.toggle('docked',docked);
  $('composer').style.top=`${docked?limit:natural}px`;
  positionPopover();
}
function positionPopover() {
  if(!opened||$('popover').hidden) return;
  const rect=$('searchBox').getBoundingClientRect();
  const width=Math.min(window.innerWidth-24,rect.width);
  const hasResults=matches.length>0&&!lookupError;
  $('popover').style.width=`${width}px`;
  $('results').style.maxHeight='none';
  $('results').style.overflowY=hasResults?'auto':'visible';
  const chrome=$('popover').getBoundingClientRect().height-$('results').getBoundingClientRect().height;
  const desired=(hasResults?Math.min(288,$('results').scrollHeight):$('results').scrollHeight)+chrome;
  const bottom=document.querySelector('.bill').getBoundingClientRect().top;
  const below=bottom-rect.bottom-12, above=rect.top-12;
  const up=below<desired&&above>below;
  if(hasResults) $('results').style.maxHeight=`${Math.max(48,Math.min(288,(up?above:below)-chrome))}px`;
  $('popover').style.left=`${Math.min(Math.max(12,rect.left),window.innerWidth-width-12)}px`;
  const actual=$('popover').getBoundingClientRect().height;
  $('popover').style.top=`${Math.max(8,up?rect.top-actual-6:rect.bottom+6)}px`;
  $('popover').dataset.direction=up?'up':'down';
}
function openSearch() {
  if(readonly||!orders.length) return;
  opened=true; $('addTrigger').hidden=true; $('searchBox').hidden=false;
  $('popover').hidden=false; $('quickSearch').setAttribute('aria-expanded','true');
  renderResults();$('quickSearch').focus();positionComposer();
}
function closeSearch(restoreFocus=true) {
  opened=false;$('popover').hidden=true;$('searchBox').hidden=true;$('addTrigger').hidden=false;
  $('quickSearch').setAttribute('aria-expanded','false');$('quickSearch').removeAttribute('aria-activedescendant');
  if(restoreFocus&&!readonly) $('addTrigger').focus();
}
function search(value) {
  const q=value.trim().toLocaleLowerCase('ko-KR');
  if(!q) return [];
  const score=c=>{const n=c.name.toLocaleLowerCase('ko-KR');return n===q?0:n.startsWith(q)?1:2;};
  return catalog.filter(c=>`${c.name} ${c.billing}`.toLocaleLowerCase('ko-KR').includes(q)).sort((a,b)=>score(a)-score(b));
}
function renderResults() {
  const query=$('quickSearch').value.trim();
  matches=lookupError?[]:search(query);
  activeIndex=matches.findIndex(c=>!present(c.id));
  $('resultHeading').parentElement.hidden=!query||lookupError;
  $('resultHeading').textContent='검색 결과';
  $('resultCount').textContent=query&&!lookupError?`${matches.length}건`:'';
  if(lookupError) $('results').innerHTML='<div class="result-empty"><strong>오더를 불러오지 못했습니다</strong>검색어를 유지한 채 다시 시도해 주세요.<br><button id="retryLookup">다시 시도</button></div>';
  else if(!query) $('results').innerHTML='<div class="result-empty">오더명 또는 청구명을 입력해 주세요.</div>';
  else if(!matches.length) $('results').innerHTML='<div class="result-empty"><strong>검색 결과가 없습니다</strong>다른 이름이나 청구명으로 검색해 주세요.</div>';
  else $('results').innerHTML=matches.map((c,i)=>`<div id="result-${c.id}" class="result-option" role="option" aria-selected="${i===activeIndex}" aria-disabled="${present(c.id)}" data-result="${i}"><span class="result-category">${c.category}</span><div class="result-copy"><div class="result-name">${esc(c.name)}</div></div><span class="result-side">${present(c.id)?'이미 추가됨':c.parts?'구성 확인':`${money(c.price)}원`}</span></div>`).join('');
  updateActive(false);positionPopover();
}
function updateActive(scroll=true) {
  document.querySelectorAll('[data-result]').forEach((node)=>node.setAttribute('aria-selected',Number(node.dataset.result)===activeIndex?'true':'false'));
  if(activeIndex>=0&&matches[activeIndex]) {
    const id=`result-${matches[activeIndex].id}`;$('quickSearch').setAttribute('aria-activedescendant',id);
    if(scroll) $(id)?.scrollIntoView({block:'nearest'});
  } else $('quickSearch').removeAttribute('aria-activedescendant');
}
function append(c, extra={}) {
  if(readonly||present(c.id)) return;
  const token=epoch;
  orders.push({...c,...extra,save:'saving'});latestAdded=c.id;
  $('quickSearch').value='';renderRows();
  if(activeCategory==='전체'||activeCategory===c.category) $('tableScroll').scrollTop=$('tableScroll').scrollHeight;
  if(opened) {renderResults();$('quickSearch').focus();}
  announce(`${c.name} 추가 · 저장 중`);
  setTimeout(()=>{
    if(token!==epoch) return;
    const row=orders.find(o=>o.id===c.id);if(!row) return;
    row.save='saved';renderRows();announce(`${c.name} 저장됨`);
  },900);
}
function choose(c) {
  if(readonly||present(c.id)) return;
  if(c.parts) openSet(c);else append(c);
}
function openSet(c) {
  selectedSet=c;returnToComposer=opened;closeSearch(false);
  $('setTitle').textContent=c.name;
  $('setItems').innerHTML=c.parts.map(id=>`<label class="set-choice"><input type="checkbox" value="${id}" checked><span>${esc(item(id).name)}</span><small>${money(item(id).price)}원</small></label>`).join('');
  updateSetCount();$('setDialog').showModal();
}
function updateSetCount() {
  const checked=[...$('setItems').querySelectorAll('input:checked')];
  $('setCount').textContent=`${checked.length}개 구성 · ${money(checked.reduce((a,n)=>a+item(n.value).price,0))}원 (예시)`;
  $('setApply').disabled=!checked.length;
}
function openCatalog() {
  if(readonly) return;
  const query=$('quickSearch').value;returnToComposer=opened;closeSearch(false);
  selectedCatalog=new Set();$('catalogSearch').value=query;renderCatalog();$('catalogDialog').showModal();$('catalogSearch').focus();
}
function renderCatalog() {
  const query=$('catalogSearch').value;
  const candidates=query.trim()?search(query):catalog;
  $('catalogList').innerHTML=candidates.length?candidates.map(c=>`<label class="catalog-choice"><input type="checkbox" value="${c.id}" ${present(c.id)?'disabled':''} ${selectedCatalog.has(c.id)?'checked':''}><span>${esc(c.name)}</span><small>${present(c.id)?'이미 추가됨':c.parts?'구성 확인':c.category}</small></label>`).join(''):'<div class="result-empty">검색 결과가 없습니다</div>';
  $('catalogCount').textContent=`선택한 오더 ${selectedCatalog.size}개`;$('catalogApply').disabled=!selectedCatalog.size;
}
function scenario(value) {
  epoch++;latestAdded='';lookupError=value==='lookupError';readonly=value==='readonly';activeCategory='전체';
  closeSearch(false);$('quickSearch').value='';
  const ids=value==='empty'?[]:value==='long'?catalog.filter(c=>!c.parts&&c.id!=='cbc'&&c.id!=='ultrasound').map(c=>c.id):baseIds;
  orders=ids.map(id=>({...item(id),save:'saved'}));
  if(value==='saveError') {orders.push({...item('cbc'),save:'failed'});latestAdded='cbc';}
  $('addTrigger').disabled=readonly;$('catalogButton').disabled=readonly;
  $('tableScroll').scrollTop=0;$('tableScroll').scrollLeft=0;renderRows();
  const hints={base:'마지막 오더 아래의 <b>+ Order 추가</b>를 눌러 보세요. CBC, 방사선, 세트로 검색할 수 있어요.',search:'CBC 검색 결과를 선택한 뒤 <b>방사선</b>을 입력해 보세요. 검색창이 그대로 유지돼요.',empty:'빈 상태의 <b>+ Order</b>로 첫 오더를 추가해요. 오더가 1개 이상이면 하단 빠른 추가가 나타나요.',long:'추가행은 <b>청구 요약 위에 고정</b>돼요. CBC를 추가하거나 가로·세로로 스크롤해 보세요.',lookupError:'검색 실패는 결과 없음과 구분해요. <b>다시 시도</b>하면 입력한 검색어를 유지해요.',saveError:'저장되지 않은 오더를 남겨 두고 <b>다시 저장</b>할 수 있어요. 금액은 저장된 오더만 반영한 예시예요.',readonly:'권한이 없는 상태에서는 추가 버튼이 비활성화돼요. 실제 권한 검증은 서버에서 수행해야 해요.'};
  $('scenarioHint').innerHTML=hints[value];
  if(value==='search'||value==='lookupError') {$('quickSearch').value='CBC';openSearch();}
  positionComposer();
}
$('scenario').addEventListener('change',e=>scenario(e.target.value));
$('resetButton').addEventListener('click',()=>{$('scenario').value='base';scenario('base');announce('시안을 처음 상태로 되돌렸어요');});
$('narrowButton').addEventListener('click',()=>{const on=$('workspace').classList.toggle('narrow');$('narrowButton').setAttribute('aria-pressed',on);positionComposer();});
$('contextButton').addEventListener('click',()=>{const on=$('workspace').classList.toggle('focus-mode');$('contextButton').setAttribute('aria-pressed',on);positionComposer();});
$('categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;activeCategory=b.dataset.category;renderRows();});
$('addTrigger').addEventListener('click',openSearch);
$('closeSearch').addEventListener('click',()=>closeSearch());
$('quickSearch').addEventListener('input',renderResults);
$('quickSearch').addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229) return;
  if(e.key==='Escape'){e.preventDefault();closeSearch();return;}
  if(e.key==='Enter'){e.preventDefault();if(activeIndex>=0&&matches[activeIndex])choose(matches[activeIndex]);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();const eligible=matches.map((c,i)=>present(c.id)?-1:i).filter(i=>i>=0);if(!eligible.length)return;
    const now=eligible.indexOf(activeIndex), delta=e.key==='ArrowDown'?1:-1;
    activeIndex=eligible[(now+delta+eligible.length)%eligible.length];updateActive();
  }
});
$('results').addEventListener('pointerdown',e=>{if(e.target.closest('[data-result]'))e.preventDefault();});
$('results').addEventListener('click',e=>{const option=e.target.closest('[data-result]');if(option){choose(matches[Number(option.dataset.result)]);return;}if(e.target.closest('#retryLookup')){lookupError=false;renderResults();$('quickSearch').focus();}});
$('results').addEventListener('pointermove',e=>{const option=e.target.closest('[data-result]');if(option&&option.getAttribute('aria-disabled')!=='true'){activeIndex=Number(option.dataset.result);updateActive(false);}});
$('tableScroll').addEventListener('scroll',positionComposer);
window.addEventListener('resize',positionComposer);window.addEventListener('scroll',positionPopover,true);
new ResizeObserver(positionComposer).observe($('tableWrap'));
document.addEventListener('pointerdown',e=>{if(opened&&!e.target.closest('#composer')&&!e.target.closest('#popover'))closeSearch(false);});
document.addEventListener('focusin',e=>{if(opened&&!e.target.closest('#composer')&&!e.target.closest('#popover'))closeSearch(false);});
$('notice').addEventListener('click',e=>{
  if(e.target.id==='showAll'){activeCategory='전체';renderRows();$('tableScroll').scrollTop=$('tableScroll').scrollHeight;}
  if(e.target.id==='retrySave'){
    const token=epoch;orders.forEach(o=>{if(o.save==='failed')o.save='saving';});renderRows();
    setTimeout(()=>{if(token!==epoch)return;orders.forEach(o=>{if(o.save==='saving')o.save='saved';});renderRows();announce('오더를 저장했어요');},900);
  }
});
$('rows').addEventListener('click',e=>{const button=e.target.closest('[data-remove]');if(!button||readonly)return;removeId=button.dataset.remove;$('removeMessage').textContent=`${orders.find(o=>o.id===removeId).name} 오더를 삭제할까요?`;$('removeDialog').showModal();});
$('removeCancel').addEventListener('click',()=>$('removeDialog').close());
$('removeApply').addEventListener('click',()=>{orders=orders.filter(o=>o.id!==removeId);if(latestAdded===removeId)latestAdded='';$('removeDialog').close();renderRows();announce('미확정 오더를 삭제했어요');});
$('emptyCatalogButton').addEventListener('click',openCatalog);
$('catalogButton').addEventListener('click',openCatalog);$('fullCatalog').addEventListener('click',openCatalog);
$('catalogSearch').addEventListener('input',renderCatalog);
$('catalogList').addEventListener('change',e=>{if(e.target.checked)selectedCatalog.add(e.target.value);else selectedCatalog.delete(e.target.value);$('catalogCount').textContent=`선택한 오더 ${selectedCatalog.size}개`;$('catalogApply').disabled=!selectedCatalog.size;});
$('catalogApply').addEventListener('click',()=>{
  const selected=[...selectedCatalog].map(item);const set=selected.find(c=>c.parts);
  returnToComposer=true;$('catalogDialog').close();
  selected.filter(c=>!c.parts).forEach(c=>append(c));
  if(set)openSet(set);else openSearch();
});
$('catalogDialog').addEventListener('close',()=>{if(returnToComposer&&!$('setDialog').open)openSearch();});
$('setItems').addEventListener('change',updateSetCount);
$('setApply').addEventListener('click',()=>{
  const checked=[...$('setItems').querySelectorAll('input:checked')].map(n=>item(n.value));if(!checked.length)return;
  const c=selectedSet;returnToComposer=true;$('setDialog').close();openSearch();
  append(c,{price:checked.reduce((a,p)=>a+p.price,0),name:`${c.name} (${checked.length}개 구성)`});
});
$('setDialog').addEventListener('close',()=>{if(returnToComposer)openSearch();});
$('planButton').addEventListener('click',()=>$('planDialog').showModal());
scenario('base');
