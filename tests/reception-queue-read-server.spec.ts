import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  loadWorkspacePermissionAdapterFromDb,
  type WorkspacePermissionDbGateway,
} from "../src/features/auth/db-workspace-permission-adapter-core";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createDemoLiveNotificationEventStore,
  createDemoLiveNotificationStateStore,
  markLiveNotificationRead,
  readLiveNotifications,
} from "../src/features/notifications/server-notifications-core";
import type { GlobalNotification } from "../src/features/notifications/mock-notifications";
import type { NotificationPersistenceGateway } from "../src/features/notifications/server-notification-persistence";
import {
  createMockReceptionQueueReadGateway,
  createSupabaseReceptionQueueReadGateway,
  readReceptionQueue,
} from "../src/features/reception/server-reception-queue-read-core";
import type { Appointment, Encounter, WaitingQueueEntry } from "../src/types/emr-domain";

const encounter: Encounter = {
  id: "encounter-db-walkin-coco",
  workspaceId: "clair-demo",
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "staff-vet-lee",
  encounterNo: "E-DB-0001",
  receptionType: "walk_in",
  department: "내과",
  durationMinutes: 30,
  chiefComplaint: "구토 재진 상담",
  visitPurpose: "구토 재진 상담",
  receptionMemo: "보호자가 식욕 저하를 걱정함",
  status: "waiting",
  checkedInAt: "2026-05-19T00:00:00.000Z",
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z",
};

const queueEntry: WaitingQueueEntry = {
  id: "queue-db-walkin-coco",
  workspaceId: "clair-demo",
  encounterId: encounter.id,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: 1,
  enteredAt: "2026-05-19T00:00:00.000Z",
};

const cancelledEncounter: Encounter = {
  ...encounter,
  id: "encounter-db-cancelled-coco",
  encounterNo: "E-DB-CANCELLED",
  status: "cancelled",
  checkedInAt: "2026-05-19T01:30:00.000Z",
  createdAt: "2026-05-19T01:30:00.000Z",
  updatedAt: "2026-05-19T01:40:00.000Z",
};

const cancelledQueueEntry: WaitingQueueEntry = {
  ...queueEntry,
  id: "queue-db-cancelled-coco",
  encounterId: cancelledEncounter.id,
  status: "cancelled",
  enteredAt: "2026-05-19T01:30:00.000Z",
  finishedAt: "2026-05-19T01:40:00.000Z",
};

const appointment: Appointment = {
  id: "appointment-db-luna",
  workspaceId: "clair-demo",
  patientId: "patient-luna",
  guardianId: "guardian-park-jiyu",
  assignedVeterinarianId: "staff-vet-lee",
  scheduledStartAt: "2026-05-19T02:00:00.000Z",
  scheduledEndAt: "2026-05-19T02:30:00.000Z",
  visitPurpose: "예방 접종",
  status: "confirmed",
  createdAt: "2026-05-18T08:00:00.000Z",
  updatedAt: "2026-05-18T08:00:00.000Z",
};

