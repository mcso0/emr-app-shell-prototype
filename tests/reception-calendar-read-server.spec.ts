import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  loadWorkspacePermissionAdapterFromDb,
  type WorkspacePermissionDbGateway,
} from "../src/features/auth/db-workspace-permission-adapter-core";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockReceptionCalendarReadGateway,
  createSupabaseReceptionCalendarReadGateway,
  readReceptionDayCalendar,
} from "../src/features/reception/server-reception-calendar-read-core";
import type { Appointment, Encounter, WaitingQueueEntry } from "../src/types/emr-domain";

const appointment: Appointment = {
  id: "appointment-db-coco",
  workspaceId: "clair-demo",
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  assignedVeterinarianId: "user-vet-suji",
  scheduledStartAt: "2026-05-01T09:10:00+09:00",
  scheduledEndAt: "2026-05-01T09:30:00+09:00",
  visitPurpose: "DEN-63 persisted appointment",
  status: "confirmed",
  createdAt: "2026-05-01T08:00:00+09:00",
  updatedAt: "2026-05-01T08:00:00+09:00",
};

const encounter: Encounter = {
  id: "encounter-db-walkin-coco",
  workspaceId: "clair-demo",
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "user-vet-suji",
  encounterNo: "E-DEN63-0001",
  receptionType: "walk_in",
  durationMinutes: 30,
  chiefComplaint: "DEN-63 persisted walk-in",
  visitPurpose: "DEN-63 persisted walk-in",
  status: "waiting",
  checkedInAt: "2026-05-01T10:15:00+09:00",
  createdAt: "2026-05-01T10:15:00+09:00",
  updatedAt: "2026-05-01T10:15:00+09:00",
};

const queueEntry: WaitingQueueEntry = {
  id: "queue-db-walkin-coco",
  workspaceId: "clair-demo",
  encounterId: encounter.id,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: 1,
  enteredAt: "2026-05-01T10:15:00+09:00",
};

test("reception calendar read route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.get(
    "/api/workspaces/clair-demo/reception/calendar/day?date=2026-05-01"
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const mockFallback = await request.get(
    "/api/workspaces/clair-demo/reception/calendar/day?date=2026-05-01",
    {
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    }
  );
  expect(mockFallback.status()).toBe(200);
  await expectJson(mockFallback, {
    ok: true,
    records: [],
    enforcedBy: "reception-calendar-read",
  });
});

test("reception calendar read core enforces active workspace membership and reception view", async () => {
  const missingMembership = await readReceptionDayCalendar({
    actorUserId: "user-front-desk",
    date: "2026-05-01",
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
    gateway: createMockReceptionCalendarReadGateway({
      records: [{ appointment, encounter, queueEntry }],
    }),
  });

  expect(missingMembership).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });

  const noReceptionView = await readReceptionDayCalendar({
    actorUserId: "user-without-view",
    date: "2026-05-01",
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
    gateway: createMockReceptionCalendarReadGateway({
      records: [{ appointment, encounter, queueEntry }],
    }),
  });

  expect(noReceptionView).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("reception calendar read core authorizes through legacy DB roles when additive assignments are absent", async () => {
  const calls: string[] = [];
  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    now: "2026-07-02T00:00:00.000Z",
    workspaceId: "clair-demo",
    sessionUserId: "user-front-desk",
    gateway: createLegacyReceptionViewPermissionGateway(calls),
  });

  const result = await readReceptionDayCalendar({
    actorUserId: "user-front-desk",
    date: "2026-05-01",
    workspaceId: "clair-demo",
    permissionAdapter,
    gateway: createMockReceptionCalendarReadGateway({
      records: [{ appointment, encounter, queueEntry }],
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
    enforcedBy: "reception-calendar-read",
    records: [
      {
        appointment: { id: appointment.id },
        encounter: { id: encounter.id },
        queueEntry: { id: queueEntry.id },
      },
    ],
  });
});

