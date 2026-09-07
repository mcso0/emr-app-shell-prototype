import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const sha = value => createHash("sha256").update(value).digest("hex");
const runner = resolve("scripts/run-wp09-reviewed-rehearsal.mjs");
const directory = mkdtempSync(join(tmpdir(), "wp09-runner-contract-"));
const file = (name, content) => {
  const path = join(directory, name); writeFileSync(path, content, { mode: 0o600 });
  return { path, containerPath: `/tmp/clair-oed-test-${name}`, sha256: sha(content) };
};
const query = file("query.sql", "select helper('{}', 'hash', false) as outcome from actor;\n");
const outcomePath = "/tmp/clair-oed-test-outcome.csv";
const plan = { projectRef: "abcdefghijklmnopqrst", host: "aws-1-ap-southeast-2.pooler.supabase.com",
  query, outcomePath, ca: file("ca.crt", "fixture only, never connect"),
  wrapper: file("wrapper.psql", `\\o ${outcomePath}\n\\ir ${query.containerPath}\n\\echo OED_REHEARSAL_ROLLED_BACK_REVIEW_REQUIRED\n`) };
const manifest = join(directory, "manifest.json");
const invoke = (value = plan, mode = "--check", hash) => {
  const data = JSON.stringify(value); writeFileSync(manifest, data, { mode: 0o600 });
  return spawnSync(process.execPath, [runner, mode, manifest, hash ?? sha(data)], { encoding: "utf8", timeout: 5000 });
};
test("check verifies files without invoking Docker or creating attempt artifacts", () => {
  const before = readdirSync(directory).filter(name => name !== "manifest.json");
  const result = invoke(); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(directory).filter(name => name !== "manifest.json"), before);
  assert.match(result.stdout, /"automaticRetry":false/);
});
test("wrong manifest hash rejects before actions", () => {
  assert.match(invoke(plan, "--check", "0".repeat(64)).stderr, /reviewed_manifest_hash_mismatch/);
});
test("password-bearing or unknown manifest keys reject", () => {
  assert.match(invoke({ ...plan, password: "synthetic-test-not-a-secret" }).stderr, /invalid_rehearsal_manifest/);
});
test("non-Supabase host, mismatched artifact, and output collision reject", () => {
  assert.match(invoke({ ...plan, host: "example.com" }).stderr, /invalid_rehearsal_manifest/);
  assert.match(invoke({ ...plan, ca: { ...plan.ca, sha256: "0".repeat(64) } }).stderr, /reviewed_file_mismatch/);
  assert.match(invoke({ ...plan, outcomePath: query.containerPath }).stderr, /invalid_output_paths/);
});
test("true apply query rejects even with matching reviewed bytes", () => {
  const apply = file("apply.sql", "select helper('{}', 'hash', true) as outcome from actor;\n");
  assert.match(invoke({ ...plan, query: apply }).stderr, /rehearsal_manifest_binding_mismatch/);
});
test("noninteractive run fails before one-shot marker or Docker", () => {
  assert.match(invoke(plan, "--run").stderr, /interactive_password_terminal_required/);
  assert.ok(!readdirSync(directory).some(name => /attempt/.test(name)));
});
test("unknown execution mode rejects", () => {
  assert.match(invoke(plan, "--apply").stderr, /usage:/);
});
test("transport keeps verified TLS and has both finite client deadlines", () => {
  const source = readFileSync(runner, "utf8");
  assert.match(source, /sslmode=verify-full/);
  assert.match(source, /"env", "-i", "PATH=/);
  assert.match(source, /"PGPASSFILE=\/dev\/null"/);
  assert.match(source, /"timeout", "-s", "TERM", "-k", "5", "960"/);
  assert.match(source, /975000/);
  assert.match(source, /remoteOutcome: "UNKNOWN"/);
  assert.match(source, /openSync\(`\$\{manifestPath\}\.attempted`, "wx"/);
});

// macOS script provides a synthetic TTY. Every Docker invocation is replaced by
// a local fixture executable: no database, network, password or real container.
let tty;
if (process.platform === "darwin") {
  try { tty = openSync("/dev/tty", "r"); } catch { /* Non-TTY CI runs only the read-only checks. */ }
}
process.once("exit", () => { if (tty !== undefined) closeSync(tty); });
for (const scenario of ["exit", "failure", "interrupt", "deadline"]) {
  test(`mock TTY transport ${scenario} stays UNKNOWN and refuses replay`, { skip: tty === undefined }, () => {
    const fixture = mkdtempSync(join(tmpdir(), "wp09-runner-tty-"));
    const bin = join(fixture, "bin"); mkdirSync(bin);
    const mock = `#!${process.execPath}
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(process.env.WP09_MOCK_MANIFEST,'utf8'));
const a=process.argv.slice(2);
if(a.includes('sha256sum')){
 const f=[p.ca,p.query,p.wrapper].find(x=>x.containerPath===a.at(-1));
 console.log(f.sha256+'  '+f.containerPath);
}else if(a.includes('-it')){
 if(!a.includes('env')||!a.includes('-i'))process.exit(9);
 const scenario=process.env.WP09_MOCK_SCENARIO;
 if(scenario==='exit')console.log('OED_REHEARSAL_ROLLED_BACK_REVIEW_REQUIRED');
 else if(scenario==='failure'){console.log('OED_REHEARSAL_FAIL stage=rehearsal sqlstate=23514');process.exitCode=0;}
 else {
   process.on('SIGTERM',()=>process.exit(143));
   if(scenario==='interrupt')setTimeout(()=>process.kill(process.ppid,'SIGINT'),50);
   setInterval(()=>{},1000);
 }
}
`;
    writeFileSync(join(bin, "docker"), mock, { mode: 0o700 });
    const localManifest = join(fixture, "manifest.json");
    const data = JSON.stringify(plan); writeFileSync(localManifest, data, { mode: 0o600 });
    let executable = runner;
    if (scenario === "deadline") {
      // Accelerate only the host clock for this isolated mechanism test; the
      // shipped literal975000 and BusyBox timeout are checked separately above.
      executable = join(fixture, "accelerated-runner.mjs");
      writeFileSync(executable, readFileSync(runner, "utf8").replace("}, 975000)", "}, 150)"));
    }
    const run = () => spawnSync("script", ["-q", "/dev/null", process.execPath, executable, "--run", localManifest, sha(data)],
      { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, WP09_MOCK_MANIFEST: localManifest, WP09_MOCK_SCENARIO: scenario }, stdio: [tty, "pipe", "pipe"], encoding: "utf8", timeout: 12000 });
    const result = run(); assert.ok(!result.error, result.error?.message);
    const attempts = readdirSync(fixture).filter(x => x.startsWith("rehearsal-attempt-"));
    assert.equal(attempts.length, 1, result.stdout + result.stderr);
    const status = JSON.parse(readFileSync(join(fixture, attempts[0], "transport-status.json"), "utf8"));
    assert.equal(status.remoteOutcome, "UNKNOWN");
    assert.equal(status.automaticRetry, false);
    assert.equal(status.transport, { exit: "EXITED", failure: "EXITED", interrupt: "INTERRUPTED", deadline: "DEADLINE_EXCEEDED" }[scenario]);
    if (scenario === "failure") assert.equal(status.failureMarkerObserved, true);
    const replay = run(); assert.match(replay.stdout + replay.stderr, /EEXIST/);
    assert.equal(readdirSync(fixture).filter(x => x.startsWith("rehearsal-attempt-")).length, 1);
  });
}
