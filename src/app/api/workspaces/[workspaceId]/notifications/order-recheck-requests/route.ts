import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  createDemoNotificationPermissionAdapter,
  emitLiveNotificationEvent,
  type LiveNotificationEventInput,
} from "@/features/notifications/server-notifications";
import {
  emitPersistedLiveNotificationEvent,
  type NotificationPersistenceEmitResult,
  type NotificationPersistenceGateway,
} from "@/features/notifications/server-notification-persistence";
import { resolveNotificationRouteActor } from "@/features/notifications/server-notifications-route";
import type { GlobalNotification } from "@/features/notifications/mock-notifications";
import type { PermissionId } from "@/types/emr-domain";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

type RecheckSourceDomain = "chart" | "dispensing_treatment" | "imaging" | "lab";

type OrderRecheckRequestInput = {
  orderLabel: string;
  patientLabel?: string;
  reason: string;
  recipient: GlobalNotification["recipient"];
  requesterLabel: string;
  requesterRoleLabel?: string;
  sourceDomain: RecheckSourceDomain;
  sourceEntityId: string;
  sourceKind: Extract<
    GlobalNotification["source"]["kind"],
    "dispensing_treatment" | "imaging_result" | "lab_result" | "order"
  >;
  sourceRoute: string;
};

const sourceDomainPermissionIds: Record<RecheckSourceDomain, PermissionId[]> = {
  chart: ["chart:update"],
  dispensing_treatment: ["chart:update", "dispensing:complete"],
  imaging: ["chart:update", "imaging:complete"],
  lab: ["chart:update", "lab:complete"],
};

const roleQueueLabels: Record<string, string> = {
  dispensing_treatment: "조제/처치",
  imaging: "영상",
  inpatient: "입원",
  lab: "임상병리검사",
  vet: "수의사",
};

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const actor = await resolveNotificationRouteActor({
    request,
    workspaceId,
    mutationRateLimitOperation: "notification_order_recheck_request",
  });

  if (!actor.ok) return actor.response;

  const input = await readOrderRecheckRequestBody(request, workspaceId);
  if (!input.ok) {
    return Response.json(
      {
        ok: false,
        status: 400,
        error: "invalid_order_recheck_request_payload",
      },
      { status: 400 },
    );
  }

  const permission = resolveOrderRecheckRequestPermission({
    actorUserId: actor.actorUserId,
    permissionAdapter:
      actor.permissionAdapter ?? createDemoNotificationPermissionAdapter(),
    sourceDomain: input.value.sourceDomain,
    workspaceId,
  });
  if (!permission.ok) {
    return Response.json(
      {
        ok: false,
        status: permission.status,
        denialReason: permission.denialReason,
      },
      { status: permission.status },
    );
  }

  const recipient = resolveOrderRecheckRecipient({
    permissionAdapter:
      actor.permissionAdapter ?? createDemoNotificationPermissionAdapter(),
    recipient: input.value.recipient,
    workspaceId,
  });
  if (!recipient.ok) {
    return Response.json(
      {
        ok: false,
        status: 400,
        error: recipient.error,
      },
      { status: 400 },
    );
  }

  const emittedNotification = await emitOrderRecheckRequestedNotification({
    actorUserId: actor.actorUserId,
    eventScopeId: actor.eventScopeId,
    input: input.value,
    notificationPersistenceGateway: actor.notificationPersistenceGateway,
    workspaceId,
  });
  if (!emittedNotification.ok) {
    return Response.json(
      {
        ok: false,
        status: emittedNotification.status,
        ...(emittedNotification.denialReason
          ? { denialReason: emittedNotification.denialReason }
          : {}),
        ...(emittedNotification.error ? { error: emittedNotification.error } : {}),
      },
      { status: emittedNotification.status },
    );
  }

  return Response.json(
    {
      ok: true,
      status: 200,
      emittedNotifications: { orderRecheckRequested: 1 },
      notificationId: emittedNotification.notification.id,
      enforcedBy: "order-recheck-request-notification-boundary",
    },
    { status: 200 },
  );
}