test("reception queue read route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.get("/api/workspaces/clair-demo/reception/queue");
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const mockFallback = await request.get("/api/workspaces/clair-demo/reception/queue", {
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(mockFallback.status()).toBe(200);
  await expectJson(mockFallback, {
    ok: true,
    queue: [],
    summary: {
      appointmentCount: 0,
      receptionCount: 0,
      totalCount: 0,
    },
    enforcedBy: "reception-queue-read",
  });
});

test("reception queue read core enforces active workspace membership and reception view", async () => {
  const missingMembership = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-other",
          workspaceId: "other-workspace",
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
    gateway: createMockReceptionQueueReadGateway({
      queue: [{ kind: "encounter_queue", encounter, queueEntry }],
    }),
    date: "2026-05-19",
  });

  expect(missingMembership).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });

  const noReceptionView = await readReceptionQueue({
    actorUserId: "user-without-view",
    workspaceId: "clair-demo",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-without-view", status: "active" }],
      memberships: [
        {
          id: "membership-without-view",
          workspaceId: "clair-demo",
          userId: "user-without-view",
          roles: ["vet"],
          status: "active",
        },
      ],
      permissionPolicies: [
        {
          workspaceId: "clair-demo",
          role: "vet",
          permissionIds: ["chart:view"],
        },
      ],
    }),
    gateway: createMockReceptionQueueReadGateway({
      queue: [{ kind: "encounter_queue", encounter, queueEntry }],
    }),
    date: "2026-05-19",
  });

  expect(noReceptionView).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("reception queue read core authorizes through legacy DB roles when additive assignments are absent", async () => {
  const calls: string[] = [];
  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    now: "2026-07-02T00:00:00.000Z",
    workspaceId: "clair-demo",
    sessionUserId: "user-front-desk",
    gateway: createLegacyReceptionViewPermissionGateway(calls),
  });

  const result = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    date: "2026-05-19",
    permissionAdapter,
    gateway: createMockReceptionQueueReadGateway({
      queue: [{ kind: "encounter_queue", encounter, queueEntry }],
    }),
  });

  expect(calls).toEqual([
    "memberships:clair-demo:user-front-desk",
    "users:user-front-desk",
    "policies:clair-demo",
    "permissionRoles:clair-demo:membership-front-desk",
    "jobPositions:clair-demo:membership-front-desk",
  ]);
  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "reception-queue-read",
    queue: [
      {
        kind: "encounter_queue",
        encounter: { id: encounter.id },
        queueEntry: { id: queueEntry.id },
      },
    ],
    summary: {
      receptionCount: 1,
      totalCount: 1,
    },
  });
});

