import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const routes = { "invoice-lines": ["GET", "PATCH"], "payment-status": ["GET", "PATCH"], "guardian-checkout": ["GET", "POST", "PATCH"] };
const actor = "00000000-0000-4000-8000-000000000001";
const uuid = "10000000-0000-4000-8000-000000000001";
function harness(name, { allowed = true, authenticated = true } = {}) {
  const loaded = [];
  const adapter = { allowed };
  const client = { rpc() { throw new Error("unexpected direct RPC"); } };
  const operation = async input => {
    assert.equal(input.actorUserId, actor);
    assert.equal(input.permissionAdapter, adapter, "live route must pass the DB adapter to its domain operation");
    assert.equal(input.workspaceId, "workspace-synthetic");
    return allowed ? { ok: true, status: 200 } : { ok: false, status: 403, denialReason: "workspace_membership_missing" };
  };
  const persistence = new Proxy({}, { get: (_, key) => key.startsWith("createMock") ? () => { throw new Error("live request entered mock persistence"); }
    : key.startsWith("createSupabase") ? c => { assert.equal(c, client); return {}; } : operation });
  const imports = {
    "@/features/auth/server-session-reader": { readServerSession: async () => ({ actor }) },
    "@/features/auth/server-role-update-identity": { demoSessionUserIdHeader: "x-demo-actor", resolveRoleUpdateActorIdentity: () => authenticated ? { ok: true, actorUserId: actor, source: "supabase_session" } : { ok: false, denialReason: "unauthenticated" } },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/features/auth/db-workspace-permission-adapter": { loadWorkspacePermissionAdapterFromDb: async input => { assert.equal(input.sessionUserId, actor); assert.equal(input.workspaceId, "workspace-synthetic"); loaded.push(input); return adapter; } },
    "@/features/auth/supabase-workspace-permission-gateway": { createSupabaseWorkspacePermissionGateway: c => { assert.equal(c, client); return { client: c }; } },
    "@/features/billing/server-demo-billing-persistence-boundary": { shouldUseSupabaseBillingPersistenceGateway: () => true, createSupabaseDemoBillingPermissionAdapter: () => { throw new Error("live request entered demo authorization"); } },
    "@/features/billing/server-invoice-line-persistence": persistence,
    "@/features/billing/server-payment-status-persistence": persistence,
    "@/features/billing/server-guardian-checkout": persistence,
    "@/features/billing/server-assignment": { mockBillingOwnerAllowed: () => { throw new Error("live request entered mock ownership"); } },
    "@/features/audit/server-audit-log-persistence": { createSupabaseLiveAuditAppendGateway: () => ({}) },
    "@/features/audit/server-mutation-audit": { getAuditRequestId: () => "synthetic-request" },
    "@/lib/security/rate-limit": { enforceWorkspaceMutationRateLimit: () => null },
  };
  const source = readFileSync(new URL(`../src/app/api/workspaces/[workspaceId]/billing/${name}/route.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  runInNewContext(outputText, { exports, Request, Response, URL, require: key => imports[key] ?? {} });
  return { loaded, invoke: method => exports[method](new Request(`https://example.test/billing?invoiceId=${uuid}&guardianId=${uuid}`, { method, headers: { "Content-Type": "application/json", "x-demo-actor": "foreign-header-actor" }, ...(method === "GET" ? {} : { body: JSON.stringify({ invoiceId: uuid, invoiceIds: [uuid], lines: [{ invoiceLineId: uuid, quantity: 1 }] }) }) }), { params: Promise.resolve({ workspaceId: "workspace-synthetic" }) }) };
}
for (const [name, methods] of Object.entries(routes)) {
  for (const method of methods) {
    test(`${name} ${method} uses session-bound DB permissions for live UUID targets`, async () => {
      const h = harness(name); assert.equal((await h.invoke(method)).status, 200); assert.equal(h.loaded.length, 1);
    });
    test(`${name} ${method} preserves a denied DB permission result`, async () => {
      const h = harness(name, { allowed: false }); assert.equal((await h.invoke(method)).status, 403); assert.equal(h.loaded.length, 1);
    });
  }
  test(`${name} rejects anonymous requests before loading workspace permissions`, async () => {
    const h = harness(name, { authenticated: false }); assert.equal((await h.invoke("GET")).status, 401); assert.equal(h.loaded.length, 0);
  });
}
