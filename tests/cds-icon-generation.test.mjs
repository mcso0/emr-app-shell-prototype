import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("Figma import and React generation preserve inner SVG geometry", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cds-icon-geometry-"));
  try {
    const input = path.join(dir, "figma.json");
    const assets = path.join(dir, "assets");
    const output = path.join(dir, "output");
    mkdirSync(assets);
    writeFileSync(input, JSON.stringify({ icons: [{
      categorySlug: "people-and-places", nameSlug: "map-pin",
      svg: '<svg width="24" height="24" viewBox="0 0 24 24"><g clip-path="url(#clip)"><rect width="8" height="12" fill="black"/></g><defs><clipPath id="clip"><rect width="24" height="24" fill="white"/></clipPath></defs></svg>',
    }] }));
    execFileSync(process.execPath, ["scripts/build-cds-icons.mjs", "--figma-json", input, "--assets-root", assets, "--output-root", output]);
    const raw = readFileSync(path.join(assets, "people-and-places/map-pin.svg"), "utf8");
    const generated = readFileSync(path.join(output, "people-and-places.tsx"), "utf8");
    for (const svg of [raw, generated]) {
      assert.match(svg, /<rect width="8" height="12" fill="currentColor"/);
      assert.match(svg, /<rect width="24" height="24" fill="currentColor"/);
    }
    assert.match(generated, /width=\{size\}/);
    assert.match(generated, /height=\{size\}/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
