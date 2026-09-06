#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { marked } from "marked";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const SOURCE_PATH = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/WP-00-01A-mid-review-report.ko.md",
);
const OUTPUT_PATH = resolve(
  REPO_ROOT,
  "docs/completed/clinical-master/2026-09-04-clinical-master-order-execution-defaults-wp-00-01a-review-report.html",
);

const sectionIds = new Map([
  ["결론", "conclusion"],
  ["이번 단계에서 확정한 기준", "contract"],
  ["WP-00 감사 결과", "audit"],
  ["WP-01A 후보 결과", "candidates"],
  ["확정된 제품 결정", "review-decisions"],
  ["다음 스텝", "next-step"],
  ["검토 자료", "artifacts"],
  ["이번 작업에서 바뀌지 않은 것", "unchanged"],
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
    article = article.replace(
      `<h2>${label}</h2>`,
      `<h2 id="${id}">${label}</h2>`,
    );
  }

  return article
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, "</table></div>")
    .replace(
      /href="\.\/artifacts\//g,
      'href="../../work/clinical-master/order-execution-defaults/artifacts/',
    )
    .replace(
      /href="\.\/WP-01B-persisted-admin-chart-read-parity\.md"/g,
      'href="../../work/clinical-master/order-execution-defaults/WP-01B-persisted-admin-chart-read-parity.md"',
    )
    .replace(
      /href="(https?:\/\/[^\"]+)"/g,
      'href="$1" target="_blank" rel="noreferrer"',
    );
}

