#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const placeholderPattern =
  /^(|changeme|change-me|example|placeholder|replace-me|todo|dummy|test|local|localhost|your[_-]?[\w-]+|<[^>]+>|\$\{[^}]+})$/i;

const rules = [
  {
    id: "sql_literal_auth_password",
    message: "SQL password hashing must not use a committed literal",
    pattern: /\bcrypt\s*\(\s*(?:'(?:[^']|'')*'|\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$)\s*,/gi,
  },
  {
    id: "openai_api_key",
    message: "OpenAI API key-like value",
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    id: "stripe_secret_key",
    message: "Stripe secret key-like value",
    pattern: /\b(?:sk_live|sk_test)_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: "supabase_access_token",
    message: "Supabase access token-like value",
    pattern: /\bsbp_[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    id: "jwt_like_secret",
    message: "JWT-like secret value",
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    id: "database_url_with_password",
    message: "Database URL with embedded password",
    pattern: /\b(?:postgres|postgresql):\/\/[^:\s/@]+:[^@\s/]+@[^)\s"'`]+/gi,
  },
  {
    id: "secret_env_assignment",
    message: "Secret-looking environment assignment",
    pattern:
      /\b([A-Z0-9_]*(?:SECRET|SERVICE_ROLE|DB_PASSWORD|DATABASE_URL|SUPABASE_SECRET|STRIPE_SECRET|OPENAI_API_KEY|JWT_SECRET|VERCEL_TOKEN)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s#]+)["']?/g,
    validate(match) {
      const key = String(match[1] ?? "");
      const value = String(match[2] ?? "");
      if (key.startsWith("NEXT_PUBLIC_")) return true;
      return !isSafePlaceholder(value);
    },
  },
];

const trackedEnvPatterns = [".env*", ".vercel/.env*", "**/.env*"];
const ignoredPathPatterns = [
  /^node_modules\//,
  /^\.next\//,
  /^coverage\//,
  /^test-results\//,
  /^playwright-report\//,
  /^supabase\/\.branches\//,
];

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const files = listTrackedFiles();
  const trackedEnvFiles = listTrackedEnvFiles();
  const findings = [];

  for (const file of trackedEnvFiles) {
    findings.push({
      file,
      line: 1,
      rule: "tracked_env_file",
      message: "Tracked env files are not allowed",
      sample: file,
    });
  }

  for (const file of files) {
    if (shouldIgnorePath(file) || !existsSync(file) || isProbablyBinaryOrTooLarge(file)) {
      continue;
    }

    const content = readFileSync(file, "utf8");
    findings.push(...scanText(file, content));
  }

  if (findings.length > 0) {
    console.error("Secret scan failed. Review these tracked files:");
    for (const finding of findings) {
      console.error(
        `- ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}: ${finding.sample}`
      );
    }
    process.exit(1);
  }

  console.log(`Secret scan passed. Checked ${files.length} tracked files.`);
}

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function listTrackedEnvFiles() {
  const output = execFileSync("git", ["ls-files", "-z", ...trackedEnvPatterns], {
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

function shouldIgnorePath(file) {
  return ignoredPathPatterns.some((pattern) => pattern.test(file));
}

function isProbablyBinaryOrTooLarge(file) {
  const buffer = readFileSync(file);
  if (buffer.length > 1_000_000) return true;
  return buffer.includes(0);
}

function scanText(file, content) {
  const findings = [];

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      if (rule.validate && !rule.validate(match)) continue;

      const value = String(match[0] ?? "");
      if (isSafePlaceholder(value)) continue;

      findings.push({
        file,
        line: lineNumberAt(content, match.index),
        rule: rule.id,
        message: rule.message,
        sample: rule.id === "sql_literal_auth_password" ? "<redacted>" : redact(value),
      });
    }
  }

  return findings;
}

function isSafePlaceholder(value) {
  const normalized = value.trim().replace(/^["']|["']$/g, "");
  if (placeholderPattern.test(normalized)) return true;
  if (/^\$\{\{\s*(secrets|vars)\.[A-Z0-9_]+\s*\}\}$/i.test(normalized)) return true;
  if (/^(https?:\/\/)?localhost(?:[:/]|$)/i.test(normalized)) return true;
  if (/^postgres(?:ql)?:\/\/[^:]+:(?:password|postgres|example|placeholder|changeme)@/i.test(normalized)) {
    return true;
  }
  return false;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function redact(value) {
  const normalized = value.replace(/\s+/g, " ").slice(0, 160);
  if (normalized.length <= 14) return "<redacted>";
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function runSelfTest() {
  const sqlPasswords = [
    "cr" + "ypt('unsafe-example', salt)",
    "CR" + "YPT (\n'escaped''example', salt)",
    "cr" + "ypt($$unsafe-example$$, salt)",
    "cr" + "ypt($secret$unsafe-example$secret$, salt)",
  ];
  if (sqlPasswords.some((sql) => !scanText("sql-self-test", sql).some((f) => f.rule === "sql_literal_auth_password" && f.sample === "<redacted>"))) {
    throw new Error("SQL literal password detection/redaction failed");
  }
  const dangerous = [
    "OPENAI_API_KEY=" + "sk-" + "a".repeat(40),
    "STRIPE_SECRET_KEY=" + "sk_live_" + "b".repeat(30),
    "SUPABASE_ACCESS_TOKEN=" + "sbp_" + "c".repeat(40),
    "DATABASE" + "_URL=postgresql://app:" + "notaplaceholder" + "@db.example.com/postgres",
    "NEXT_PUBLIC_SERVICE_ROLE_KEY=" + "eyJ" + "d".repeat(24) + "." + "e".repeat(24) + "." + "f".repeat(24),
  ].join("\n");
  const safe = [
    "OPENAI_API_KEY=placeholder",
    "STRIPE_SECRET_KEY=replace-me",
    "DATABASE" + "_URL=postgresql://postgres:password@localhost:54322/postgres",
    "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder",
  ].join("\n");

  const dangerousFindings = scanText("self-test-dangerous", dangerous);
  const safeFindings = scanText("self-test-safe", safe);

  if (dangerousFindings.length < 5) {
    console.error("Secret scanner self-test failed: expected dangerous values to be detected.");
    process.exit(1);
  }

  if (safeFindings.length > 0) {
    console.error("Secret scanner self-test failed: safe placeholders were flagged.");
    for (const finding of safeFindings) {
      console.error(`- ${finding.rule}: ${finding.sample}`);
    }
    process.exit(1);
  }

  console.log("Secret scanner self-test passed.");
}

main();
