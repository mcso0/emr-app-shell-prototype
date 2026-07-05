import type { GlobalNotification } from "@/features/notifications/mock-notifications";
import {
  readLiveNotifications,
  type LiveNotificationDto,
  type LiveNotificationEventInput,
  type LiveNotificationEventStore,
  type LiveNotificationListResult,
  type LiveNotificationMutationResult,
  type LiveNotificationStateStore,
} from "@/features/notifications/server-notifications";
import type { WorkspacePermissionAdapter } from "@/features/auth/permission-resolver";

export type SupabaseNotificationPersistenceRpcClient = {
  rpc(
    functionName: "clair_emit_notification_event",
    args: {
      p_actor_user_id: string | null;
      p_event: Record<string, unknown>;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_list_notification_events",
    args: {
      p_event_scope_id?: string | null;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_list_notification_user_states",
    args: {
      p_actor_user_id: string;
      p_state_scope_id: string;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_upsert_notification_user_state",
    args: {
      p_actor_user_id: string;
      p_archived_at?: string | null;
      p_notification_id: string;
      p_read_at?: string | null;
      p_state_scope_id: string;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

type NotificationPersistenceError = {
  ok: false;
  status: 400 | 403 | 404 | 500;
  denialReason?:
    | "notification_actor_mismatch"
    | "permission_missing"
    | "workspace_membership_missing";
  error?:
    | "db_read_failed"
    | "db_write_failed"
    | "invalid_notification_event_payload"
    | "notification_not_found";
};

export type NotificationPersistenceEmitResult =
  | {
      ok: true;
      status: 200;
      action: "created" | "bumped" | "unchanged";
      notification: GlobalNotification;
      enforcedBy: "notification-event-persistence-gateway";
    }
  | NotificationPersistenceError;

export type NotificationPersistenceListResult =
  | {
      ok: true;
      status: 200;
      notifications: GlobalNotification[];
      enforcedBy: "notification-event-persistence-gateway";
    }
  | NotificationPersistenceError;

export type NotificationUserStatePersistenceResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "notification-user-state-persistence-gateway";
    }
  | NotificationPersistenceError;

export type NotificationUserStatePersistenceInput = {
  actorUserId: string;
  archivedAt?: string | null;
  notificationId: string;
  readAt?: string | null;
  stateScopeId: string;
  workspaceId: string;
};

export type PersistedNotificationUserState = {
  archivedAt: string | null;
  notificationId: string;
  readAt: string | null;
};

export type NotificationUserStateListResult =
  | {
      ok: true;
      status: 200;
      states: PersistedNotificationUserState[];
      enforcedBy: "notification-user-state-persistence-gateway";
    }
  | NotificationPersistenceError;

export type NotificationPersistenceGateway = ReturnType<
  typeof createSupabaseNotificationPersistenceGateway
>;

type PersistedNotificationReadInput = {
  actorUserId: string | null;
  eventScopeId?: string | null;
  filter?: string | null;
  gateway: NotificationPersistenceGateway;
  limit?: number | null;
  permissionAdapter?: WorkspacePermissionAdapter;
  stateScopeId?: string | null;
  workspaceId: string;
};

type PersistedNotificationMutationInput = Omit<
  PersistedNotificationReadInput,
  "actorUserId" | "filter" | "limit"
> & {
  actorUserId: string;
  notificationId: string;
};

export function createSupabaseNotificationPersistenceGateway(
  client: SupabaseNotificationPersistenceRpcClient,
) {
  return {
    async emitNotificationEvent(
      event: LiveNotificationEventInput,
    ): Promise<NotificationPersistenceEmitResult> {
      if (!event.actorUserId) {
        return { ok: false, status: 403, denialReason: "notification_actor_mismatch" };
      }

      const { data, error } = await client.rpc("clair_emit_notification_event", {
        p_workspace_id: event.workspaceId,
        p_actor_user_id: event.actorUserId,
        p_event: serializeNotificationEvent(event),
      });

      if (error) return mapSupabaseNotificationPersistenceError(error.message, "write");
      return normalizeEmitResponse(data);
    },

    async listNotificationEvents({
      eventScopeId,
      workspaceId,
    }: {
      eventScopeId?: string | null;
      workspaceId: string;
    }): Promise<NotificationPersistenceListResult> {
      const { data, error } = await client.rpc("clair_list_notification_events", {
        p_workspace_id: workspaceId,
        p_event_scope_id: eventScopeId ?? null,
      });

      if (error) return mapSupabaseNotificationPersistenceError(error.message, "read");
      return normalizeListResponse(data);
    },

    async listNotificationUserStates({
      actorUserId,
      stateScopeId,
      workspaceId,
    }: {
      actorUserId: string;
      stateScopeId: string;
      workspaceId: string;
    }): Promise<NotificationUserStateListResult> {
      const { data, error } = await client.rpc("clair_list_notification_user_states", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_state_scope_id: stateScopeId,
      });

      if (error) return mapSupabaseNotificationPersistenceError(error.message, "read");
      return normalizeUserStateListResponse(data);
    },

    async upsertNotificationUserState(
      input: NotificationUserStatePersistenceInput,
    ): Promise<NotificationUserStatePersistenceResult> {
      const { data, error } = await client.rpc("clair_upsert_notification_user_state", {
        p_workspace_id: input.workspaceId,
        p_actor_user_id: input.actorUserId,
        p_state_scope_id: input.stateScopeId,
        p_notification_id: input.notificationId,
        p_read_at: input.readAt ?? null,
        p_archived_at: input.archivedAt ?? null,
      });

      if (error) return mapSupabaseNotificationPersistenceError(error.message, "write");
      return normalizeUserStateResponse(data);
    },
  };
}

export async function emitPersistedLiveNotificationEvent({
  event,
  gateway,
}: {
  event: LiveNotificationEventInput;
  gateway: NotificationPersistenceGateway;
}): Promise<NotificationPersistenceEmitResult> {
  return gateway.emitNotificationEvent(event);
}

export async function readPersistedLiveNotifications({
  actorUserId,
  eventScopeId,
  filter = "all",
  gateway,
  limit = 20,
  permissionAdapter,
  stateScopeId,
  workspaceId,
}: PersistedNotificationReadInput): Promise<
  LiveNotificationListResult | NotificationPersistenceError
> {
  if (!actorUserId) {
    return buildPersistedNotificationError({
      code: "unauthenticated",
      message: "알림을 볼 세션이 없습니다.",
      status: 401,
      workspaceId,
    });
  }

  const rows = await readPersistedNotificationRows({
    actorUserId,
    eventScopeId,
    gateway,
    stateScopeId,
    workspaceId,
  });
  if (!rows.ok) return rows;

  return readLiveNotificationsFromPersistedRows({
    actorUserId,
    eventScopeId,
    filter,
    limit,
    notifications: rows.notifications,
    permissionAdapter,
    states: rows.states,
    stateScopeId,
    workspaceId,
  });
}

export async function readPersistedLiveNotificationCounts(
  input: Omit<PersistedNotificationReadInput, "filter" | "limit">,
) {
  const result = await readPersistedLiveNotifications({
    ...input,
    filter: "all",
    limit: 1,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    status: 200,
    workspaceId: input.workspaceId,
    counts: result.counts,
    enforcedBy: result.enforcedBy,
  };
}

export async function markPersistedLiveNotificationRead(
  input: PersistedNotificationMutationInput,
): Promise<LiveNotificationMutationResult | NotificationPersistenceError> {
  return mutatePersistedLiveNotification(input, ({ notification, now }) => ({
    readAt: notification.readAt ?? now,
    archivedAt: notification.archivedAt,
  }));
}

export async function archivePersistedLiveNotification(
  input: PersistedNotificationMutationInput,
): Promise<LiveNotificationMutationResult | NotificationPersistenceError> {
  return mutatePersistedLiveNotification(input, ({ now }) => ({
    readAt: now,
    archivedAt: now,
  }));
}

export async function restorePersistedLiveNotification(
  input: PersistedNotificationMutationInput,
): Promise<LiveNotificationMutationResult | NotificationPersistenceError> {
  return mutatePersistedLiveNotification(input, ({ notification }) => ({
    readAt: notification.readAt,
    archivedAt: null,
  }));
}

export async function markAllPersistedLiveNotificationsRead(
  input: Omit<PersistedNotificationMutationInput, "notificationId">,
): Promise<LiveNotificationMutationResult | NotificationPersistenceError> {
  const current = await readPersistedLiveNotifications({
    ...input,
    filter: "all",
    limit: 50,
  });
  if (!current.ok) return current;

  const now = new Date().toISOString();
  const unreadNotifications = current.notifications.filter(
    (notification) => !notification.archivedAt && !notification.readAt,
  );

  for (const notification of unreadNotifications) {
    const persisted = await input.gateway.upsertNotificationUserState({
      actorUserId: input.actorUserId,
      archivedAt: notification.archivedAt,
      notificationId: notification.id,
      readAt: now,
      stateScopeId: getPersistedStateScopeId(input),
      workspaceId: input.workspaceId,
    });
    if (!persisted.ok) return persisted;
  }

  const afterMutation = await readPersistedLiveNotifications({
    ...input,
    filter: "all",
    limit: 50,
  });
  if (!afterMutation.ok) return afterMutation;

  return {
    ok: true,
    status: 200,
    workspaceId: input.workspaceId,
    counts: afterMutation.counts,
    updatedCount: unreadNotifications.length,
    enforcedBy: "live-notification-writer",
  };
}

async function mutatePersistedLiveNotification(
  input: PersistedNotificationMutationInput,
  nextState: (input: {
    notification: LiveNotificationDto;
    now: string;
  }) => { archivedAt: string | null; readAt: string | null },
): Promise<LiveNotificationMutationResult | NotificationPersistenceError> {
  const current = await readPersistedLiveNotifications({
    ...input,
    filter: "all",
    limit: 50,
  });
  if (!current.ok) return current;

  const notification = current.notifications.find(
    (row) => row.id === input.notificationId,
  );
  if (!notification) {
    return buildPersistedNotificationError({
      code: "notification_not_found",
      message: "알림을 찾을 수 없습니다.",
      status: 404,
      workspaceId: input.workspaceId,
    });
  }

  const now = new Date().toISOString();
  const state = nextState({ notification, now });
  const persisted = await input.gateway.upsertNotificationUserState({
    actorUserId: input.actorUserId,
    archivedAt: state.archivedAt,
    notificationId: input.notificationId,
    readAt: state.readAt,
    stateScopeId: getPersistedStateScopeId(input),
    workspaceId: input.workspaceId,
  });
  if (!persisted.ok) return persisted;

  const rows = await readPersistedNotificationRows({
    actorUserId: input.actorUserId,
    eventScopeId: input.eventScopeId,
    gateway: input.gateway,
    stateScopeId: input.stateScopeId,
    workspaceId: input.workspaceId,
  });
  if (!rows.ok) return rows;

  const overrideStates = upsertPersistedState(rows.states, {
    archivedAt: state.archivedAt,
    notificationId: input.notificationId,
    readAt: state.readAt,
  });
  const afterMutation = await readLiveNotificationsFromPersistedRows({
    actorUserId: input.actorUserId,
    eventScopeId: input.eventScopeId,
    filter: "all",
    limit: 50,
    notifications: rows.notifications,
    permissionAdapter: input.permissionAdapter,
    states: overrideStates,
    stateScopeId: input.stateScopeId,
    workspaceId: input.workspaceId,
  });
  if (!afterMutation.ok) return afterMutation;

  return {
    ok: true,
    status: 200,
    workspaceId: input.workspaceId,
    notification: afterMutation.notifications.find(
      (row) => row.id === input.notificationId,
    ),
    counts: afterMutation.counts,
    enforcedBy: "live-notification-writer",
  };
}

async function readPersistedNotificationRows({
  actorUserId,
  eventScopeId,
  gateway,
  stateScopeId,
  workspaceId,
}: {
  actorUserId: string;
  eventScopeId?: string | null;
  gateway: NotificationPersistenceGateway;
  stateScopeId?: string | null;
  workspaceId: string;
}): Promise<
  | {
      ok: true;
      notifications: GlobalNotification[];
      states: PersistedNotificationUserState[];
    }
  | NotificationPersistenceError
> {
  const events = await gateway.listNotificationEvents({ eventScopeId, workspaceId });
  if (!events.ok) return events;

  const states = await gateway.listNotificationUserStates({
    actorUserId,
    stateScopeId: getPersistedStateScopeId({
      actorUserId,
      stateScopeId,
    }),
    workspaceId,
  });
  if (!states.ok) return states;

  return { ok: true, notifications: events.notifications, states: states.states };
}

function readLiveNotificationsFromPersistedRows({
  actorUserId,
  eventScopeId,
  filter,
  limit,
  notifications,
  permissionAdapter,
  states,
  stateScopeId,
  workspaceId,
}: {
  actorUserId: string;
  eventScopeId?: string | null;
  filter?: string | null;
  limit?: number | null;
  notifications: GlobalNotification[];
  permissionAdapter?: WorkspacePermissionAdapter;
  states: PersistedNotificationUserState[];
  stateScopeId?: string | null;
  workspaceId: string;
}) {
  return readLiveNotifications({
    actorUserId,
    eventScopeId,
    eventStore: emptyPersistedEventStore,
    filter,
    limit,
    notifications,
    permissionAdapter,
    stateScopeId,
    stateStore: createPersistedNotificationStateStore(states),
    workspaceId,
  });
}

const emptyPersistedEventStore: LiveNotificationEventStore = {
  emit() {
    throw new Error("Persisted notification route reader does not emit in-memory events.");
  },
  getWorkspaceNotifications() {
    return [];
  },
};

function createPersistedNotificationStateStore(
  states: PersistedNotificationUserState[],
): LiveNotificationStateStore {
  return {
    getUserState() {
      return {
        readAtById: new Map(
          states
            .filter((state) => state.readAt)
            .map((state) => [state.notificationId, state.readAt as string]),
        ),
        archivedAtById: new Map(
          states
            .filter((state) => state.archivedAt)
            .map((state) => [state.notificationId, state.archivedAt as string]),
        ),
      };
    },
  };
}

function getPersistedStateScopeId({
  actorUserId,
  stateScopeId,
}: {
  actorUserId: string;
  stateScopeId?: string | null;
}) {
  return stateScopeId?.trim() || actorUserId;
}

function upsertPersistedState(
  states: PersistedNotificationUserState[],
  nextState: PersistedNotificationUserState,
) {
  const existing = states.filter(
    (state) => state.notificationId !== nextState.notificationId,
  );
  return [...existing, nextState];
}

function serializeNotificationEvent(
  event: LiveNotificationEventInput,
): Record<string, unknown> {
  return {
    workspaceId: event.workspaceId,
    eventKey: event.eventKey,
    dedupeKey: event.dedupeKey,
    domain: event.domain,
    priority: event.priority,
    toastPolicy: event.toastPolicy ?? "role_active",
    title: event.title,
    preview: event.preview,
    detail: event.detail,
    workTypeLabel: event.workTypeLabel,
    sourceLabel: event.sourceLabel,
    sourceActionLabel: event.sourceActionLabel,
    recipient: event.recipient,
    source: event.source,
    requiresAction: event.requiresAction,
    badgeCount: event.badgeCount,
    actorUserId: event.actorUserId ?? null,
    eventScopeId: event.eventScopeId ?? null,
    fallbackReason: event.fallbackReason ?? null,
    id: event.id ?? null,
    issuedAtLabel: event.issuedAtLabel ?? "방금 전",
    occurredAt: event.occurredAt ?? null,
  };
}

function normalizeEmitResponse(data: unknown): NotificationPersistenceEmitResult {
  if (!isRecord(data) || data.ok !== true || !isGlobalNotification(data.notification)) {
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: readStatus(data.status),
    action: readAction(data.action),
    notification: data.notification,
    enforcedBy: "notification-event-persistence-gateway",
  };
}

function normalizeListResponse(data: unknown): NotificationPersistenceListResult {
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.notifications)) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: readStatus(data.status),
    notifications: data.notifications.filter(isGlobalNotification),
    enforcedBy: "notification-event-persistence-gateway",
  };
}

function normalizeUserStateListResponse(data: unknown): NotificationUserStateListResult {
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.states)) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: readStatus(data.status),
    states: data.states.filter(isPersistedNotificationUserState),
    enforcedBy: "notification-user-state-persistence-gateway",
  };
}

