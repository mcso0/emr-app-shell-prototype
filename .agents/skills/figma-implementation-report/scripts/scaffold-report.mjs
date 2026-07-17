#!/usr/bin/env node

import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templatePath = join(skillRoot, "assets", "report-template");
const requestedPath = process.argv[2];

if (!requestedPath || requestedPath === "--help" || requestedPath === "-h") {
  console.log("Usage: node scaffold-report.mjs <output-directory>");
  console.log(
    "Copies the bundled standalone report source without overwriting existing files.",
  );
  process.exit(requestedPath ? 0 : 1);
}

const outputPath = resolve(requestedPath);
let outputExists = false;

if (outputPath === templatePath || outputPath.startsWith(`${templatePath}/`)) {
  throw new Error("Output directory cannot be the bundled template directory.");
}

try {
  const outputStat = await stat(outputPath);
  outputExists = true;
  if (!outputStat.isDirectory()) {
    throw new Error(`Output path exists and is not a directory: ${outputPath}`);
  }
  const entries = await readdir(outputPath);
  if (entries.length > 0) {
    throw new Error(`Refusing to overwrite non-empty directory: ${outputPath}`);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await mkdir(dirname(outputPath), { recursive: true });
}

if (outputExists) {
  const templateEntries = await readdir(templatePath);
  for (const entry of templateEntries) {
    await cp(join(templatePath, entry), join(outputPath, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
} else {
  await cp(templatePath, outputPath, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
}
await cp(
  join(skillRoot, "scripts", "validate-report-contract.mjs"),
  join(outputPath, "scripts", "validate-report-contract.mjs"),
  { force: true },
);

console.log(`Report scaffold created: ${outputPath}`);
console.log(
  "Next: edit src/report-contract.json and src/App.jsx, then run npm install && npm run build:report && npm run test:report",
);
