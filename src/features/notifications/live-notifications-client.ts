import type { GlobalNotification } from "@/features/notifications/mock-notifications";

export type LiveNotificationCounts = {
  badge: number;
  unread: number;
  important: number;
  archived: number;
};

type LiveNotificationDto = {
  id: string;
  eventKey: GlobalNotification["event_key"];
  dedupeKey: string;
  domain: GlobalNotification["domain"];
  priority: GlobalNotification["priority"];
  requiresAction: boolean;
  badgeCount: boolean;
  toastPolicy: GlobalNotification["toast_policy"];
  title: string;
  preview: string;
  detail: string;
  workTypeLabel: string;
  sourceLabel: string;
  sourceActionLabel: string;
  sourceKind: GlobalNotification["source"]["kind"];
  sourceEntityId: string | null;
  sourceRoute: string | null;
  recipientKind: GlobalNotification["recipient"]["kind"];
  recipientId: string;
  recipientLabel: string;
  fallbackReason?: NonNullable<GlobalNotification["source"]["fallback_reason"]>;
  issuedAtLabel: string;
  createdAt: string;
  updatedAt: string;
  bumpCount?: number;
  readAt: string | null;
  archivedAt: string | null;
};

type LiveNotificationListResponse =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      notifications: LiveNotificationDto[];
      counts: LiveNotificationCounts;
      nextCursor: string | null;
      enforcedBy: "live-notification-reader";
    }
  | {
      ok: false;
      status: number;
      workspaceId?: string;
      denialReason?: string;
      error?: {
        code?: string;
        message?: string;
        retryable?: boolean;
      };
    };

type LiveNotificationMutationResponse =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      notification?: LiveNotificationDto;
      counts: LiveNotificationCounts;
      updatedCount?: number;
      enforcedBy: "live-notification-writer";
    }
  | Extract<LiveNotificationListResponse, { ok: false }>;

type LiveNotificationClientError = {
  code: string;
  message: string;
  retryable: boolean;
  status: number;
};

type LiveNotificationFailure = {
  ok: false;
  aborted?: boolean;
  error: LiveNotificationClientError;
};

export type LiveNotificationSnapshotResult =
  | {
      ok: true;
      counts: LiveNotificationCounts;
      notifications: GlobalNotification[];
    }
  | LiveNotificationFailure;

export type LiveNotificationMutationResult =
  | {
      ok: true;
      counts: LiveNotificationCounts;
    }
  | LiveNotificationFailure;

export type LiveNotificationMutationAction = "read" | "archive" | "restore" | "read-all";

export const emptyLiveNotificationCounts: LiveNotificationCounts = {
  badge: 0,
  unread: 0,
  important: 0,
  archived: 0,
};

export async function fetchLiveNotificationSnapshot({
  actorHeaders,
  signal,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  signal?: AbortSignal;
  workspaceId: string;
}): Promise<LiveNotificationSnapshotResult> {
  try {
    return await fetchLiveNotificationList({
      actorHeaders,
      filter: "snapshot",
      signal,
      workspaceId,
    });
  } catch (error) {
    return buildClientError(error, "알림을 불러오지 못했습니다.");
  }
}

export async function mutateLiveNotification({
  action,
  actorHeaders,
  notificationId,
  signal,
  workspaceId,
}: {
  action: LiveNotificationMutationAction;
  actorHeaders?: Record<string, string>;
  notificationId?: string;
  signal?: AbortSignal;
  workspaceId: string;
}): Promise<LiveNotificationMutationResult> {
  try {
    const response = await fetch(getMutationRoute({ action, notificationId, workspaceId }), {
      cache: "no-store",
      headers: actorHeaders,
      method: "POST",
      signal,
    });
    const body = (await response.json()) as LiveNotificationMutationResponse;

    if (!response.ok || body.ok !== true) {
      const errorBody = body.ok === false ? body : createFallbackErrorBody(response.status);

      return {
        ok: false,
        error: normalizeResponseError({
          body: errorBody,
          fallbackMessage: "알림 상태를 변경하지 못했습니다.",
          status: response.status,
        }),
      };
    }

    return {
      ok: true,
      counts: body.counts,
    };
  } catch (error) {
    return buildClientError(error, "알림 상태를 변경하지 못했습니다.");
  }
}

