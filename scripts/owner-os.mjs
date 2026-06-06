#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "output", "owner-os");
const scenarioPath = path.join(root, "docs", "product", "service", "owner-os-eval-scenarios.json");
const packetTemplatePath = path.join(root, "docs", "_meta", "templates", "owner-os-work-packet.md");
const traceContractPath = path.join(root, "docs", "product", "service", "owner-os-trace-contract.md");

const command = process.argv[2] ?? "help";
const args = parseArgs(process.argv.slice(3));

function main() {
  ensureOutputDir();

  switch (command) {
    case "intake":
      return writeJsonOrStdout(buildIntake(args.request ?? ""), args.out);
    case "packet":
      return writeTextOrStdout(buildPacket(args), args.out ?? defaultOutputPath("packet", "md"));
    case "review":
      return writeTextOrStdout(buildReview(), args.out ?? defaultOutputPath("review", "md"));
    case "eval":
      return writeJsonOrStdout(runEval(), args.out ?? defaultOutputPath("eval-report", "json"));
    case "dashboard":
      return writeTextOrStdout(buildDashboard(), args.out ?? path.join(outputDir, "owner-os-dashboard.html"));
    case "trace":
      return writeJsonOrStdout(buildTraceExample(args), args.out ?? defaultOutputPath("trace-summary", "json"));
    case "help":
    default:
      printHelp();
  }
}

function buildIntake(request) {
  const normalized = request.toLowerCase();
  const gated = /(supabase|production|deploy|rls|payment|email|provider|실데이터|배포|결제|권한)/i.test(request);
  const test = /(test|lint|build|ci|검증|테스트|실패|로그)/i.test(request);
  const linear = /(linear|리니어|issue|project|이슈|프로젝트)/i.test(request);
  const broad = /(조사|넓게|관련 파일|mapping|분석)/i.test(request);
  const simple = request.length < 80 && !gated && !test && !linear && !broad;

  return {
    request,
    task_type: gated ? "safety" : test ? "qa" : linear ? "linear" : broad ? "planning" : "answer",
    depth_level: gated ? "L4" : test || broad || linear ? "L2" : simple ? "L0" : "L1",
    autonomy_level: gated || linear ? "external_action_gated" : test ? "verify_local" : "answer_only",
    parent_model_tier: gated ? "5.5" : simple ? "low_cost" : "standard",
    escalate_to_5_5: gated,
    subagents: gated ? ["security-boundary-reviewer"] : test ? ["test-triage"] : broad ? ["spark-explorer"] : [],
    approval_gate: gated ? "approval required before gated operation" : linear ? "Linear mutation approval" : "none",
    next_action: gated ? "ask for explicit approval" : "proceed within packet scope",
  };
}

function buildPacket(options) {
  const request = options.request ?? "Owner OS packet request";
  const title = options.title ?? "Owner OS packet draft";
  const intake = buildIntake(request);
  const template = readFileSync(packetTemplatePath, "utf8");
  const block = template.match(/```owner_os_work_packet\n([\s\S]*?)\n```/)?.[1] ?? "";

  return [
    "# Owner OS Packet Draft",
    "",
    `Request: ${request}`,
    "",
    "```owner_os_work_packet",
    block
      .replace('title: "Short executable title"', `title: "${escapeDouble(title)}"`)
      .replace('intent: "One-sentence target"', `intent: "${escapeDouble(request)}"`)
      .replace('task_type: "answer | planning | docs | code | review | qa | linear | safety"', `task_type: "${intake.task_type}"`)
      .replace('autonomy_level: "answer_only | propose_only | local_edit | verify_local | external_action_gated"', `autonomy_level: "${intake.autonomy_level}"`)
      .replace('  selected_tier: "low_cost | standard | 5.5"', `  selected_tier: "${intake.parent_model_tier}"`)
      .replace('  escalation_decision: "not_needed | required | blocked_for_approval"', `  escalation_decision: "${intake.escalate_to_5_5 ? "required" : "not_needed"}"`),
    "```",
  ].join("\n");
}

function buildReview() {
  const status = gitStatusShort();
  return [
    "# Owner OS Review Draft",
    "",
    "## Local State",
    "",
    status ? fenced(status, "text") : "No local git status output.",
    "",
    "## Verification To Report",
    "",
    "- `npm run owner-os:packet:check`",
    "- `npm run owner-os:eval`",
    "- `npm run docs:check`",
    "",
    "## Risk",
    "",
    "- Remote Supabase, production, real data, payment, email, and provider integrations remain out of scope.",
  ].join("\n");
}

function runEval() {
  const dataset = JSON.parse(readFileSync(scenarioPath, "utf8"));
  const results = dataset.scenarios.map((scenario) => {
    const missing = [];
    const expected = scenario.expected ?? {};
    for (const field of [
      "task_type",
      "depth_level",
      "autonomy_level",
      "parent_model_tier",
      "escalate_to_5_5",
      "subagents",
      "approval_gate",
      "output",
    ]) {
      if (!(field in expected)) missing.push(field);
    }

    return {
      id: scenario.id,
      type: scenario.type,
      passed: missing.length === 0,
      failure_class: missing.length === 0 ? "none" : "missing_expected_field",
      missing,
    };
  });

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;

  return {
    id: "OWNER_OS_EVAL_REPORT",
    generated_at: new Date().toISOString(),
    dataset: dataset.id,
    pass_threshold: dataset.pass_threshold,
    passed,
    total,
    pass_rate: total === 0 ? 0 : passed / total,
    status: passed === total ? "passed" : "failed",
    results,
  };
}

