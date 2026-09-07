import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
const root=resolve(import.meta.dirname,"..");
const file=resolve(root,"docs/completed/clinical-master/2026-09-06-oed-lab-02-cbc-functional-specimen-report.html");
test("CBC report renders all parameters and preserves explicit profile/no-fallback behavior",async()=>{
  const html=await readFile(file,"utf8");
  for(const match of html.matchAll(/href="([^"]+)"/g)){
    const href=match[1];if(/^(https?:|#|data:)/.test(href))continue;
    await access(resolve(dirname(file),href));
  }
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[],requests=[];
    page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});page.on("request",r=>requests.push(r.url()));
    await page.setContent(html);
    await page.evaluate(()=>{document.documentElement.style.scrollBehavior="auto";});
    const select=page.getByLabel("수행 프로필");
    assert.equal(await page.locator("#candidate-table tbody tr").count(),25);
    assert.equal(await page.locator("#candidate-table tbody th").evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).position==="static")),true);
    assert.equal(await select.inputValue(),"");
    await page.getByRole("button",{name:"데모 정상 예시 채우기"}).click();
    assert.equal(await select.inputValue(),"");
    assert.match(await page.locator("#sample-message").innerText(),/직접 선택/);
    await select.selectOption("candidate.profile.clair-demo-cbc.dog.v1");
    await page.getByRole("button",{name:"데모 정상 예시 채우기"}).click();
    assert.equal(await page.locator("#candidate-table .normal").count(),25);
    const wbc=page.getByLabel("WBC 결과",{exact:true});
    await wbc.fill("30");assert.match(await page.locator('[data-code="WBC"] .judgment').innerText(),/초과/);
    await wbc.fill("");assert.match(await page.locator('[data-code="WBC"] .judgment').innerText(),/미입력/);
    await select.selectOption("candidate.profile.procyte-dx.cat.2019.v1");
    assert.equal(await page.getByLabel("PDW 결과",{exact:true}).isDisabled(),true);
    await page.getByLabel("NEU_PCT 결과",{exact:true}).fill("50");
    assert.match(await page.locator('[data-code="NEU_PCT"] .judgment').innerText(),/범위 없음/);
    await wbc.fill("2.87");assert.match(await page.locator('[data-code="WBC"] .judgment').innerText(),/정상/);
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"/tmp/oed-lab-02-report-top.png"});
    await page.locator(".explorer").scrollIntoViewIfNeeded();await page.screenshot({path:"/tmp/oed-lab-02-report-table.png"});
    await page.locator("#section-8").scrollIntoViewIfNeeded();await page.screenshot({path:"/tmp/oed-lab-02-report-close.png"});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  }finally{await browser.close();}
});
