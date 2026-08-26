#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeOfficialVmdSourceUrl,
  spreadsheetSafeCsvCell,
} from "./lib/dispensing-order-artifact-safety.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workDir = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017",
);
const datasetDir = path.join(workDir, "datasets");
const reportMarkdownPath = path.join(workDir, "dispensing-order-master-report.md");
const reportHtmlPath = path.join(workDir, "dispensing-order-master-report.html");
const visualizationDir =
  "/Users/iseung-ug/.codex/visualizations/2026/08/25/01a03adf-e7f7-71a2-ab22-f3e807b1da1b";
const visualizationPath = path.join(
  visualizationDir,
  "clair-dispensing-order-master-v1.html",
);

const rows = JSON.parse(
  await readFile(path.join(datasetDir, "dispensing-order-master.v1.json"), "utf8"),
);
for (const row of rows) {
  row.evidence.spcUrl = normalizeOfficialVmdSourceUrl(row.evidence.spcUrl);
}
const summary = JSON.parse(
  await readFile(
    path.join(datasetDir, "dispensing-order-master.v1.summary.json"),
    "utf8",
  ),
);

const categoryKo = {
  anti_inflammatory_other: "기타 항염증",
  antimicrobial_antifungal: "항균·항진균",
  antiparasitic: "구충·외부기생충",
  cardiovascular: "심혈관",
  dermatology_topical: "피부 국소",
  emergency_supportive: "응급·지지",
  endocrine: "내분비",
  gastrointestinal: "위장관",
  immunomodulator: "면역조절",
  neurology_behavior: "신경·행동",
  ophthalmic_otic: "안과·이과",
  other: "기타",
  pain_nsaid: "통증·NSAID",
  respiratory: "호흡기",
  urinary: "비뇨기",
};
const routeKo = {
  oral: "경구",
  cutaneous: "피부",
  ophthalmic: "안과",
  otic: "이과",
  oromucosal: "구강점막",
  transdermal: "경피",
};

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function objectRows(object, labeler = (value) => value) {
  return Object.entries(object)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `| ${markdownCell(labeler(key))} | ${count} |`)
    .join("\n");
}

const markdown = `# CLAiR Evidence-Grounded Dispensing Order Master V1

Status: \`technical dataset and design report complete; clinical review and all persistent writes pending\`

> **Do not use for real clinical care.** All ${rows.length} final rows have
> \`clinicalUseAllowed = false\`. Dose, frequency, duration, quantity, repeats,
> instructions, and BUD remain null. UK product authorization does not establish
> Korean authorization or controlled-substance clearance.

## Executive Result

CLAiR now has an auditable initial funnel of ${summary.inputCandidateCount}
official-product candidates and a final technical dataset of
${summary.finalTechnicalValidatedCount} unique atomic dispensing-order profiles.
The final set meets the numeric dataset gate without promoting incomplete rows:
19 candidates remain in manual review and 13 were rejected because the official
SPC PDF was not directly available in the captured source path.

| Metric | Result |
| --- | ---: |
| Initial candidates | ${summary.inputCandidateCount} |
| Final technical passes | ${summary.finalTechnicalValidatedCount} |
| Manual-review candidates | ${summary.excludedCounts.needs_manual_review} |
| Source-unavailable rejections | ${summary.excludedCounts.rejected} |
| Unique stable IDs | ${summary.uniqueMasterOrderIdCount} |
| Unique canonical semantic keys | ${summary.uniqueCanonicalOrderKeyCount} |
| Unique official product IDs | ${summary.uniqueSourceProductIdCount} |
| Clinically active rows | ${summary.clinicalUseAllowedCount} |

## Evidence And Method

- Seven independent research workstreams used both Exa and ordinary web search.
  The ledger records 77 searches, 300 raw results, 112 reviewed decisions, 51
  accepted decisions, and 48 unique accepted URLs after cross-stream deduplication.
- Primary product discovery used the official UK Veterinary Medicines Directorate
  product database workbook captured on 2026-08-26. The workbook SHA-256 is
  \`1b0582b41d169f7d4792ff8091c92d32cf07858bc5cee630ff24b1e490fe2360\`.
- The workbook contained 5,293 current authorized product rows. The conservative
  dog/cat filter found 3,181 rows with SPC, active-substance, and form data; 302
  eligible non-vaccine dispensing-form profiles remained after exclusion rules.
- A balanced 140-row initial sample was selected. Official SPC PDFs were captured
  for 127 rows, text-extracted, and checked against both current and legacy SPC
  section numbering. Product identity, form, species, route, structured strength,
  evidence hash, and required section availability were validated deterministically.
- No dosing schedule was copied from a product label. No BUD, stability, Korean
  authorization, controlled status, or clinical review decision was inferred.

See the [source ledger](source-ledger.md), [field matrix](field-matrix.md), and
[dataset README](datasets/README.md) for the complete decision trail.

## Coverage

### Therapeutic review buckets

| Bucket | Count |
| --- | ---: |
${objectRows(summary.categories, (key) => `${categoryKo[key] ?? key} (\`${key}\`)`)}

