import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
const require = createRequire(import.meta.url);
const load = (file, imports = {}) => {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, require: name => imports[name] ?? require(name) });
  return exports;
};
const contract = load("../src/features/chart/confirmed-order-edit-contract.ts");
const { executeConfirmedOrderEdit } = load("../src/features/chart/server-confirmed-order-edit.ts", { "./confirmed-order-edit-contract": contract });
const orderId = "93000000-0000-4000-8000-000000000001", chartId = "93000000-0000-4000-8000-000000000002";
const command = { orderId, chartId, commandId: "93000000-0000-4000-8000-000000000003", expectedVersion: "synthetic-v1", financial: { unitPriceKrw: 5000 }, reason: "" };
const document = { orderId, chartId, version: "synthetic-v2", detailInputs: {}, calculationOutputs: {}, detailSchemaVersion: 1, taskStatus: "pending", billingStage: "before", financial: null, canEditClinical: false, canEditFinancial: false, actualDispenseMode: "automatic", actualDispenseQuantity: null };
test("invalid fields and missing clinical reason never invoke RPC", async () => {
  let calls = 0; const client = { rpc: async () => { calls++; return {}; } };
  for (const input of [{ ...command, financial: { discount: 1 } }, { ...command, financial: { unitPriceKrw: -1 } }, { ...command, clinical: { detailInputs: { dose: 1 }, detailSchemaVersion: 1, actualDispenseMode: "automatic" } }]) {
    const result = await executeConfirmedOrderEdit({ client, workspaceId: "synthetic-workspace", input }); assert.equal(result.status, 400);
  }
  assert.equal(calls, 0);
});
test("server adapter passes validated workspace/command and rejects mismatched response identity", async () => {
  let wrong = false;
  const client = { rpc: async (name, args) => {
    assert.equal(name, "clair_edit_confirmed_order"); assert.equal(args.p_workspace_id, "synthetic-workspace"); assert.equal(args.p_command.commandId, command.commandId);
    return { data: { ...document, orderId: wrong ? chartId : orderId }, error: null };
  } };
  assert.equal((await executeConfirmedOrderEdit({ client, workspaceId: "synthetic-workspace", input: command })).ok, true);
  wrong = true; assert.equal((await executeConfirmedOrderEdit({ client, workspaceId: "synthetic-workspace", input: command })).status, 502);
});
test("permission/conflict/network errors fail without a success response", async () => {
  for (const [message, status] of [["permission_missing", 403], ["revision_conflict", 409], ["payment_locked", 409]]) {
    const result = await executeConfirmedOrderEdit({ client: { rpc: async () => ({ error: { message }, data: null }) }, workspaceId: "synthetic-workspace", input: command });
    assert.equal(result.ok, false); assert.equal(result.status, status);
  }
  const result = await executeConfirmedOrderEdit({ client: { rpc: async () => { throw new Error("network"); } }, workspaceId: "synthetic-workspace", orderId, chartId });
  assert.equal(result.status, 500);
});
