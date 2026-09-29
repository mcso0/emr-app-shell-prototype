import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const contextPath = "../src/features/lab-imaging/server-lab-result-phase2-context.ts";
const routePath = "../src/app/api/workspaces/[workspaceId]/lab-imaging/result-attachments/route.ts";
function load(relativePath, imports) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  runInNewContext(outputText, { exports, Request, Response, URL, Uint8Array, Date,
    process: { env: {} }, require: name => imports[name] ?? (name === "node:crypto" ? require(name) : {}) });
  return exports;
}
const scopeModule = load(contextPath, {});
const entry = { id: "entry-a", workspace_id: "workspace-a", result_id: "result-a",
  result_status: "entered", result_definition_origin: "canonical", row_id: "row-a" };

test("RPC-only result resolution works without direct table grants and rejects foreign selectors", async () => {
  const calls = [];
  const client = { from() { throw Error("RPC-only result table"); }, rpc(name, args) {
    calls.push({ name, args }); return Promise.resolve({ data: entry, error: null });
  } };
  assert.deepEqual(JSON.parse(JSON.stringify(await scopeModule.resolveLabResultEntry(client, "workspace-a", "result-a", "row-a"))),
    { id: "entry-a", result_status: "entered" });
  assert.equal(await scopeModule.resolveLabResultEntry(client, "workspace-b", "result-a", "row-a"), null);
  assert.equal(await scopeModule.resolveLabResultEntry(client, "workspace-a", "result-b", "row-a"), null);
  assert.equal(await scopeModule.resolveLabResultEntry(client, "workspace-a", "result-a", "row-b"), null);
  assert.equal(calls[0].name, "clair_get_lab_result_attachment_context");
  assert.equal(calls[0].args.p_row_id, "row-a");
});

function routeHarness({ denied = false, foreignRow = false, prepareError = false } = {}) {
  const calls = [];
  const core = load("../src/features/lab-imaging/lab-result-attachment-core.ts", {});
  const client = {
    from() { throw Error("RPC-only table access denied"); },
    storage: { from() { throw Error("Session storage signing must not be used"); } },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "clair_get_lab_result_attachment_context") return { data: foreignRow ? null : entry, error: null };
      if (prepareError) return { data: null, error: { message: "result_unavailable" } };
      return { data: core.labResultAttachmentPath(args.p_workspace_id, entry.id, args.p_attachment_id, args.p_mime_type), error: null };
    },
  };
  const trusted = { storage: { from(bucket) {
      calls.push({ bucket }); return { async createSignedUploadUrl(path) {
      calls.push({ signedPath: path }); return { data: { token: "synthetic-token", signedUrl: "https://storage.example.test/upload/signed" }, error: null };
    } };
  } }, from() { throw Error("Unexpected metadata table access"); } };
  const route = load(routePath, {
    "@/features/lab-imaging/lab-result-attachment-core": core,
    "@/lib/security/rate-limit": { enforceWorkspaceMutationRateLimit: () => null },
    "@/features/lab-imaging/server-lab-result-phase2-context": {
      ...scopeModule,
      loadLabResultPhase2Context: async () => denied
        ? { ok: false, response: Response.json({ ok: false }, { status: 403 }) }
        : { ok: true, actorUserId: "actor-a", client, trusted },
    },
  });
  const run = () => route.POST(new Request("https://example.test/api/attachments", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "prepare", resultId: "result-a", rowId: "row-a",
      name: "synthetic.png", mimeType: "image/png", size: 179 }),
  }), { params: Promise.resolve({ workspaceId: "workspace-a" }) });
  return { run, calls };
}

test("prepare uses the authenticated ownership RPC and server-only storage signer", async () => {
  const harness = routeHarness();
  const response = await harness.run();
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.objectPath, /^workspace-a\/entry-a\/[a-f0-9-]+\.png$/);
  assert.equal(body.uploadUrl, "https://storage.example.test/upload/signed");
  assert.equal(harness.calls[1].name, "clair_prepare_lab_result_attachment");
  assert.equal(harness.calls[1].args.p_row_id, "row-a");
  assert.equal(harness.calls.find(call => call.signedPath)?.signedPath, body.objectPath);
});

test("denied permissions and foreign rows cannot create metadata or signed upload URLs", async () => {
  const denied = routeHarness({ denied: true });
  assert.equal((await denied.run()).status, 403);
  assert.equal(denied.calls.length, 0);
  const foreign = routeHarness({ foreignRow: true });
  assert.equal((await foreign.run()).status, 409);
  assert.equal(foreign.calls.length, 1);
});

test("an atomic prepare rejection prevents signing after a concurrent result state change", async () => {
  const harness = routeHarness({ prepareError: true });
  assert.equal((await harness.run()).status, 500);
  assert.equal(harness.calls.length, 2);
});
