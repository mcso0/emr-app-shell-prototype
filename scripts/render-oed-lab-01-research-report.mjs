#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { marked } from "marked";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-01",
);
const SOURCE_PATH = resolve(ARTIFACT_DIR, "report-source.md");
const MANIFEST_PATH = resolve(ARTIFACT_DIR, "artifact-manifest.v1.json");
const GAP_PATH = resolve(ARTIFACT_DIR, "oed-lab-01-gap-matrix.v1.json");
const OUTPUT_PATH = resolve(
  REPO_ROOT,
  "docs/completed/clinical-master/2026-09-04-oed-lab-01-clinical-laboratory-landscape-report.html",
);

const sectionIds = new Map([
  ["결론", "conclusion"],
  ["2026-09-06 보정 결과", "corrections"],
  ["조사 범위와 경계", "scope"],
  ["현재 구조를 숫자로 보면", "numbers"],
  ["외부 조사에서 확인한 공통 구조", "model"],
  ["검사군별 전체 지도", "families"],
  ["현재 구조의 핵심 문제", "gaps"],
  ["86개 오더 전수 분류표", "orders"],
  ["장비와 수행 경로 결론", "equipment"],
  ["출처 원장", "sources"],
  ["다음 작업 인계: OED-LAB-02", "next-step"],
  ["산출물 목록", "artifacts"],
]);

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
}

function prepareArticle(markdown) {
  const withoutTitle = stripFrontmatter(markdown)
    .trimStart()
    .replace(/^# .+\n+/, "");
  let article = marked.parse(withoutTitle, { gfm: true });

  for (const [label, id] of sectionIds) {
    article = article.replace(`<h2>${label}</h2>`, `<h2 id="${id}">${label}</h2>`);
  }

  return article
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, "</table></div>")
    .replace(
      /href="(https?:\/\/[^\"]+)"/g,
      'href="$1" target="_blank" rel="noreferrer"',
    );
}

const [source, manifestText, gapText] = await Promise.all([
  readFile(SOURCE_PATH, "utf8"),
  readFile(MANIFEST_PATH, "utf8"),
  readFile(GAP_PATH, "utf8"),
]);
const manifest = JSON.parse(manifestText);
const gapMatrix = JSON.parse(gapText);
const article = prepareArticle(source);
const counts = manifest.counts;

