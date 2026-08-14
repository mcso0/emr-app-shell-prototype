import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
  type WorkspacePermissionResolution,
  type WorkspaceRoleId,
} from "@/features/auth/permission-resolver";
import type { PermissionId } from "@/types/emr-domain";
import {
  getWorkspaceScopedNotifications,
  upsertNotificationByDedupeKey,
  type GlobalNotification,
} from "@/features/notifications/mock-notifications";
import { isPreparedEmptyClinicWorkspace } from "@/lib/emr-domain/demo-workspaces";

export type LiveNotificationFilter = "all" | "unread" | "important" | "archived" | "snapshot";

export type LiveNotificationDto = {
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
  fallbackReason?: "missing_source" | "closed_encounter" | "permission_unavailable";
  issuedAtLabel: string;
  createdAt: string;
  updatedAt: string;
  bumpCount?: number;
  readAt: string | null;
  archivedAt: string | null;
};

export type LiveNotificationCounts = {
  badge: number;
  unread: number;
  important: number;
  archived: number;
};

export type LiveNotificationListResult =
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
      status: 400 | 401 | 403 | 404;
      workspaceId: string;
      denialReason?: WorkspacePermissionDenialReason | "notification_not_found" | "invalid_filter";
      error?: {
        code: WorkspacePermissionDenialReason | "notification_not_found" | "invalid_filter";
        message: string;
        retryable: false;
      };
    };

export type LiveNotificationMutationResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      notification?: LiveNotificationDto;
      counts: LiveNotificationCounts;
      updatedCount?: number;
      enforcedBy: "live-notification-writer";
    }
  | Extract<LiveNotificationListResult, { ok: false }>;

type NotificationUserState = {
  readAtById: Map<string, string>;
  archivedAtById: Map<string, string>;
};

export type LiveNotificationStateStore = {
  clearNotificationState?: (input: {
    eventScopeId?: string | null;
    notificationId: string;
    workspaceId: string;
  }) => void;
  getUserState(input: { actorUserId: string; workspaceId: string }): NotificationUserState;
};

export type LiveNotificationEventInput = {
  workspaceId: string;
  eventKey: GlobalNotification["event_key"];
  dedupeKey: string;
  domain: GlobalNotification["domain"];
  priority: GlobalNotification["priority"];
  toastPolicy?: GlobalNotification["toast_policy"];
  title: string;
  preview: string;
  detail: string;
  workTypeLabel: string;
  sourceLabel: string;
  sourceActionLabel: string;
  recipient: GlobalNotification["recipient"];
  source: GlobalNotification["source"];
  requiresAction: boolean;
  badgeCount: boolean;
  actorUserId?: string | null;
  eventScopeId?: string | null;
  fallbackReason?: GlobalNotification["fallback_reason"];
  id?: string;
  issuedAtLabel?: string;
  occurredAt?: string;
};

export type LiveNotificationEmitResult = {
  ok: true;
  status: 200;
  action: "created" | "bumped" | "unchanged";
  workspaceId: string;
  notification: GlobalNotification;
  enforcedBy: "live-notification-producer";
};

export type LiveNotificationEventStore = {
  emit(event: LiveNotificationEventInput): LiveNotificationEmitResult;
  getWorkspaceNotifications(
    workspaceId: string,
    eventScopeId?: string | null,
  ): GlobalNotification[];
};

type LiveNotificationCoreInput = {
  actorUserId: string | null;
  eventScopeId?: string | null;
  filter?: string | null;
  eventStore?: LiveNotificationEventStore;
  limit?: number | null;
  notifications?: GlobalNotification[];
  permissionAdapter?: WorkspacePermissionAdapter;
  stateScopeId?: string | null;
  stateStore?: LiveNotificationStateStore;
  workspaceId: string;
};

type LiveNotificationMutationInput = {
  actorUserId: string | null;
  eventScopeId?: string | null;
  notificationId: string;
  eventStore?: LiveNotificationEventStore;
  notifications?: GlobalNotification[];
  permissionAdapter?: WorkspacePermissionAdapter;
  stateScopeId?: string | null;
  stateStore?: LiveNotificationStateStore;
  workspaceId: string;
};

type LiveNotificationBulkMutationInput = Omit<
  LiveNotificationMutationInput,
  "notificationId"
>;

