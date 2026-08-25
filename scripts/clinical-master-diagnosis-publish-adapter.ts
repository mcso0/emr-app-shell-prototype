#!/usr/bin/env -S node --experimental-strip-types

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
// @ts-expect-error -- explicit extension supports the Node strip-types CLI.
import { adaptClinicalMasterDiagnosisPublishPayload } from "../src/features/clinical-master/server-clinical-master-diagnosis-publish-adapter.ts";

const inputPath = resolve(process.argv[2] ?? "tests/fixtures/clinical-master-operational-v3-authoring.json");
const source = await readFile(inputPath, "utf8");
const payload = adaptClinicalMasterDiagnosisPublishPayload(JSON.parse(source) as never);
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
