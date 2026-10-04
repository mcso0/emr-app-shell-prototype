import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  createSupabaseNotificationPersistenceGateway,
  emitPersistedLiveNotificationEvent,
  markAllPersistedLiveNotificationsRead,
  markPersistedLiveNotificationRead,
  readPersistedLiveNotifications,
  type SupabaseNotificationPersistenceRpcClient,
} from "../src/features/notifications/server-notification-persistence";
import type { LiveNotificationEventInput } from "../src/features/notifications/server-notifications";

const migration = readFileSync(
  "supabase/migrations/20260705133000_notification_event_persistence.sql",
  "utf8",
);
const batchMigration = readFileSync(
  "supabase/migrations/20260719051725_performance_batch_rpc_followup.sql",
  "utf8",
);
const a3Migration = readFileSync(
  "supabase/migrations/20260819150622_clinical_master_phase1a3_order_authority.sql",
  "utf8",
);
const waitingArchiveMigration = readFileSync(
  "supabase/migrations/20260913085259_notification_waiting_toast_archive_persistence.sql",
  "utf8",
);
const gatewaySource = readFileSync(
  "src/features/notifications/server-notification-persistence.ts",
  "utf8",
);
const notificationRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/notifications/route.ts",
  "utf8",
);
const notificationCountsRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/notifications/counts/route.ts",
  "utf8",
);
const notificationReadRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/read/route.ts",
  "utf8",
);
const notificationArchiveRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/archive/route.ts",
  "utf8",
);
const notificationRestoreRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/restore/route.ts",
  "utf8",
);
const notificationReadAllRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/notifications/read-all/route.ts",
  "utf8",
);
const notificationRouteActorSource = readFileSync(
  "src/features/notifications/server-notifications-route.ts",
  "utf8",
);
const orderRecheckProducerRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/notifications/order-recheck-requests/route.ts",
  "utf8",
);
const labResultEntryProducerRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts",
  "utf8",
);
const receptionQueueProducerRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/reception/queue/route.ts",
  "utf8",
);
const receptionQueueCoreSource = readFileSync(
  "src/features/reception/server-reception-queue-read-core.ts",
  "utf8",
);
const fulfillmentWorkItemProducerRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]/route.ts",
  "utf8",
);
const resultReviewBillingProducerRoute = readFileSync(
  "src/app/api/workspaces/[workspaceId]/chart/result-review-billing/route.ts",
  "utf8",
);
const fulfillmentCoreSource = readFileSync(
  "src/features/fulfillment/server-fulfillment-work-item-core.ts",
  "utf8",
);

test("notification persistence migration creates durable event and state tables", () => {
  expect(migration).toContain("create table if not exists public.notification_events");
  expect(migration).toContain("create table if not exists public.notification_user_states");
  expect(migration).toContain("workspace_id text not null references public.workspaces");
  expect(migration).toContain("unique (workspace_id, event_scope_id, dedupe_key)");
  expect(migration).toContain("primary key (workspace_id, actor_user_id, state_scope_id, notification_id)");
  expect(migration).toContain("recipient_payload jsonb not null");
  expect(migration).toContain("source_payload jsonb not null");
});

test("notification persistence migration enforces workspace RLS and RPC membership checks", () => {
  expect(migration).toContain("alter table public.notification_events enable row level security");
  expect(migration).toContain("alter table public.notification_user_states enable row level security");
  expect(migration).toContain(
    "revoke all on public.notification_events from public, anon, authenticated",
  );
  expect(migration).toContain(
    "revoke all on public.notification_user_states from public, anon, authenticated",
  );
  expect(migration).not.toContain(
    "grant select, insert, update, delete on public.notification_events to authenticated",
  );
  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("p_actor_user_id <> auth.uid()");
  expect(migration).toContain("private.clair_notification_actor_can_emit_event");
  expect(migration).toContain("private.clair_notification_event_visible_to_actor");
  expect(migration).toContain("private.clair_notification_active_role_ids_for_actor");
  expect(migration).toContain("left(trim(p_state_scope_id), 180) <> p_actor_user_id::text");
  expect(migration).toContain("create or replace function public.clair_emit_notification_event");
  expect(migration).toContain("create or replace function public.clair_list_notification_events");
  expect(migration).toContain("create or replace function public.clair_list_notification_user_states");
  expect(migration).toContain("create or replace function public.clair_upsert_notification_user_state");
  expect(migration).toContain("if v_action = 'bumped' then");
  expect(migration).toContain("delete from public.notification_user_states");
  expect(migration).toContain("grant execute on function public.clair_emit_notification_event");
  expect(migration).toContain("grant execute on function public.clair_list_notification_events");
  expect(migration).toContain("grant execute on function public.clair_list_notification_user_states");
  expect(migration).toContain("grant execute on function public.clair_upsert_notification_user_state");
});