test("supabase reception calendar gateway maps rows and keeps workspace date scope in the RPC read", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionCalendarReadGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_day}`);
      return {
        data: [{ appointment, encounter, queueEntry }],
        error: null,
      };
    },
  });

  const result = await gateway.listReceptionDay({
    date: "2026-05-01",
    workspaceId: "clair-demo",
  });

  expect(calls).toEqual(["clair_list_reception_day_calendar:clair-demo:2026-05-01"]);
  expect(result).toMatchObject({
    ok: true,
    records: [
      {
        appointment: {
          id: "appointment-db-coco",
          scheduledEndAt: "2026-05-01T09:30:00+09:00",
          workspaceId: "clair-demo",
        },
        encounter: {
          checkedInAt: "2026-05-01T10:15:00+09:00",
          durationMinutes: 30,
          id: "encounter-db-walkin-coco",
          workspaceId: "clair-demo",
        },
        queueEntry: {
          enteredAt: "2026-05-01T10:15:00+09:00",
          id: "queue-db-walkin-coco",
          workspaceId: "clair-demo",
        },
      },
    ],
  });
});

test("supabase reception calendar gateway accepts snake_case walk-in rows with embedded profiles", async () => {
  const gateway = createSupabaseReceptionCalendarReadGateway({
    async rpc() {
      return {
        data: [
          {
            encounter: {
              id: "encounter-calendar-live-luna",
              workspace_id: "clair-demo",
              patient_id: "patient-live-luna",
              guardian_id: "guardian-live-jiyu",
              primary_veterinarian_id: "user-vet-suji",
              encounter_no: "E-CAL-0002",
              reception_type: "walk_in",
              duration_minutes: 30,
              chief_complaint: "calendar readback verification",
              visit_purpose: "calendar readback verification",
              status: "waiting",
              checked_in_at: "2026-05-01T14:15:00+09:00",
              created_at: "2026-05-01T14:15:00+09:00",
              updated_at: "2026-05-01T14:15:00+09:00",
            },
            patient: {
              id: "patient-live-luna",
              workspace_id: "clair-demo",
              patient_no: "P-LIVE-0002",
              name: "루나",
              species: "cat",
              sex: "female",
              handling_caution_locked: true,
              status: "active",
              created_at: "2026-05-01T00:00:00+09:00",
              updated_at: "2026-05-01T00:00:00+09:00",
            },
            primary_guardian: {
              id: "guardian-live-jiyu",
              workspace_id: "clair-demo",
              name: "박지유",
              mobile_phone: "010-2222-3333",
              created_at: "2026-05-01T00:00:00+09:00",
              updated_at: "2026-05-01T00:00:00+09:00",
            },
            queue_entry: {
              id: "queue-calendar-live-luna",
              workspace_id: "clair-demo",
              encounter_id: "encounter-calendar-live-luna",
              queue_type: "consultation",
              status: "waiting",
              priority: "normal",
              sort_order: 1,
              entered_at: "2026-05-01T14:15:00+09:00",
            },
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.listReceptionDay({
    date: "2026-05-01",
    workspaceId: "clair-demo",
  });

  expect(result).toMatchObject({
    ok: true,
    records: [
      {
        encounter: {
          id: "encounter-calendar-live-luna",
          durationMinutes: 30,
          patientId: "patient-live-luna",
          primaryVeterinarianId: "user-vet-suji",
          checkedInAt: "2026-05-01T14:15:00+09:00",
        },
        patient: { id: "patient-live-luna", name: "루나" },
        primaryGuardian: { id: "guardian-live-jiyu", name: "박지유" },
        queueEntry: {
          id: "queue-calendar-live-luna",
          enteredAt: "2026-05-01T14:15:00+09:00",
        },
      },
    ],
  });
});

test("reception calendar read route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/calendar/day/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/reception/server-reception-calendar-read.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource.indexOf("loadWorkspacePermissionAdapterFromDb")).toBeLessThan(
    routeSource.indexOf("readReceptionDayCalendar")
  );
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

test("reception day calendar reader migration keeps appointment and walk-in rows workspace-scoped", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260519150000_reception_day_calendar_reader.sql",
    "utf8"
  );

  expect(migrationSource).toContain(
    "create or replace function public.clair_list_reception_day_calendar"
  );
  expect(migrationSource).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migrationSource).toContain("a.workspace_id = p_workspace_id");
  expect(migrationSource).toContain("e.workspace_id = p_workspace_id");
  expect(migrationSource).toContain("e.appointment_id is null");
  expect(migrationSource).toContain("'scheduledEndAt', a.scheduled_end_at");
  expect(migrationSource).toContain("'patient',");
  expect(migrationSource).toContain("'primaryGuardian',");
  expect(migrationSource).toContain("left join public.patients p");
  expect(migrationSource).toContain("left join public.guardians g");
  expect(migrationSource).toContain("'durationMinutes', e.duration_minutes");
  expect(migrationSource).toContain("'checkedInAt', e.checked_in_at");
  expect(migrationSource).toContain("'enteredAt', q.entered_at");
  expect(migrationSource).toContain(
    "grant execute on function public.clair_list_reception_day_calendar"
  );
  expect(migrationSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  await expect(response.json()).resolves.toMatchObject(expected);
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
