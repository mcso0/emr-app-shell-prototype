import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const args = process.argv.slice(2);
const container = args[args.indexOf("--container") + 1];
const database = args[args.indexOf("--database") + 1];
if (!args.includes("--container") || !args.includes("--database")
  || !/^chart-pr037-[a-z0-9-]+$/.test(container ?? "") || !/^chart_pr037_[a-z0-9_]+$/.test(database ?? "")) {
  throw new Error("Supply explicitly owned --container chart-pr037-* --database chart_pr037_*. Shared DBs are forbidden.");
}
const migration = readFileSync(resolve("supabase/migrations/20260908211856_encounter_multi_chart.sql"), "utf8");
const fixtures = readdirSync("tests/sql").filter((name) => /^encounter_multi_chart_.*_contract\.sql$/.test(name)).sort();
for (const fixture of fixtures) {
  const beforePath = resolve("tests/sql", fixture.replace("_contract.sql", ".before.sql"));
  const before = existsSync(beforePath) ? readFileSync(beforePath, "utf8") : "";
  const sql = `\\set ON_ERROR_STOP on\nbegin;\n${before}\n${migration}\n${readFileSync(resolve("tests/sql", fixture), "utf8").replace(/^begin;\s*$/m, "").replace(/^rollback;\s*$/mi, "set constraints all immediate;\nrollback;")}`;
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const expected = `PASS ${fixture.replace(/\.sql$/, "")}`;
  if (result.status !== 0 || !result.stdout.includes(expected) || !result.stdout.includes("ROLLBACK")) {
    process.stderr.write(result.stdout.slice(-3000) + result.stderr.slice(-5000));
    throw new Error(`${fixture} failed or lacked its explicit completion/rollback marker`);
  }
  console.log(expected);
}
