import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockConsultationFlowGateway,
  createSupabaseConsultationFlowGateway,
  mutateConsultationFlow,
} from "../src/features/chart/server-consultation-flow-core";
import type { Encounter, WaitingQueueEntry } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "encounter-waiting-consultation";
const migrationPath = "supabase/migrations/20260627183000_chart_cta_direct_start_flow.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const calledRetirementMigrationPath =
  "supabase/migrations/20260703090000_chart_consultation_called_status_retirement.sql";
const calledRetirementMigration = existsSync(calledRetirementMigrationPath)
  ? readFileSync(calledRetirementMigrationPath, "utf8")
  : "";
const firstChartMigrationPath =
  "supabase/migrations/20260913103000_chart_consultation_first_chart.sql";
const firstChartMigration = existsSync(firstChartMigrationPath)
  ? readFileSync(firstChartMigrationPath, "utf8")
  : "";
const roomId = "room-consult-1";

const baseEncounter: Encounter = {
  id: encounterId,
  workspaceId,
  patientId: "patient-consultation-flow",
  guardianId: "guardian-consultation-flow",
  primaryVeterinarianId: "user-vet",
  encounterNo: "E-CONSULT-0001",
  chiefComplaint: "Synthetic consultation flow",
  status: "waiting",
  checkedInAt: "2026-06-25T14:15:00+09:00",
  createdAt: "2026-06-25T14:15:00+09:00",
  updatedAt: "2026-06-25T14:15:00+09:00",
};

const baseQueueEntry: WaitingQueueEntry = {
  id: "queue-waiting-consultation",
  workspaceId,
  encounterId,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: 1,
  enteredAt: "2026-06-25T14:15:00+09:00",
};

test("consultation flow core calls and starts consultation in one action", async () => {
  const encounters = [{ ...baseEncounter }];
  const waitingQueueEntries = [{ ...baseQueueEntry }];
  const gateway = createMockConsultationFlowGateway(
    { encounters, waitingQueueEntries },
    () => "2026-06-25T05:20:00.000Z",
  );
  const permissionAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-vet", status: "active" }],
    memberships: [
      {
        id: "membership-vet",
        workspaceId,
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });

  const beforeCall = Date.now();
  const called = await mutateConsultationFlow({
    actorUserId: "user-vet",
    workspaceId,
    input: { action: "call", encounterId, roomId },
    gateway,
    permissionAdapter,
  });

  expect(called).toMatchObject({
    ok: true,
    status: 200,
    flow: {
      encounter: {
        status: "in_consultation",
        startedAt: "2026-06-25T05:20:00.000Z",
      },
      queueEntry: {
        status: "in_progress",
        calledAt: "2026-06-25T05:20:00.000Z",
      },
      callEvent: {
        eventType: "did_call_requested",
        deliveryStatus: "queued",
        roomId,
        roomName: "1진료실",
      },
      chart: {
        encounterId,
        status: "draft",
      },
    },
  });
  expect(called.ok && called.flow.chart?.clinicalAt).toBe(
    called.ok ? called.flow.chart?.createdAt : undefined,
  );
  expect(
    called.ok && called.flow.chart
      ? Date.parse(called.flow.chart.createdAt)
      : Number.NaN,
  ).toBeGreaterThanOrEqual(beforeCall);

  const returned = await mutateConsultationFlow({
    actorUserId: "user-vet",
    workspaceId,
    input: { action: "return_to_waiting", encounterId },
    gateway,
    permissionAdapter,
  });

  expect(returned).toMatchObject({
    ok: true,
    status: 200,
    flow: {
      encounter: { status: "waiting" },
      queueEntry: { status: "waiting" },
    },
  });
});

test("consultation flow core rejects unauthorized users and stale transitions", async () => {
  const missingRoom = await mutateConsultationFlow({
    actorUserId: "user-vet",
    workspaceId,
    input: { action: "call", encounterId },
  });
  expect(missingRoom).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { roomId: "진료실을 선택해 주세요." },
  });

  const denied = await mutateConsultationFlow({
    actorUserId: "user-front-desk",
    workspaceId,
    input: { action: "call", encounterId, roomId },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-front-desk",
          workspaceId,
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
  });
  expect(denied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const staleStart = await mutateConsultationFlow({
    actorUserId: "user-vet",
    workspaceId,
    input: { action: "start", encounterId },
    gateway: createMockConsultationFlowGateway({
      encounters: [{ ...baseEncounter }],
      waitingQueueEntries: [{ ...baseQueueEntry }],
    }),
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet",
          workspaceId,
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
  });
  expect(staleStart).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "stale_status",
  });
});

