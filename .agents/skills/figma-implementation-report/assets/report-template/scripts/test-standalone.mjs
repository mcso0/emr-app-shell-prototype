import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const reportPath = join(root, "dist", "report.html");
const report = await readFile(reportPath, "utf8");
const reportStat = await stat(reportPath);

assert.equal(
  (report.match(/<script\b[^>]*\bsrc=/g) ?? []).length,
  0,
  "must not contain external scripts",
);
assert.equal(
  (report.match(/<link\b[^>]*\brel=["']stylesheet["']/g) ?? []).length,
  0,
  "must not contain external stylesheets",
);
assert.equal(
  (report.match(/<script type="module">/g) ?? []).length,
  1,
  "must contain one inline module script",
);
assert.match(
  report,
  /<div id="root"><\/div>/,
  "must preserve the React mount element",
);
assert.doesNotMatch(
  report,
  /(?:src|href)=["'](?:https?:|\/assets\/)/,
  "must not reference runtime assets",
);
assert.doesNotMatch(
  report,
  /url\(["']?(?:https?:|\/assets\/)/,
  "CSS must not reference runtime assets",
);
assert.match(
  report,
  /id="figma-implementation-contract" type="application\/json"/,
  "must embed the contract",
);
assert.match(report, /수정 명세/, "must include the change specification view");
assert.match(
  report,
  /컴포넌트 · 토큰/,
  "must include the component and token view",
);
assert.match(
  report,
  /인터랙티브 시안/,
  "must include the interactive prototype view",
);
assert.ok(
  reportStat.size < 5 * 1024 * 1024,
  "standalone report should remain below 5 MB",
);

console.log(
  `Standalone report structure: ok (${Math.round(reportStat.size / 1024)} KB)`,
);
