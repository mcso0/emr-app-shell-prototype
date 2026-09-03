import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

export type OrderBillingReviewResolution = {
  after: Record<string, unknown>;
  before: Record<string, unknown>;
  candidateCount: number;
  invoiceId: string;
  resolutionId: string;
  resolutionType: "invoice_void_and_rebill";
};

type GatewayError =
  | "billing_review_not_required"
  | "billing_review_resolution_in_progress"
  | "db_write_failed"
  | "idempotency_conflict"
  | "invoice_lineage_unavailable"
  | "invoice_unavailable"
  | "refund_flow_required"
  | "revision_conflict";

export type OrderBillingReviewResolutionGateway = {
  reverse(input: {
    actorUserId: string;
    expectedInvoiceUpdatedAt: string;
    idempotencyKey: string;
    invoiceId: string;
    reason: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; resolution: OrderBillingReviewResolution }
    | { error: GatewayError; ok: false }
  >;
};

export type ReverseOrderBillingReviewInvoiceResult =
  | {
      enforcedBy: "order-billing-review-resolution";
      ok: true;
      resolution: OrderBillingReviewResolution;
      status: 200;
    }
  | {
      denialReason: WorkspacePermissionDenialReason;
      ok: false;
      status: 401 | 403;
    }
  | { error: "invalid_input"; ok: false; status: 400 }
  | {
      error:
        | "billing_review_not_required"
        | "billing_review_resolution_in_progress"
        | "idempotency_conflict"
        | "invoice_lineage_unavailable"
        | "invoice_unavailable"
        | "revision_conflict";
      ok: false;
      status: 409;
    }
  | { error: "refund_flow_required"; ok: false; status: 422 }
  | { error: "db_write_failed"; ok: false; status: 500 };

export async function reverseOrderBillingReviewInvoice({
  actorUserId,
  expectedInvoiceUpdatedAt,
  gateway = createMockOrderBillingReviewResolutionGateway(),
  idempotencyKey,
  invoiceId,
  permissionAdapter = createDemoPermissionAdapter(),
  reason,
  workspaceId,
}: {
  actorUserId: string | null;
  expectedInvoiceUpdatedAt?: string | null;
  gateway?: OrderBillingReviewResolutionGateway;
  idempotencyKey?: string | null;
  invoiceId?: string | null;
  permissionAdapter?: WorkspacePermissionAdapter;
  reason?: string | null;
  workspaceId: string;
}): Promise<ReverseOrderBillingReviewInvoiceResult> {
  const expectedUpdatedAt = trimToUndefined(expectedInvoiceUpdatedAt);
  const key = trimToUndefined(idempotencyKey);
  const normalizedInvoiceId = trimToUndefined(invoiceId);
  const normalizedReason = trimToUndefined(reason);
  if (
    !expectedUpdatedAt ||
    !Number.isFinite(Date.parse(expectedUpdatedAt)) ||
    !key ||
    key.length < 8 ||
    key.length > 160 ||
    !normalizedInvoiceId ||
    !normalizedReason ||
    normalizedReason.length < 3 ||
    normalizedReason.length > 500
  ) {
    return { error: "invalid_input", ok: false, status: 400 };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    requiredPermission: "billing:issue",
    sessionUserId: actorUserId,
    workspaceId,
  });
  if (!permission.allowed) {
    return {
      denialReason: permission.denialReason ?? "permission_missing",
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
    };
  }

  const result = await gateway.reverse({
    actorUserId: actorUserId!,
    expectedInvoiceUpdatedAt: expectedUpdatedAt,
    idempotencyKey: key,
    invoiceId: normalizedInvoiceId,
    reason: normalizedReason,
    workspaceId,
  });
  if (result.ok) {
    return {
      enforcedBy: "order-billing-review-resolution",
      ok: true,
      resolution: result.resolution,
      status: 200,
    };
  }
  if (result.error === "refund_flow_required") {
    return { error: result.error, ok: false, status: 422 };
  }
  if (result.error === "db_write_failed") {
    return { error: result.error, ok: false, status: 500 };
  }
  return { error: result.error, ok: false, status: 409 };
}

