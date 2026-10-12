// Offline source-default verification; workspace FK resolution is separately
// exercised against registered local resources by the rollback integration.
import { readFileSync } from "node:fs";
import { validateClinicalOrderDetailInputs } from "../src/features/chart/order-execution-domain";
import type { ClinicalOrderType } from "../src/types/emr-domain";
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-10/";
const proposal = JSON.parse(readFileSync(folder + "ready-orders.non-applied.v1.json", "utf8"));
const resources = JSON.parse(readFileSync(folder + "resources.non-applied.v1.json", "utf8"));
const activeKeys = new Set(proposal.selectableKeys);
const compositeKeys = new Set(resources.compositions.map((row: { masterKey: string }) => row.masterKey));
const problems: unknown[] = [];
let atomicChecks = 0;
for (const row of proposal.payload.records) {
  if (row.recordType !== "order" || !activeKeys.has(row.masterKey) || compositeKeys.has(row.masterKey)) continue;
  const preset = row.detail.executionPreset;
  const defaults = { ...preset.defaultDetailInputs };
  delete defaults.planOrderAuthority;
  delete defaults.manualQuantityReason;
  delete defaults.autoDispenseQuantityEnabled;
  for (const workspaceId of resources.workspaceAllowlist) {
    const inputs = { ...defaults };
    // A test-only encounter authority stands in for the resolver's real input.
    if (preset.clinicalOrderType === "consultation") inputs.responsibleClinicianId = "97081000-0000-4000-8000-000000000099";
    if (preset.clinicalOrderType === "hospitalization") inputs.wardOrCage = resources.locations.find((location: {workspaceId: string}) => location.workspaceId === workspaceId).id;
    const result = validateClinicalOrderDetailInputs({ clinicalOrderType: preset.clinicalOrderType as ClinicalOrderType,
      schemaVersion: preset.detailSchemaVersion, detailInputs: inputs, requireComplete: true });
    if (!result.valid) problems.push({ workspaceId, masterKey: row.masterKey, errors: result.fieldErrors });
    atomicChecks++;
  }
}
if (problems.length) { console.error(JSON.stringify(problems, null, 2)); process.exitCode = 1; }
else console.log(JSON.stringify({ atomicChecks, compositeKeys: compositeKeys.size, runtimeResourcesVerifiedHere: false }));
