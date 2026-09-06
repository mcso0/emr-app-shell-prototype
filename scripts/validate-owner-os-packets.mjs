#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const defaultCases = [
  {
    file: "docs/_meta/templates/owner-os-work-packet.md",
    label: "template",
    expected: "valid",
  },
  {
    file: "docs/product/service/owner-os-work-packet-examples.md",
    label: "examples:good",
    blockHeading: "Good Example",
    expected: "valid",
  },
  {
    file: "docs/product/service/owner-os-work-packet-examples.md",
    label: "examples:bad",
    blockHeading: "Bad Example",
    expected: "invalid",
  },
];

const requiredPaths = [
  "id",
  "title",
  "intent",
  "request_source",
  "task_type",
  "scope_level",
  "autonomy_level",
  "ambiguity_policy",
  "allowed_changes",
  "out_of_scope",
  "required_sources",
  "trusted_inputs",
  "untrusted_inputs",
  "approval_gates",
  "verification",
  "done_criteria",
  "failure_criteria",
  "eval_contract",
  "eval_contract.method",
  "eval_contract.scenarios",
  "eval_contract.sample_count",
  "eval_contract.pass_threshold",
  "eval_contract.judge_rubric",
  "eval_contract.calibration_examples",
  "trace_requirements",
  "trace_requirements.record",
  "retry_policy",
  "retry_policy.max_attempts",
  "retry_policy.retry_allowed_for",
  "retry_policy.retry_forbidden_for",
  "token_budget",
  "token_budget.depth_level",
  "token_budget.max_context_sources",
  "parent_model",
  "parent_model.policy",
  "parent_model.selected_tier",
  "parent_model.low_cost_allowed",
  "parent_model.deep_review_when",
  "parent_model.escalation_decision",
  "subagent_policy",
  "subagent_policy.default",
  "subagent_policy.allowed_agents",
  "subagent_policy.trigger",
  "subagent_policy.cost_rationale",
  "subagent_policy.parent_decision",
  "result_review",
  "result_review.language",
  "result_review.include",
  "handoff_summary",
];

const requiredListPaths = new Set([
  "allowed_changes",
  "out_of_scope",
  "required_sources",
  "trusted_inputs",
  "untrusted_inputs",
  "approval_gates",
  "verification",
  "done_criteria",
  "failure_criteria",
  "eval_contract.scenarios",
  "eval_contract.judge_rubric",
  "eval_contract.calibration_examples",
  "trace_requirements.record",
  "retry_policy.retry_allowed_for",
  "retry_policy.retry_forbidden_for",
  "parent_model.deep_review_when",
  "subagent_policy.allowed_agents",
  "result_review.include",
]);

function main() {
  const args = process.argv.slice(2);
  const cases =
    args.length > 0
      ? args.map((file) => ({ file, label: file, expected: "valid" }))
      : defaultCases;

  const failures = [];

  for (const testCase of cases) {
    const result = validateCase(testCase);

    if (testCase.expected === "valid" && !result.valid) {
      failures.push(formatFailure(testCase, result));
    }

    if (testCase.expected === "invalid" && result.valid) {
      failures.push(`${testCase.label}: expected invalid packet, but it passed`);
    }
  }

  if (failures.length > 0) {
    console.error("Owner OS packet validation failed:");
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log(`Owner OS packet validation passed for ${cases.length} case(s).`);
}

function validateCase(testCase) {
  const filePath = path.join(root, testCase.file);

  if (!existsSync(filePath)) {
    return {
      valid: false,
      missing: [`missing file: ${testCase.file}`],
      missingLists: [],
    };
  }

  const content = readFileSync(filePath, "utf8");
  const block = extractPacketBlock(content, testCase.blockHeading);

  if (!block) {
    return {
      valid: false,
      missing: ["owner_os_work_packet fenced block"],
      missingLists: [],
    };
  }

  const parsed = parseKeyPaths(block);
  // Read compatibility only; historical packets are not rewritten or executed.
  for (const set of [parsed.paths, parsed.listPaths]) {
    if (set.has("parent_model.escalate_to_5_5_when")) set.add("parent_model.deep_review_when");
  }
  const missing = requiredPaths.filter((requiredPath) => !parsed.paths.has(requiredPath));
  const missingLists = [...requiredListPaths].filter(
    (requiredPath) => !parsed.listPaths.has(requiredPath)
  );

  return {
    valid: missing.length === 0 && missingLists.length === 0,
    missing,
    missingLists,
  };
}

function extractPacketBlock(content, heading) {
  let searchArea = content;

  if (heading) {
    const headingIndex = content.indexOf(`## ${heading}`);
    if (headingIndex < 0) return null;
    const nextHeadingIndex = content.indexOf("\n## ", headingIndex + 1);
    searchArea =
      nextHeadingIndex < 0
        ? content.slice(headingIndex)
        : content.slice(headingIndex, nextHeadingIndex);
  }

  const match = searchArea.match(/```owner_os_work_packet\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
}

function parseKeyPaths(block) {
  const paths = new Set();
  const listPaths = new Set();
  const stack = [];
  let lastKeyPath = null;

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;

    const listMatch = line.match(/^(\s*)-\s+/);
    if (listMatch && lastKeyPath) {
      listPaths.add(lastKeyPath);
      continue;
    }

    const keyMatch = line.match(/^(\s*)([A-Za-z0-9_]+):/);
    if (!keyMatch) continue;

    const indent = keyMatch[1].length;
    const key = keyMatch[2];

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parentPath = stack.map((entry) => entry.key).join(".");
    const keyPath = parentPath ? `${parentPath}.${key}` : key;

    paths.add(keyPath);
    stack.push({ indent, key });
    lastKeyPath = keyPath;
  }

  return { paths, listPaths };
}

function formatFailure(testCase, result) {
  const details = [];
  if (result.missing.length > 0) {
    details.push(`missing fields: ${result.missing.join(", ")}`);
  }
  if (result.missingLists.length > 0) {
    details.push(`fields must include list items: ${result.missingLists.join(", ")}`);
  }
  return `${testCase.label}: ${details.join("; ")}`;
}

main();