export type SupabaseOrderBillingReviewResolutionRpcClient = {
  rpc(
    functionName: "clair_reverse_billing_review_invoice",
    args: {
      p_actor_user_id: string;
      p_expected_invoice_updated_at: string;
      p_idempotency_key: string;
      p_invoice_id: string;
      p_reason: string;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseOrderBillingReviewResolutionGateway(
  client: SupabaseOrderBillingReviewResolutionRpcClient,
): OrderBillingReviewResolutionGateway {
  return {
    async reverse(input) {
      const { data, error } = await client.rpc(
        "clair_reverse_billing_review_invoice",
        {
          p_actor_user_id: input.actorUserId,
          p_expected_invoice_updated_at: input.expectedInvoiceUpdatedAt,
          p_idempotency_key: input.idempotencyKey,
          p_invoice_id: input.invoiceId,
          p_reason: input.reason,
          p_workspace_id: input.workspaceId,
        },
      );
      if (error) return { error: mapDbError(error.message), ok: false };
      const resolution = mapResolution(data);
      return resolution
        ? { ok: true, resolution }
        : { error: "db_write_failed", ok: false };
    },
  };
}

export function createMockOrderBillingReviewResolutionGateway(): OrderBillingReviewResolutionGateway {
  const commands = new Map<
    string,
    { request: string; resolution: OrderBillingReviewResolution }
  >();
  return {
    async reverse(input) {
      const key = `${input.workspaceId}:${input.idempotencyKey}`;
      const request = JSON.stringify(input);
      const previous = commands.get(key);
      if (previous) {
        return previous.request === request
          ? { ok: true, resolution: previous.resolution }
          : { error: "idempotency_conflict", ok: false };
      }
      const resolution: OrderBillingReviewResolution = {
        after: {
          invoice: {
            billingReviewRequired: false,
            status: "voided",
          },
        },
        before: {
          invoice: {
            billingReviewRequired: true,
            updatedAt: input.expectedInvoiceUpdatedAt,
          },
        },
        candidateCount: 1,
        invoiceId: input.invoiceId,
        resolutionId: `billing-review-${input.idempotencyKey}`,
        resolutionType: "invoice_void_and_rebill",
      };
      commands.set(key, { request, resolution });
      return { ok: true, resolution };
    },
  };
}

function createDemoPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    memberships: [
      {
        id: "membership-front-desk",
        permissionRole: {
          key: "billing-review",
          label: "Billing review",
          permissionIds: ["billing:issue"],
          roleType: "custom",
        },
        roles: ["front_desk"],
        status: "active",
        userId: "user-front-desk",
        workspaceId: "clair-demo",
      },
    ],
    users: [{ id: "user-front-desk", status: "active" }],
  });
}

function mapDbError(message?: string): GatewayError {
  const errors: GatewayError[] = [
    "billing_review_not_required",
    "billing_review_resolution_in_progress",
    "idempotency_conflict",
    "invoice_lineage_unavailable",
    "invoice_unavailable",
    "refund_flow_required",
    "revision_conflict",
  ];
  return errors.find((error) => message?.includes(error)) ?? "db_write_failed";
}

function mapResolution(value: unknown): OrderBillingReviewResolution | null {
  if (!isRecord(value)) return null;
  if (
    !isRecord(value.after) ||
    !isRecord(value.before) ||
    typeof value.candidateCount !== "number" ||
    typeof value.invoiceId !== "string" ||
    typeof value.resolutionId !== "string" ||
    value.resolutionType !== "invoice_void_and_rebill"
  ) {
    return null;
  }
  return {
    after: value.after,
    before: value.before,
    candidateCount: value.candidateCount,
    invoiceId: value.invoiceId,
    resolutionId: value.resolutionId,
    resolutionType: value.resolutionType,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
