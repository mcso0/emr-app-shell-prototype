import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildIntake, buildPacket, buildTraceExample, runEval } from "../scripts/owner-os.mjs";

test("approved routing cases exercise actual helper output", () => {
  const result = runEval();
  assert.equal(result.status, "passed", JSON.stringify(result.results.filter((r) => !r.passed)));
  assert.ok(result.total >= 15);
});

test("eval rejects wrong expectations and an empty dataset", () => {
  const dataset = JSON.parse(readFileSync(new URL("../docs/product/service/owner-os-eval-scenarios.json", import.meta.url), "utf8"));
  dataset.scenarios[0].expected.model_id = "incorrect-model";
  const result = runEval(dataset);
  assert.equal(result.status, "failed");
  assert.ok(result.results[0].mismatches.includes("model_id"));
  assert.equal(runEval({ scenarios: [] }).status, "failed");
});

test("read-only review does not gain writes, and an explicit gate still waits", () => {
  assert.equal(buildIntake("Supabase 코드를 수정하지 말고 리뷰해줘.").autonomy_level, "answer_only");
  assert.equal(buildIntake("PR 전 점검해줘.").approval_gate, "none");
  const gate = buildIntake("안전 점검 게이트 열어줘.");
  assert.equal(gate.approval_gate, "safety review scope approval");
  assert.deepEqual(gate.subagents, []);
  assert.equal(buildIntake("리뷰하고 production deploy 해줘.").approval_gate, "production release scope verification");
});

test("packet model fields and traces distinguish configured defaults from execution", () => {
  const packet = buildPacket({ request: "관련 파일을 넓게 조사해줘." });
  assert.match(packet, /model_id: "gpt-6-astra"/);
  assert.match(packet, /max_concurrent_agents: 4/);
  assert.doesNotMatch(packet, /5_5|5\.5/);
  const trace = buildTraceExample({ request: "관련 파일을 넓게 조사해줘." });
  assert.deepEqual(trace.subagents.used, []);
  assert.deepEqual(trace.subagents.recommended, ["spark-explorer"]);
  assert.equal(trace.model.runtime_selection_verified, false);
  assert.deepEqual(trace.tool_calls, []);
});

test("explanation and deployment-script review remain read-only", () => {
  for (const request of [
    "src/foo.ts를 수정하지 말고 설명해줘.",
    "코드를 수정하지 말고 원인만 분석해줘.",
    "배포 스크립트를 수정하지 말고 리뷰해줘.",
  ]) {
    const intake = buildIntake(request);
    assert.equal(intake.autonomy_level, "answer_only", request);
    assert.equal(intake.approval_gate, "none", request);
  }
  assert.equal(buildIntake("이거 수정해줘.").approval_gate, "scope_clarification");
});

test("packet validation retains read compatibility for the old review field", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "owner-os-legacy-"));
  try {
    const file = path.join(dir, "legacy.md");
    const template = readFileSync(new URL("../docs/_meta/templates/owner-os-work-packet.md", import.meta.url), "utf8");
    writeFileSync(file, template.replaceAll("deep_review_when", "escalate_to_5_5_when"));
    // Validator paths are repository-relative, including paths to a temporary fixture.
    const result = spawnSync(process.execPath, ["scripts/validate-owner-os-packets.mjs", path.relative(process.cwd(), file)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
