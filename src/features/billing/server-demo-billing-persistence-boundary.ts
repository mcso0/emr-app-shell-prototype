import { createMockWorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import type { RoleUpdateActorIdentityResult } from "@/features/auth/server-role-update-identity";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function shouldUseSupabaseBillingPersistenceGateway({
  identitySource,
  invoiceId,
}: {
  identitySource: Extract<
    RoleUpdateActorIdentityResult,
    { ok: true }
  >["source"];
  invoiceId: string | null | undefined;
}) {
  return identitySource === "supabase_session" && isUuid(invoiceId);
}

export function createSupabaseDemoBillingPermissionAdapter({
  actorUserId,
  workspaceId,
}: {
  actorUserId: string;
  workspaceId: string;
}) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: `membership-${actorUserId}-${workspaceId}`,
        workspaceId,
        userId: actorUserId,
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });
}

function isUuid(value: string | null | undefined) {
  return typeof value === "string" && uuidPattern.test(value.trim());
}