async function fetchLiveNotificationList({
  actorHeaders,
  filter,
  signal,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  filter: "snapshot";
  signal?: AbortSignal;
  workspaceId: string;
}): Promise<LiveNotificationSnapshotResult> {
  const params = new URLSearchParams({
    filter,
    limit: "100",
  });
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/notifications?${params.toString()}`,
    {
      cache: "no-store",
      headers: actorHeaders,
      signal,
    },
  );
  const body = (await response.json()) as LiveNotificationListResponse;

  if (!response.ok || body.ok !== true) {
    const errorBody = body.ok === false ? body : createFallbackErrorBody(response.status);

    return {
      ok: false,
      error: normalizeResponseError({
        body: errorBody,
        fallbackMessage: "알림을 불러오지 못했습니다.",
        status: response.status,
      }),
    };
  }

  return {
    ok: true,
    counts: body.counts,
    notifications: body.notifications.map(mapLiveNotificationDto),
  };
}

function mapLiveNotificationDto(notification: LiveNotificationDto): GlobalNotification {
  return {
    id: notification.id,
    event_key: notification.eventKey,
    dedupe_key: notification.dedupeKey,
    domain: notification.domain,
    priority: notification.priority,
    toast_policy: notification.toastPolicy,
    sourceActionLabel: notification.sourceActionLabel,
    workTypeLabel: notification.workTypeLabel,
    title: notification.title,
    preview: notification.preview,
    detail: notification.detail,
    sourceLabel: notification.sourceLabel,
    recipientLabel: notification.recipientLabel,
    recipient: {
      kind: notification.recipientKind,
      id: notification.recipientId,
      label: notification.recipientLabel,
    },
    source: {
      kind: notification.sourceKind,
      ...(notification.sourceRoute ? { route: notification.sourceRoute } : {}),
      ...(notification.sourceEntityId ? { entity_id: notification.sourceEntityId } : {}),
      ...(notification.fallbackReason ? { fallback_reason: notification.fallbackReason } : {}),
    },
    ...(notification.fallbackReason ? { fallback_reason: notification.fallbackReason } : {}),
    ...(notification.bumpCount ? { bump_count: notification.bumpCount } : {}),
    issuedAtLabel: notification.issuedAtLabel,
    created_at: notification.createdAt,
    updated_at: notification.updatedAt,
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: !notification.readAt && !notification.archivedAt,
    archived: Boolean(notification.archivedAt),
    requires_action: notification.requiresAction,
    badge_count: notification.badgeCount,
  };
}

function getMutationRoute({
  action,
  notificationId,
  workspaceId,
}: {
  action: LiveNotificationMutationAction;
  notificationId?: string;
  workspaceId: string;
}) {
  const workspacePath = `/api/workspaces/${encodeURIComponent(workspaceId)}/notifications`;

  if (action === "read-all") return `${workspacePath}/read-all`;
  if (!notificationId) return `${workspacePath}/missing-notification/${action}`;

  return `${workspacePath}/${encodeURIComponent(notificationId)}/${action}`;
}

function normalizeResponseError({
  body,
  fallbackMessage,
  status,
}: {
  body: Extract<LiveNotificationListResponse, { ok: false }> | Extract<LiveNotificationMutationResponse, { ok: false }>;
  fallbackMessage: string;
  status: number;
}): LiveNotificationClientError {
  return {
    code: body.error?.code ?? body.denialReason ?? "notification_api_error",
    message: body.error?.message ?? fallbackMessage,
    retryable: body.error?.retryable ?? status >= 500,
    status,
  };
}

function createFallbackErrorBody(status: number): Extract<LiveNotificationListResponse, { ok: false }> {
  return {
    ok: false,
    status,
    error: {
      code: "notification_api_error",
      retryable: status >= 500,
    },
  };
}

function buildClientError(error: unknown, fallbackMessage: string): LiveNotificationFailure {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      ok: false,
      aborted: true,
      error: {
        code: "aborted",
        message: fallbackMessage,
        retryable: false,
        status: 0,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "network_error",
      message: fallbackMessage,
      retryable: true,
      status: 0,
    },
  };
}