test("repeated waiting alerts preserve user acknowledgement without changing other event policy", () => {
  expect(waitingArchiveMigration).toContain(
    "coalesce(p_event ->> 'eventKey', '') <> 'waiting_over_30m'",
  );
  expect(waitingArchiveMigration).toContain(
    "return public.clair_emit_notification_event_legacy",
  );
  expect(waitingArchiveMigration).toContain("for update");
  expect(waitingArchiveMigration).toContain(
    "insert into public.notification_user_states",
  );
  expect(waitingArchiveMigration).toContain(
    "on conflict (workspace_id, actor_user_id, state_scope_id, notification_id)",
  );
  expect(waitingArchiveMigration).toContain("archived_at = excluded.archived_at");
  expect(waitingArchiveMigration).toContain("p_actor_user_id <> auth.uid()");
  expect(waitingArchiveMigration).toContain(
    "grant execute on function public.clair_emit_notification_event",
  );
});

test("notification persistence gateway uses fixed Supabase RPC boundaries", async () => {
  const calls: Array<{ args: unknown; functionName: string }> = [];
  const client: SupabaseNotificationPersistenceRpcClient = {
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      if (functionName === "clair_emit_notification_event") {
        return {
          data: {
            ok: true,
            status: 200,
            action: "created",
            notification: {
              ...samplePersistedNotification,
              workspaceId: undefined,
            },
            enforcedBy: "notification-event-persistence",
          },
          error: null,
        };
      }

      if (functionName === "clair_list_notification_events") {
        return {
          data: {
            ok: true,
            status: 200,
            notifications: [samplePersistedNotification],
            enforcedBy: "notification-event-persistence",
          },
          error: null,
        };
      }

      if (functionName === "clair_list_notification_user_states") {
        return {
          data: {
            ok: true,
            status: 200,
            states: [],
            enforcedBy: "notification-user-state-persistence",
          },
          error: null,
        };
      }

      return {
        data: { ok: true, status: 200, enforcedBy: "notification-user-state-persistence" },
        error: null,
      };
    },
  };
  const gateway = createSupabaseNotificationPersistenceGateway(client);

  const emitted = await gateway.emitNotificationEvent(sampleEvent);
  const listed = await gateway.listNotificationEvents({
    eventScopeId: "browser-a",
    workspaceId: "clair-demo",
  });
  const state = await gateway.upsertNotificationUserState({
    actorUserId: "00000000-0000-0000-0000-000000000001",
    archivedAt: null,
    notificationId: "notif-live-order-recheck",
    readAt: "2026-07-05T09:00:00.000Z",
    stateScopeId: "00000000-0000-0000-0000-000000000001:browser-a",
    workspaceId: "clair-demo",
  });

  expect(emitted).toMatchObject({
    ok: true,
    action: "created",
    enforcedBy: "notification-event-persistence-gateway",
  });
  expect(listed).toMatchObject({
    ok: true,
    notifications: [expect.objectContaining({ event_key: "order_recheck_requested" })],
  });
  expect(state).toMatchObject({
    ok: true,
    enforcedBy: "notification-user-state-persistence-gateway",
  });
  expect(calls.map((call) => call.functionName)).toEqual([
    "clair_emit_notification_event",
    "clair_list_notification_events",
    "clair_upsert_notification_user_state",
  ]);
  await gateway.listNotificationUserStates({
    actorUserId: "00000000-0000-0000-0000-000000000001",
    stateScopeId: "00000000-0000-0000-0000-000000000001:browser-a",
    workspaceId: "clair-demo",
  });
  expect(calls.map((call) => call.functionName)).toEqual([
    "clair_emit_notification_event",
    "clair_list_notification_events",
    "clair_upsert_notification_user_state",
    "clair_list_notification_user_states",
  ]);
  expect(calls[0]?.args).toMatchObject({
    p_actor_user_id: "00000000-0000-0000-0000-000000000001",
    p_workspace_id: "clair-demo",
  });
});

test("persisted notification helper reads a bounded snapshot with global DB counts", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseNotificationPersistenceGateway({ async rpc(name) {
    calls.push(name);
    return { data: { ok: true, notifications: [samplePersistedNotification],
      states: [{ notificationId: samplePersistedNotification.id, readAt: "2026-07-05T09:10:00.000Z", archivedAt: null }],
      counts: { badge: 199, unread: 199, important: 200, archived: 0 }, nextCursor: "2026-07-05T09:00:00.000Z" }, error: null };
  } });
  const result = await readPersistedLiveNotifications({ actorUserId: "user-tech", gateway,
    filter: "all", limit: 50, workspaceId: "clair-demo" });
  expect(result).toMatchObject({ ok: true, counts: { unread: 199 },
    notifications: [expect.objectContaining({ readAt: "2026-07-05T09:10:00.000Z" })] });
  expect(calls).toEqual(["clair_read_notification_snapshot_v2"]);
});

