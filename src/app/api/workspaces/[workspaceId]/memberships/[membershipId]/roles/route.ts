import { authorizeWorkspaceRoleUpdate } from "@/features/auth/server-role-update-enforcement";

type RoleUpdateRouteContext = {
  params: Promise<{
    workspaceId: string;
    membershipId: string;
  }>;
};

export async function POST(request: Request, { params }: RoleUpdateRouteContext) {
  const { workspaceId, membershipId } = await params;
  const actorUserId = request.headers.get("x-clair-demo-session-user-id");
  const body = await readJsonBody(request);
  const nextRoles = Array.isArray(body.roles) ? body.roles : [];
  const result = authorizeWorkspaceRoleUpdate({
    actorUserId,
    workspaceId,
    targetMembershipId: membershipId,
    nextRoles,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<{ roles?: unknown }> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
