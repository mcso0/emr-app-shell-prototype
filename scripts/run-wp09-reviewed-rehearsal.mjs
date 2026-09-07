// Operator transport only; never decides that a rehearsal or rollback passed.
// Use a separately reviewed, SHA-pinned local manifest. --check is read-only.
// The manifest contains no password. psql -W reads it directly from the terminal.
import { createHash } from "node:crypto";
import { readFileSync, openSync, closeSync, mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const [mode, manifestPath, expectedHash, ...extra] = process.argv.slice(2);
if (!["--check", "--run"].includes(mode) || !manifestPath || !/^[a-f0-9]{64}$/.test(expectedHash ?? "") || extra.length) {
  throw Error("usage: node scripts/run-wp09-reviewed-rehearsal.mjs --check|--run manifest.json reviewed-sha256");
}
const sha256 = value => createHash("sha256").update(value).digest("hex");
const bytes = readFileSync(manifestPath);
if (sha256(bytes) !== expectedHash) throw Error("reviewed_manifest_hash_mismatch");
const plan = JSON.parse(bytes);
if (Object.keys(plan).sort().join() !== "ca,host,outcomePath,projectRef,query,wrapper"
  || !/^[a-z0-9]{20}$/.test(plan.projectRef)
  || !/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(plan.host)) throw Error("invalid_rehearsal_manifest");
const destination = value => typeof value === "string" && /^\/tmp\/clair-oed-[a-zA-Z0-9_.-]+$/.test(value);
for (const file of [plan.ca, plan.query, plan.wrapper]) {
  if (!file || Object.keys(file).sort().join() !== "containerPath,path,sha256"
    || !isAbsolute(file.path) || !destination(file.containerPath)
    || !/^[a-f0-9]{64}$/.test(file.sha256) || sha256(readFileSync(file.path)) !== file.sha256) throw Error("reviewed_file_mismatch");
}
if (!destination(plan.outcomePath)
  || new Set([plan.ca.containerPath, plan.query.containerPath, plan.wrapper.containerPath, plan.outcomePath]).size !== 4) throw Error("invalid_output_paths");
const wrapper = readFileSync(plan.wrapper.path, "utf8");
const query = readFileSync(plan.query.path, "utf8");
if (!wrapper.includes(`\\ir ${plan.query.containerPath}\n`)
  || !wrapper.includes(`\\o ${plan.outcomePath}\n`)
  || !wrapper.includes("OED_REHEARSAL_ROLLED_BACK_REVIEW_REQUIRED")
  || !/false\) as outcome from actor;\s*$/.test(query)) throw Error("rehearsal_manifest_binding_mismatch");
console.log(JSON.stringify({ mode, manifestSha256: expectedHash, deadlineSeconds: 980, automaticRetry: false }));
if (mode === "--check") process.exit(0);
if (!process.stdin.isTTY) throw Error("interactive_password_terminal_required");
// Never inherit ambient libpq passwords, alternate service files or preloads.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("PG") && !["NODE_OPTIONS", "BASH_ENV", "ENV"].includes(name)));
const container = "supabase_db_emr-app-shell-prototype";
const docker = args => {
  const result = spawnSync("docker", args, { env, encoding: "utf8", timeout: 15000, maxBuffer: 100000 });
  if (result.error || result.status !== 0) throw Error("rehearsal_client_preparation_failed");
  return result.stdout.trim();
};
// A reviewed manifest can launch only once. A failed/unknown attempt requires
// fresh residue inspection and a newly reviewed manifest, never automatic replay.
closeSync(openSync(`${manifestPath}.attempted`, "wx", 0o600));
const attempt = mkdtempSync(join(dirname(manifestPath), "rehearsal-attempt-"));
const statusPath = join(attempt, "transport-status.json");
const logPath = join(attempt, "terminal-output.log");
const startedAt = new Date().toISOString();
const save = fields => writeFileSync(statusPath, JSON.stringify({ startedAt, manifestSha256: expectedHash, remoteOutcome: "UNKNOWN", automaticRetry: false, ...fields }, null, 2), { mode: 0o600 });
save({ transport: "PREPARING" });
try {
  for (const path of [plan.ca.containerPath, plan.query.containerPath, plan.wrapper.containerPath, plan.outcomePath]) {
    docker(["exec", container, "test", "!", "-e", path]);
  }
  for (const file of [plan.ca, plan.query, plan.wrapper]) {
    docker(["cp", file.path, `${container}:${file.containerPath}`]);
    if (docker(["exec", container, "sha256sum", file.containerPath]).split(/\s+/)[0] !== file.sha256) throw Error("container_copy_hash_mismatch");
  }
} catch (error) {
  save({ transport: "PREPARATION_FAILED", error: error.message });
  throw error;
}
const connection = `host=${plan.host} port=5432 dbname=postgres user=postgres.${plan.projectRef} sslmode=verify-full sslrootcert=${plan.ca.containerPath} connect_timeout=15 application_name=clair-oed-session-rehearsal`;
console.log(`One password prompt; maximum 16m20s. Evidence: ${attempt}`);
const child = spawn("docker", ["exec", "-it", container,
  "env", "-i", "PATH=/nix/var/nix/profiles/default/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  "TERM=xterm-256color", "PSQL_HISTORY=/dev/null", "PGPASSFILE=/dev/null",
  "timeout", "-s", "TERM", "-k", "5", "960", "psql", "-X", "-W", "-v", "ON_ERROR_STOP=1", "-P", "pager=off",
  "--dbname", connection, "-c", "SET SESSION default_transaction_read_only=on", "-f", plan.wrapper.containerPath],
{ env, stdio: ["inherit", "pipe", "pipe"] });
save({ transport: "RUNNING" });
let deadline = false; let interrupted = false; let killTimer; let tail = "";
const stop = () => { child.kill("SIGTERM"); killTimer ??= setTimeout(() => child.kill("SIGKILL"), 5000); };
const interrupt = () => { interrupted = true; stop(); };
process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
const timer = setTimeout(() => { deadline = true; stop(); }, 975000);
// Docker's TTY output contains the prompt and DB diagnostics, never the hidden
// password keystrokes. Input is inherited, not read, transformed or recorded.
for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
  process.stdout.write(chunk); appendFileSync(logPath, chunk, { mode: 0o600 });
  tail = (tail + chunk.toString()).slice(-16384);
});
const result = await new Promise(resolve => {
  child.once("error", () => resolve({ exitCode: null, signal: null, transport: "START_FAILED" }));
  child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
});
clearTimeout(timer); clearTimeout(killTimer);
process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
const transport = result.transport ?? (deadline ? "DEADLINE_EXCEEDED" : interrupted ? "INTERRUPTED" : result.exitCode === 0 ? "EXITED" : "FAILED");
save({ ...result, transport, finishedAt: new Date().toISOString(),
  reviewMarkerObserved: tail.includes("OED_REHEARSAL_ROLLED_BACK_REVIEW_REQUIRED"),
  failureMarkerObserved: tail.includes("OED_REHEARSAL_FAIL") });
console.log(`\nTransport ${transport}. Remote result/rollback still requires CSV validation and independent residue checks. No replay.`);
process.exitCode = transport === "EXITED" && !tail.includes("OED_REHEARSAL_FAIL") ? 0 : 1;
