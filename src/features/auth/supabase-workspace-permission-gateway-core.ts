import type {
  WorkspacePermissionDbGateway,
  WorkspacePermissionDbMembershipRow,
  WorkspacePermissionDbPolicyRow,
  WorkspacePermissionDbUserRow,
} from "@/features/auth/db-workspace-permission-adapter";

type SupabaseQueryResult<Row> = PromiseLike<{
  data: Row[] | null;
  error: { message?: string } | null;
}>;

type SupabaseQueryBuilder<Row> = {
  eq(column: string, value: string): SupabaseQueryBuilder<Row>;
  in(column: string, values: string[]): SupabaseQueryBuilder<Row>;
  select(columns: string): SupabaseQueryBuilder<Row>;
  then<TResult1 = { data: Row[] | null; error: { message?: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[] | null; error: { message?: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
};

export type SupabaseWorkspacePermissionClient = {
  from(table: "user_memberships"): SupabaseQueryBuilder<WorkspacePermissionDbMembershipRow>;
  from(table: "users"): SupabaseQueryBuilder<WorkspacePermissionDbUserRow>;
  from(table: "permission_policies"): SupabaseQueryBuilder<WorkspacePermissionDbPolicyRow>;
};

export function createSupabaseWorkspacePermissionGateway(
  client: SupabaseWorkspacePermissionClient
): WorkspacePermissionDbGateway {
  return {
    async listMemberships(workspaceId, userId) {
      return selectRows(
        client
          .from("user_memberships")
          .select("id, workspace_id, user_id, roles, status")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
      );
    },
    async listUsers(userIds) {
      if (userIds.length === 0) return [];

      return selectRows(
        client
          .from("users")
          .select("id, status, display_name")
          .in("id", userIds)
      );
    },
    async listPermissionPolicies(workspaceId) {
      return selectRows(
        client
          .from("permission_policies")
          .select("workspace_id, scope, target_role, permissions")
          .eq("workspace_id", workspaceId)
      );
    },
  };
}

async function selectRows<Row>(query: SupabaseQueryResult<Row>) {
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message ?? "supabase_permission_gateway_read_failed");
  }

  return data ?? [];
}