test("persisted notification mutation delegates ID and complete set to one atomic RPC", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const gateway = createSupabaseNotificationPersistenceGateway({ async rpc(name, args) {
    calls.push({ name, args });
    const bulk = "p_action" in args && args.p_action === "read-all";
    return { data: { ok: true, notifications: bulk ? [] : [samplePersistedNotification],
      states: bulk ? [] : [{ notificationId: samplePersistedNotification.id, readAt: "2026-07-05T09:10:00.000Z", archivedAt: null }],
      counts: { badge: 0, unread: 0, important: 200, archived: 0 }, nextCursor: null, updatedCount: bulk ? 200 : 1 }, error: null };
  } });
  const input = { actorUserId: "user-tech", gateway, workspaceId: "clair-demo" };
  expect(await markPersistedLiveNotificationRead({ ...input, notificationId: samplePersistedNotification.id }))
    .toMatchObject({ ok: true, notification: { readAt: "2026-07-05T09:10:00.000Z" } });
  expect(await markAllPersistedLiveNotificationsRead(input)).toMatchObject({ ok: true, updatedCount: 200, counts: { unread: 0 } });
  expect(calls.map(c => c.name)).toEqual(["clair_mutate_notification_user_state_v2", "clair_mutate_notification_user_state_v2"]);
  expect(calls[0].args).toMatchObject({ p_action: "read", p_notification_id: samplePersistedNotification.id });
  expect(calls[1].args).toMatchObject({ p_action: "read-all", p_notification_id: null });
});

test("batch migration keeps notification and fulfillment mutations set-based and authenticated", () => {
  expect(batchMigration).toContain(
    "create or replace function public.clair_mark_notification_user_states_read",
  );
  expect(batchMigration).toContain(
    "create or replace function public.clair_enrich_fulfillment_work_item_snapshots",
  );
  expect(batchMigration).toContain("p_actor_user_id <> auth.uid()");
  expect(batchMigration).toContain("revoke all on function public.clair_mark_notification_user_states_read");
  expect(batchMigration).toContain("revoke all on function public.clair_enrich_fulfillment_work_item_snapshots");
});

test("A3 removes caller-controlled fulfillment enrichment while preserving notification persistence", () => {
  expect(a3Migration).toContain(
    "revoke all on function public.clair_enrich_fulfillment_work_item_snapshots(text,uuid,jsonb)",
  );
  expect(a3Migration).toContain(
    "drop function if exists public.clair_enrich_fulfillment_work_item_snapshots(text,uuid,jsonb)",
  );
  expect(a3Migration).not.toContain(
    "create or replace function public.clair_enrich_fulfillment_work_item_snapshots",
  );
  expect(fulfillmentCoreSource).not.toContain(
    "clair_enrich_fulfillment_work_item_snapshots",
  );
  expect(fulfillmentCoreSource).not.toContain(
    "persistSupabaseSnapshotEnrichment",
  );
  expect(resultReviewBillingProducerRoute).toContain("syncVetReviewedBillingCandidates");
  expect(fulfillmentWorkItemProducerRoute).toContain("updateFulfillmentWorkItem");
});

test("notification persistence gateway maps Supabase errors without leaking raw details", async () => {
  const gateway = createSupabaseNotificationPersistenceGateway({
    async rpc() {
      return { data: null, error: { message: "workspace_membership_missing: internal detail" } };
    },
  });

  await expect(gateway.emitNotificationEvent(sampleEvent)).resolves.toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
});

test("persisted notification producer helper writes events through the DB gateway", async () => {
  const calls: Array<{ args: unknown; functionName: string }> = [];
  const gateway = createSupabaseNotificationPersistenceGateway({
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      return {
        data: {
          ok: true,
          status: 200,
          action: "created",
          notification: samplePersistedNotification,
          enforcedBy: "notification-event-persistence",
        },
        error: null,
      };
    },
  });

  const result = await emitPersistedLiveNotificationEvent({
    event: sampleEvent,
    gateway,
  });

  expect(result).toMatchObject({
    ok: true,
    action: "created",
    notification: expect.objectContaining({
      event_key: "order_recheck_requested",
      dedupe_key: "order-kong-cbc-order_recheck_requested",
    }),
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    functionName: "clair_emit_notification_event",
    args: {
      p_workspace_id: "clair-demo",
      p_actor_user_id: "00000000-0000-0000-0000-000000000001",
    },
  });
});