test("consultation flow Supabase gateway calls direct-start and return RPCs", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseConsultationFlowGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_room_id ?? "-"}`);
      return {
        data: {
          encounter: {
            ...baseEncounter,
            status:
              functionName === "clair_return_consultation_to_waiting"
                ? "waiting"
                : "in_consultation",
            startedAt:
              functionName === "clair_return_consultation_to_waiting"
                ? undefined
                : "2026-06-25T05:20:00.000Z",
          },
          queueEntry: {
            ...baseQueueEntry,
            status:
              functionName === "clair_return_consultation_to_waiting"
                ? "waiting"
                : "in_progress",
            calledAt: "2026-06-25T05:20:00.000Z",
          },
          callEvent:
            functionName === "clair_call_consultation_queue"
              ? {
                  id: "call-event-supabase",
                  workspaceId,
                  encounterId,
                  queueEntryId: baseQueueEntry.id,
                  eventType: "did_call_requested",
                  displayText: "1진료실로 환자를 호출하고 진료를 시작합니다.",
                  deliveryStatus: "queued",
                  roomId,
                  roomName: "1진료실",
                  createdAt: "2026-06-25T05:20:00.000Z",
                  createdByUserId: "user-vet",
                }
              : undefined,
          chart:
            functionName === "clair_return_consultation_to_waiting"
              ? undefined
              : {
                  id: "chart-first-supabase",
                  encounterId,
                  authorUserId: "user-vet",
                  status: "draft",
                  createdAt: "2026-06-25T05:20:00.000Z",
                  updatedAt: "2026-06-25T05:20:00.000Z",
                },
        },
        error: null,
      };
    },
  });

  await gateway.callConsultation({
    actorUserId: "user-vet",
    encounterId,
    room: {
      id: roomId,
      name: "1진료실",
      spaceType: "consultation_room",
      status: "active",
      isCallTarget: true,
      sortOrder: 10,
    },
    workspaceId,
  });
  await gateway.returnConsultationToWaiting({ actorUserId: "user-vet", encounterId, workspaceId });

  expect(calls).toEqual([
    `clair_call_consultation_queue:${workspaceId}:${encounterId}:${roomId}`,
    `clair_return_consultation_to_waiting:${workspaceId}:${encounterId}:-`,
  ]);
});

test("consultation direct-start migration stores room snapshots and return RPC", () => {
  expect(migration).toContain("create or replace function public.clair_call_consultation_queue");
  expect(migration).toContain("create or replace function public.clair_return_consultation_to_waiting");
  expect(migration).toContain("p_room_id text");
  expect(migration).toContain("raise exception 'room_unavailable'");
  expect(migration).toContain("raise exception 'stale_status'");
  expect(migration).toContain("status = 'in_consultation'");
  expect(migration).toContain("status = 'in_progress'");
  expect(migration).toContain("status = 'waiting'");
  expect(migration).toContain("'chart.consultation_returned_to_waiting'");
  expect(migration).toContain("'roomId', p_room_id");
  expect(migration).toContain("'roomName', v_room_name");
  expect(migration).toContain("grant execute on function public.clair_call_consultation_queue(text, text, uuid, text) to authenticated");
  expect(migration).toContain("grant execute on function public.clair_return_consultation_to_waiting(text, text, uuid) to authenticated");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("consultation called-retirement migration prevents new called queue rows", () => {
  expect(calledRetirementMigration).toContain(
    "create or replace function public.clair_call_consultation_queue",
  );
  expect(calledRetirementMigration).toContain("p_room_id text");
  expect(calledRetirementMigration).toContain("status = 'in_consultation'");
  expect(calledRetirementMigration).toContain("status = 'in_progress'");
  expect(calledRetirementMigration).toContain("where queue_type = 'consultation'");
  expect(calledRetirementMigration).toContain("and status = 'called'");
  expect(calledRetirementMigration).toContain(
    "grant execute on function public.clair_call_consultation_queue(text, text, uuid, text) to authenticated",
  );
  expect(calledRetirementMigration).toContain(
    "grant execute on function public.clair_call_consultation_queue(text, text, uuid) to authenticated",
  );
  expect(calledRetirementMigration).not.toContain("status = 'called',");
  expect(calledRetirementMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("consultation first-chart migration serializes preparation without changing additional-chart creation", () => {
  expect(firstChartMigration).toContain(
    "private.clair_ensure_encounter_first_chart_internal",
  );
  expect(firstChartMigration).toContain(
    "perform private.clair_require_chart_encounter",
  );
  expect(firstChartMigration).toContain("and s.status <> 'voided'");
  expect(firstChartMigration).toContain("order by s.created_at, s.id");
  expect(firstChartMigration).toContain(
    "v_flow || pg_catalog.jsonb_build_object('chart', v_chart)",
  );
  expect(firstChartMigration).toContain(
    "grant execute on function public.clair_ensure_encounter_first_chart(text, text, uuid)",
  );
  expect(firstChartMigration).not.toContain(
    "create or replace function public.clair_create_encounter_chart",
  );
  expect(firstChartMigration).not.toMatch(
    /db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("consultation flow route stays server-owned and secret-free", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/consultation-flow/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/chart/server-consultation-flow.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});
