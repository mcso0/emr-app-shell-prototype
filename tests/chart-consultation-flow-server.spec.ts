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
const migrationPath = "supabase/migrations/20260625113000_chart_consultation_room_selection.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
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

test("consultation flow core moves waiting to called and then in consultation", async () => {
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
      encounter: { status: "waiting" },
      queueEntry: {
        status: "called",
        calledAt: "2026-06-25T05:20:00.000Z",
      },
      callEvent: {
        eventType: "did_call_requested",
        deliveryStatus: "queued",
        roomId,
        roomName: "1진료실",
      },
    },
  });

  const started = await mutateConsultationFlow({
    actorUserId: "user-vet",
    workspaceId,
    input: { action: "start", encounterId },
    gateway,
    permissionAdapter,
  });

  expect(started).toMatchObject({
    ok: true,
    status: 200,
    flow: {
      encounter: {
        status: "in_consultation",
        startedAt: "2026-06-25T05:20:00.000Z",
      },
      queueEntry: { status: "in_progress" },
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

test("consultation flow Supabase gateway calls separated call and start RPCs", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseConsultationFlowGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_room_id ?? "-"}`);
      return {
        data: {
          encounter: {
            ...baseEncounter,
            status:
              functionName === "clair_start_consultation"
                ? "in_consultation"
                : "waiting",
            startedAt:
              functionName === "clair_start_consultation"
                ? "2026-06-25T05:20:00.000Z"
                : undefined,
          },
          queueEntry: {
            ...baseQueueEntry,
            status:
              functionName === "clair_start_consultation"
                ? "in_progress"
                : "called",
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
                  displayText: "1진료실로 환자를 호출합니다.",
                  deliveryStatus: "queued",
                  roomId,
                  roomName: "1진료실",
                  createdAt: "2026-06-25T05:20:00.000Z",
                  createdByUserId: "user-vet",
                }
              : undefined,
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
  await gateway.startConsultation({ actorUserId: "user-vet", encounterId, workspaceId });

  expect(calls).toEqual([
    `clair_call_consultation_queue:${workspaceId}:${encounterId}:${roomId}`,
    `clair_start_consultation:${workspaceId}:${encounterId}:-`,
  ]);
});

test("consultation room migration stores selected room snapshots", () => {
  expect(migration).toContain("add column if not exists room_name text");
  expect(migration).toContain("create or replace function public.clair_call_consultation_queue");
  expect(migration).toContain("p_room_id text");
  expect(migration).toContain("raise exception 'room_unavailable'");
  expect(migration).toContain("raise exception 'stale_status'");
  expect(migration).toContain("'roomId', p_room_id");
  expect(migration).toContain("'roomName', v_room_name");
  expect(migration).toContain("revoke all on function public.clair_call_consultation_queue(text, text, uuid) from authenticated");
  expect(migration).toContain("grant execute on function public.clair_call_consultation_queue(text, text, uuid, text) to authenticated");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
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
