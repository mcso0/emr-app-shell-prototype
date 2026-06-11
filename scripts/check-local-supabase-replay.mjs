#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const runReadback = args.has("--readback");
const showHelp = args.has("--help") || args.has("-h");
const localDbUrl =
  process.env.SUPABASE_LOCAL_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function printHelp() {
  console.log(`Local Supabase replay checker

Usage:
  node scripts/check-local-supabase-replay.mjs
  node scripts/check-local-supabase-replay.mjs --readback

Default mode is read-only diagnostics. It does not reset or mutate a database.
--readback runs supabase/snippets/demo_seed_inventory_readback.sql against SUPABASE_LOCAL_DB_URL.

Remote/prod guard:
  SUPABASE_LOCAL_DB_URL must point to localhost, 127.0.0.1, or ::1.
`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    timeout: options.timeout ?? 15_000,
  });
}

function hasCommand(command) {
  const result = run("bash", ["-lc", `command -v ${command}`], { timeout: 5_000 });
  return result.status === 0;
}

function isLocalDbUrl(url) {
  return /@(localhost|127\.0\.0\.1|\[?::1\]?)(:|\/)/.test(url);
}

function printCheck(label, ok, detail) {
  const marker = ok ? "PASS" : "GAP";
  console.log(`[${marker}] ${label}${detail ? ` - ${detail}` : ""}`);
}

function readConfig() {
  try {
    return readFileSync("supabase/config.toml", "utf8");
  } catch {
    return null;
  }
}

function classifyReadbackFailure(result) {
  const output = `${result.stdout}\n${result.stderr}`;

  if (/connection refused|could not connect|No such file or directory/i.test(output)) {
    return "environment_gap: local Postgres is not reachable. Run `npx supabase start` or `npx supabase db reset --local` after Docker is running.";
  }

  if (/relation .* does not exist|schema .* does not exist|function .* does not exist/i.test(output)) {
    return "environment_gap: migrations/schema are not applied to the local database. Run `npx supabase db reset --local` before readback.";
  }

  if (/permission denied|password authentication failed/i.test(output)) {
    return "environment_gap: local database credentials or port do not match SUPABASE_LOCAL_DB_URL.";
  }

  return "seed_or_sql_gap: readback SQL executed unsuccessfully. Inspect psql output for failing coverage rows or SQL errors.";
}

function inspectReadbackOutput(stdout) {
  const compact = stdout.replace(/\s+/g, " ");
  const baselineFailureMatch = compact.match(/"baselineFailureCount"\s*:\s*(\d+)/);
  const knownGapMatch = compact.match(/"knownGapCount"\s*:\s*(\d+)/);
  const hasFail = /"status"\s*:\s*"fail"/.test(compact);
  const hasGap = /"status"\s*:\s*"gap"/.test(compact);

  return {
    baselineFailureCount: baselineFailureMatch ? Number(baselineFailureMatch[1]) : null,
    knownGapCount: knownGapMatch ? Number(knownGapMatch[1]) : null,
    hasFail,
    hasGap,
  };
}

if (showHelp) {
  printHelp();
  process.exit(0);
}

console.log("Local Supabase replay diagnostics for clair-demo synthetic seed.");
console.log("Scope: local/dev/test only. No remote Supabase commands are executed.");

const config = readConfig();
printCheck("supabase/config.toml exists", Boolean(config));
if (config) {
  printCheck(
    "db.seed is enabled",
    /\[db\.seed\][\s\S]*?enabled\s*=\s*true/.test(config),
    "expected local reset to apply seed files",
  );
  printCheck(
    "db.seed.sql_paths includes ./seed.sql",
    /\[db\.seed\][\s\S]*?sql_paths\s*=\s*\[[^\]]*"\.\/seed\.sql"[^\]]*\]/.test(config),
    "expected supabase/seed.sql as deterministic demo seed",
  );
}

const dockerInstalled = hasCommand("docker");
printCheck("docker CLI is installed", dockerInstalled);
if (dockerInstalled) {
  const dockerInfo = run("docker", ["info", "--format", "{{.ServerVersion}}"], {
    timeout: 10_000,
  });
  printCheck(
    "Docker daemon is reachable",
    dockerInfo.status === 0,
    dockerInfo.status === 0
      ? `server ${dockerInfo.stdout.trim()}`
      : "start Docker Desktop, then rerun this helper",
  );
}

const supabaseInstalled = hasCommand("supabase");
printCheck("supabase CLI is installed", supabaseInstalled);
if (supabaseInstalled) {
  const version = run("supabase", ["--version"], { timeout: 10_000 });
  printCheck(
    "supabase CLI responds",
    version.status === 0,
    version.status === 0 ? version.stdout.trim() : "run `supabase --help` locally to diagnose CLI install",
  );
}

const psqlInstalled = hasCommand("psql");
printCheck("psql CLI is installed", psqlInstalled);
printCheck(
  "SUPABASE_LOCAL_DB_URL is local-only",
  isLocalDbUrl(localDbUrl),
  localDbUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@"),
);

console.log("\nRecommended local replay commands:");
console.log("  npx supabase start");
console.log("  npx supabase db reset --local");
console.log("  node scripts/check-local-supabase-replay.mjs --readback");
console.log("  npx playwright test tests/demo-seed-inventory-readback-contract.spec.ts --reporter=line");

if (!runReadback) {
  console.log("\nReadback not run. Add --readback after local Supabase is running.");
  process.exit(0);
}

if (!psqlInstalled) {
  console.error("\n[BLOCKED] environment_gap: psql CLI is required for --readback.");
  process.exit(2);
}

if (!isLocalDbUrl(localDbUrl)) {
  console.error("\n[BLOCKED] remote_guard: refusing to run readback against a non-local database URL.");
  process.exit(2);
}

const readback = run(
  "psql",
  [
    localDbUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "supabase/snippets/demo_seed_inventory_readback.sql",
  ],
  { timeout: 30_000 },
);

if (readback.status !== 0) {
  console.error(`\n[FAILED] ${classifyReadbackFailure(readback)}`);
  if (readback.stderr.trim()) console.error(readback.stderr.trim());
  process.exit(1);
}

const summary = inspectReadbackOutput(readback.stdout);
console.log(readback.stdout.trim());

if (summary.baselineFailureCount === 0 && summary.knownGapCount === 0 && !summary.hasFail && !summary.hasGap) {
  console.log("\n[PASS] demo seed readback passed with no baseline failures or known gaps.");
  process.exit(0);
}

console.error(
  `\n[FAILED] seed_gap: baselineFailureCount=${summary.baselineFailureCount ?? "unknown"}, knownGapCount=${summary.knownGapCount ?? "unknown"}.`,
);
process.exit(1);
