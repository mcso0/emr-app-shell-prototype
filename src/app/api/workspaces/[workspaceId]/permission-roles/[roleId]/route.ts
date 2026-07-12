import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { normalizePermissionRoleMutationInput } from "@/features/auth/server-workspace-permission-role-management";
import { createClient } from "@/lib/supabase/server";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";

type Context = { params: Promise<{ workspaceId: string; roleId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const { workspaceId, roleId } = await params;
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: request.headers.get(demoSessionUserIdHeader) });
  if (!identity.ok) return Response.json({ ok:false, denialReason:identity.denialReason },{status:401});
  const body = await readBody(request);
  const input = normalizePermissionRoleMutationInput({ label: typeof body.label === "string" ? body.label : "", description: typeof body.description === "string" ? body.description : null, permissionIds: Array.isArray(body.permissionIds) ? body.permissionIds.filter((v):v is string=>typeof v==="string") : [] });
  if (!input) return Response.json({ok:false,error:"invalid_input"},{status:400});
  if (identity.source === "supabase_session") { const client=await createClient(); if(!client)return Response.json({ok:false,error:"supabase_client_missing"},{status:500}); const {data,error}=await client.rpc("clair_update_workspace_permission_role_definition",{p_workspace_id:workspaceId,p_role_id:roleId,p_label:input.label,p_description:input.description,p_permission_ids:input.permissionIds,p_request_id:getAuditRequestId(request)}); if(error)return Response.json({ok:false,denialReason:error.message?.includes("system_role")?"system_role_protected":"permission_missing"},{status:error.message?.includes("system_role")?409:403}); return Response.json({ok:true,role:data}); }
  if(identity.actorUserId!=="user-admin"&&identity.actorUserId!=="user-manager")return Response.json({ok:false,denialReason:"permission_missing"},{status:403});
  return Response.json({ok:true,role:{id:roleId,workspaceId,...input}});
}
async function readBody(request:Request):Promise<Record<string,unknown>>{try{const value=await request.json();return value&&typeof value==="object"?value as Record<string,unknown>:{};}catch{return {};}}