test("notification persistence gateway stays explicit about future route wiring", () => {
  expect(gatewaySource).toContain("clair_emit_notification_event");
  expect(gatewaySource).toContain("clair_list_notification_events");
  expect(gatewaySource).toContain("clair_list_notification_user_states");
  expect(gatewaySource).toContain("clair_upsert_notification_user_state");
  expect(gatewaySource).toContain("notification-event-persistence-gateway");
});

test("notification routes use DB persistence gateway for Supabase session actors", () => {
  expect(notificationRouteActorSource).toContain("notificationPersistenceGateway");
  expect(notificationRouteActorSource).toContain("createSupabaseNotificationPersistenceGateway");
  expect(notificationRoute).toContain("readPersistedLiveNotifications");
  expect(notificationCountsRoute).toContain("readPersistedLiveNotificationCounts");
  expect(notificationReadRoute).toContain("markPersistedLiveNotificationRead");
  expect(notificationArchiveRoute).toContain("archivePersistedLiveNotification");
  expect(notificationRestoreRoute).toContain("restorePersistedLiveNotification");
  expect(notificationReadAllRoute).toContain("markAllPersistedLiveNotificationsRead");
});

test("notification producer routes use DB persistence gateway for Supabase session actors", () => {
  expect(orderRecheckProducerRoute).toContain("notificationPersistenceGateway");
  expect(orderRecheckProducerRoute).toContain("emitPersistedLiveNotificationEvent");
  expect(labResultEntryProducerRoute).toContain("createSupabaseNotificationPersistenceGateway");
  expect(labResultEntryProducerRoute).toContain("emitPersistedLiveNotificationEvent");
});

test("remaining notification producer routes use DB persistence gateway for Supabase session actors", () => {
  expect(receptionQueueProducerRoute).toContain("createSupabaseNotificationPersistenceGateway");
  expect(receptionQueueProducerRoute).toContain("notificationPersistenceGateway");
  expect(receptionQueueCoreSource).toContain("notificationPersistenceGateway");
  expect(receptionQueueCoreSource).toContain("emitPersistedLiveNotificationEvent");
  expect(fulfillmentWorkItemProducerRoute).toContain("createSupabaseNotificationPersistenceGateway");
  expect(fulfillmentWorkItemProducerRoute).toContain("notificationPersistenceGateway");
  expect(resultReviewBillingProducerRoute).toContain("createSupabaseNotificationPersistenceGateway");
  expect(resultReviewBillingProducerRoute).toContain("notificationPersistenceGateway");
  expect(fulfillmentCoreSource).toContain("notificationPersistenceGateway");
  expect(fulfillmentCoreSource).toContain("emitPersistedLiveNotificationEvent");
});

const sampleEvent: LiveNotificationEventInput = {
  actorUserId: "00000000-0000-0000-0000-000000000001",
  badgeCount: true,
  dedupeKey: "order-kong-cbc-order_recheck_requested",
  detail: "담당 수의사가 검체 상태 확인을 요청했습니다.",
  domain: "lab",
  eventKey: "order_recheck_requested",
  eventScopeId: "browser-a",
  occurredAt: "2026-07-05T09:00:00.000Z",
  preview: "검체 상태 확인 요청",
  priority: "high",
  recipient: { kind: "role_queue", id: "lab", label: "임상병리검사" },
  requiresAction: true,
  source: {
    entity_id: "order-kong-cbc",
    kind: "order",
    route: "/w/clair-demo/lab?modulePanel=open&orderId=order-kong-cbc",
  },
  sourceActionLabel: "오더 열기",
  sourceLabel: "검사 오더 · CBC",
  title: "콩이 CBC 재확인을 진행해 주세요",
  toastPolicy: "role_active",
  workTypeLabel: "검사",
  workspaceId: "clair-demo",
};

const samplePersistedNotification = {
  archived: false,
  badge_count: true,
  created_at: "2026-07-05T09:00:00.000Z",
  dedupe_key: "order-kong-cbc-order_recheck_requested",
  detail: "담당 수의사가 검체 상태 확인을 요청했습니다.",
  domain: "lab",
  event_key: "order_recheck_requested",
  id: "notif-live-order-recheck",
  issuedAtLabel: "방금 전",
  priority: "high",
  preview: "검체 상태 확인 요청",
  read_state_key: "clair.notifications.v0.read",
  recipient: { kind: "role_queue", id: "lab", label: "임상병리검사" },
  recipientLabel: "임상병리검사",
  requires_action: true,
  source: {
    entity_id: "order-kong-cbc",
    kind: "order",
    route: "/w/clair-demo/lab?modulePanel=open&orderId=order-kong-cbc",
  },
  sourceActionLabel: "오더 열기",
  sourceLabel: "검사 오더 · CBC",
  title: "콩이 CBC 재확인을 진행해 주세요",
  toast_policy: "role_active",
  unread: true,
  updated_at: "2026-07-05T09:00:00.000Z",
  workTypeLabel: "검사",
};
