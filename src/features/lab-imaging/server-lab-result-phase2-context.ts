import "server-only";

import { createClient as createTrustedSupabaseClient } from "@supabase/supabase-js";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { resolveWorkspacePermission } from "@/features/auth/permission-resolver";
import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function loadLabResultPhase2Context(request: Request, workspaceId: string, write = false, storage = false) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) return { ok: false as const, response: Response.json({ ok: false, error: identity.denialReason }, { status: 401 }) };
  if (identity.source !== "supabase_session") return { ok: false as const, response: Response.json({ ok: false, error: "configured_data_source_required" }, { status: 503 }) };
  const client = await createClient();
  if (!client) return { ok: false as const, response: Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 }) };
  const adapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient),
    workspaceId,
    sessionUserId: identity.actorUserId,
  }).catch(() => null);
  if (!adapter) return { ok: false as const, response: Response.json({ ok: false, error: "permission_read_failed" }, { status: 500 }) };
  const permission = resolveWorkspacePermission(adapter, {
    sessionUserId: identity.actorUserId,
    workspaceId,
    requiredPermission: write ? "lab:complete" : "lab:view",
  });
  if (!permission.allowed) return { ok: false as const, response: Response.json({ ok: false, error: permission.denialReason }, { status: 403 }) };
  const canWrite = resolveWorkspacePermission(adapter, {
    sessionUserId: identity.actorUserId,
    workspaceId,
    requiredPermission: "lab:complete",
  }).allowed;
  const config = getSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const trusted = storage && config && serviceKey
    ? createTrustedSupabaseClient(config.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  if (storage && !trusted) return { ok: false as const, response: Response.json({ ok: false, error: "attachment_storage_unconfigured" }, { status: 503 }) };
  return { ok: true as const, actorUserId: identity.actorUserId, canWrite, client, trusted };
}

export async function resolveLabResultEntry(client: NonNullable<Awaited<ReturnType<typeof createClient>>>, workspaceId: string, resultId: string, rowId?: string) {
  if (!resultId || resultId.length > 200) return null;
  // Result tables are RPC-only for both session and service roles. Resolve
  // ownership through the scoped RPC instead of widening table grants.
  const { data, error } = await client.rpc("clair_get_lab_result_attachment_context", {
    p_workspace_id: workspaceId, p_result_id: resultId, p_row_id: rowId ?? null,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const entry = data as Record<string, unknown>;
  return typeof entry.id === "string" && entry.workspace_id === workspaceId && entry.result_id === resultId
    && entry.result_definition_origin === "canonical" && typeof entry.result_status === "string"
    && (rowId === undefined || entry.row_id === rowId)
    ? { id: entry.id, result_status: entry.result_status } : null;
}
