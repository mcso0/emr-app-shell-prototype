import { createHash } from "node:crypto";

export const liveAuditEventTypes = [
  "workspace.created",
  "workspace.invitation_created",
  "workspace.invitation_resent",
  "workspace.invitation_canceled",
  "workspace.invitation_accepted",
  "workspace.membership_roles_changed",
  "workspace.membership_status_changed",
  "workspace.last_admin_change_blocked",
  "user.profile_updated",
  "reception.patient_guardian_registered",
  "reception.walk_in_created",
  "reception.appointment_checked_in",
  "reception.queue_status_changed",
  "chart.soap_saved",
  "chart.completed",
  "diagnosis.changed",
  "order.draft_changed",
  "order.confirmed",
  "order.billing_candidate_requested",
  "order.status_changed",
  "billing.invoice_candidate_generated",
  "billing.invoice_line_changed",
  "billing.invoice_issued",
  "billing.payment_state_changed",
  "billing.refund_requested",
] as const;

export type LiveAuditEventType = (typeof liveAuditEventTypes)[number];

export type LiveAuditTargetType =
  | "workspace"
  | "workspace_invitation"
  | "membership"
  | "user_profile"
  | "patient"
  | "guardian"
  | "encounter"
  | "waiting_queue_entry"
  | "soap_note"
  | "diagnosis"
  | "order"
  | "invoice"
  | "invoice_line"
  | "payment";

export type LiveAuditSnapshot = Record<string, unknown>;

export type LiveAuditEventInput = {
  id?: string;
  workspaceId: string;
  actorUserId?: string | null;
  actorMembershipId?: string | null;
  eventType: LiveAuditEventType;
  targetType: LiveAuditTargetType;
  targetId: string;
  encounterId?: string | null;
  patientId?: string | null;
  guardianId?: string | null;
  requestId?: string | null;
  occurredAt?: string | null;
  reason?: string | null;
  before?: LiveAuditSnapshot;
  after?: LiveAuditSnapshot;
  metadata?: LiveAuditSnapshot;
};

export type LiveAuditEventRecord = Required<
  Pick<LiveAuditEventInput, "id" | "workspaceId" | "eventType" | "targetType" | "targetId">
> &
  Omit<LiveAuditEventInput, "id" | "workspaceId" | "eventType" | "targetType" | "targetId" | "occurredAt"> & {
    occurredAt: string;
    before: LiveAuditSnapshot;
    after: LiveAuditSnapshot;
    metadata: LiveAuditSnapshot;
    createdAt: string;
  };

export type LiveAuditAppendGatewayResult =
  | { ok: true; event: LiveAuditEventRecord }
  | { ok: false; status: 409; error: "workspace_membership_missing" }
  | { ok: false; status: 500; error: "db_write_failed" };

export type LiveAuditAppendGateway = {
  appendEvent(input: LiveAuditEventRecord): Promise<LiveAuditAppendGatewayResult>;
};

export type LiveAuditAppendResult =
  | { ok: true; status: 201; event: LiveAuditEventRecord; enforcedBy: "live-audit-append-helper" }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<keyof LiveAuditEventInput, string>> }
  | { ok: false; status: 400; error: "sensitive_audit_payload"; fieldErrors: Partial<Record<"before" | "after" | "metadata" | "reason", string>> }
  | { ok: false; status: 409; error: "workspace_membership_missing" }
  | { ok: false; status: 500; error: "db_write_failed" };

const liveAuditEventTypeSet = new Set<string>(liveAuditEventTypes);
const sensitiveKeyPattern =
  /(authorization|cookie|password|secret|service[_-]?role|token|api[_-]?key|db[_-]?password|raw[_-]?payload|stack[_-]?trace|sql[_-]?error|full[_-]?soap|full[_-]?chart)/i;

