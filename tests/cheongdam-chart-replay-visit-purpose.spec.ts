import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ReplayVisit = { pat: string; at: string; purpose: string; cc?: string };

const categoryWords = ["진료", "재진", "예방접종", "상담", "정기 검진"];

test("replay input carries a reception sentence as the visit purpose", () => {
  const out = mkdtempSync(join(tmpdir(), "cheongdam-replay-"));
  execFileSync("node", ["scripts/demo-data/build-cheongdam-chart-replay.mjs", out, "4"]);
  const visits = readdirSync(out)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => JSON.parse(readFileSync(join(out, name), "utf8")) as ReplayVisit[]);

  expect(visits).toHaveLength(69);
  for (const visit of visits) {
    const label = `${visit.pat} ${visit.at}`;
    expect(categoryWords, label).not.toContain(visit.purpose);
    expect(visit.purpose.length, label).toBeGreaterThanOrEqual(15);
    // Reception stores the purpose in both columns; a separate complaint would overwrite one of them.
    expect(visit, label).not.toHaveProperty("cc");
  }
  expect(new Set(visits.map((visit) => visit.purpose)).size).toBe(69);
});

test("the replay engine leaves the reception text in both encounter columns", () => {
  const engine = readFileSync("supabase/snippets/demo-data-pr-003_replay_engine.sql", "utf8");
  expect(engine).toContain("'visitPurpose', v->>'purpose'");
  expect(engine).not.toMatch(/update public\.encounters set (chief_complaint|visit_purpose)/);
});

test("the hosted correction writes the same sentences as the data file", async () => {
  const { visits } = (await import("../scripts/demo-data/cheongdam-chart-history.data.mjs")) as {
    visits: { purpose: string }[];
  };
  const fix = readFileSync("supabase/snippets/demo-data-pr-003_visit_purpose_update.sql", "utf8");
  for (const visit of visits) expect(fix).toContain(`'${visit.purpose}')`);
  expect(fix).toContain("set visit_purpose = s.purpose, chief_complaint = s.purpose");
  expect(fix).toContain("e.workspace_id = 'workspace-clair-cheongdam'");
});
