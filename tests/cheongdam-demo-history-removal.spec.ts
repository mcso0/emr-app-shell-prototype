import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(`${dir}/${entry.name}`)
      : /\.(ts|tsx)$/.test(entry.name)
        ? [`${dir}/${entry.name}`]
        : [],
  );

test("the 시연 이력 archive storage is dropped", () => {
  const removal = readFileSync(
    "supabase/migrations/20261128150000_remove_cheongdam_demo_history_archive.sql",
    "utf8",
  );
  for (const statement of [
    "drop function if exists public.clair_read_cheongdam_demo_history(text, uuid);",
    "drop function if exists public.clair_activate_cheongdam_demo_history(text, jsonb);",
    "drop function if exists public.clair_retire_cheongdam_demo_history(text);",
    "drop function if exists private.clair_can_manage_cheongdam_demo_history();",
    "drop table if exists private.clair_cheongdam_demo_history_batches;",
  ]) {
    expect(removal).toContain(statement);
  }
});

test("no app source refers to the 시연 이력 archive", () => {
  for (const file of sources("src")) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(/demo-history|DemoHistory|cheongdam_demo_history|시연 이력/);
  }
});

test("the replay engine stays private and never commits on its own", () => {
  const engine = readFileSync("supabase/snippets/demo-data-pr-003_replay_engine.sql", "utf8");
  for (const name of ["as(text)", "shift(timestamptz, timestamptz, uuid)", "visit(jsonb)", "batch(jsonb, boolean)"]) {
    expect(engine).toContain(`revoke all on function private.clair_demo_replay_${name} from public, anon, authenticated, service_role;`);
  }
  expect(engine).not.toMatch(/^\s*commit\s*;/im);
  // Only the Cheongdam synthetic workspace is ever touched.
  expect(engine.match(/w constant text := '([^']+)'/g)?.every((line) => line.includes("workspace-clair-cheongdam"))).toBe(true);
});