export async function appendLiveAuditEvent({
  gateway = createMockLiveAuditAppendGateway(),
  input,
  now = () => new Date().toISOString(),
}: {
  gateway?: LiveAuditAppendGateway;
  input: LiveAuditEventInput;
  now?: () => string;
}): Promise<LiveAuditAppendResult> {
  const normalized = normalizeLiveAuditEvent(input, now);
  if (!normalized.ok) return normalized;

  const sensitiveCheck = findSensitiveAuditPayload(normalized.event);
  if (sensitiveCheck) {
    return {
      ok: false,
      status: 400,
      error: "sensitive_audit_payload",
      fieldErrors: { [sensitiveCheck.root]: `Audit payload contains forbidden sensitive key: ${sensitiveCheck.path}` },
    };
  }

  const result = await gateway.appendEvent(normalized.event);
  if (!result.ok) return result.status === 409 ? result : { ok: false, status: 500, error: "db_write_failed" };

  return { ok: true, status: 201, event: result.event, enforcedBy: "live-audit-append-helper" };
}

export function buildLiveAuditEventId(input: Omit<LiveAuditEventRecord, "id" | "createdAt">) {
  const digest = createHash("sha256")
    .update(
      stableStringify({
        workspaceId: input.workspaceId,
        eventType: input.eventType,
        targetType: input.targetType,
        targetId: input.targetId,
        actorUserId: input.actorUserId ?? null,
        occurredAt: input.occurredAt,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
      })
    )
    .digest("hex")
    .slice(0, 24);

  return `audit_${digest}`;
}

export function createMockLiveAuditAppendGateway(
  seed: LiveAuditEventRecord[] = []
): LiveAuditAppendGateway & { events: LiveAuditEventRecord[] } {
  const events = [...seed];

  return {
    events,
    async appendEvent(input) {
      const index = events.findIndex((event) => event.id === input.id);
      if (index >= 0) {
        events[index] = input;
      } else {
        events.push(input);
      }
      events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));

      return { ok: true, event: input };
    },
  };
}

export type SupabaseLiveAuditAppendRpcClient = {
  rpc(functionName: "clair_append_audit_event", args: {
    p_id: string;
    p_workspace_id: string;
    p_actor_user_id: string | null;
    p_actor_membership_id: string | null;
    p_event_type: string;
    p_target_type: string;
    p_target_id: string;
    p_encounter_id: string | null;
    p_patient_id: string | null;
    p_guardian_id: string | null;
    p_request_id: string | null;
    p_reason: string | null;
    p_before_snapshot: LiveAuditSnapshot;
    p_after_snapshot: LiveAuditSnapshot;
    p_metadata: LiveAuditSnapshot;
    p_occurred_at: string;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseLiveAuditAppendGateway(client: SupabaseLiveAuditAppendRpcClient): LiveAuditAppendGateway {
  return {
    async appendEvent(input) {
      const { data, error } = await client.rpc("clair_append_audit_event", {
        p_id: input.id,
        p_workspace_id: input.workspaceId,
        p_actor_user_id: input.actorUserId ?? null,
        p_actor_membership_id: input.actorMembershipId ?? null,
        p_event_type: input.eventType,
        p_target_type: input.targetType,
        p_target_id: input.targetId,
        p_encounter_id: input.encounterId ?? null,
        p_patient_id: input.patientId ?? null,
        p_guardian_id: input.guardianId ?? null,
        p_request_id: input.requestId ?? null,
        p_reason: input.reason ?? null,
        p_before_snapshot: input.before,
        p_after_snapshot: input.after,
        p_metadata: input.metadata,
        p_occurred_at: input.occurredAt,
      });

      if (error) {
        return error.message?.includes("workspace_membership_missing")
          ? { ok: false, status: 409, error: "workspace_membership_missing" }
          : { ok: false, status: 500, error: "db_write_failed" };
      }

      const event = mapLiveAuditEventRecord(data);
      return event ? { ok: true, event } : { ok: false, status: 500, error: "db_write_failed" };
    },
  };
}

function normalizeLiveAuditEvent(
  input: LiveAuditEventInput,
  now: () => string
):
  | { ok: true; event: LiveAuditEventRecord }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: Partial<Record<keyof LiveAuditEventInput, string>> } {
  const fieldErrors: Partial<Record<keyof LiveAuditEventInput, string>> = {};
  const workspaceId = trimToUndefined(input.workspaceId);
  const targetId = trimToUndefined(input.targetId);
  const targetType = trimToUndefined(input.targetType);
  const occurredAt = trimToUndefined(input.occurredAt) ?? now();

  if (!workspaceId) fieldErrors.workspaceId = "workspaceId is required.";
  if (!targetId) fieldErrors.targetId = "targetId is required.";
  if (!targetType) fieldErrors.targetType = "targetType is required.";
  if (!liveAuditEventTypeSet.has(input.eventType)) fieldErrors.eventType = "Unsupported audit event type.";
  if (!isPlainObject(input.before ?? {})) fieldErrors.before = "before must be a JSON object.";
  if (!isPlainObject(input.after ?? {})) fieldErrors.after = "after must be a JSON object.";
  if (!isPlainObject(input.metadata ?? {})) fieldErrors.metadata = "metadata must be a JSON object.";

  if (Object.keys(fieldErrors).length > 0 || !workspaceId || !targetId || !targetType) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors };
  }

  const recordWithoutId = {
    workspaceId,
    actorUserId: trimToUndefined(input.actorUserId) ?? null,
    actorMembershipId: trimToUndefined(input.actorMembershipId) ?? null,
    eventType: input.eventType,
    targetType: targetType as LiveAuditTargetType,
    targetId,
    encounterId: trimToUndefined(input.encounterId) ?? null,
    patientId: trimToUndefined(input.patientId) ?? null,
    guardianId: trimToUndefined(input.guardianId) ?? null,
    requestId: trimToUndefined(input.requestId) ?? null,
    occurredAt,
    reason: trimToUndefined(input.reason) ?? null,
    before: input.before ?? {},
    after: input.after ?? {},
    metadata: input.metadata ?? {},
  };

  return {
    ok: true,
    event: {
      ...recordWithoutId,
      id: trimToUndefined(input.id) ?? buildLiveAuditEventId(recordWithoutId),
      createdAt: occurredAt,
    },
  };
}

