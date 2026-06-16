import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "@/lib/emr-domain/demo-workspaces";

export type DemoSessionResetCounts = {
  appointments: number;
  encounters: number;
  waitingQueueEntries: number;
  soapNotes: number;
  diagnoses: number;
  orderGroups: number;
  orders: number;
  fulfillmentWorkItems: number;
  billingCheckoutSessions: number;
  billingCheckoutSessionInvoices: number;
  billingInvoiceStatusEvents: number;
  invoiceAdjustments: number;
  paymentAllocations: number;
  invoices: number;
  invoiceLines: number;
  payments: number;
  generatedPatients: number;
  generatedGuardians: number;
};

export type DemoSessionResetMode = "remote_supabase" | "local_only";

export type DemoSessionResetGatewayResult =
  | {
      ok: true;
      counts: DemoSessionResetCounts;
      mode: "remote_supabase";
    }
  | {
      ok: false;
      status: 403;
      denialReason:
        | "workspace_membership_missing"
        | "workspace_admin_required"
        | "actor_mismatch"
        | "unsupported_workspace";
    }
  | { ok: false; status: 500; error: "db_reset_failed" };

export type DemoSessionResetGateway = {
  resetSession(input: {
    actorUserId: string;
    workspaceId: string;
  }): Promise<DemoSessionResetGatewayResult>;
};

export type DemoSessionResetResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      counts: DemoSessionResetCounts;
      mode: DemoSessionResetMode;
      enforcedBy: "demo-session-reset";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason:
        | WorkspacePermissionDenialReason
        | "unsupported_workspace"
        | "workspace_admin_required"
        | "actor_mismatch";
    }
  | {
      ok: false;
      status: 500;
      error: "db_reset_failed";
    };

export type SupabaseDemoSessionResetRpcClient = {
  rpc(
    functionName: "clair_reset_cheongdam_demo_session",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

const emptyResetCounts: DemoSessionResetCounts = {
  appointments: 0,
  encounters: 0,
  waitingQueueEntries: 0,
  soapNotes: 0,
  diagnoses: 0,
  orderGroups: 0,
  orders: 0,
  fulfillmentWorkItems: 0,
  billingCheckoutSessions: 0,
  billingCheckoutSessionInvoices: 0,
  billingInvoiceStatusEvents: 0,
  invoiceAdjustments: 0,
  paymentAllocations: 0,
  invoices: 0,
  invoiceLines: 0,
  payments: 0,
  generatedPatients: 0,
  generatedGuardians: 0,
};

export async function resetDemoSession({
  actorUserId,
  gateway,
  permissionAdapter = createDemoSessionResetPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: DemoSessionResetGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<DemoSessionResetResult> {
  if (workspaceId !== PREPARED_EMPTY_CLINIC_WORKSPACE_ID) {
    return { ok: false, status: 403, denialReason: "unsupported_workspace" };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  if (!permission.hasFullWorkspaceAccess) {
    return { ok: false, status: 403, denialReason: "workspace_admin_required" };
  }

  if (!gateway) {
    return {
      ok: true,
      status: 200,
      workspaceId,
      counts: emptyResetCounts,
      mode: "local_only",
      enforcedBy: "demo-session-reset",
    };
  }

  const result = await gateway.resetSession({
    actorUserId: actorUserId ?? "",
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 403) {
      return {
        ok: false,
        status: 403,
        denialReason: result.denialReason,
      };
    }

    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    workspaceId,
    counts: result.counts,
    mode: result.mode,
    enforcedBy: "demo-session-reset",
  };
}

export function createSupabaseDemoSessionResetGateway(
  client: SupabaseDemoSessionResetRpcClient
): DemoSessionResetGateway {
  return {
    async resetSession({ actorUserId, workspaceId }) {
      const { data, error } = await client.rpc("clair_reset_cheongdam_demo_session", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
      });

      if (error) {
        const denialReason = mapResetDbDenial(error.message);
        if (denialReason) return { ok: false, status: 403, denialReason };
        return { ok: false, status: 500, error: "db_reset_failed" };
      }

      const counts = mapResetCounts(data);
      if (!counts) return { ok: false, status: 500, error: "db_reset_failed" };

      return {
        ok: true,
        counts,
        mode: "remote_supabase",
      };
    },
  };
}

function createDemoSessionResetPermissionAdapter(): WorkspacePermissionAdapter {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-admin", status: "active" }],
    memberships: [
      {
        id: "membership-cheongdam-admin",
        workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });
}

function mapResetDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("unsupported_workspace")) return "unsupported_workspace" as const;
  if (message.includes("workspace_membership_missing")) {
    return "workspace_membership_missing" as const;
  }
  if (message.includes("workspace_admin_required")) {
    return "workspace_admin_required" as const;
  }
  if (message.includes("actor_mismatch")) return "actor_mismatch" as const;
  return null;
}

function mapResetCounts(value: unknown): DemoSessionResetCounts | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  return {
    appointments: getNumber(row.appointments),
    encounters: getNumber(row.encounters),
    waitingQueueEntries: getNumber(row.waitingQueueEntries ?? row.waiting_queue_entries),
    soapNotes: getNumber(row.soapNotes ?? row.soap_notes),
    diagnoses: getNumber(row.diagnoses),
    orderGroups: getNumber(row.orderGroups ?? row.order_groups),
    orders: getNumber(row.orders),
    fulfillmentWorkItems: getNumber(
      row.fulfillmentWorkItems ?? row.fulfillment_work_items
    ),
    billingCheckoutSessions: getNumber(
      row.billingCheckoutSessions ?? row.billing_checkout_sessions
    ),
    billingCheckoutSessionInvoices: getNumber(
      row.billingCheckoutSessionInvoices ?? row.billing_checkout_session_invoices
    ),
    billingInvoiceStatusEvents: getNumber(
      row.billingInvoiceStatusEvents ?? row.billing_invoice_status_events
    ),
    invoiceAdjustments: getNumber(row.invoiceAdjustments ?? row.invoice_adjustments),
    paymentAllocations: getNumber(row.paymentAllocations ?? row.payment_allocations),
    invoices: getNumber(row.invoices),
    invoiceLines: getNumber(row.invoiceLines ?? row.invoice_lines),
    payments: getNumber(row.payments),
    generatedPatients: getNumber(row.generatedPatients ?? row.generated_patients),
    generatedGuardians: getNumber(row.generatedGuardians ?? row.generated_guardians),
  };
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