const defaultLiveNotificationStateStore = createDemoLiveNotificationStateStore();
const defaultLiveNotificationEventStore = createDemoLiveNotificationEventStore();

const notificationRoleIdsByWorkspaceRole: Record<WorkspaceRoleId, string[]> = {
  hospital_admin: ["vet", "lab", "desk", "billing", "imaging", "dispensing_treatment", "inpatient"],
  vet: ["vet"],
  technician: ["lab", "imaging", "dispensing_treatment", "inpatient"],
  front_desk: ["desk", "billing"],
};

export function createDemoLiveNotificationStateStore(): LiveNotificationStateStore {
  const states = new Map<string, NotificationUserState>();

  return {
    clearNotificationState({ eventScopeId, notificationId, workspaceId }) {
      const normalizedEventScopeId =
        normalizeNotificationEventScopeId(eventScopeId);
      for (const [key, state] of states.entries()) {
        if (!key.startsWith(`${workspaceId}:`)) continue;
        if (
          normalizedEventScopeId &&
          !key.endsWith(`:${normalizedEventScopeId}`)
        )
          continue;

        state.readAtById.delete(notificationId);
        state.archivedAtById.delete(notificationId);
      }
    },
    getUserState({ actorUserId, workspaceId }) {
      const key = `${workspaceId}:${actorUserId}`;
      const existing = states.get(key);
      if (existing) return existing;

      const next = {
        readAtById: new Map<string, string>(),
        archivedAtById: new Map<string, string>(),
      };
      states.set(key, next);
      return next;
    },
  };
}

export function createDemoLiveNotificationEventStore(): LiveNotificationEventStore {
  const notificationsByWorkspace = new Map<string, GlobalNotification[]>();

  return {
    emit(event) {
      const storeKey = getNotificationEventStoreKey(
        event.workspaceId,
        event.eventScopeId,
      );
      const current = notificationsByWorkspace.get(storeKey) ?? [];
      const incomingNotification = createLiveNotificationFromEvent(event);
      const unchangedNotification = current.find(
        (notification) =>
          notification.dedupe_key === incomingNotification.dedupe_key &&
          notification.unread &&
          !notification.archived &&
          notification.updated_at >= incomingNotification.updated_at,
      );

      if (unchangedNotification) {
        return {
          ok: true,
          status: 200,
          action: "unchanged",
          workspaceId: event.workspaceId,
          notification: unchangedNotification,
          enforcedBy: "live-notification-producer",
        };
      }

      const result = upsertNotificationByDedupeKey(current, incomingNotification);

      notificationsByWorkspace.set(storeKey, result.notifications);

      return {
        ok: true,
        status: 200,
        action: result.action === "appended" ? "created" : "bumped",
        workspaceId: event.workspaceId,
        notification: result.notification,
        enforcedBy: "live-notification-producer",
      };
    },
    getWorkspaceNotifications(workspaceId, eventScopeId) {
      const workspaceRows =
        notificationsByWorkspace.get(getNotificationEventStoreKey(workspaceId)) ??
        [];
      const scopeKey = getNotificationEventStoreKey(workspaceId, eventScopeId);
      if (scopeKey === getNotificationEventStoreKey(workspaceId)) {
        return [...workspaceRows];
      }

      return [
        ...workspaceRows,
        ...(notificationsByWorkspace.get(scopeKey) ?? []),
      ];
    },
  };
}

export function emitLiveNotificationEvent({
  event,
  eventStore = defaultLiveNotificationEventStore,
  stateStore = defaultLiveNotificationStateStore,
}: {
  event: LiveNotificationEventInput;
  eventStore?: LiveNotificationEventStore;
  stateStore?: LiveNotificationStateStore;
}): LiveNotificationEmitResult {
  const result = eventStore.emit(event);
  if (result.action !== "unchanged") {
    stateStore.clearNotificationState?.({
      eventScopeId: event.eventScopeId,
      notificationId: result.notification.id,
      workspaceId: event.workspaceId,
    });
  }

  return result;
}

export function createDemoNotificationPermissionAdapter(): WorkspacePermissionAdapter {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      ...createDemoMemberships("clair-demo"),
      ...createDemoMemberships("workspace-clair-cheongdam"),
    ],
  });
}