function normalizeUserStateResponse(
  data: unknown,
): NotificationUserStatePersistenceResult {
  if (!isRecord(data) || data.ok !== true) {
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: readStatus(data.status),
    enforcedBy: "notification-user-state-persistence-gateway",
  };
}

function buildPersistedNotificationError({
  code,
  message,
  status,
  workspaceId,
}: {
  code: "notification_not_found" | "unauthenticated";
  message: string;
  status: 401 | 404;
  workspaceId: string;
}) {
  return {
    ok: false,
    status,
    workspaceId,
    denialReason: code,
    error: {
      code,
      message,
      retryable: false,
    },
  } as const;
}

function mapSupabaseNotificationPersistenceError(
  message: string | undefined,
  operation: "read" | "write",
): NotificationPersistenceError {
  if (message?.includes("workspace_membership_missing")) {
    return { ok: false, status: 403, denialReason: "workspace_membership_missing" };
  }

  if (message?.includes("notification_actor_mismatch")) {
    return { ok: false, status: 403, denialReason: "notification_actor_mismatch" };
  }

  if (message?.includes("permission_missing")) {
    return { ok: false, status: 403, denialReason: "permission_missing" };
  }

  if (message?.includes("invalid_notification_event_payload")) {
    return { ok: false, status: 400, error: "invalid_notification_event_payload" };
  }

  if (message?.includes("notification_not_found")) {
    return { ok: false, status: 404, error: "notification_not_found" };
  }

  return {
    ok: false,
    status: 500,
    error: operation === "read" ? "db_read_failed" : "db_write_failed",
  };
}

function isGlobalNotification(value: unknown): value is GlobalNotification {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.event_key === "string" &&
    typeof value.dedupe_key === "string" &&
    typeof value.domain === "string" &&
    typeof value.priority === "string" &&
    typeof value.toast_policy === "string" &&
    typeof value.title === "string" &&
    typeof value.preview === "string" &&
    typeof value.detail === "string" &&
    isRecord(value.recipient) &&
    isRecord(value.source) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isPersistedNotificationUserState(
  value: unknown,
): value is PersistedNotificationUserState {
  if (!isRecord(value)) return false;

  return (
    typeof value.notificationId === "string" &&
    (typeof value.readAt === "string" || value.readAt === null) &&
    (typeof value.archivedAt === "string" || value.archivedAt === null)
  );
}

function readStatus(value: unknown): 200 {
  return value === 200 ? 200 : 200;
}

function readAction(value: unknown): "created" | "bumped" | "unchanged" {
  if (value === "bumped" || value === "unchanged") return value;
  return "created";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
