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

export async function resolveLabResultEntry(client: NonNullable<Awaited<ReturnType<typeof createClient>>>, workspaceId: string, resultId: string) {
  if (!resultId || resultId.length > 200) return null;
  const { data, error } = await client.from("lab_result_entries")
    .select("id, workspace_id, result_id, order_id, result_status, result_definition_origin")
    .eq("workspace_id", workspaceId).eq("result_id", resultId).maybeSingle();
  return error || data?.result_definition_origin !== "canonical" ? null : data;
}
