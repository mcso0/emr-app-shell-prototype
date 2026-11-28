import { expect, test } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const script = "scripts/demo-data/cheongdam-chart-images.mjs";
const run = (...args: string[]) => execFileSync("node", [script, ...args], { encoding: "utf8" });
const attachmentIds = (sql: string) => [...new Set(sql.match(/49136000-0000-4000-8000-\d{12}/g))];

test("the attach block covers every planned image and rolls back by default", async () => {
  const { visits } = (await import("../scripts/demo-data/cheongdam-chart-history.data.mjs")) as {
    visits: { img?: [string, string][] }[];
  };
  const captions = visits.flatMap((visit) => (visit.img ?? []).map(([, caption]) => caption));
  const sql = run("sql");

  expect(captions).toHaveLength(15);
  expect(attachmentIds(sql)).toHaveLength(15);
  for (const caption of captions) expect(sql).toContain(`"caption":"${caption}"`);
  expect(sql).toContain("dry constant boolean := true;");
  expect(sql).toContain("stand_in constant boolean := false;");
  // The chart guards stay on: the editor capability is set, triggers are off only for the timestamp restore.
  expect(sql).toContain("set_config('clair.soap_editor_capability', 'media_table_v1', true)");
  expect(sql.match(/set local session_replication_role = replica;/g)).toHaveLength(1);
  expect(sql).not.toMatch(/set\s+status|status\s*=\s*'amended'/);
});

test("the committed snippets match the generator", () => {
  expect(readFileSync("supabase/snippets/demo-data-pr-003_chart_images_attach.sql", "utf8")).toBe(run("sql"));
  expect(readFileSync("supabase/snippets/demo-data-pr-003_chart_images_revert.sql", "utf8")).toBe(run("sql", "--revert"));
});

test("placeholder storage rows and remote uploads need an explicit choice", () => {
  expect(run("sql", "--apply")).toContain("dry constant boolean := false;");
  expect(spawnSync("node", [script, "sql", "--apply", "--stand-in"]).status).toBe(1);

  const upload = spawnSync("node", [script, "upload", "missing-dir"], {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_URL: "https://project.example", SUPABASE_SERVICE_ROLE_KEY: "placeholder" },
  });
  expect(upload.status).toBe(1);
  expect(upload.stderr).toContain("refusing non-local target");
});
