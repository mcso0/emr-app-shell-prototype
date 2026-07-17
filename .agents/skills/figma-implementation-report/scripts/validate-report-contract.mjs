#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const input = process.argv[2];

if (!input || input === "--help" || input === "-h") {
  console.log(
    "Usage: node validate-report-contract.mjs <report-contract.json|report.html>",
  );
  process.exit(input ? 0 : 1);
}

const inputPath = resolve(input);
const raw = await readFile(inputPath, "utf8");
let jsonSource = raw;

if (extname(inputPath).toLowerCase() === ".html") {
  const match = raw.match(
    /<script\s+id=["']figma-implementation-contract["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error(
      "Embedded figma-implementation-contract JSON was not found.",
    );
  }
  jsonSource = match[1];
}

let contract;
try {
  contract = JSON.parse(jsonSource);
} catch (error) {
  throw new Error(`Invalid JSON: ${error.message}`);
}

const errors = [];
const lifecycleStatuses = new Set([
  "draft",
  "decision-needed",
  "proposed",
  "approved",
  "implemented",
  "verified",
  "rejected",
  "stale",
  "not-applicable",
]);
const verificationResults = new Set(["pass", "fail", "blocked", "not-run"]);
const motionSources = new Set([
  "figma-explicit",
  "project-existing",
  "agent-generated",
  "user-approved",
]);
const arrayContracts = {
  changes: /^CHG-\d{3,}$/,
  conflicts: /^CNF-\d{3,}$/,
  components: /^CMP-\d{3,}$/,
  tokens: /^TOK-\d{3,}$/,
  states: /^STA-\d{3,}$/,
  responsive: /^RSP-\d{3,}$/,
  accessibility: /^A11Y-\d{3,}$/,
  motion: /^MOT-\d{3,}$/,
};

const requireObject = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  return true;
};

const requireString = (value, path) => {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
  }
};

const requireLifecycleStatus = (value, path) => {
  if (!lifecycleStatuses.has(value)) {
    errors.push(`${path} must use the lifecycle status vocabulary`);
  }
};

if (contract.schemaVersion !== "1.0.0") {
  errors.push("schemaVersion must be 1.0.0");
}

if (requireObject(contract.report, "report")) {
  requireString(contract.report.id, "report.id");
  requireString(contract.report.title, "report.title");
  requireString(contract.report.language, "report.language");
  if (!new Set(["report", "implementation"]).has(contract.report.mode)) {
    errors.push("report.mode must be report or implementation");
  }
  requireLifecycleStatus(contract.report.status, "report.status");
  if (Number.isNaN(Date.parse(contract.report.generatedAt))) {
    errors.push("report.generatedAt must be an ISO date string");
  }
}

if (requireObject(contract.source, "source")) {
  if (requireObject(contract.source.figma, "source.figma")) {
    for (const key of [
      "url",
      "fileKey",
      "nodeId",
      "nodeName",
      "retrievedAt",
      "fingerprint",
    ]) {
      requireString(contract.source.figma[key], `source.figma.${key}`);
    }
    const viewport = contract.source.figma.viewport;
    if (
      !requireObject(viewport, "source.figma.viewport") ||
      !(viewport.width > 0) ||
      !(viewport.height > 0)
    ) {
      errors.push(
        "source.figma.viewport width and height must be positive numbers",
      );
    }
  }
  if (requireObject(contract.source.repository, "source.repository")) {
    for (const key of ["path", "revision", "retrievedAt", "feature"]) {
      requireString(
        contract.source.repository[key],
        `source.repository.${key}`,
      );
    }
  }
}

if (requireObject(contract.summary, "summary")) {
  requireString(contract.summary.goal, "summary.goal");
  requireString(contract.summary.fidelityTarget, "summary.fidelityTarget");
  requireLifecycleStatus(contract.summary.readiness, "summary.readiness");
  if (!Array.isArray(contract.summary.assumptions))
    errors.push("summary.assumptions must be an array");
  if (!Array.isArray(contract.summary.knownGaps))
    errors.push("summary.knownGaps must be an array");
}

const seenIds = new Set();
for (const [key, idPattern] of Object.entries(arrayContracts)) {
  const items = contract[key];
  if (!Array.isArray(items)) {
    errors.push(`${key} must be an array`);
    continue;
  }
  items.forEach((item, index) => {
    const path = `${key}[${index}]`;
    if (!requireObject(item, path)) return;
    if (!idPattern.test(item.id ?? ""))
      errors.push(`${path}.id has an invalid prefix or format`);
    if (seenIds.has(item.id))
      errors.push(`${path}.id is duplicated: ${item.id}`);
    seenIds.add(item.id);
    requireString(item.title ?? item.name, `${path}.title or name`);
    requireLifecycleStatus(item.status, `${path}.status`);
    if (key === "motion" && !motionSources.has(item.source)) {
      errors.push(`${path}.source must use the motion provenance vocabulary`);
    }
  });
}

if (requireObject(contract.implementation, "implementation")) {
  for (const key of ["approvalGates", "slices", "dependencies"]) {
    if (!Array.isArray(contract.implementation[key])) {
      errors.push(`implementation.${key} must be an array`);
    }
  }
  for (const [key, pattern] of [
    ["approvalGates", /^APR-\d{3,}$/],
    ["slices", /^IMP-\d{3,}$/],
  ]) {
    for (const [index, item] of (
      contract.implementation[key] ?? []
    ).entries()) {
      if (!pattern.test(item.id ?? ""))
        errors.push(`implementation.${key}[${index}].id is invalid`);
      if (seenIds.has(item.id))
        errors.push(
          `implementation.${key}[${index}].id is duplicated: ${item.id}`,
        );
      seenIds.add(item.id);
      requireLifecycleStatus(
        item.status,
        `implementation.${key}[${index}].status`,
      );
    }
  }
}

if (requireObject(contract.verification, "verification")) {
  if (!Array.isArray(contract.verification.checks)) {
    errors.push("verification.checks must be an array");
  } else {
    for (const [index, item] of contract.verification.checks.entries()) {
      if (!/^VER-\d{3,}$/.test(item.id ?? ""))
        errors.push(`verification.checks[${index}].id is invalid`);
      if (!verificationResults.has(item.result))
        errors.push(`verification.checks[${index}].result is invalid`);
    }
  }
  if (!Array.isArray(contract.verification.visualEvidence)) {
    errors.push("verification.visualEvidence must be an array");
  }
}

if (errors.length > 0) {
  console.error(
    `Contract validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`,
  );
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Contract valid: ${inputPath}`);
console.log(
  `Tracked decision records: ${seenIds.size}; verification checks: ${contract.verification.checks.length}`,
);
