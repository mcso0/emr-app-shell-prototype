#!/usr/bin/env node

/**
 * Local adapter CLI.
 *
 * Usage (Node 23+):
 *   node --experimental-strip-types scripts/clinical-master-airtable-publish-adapter.ts input.json [output.json]
 *
 * It reads an already-exported authoring JSON file, emits the deterministic
 * current-publisher payload plus the exact authoring-only exclusions, and
 * never contacts Airtable or Supabase.
 */

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

// Node's strip-types loader resolves this explicit TypeScript entrypoint. The
// repository's bundler resolves the same import during normal type checking.
// @ts-expect-error -- intentional Node strip-types CLI import.
import { adaptClinicalMasterAirtableAuthoringExport } from "../src/features/clinical-master/server-clinical-master-airtable-publish-adapter.ts";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath) {
  console.error("Usage: node --experimental-strip-types scripts/clinical-master-airtable-publish-adapter.ts <authoring.json> [output.json]");
  process.exit(2);
}

try {
  const source = await readFile(inputPath, "utf8");
  const result = adaptClinicalMasterAirtableAuthoringExport(JSON.parse(source) as never);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
} catch (error) {
  const issues = error && typeof error === "object" && "issues" in error ? (error as { issues?: unknown }).issues : undefined;
  if (issues) console.error(JSON.stringify({ issues }, null, 2));
  else console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