function findSensitiveAuditPayload(
  event: LiveAuditEventRecord
): { root: "before" | "after" | "metadata" | "reason"; path: string } | null {
  for (const root of ["before", "after", "metadata"] as const) {
    const match = findSensitiveKey(event[root], root);
    if (match) return { root, path: match };
  }

  if (event.reason && sensitiveKeyPattern.test(event.reason)) {
    return { root: "reason", path: "reason" };
  }

  return null;
}

function findSensitiveKey(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findSensitiveKey(value[index], `${path}[${index}]`);
      if (match) return match;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    const normalizedKey = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    if (sensitiveKeyPattern.test(normalizedKey)) return childPath;
    const match = findSensitiveKey(child, childPath);
    if (match) return match;
  }

  return null;
}

function mapLiveAuditEventRecord(value: unknown): LiveAuditEventRecord | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const workspaceId = asString(value.workspaceId);
  const eventType = asString(value.eventType);
  const targetType = asString(value.targetType);
  const targetId = asString(value.targetId);
  const occurredAt = asString(value.occurredAt);
  const createdAt = asString(value.createdAt) ?? occurredAt;

  if (!id || !workspaceId || !eventType || !targetType || !targetId || !occurredAt) return null;
  if (!liveAuditEventTypeSet.has(eventType)) return null;

  return {
    id,
    workspaceId,
    actorUserId: asString(value.actorUserId),
    actorMembershipId: asString(value.actorMembershipId),
    eventType: eventType as LiveAuditEventType,
    targetType: targetType as LiveAuditTargetType,
    targetId,
    encounterId: asString(value.encounterId),
    patientId: asString(value.patientId),
    guardianId: asString(value.guardianId),
    requestId: asString(value.requestId),
    occurredAt,
    reason: asString(value.reason),
    before: isPlainObject(value.before) ? value.before : {},
    after: isPlainObject(value.after) ? value.after : {},
    metadata: isPlainObject(value.metadata) ? value.metadata : {},
    createdAt: createdAt ?? occurredAt,
  };
}

function trimToUndefined(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
    .join(",")}}`;
}