async function emitOrderRecheckRequestedNotification({
  actorUserId,
  eventScopeId,
  input,
  notificationPersistenceGateway,
  workspaceId,
}: {
  actorUserId: string;
  eventScopeId?: string | null;
  input: OrderRecheckRequestInput;
  notificationPersistenceGateway?: NotificationPersistenceGateway;
  workspaceId: string;
}): Promise<
  | { ok: true; notification: GlobalNotification }
  | Extract<NotificationPersistenceEmitResult, { ok: false }>
> {
  const event = buildOrderRecheckRequestedNotificationEvent({
    actorUserId,
    eventScopeId,
    input,
    workspaceId,
  });

  if (notificationPersistenceGateway) {
    const result = await emitPersistedLiveNotificationEvent({
      event,
      gateway: notificationPersistenceGateway,
    });
    if (!result.ok) return result;
    return { ok: true, notification: result.notification };
  }

  const result = emitLiveNotificationEvent({ event });
  return { ok: true, notification: result.notification };
}

function buildOrderRecheckRequestedNotificationEvent({
  actorUserId,
  eventScopeId,
  input,
  workspaceId,
}: {
  actorUserId: string;
  eventScopeId?: string | null;
  input: OrderRecheckRequestInput;
  workspaceId: string;
}): LiveNotificationEventInput {
  const titlePrefix = input.patientLabel ? `${input.patientLabel} ` : "";
  const detail = `${input.requesterLabel}가 ${input.reason} 확인을 요청했습니다. 원본 오더에서 재확인 사유를 확인하세요.`;

  return {
    workspaceId,
    eventKey: "order_recheck_requested",
    dedupeKey: `${input.sourceEntityId}-order_recheck_requested`,
    domain: input.sourceDomain,
    priority: "high",
    toastPolicy: "role_active",
    title: `${titlePrefix}${input.orderLabel} 재확인을 진행해 주세요`,
    preview: `${input.requesterLabel}가 ${input.reason} 확인을 요청했습니다.`,
    detail,
    workTypeLabel: getWorkTypeLabel(input.sourceDomain),
    sourceLabel: `${getWorkTypeLabel(input.sourceDomain)} 오더 · ${input.orderLabel}`,
    sourceActionLabel: "오더 열기",
    recipient: input.recipient,
    source: {
      kind: input.sourceKind,
      route: input.sourceRoute,
      entity_id: input.sourceEntityId,
    },
    requiresAction: true,
    badgeCount: true,
    actorUserId,
    eventScopeId,
    occurredAt: new Date().toISOString(),
    issuedAtLabel: "방금 전",
  };
}

function resolveOrderRecheckRecipient({
  permissionAdapter,
  recipient,
  workspaceId,
}: {
  permissionAdapter: WorkspacePermissionAdapter;
  recipient: GlobalNotification["recipient"];
  workspaceId: string;
}): { ok: true } | { ok: false; error: "recipient_unavailable" } {
  if (recipient.kind !== "user") return { ok: true };

  const user = permissionAdapter.users.find((item) => item.id === recipient.id);
  const membership = permissionAdapter.memberships.find(
    (item) =>
      item.workspaceId === workspaceId &&
      item.userId === recipient.id &&
      item.status === "active",
  );

  if (!membership || user?.status !== "active") {
    return { ok: false, error: "recipient_unavailable" };
  }

  return { ok: true };
}

function resolveOrderRecheckRequestPermission({
  actorUserId,
  permissionAdapter,
  sourceDomain,
  workspaceId,
}: {
  actorUserId: string;
  permissionAdapter: WorkspacePermissionAdapter;
  sourceDomain: RecheckSourceDomain;
  workspaceId: string;
}):
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason | "permission_missing";
    } {
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

  const requiredAnyPermissionIds = sourceDomainPermissionIds[sourceDomain];
  if (
    !requiredAnyPermissionIds.some((permissionId) =>
      permission.effectivePermissionIds.includes(permissionId),
    )
  ) {
    return { ok: false, status: 403, denialReason: "permission_missing" };
  }

  return { ok: true };
}

