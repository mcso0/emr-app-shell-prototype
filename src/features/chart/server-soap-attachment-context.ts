import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseSoapAttachmentGateway } from "./server-soap-attachment";

export async function loadSoapAttachmentContext(request: Request, workspaceId: string, requireWritableStorage = false) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) return { ok: false as const, response: Response.json({ ok: false, error: identity.denialReason }, { status: 401 }) };
  if (identity.source !== "supabase_session") return { ok: false as const, response: Response.json({ ok: false, error: "configured_data_source_required" }, { status: 503 }) };
  const client = await createClient();
  if (!client) return { ok: false as const, response: Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 }) };
  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient),
    workspaceId,
    sessionUserId: identity.actorUserId,
  }).catch(() => null);
  if (!permissionAdapter) return { ok: false as const, response: Response.json({ ok: false, error: "db_read_failed" }, { status: 500 }) };
  const trustedClient = createTrustedAttachmentClient();
  if (requireWritableStorage && !trustedClient) {
    return { ok: false as const, response: Response.json({ ok: false, error: "attachment_storage_unconfigured" }, { status: 503 }) };
  }
  return {
    ok: true as const,
    actorUserId: identity.actorUserId,
    permissionAdapter,
    gateway: createSupabaseSoapAttachmentGateway(client, trustedClient),
  };
}

function createTrustedAttachmentClient() {
  const config = getSupabasePublicConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return config && key
    ? createSupabaseClient(config.url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