### Routes

| Route | Count |
| --- | ---: |
${objectRows(summary.routes, (key) => `${routeKo[key] ?? key} (\`${key}\`)`)}

### Species and form breadth

- Species applicability references: dog ${summary.species.dog}, cat ${summary.species.cat}.
- Final products span ${Object.keys(summary.forms).length} official pharmaceutical
  form labels. Oral profiles dominate (${summary.routes.oral}/${rows.length}); the
  smaller ophthalmic, otic, cutaneous, transdermal, and oromucosal buckets remain
  visible rather than being coerced into the current four-route runtime type.
- Respiratory and emergency/supportive coverage are each one row. This is a known
  breadth limitation for clinical review, not a reason to add weakly evidenced rows.

## Canonical Atomic Key

The semantic duplicate key is deterministic and does not include a display name or
source product ID:

\`normalized ingredients | structured strengths | official dosage form | routes | species | manufactured\`

Stable record IDs use the official authority and product identity. A brand rename
therefore cannot silently create a new semantic identity, while two products with
different strengths, forms, routes, or species remain distinct.

## Clinical Safety State

Every final row is blocked by all four V1 activation reasons:

1. named veterinary clinical review missing;
2. Korean authorization not verified;
3. Korean controlled-substance screening missing; and
4. Korean display translation review missing.

Keyword-derived safety and monitoring flags are review-queue signals only. They are
not clinical decision support. Product packaged/open shelf-life fields are official
label extractions; they are not a lot expiry or compounded preparation BUD.

## Cross-System Design Result

The current generic master and runtime medication metadata cannot safely hold this
dataset. The runtime requires non-null dose defaults and supports only PO, IV, CRI,
and SC, while this set includes oral, cutaneous, ophthalmic, otic, oromucosal, and
transdermal products. The approved design direction is additive normalized product,
composition, applicability, evidence, regulatory-profile, and named-review tables.

A chart search selection creates no downstream artifact. Confirmation snapshots the
exact reviewed master/workspace/product revision plus clinician-entered prescription
values. One confirmed dispensing order creates one fulfillment work item and one
queue projection. Billing creates at most one candidate only on the trusted chart
billing action. Lot, expiry, opening/reconstitution time, BUD, checker, actual
quantity, substitution, and waste belong to a later immutable dispense event.

## Data Quality And Reproducibility

The repository validator enforces:

- at least 120 initial and 100 final records;
- zero duplicate master IDs, canonical keys, and source product IDs;
- required ingredient, strength, form, route, species, and official SPC evidence;
- zero clinical-use-enabled rows and zero CDS-enabled signals;
- null dose/frequency/duration/quantity/repeats/instructions/BUD;
- pending Korean authorization, controlled screening, translation, and named review;
- deterministic file fingerprints.

Rebuild and validate with:

\`node scripts/build-dispensing-order-master-v1.mjs\`

\`node scripts/validate-dispensing-order-master-v1.mjs\`

## Risks And Open Decisions

| Risk or gap | Current control | Required next decision |
| --- | --- | --- |
| No named Korean veterinarian review | All rows inactive | Review exact immutable revisions and record reviewer eligibility/decision |
| UK source jurisdiction | Korean authorization remains \`not_verified\` | Build and approve Korean regulatory mappings |
| Controlled status unscreened | Separate activation blocker | Approve a controlled-substance permission/audit design or exclude affected rows |
| Korean names are partial drafts | Translation status stays pending | Named bilingual clinical terminology review |
| 19 incomplete parses and 13 unavailable SPCs | Excluded from final | Manual primary-source recovery; never backfill by guessing |
| Current runtime route/default mismatch | No adoption or activation | Add nullable prescription input and reviewed route vocabulary |
| Current outbox has no worker | No external delivery claim | Implement and verify claim/retry/dead-letter semantics separately |
| Persistent targets are live/prod-bound | No write performed | Use exact approval packets, hashes, row counts, rollback, and stop conditions |

## Approval-Gated Next Actions

The following are separate actions and are not authorized by this report: creating
the additive Airtable schema or 100+ records; publishing to the private master;
applying a production migration/upsert; adopting into target workspaces; merging a
production-deploying change; transitioning a production alias; enabling a feature;
or exposing any row to real-patient clinical use.

## Fingerprints

| Artifact | SHA-256 |
| --- | --- |
| Final JSON | \`${summary.jsonSha256}\` |
| Final CSV | \`${summary.csvSha256}\` |
| VMD workbook snapshot | \`1b0582b41d169f7d4792ff8091c92d32cf07858bc5cee630ff24b1e490fe2360\` |
| Enriched 140-candidate dataset | \`f4466724f09a4317665bcf4efce5e3555621a20ee21ef02d8bcba6eca933dba1\` |

## Final Technical Dataset (${rows.length})

| ID | English product | Korean draft | Ingredients | Strength | Form | Route | Species | Category | Official SPC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| \`${markdownCell(row.masterOrderId)}\` | ${markdownCell(row.display.en)} | ${markdownCell(row.display.koDraft)} | ${markdownCell(row.product.normalizedActiveIngredients.join(", "))} | ${markdownCell(row.product.strength.expressions.map((value) => `${value.numeratorValue} ${value.numeratorUnit}${value.denominatorUnit ? `/${value.denominatorValue ?? 1} ${value.denominatorUnit}` : ""}`).join("; "))} | ${markdownCell(row.product.dosageForm)} | ${markdownCell(row.product.route.join(", "))} | ${markdownCell(row.product.targetSpecies.join(", "))} | ${markdownCell(row.product.coverageCategory)} | [source](${row.evidence.spcUrl}) |`,
  )
  .join("\n")}