async function readOrderRecheckRequestBody(
  request: Request,
  workspaceId: string,
): Promise<
  | { ok: true; value: OrderRecheckRequestInput }
  | { ok: false }
> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object") return { ok: false };

    const row = value as Record<string, unknown>;
    const sourceDomain = readSourceDomain(row.sourceDomain);
    const sourceKind = readSourceKind(row.sourceKind);
    const sourceEntityId = readSafeToken(row.sourceEntityId, 120);
    const sourceRoute = readWorkspaceRoute(row.sourceRoute, workspaceId);
    const orderLabel = readBoundedString(row.orderLabel, 80);
    const reason = readBoundedString(row.reason, 160);
    const recipient = readRecipient(row.recipient);
    if (
      !sourceDomain ||
      !sourceKind ||
      !sourceEntityId ||
      !sourceRoute ||
      !orderLabel ||
      !reason ||
      !recipient
    ) {
      return { ok: false };
    }

    const patientLabel = readBoundedString(row.patientLabel, 40);
    const requesterRoleLabel = readBoundedString(row.requesterRoleLabel, 40);

    return {
      ok: true,
      value: {
        orderLabel,
        ...(patientLabel ? { patientLabel } : {}),
        reason,
        recipient,
        requesterLabel:
          readBoundedString(row.requesterLabel, 60) ?? "요청자",
        ...(requesterRoleLabel ? { requesterRoleLabel } : {}),
        sourceDomain,
        sourceEntityId,
        sourceKind,
        sourceRoute,
      },
    };
  } catch {
    return { ok: false };
  }
}

function readSourceDomain(value: unknown): RecheckSourceDomain | null {
  if (
    value === "chart" ||
    value === "dispensing_treatment" ||
    value === "imaging" ||
    value === "lab"
  ) {
    return value;
  }

  return null;
}

function readSourceKind(value: unknown): OrderRecheckRequestInput["sourceKind"] | null {
  if (
    value === "dispensing_treatment" ||
    value === "imaging_result" ||
    value === "lab_result" ||
    value === "order"
  ) {
    return value;
  }

  return null;
}

function readRecipient(value: unknown): GlobalNotification["recipient"] | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const kind = row.kind;
  const id = readSafeToken(row.id, 80);
  if (!id) return null;

  if (kind === "role_queue") {
    const fallbackLabel = roleQueueLabels[id];
    if (!fallbackLabel) return null;

    return {
      kind,
      id,
      label: readBoundedString(row.label, 40) ?? fallbackLabel,
    };
  }

  if (kind === "user") {
    return {
      kind,
      id,
      label: readBoundedString(row.label, 40) ?? "담당자",
    };
  }

  return null;
}

function readWorkspaceRoute(value: unknown, workspaceId: string) {
  const route = readBoundedString(value, 240);
  if (!route) return null;
  if (!route.startsWith(`/w/${workspaceId}/`)) return null;
  if (route.includes("\n") || route.includes("\r")) return null;

  return route;
}

function readSafeToken(value: unknown, maxLength: number) {
  const token = readBoundedString(value, maxLength);
  if (!token) return null;
  if (!/^[a-zA-Z0-9:_-]+$/.test(token)) return null;

  return token;
}

function readBoundedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;

  return normalized.slice(0, maxLength);
}

function getWorkTypeLabel(sourceDomain: RecheckSourceDomain) {
  if (sourceDomain === "chart") return "진료";
  if (sourceDomain === "dispensing_treatment") return "조제/처치";
  if (sourceDomain === "imaging") return "영상";
  return "검사";
}
