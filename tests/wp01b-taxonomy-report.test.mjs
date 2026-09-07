import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPackage, loadInputs, base } from "../scripts/generate-wp01b-taxonomy-mapping.mjs";
import { renderReport, reportPath } from "../scripts/render-wp01b-taxonomy-report.mjs";
const data = buildPackage(loadInputs());
const markdown = fs.readFileSync(base + "wp-01b/slice-03-taxonomy-mapping.md", "utf8");
const html = renderReport(data, markdown);
test("report materializes all522 identities and is deterministic", () => {
  assert.equal([...html.matchAll(/data-order="/g)].length, 522);
  assert.equal(html, fs.readFileSync(reportPath, "utf8"));
  for (const row of data.mapping.rows) assert.ok(html.includes(`data-order="${row.orderId}"`));
});
test("all local links and next-step anchors resolve", () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.equal(links.length, 9);
  for (const link of links) assert.ok(link.startsWith("#") ? ids.has(link.slice(1)) : fs.existsSync(path.resolve(path.dirname(reportPath), link)), link);
  assert.match(html, /id="section-6">다음 작업/);
});
test("untrusted order names are escaped and Korean copy is required", () => {
  const copy = structuredClone(data);
  copy.mapping.rows[0].displayName = '<script>alert("test")</script>';
  const escaped = renderReport(copy, markdown);
  assert.ok(!escaped.includes('<script>alert("test")</script>'));
  assert.ok(escaped.includes("&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;"));
  assert.throws(() => renderReport(data, "No reviewed copy"), /Missing reviewed Korean copy/);
});
