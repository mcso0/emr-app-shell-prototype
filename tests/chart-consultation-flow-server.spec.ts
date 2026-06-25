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
const migrationPath = "supabase/migrations/20260625103000_chart_consultation_flow_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

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
    input: { action: "call", encounterId },
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
  const denied = await mutateConsultationFlow({
    actorUserId: "user-front-desk",
    workspaceId,
    input: { action: "call", encounterId },
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
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}`);
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
        },
        error: null,
      };
    },
  });

  await gateway.callConsultation({ actorUserId: "user-vet", encounterId, workspaceId });
  await gateway.startConsultation({ actorUserId: "user-vet", encounterId, workspaceId });

  expect(calls).toEqual([
    `clair_call_consultation_queue:${workspaceId}:${encounterId}`,
    `clair_start_consultation:${workspaceId}:${encounterId}`,
  ]);
});

test("consultation flow migration defines local outbox and guarded RPCs", () => {
  expect(migration).toContain("create table if not exists public.encounter_call_events");
  expect(migration).toContain("delivery_status text not null default 'queued'");
  expect(migration).toContain("create or replace function public.clair_call_consultation_queue");
  expect(migration).toContain("create or replace function public.clair_start_consultation");
  expect(migration).toContain("raise exception 'stale_status'");
  expect(migration).toContain("status in ('in_consultation', 'ordered', 'ready_for_billing', 'completed')");
  expect(migration).toContain("'chart.patient_called'");
  expect(migration).toContain("'chart.consultation_started'");
  expect(migration).toContain("grant execute on function public.clair_call_consultation_queue");
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
