import type {
  WorkspacePermissionDbGateway,
  WorkspacePermissionDbJobPositionAssignmentRow,
  WorkspacePermissionDbMembershipRow,
  WorkspacePermissionDbPolicyRow,
  WorkspacePermissionDbRoleAssignmentRow,
  WorkspacePermissionDbUserRow,
} from "@/features/auth/db-workspace-permission-adapter";

type SupabaseQueryResult<Row> = PromiseLike<{
  data: Row[] | null;
  error: SupabaseReadError | null;
}>;

type SupabaseQueryBuilder<Row> = {
  eq(column: string, value: string): SupabaseQueryBuilder<Row>;
  in(column: string, values: string[]): SupabaseQueryBuilder<Row>;
  select(columns: string): SupabaseQueryBuilder<Row>;
  then<TResult1 = { data: Row[] | null; error: SupabaseReadError | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[] | null; error: SupabaseReadError | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
};

type SupabaseReadError = {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string;
  readonly hint?: string;
};

type AdditiveAssignmentSchema = {
  readonly assignmentTable: string;
  readonly embeddedRelation: string;
};

type SupabasePermissionRoleAssignmentRow = {
  workspace_id: string;
  membership_id: string;
  permission_role_id: string;
  workspace_permission_roles: {
    role_key: string;
    label: string;
    role_type: string;
    permissions: { allowed?: string[] } | null;
  } | null;
};

type SupabaseJobPositionAssignmentRow = {
  workspace_id: string;
  membership_id: string;
  job_position_id: string;
  workspace_job_positions: {
    position_key: string;
    label: string;
  } | null;
};

export type SupabaseWorkspacePermissionClient = {
  from(table: "user_memberships"): SupabaseQueryBuilder<WorkspacePermissionDbMembershipRow>;
  from(table: "users"): SupabaseQueryBuilder<WorkspacePermissionDbUserRow>;
  from(table: "permission_policies"): SupabaseQueryBuilder<WorkspacePermissionDbPolicyRow>;
  from(
    table: "workspace_membership_permission_role_assignments"
  ): SupabaseQueryBuilder<SupabasePermissionRoleAssignmentRow>;
  from(
    table: "workspace_membership_job_position_assignments"
  ): SupabaseQueryBuilder<SupabaseJobPositionAssignmentRow>;
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
    async listPermissionRoleAssignments(workspaceId, membershipIds) {
      if (membershipIds.length === 0) return [];

      const rows = await selectOptionalAdditiveAssignmentRows(
        client
          .from("workspace_membership_permission_role_assignments")
          .select(
            "workspace_id, membership_id, permission_role_id, workspace_permission_roles(role_key, label, role_type, permissions)"
          )
          .eq("workspace_id", workspaceId)
          .in("membership_id", membershipIds),
        {
          assignmentTable: "workspace_membership_permission_role_assignments",
          embeddedRelation: "workspace_permission_roles",
        }
      );

      return rows.map(mapPermissionRoleAssignment).filter(isDbRoleAssignmentRow);
    },
    async listJobPositionAssignments(workspaceId, membershipIds) {
      if (membershipIds.length === 0) return [];

      const rows = await selectOptionalAdditiveAssignmentRows(
        client
          .from("workspace_membership_job_position_assignments")
          .select(
            "workspace_id, membership_id, job_position_id, workspace_job_positions(position_key, label)"
          )
          .eq("workspace_id", workspaceId)
          .in("membership_id", membershipIds),
        {
          assignmentTable: "workspace_membership_job_position_assignments",
          embeddedRelation: "workspace_job_positions",
        }
      );

      return rows.map(mapJobPositionAssignment).filter(isDbJobPositionAssignmentRow);
    },
  };
}

async function selectRows<Row>(query: SupabaseQueryResult<Row>) {
  const { data, error } = await query;

  if (error) {
    throwSupabaseReadError(error);
  }

  return data ?? [];
}

async function selectOptionalAdditiveAssignmentRows<Row>(
  query: SupabaseQueryResult<Row>,
  schema: AdditiveAssignmentSchema
) {
  const { data, error } = await query;

  if (!error) {
    return data ?? [];
  }

  if (isMissingAdditiveAssignmentSchemaError(error, schema)) {
    return [];
  }

  throwSupabaseReadError(error);
}

function isMissingAdditiveAssignmentSchemaError(
  error: SupabaseReadError,
  schema: AdditiveAssignmentSchema
) {
  const errorText = [error.code, error.message, error.details, error.hint]
    .filter(isNonEmptyString)
    .join("\n")
    .toLowerCase();
  const assignmentTable = schema.assignmentTable.toLowerCase();
  const embeddedRelation = schema.embeddedRelation.toLowerCase();
  const mentionsTargetSchema =
    errorText.includes(assignmentTable) || errorText.includes(embeddedRelation);
  const hasMissingSchemaCode =
    error.code === undefined ||
    error.code === "PGRST200" ||
    error.code === "PGRST205" ||
    error.code === "42P01";
  const hasMissingSchemaText =
    errorText.includes("schema cache") ||
    errorText.includes("could not find the table") ||
    errorText.includes("could not find a relationship") ||
    errorText.includes("does not exist");

  return mentionsTargetSchema && hasMissingSchemaCode && hasMissingSchemaText;
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function throwSupabaseReadError(error: SupabaseReadError): never {
  throw new Error(error.message ?? "supabase_permission_gateway_read_failed");
}

function mapPermissionRoleAssignment(
  row: SupabasePermissionRoleAssignmentRow
): WorkspacePermissionDbRoleAssignmentRow | null {
  const permissionRole = row.workspace_permission_roles;

  if (!permissionRole) {
    return null;
  }

  return {
    workspace_id: row.workspace_id,
    membership_id: row.membership_id,
    permission_role_id: row.permission_role_id,
    role_key: permissionRole.role_key,
    label: permissionRole.label,
    role_type: permissionRole.role_type,
    permissions: permissionRole.permissions,
  };
}

function mapJobPositionAssignment(
  row: SupabaseJobPositionAssignmentRow
): WorkspacePermissionDbJobPositionAssignmentRow | null {
  const jobPosition = row.workspace_job_positions;

  if (!jobPosition) {
    return null;
  }

  return {
    workspace_id: row.workspace_id,
    membership_id: row.membership_id,
    job_position_id: row.job_position_id,
    position_key: jobPosition.position_key,
    label: jobPosition.label,
  };
}

function isDbRoleAssignmentRow(
  row: WorkspacePermissionDbRoleAssignmentRow | null
): row is WorkspacePermissionDbRoleAssignmentRow {
  return row !== null;
}

function isDbJobPositionAssignmentRow(
  row: WorkspacePermissionDbJobPositionAssignmentRow | null
): row is WorkspacePermissionDbJobPositionAssignmentRow {
  return row !== null;
}