const source = await readFile(SOURCE_PATH, "utf8");
const article = prepareArticle(source);
const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    <meta
      name="description"
      content="CLAiR 마스터 오더 522건의 WP-00 의미 감사와 WP-01A 조사 기반 비적용 후보에 대한 제품 검토 보고서"
    />
    <title>마스터 오더 기본값 WP-00·WP-01A 검토 보고서</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Pretendard",
          "Apple SD Gothic Neo", "Segoe UI", sans-serif;
        color: #172033;
        background: #eef2f7;
        font-synthesis: none;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        min-width: 320px;
        line-height: 1.72;
        word-break: keep-all;
      }

      a {
        color: #155eef;
        text-underline-offset: 3px;
      }

      a:hover {
        color: #004eeb;
      }

      .page-shell {
        width: min(1240px, calc(100% - 40px));
        margin: 0 auto;
        padding: 28px 0 72px;
      }

      .hero {
        position: relative;
        overflow: hidden;
        padding: clamp(28px, 5vw, 58px);
        border: 1px solid #253b63;
        border-radius: 24px;
        background:
          radial-gradient(circle at 92% 8%, rgba(95, 223, 196, 0.22), transparent 31%),
          linear-gradient(135deg, #101a2e 0%, #1a2b4b 62%, #173e4c 100%);
        box-shadow: 0 24px 64px rgba(25, 43, 73, 0.18);
        color: #ffffff;
      }

      .eyebrow {
        margin: 0 0 14px;
        color: #9ce6d2;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero h1 {
        max-width: 820px;
        margin: 0;
        font-size: clamp(32px, 5vw, 54px);
        line-height: 1.13;
        letter-spacing: -0.045em;
      }

      .hero-summary {
        max-width: 820px;
        margin: 20px 0 0;
        color: #dce6f6;
        font-size: clamp(16px, 2vw, 19px);
      }

      .status-row {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 24px;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 7px 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.09);
        color: #f7fbff;
        font-size: 13px;
        font-weight: 700;
      }

      .status-chip::before {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #63e6be;
        content: "";
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-top: 32px;
      }

      .metric {
        padding: 17px 18px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
      }

      .metric strong {
        display: block;
        font-size: 30px;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }

      .metric span {
        display: block;
        margin-top: 7px;
        color: #cbd7e9;
        font-size: 12px;
        font-weight: 650;
      }

      .review-note {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        margin: 18px 0;
        padding: 17px 20px;
        border: 1px solid #f1d28b;
        border-radius: 14px;
        background: #fff8e7;
        color: #654a14;
      }

      .review-note strong {
        white-space: nowrap;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 230px minmax(0, 1fr);
        gap: 22px;
        align-items: start;
      }

      .toc {
        position: sticky;
        top: 18px;
        padding: 18px;
        border: 1px solid #dbe3ef;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 10px 30px rgba(42, 57, 82, 0.06);
        backdrop-filter: blur(12px);
      }

      .toc-title {
        margin: 0 0 10px;
        color: #667085;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .toc a {
        display: block;
        padding: 7px 8px;
        border-radius: 8px;
        color: #344054;
        font-size: 13px;
        font-weight: 650;
        text-decoration: none;
      }

      .toc a:hover {
        background: #eef4ff;
        color: #155eef;
      }

      article {
        min-width: 0;
        padding: clamp(24px, 5vw, 52px);
        border: 1px solid #dbe3ef;
        border-radius: 20px;
        background: #ffffff;
        box-shadow: 0 14px 44px rgba(42, 57, 82, 0.08);
      }

      article h2,
      article h3 {
        color: #172033;
        line-height: 1.3;
        letter-spacing: -0.025em;
        scroll-margin-top: 24px;
      }

      article h2 {
        margin: 54px 0 18px;
        padding-top: 18px;
        border-top: 1px solid #e4e9f1;
        font-size: 27px;
      }

      article h2:first-child {
        margin-top: 0;
        padding-top: 0;
        border-top: 0;
      }

      article h3 {
        margin: 34px 0 12px;
        font-size: 20px;
      }

      article p,
      article li {
        color: #3c485d;
      }

      article strong {
        color: #172033;
      }

      article code {
        padding: 2px 6px;
        border: 1px solid #dae3ef;
        border-radius: 6px;
        background: #f2f5f9;
        color: #2f3b52;
        font-size: 0.9em;
        overflow-wrap: anywhere;
      }

      article ul,
      article ol {
        padding-left: 1.35rem;
      }

      article li + li {
        margin-top: 8px;
      }

      .table-scroll {
        width: 100%;
        margin: 20px 0 30px;
        overflow-x: auto;
        border-radius: 12px;
      }

      article table {
        width: 100%;
        margin: 0;
        border: 1px solid #dfe6ef;
        border-collapse: separate;
        border-spacing: 0;
        border-radius: 12px;
        overflow: hidden;
        font-size: 14px;
      }

      article th,
      article td {
        padding: 12px 13px;
        border-bottom: 1px solid #e6ebf2;
        text-align: left;
        vertical-align: top;
      }

      article th {
        background: #f2f5f9;
        color: #344054;
        font-size: 13px;
        font-weight: 800;
      }

      article tr:last-child td {
        border-bottom: 0;
      }

      article tbody tr:hover {
        background: #f9fbfd;
      }

      #conclusion + p {
        margin-top: 0;
        padding: 18px 20px;
        border-left: 4px solid #155eef;
        border-radius: 0 12px 12px 0;
        background: #eef4ff;
        color: #243b64;
        font-weight: 650;
      }

      #review-decisions + ol {
        display: grid;
        gap: 10px;
        padding: 0;
        list-style: none;
        counter-reset: decision;
      }

      #review-decisions + ol li {
        position: relative;
        min-height: 54px;
        margin: 0;
        padding: 14px 16px 14px 54px;
        border: 1px solid #dbe3ef;
        border-radius: 12px;
        background: #fbfcfe;
        counter-increment: decision;
      }

      #review-decisions + ol li::before {
        position: absolute;
        top: 13px;
        left: 14px;
        display: grid;
        width: 28px;
        height: 28px;
        place-items: center;
        border-radius: 9px;
        background: #172b4d;
        color: #ffffff;
        content: counter(decision);
        font-size: 13px;
        font-weight: 800;
      }

      #next-step + p {
        padding: 18px 20px;
        border: 1px solid #a7e0c5;
        border-radius: 12px;
        background: #effaf5;
        color: #17613f;
        font-weight: 700;
      }

      #unchanged + p:last-child {
        padding: 17px 20px;
        border: 1px solid #a7e0c5;
        border-radius: 12px;
        background: #effaf5;
        color: #17613f;
      }

      .footer {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        margin-top: 18px;
        padding: 0 4px;
        color: #667085;
        font-size: 12px;
      }

      .footer p {
        margin: 0;
      }

      @media (max-width: 900px) {
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .content-grid {
          grid-template-columns: 1fr;
        }

        .toc {
          position: static;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .toc-title {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 620px) {
        .page-shell {
          width: min(100% - 20px, 1240px);
          padding-top: 10px;
        }

        .hero,
        article {
          border-radius: 16px;
        }

        .metrics,
        .toc {
          grid-template-columns: 1fr;
        }

        .review-note {
          grid-template-columns: 1fr;
        }

        article table {
          min-width: 680px;
        }

        .footer {
          flex-direction: column;
        }
      }

      @media print {
        :root,
        body {
          background: #ffffff;
        }

        .page-shell {
          width: 100%;
          padding: 0;
        }

        .hero,
        article,
        .toc {
          box-shadow: none;
        }

        .toc {
          display: none;
        }

        .content-grid {
          display: block;
        }

        article {
          border: 0;
          padding: 30px 0;
        }

        a {
          color: inherit;
        }
      }
    </style>
  </head>
  <body>
    <main class="page-shell">
      <header class="hero">
        <p class="eyebrow">CLINICAL-MASTER-OED · WP-00 + WP-01A · 2026-09-04</p>
        <h1>마스터 오더 기본값<br />중간 검토 보고서</h1>
        <p class="hero-summary">
          522개 마스터 오더의 의미 완성도를 감사하고, 조사 근거가 연결된
          비적용 후보, 확정된 제품 결정과 다음 구현 단계를 한눈에 확인하는
          보고서다.
        </p>
        <div class="status-row" aria-label="보고서 상태">
          <span class="status-chip">제품 결정 완료</span>
          <span class="status-chip">앱·DB 미적용</span>
          <span class="status-chip">fallback 금지</span>
        </div>
        <div class="metrics" aria-label="핵심 지표">
          <div class="metric"><strong>522</strong><span>전체 감사 오더</span></div>
          <div class="metric"><strong>187</strong><span>검토 가능한 내용 후보</span></div>
          <div class="metric"><strong>335</strong><span>차단 유지 후보</span></div>
          <div class="metric"><strong>0</strong><span>앱·DB 적용 건수</span></div>
        </div>
      </header>

      <aside class="review-note" aria-label="검토 안내">
        <strong>현재 단계</strong>
        <span>
          제품 결정 6건과 WP-01B 계획·코드 감사가 끝났다. 다음 작업은 실패를
          빈 목록으로 숨기지 않는 조회 경로 구현이며, 앱·DB 변경은 아직 시작하지 않았다.
        </span>
      </aside>

      <div class="content-grid">
        <nav class="toc" aria-label="보고서 목차">
          <p class="toc-title">Contents</p>
          <a href="#conclusion">결론</a>
          <a href="#contract">확정한 기준</a>
          <a href="#audit">WP-00 감사</a>
          <a href="#candidates">WP-01A 후보</a>
          <a href="#review-decisions">확정된 결정 6개</a>
          <a href="#next-step">다음 스텝</a>
          <a href="#artifacts">검토 자료</a>
          <a href="#unchanged">미변경 범위</a>
        </nav>
        <article>${article}</article>
      </div>

      <footer class="footer">
        <p>CLAiR EMR · Clinical Master Order Execution Defaults</p>
        <p>
          원문:
          <a href="../../work/clinical-master/order-execution-defaults/WP-00-01A-mid-review-report.ko.md">WP-00·WP-01A 중간 검토 보고서</a>
        </p>
      </footer>
    </main>
  </body>
</html>
`;

await writeFile(OUTPUT_PATH, html);
console.log(OUTPUT_PATH);
