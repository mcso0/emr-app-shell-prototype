import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  cancelReceptionEncounter,
  createSupabaseReceptionEncounterCancelGateway,
} from "../src/features/reception/server-encounter-cancel-core";

type SupabaseEncounterCancelClient = Parameters<
  typeof createSupabaseReceptionEncounterCancelGateway
>[0];

const workspaceId = "clair-demo";
const encounter = {
  id: "encounter-den510-cancel",
  workspaceId,
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "user-vet-doyun",
  encounterNo: "E-DEN510-0001",
  receptionType: "walk_in" as const,
  durationMinutes: 30,
  chiefComplaint: "DEN-510 cancel",
  visitPurpose: "DEN-510 cancel",
  status: "waiting" as const,
  checkedInAt: "2026-06-16T14:20:00+09:00",
  createdAt: "2026-06-16T14:20:00+09:00",
  updatedAt: "2026-06-16T14:20:00+09:00",
};
const queueEntry = {
  id: "queue-den510-cancel",
  workspaceId,
  encounterId: encounter.id,
  queueType: "consultation" as const,
  status: "waiting" as const,
  priority: "normal" as const,
  sortOrder: 1,
  enteredAt: "2026-06-16T14:20:00+09:00",
};
const frontDeskPermissionAdapter = createMockWorkspacePermissionAdapter({
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
});

test("DEN-510 mock encounter cancel marks encounter and consultation queue cancelled together", async () => {
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async cancelEncounter() {
        return {
          ok: true,
          cancellation: {
            encounter: {
              ...encounter,
              status: "cancelled",
              cancellationReason: "보호자 요청으로 진료를 취소합니다.",
            },
            queueEntry: { ...queueEntry, status: "cancelled" },
          },
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    workspaceId,
    cancellation: {
      encounter: {
        id: encounter.id,
        status: "cancelled",
        cancellationReason: "보호자 요청으로 진료를 취소합니다.",
      },
      queueEntry: { id: queueEntry.id, status: "cancelled" },
    },
    enforcedBy: "reception-encounter-cancel",
  });
});

test("DEN-510 encounter cancel rejects non-cancelable encounter state", async () => {
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async cancelEncounter() {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_not_cancelable",
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_not_cancelable",
  });
});

test("DEN-510 encounter cancel requires a human-readable cancel reason", async () => {
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: " ",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { cancelReason: "진료 취소 사유를 입력해 주세요." },
  });
});

test("DEN-510 supabase encounter cancel gateway calls scoped RPC and maps response", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionEncounterCancelGateway({
    async rpc(functionName, args) {
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_cancel_reason}`,
      );
      return {
        data: {
          encounter: {
            ...encounter,
            status: "cancelled",
            cancellationReason: args.p_cancel_reason,
          },
          queueEntry: { ...queueEntry, status: "cancelled" },
        },
        error: null,
      };
    },
  } satisfies SupabaseEncounterCancelClient);

  const result = await gateway.cancelEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
  });

  expect(calls).toEqual([
    "clair_cancel_reception_encounter:clair-demo:encounter-den510-cancel:보호자 요청으로 진료를 취소합니다.",
  ]);
  expect(result).toMatchObject({
    ok: true,
    cancellation: {
      encounter: {
        id: encounter.id,
        status: "cancelled",
        cancellationReason: "보호자 요청으로 진료를 취소합니다.",
      },
      queueEntry: { id: queueEntry.id, status: "cancelled" },
    },
  });
});

test("DEN-510 encounter cancel route and server wrapper keep write boundary explicit", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/encounters/[encounterId]/cancel/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/reception/server-encounter-cancel.ts",
    "utf8",
  );

  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("reception_encounter_cancel");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("DEN-510 encounter cancel writer migration updates encounter and queue in one RPC", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260627183000_chart_cta_direct_start_flow.sql",
    "utf8",
  );

  expect(migrationSource).toContain(
    "create or replace function public.clair_cancel_reception_encounter",
  );
  expect(migrationSource).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migrationSource).toContain("for update");
  expect(migrationSource).toContain("status = 'cancelled'");
  expect(migrationSource).toContain("p_cancel_reason text");
  expect(migrationSource).toContain("cancel_reason_required");
  expect(migrationSource).toContain("cancellation_reason = v_cancel_reason");
  expect(migrationSource).toContain("queue_type = 'consultation'");
  expect(migrationSource).toContain("'waiting', 'in_consultation'");
  expect(migrationSource).toContain("'waiting', 'called', 'in_progress'");
  expect(migrationSource).toContain(
    "grant execute on function public.clair_cancel_reception_encounter",
  );
  expect(migrationSource).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});
