#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const fixedStagingAlias =
  process.env.FIXED_STAGING_ALIAS ??
  "emr-app-shell-prototype-staging-mcso0s-projects.vercel.app";
const stagingBranchAlias =
  process.env.STAGING_BRANCH_ALIAS ??
  "emr-app-shell-prototype-git-staging-mcso0s-projects.vercel.app";
const vercelScope = process.env.VERCEL_SCOPE ?? "mcso0s-projects";
const inspectTimeout = process.env.VERCEL_INSPECT_TIMEOUT ?? "10m";
const dryRun = process.argv.includes("--dry-run");
const deploymentUrlInput =
  process.env.VERCEL_DEPLOYMENT_URL ??
  process.argv.find((argument) => !argument.startsWith("-") && argument !== process.argv[0] && argument !== process.argv[1]);

const generatedPreviewHostPattern =
  /^emr-app-shell-prototype-[a-z0-9]+-mcso0s-projects\.vercel\.app$/;

function main() {
  const deploymentUrl = normalizeDeploymentUrl(deploymentUrlInput);

  console.log(`Fixed staging alias target: ${fixedStagingAlias}`);
  console.log(`Source deployment URL: ${deploymentUrl}`);
  console.log(`Vercel scope: ${vercelScope}`);

  runVercel(["inspect", deploymentUrl, "--wait", "--timeout", inspectTimeout]);
  runVercel(["alias", "set", deploymentUrl, fixedStagingAlias]);
  runVercel(["inspect", `https://${fixedStagingAlias}`]);

  if (dryRun) {
    console.log("Dry run complete. No Vercel alias was changed.");
  }
}

function normalizeDeploymentUrl(rawValue) {
  if (!rawValue?.trim()) {
    fail("VERCEL_DEPLOYMENT_URL is required.");
  }

  const withProtocol = /^https?:\/\//i.test(rawValue.trim())
    ? rawValue.trim()
    : `https://${rawValue.trim()}`;
  let url;

  try {
    url = new URL(withProtocol);
  } catch {
    fail(`Invalid VERCEL_DEPLOYMENT_URL: ${rawValue}`);
  }

  const host = url.hostname.toLowerCase();

  if (host === fixedStagingAlias) {
    fail("Refusing to use the fixed staging alias as its own source deployment.");
  }

  if (host !== stagingBranchAlias && !generatedPreviewHostPattern.test(host)) {
    fail(
      [
        "Deployment URL must be the staging branch alias or this project's generated Vercel preview URL.",
        `Received: ${host}`,
      ].join("\n")
    );
  }

  return `https://${host}`;
}

function runVercel(args) {
  const token = process.env.VERCEL_TOKEN;
  const command = [
    "vercel@latest",
    ...args,
    "--scope",
    vercelScope,
    ...(token ? ["--token", token] : []),
  ];
  const printableCommand = [
    "npx",
    "vercel@latest",
    ...args,
    "--scope",
    vercelScope,
    ...(token ? ["--token", "<redacted>"] : []),
  ].join(" ");

  if (dryRun) {
    console.log(`[dry-run] ${printableCommand}`);
    return;
  }

  if (!token) {
    fail("VERCEL_TOKEN is required unless --dry-run is used.");
  }

  const result = spawnSync("npx", command, {
    stdio: "inherit",
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0) {
    fail(`Command failed: ${printableCommand}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main();
