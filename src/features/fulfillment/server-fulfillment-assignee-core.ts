export type FulfillmentEligibleAssignee = {
  department?: string | null;
  displayName: string;
  title?: string | null;
  userId: string;
};

export type FulfillmentEligibleAssigneeGateway = {
  list(input: {
    actorUserId: string;
    workItemId: string;
    workspaceId: string;
  }): Promise<
    | { assignees: FulfillmentEligibleAssignee[]; ok: true }
    | {
        denialReason?: "permission_missing" | "work_item_unavailable";
        error?: "db_read_failed";
        ok: false;
      }
  >;
};

export type SupabaseFulfillmentEligibleAssigneeRpcClient = {
  rpc(
    functionName: "clair_list_fulfillment_eligible_assignees",
    args: { p_work_item_id: string; p_workspace_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export async function readFulfillmentEligibleAssignees({
  actorUserId,
  gateway = createMockFulfillmentEligibleAssigneeGateway(),
  workItemId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: FulfillmentEligibleAssigneeGateway;
  workItemId: string;
  workspaceId: string;
}) {
  if (!actorUserId) {
    return { denialReason: "unauthenticated" as const, ok: false as const, status: 401 as const };
  }
  if (!workspaceId.trim() || !workItemId.trim()) {
    return { error: "invalid_input" as const, ok: false as const, status: 400 as const };
  }
  const result = await gateway.list({
    actorUserId,
    workItemId,
    workspaceId,
  });
  if (result.ok) {
    return {
      assignees: result.assignees,
      enforcedBy: "fulfillment-eligible-assignees" as const,
      ok: true as const,
      status: 200 as const,
    };
  }
  if (result.denialReason === "permission_missing") {
    return { denialReason: result.denialReason, ok: false as const, status: 403 as const };
  }
  if (result.denialReason === "work_item_unavailable") {
    return { denialReason: result.denialReason, ok: false as const, status: 404 as const };
  }
  return { error: "db_read_failed" as const, ok: false as const, status: 500 as const };
}

export function createSupabaseFulfillmentEligibleAssigneeGateway(
  client: SupabaseFulfillmentEligibleAssigneeRpcClient,
): FulfillmentEligibleAssigneeGateway {
  return {
    async list({ workItemId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_list_fulfillment_eligible_assignees",
        { p_work_item_id: workItemId, p_workspace_id: workspaceId },
      );
      if (error) {
        if (error.message?.includes("permission_missing")) {
          return { denialReason: "permission_missing", ok: false };
        }
        if (error.message?.includes("work_item_unavailable")) {
          return { denialReason: "work_item_unavailable", ok: false };
        }
        return { error: "db_read_failed", ok: false };
      }
      const assignees = mapEligibleAssignees(data);
      return assignees
        ? { assignees, ok: true }
        : { error: "db_read_failed", ok: false };
    },
  };
}

export function createMockFulfillmentEligibleAssigneeGateway(): FulfillmentEligibleAssigneeGateway {
  return {
    async list({ actorUserId, workspaceId }) {
      if (
        workspaceId !== "clair-demo" ||
        ![
          "playwright-default-session",
          "user-admin",
          "user-tech",
          "user-vet",
        ].includes(actorUserId)
      ) {
        return { denialReason: "permission_missing", ok: false };
      }
      return {
        assignees: [
          { displayName: "송하윤", title: "테크니션", userId: "user-tech" },
          { displayName: "송민재", title: "병원 관리자", userId: "user-admin" },
        ],
        ok: true,
      };
    },
  };
}

function mapEligibleAssignees(value: unknown) {
  if (!Array.isArray(value)) return null;
  const assignees: FulfillmentEligibleAssignee[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Partial<FulfillmentEligibleAssignee>;
    if (typeof row.userId !== "string" || typeof row.displayName !== "string") {
      return null;
    }
    assignees.push({
      department: typeof row.department === "string" ? row.department : null,
      displayName: row.displayName,
      title: typeof row.title === "string" ? row.title : null,
      userId: row.userId,
    });
  }
  return assignees;
}