test("supabase reception queue gateway maps rows and keeps workspace/date scope in the RPC read", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionQueueReadGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_day}:${args.p_limit}`);
      return {
        data: [{ kind: "encounter_queue", encounter, queueEntry }],
        error: null,
      };
    },
  });

  const result = await gateway.listReceptionQueue({
    workspaceId: "clair-demo",
    date: "2026-05-19",
  });

  expect(calls).toEqual(["clair_list_reception_queue:clair-demo:2026-05-19:100"]);
  expect(result).toMatchObject({
    ok: true,
    queue: [
      {
        kind: "encounter_queue",
        encounter: { id: "encounter-db-walkin-coco", workspaceId: "clair-demo" },
        queueEntry: { id: "queue-db-walkin-coco", workspaceId: "clair-demo" },
      },
    ],
  });
});

test("supabase reception queue gateway accepts snake_case readback rows with embedded profiles", async () => {
  const gateway = createSupabaseReceptionQueueReadGateway({
    async rpc() {
      return {
        data: [
          {
            encounter: {
              id: "encounter-db-walkin-live",
              workspace_id: "clair-demo",
              patient_id: "patient-live-luna",
              guardian_id: "guardian-live-jiyu",
              primary_veterinarian_id: "user-vet-suji",
              assigned_staff_user_ids: ["user-vet-suji", "user-tech-hayun"],
              encounter_no: "E-LIVE-0002",
              reception_type: "walk_in",
              duration_minutes: 30,
              chief_complaint: "readback verification",
              visit_purpose: "readback verification",
              status: "waiting",
              checked_in_at: "2026-05-19T11:15:00+09:00",
              created_at: "2026-05-19T11:15:00+09:00",
              updated_at: "2026-05-19T11:15:00+09:00",
            },
            kind: "encounter_queue",
            patient: {
              id: "patient-live-luna",
              workspace_id: "clair-demo",
              patient_no: "P-LIVE-0002",
              name: "루나",
              species: "cat",
              sex: "female",
              handling_caution_locked: true,
              status: "active",
              created_at: "2026-05-19T00:00:00+09:00",
              updated_at: "2026-05-19T00:00:00+09:00",
            },
            primary_guardian: {
              id: "guardian-live-jiyu",
              workspace_id: "clair-demo",
              name: "박지유",
              mobile_phone: "010-2222-3333",
              created_at: "2026-05-19T00:00:00+09:00",
              updated_at: "2026-05-19T00:00:00+09:00",
            },
            queue_entry: {
              id: "queue-db-walkin-live",
              workspace_id: "clair-demo",
              encounter_id: "encounter-db-walkin-live",
              queue_type: "consultation",
              status: "waiting",
              priority: "normal",
              sort_order: 1,
              entered_at: "2026-05-19T11:15:00+09:00",
            },
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.listReceptionQueue({
    workspaceId: "clair-demo",
    date: "2026-05-19",
  });

  expect(result).toMatchObject({
    ok: true,
    queue: [
      {
        kind: "encounter_queue",
        encounter: {
          id: "encounter-db-walkin-live",
          patientId: "patient-live-luna",
          primaryVeterinarianId: "user-vet-suji",
          assignedStaffUserIds: ["user-vet-suji", "user-tech-hayun"],
          checkedInAt: "2026-05-19T11:15:00+09:00",
        },
        patient: { id: "patient-live-luna", name: "루나" },
        primaryGuardian: { id: "guardian-live-jiyu", name: "박지유" },
        queueEntry: {
          id: "queue-db-walkin-live",
          enteredAt: "2026-05-19T11:15:00+09:00",
        },
      },
    ],
  });
});

test("reception queue read includes cancelled encounter queue rows for the selected date", async () => {
  const result = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    date: "2026-05-19",
    gateway: createMockReceptionQueueReadGateway({
      queue: [
        { kind: "encounter_queue", encounter, queueEntry },
        {
          kind: "encounter_queue",
          encounter: cancelledEncounter,
          queueEntry: cancelledQueueEntry,
        },
      ],
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    summary: {
      appointmentCount: 0,
      receptionCount: 2,
      totalCount: 2,
    },
    queue: [
      {
        encounter: { id: encounter.id, status: "waiting" },
        queueEntry: { status: "waiting" },
      },
      {
        encounter: { id: cancelledEncounter.id, status: "cancelled" },
        queueEntry: { status: "cancelled", finishedAt: "2026-05-19T01:40:00.000Z" },
      },
    ],
  });
});

test("reception queue read keeps appointment-only rows separate from walk-in encounters", async () => {
  const checkedInAppointmentEncounter: Encounter = {
    ...encounter,
    id: "encounter-db-appointment-check-in",
    appointmentId: appointment.id,
    encounterNo: "E-DB-APPOINTMENT-CHECK-IN",
  };
  const checkedInAppointmentQueueEntry: WaitingQueueEntry = {
    ...queueEntry,
    id: "queue-db-appointment-check-in",
    encounterId: checkedInAppointmentEncounter.id,
  };
  const result = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    date: "2026-05-19",
    gateway: createMockReceptionQueueReadGateway({
      queue: [
        { kind: "encounter_queue", encounter, queueEntry },
        {
          kind: "encounter_queue",
          encounter: checkedInAppointmentEncounter,
          queueEntry: checkedInAppointmentQueueEntry,
        },
        { kind: "appointment", appointment },
      ],
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    summary: {
      appointmentCount: 1,
      receptionCount: 2,
      totalCount: 3,
    },
    queue: [
      {
        kind: "encounter_queue",
        encounter: { id: encounter.id },
      },
      {
        kind: "encounter_queue",
        encounter: { id: checkedInAppointmentEncounter.id },
      },
      {
        kind: "appointment",
        appointment: { id: appointment.id, status: "confirmed" },
      },
    ],
  });
});

test("reception queue read emits waiting-over-30m notification through the live producer", async () => {
  const notificationEventStore = createDemoLiveNotificationEventStore();
  const notificationStateStore = createDemoLiveNotificationStateStore();
  const longWaitingEncounter: Encounter = {
    ...encounter,
    id: "encounter-long-waiting-mango",
    encounterNo: "E-LONG-WAIT",
    patientId: "patient-mango",
    status: "waiting",
    checkedInAt: "2026-05-19T00:00:00.000Z",
  };
  const longWaitingQueueEntry: WaitingQueueEntry = {
    ...queueEntry,
    id: "queue-long-waiting-mango",
    encounterId: longWaitingEncounter.id,
    enteredAt: "2026-05-19T00:00:00.000Z",
    status: "waiting",
  };

  const result = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    date: "2026-05-19",
    gateway: createMockReceptionQueueReadGateway({
      queue: [
        {
          kind: "encounter_queue",
          encounter: longWaitingEncounter,
          queueEntry: longWaitingQueueEntry,
        },
      ],
    }),
    notificationEventStore,
    notificationStateStore,
    now: "2026-05-19T00:35:00.000Z",
  });

  expect(result).toMatchObject({
    ok: true,
    emittedNotifications: {
      waitingOver30m: 1,
    },
  });

  const notifications = await readLiveNotifications({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    eventStore: notificationEventStore,
    notifications: [],
    stateStore: notificationStateStore,
  });

  expect(notifications).toMatchObject({
    ok: true,
    counts: {
      badge: 1,
      unread: 1,
      important: 1,
    },
  });
  expect(notifications.ok && notifications.notifications[0]).toMatchObject({
    id: "notif-live-patient-mango-queue-long-waiting-mango-waiting-over-30m",
    eventKey: "waiting_over_30m",
    sourceRoute: "/w/clair-demo/reception?modulePanel=open&encounterId=encounter-long-waiting-mango",
    title: "대기 35분 경과: patient-mango",
    recipientKind: "role_queue",
    recipientId: "desk",
    workTypeLabel: "접수",
  });

  await markLiveNotificationRead({
    actorUserId: "user-front-desk",
    notificationId: "notif-live-patient-mango-queue-long-waiting-mango-waiting-over-30m",
    workspaceId: "clair-demo",
    eventStore: notificationEventStore,
    notifications: [],
    stateStore: notificationStateStore,
  });

  await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    date: "2026-05-19",
    gateway: createMockReceptionQueueReadGateway({
      queue: [
        {
          kind: "encounter_queue",
          encounter: longWaitingEncounter,
          queueEntry: longWaitingQueueEntry,
        },
      ],
    }),
    notificationEventStore,
    notificationStateStore,
    now: "2026-05-19T00:36:00.000Z",
  });

  const afterRepeatedRead = await readLiveNotifications({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    eventStore: notificationEventStore,
    notifications: [],
    stateStore: notificationStateStore,
  });
  expect(afterRepeatedRead.ok && afterRepeatedRead.counts).toMatchObject({
    badge: 0,
    unread: 0,
  });
});

test("reception queue read persists waiting-over-30m notification through the DB gateway", async () => {
  const persistedEvents: Array<
    Parameters<NotificationPersistenceGateway["emitNotificationEvent"]>[0]
  > = [];
  const notificationPersistenceGateway =
    createRecordingNotificationPersistenceGateway(persistedEvents);
  const longWaitingEncounter: Encounter = {
    ...encounter,
    id: "encounter-long-waiting-peach",
    encounterNo: "E-LONG-WAIT-DB",
    patientId: "patient-peach",
    status: "waiting",
    checkedInAt: "2026-05-19T00:00:00.000Z",
  };
  const longWaitingQueueEntry: WaitingQueueEntry = {
    ...queueEntry,
    id: "queue-long-waiting-peach",
    encounterId: longWaitingEncounter.id,
    enteredAt: "2026-05-19T00:00:00.000Z",
    status: "waiting",
  };

  const result = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    date: "2026-05-19",
    gateway: createMockReceptionQueueReadGateway({
      queue: [
        {
          kind: "encounter_queue",
          encounter: longWaitingEncounter,
          queueEntry: longWaitingQueueEntry,
        },
      ],
    }),
    notificationEventScopeId: null,
    notificationPersistenceGateway,
    now: "2026-05-19T00:35:00.000Z",
  });

  expect(result).toMatchObject({
    ok: true,
    emittedNotifications: {
      waitingOver30m: 1,
    },
  });
  expect(persistedEvents).toEqual([
    expect.objectContaining({
      actorUserId: "user-front-desk",
      badgeCount: true,
      dedupeKey: "patient-peach-queue-long-waiting-peach-waiting_over_30m",
      eventKey: "waiting_over_30m",
      eventScopeId: null,
      source: expect.objectContaining({
        entity_id: "queue-long-waiting-peach",
        kind: "reception_queue",
        route: "/w/clair-demo/reception?modulePanel=open&encounterId=encounter-long-waiting-peach",
      }),
      workspaceId: "clair-demo",
    }),
  ]);
});

test("reception queue read keeps source read successful when DB notification persistence rejects", async () => {
  const longWaitingEncounter: Encounter = {
    ...encounter,
    id: "encounter-long-waiting-plum",
    encounterNo: "E-LONG-WAIT-DB-FAIL",
    patientId: "patient-plum",
    status: "waiting",
    checkedInAt: "2026-05-19T00:00:00.000Z",
  };
  const longWaitingQueueEntry: WaitingQueueEntry = {
    ...queueEntry,
    id: "queue-long-waiting-plum",
    encounterId: longWaitingEncounter.id,
    enteredAt: "2026-05-19T00:00:00.000Z",
    status: "waiting",
  };

  const result = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    date: "2026-05-19",
    gateway: createMockReceptionQueueReadGateway({
      queue: [
        {
          kind: "encounter_queue",
          encounter: longWaitingEncounter,
          queueEntry: longWaitingQueueEntry,
        },
      ],
    }),
    notificationPersistenceGateway: createThrowingNotificationPersistenceGateway(),
    now: "2026-05-19T00:35:00.000Z",
  });

  expect(result).toMatchObject({
    ok: true,
    queue: [expect.objectContaining({ kind: "encounter_queue" })],
    emittedNotifications: {
      waitingOver30m: 0,
    },
  });
});

test("reception queue read route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/queue/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/reception/server-reception-queue-read.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource.indexOf("loadWorkspacePermissionAdapterFromDb")).toBeLessThan(
    routeSource.indexOf("readReceptionQueue")
  );
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

test("reception queue reader migration keeps queue rows workspace-scoped", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260618120000_reception_queue_date_status_reader.sql",
    "utf8"
  );

  expect(migrationSource).toContain("create or replace function public.clair_list_reception_queue");
  expect(migrationSource).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migrationSource).toContain("p_day date");
  expect(migrationSource).toContain("kind");
  expect(migrationSource).toContain("q.workspace_id = p_workspace_id");
  expect(migrationSource).toContain("q.queue_type in ('consultation', 'billing')");
  expect(migrationSource).toContain("q.status in ('waiting', 'called', 'in_progress', 'cancelled')");
  expect(migrationSource).toContain("a.status in ('confirmed', 'cancelled')");
  expect(migrationSource).toContain("grant execute on function public.clair_list_reception_queue");
  expect(migrationSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  await expect(response.json()).resolves.toMatchObject(expected);
}

function createRecordingNotificationPersistenceGateway(
  persistedEvents: Array<
    Parameters<NotificationPersistenceGateway["emitNotificationEvent"]>[0]
  >,
): NotificationPersistenceGateway {
  return {
    async readNotificationSnapshot() { throw new Error("Producer must not read notification snapshots"); },
    async mutateNotificationState() { throw new Error("Producer must not mutate notification state"); },
    async emitNotificationEvent(event) {
      persistedEvents.push(event);
      return {
        ok: true,
        status: 200,
        action: "created",
        notification: { id: `persisted-${event.dedupeKey}` } as GlobalNotification,
        enforcedBy: "notification-event-persistence-gateway",
      };
    },
    async listNotificationEvents() {
      return {
        ok: true,
        status: 200,
        notifications: [],
        enforcedBy: "notification-event-persistence-gateway",
      };
    },
    async listNotificationUserStates() {
      return {
        ok: true,
        status: 200,
        states: [],
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
    async upsertNotificationUserState() {
      return {
        ok: true,
        status: 200,
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
    async markNotificationUserStatesRead() {
      return {
        ok: true,
        status: 200,
        updatedCount: 0,
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
  };
}

function createThrowingNotificationPersistenceGateway(): NotificationPersistenceGateway {
  return {
    async readNotificationSnapshot() { throw new Error("Producer must not read notification snapshots"); },
    async mutateNotificationState() { throw new Error("Producer must not mutate notification state"); },
    async emitNotificationEvent() {
      throw new Error("simulated notification persistence outage");
    },
    async listNotificationEvents() {
      return {
        ok: true,
        status: 200,
        notifications: [],
        enforcedBy: "notification-event-persistence-gateway",
      };
    },
    async listNotificationUserStates() {
      return {
        ok: true,
        status: 200,
        states: [],
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
    async upsertNotificationUserState() {
      return {
        ok: true,
        status: 200,
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
    async markNotificationUserStatesRead() {
      return {
        ok: true,
        status: 200,
        updatedCount: 0,
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
  };
}

function createLegacyReceptionViewPermissionGateway(calls: string[]): WorkspacePermissionDbGateway {
  return {
    async listMemberships(workspaceId, userId) {
      calls.push(`memberships:${workspaceId}:${userId}`);
      return [
        {
          id: "membership-front-desk",
          workspace_id: workspaceId,
          user_id: userId,
          roles: ["front_desk"],
          status: "active",
        },
      ];
    },
    async listUsers(userIds) {
      calls.push(`users:${userIds.join(",")}`);
      return userIds.map((id) => ({
        id,
        status: "active",
        display_name: "Front Desk",
      }));
    },
    async listPermissionPolicies(workspaceId) {
      calls.push(`policies:${workspaceId}`);
      return [
        {
          workspace_id: workspaceId,
          scope: "role",
          target_role: "front_desk",
          permissions: { allowed: ["reception:view"] },
        },
      ];
    },
    async listPermissionRoleAssignments(workspaceId, membershipIds) {
      calls.push(`permissionRoles:${workspaceId}:${membershipIds.join(",")}`);
      return [];
    },
    async listJobPositionAssignments(workspaceId, membershipIds) {
      calls.push(`jobPositions:${workspaceId}:${membershipIds.join(",")}`);
      return [];
    },
  };
}

test("waiting producer respects exact 30/60 minute boundaries and queue re-entry identity", async () => {
  const events: Parameters<NotificationPersistenceGateway["emitNotificationEvent"]>[0][] = [];
  const waitingEntry: WaitingQueueEntry = { ...queueEntry, enteredAt: "2026-05-19T00:00:00.000Z" };
  const gateway = createRecordingNotificationPersistenceGateway(events);
  const poll = async (now: string, entry = waitingEntry) => readReceptionQueue({
    actorUserId: "user-front-desk", workspaceId: "clair-demo", date: "2026-05-19",
    gateway: createMockReceptionQueueReadGateway({ queue: [{ kind: "encounter_queue", encounter, queueEntry: entry }] }),
    notificationPersistenceGateway: gateway, now,
  });
  await poll("2026-05-19T00:29:59.999Z");
  expect(events).toHaveLength(0);
  await poll("2026-05-19T00:30:00.000Z");
  await poll("2026-05-19T00:59:59.999Z");
  await poll("2026-05-19T01:00:00.000Z");
  expect(events.map(event => event.priority)).toEqual(["high", "high", "urgent"]);
  expect(new Set(events.map(event => event.dedupeKey)).size).toBe(1);
  expect(events.map(event => event.occurredAt)).toEqual(Array(3).fill("2026-05-19T00:30:00.000Z"));
  await poll("2026-05-19T01:01:00.000Z", { ...waitingEntry, status: "cancelled" });
  await poll("2026-05-19T01:01:00.000Z", { ...waitingEntry, status: "called" });
  expect(events).toHaveLength(3);
  await poll("2026-05-19T01:01:00.000Z");
  expect(events[3].dedupeKey).toBe(events[0].dedupeKey);
  await poll("2026-05-19T01:29:59.999Z", { ...waitingEntry, id: "fresh-queue", enteredAt: "2026-05-19T01:00:00.000Z" });
  expect(events).toHaveLength(4);
  await poll("2026-05-19T01:30:00.000Z", { ...waitingEntry, id: "fresh-queue", enteredAt: "2026-05-19T01:00:00.000Z" });
  expect(events[4].dedupeKey).not.toBe(events[0].dedupeKey);
});