const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <meta name="description" content="CLAiR 임상병리 마스터 오더 86건의 외부 전체 구조 조사 보고서" />
    <title>OED-LAB-01 · 임상병리 검사 86개 구조 조사</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Segoe UI", sans-serif;
        color: #172033;
        background: #eef3f8;
        font-synthesis: none;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body { margin: 0; min-width: 320px; line-height: 1.72; word-break: keep-all; }
      a { color: #155eef; text-underline-offset: 3px; }
      a:hover { color: #004eeb; }
      code { padding: 0.15em 0.42em; border-radius: 6px; background: #eef2f7; color: #344054; font-size: 0.88em; word-break: break-all; }

      .progress { position: fixed; inset: 0 0 auto; z-index: 20; height: 3px; background: linear-gradient(90deg, #5eead4 var(--progress, 0%), transparent 0); pointer-events: none; }
      .page-shell { width: min(1320px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 76px; }
      .hero { position: relative; overflow: hidden; padding: clamp(30px, 5vw, 62px); border: 1px solid #1f3153; border-radius: 26px; background: radial-gradient(circle at 87% 12%, rgba(94, 234, 212, .23), transparent 31%), radial-gradient(circle at 8% 92%, rgba(99, 102, 241, .20), transparent 34%), linear-gradient(135deg, #111a2c 0%, #1b2d4c 58%, #17434b 100%); box-shadow: 0 25px 68px rgba(35, 52, 78, .19); color: white; }
      .eyebrow { margin: 0 0 13px; color: #9cebd8; font-size: 12px; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; }
      .hero h1 { max-width: 900px; margin: 0; font-size: clamp(34px, 5.1vw, 58px); line-height: 1.1; letter-spacing: -.045em; }
      .hero-summary { max-width: 860px; margin: 21px 0 0; color: #d8e4f3; font-size: clamp(16px, 2vw, 20px); }
      .status-row { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 25px; }
      .chip { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 7px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 999px; background: rgba(255,255,255,.09); color: #f6fbff; font-size: 13px; font-weight: 750; }
      .chip::before { width: 7px; height: 7px; border-radius: 50%; background: #5eead4; content: ""; }
      .chip.caution::before { background: #fbbf24; }
      .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 34px; }
      .metric { padding: 18px; border: 1px solid rgba(255,255,255,.14); border-radius: 15px; background: rgba(255,255,255,.08); backdrop-filter: blur(12px); }
      .metric strong { display: block; font-size: 31px; line-height: 1.05; letter-spacing: -.035em; }
      .metric span { display: block; margin-top: 8px; color: #cbd7e6; font-size: 12px; font-weight: 700; }

      .decision { display: grid; grid-template-columns: auto 1fr; gap: 14px; margin: 20px 0; padding: 18px 20px; border: 1px solid #b8e6da; border-radius: 16px; background: #effbf7; color: #18594c; }
      .decision strong { white-space: nowrap; }
      .decision p { margin: 0; }
      .content-grid { display: grid; grid-template-columns: 238px minmax(0, 1fr); gap: 22px; align-items: start; }
      .toc { position: sticky; top: 18px; padding: 18px; border: 1px solid #d8e2ee; border-radius: 17px; background: rgba(255,255,255,.92); box-shadow: 0 12px 34px rgba(41,57,80,.07); backdrop-filter: blur(12px); }
      .toc-title { margin: 0 0 10px; color: #667085; font-size: 11px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
      .toc a { display: block; padding: 7px 8px; border-radius: 8px; color: #475467; font-size: 13px; font-weight: 680; text-decoration: none; }
      .toc a:hover { background: #f0f4f8; color: #155eef; }
      .toc .divider { height: 1px; margin: 13px 0; background: #e4eaf1; }
      .toc .source-link { color: #155eef; }

      article { min-width: 0; padding: clamp(24px, 4vw, 50px); border: 1px solid #d8e2ee; border-radius: 19px; background: white; box-shadow: 0 14px 42px rgba(41,57,80,.075); }
      article h2, article h3, article h4 { scroll-margin-top: 26px; color: #172033; letter-spacing: -.025em; }
      article h2 { margin: 3.1em 0 .7em; padding-top: .2em; font-size: clamp(25px, 3vw, 32px); line-height: 1.25; }
      article h2:first-child { margin-top: 0; }
      article h3 { margin: 2.1em 0 .55em; font-size: 21px; }
      article h4 { margin: 1.65em 0 .45em; font-size: 17px; }
      article p { margin: .8em 0; }
      article ul, article ol { padding-left: 1.35em; }
      article li + li { margin-top: .34em; }
      article strong { color: #101828; }
      article blockquote { margin: 1.2em 0; padding: 12px 18px; border-left: 4px solid #5e7ce2; background: #f7f8fe; color: #344054; }
      .table-scroll { margin: 1.15em 0 1.8em; overflow: auto; border: 1px solid #dbe3ed; border-radius: 13px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.48; }
      th { position: sticky; top: 0; z-index: 1; padding: 11px 12px; border-bottom: 1px solid #cfd9e5; background: #f2f5f9; color: #344054; font-weight: 800; text-align: left; white-space: nowrap; }
      td { padding: 10px 12px; border-bottom: 1px solid #e8edf3; vertical-align: top; }
      tr:last-child td { border-bottom: 0; }
      tbody tr:hover { background: #f8fbfd; }
      #gaps + .table-scroll tbody tr td:nth-child(2) { color: #b42318; font-weight: 800; }
      .table-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 15px 0 10px; }
      .table-toolbar input { flex: 1 1 320px; min-height: 42px; padding: 9px 13px; border: 1px solid #cfd9e5; border-radius: 10px; background: #fff; color: #172033; font: inherit; }
      .table-toolbar input:focus { outline: 3px solid rgba(21,94,239,.14); border-color: #155eef; }
      .table-count { color: #667085; font-size: 13px; font-weight: 750; }
      .footer { margin-top: 22px; padding: 18px 20px; border: 1px solid #d8e2ee; border-radius: 15px; background: #fff; color: #667085; font-size: 13px; }

      @media (max-width: 940px) {
        .content-grid { grid-template-columns: 1fr; }
        .toc { position: relative; top: 0; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); }
        .toc-title, .toc .divider { grid-column: 1 / -1; }
        .metrics { grid-template-columns: repeat(2, minmax(0,1fr)); }
      }
      @media (max-width: 620px) {
        .page-shell { width: min(100% - 20px, 1320px); padding-top: 10px; }
        .hero { border-radius: 18px; }
        .metrics { grid-template-columns: 1fr 1fr; }
        .metric strong { font-size: 26px; }
        .decision { grid-template-columns: 1fr; }
        article { padding: 22px 17px; }
        .toc { grid-template-columns: 1fr; }
        .toc-title, .toc .divider { grid-column: auto; }
        body { word-break: normal; }
      }
    </style>
  </head>
  <body>
    <div class="progress" aria-hidden="true"></div>
    <main class="page-shell">
      <header class="hero">
        <p class="eyebrow">CLAiR · Clinical Master · OED-LAB-01</p>
        <h1>임상병리 검사 86개<br />외부 전체 구조 조사</h1>
        <p class="hero-summary">로컬 고정 목록 86건의 구조를 대조했다. 9월 6일 분류 오류와 후보값 출처를 보정했다. 검사별 정상범위·장비 호환성 정밀 조사는 다음 단계다.</p>
        <div class="status-row">
          <span class="chip">전체 지도 작성 · 9/6 보정</span>
          <span class="chip caution">임상 검수 아님</span>
          <span class="chip caution">앱·DB·마스터 비적용</span>
          <span class="chip">다음 작업 OED-LAB-02</span>
        </div>
        <div class="metrics" aria-label="핵심 수치">
          <div class="metric"><strong>${counts.clinicalLabOrders}</strong><span>전체 임상병리 오더</span></div>
          <div class="metric"><strong>${counts.currentLabTestDefinitions}</strong><span>현재 검사 결과 정의</span></div>
          <div class="metric"><strong>${counts.labTestsWithoutDirectOrder}</strong><span>로컬 독립 주문 연결 없음</span></div>
          <div class="metric"><strong>${gapMatrix.counts.blocker}</strong><span>구조 변경을 막는 blocker</span></div>
        </div>
      </header>

      <aside class="decision">
        <strong>한 줄 판단</strong>
        <p>검사명을 더 채우는 문제가 아니야. 세트와 하위 오더, 결과값, 장비·종별 정상범위를 서로 다른 계층으로 분리해야 해.</p>
      </aside>

      <div class="content-grid">
        <nav class="toc" aria-label="보고서 목차">
          <p class="toc-title">Report contents</p>
          <a href="#conclusion">결론</a>
          <a href="#corrections">9/6 보정 결과</a>
          <a href="#scope">조사 범위와 경계</a>
          <a href="#numbers">현재 구조 수치</a>
          <a href="#model">공통 구조</a>
          <a href="#families">검사군 전체 지도</a>
          <a href="#gaps">핵심 문제</a>
          <a href="#orders">86개 전수 분류</a>
          <a href="#equipment">장비와 수행 경로</a>
          <a href="#sources">출처 원장</a>
          <a href="#next-step">다음 작업</a>
          <div class="divider"></div>
          <a class="source-link" href="../../work/clinical-master/order-execution-defaults/artifacts/oed-lab-01/report-source.md">AI용 Markdown 열기</a>
          <a class="source-link" href="../../work/clinical-master/order-execution-defaults/artifacts/oed-lab-01/artifact-manifest.v1.json">JSON 산출물 목록</a>
        </nav>
        <article>${article}</article>
      </div>

      <footer class="footer">최초 조사 2026-09-04 · 보정 ${manifest.generatedAt} · research_only_non_applied · applicationAllowed: false · 원격 상태 미검증</footer>
    </main>
    <script>
      const progress = document.querySelector('.progress');
      const updateProgress = () => {
        const total = document.documentElement.scrollHeight - innerHeight;
        const value = total > 0 ? Math.min(100, Math.max(0, scrollY / total * 100)) : 0;
        progress.style.setProperty('--progress', value + '%');
      };
      addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();

      const ordersHeading = document.querySelector('#orders');
      const orderTable = ordersHeading?.nextElementSibling?.matches('p')
        ? ordersHeading.nextElementSibling.nextElementSibling
        : ordersHeading?.nextElementSibling;
      if (orderTable?.classList.contains('table-scroll')) {
        const rows = [...orderTable.querySelectorAll('tbody tr')];
        const toolbar = document.createElement('div');
        toolbar.className = 'table-toolbar';
        toolbar.innerHTML = '<input type="search" aria-label="86개 오더 검색" placeholder="오더 ID, 표시명, 검사군으로 검색" /><span class="table-count"></span>';
        orderTable.before(toolbar);
        const input = toolbar.querySelector('input');
        const count = toolbar.querySelector('.table-count');
        const filter = () => {
          const query = input.value.trim().toLocaleLowerCase('ko');
          let visible = 0;
          for (const row of rows) {
            const show = !query || row.textContent.toLocaleLowerCase('ko').includes(query);
            row.hidden = !show;
            if (show) visible += 1;
          }
          count.textContent = visible + ' / ' + rows.length + '건';
        };
        input.addEventListener('input', filter);
        filter();
      }
    </script>
  </body>
</html>`;

await writeFile(OUTPUT_PATH, html, "utf8");
console.log(`Rendered ${OUTPUT_PATH}`);