`;

const reportRows = rows.map((row) => ({
  id: row.masterOrderId,
  name: row.display.en,
  ko: row.display.koDraft,
  koStatus: row.display.koStatus,
  ingredients: row.product.normalizedActiveIngredients,
  strengths: row.product.strength.expressions,
  form: row.product.dosageForm,
  routes: row.product.route,
  species: row.product.targetSpecies,
  category: row.product.coverageCategory,
  atcVet: row.product.atcVetCode,
  productId: row.product.sourceProductId,
  authorization: row.product.authorizationNumber,
  distribution: row.product.distributionCategory,
  shelfPackaged: row.handling.packagedShelfLife,
  shelfOpened: row.handling.shelfLifeAfterOpening,
  storage: row.handling.storageCodes,
  safety: row.safetyReviewSignals.safetyFlags,
  monitoring: row.safetyReviewSignals.monitoringFlags,
  source: row.evidence.spcUrl,
  sourceSha: row.evidence.spcDocumentSha256,
  sourcePages: row.evidence.spcPageCount,
  sourceRevision: row.evidence.spcRevisionRaw,
  fingerprint: row.canonicalOrderFingerprint,
  blocks: row.activationBlockReasons,
}));
const embeddedRows = JSON.stringify(reportRows).replaceAll("<", "\\u003c");
const embeddedSummary = JSON.stringify(summary).replaceAll("<", "\\u003c");
const embeddedCategoryKo = JSON.stringify(categoryKo);
const embeddedRouteKo = JSON.stringify(routeKo);
const embeddedNormalizeSourceUrl = normalizeOfficialVmdSourceUrl.toString();
const embeddedCsvCell = spreadsheetSafeCsvCell.toString();

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
  <title>CLAiR 조제 오더 마스터 V1 — 근거 원장</title>
  <style>
    :root{--paper:#f4f0e7;--paper-2:#e9e1d2;--ink:#17292b;--muted:#5d6c69;--line:#b8b09f;--accent:#d85d3f;--accent-2:#0a6a68;--safe:#2f6c50;--warn:#9a3f2a;--shadow:0 18px 45px rgba(28,42,41,.13);--serif:"Iowan Old Style","Palatino Linotype",Palatino,serif;--sans:"Avenir Next","Apple SD Gothic Neo","Noto Sans KR",sans-serif;--mono:"SFMono-Regular",Consolas,monospace}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--paper);font-family:var(--sans);line-height:1.5}body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.28;background-image:linear-gradient(rgba(23,41,43,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(23,41,43,.055) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(to bottom,#000,transparent 80%)}a{color:inherit}.skip{position:absolute;left:-999px}.skip:focus{left:1rem;top:1rem;background:#fff;padding:.75rem;z-index:20}.shell{max-width:1480px;margin:auto;padding:0 28px 80px}.mast{position:relative;min-height:520px;padding:38px 0 62px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:48px;align-items:end;border-bottom:2px solid var(--ink)}.eyebrow{font:700 .75rem/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent-2)}h1{margin:.65rem 0 1rem;max-width:900px;font:500 clamp(3.2rem,7vw,7.6rem)/.88 var(--serif);letter-spacing:-.055em}.deck{max-width:780px;font-size:1.08rem;color:var(--muted)}.stamp{justify-self:end;width:min(100%,420px);padding:24px;border:1px solid var(--ink);background:rgba(244,240,231,.9);box-shadow:12px 12px 0 var(--ink)}.stamp strong{display:block;font:600 1.35rem var(--serif);color:var(--warn)}.stamp p{margin:.7rem 0 0}.index-mark{position:absolute;right:0;top:34px;font:700 12rem/.8 var(--serif);color:rgba(23,41,43,.055);user-select:none}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--ink)}.metric{padding:30px 18px;border-right:1px solid var(--ink)}.metric:last-child{border-right:0}.metric b{display:block;font:500 clamp(2rem,4vw,4.4rem)/1 var(--serif)}.metric span{font:700 .72rem var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}section{padding:72px 0;border-bottom:1px solid var(--line)}.section-head{display:grid;grid-template-columns:160px minmax(0,780px);gap:28px;margin-bottom:36px}.section-no{font:700 .75rem var(--mono);letter-spacing:.12em;color:var(--accent)}h2{margin:0;font:500 clamp(2rem,4vw,4.5rem)/1 var(--serif);letter-spacing:-.03em}.lead{max-width:820px;color:var(--muted);font-size:1.05rem}.risk-grid,.method-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{padding:24px;border:1px solid var(--line);background:rgba(255,255,255,.22)}.card h3{margin:0 0 9px;font:600 1.2rem var(--serif)}.card p{margin:0;color:var(--muted)}.risk{border-top:5px solid var(--accent)}.coverage{display:grid;grid-template-columns:1.25fr .75fr;gap:42px}.bars{display:grid;gap:10px}.bar{display:grid;grid-template-columns:minmax(145px,230px) 1fr 40px;gap:12px;align-items:center;font-size:.9rem}.track{height:12px;background:var(--paper-2);border:1px solid var(--line)}.fill{display:block;height:100%;background:var(--accent-2)}.route-ring{display:grid;place-items:center;min-height:320px;border:1px solid var(--line);background:conic-gradient(var(--accent-2) 0 82.4%,var(--accent) 82.4% 91.7%,#427b95 91.7% 96.3%,#a98451 96.3% 100%);border-radius:50%;aspect-ratio:1;max-width:320px;margin:auto;box-shadow:inset 0 0 0 70px var(--paper)}.route-ring span{text-align:center;font:600 1rem var(--mono)}.toolbar{position:sticky;top:0;z-index:8;display:grid;grid-template-columns:minmax(220px,2fr) repeat(3,minmax(130px,1fr)) auto;gap:10px;padding:14px;margin:0 -14px 18px;background:rgba(244,240,231,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--ink)}input,select,button{min-height:44px;border:1px solid var(--ink);border-radius:0;background:var(--paper);color:var(--ink);padding:0 12px;font:600 .88rem var(--sans)}button{cursor:pointer;background:var(--ink);color:var(--paper)}button:hover{background:var(--accent-2)}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.result-line{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:12px;color:var(--muted)}.hash{font:600 .72rem var(--mono);overflow-wrap:anywhere}.table-wrap{overflow:auto;border:1px solid var(--ink);background:rgba(255,255,255,.18)}table{width:100%;border-collapse:collapse;min-width:1020px}th{position:sticky;top:72px;z-index:2;text-align:left;background:var(--ink);color:var(--paper);padding:12px;font:700 .7rem var(--mono);letter-spacing:.08em;text-transform:uppercase}td{padding:13px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:.88rem}tbody tr{cursor:pointer}tbody tr:hover{background:#fff8e8}.pill{display:inline-block;margin:2px 3px 2px 0;padding:3px 7px;border:1px solid currentColor;border-radius:999px;font:700 .68rem var(--mono);color:var(--accent-2)}.status{color:var(--warn)}dialog{width:min(760px,calc(100vw - 28px));max-height:88vh;border:1px solid var(--ink);padding:0;background:var(--paper);box-shadow:var(--shadow)}dialog::backdrop{background:rgba(10,25,27,.72)}.dialog-head{position:sticky;top:0;display:flex;justify-content:space-between;gap:20px;padding:20px 24px;background:var(--ink);color:var(--paper)}.dialog-head h3{margin:0;font:600 1.5rem var(--serif)}.close{min-width:44px;background:transparent;color:var(--paper);border-color:var(--paper)}.detail{padding:26px}.detail-grid{display:grid;grid-template-columns:170px 1fr;border-top:1px solid var(--line)}.detail-grid dt,.detail-grid dd{margin:0;padding:11px 0;border-bottom:1px solid var(--line)}.detail-grid dt{font:700 .7rem var(--mono);text-transform:uppercase;color:var(--muted)}.detail-grid dd{overflow-wrap:anywhere}.warning-box{margin:20px 0;padding:18px;border-left:6px solid var(--accent);background:#f5ded2}.sources{display:grid;grid-template-columns:1fr 1fr;gap:16px}.source-link{display:block;padding:18px;border:1px solid var(--line);text-decoration:none}.source-link:hover{border-color:var(--accent-2);background:rgba(255,255,255,.35)}footer{padding:42px 0;color:var(--muted);font-size:.85rem}.noscript{padding:20px;background:#f5ded2}.empty{padding:70px;text-align:center;color:var(--muted)}
    .toolbar{position:relative;top:auto;z-index:auto;backdrop-filter:none}th{position:static;top:auto;z-index:auto}
    @media(max-width:900px){.mast{grid-template-columns:1fr;min-height:auto}.stamp{justify-self:start}.metrics{grid-template-columns:1fr 1fr}.metric:nth-child(2){border-right:0}.coverage,.risk-grid,.method-grid,.sources{grid-template-columns:1fr}.toolbar{grid-template-columns:1fr 1fr;position:relative}.toolbar input{grid-column:1/-1}.section-head{grid-template-columns:1fr}.index-mark{display:none}.route-ring{min-height:250px;max-width:250px}.shell{padding-inline:18px}}
    @media(max-width:560px){h1{font-size:3.35rem}.metrics{grid-template-columns:1fr}.metric{border-right:0}.toolbar{grid-template-columns:1fr}.bar{grid-template-columns:125px 1fr 28px}.detail-grid{grid-template-columns:1fr}.detail-grid dt{border-bottom:0;padding-bottom:0}.detail-grid dd{padding-top:4px}.shell{padding-inline:14px}}
    @media(prefers-reduced-motion:no-preference){.mast>*{animation:rise .7s both}.mast>.stamp{animation-delay:.12s}@keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}}
    @media print{body:before,.toolbar,button,.index-mark{display:none}.shell{max-width:none}.mast{min-height:auto}section{break-inside:avoid}.table-wrap{overflow:visible}table{min-width:0;font-size:8pt}}
  </style>
</head>
<body>
  <a class="skip" href="#dataset">데이터셋으로 건너뛰기</a>
  <main class="shell">
    <header class="mast">
      <div><div class="eyebrow">CLARITY THROUGH EVIDENCE · 2026.08.26</div><h1>조제 오더<br>근거 원장</h1><p class="deck">공식 제품 근거에서 출발해 140개 후보를 108개 기술 검증 오더로 정제한 CLAiR V1 보고서. 임상 기본값을 만들지 않고, 모르는 값과 승인되지 않은 경계를 그대로 드러낸다.</p></div>
      <aside class="stamp" aria-label="안전 상태"><strong>임상 사용 금지 · 검토 대기</strong><p>108개 전부 비활성. 용량·빈도·기간·BUD 없음. 한국 허가·마약류·수의사 검토·국문 번역 승인이 남아 있다.</p></aside>
      <div class="index-mark" aria-hidden="true">01</div>
    </header>
    <div class="metrics" aria-label="핵심 지표">
      <div class="metric"><b>${summary.inputCandidateCount}</b><span>Initial candidates</span></div>
      <div class="metric"><b>${summary.finalTechnicalValidatedCount}</b><span>Technical passes</span></div>
      <div class="metric"><b>0</b><span>Duplicate keys</span></div>
      <div class="metric"><b>0</b><span>Clinically active</span></div>
    </div>

    <section aria-labelledby="method-title"><div class="section-head"><div class="section-no">01 / METHOD</div><div><h2 id="method-title">넓게 찾고,<br>보수적으로 남겼다.</h2><p class="lead">Exa와 일반 웹 검색의 7개 트랙, VMD 공식 제품 워크북, 127개 공식 SPC 원문을 하나의 감사 가능한 퍼널로 연결했다.</p></div></div><div class="method-grid"><article class="card"><h3>77 searches</h3><p>300개 원시 결과 중 112개 결정을 검토하고 48개 고유 URL을 채택했다.</p></article><article class="card"><h3>5,293 products</h3><p>공식 워크북에서 개·고양이, SPC, 성분, 제형 조건을 통과한 302개 모집단을 만들었다.</p></article><article class="card"><h3>127 SPC files</h3><p>콘텐츠 해시와 페이지 수를 고정하고 신·구 섹션 번호를 함께 파싱했다.</p></article></div></section>

    <section aria-labelledby="coverage-title"><div class="section-head"><div class="section-no">02 / COVERAGE</div><div><h2 id="coverage-title">구색보다<br>근거 밀도.</h2><p class="lead">부족한 영역을 감추지 않는다. 호흡기와 응급·지지는 각 1개뿐이며, 임상 검토가 이를 보강할지 결정해야 한다.</p></div></div><div class="coverage"><div class="bars" id="category-bars"></div><div><div class="route-ring"><span>경구 89<br>기타 경로 19</span></div></div></div></section>

    <section aria-labelledby="risk-title"><div class="section-head"><div class="section-no">03 / SAFETY</div><div><h2 id="risk-title">활성화는<br>네 겹으로 막혔다.</h2></div></div><div class="risk-grid"><article class="card risk"><h3>임상 검토</h3><p>이름이 확인된 적격 수의사의 불변 revision 검토가 없다.</p></article><article class="card risk"><h3>한국 규제</h3><p>영국 허가는 한국 허가가 아니다. 마약류 상태도 아직 스크리닝하지 않았다.</p></article><article class="card risk"><h3>처방 기본값</h3><p>용량·빈도·기간·수량·반복·BUD는 전부 null이며 차트에서 검토자가 입력한다.</p></article></div></section>

    <section id="dataset" aria-labelledby="dataset-title"><div class="section-head"><div class="section-no">04 / LEDGER</div><div><h2 id="dataset-title">108개 오더,<br>한 줄씩 추적.</h2><p class="lead">검색과 필터는 브라우저 안에서만 동작한다. 행을 선택하면 원본 SPC 해시, 안전 신호, 차단 사유까지 볼 수 있다.</p></div></div>
      <div class="toolbar" aria-label="데이터 필터">
        <input id="q" type="search" placeholder="제품·성분·ID 검색" aria-label="제품, 성분 또는 ID 검색">
        <select id="category" aria-label="분류 필터"><option value="">전체 분류</option></select>
        <select id="route" aria-label="경로 필터"><option value="">전체 경로</option></select>
        <select id="species" aria-label="종 필터"><option value="">전체 종</option><option value="dog">개</option><option value="cat">고양이</option></select>
        <button id="export" type="button">필터 CSV</button>
      </div>
      <div class="result-line"><strong id="result-count" aria-live="polite"></strong><span class="hash">JSON SHA-256 · ${summary.jsonSha256}</span></div>
      <div class="table-wrap"><table><thead><tr><th>제품 / 기술 ID</th><th>성분·강도</th><th>제형</th><th>경로</th><th>종</th><th>분류</th><th>상태</th></tr></thead><tbody id="rows"></tbody></table><div class="empty" id="empty" hidden>조건에 맞는 오더가 없어.</div></div>
      <noscript><div class="noscript">검색과 상세 보기를 사용하려면 JavaScript가 필요해. 원본 Markdown 보고서에는 108개 전체 목록이 포함돼 있어.</div></noscript>
    </section>

    <section aria-labelledby="design-title"><div class="section-head"><div class="section-no">05 / CONTRACT</div><div><h2 id="design-title">제품 사실과<br>처방 결정을 분리.</h2></div></div><div class="method-grid"><article class="card"><h3>Master</h3><p>제품·성분·강도·제형·종·근거·규제·수의사 검토를 정규화하고 revision을 고정한다.</p></article><article class="card"><h3>Chart</h3><p>선택은 아무 작업도 만들지 않는다. 확정 시에만 실제 처방값과 근거 revision을 불변 스냅샷한다.</p></article><article class="card"><h3>Dispense</h3><p>lot·expiry·개봉·BUD·실조제량·대체·폐기·검수자는 실행 이벤트에 남긴다.</p></article></div></section>

    <section aria-labelledby="source-title"><div class="section-head"><div class="section-no">06 / SOURCES</div><div><h2 id="source-title">원문으로<br>되돌아가는 길.</h2></div></div><div class="sources"><a class="source-link" href="https://www.vmd.defra.gov.uk/ProductInformationDatabase/" target="_blank" rel="noopener noreferrer"><strong>VMD Product Information Database ↗</strong><br><span>공식 제품·SPC 조회 원천</span></a><a class="source-link" href="https://www.ema.europa.eu/en/veterinary-regulatory-overview" target="_blank" rel="noopener noreferrer"><strong>EMA Veterinary Regulatory Overview ↗</strong><br><span>유럽 수의약품 규제 구조</span></a></div></section>

    <footer>CLAiR Clinical Master · dispensing-order-master-v1 · standalone evidence report · no network requests</footer>
  </main>

  <dialog id="detail-dialog" aria-labelledby="detail-title"><div class="dialog-head"><h3 id="detail-title"></h3><button class="close" id="close" type="button" aria-label="닫기">×</button></div><div class="detail" id="detail-body"></div></dialog>
  <script>
    const DATA=${embeddedRows};const SUMMARY=${embeddedSummary};const CATEGORY_KO=${embeddedCategoryKo};const ROUTE_KO=${embeddedRouteKo};
    const normalizeOfficialVmdSourceUrl=(${embeddedNormalizeSourceUrl});const csvCell=(${embeddedCsvCell});
    const el=(id)=>document.getElementById(id);const state={q:"",category:"",route:"",species:""};
    const strengthText=(items)=>items.map(v=>v.numeratorValue+" "+v.numeratorUnit+(v.denominatorUnit?"/"+(v.denominatorValue??1)+" "+v.denominatorUnit:"")).join(" · ");
    const durationText=(v)=>v?v.value+" "+v.unit:"—";
    const pill=(text)=>{const node=document.createElement("span");node.className="pill";node.textContent=text;return node};
    const cell=(text)=>{const node=document.createElement("td");node.textContent=text;return node};
    function option(select,value,label){const node=document.createElement("option");node.value=value;node.textContent=label;select.append(node)}
    [...new Set(DATA.map(r=>r.category))].sort().forEach(v=>option(el("category"),v,CATEGORY_KO[v]||v));
    [...new Set(DATA.flatMap(r=>r.routes))].sort().forEach(v=>option(el("route"),v,ROUTE_KO[v]||v));
    const maxCategory=Math.max(...Object.values(SUMMARY.categories));
    Object.entries(SUMMARY.categories).sort((a,b)=>b[1]-a[1]).forEach(([key,count])=>{const row=document.createElement("div");row.className="bar";const label=document.createElement("span");label.textContent=CATEGORY_KO[key]||key;const track=document.createElement("span");track.className="track";const fill=document.createElement("span");fill.className="fill";fill.style.width=(count/maxCategory*100)+"%";track.append(fill);const number=document.createElement("b");number.textContent=count;row.append(label,track,number);el("category-bars").append(row)});
    function filtered(){const q=state.q.trim().toLowerCase();return DATA.filter(r=>(!q||[r.id,r.name,r.ko,r.productId,...r.ingredients].join(" ").toLowerCase().includes(q))&&(!state.category||r.category===state.category)&&(!state.route||r.routes.includes(state.route))&&(!state.species||r.species.includes(state.species)))}
    function render(){const rows=filtered();const body=el("rows");body.replaceChildren();el("result-count").textContent=rows.length+" / "+DATA.length+"개 표시";el("empty").hidden=rows.length!==0;for(const row of rows){const tr=document.createElement("tr");tr.tabIndex=0;tr.setAttribute("role","button");tr.setAttribute("aria-label",row.name+" 상세 보기");const name=document.createElement("td");const strong=document.createElement("strong");strong.textContent=row.name;const small=document.createElement("div");small.className="hash";small.textContent=row.id;name.append(strong,small);tr.append(name,cell(row.ingredients.join(", ")+" · "+strengthText(row.strengths)),cell(row.form));for(const values of [row.routes.map(v=>ROUTE_KO[v]||v),row.species.map(v=>v==="dog"?"개":"고양이")]){const td=document.createElement("td");values.forEach(v=>td.append(pill(v)));tr.append(td)}tr.append(cell(CATEGORY_KO[row.category]||row.category));const status=document.createElement("td");status.className="status";status.textContent="비활성 · 검토 대기";tr.append(status);tr.addEventListener("click",()=>openDetail(row));tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDetail(row)}});body.append(tr)}}
    function detailRow(term,value){const dt=document.createElement("dt");dt.textContent=term;const dd=document.createElement("dd");if(value instanceof Node)dd.append(value);else dd.textContent=value;return[dt,dd]}
    function openDetail(row){el("detail-title").textContent=row.name;const body=el("detail-body");body.replaceChildren();const warning=document.createElement("div");warning.className="warning-box";warning.innerHTML="<strong>임상 사용 금지</strong><br>이 기술 레코드는 수의사·한국 규제·마약류·국문 번역 검토 전이며 처방 기본값을 제공하지 않아.";const dl=document.createElement("dl");dl.className="detail-grid";const source=document.createElement("a");source.href=row.source;source.target="_blank";source.rel="noopener noreferrer";source.textContent="공식 VMD SPC 열기 ↗";const items=[["한국어 초안",row.ko],["성분",row.ingredients.join(", ")],["강도",strengthText(row.strengths)],["제형",row.form],["경로",row.routes.map(v=>ROUTE_KO[v]||v).join(", ")],["대상 종",row.species.map(v=>v==="dog"?"개":"고양이").join(", ")],["ATCvet",row.atcVet||"—"],["VMD 제품 ID",row.productId],["허가번호",row.authorization||"—"],["유통 분류",row.distribution||"—"],["포장 상태 유효기간",durationText(row.shelfPackaged)],["개봉 후 유효기간",durationText(row.shelfOpened)],["보관 코드",row.storage.join(", ")||"—"],["안전 검토 신호",row.safety.join(", ")||"—"],["모니터링 신호",row.monitoring.join(", ")||"—"],["활성화 차단",row.blocks.join(" · ")],["SPC",source],["SPC SHA-256",row.sourceSha],["페이지",String(row.sourcePages)],["원문 revision",row.sourceRevision||"—"],["정규 키 지문",row.fingerprint]];items.forEach(([term,value])=>dl.append(...detailRow(term,value)));body.append(warning,dl);el("detail-dialog").showModal()}
    for(const id of ["q","category","route","species"]){el(id).addEventListener("input",e=>{state[id]=e.target.value;render()})}
    el("close").addEventListener("click",()=>el("detail-dialog").close());el("detail-dialog").addEventListener("click",e=>{if(e.target===el("detail-dialog"))el("detail-dialog").close()});
    el("export").addEventListener("click",()=>{const header=["id","name","ingredients","strength","form","route","species","category","source"];const csv=[header,...filtered().map(r=>[r.id,r.name,r.ingredients.join(";"),strengthText(r.strengths),r.form,r.routes.join(";"),r.species.join(";"),r.category,r.source])].map(row=>row.map(csvCell).join(",")).join("\\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="clair-dispensing-order-filtered.csv";a.click();URL.revokeObjectURL(url)});
    render();
  </script>
</body>
</html>`;

await mkdir(visualizationDir, { recursive: true });
await Promise.all([
  writeFile(reportMarkdownPath, markdown),
  writeFile(reportHtmlPath, html),
  writeFile(visualizationPath, html),
]);

console.log(
  JSON.stringify(
    {
      markdown: reportMarkdownPath,
      html: reportHtmlPath,
      visualization: visualizationPath,
      rows: rows.length,
      jsonSha256: summary.jsonSha256,
    },
    null,
    2,
  ),
);
