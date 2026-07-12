import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { normalizePermissionRoleMutationInput } from "@/features/auth/server-workspace-permission-role-management";
import { createClient } from "@/lib/supabase/server";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";

type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: request.headers.get(demoSessionUserIdHeader) });
  if (!identity.ok) return Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 });
  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
    const { data, error } = await client.rpc("clair_list_workspace_permission_roles", { p_workspace_id: workspaceId });
    if (error) return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
    return Response.json({ ok: true, roles: Array.isArray(data) ? data : [] });
  }
  if (identity.actorUserId !== "user-admin" && identity.actorUserId !== "user-manager") return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
  return Response.json({ ok: true, roles: demoRoles(workspaceId) });
}

export async function POST(request: Request, { params }: Context) {
  const { workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: request.headers.get(demoSessionUserIdHeader) });
  if (!identity.ok) return Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 });
  const body = await readBody(request);
  const input = normalizePermissionRoleMutationInput({ label: typeof body.label === "string" ? body.label : "", description: typeof body.description === "string" ? body.description : null, permissionIds: Array.isArray(body.permissionIds) ? body.permissionIds.filter((v): v is string => typeof v === "string") : [] });
  if (!input) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
    const { data, error } = await client.rpc("clair_create_workspace_permission_role", { p_workspace_id: workspaceId, p_label: input.label, p_description: input.description, p_permission_ids: input.permissionIds, p_request_id: getAuditRequestId(request) });
    if (error) return Response.json({ ok: false, denialReason: error.message?.includes("grant_ceiling") ? "grant_ceiling_violation" : "permission_missing" }, { status: 403 });
    return Response.json({ ok: true, role: data }, { status: 201 });
  }
  if (identity.actorUserId !== "user-admin" && identity.actorUserId !== "user-manager") return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
  return Response.json({ ok: true, role: { id: `demo-role-${Date.now()}`, workspaceId, roleKey: `custom_${Date.now()}`, ...input, roleType: "custom", status: "active", isSystem: false, isAssignable: true, affectedMembershipCount: 0, pendingInvitationCount: 0 } }, { status: 201 });
}

function demoRoles(workspaceId: string) { return [
  { id: "role-owner", workspaceId, roleKey: "owner", label: "소유자", description: null, roleType: "owner", permissionIds: ["*"], status: "active", isSystem: true, isAssignable: true, affectedMembershipCount: 1, pendingInvitationCount: 0 },
  { id: "role-admin", workspaceId, roleKey: "admin", label: "관리자", description: null, roleType: "admin", permissionIds: ["role_permission:manage"], status: "active", isSystem: true, isAssignable: true, affectedMembershipCount: 1, pendingInvitationCount: 0 },
  { id: "role-general", workspaceId, roleKey: "general", label: "일반", description: null, roleType: "standard", permissionIds: ["reception:view"], status: "active", isSystem: true, isAssignable: true, affectedMembershipCount: 3, pendingInvitationCount: 0 },
]; }
async function readBody(request: Request): Promise<Record<string, unknown>> { try { const value = await request.json(); return value && typeof value === "object" ? value as Record<string, unknown> : {}; } catch { return {}; } }
