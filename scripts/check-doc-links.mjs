import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scannedFiles = [];
const failures = [];

const requiredPaths = [
  "docs/agent-start-here.md",
  "docs/_meta/README.md",
  "docs/_meta/taxonomy.md",
  "docs/_meta/lifecycle.md",
  "docs/_meta/intake-rules.md",
  "docs/_meta/documentation-depth-rules.md",
  "docs/_meta/result-review-rules.md",
  "docs/_meta/templates/feature-spec.md",
  "docs/_meta/templates/decision.md",
  "docs/_meta/templates/adr.md",
  "docs/_meta/templates/changelog.md",
  "docs/_meta/templates/closeout.md",
  "docs/business/changelog.md",
  "docs/product/changelog.md",
  "docs/design/changelog.md",
  "docs/engineering/changelog.md",
  "docs/work/index.md",
  "docs/work/inbox.md",
  "docs/work/templates/work-item.md",
  "docs/completed/README.md",
  "docs/archive/README.md",
];

const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const inlinePathPattern = /`(docs\/[^`#)]+)`/g;

const ignoredPrefixes = ["http://", "https://", "mailto:", "#"];
const uncheckedExtensions = new Set([".gif", ".jpeg", ".jpg", ".pdf", ".png", ".webp"]);

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === ".next" ||
      entry === ".worktrees" ||
      entry === ".codex-backups"
    ) {
      continue;
    }

    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (fullPath.endsWith(".md") || path.basename(fullPath) === "AGENTS.md") {
      scannedFiles.push(fullPath);
    }
  }
}

function normalizeCandidate(candidate) {
  let value = candidate.trim();

  if (!value || ignoredPrefixes.some((prefix) => value.startsWith(prefix))) {
    return null;
  }

  if (value.startsWith("<") && value.endsWith(">")) {
    value = value.slice(1, -1);
  }

  const hashIndex = value.indexOf("#");
  if (hashIndex >= 0) {
    value = value.slice(0, hashIndex);
  }

  value = value.replace(/[.,;:!?]+$/g, "");

  if (!value.startsWith("docs/")) {
    return null;
  }

  if (value.includes("*") || value.includes("<") || value.includes(">")) {
    return null;
  }

  if (value.includes("YYYY-MM-DD")) {
    return null;
  }

  if (value.endsWith("/")) {
    return null;
  }

  if (uncheckedExtensions.has(path.extname(value).toLowerCase())) {
    return null;
  }

  return value;
}

function checkCandidate(sourceFile, candidate) {
  const normalized = normalizeCandidate(candidate);

  if (!normalized) {
    return;
  }

  const target = path.join(root, normalized);

  if (!existsSync(target)) {
    failures.push({
      source: path.relative(root, sourceFile),
      target: normalized,
    });
  }
}

walk(root);

for (const requiredPath of requiredPaths) {
  const target = path.join(root, requiredPath);

  if (!existsSync(target)) {
    failures.push({
      source: "required docs structure",
      target: requiredPath,
    });
  }
}

for (const file of scannedFiles) {
  const text = readFileSync(file, "utf8");

  for (const match of text.matchAll(markdownLinkPattern)) {
    checkCandidate(file, match[1]);
  }

  for (const match of text.matchAll(inlinePathPattern)) {
    checkCandidate(file, match[1]);
  }
}

if (failures.length > 0) {
  console.error("Broken internal docs references:");
  for (const failure of failures) {
    console.error(`- ${failure.source} -> ${failure.target}`);
  }
  process.exit(1);
}

console.log(`Checked ${scannedFiles.length} docs/agent markdown files. Internal docs references look good.`);