function buildTraceExample(options) {
  const request = options.request ?? "Create Owner OS packet template";
  const intake = buildIntake(request);
  return {
    trace_id: `owner-os-trace-${stamp()}`,
    packet_id: "OWNER-OS-PACKET-20260605-1",
    issue_id: options.issue ?? "DEN-423-DEN-429",
    request_summary: request,
    classification: {
      task_type: intake.task_type,
      depth_level: intake.depth_level,
      autonomy_level: intake.autonomy_level,
    },
    context: {
      sources_selected: [
        "docs/agent-start-here.md",
        "docs/engineering/current-status.md",
        "docs/product/service/clair-owner-os-product-plan.md",
      ],
      sources_skipped: ["docs/archive/**", "docs/completed/**"],
      max_context_sources: 3,
    },
    model: {
      parent_model_tier: intake.parent_model_tier,
      escalate_to_5_5: intake.escalate_to_5_5,
      escalation_reason: intake.escalate_to_5_5 ? intake.approval_gate : "none",
    },
    subagents: {
      used: intake.subagents,
      trigger: intake.subagents.length > 0 ? "cost_or_risk_reduction" : "none",
      cost_rationale:
        intake.subagents.length > 0
          ? "Read-only specialist summary reduces parent-model search or safety risk."
          : "Direct parent handling is cheaper.",
      summaries_used: [],
    },
    approval_gates: {
      status: intake.approval_gate === "none" ? "none" : "stopped",
      named_gates: intake.approval_gate === "none" ? [] : [intake.approval_gate],
      approval_evidence: "none",
    },
    tool_calls: [],
    verification: {
      commands: ["npm run owner-os:eval", "npm run docs:check"],
      passed: [],
      failed: [],
    },
    result: {
      status: "draft",
      summary: "Trace example generated from local Owner OS CLI.",
      handoff: "Use this shape for DEN-424 trace fixtures and DEN-428 regression.",
    },
    trace_contract: path.relative(root, traceContractPath),
  };
}

function buildDashboard() {
  const evalPath = path.join(outputDir, "eval-report.json");
  const report = existsSync(evalPath) ? JSON.parse(readFileSync(evalPath, "utf8")) : runEval();
  const rows = report.results
    .map(
      (result) => `<tr><td>${escapeHtml(result.id)}</td><td>${escapeHtml(result.type)}</td><td>${result.passed ? "Pass" : "Fail"}</td><td>${escapeHtml(result.failure_class)}</td></tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Owner OS Dashboard Prototype</title>
    <style>
      body { margin: 0; background: #f5f7f8; color: #17202a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { max-width: 1180px; margin: 0 auto; padding: 36px 20px 64px; }
      h1 { margin: 0 0 8px; font-size: 38px; }
      .muted { color: #627083; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
      .card { background: #fff; border: 1px solid #dbe2e8; border-radius: 8px; padding: 18px; }
      .metric { font-size: 30px; font-weight: 800; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dbe2e8; border-radius: 8px; overflow: hidden; }
      th, td { padding: 12px 14px; border-bottom: 1px solid #dbe2e8; text-align: left; }
      th { background: #edf3f4; }
      @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Owner OS Dashboard Prototype</h1>
      <p class="muted">Read-only local dashboard. No Linear, Supabase, production, or provider writes.</p>
      <section class="grid" aria-label="Owner OS metrics">
        <div class="card"><div>Project Issues</div><div class="metric">10</div><div class="muted">DEN-420 through DEN-429</div></div>
        <div class="card"><div>Eval Pass Rate</div><div class="metric">${Math.round(report.pass_rate * 100)}%</div><div class="muted">${report.passed}/${report.total} deterministic scenarios</div></div>
        <div class="card"><div>Approval Gates</div><div class="metric">Active</div><div class="muted">Remote/live actions remain stopped</div></div>
        <div class="card"><div>Next Review</div><div class="metric">Human</div><div class="muted">Representative review before Done</div></div>
      </section>
      <h2>Scenario Health</h2>
      <table>
        <thead><tr><th>Scenario</th><th>Type</th><th>Status</th><th>Failure Class</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function writeJsonOrStdout(data, out) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  if (out) return writeFile(out, text);
  process.stdout.write(text);
}

function writeTextOrStdout(text, out) {
  if (out) return writeFile(out, `${text}\n`);
  process.stdout.write(`${text}\n`);
}

function writeFile(file, text) {
  const target = path.isAbsolute(file) ? file : path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(path.relative(root, target));
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
}

function defaultOutputPath(name, extension) {
  return path.join(outputDir, `${name}.${extension}`);
}

function gitStatusShort() {
  try {
    return execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

function fenced(value, language) {
  return ["```" + language, value, "```"].join("\n");
}

function escapeDouble(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printHelp() {
  console.log(`Usage:
  npm run owner-os -- intake --request "..."
  npm run owner-os -- packet --request "..." --title "..."
  npm run owner-os -- review
  npm run owner-os -- eval
  npm run owner-os -- trace --request "..."
  npm run owner-os -- dashboard`);
}

main();
