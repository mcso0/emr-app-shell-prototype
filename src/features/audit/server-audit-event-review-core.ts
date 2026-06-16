import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  LiveAuditEventRecord,
  LiveAuditEventType,
} from "@/features/audit/server-audit-log-persistence-core";

export type LiveAuditReviewFilter = {
  eventType?: string | null;
  limit?: number | null;
  query?: string | null;
};

export type LiveAuditReviewGatewayResult =
  | { ok: true; events: LiveAuditEventRecord[] }
  | { ok: false; status: 500; error: "db_read_failed" };

export type LiveAuditReviewGateway = {
  listEvents(input: {
    eventType?: LiveAuditEventType | null;
    limit: number;
    query?: string | null;
    workspaceId: string;
  }): Promise<LiveAuditReviewGatewayResult>;
};

export type LiveAuditReviewReadResult =
  | {
      ok: true;
      status: 200;
      events: LiveAuditEventRecord[];
      enforcedBy: "live-audit-review-reader";
    }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<"eventType" | "limit", string>> }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export async function readLiveAuditReviewEvents({
  actorUserId,
  filter = {},
  gateway = createMockLiveAuditReviewGateway(),
  permissionAdapter = createDemoAuditReviewPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  filter?: LiveAuditReviewFilter;
  gateway?: LiveAuditReviewGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<LiveAuditReviewReadResult> {
  const normalized = normalizeAuditReviewFilter(filter);
  if (!normalized.ok) return normalized;

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "role_permission:manage",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.listEvents({
    workspaceId,
    eventType: normalized.eventType,
    limit: normalized.limit,
    query: normalized.query,
  });

  if (!result.ok) return { ok: false, status: 500, error: "db_read_failed" };

  return {
    ok: true,
    status: 200,
    events: result.events,
    enforcedBy: "live-audit-review-reader",
  };
}

export function createMockLiveAuditReviewGateway(
  seed: LiveAuditEventRecord[] = mockLiveAuditReviewEvents
): LiveAuditReviewGateway {
  return {
    async listEvents({ eventType, limit, query, workspaceId }) {
      const normalizedQuery = query?.trim().toLowerCase() ?? "";
      const events = seed
        .filter((event) => event.workspaceId === workspaceId)
        .filter((event) => !eventType || event.eventType === eventType)
        .filter((event) => {
          if (!normalizedQuery) return true;

          return [
            event.actorUserId,
            event.eventType,
            event.targetId,
            event.targetType,
            event.encounterId,
            event.patientId,
            event.guardianId,
            event.requestId,
          ].some((value) => value?.toLowerCase().includes(normalizedQuery));
        })
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id))
        .slice(0, limit);

      return { ok: true, events };
    },
  };
}

export type SupabaseLiveAuditReviewRpcClient = {
  rpc(functionName: "clair_list_audit_events", args: {
    p_workspace_id: string;
    p_event_type: string | null;
    p_query: string | null;
    p_limit: number;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseLiveAuditReviewGateway(
  client: SupabaseLiveAuditReviewRpcClient
): LiveAuditReviewGateway {
  return {
    async listEvents({ eventType, limit, query, workspaceId }) {
      const { data, error } = await client.rpc("clair_list_audit_events", {
        p_workspace_id: workspaceId,
        p_event_type: eventType ?? null,
        p_query: query ?? null,
        p_limit: limit,
      });

      if (error) return { ok: false, status: 500, error: "db_read_failed" };

      const events = mapAuditReviewEvents(data);
      return events ? { ok: true, events } : { ok: false, status: 500, error: "db_read_failed" };
    },
  };
}

function normalizeAuditReviewFilter(filter: LiveAuditReviewFilter):
  | { ok: true; eventType: LiveAuditEventType | null; limit: number; query: string | null }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<"eventType" | "limit", string>> } {
  const fieldErrors: Partial<Record<"eventType" | "limit", string>> = {};
  const eventType = normalizeEventType(filter.eventType);
  const limit = typeof filter.limit === "number" && Number.isFinite(filter.limit)
    ? Math.round(filter.limit)
    : 50;

  if (filter.eventType && !eventType) fieldErrors.eventType = "Unsupported audit event type.";
  if (limit < 1 || limit > 100) fieldErrors.limit = "Limit must be between 1 and 100.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors };
  }

  return {
    ok: true,
    eventType,
    limit,
    query: trimToNull(filter.query),
  };
}

const supportedReviewEventTypes = new Set<LiveAuditEventType>([
  "workspace.membership_roles_changed",
  "workspace.membership_status_changed",
  "reception.walk_in_created",
  "reception.appointment_created",
  "reception.appointment_checked_in",
  "reception.encounter_cancelled",
  "reception.encounter_updated",
  "chart.soap_saved",
  "chart.completed",
  "order.confirmed",
  "order.billing_candidate_requested",
  "billing.payment_state_changed",
]);

function normalizeEventType(value?: string | null): LiveAuditEventType | null {
  const normalized = trimToNull(value);
  return normalized && supportedReviewEventTypes.has(normalized as LiveAuditEventType)
    ? normalized as LiveAuditEventType
    : null;
}

function createDemoAuditReviewPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

function mapAuditReviewEvents(value: unknown): LiveAuditEventRecord[] | null {
  const payload = value && typeof value === "object" ? value as { events?: unknown } : null;
  const rows = Array.isArray(payload?.events) ? payload.events : null;
  if (!rows) return null;

  const events = rows.map(mapAuditReviewEvent).filter((event): event is LiveAuditEventRecord => Boolean(event));
  return events.length === rows.length ? events : null;
}

function mapAuditReviewEvent(value: unknown): LiveAuditEventRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<LiveAuditEventRecord>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.eventType !== "string" ||
    typeof row.targetType !== "string" ||
    typeof row.targetId !== "string" ||
    typeof row.occurredAt !== "string" ||
    typeof row.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    actorUserId: trimToNull(row.actorUserId),
    actorMembershipId: trimToNull(row.actorMembershipId),
    eventType: row.eventType as LiveAuditEventRecord["eventType"],
    targetType: row.targetType as LiveAuditEventRecord["targetType"],
    targetId: row.targetId,
    encounterId: trimToNull(row.encounterId),
    patientId: trimToNull(row.patientId),
    guardianId: trimToNull(row.guardianId),
    requestId: trimToNull(row.requestId),
    occurredAt: row.occurredAt,
    reason: trimToNull(row.reason),
    before: isPlainObject(row.before) ? row.before : {},
    after: isPlainObject(row.after) ? row.after : {},
    metadata: isPlainObject(row.metadata) ? row.metadata : {},
    createdAt: row.createdAt,
  };
}

function trimToNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const mockLiveAuditReviewEvents: LiveAuditEventRecord[] = [
  {
    id: "audit-review-membership-role",
    workspaceId: "clair-demo",
    actorUserId: "user-admin",
    actorMembershipId: "membership-admin",
    eventType: "workspace.membership_roles_changed",
    targetType: "membership",
    targetId: "membership-vet",
    encounterId: null,
    patientId: null,
    guardianId: null,
    requestId: "req-review-role",
    occurredAt: "2026-05-20T12:00:00+09:00",
    reason: null,
    before: { roles: ["vet"] },
    after: { roles: ["vet", "technician"] },
    metadata: { source: "workspace-membership-role-route" },
    createdAt: "2026-05-20T12:00:00+09:00",
  },
  {
    id: "audit-review-soap-save",
    workspaceId: "clair-demo",
    actorUserId: "user-vet",
    actorMembershipId: "membership-vet",
    eventType: "chart.soap_saved",
    targetType: "soap_note",
    targetId: "soap-encounter-coco-260501",
    encounterId: "encounter-coco-260501",
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    requestId: "req-review-soap",
    occurredAt: "2026-05-20T12:05:00+09:00",
    reason: null,
    before: {},
    after: { mode: "manual_save", noteStatus: "draft" },
    metadata: { source: "chart-soap-note-persistence" },
    createdAt: "2026-05-20T12:05:00+09:00",
  },
  {
    id: "audit-review-order-confirmed",
    workspaceId: "clair-demo",
    actorUserId: "user-vet",
    actorMembershipId: "membership-vet",
    eventType: "order.confirmed",
    targetType: "order",
    targetId: "order-kong-maropitant",
    encounterId: "encounter-kong-260501",
    patientId: "patient-kong",
    guardianId: "guardian-kim-haneul",
    requestId: "req-review-order",
    occurredAt: "2026-05-20T12:10:00+09:00",
    reason: null,
    before: {},
    after: { orderConfirmationStatus: "confirmed", status: "confirmed" },
    metadata: { action: "confirm", source: "chart-order-action-persistence" },
    createdAt: "2026-05-20T12:10:00+09:00",
  },
  {
    id: "audit-review-payment-state",
    workspaceId: "clair-demo",
    actorUserId: "user-tech",
    actorMembershipId: "membership-tech",
    eventType: "billing.payment_state_changed",
    targetType: "invoice",
    targetId: "invoice-kong-260501",
    encounterId: "encounter-kong-260501",
    patientId: "patient-kong",
    guardianId: "guardian-kim-haneul",
    requestId: "req-review-payment",
    occurredAt: "2026-05-20T12:15:00+09:00",
    reason: null,
    before: {},
    after: { invoiceStatus: "paid", paymentState: "paid", selectedPaymentMethod: "card" },
    metadata: { action: "complete_payment", source: "billing-payment-status-persistence" },
    createdAt: "2026-05-20T12:15:00+09:00",
  },
];