export async function readLiveNotifications({
  actorUserId,
  eventScopeId,
  eventStore = defaultLiveNotificationEventStore,
  filter = "all",
  limit = 20,
  notifications,
  permissionAdapter = createDemoNotificationPermissionAdapter(),
  stateScopeId,
  stateStore = defaultLiveNotificationStateStore,
  workspaceId,
}: LiveNotificationCoreInput): Promise<LiveNotificationListResult> {
  const normalizedFilter = normalizeFilter(filter);
  if (!normalizedFilter) {
    return buildError({
      code: "invalid_filter",
      message: "알림 필터 값이 올바르지 않습니다.",
      status: 400,
      workspaceId,
    });
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });

  if (!permission.allowed || !actorUserId) {
    return buildError({
      code: permission.denialReason ?? "unauthenticated",
      message: "알림을 볼 권한이 없습니다.",
      status: permission.denialReason === "unauthenticated" || !actorUserId ? 401 : 403,
      workspaceId,
    });
  }

  const state = stateStore.getUserState({
    actorUserId: getNotificationStateActorId(actorUserId, stateScopeId),
    workspaceId,
  });
  const sourceNotifications = getLiveNotificationSourceRows({
    eventScopeId,
    eventStore,
    notifications,
    workspaceId,
  });
  const visibleNotifications = sourceNotifications
    .filter((notification) =>
      isNotificationVisibleToActor(notification, permission, actorUserId),
    )
    .map((notification) => mapNotificationDto({ notification, state, workspaceId }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = summarizeLiveNotifications(visibleNotifications);
  const filteredNotifications = applyFilter(visibleNotifications, normalizedFilter);
  const safeLimit = normalizeLimit(limit, normalizedFilter === "snapshot" ? 100 : 50);

  return {
    ok: true,
    status: 200,
    workspaceId,
    notifications: filteredNotifications.slice(0, safeLimit),
    counts,
    nextCursor: filteredNotifications.length > safeLimit
      ? filteredNotifications[safeLimit - 1]?.updatedAt ?? null
      : null,
    enforcedBy: "live-notification-reader",
  };
}

export async function readLiveNotificationCounts(
  input: Omit<LiveNotificationCoreInput, "filter" | "limit">,
): Promise<LiveNotificationListResult> {
  return readLiveNotifications({ ...input, filter: "all", limit: 1 });
}

export async function markLiveNotificationRead(
  input: LiveNotificationMutationInput,
): Promise<LiveNotificationMutationResult> {
  return mutateOneNotification(input, (state, notificationId, now) => {
    state.readAtById.set(notificationId, now);
  });
}

export async function archiveLiveNotification(
  input: LiveNotificationMutationInput,
): Promise<LiveNotificationMutationResult> {
  return mutateOneNotification(input, (state, notificationId, now) => {
    state.readAtById.set(notificationId, now);
    state.archivedAtById.set(notificationId, now);
  });
}

export async function restoreLiveNotification(
  input: LiveNotificationMutationInput,
): Promise<LiveNotificationMutationResult> {
  return mutateOneNotification(input, (state, notificationId) => {
    state.archivedAtById.delete(notificationId);
  });
}

export async function markAllLiveNotificationsRead({
  actorUserId,
  eventScopeId,
  eventStore,
  notifications,
  permissionAdapter,
  stateScopeId,
  stateStore = defaultLiveNotificationStateStore,
  workspaceId,
}: LiveNotificationBulkMutationInput): Promise<LiveNotificationMutationResult> {
  if (!actorUserId) {
    return buildError({
      code: "unauthenticated",
      message: "알림 상태를 변경할 세션이 없습니다.",
      status: 401,
      workspaceId,
    });
  }

  const current = await readLiveNotifications({
    actorUserId,
    eventScopeId,
    filter: "all",
    eventStore,
    limit: 50,
    notifications,
    permissionAdapter,
    stateScopeId,
    stateStore,
    workspaceId,
  });

  if (!current.ok) return current;

  const now = new Date().toISOString();
  const state = stateStore.getUserState({
    actorUserId: getNotificationStateActorId(actorUserId, stateScopeId),
    workspaceId,
  });
  const unreadNotifications = current.notifications.filter(
    (notification) => !notification.archivedAt && !notification.readAt,
  );

  unreadNotifications.forEach((notification) => {
    state.readAtById.set(notification.id, now);
  });

  const afterMutation = await readLiveNotifications({
    actorUserId,
    eventScopeId,
    filter: "all",
    eventStore,
    limit: 50,
    notifications,
    permissionAdapter,
    stateScopeId,
    stateStore,
    workspaceId,
  });

  if (!afterMutation.ok) return afterMutation;

  return {
    ok: true,
    status: 200,
    workspaceId,
    counts: afterMutation.counts,
    updatedCount: unreadNotifications.length,
    enforcedBy: "live-notification-writer",
  };
}

async function mutateOneNotification(
  {
    actorUserId,
    eventScopeId,
    eventStore,
    notificationId,
    notifications,
    permissionAdapter,
    stateScopeId,
    stateStore = defaultLiveNotificationStateStore,
    workspaceId,
  }: LiveNotificationMutationInput,
  mutate: (state: NotificationUserState, notificationId: string, now: string) => void,
): Promise<LiveNotificationMutationResult> {
  if (!actorUserId) {
    return buildError({
      code: "unauthenticated",
      message: "알림 상태를 변경할 세션이 없습니다.",
      status: 401,
      workspaceId,
    });
  }

  const current = await readLiveNotifications({
    actorUserId,
    eventScopeId,
    filter: "all",
    eventStore,
    limit: 50,
    notifications,
    permissionAdapter,
    stateScopeId,
    stateStore,
    workspaceId,
  });

  if (!current.ok) return current;

  const target = current.notifications.find((notification) => notification.id === notificationId);
  if (!target) {
    const archived = await readLiveNotifications({
      actorUserId,
      eventScopeId,
      filter: "archived",
      eventStore,
      limit: 50,
      notifications,
      permissionAdapter,
      stateScopeId,
      stateStore,
      workspaceId,
    });
    const archivedTarget = archived.ok
      ? archived.notifications.find((notification) => notification.id === notificationId)
      : null;

    if (!archivedTarget) {
      return buildError({
        code: "notification_not_found",
        message: "알림을 찾을 수 없습니다.",
        status: 404,
        workspaceId,
      });
    }
  }

  const state = stateStore.getUserState({
    actorUserId: getNotificationStateActorId(actorUserId, stateScopeId),
    workspaceId,
  });
  mutate(state, notificationId, new Date().toISOString());

  const afterMutation = await readLiveNotifications({
    actorUserId,
    eventScopeId,
    filter: "all",
    eventStore,
    limit: 50,
    notifications,
    permissionAdapter,
    stateScopeId,
    stateStore,
    workspaceId,
  });

  if (!afterMutation.ok) return afterMutation;

  const archived = await readLiveNotifications({
    actorUserId,
    eventScopeId,
    filter: "archived",
    eventStore,
    limit: 50,
    notifications,
    permissionAdapter,
    stateScopeId,
    stateStore,
    workspaceId,
  });
  const notification = [
    ...afterMutation.notifications,
    ...(archived.ok ? archived.notifications : []),
  ].find((item) => item.id === notificationId);

  return {
    ok: true,
    status: 200,
    workspaceId,
    notification,
    counts: afterMutation.counts,
    enforcedBy: "live-notification-writer",
  };
}

function createDemoMemberships(workspaceId: string) {
  return [
    {
      id: `${workspaceId}:membership-playwright-admin`,
      workspaceId,
      userId: "playwright-default-session",
      roles: ["hospital_admin" as const],
      status: "active" as const,
    },
    {
      id: `${workspaceId}:membership-admin`,
      workspaceId,
      userId: "user-admin",
      roles: ["hospital_admin" as const],
      status: "active" as const,
    },
    {
      id: `${workspaceId}:membership-vet`,
      workspaceId,
      userId: "user-vet",
      roles: ["vet" as const],
      status: "active" as const,
    },
    {
      id: `${workspaceId}:membership-front-desk`,
      workspaceId,
      userId: "user-front-desk",
      roles: ["front_desk" as const],
      status: "active" as const,
    },
    {
      id: `${workspaceId}:membership-tech`,
      workspaceId,
      userId: "user-tech",
      roles: ["technician" as const],
      status: "active" as const,
    },
  ];
}

function getLiveNotificationSourceRows({
  eventScopeId,
  eventStore,
  notifications,
  workspaceId,
}: {
  eventScopeId?: string | null;
  eventStore: LiveNotificationEventStore;
  notifications?: GlobalNotification[];
  workspaceId: string;
}) {
  return [
    ...(notifications ?? getDefaultLiveNotifications(workspaceId)),
    ...eventStore.getWorkspaceNotifications(workspaceId, eventScopeId),
  ];
}

function getNotificationEventStoreKey(
  workspaceId: string,
  eventScopeId?: string | null,
) {
  const scopeId = normalizeNotificationEventScopeId(eventScopeId);

  return scopeId ? `${workspaceId}:event-scope:${scopeId}` : workspaceId;
}

function normalizeNotificationEventScopeId(eventScopeId?: string | null) {
  const normalized = eventScopeId?.trim();
  if (!normalized) return null;
  if (normalized.length > 128) return null;
  if (!/^[a-zA-Z0-9:_-]+$/.test(normalized)) return null;

  return normalized;
}

function getDefaultLiveNotifications(workspaceId: string) {
  if (isPreparedEmptyClinicWorkspace(workspaceId)) {
    return [];
  }

  return getWorkspaceScopedNotifications(workspaceId);
}

function createLiveNotificationFromEvent(event: LiveNotificationEventInput): GlobalNotification {
  const timestamp = event.occurredAt ?? new Date().toISOString();

  return {
    id: event.id ?? createLiveNotificationId(event.dedupeKey),
    event_key: event.eventKey,
    dedupe_key: event.dedupeKey,
    domain: event.domain,
    priority: event.priority,
    toast_policy: event.toastPolicy ?? "role_active",
    sourceActionLabel: event.sourceActionLabel,
    workTypeLabel: event.workTypeLabel,
    title: event.title,
    preview: event.preview,
    detail: event.detail,
    sourceLabel: event.sourceLabel,
    recipientLabel: event.recipient.label,
    recipient: event.recipient,
    source: event.source,
    ...(event.fallbackReason ? { fallback_reason: event.fallbackReason } : {}),
    issuedAtLabel: event.issuedAtLabel ?? "방금 전",
    created_at: timestamp,
    updated_at: timestamp,
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: event.requiresAction,
    badge_count: event.badgeCount,
  };
}

function createLiveNotificationId(dedupeKey: string) {
  const normalized = dedupeKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `notif-live-${normalized || "event"}`;
}

function isNotificationVisibleToActor(
  notification: GlobalNotification,
  permission: WorkspacePermissionResolution,
  actorUserId: string,
) {
  if (permission.assignedRoles.includes("hospital_admin")) {
    return true;
  }

  if (
    !isNotificationRecipientVisibleToActor(
      notification,
      permission.assignedRoles,
      actorUserId,
    )
  ) {
    return false;
  }

  const requiredPermission =
    getNotificationSourceRequiredPermission(notification);
  if (!requiredPermission) return true;

  return permission.effectivePermissionIds.includes(requiredPermission);
}

function isNotificationRecipientVisibleToActor(
  notification: GlobalNotification,
  assignedRoles: WorkspaceRoleId[],
  actorUserId: string,
) {
  if (notification.recipient.kind === "user") {
    return notification.recipient.id === actorUserId;
  }

  const activeNotificationRoleIds = new Set(
    assignedRoles.flatMap((role) => notificationRoleIdsByWorkspaceRole[role] ?? []),
  );

  return activeNotificationRoleIds.has(notification.recipient.id);
}

function getNotificationSourceRequiredPermission(
  notification: GlobalNotification,
): PermissionId | null {
  if (notification.domain === "billing") return "billing:view";
  if (notification.domain === "reception") return "reception:view";
  if (notification.domain === "lab") return "lab:view";
  if (notification.domain === "imaging") return "imaging:view";
  if (notification.domain === "dispensing_treatment") return "dispensing:view";
  if (notification.domain === "chart") return "chart:view";

  return null;
}

function mapNotificationDto({
  notification,
  state,
  workspaceId,
}: {
  notification: GlobalNotification;
  state: NotificationUserState;
  workspaceId: string;
}): LiveNotificationDto {
  const readAt = state.readAtById.get(notification.id)
    ?? (notification.unread ? null : notification.updated_at);
  const archivedAt = state.archivedAtById.get(notification.id)
    ?? (notification.archived ? notification.updated_at : null);
  const safeSource = resolveSafeSourceRoute(notification, workspaceId);

  return {
    id: notification.id,
    eventKey: notification.event_key,
    dedupeKey: notification.dedupe_key,
    domain: notification.domain,
    priority: notification.priority,
    requiresAction: notification.requires_action,
    badgeCount: notification.badge_count,
    toastPolicy: notification.toast_policy,
    title: notification.title,
    preview: notification.preview,
    detail: notification.detail,
    workTypeLabel: notification.workTypeLabel,
    sourceLabel: notification.sourceLabel,
    sourceActionLabel: notification.sourceActionLabel,
    sourceKind: notification.source.kind,
    sourceEntityId: notification.source.entity_id ?? null,
    sourceRoute: safeSource.sourceRoute,
    recipientKind: notification.recipient.kind,
    recipientId: notification.recipient.id,
    recipientLabel: notification.recipientLabel,
    ...(safeSource.fallbackReason ? { fallbackReason: safeSource.fallbackReason } : {}),
    issuedAtLabel: notification.issuedAtLabel,
    createdAt: notification.created_at,
    updatedAt: notification.updated_at,
    ...(notification.bump_count ? { bumpCount: notification.bump_count } : {}),
    readAt,
    archivedAt,
  };
}

function getNotificationStateActorId(actorUserId: string, stateScopeId?: string | null) {
  const normalizedStateScopeId = stateScopeId?.trim();

  return normalizedStateScopeId ? normalizedStateScopeId : actorUserId;
}

function resolveSafeSourceRoute(notification: GlobalNotification, workspaceId: string) {
  const fallbackReason = notification.source.fallback_reason
    ?? notification.fallback_reason
    ?? "missing_source";

  if (!notification.source.route) {
    return {
      sourceRoute: null,
      fallbackReason,
    };
  }

  const sourceUrl = new URL(notification.source.route, "http://clair.local");
  const [, workspacePrefix, sourceWorkspaceId] = sourceUrl.pathname.split("/");

  if (workspacePrefix !== "w" || sourceWorkspaceId !== workspaceId) {
    return {
      sourceRoute: null,
      fallbackReason: "permission_unavailable" as const,
    };
  }

  return {
    sourceRoute: `${sourceUrl.pathname}${sourceUrl.search}`,
    fallbackReason: undefined,
  };
}

function summarizeLiveNotifications(notifications: LiveNotificationDto[]): LiveNotificationCounts {
  return notifications.reduce<LiveNotificationCounts>(
    (summary, notification) => {
      const archived = Boolean(notification.archivedAt);
      const unread = !notification.readAt && !archived;

      if (notification.badgeCount && unread) summary.badge += 1;
      if (unread) summary.unread += 1;
      if (!archived && notification.requiresAction) summary.important += 1;
      if (archived) summary.archived += 1;

      return summary;
    },
    { badge: 0, unread: 0, important: 0, archived: 0 },
  );
}

function applyFilter(notifications: LiveNotificationDto[], filter: LiveNotificationFilter) {
  if (filter === "snapshot") {
    return notifications;
  }

  if (filter === "archived") {
    return notifications.filter((notification) => Boolean(notification.archivedAt));
  }

  if (filter === "unread") {
    return notifications.filter((notification) => !notification.archivedAt && !notification.readAt);
  }

  if (filter === "important") {
    return notifications.filter((notification) => !notification.archivedAt && notification.requiresAction);
  }

  return notifications.filter((notification) => !notification.archivedAt);
}

function normalizeFilter(filter: string | null | undefined): LiveNotificationFilter | null {
  if (!filter || filter === "all") return "all";
  if (
    filter === "unread"
    || filter === "important"
    || filter === "archived"
    || filter === "snapshot"
  ) return filter;
  return null;
}

function normalizeLimit(limit: number | null | undefined, maximum = 50) {
  if (!limit || !Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(maximum, Math.floor(limit)));
}

function buildError({
  code,
  message,
  status,
  workspaceId,
}: {
  code: WorkspacePermissionDenialReason | "notification_not_found" | "invalid_filter";
  message: string;
  status: 400 | 401 | 403 | 404;
  workspaceId: string;
}): Extract<LiveNotificationListResult, { ok: false }> {
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
  };
}
