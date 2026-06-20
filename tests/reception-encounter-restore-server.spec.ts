import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseReceptionEncounterRestoreGateway,
  restoreReceptionEncounter,
} from "../src/features/reception/server-encounter-restore-core";

type SupabaseEncounterRestoreClient = Parameters<
  typeof createSupabaseReceptionEncounterRestoreGateway
>[0];

const workspaceId = "clair-demo";
const encounter = {
  id: "encounter-restore-cancelled",
  workspaceId,
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "user-vet-doyun",
  encounterNo: "E-RESTORE-0001",
  receptionType: "walk_in" as const,
  durationMinutes: 30,
  chiefComplaint: "restore cancelled encounter",
  visitPurpose: "restore cancelled encounter",
  status: "cancelled" as const,
  checkedInAt: "2026-06-18T10:00:00+09:00",
  createdAt: "2026-06-18T10:00:00+09:00",
  updatedAt: "2026-06-18T10:10:00+09:00",
};
const queueEntry = {
  id: "queue-restore-cancelled",
  workspaceId,
  encounterId: encounter.id,
  queueType: "consultation" as const,
  status: "cancelled" as const,
  priority: "normal" as const,
  sortOrder: 1,
  enteredAt: "2026-06-18T10:00:00+09:00",
  finishedAt: "2026-06-18T10:10:00+09:00",
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

test("encounter restore marks cancelled encounter and queue waiting together", async () => {
  const result = await restoreReceptionEncounter({
    actorUserId: "user-front-desk",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async restoreEncounter() {
        return {
          ok: true,
          restoration: {
            encounter: { ...encounter, status: "waiting" },
            queueEntry: { ...queueEntry, status: "waiting" },
          },
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    workspaceId,
    restoration: {
      encounter: { id: encounter.id, status: "waiting" },
      queueEntry: { id: queueEntry.id, status: "waiting" },
    },
    enforcedBy: "reception-encounter-restore",
  });
});

test("encounter restore rejects active encounters", async () => {
  const result = await restoreReceptionEncounter({
    actorUserId: "user-front-desk",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async restoreEncounter() {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_already_active",
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_already_active",
  });
});

test("supabase encounter restore gateway calls scoped RPC and maps response", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionEncounterRestoreGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}`);
      return {
        data: {
          encounter: { ...encounter, status: "waiting" },
          queueEntry: { ...queueEntry, status: "waiting" },
        },
        error: null,
      };
    },
  } satisfies SupabaseEncounterRestoreClient);

  const result = await gateway.restoreEncounter({
    actorUserId: "user-front-desk",
    encounterId: encounter.id,
    workspaceId,
  });

  expect(calls).toEqual([
    "clair_restore_reception_encounter:clair-demo:encounter-restore-cancelled",
  ]);
  expect(result).toMatchObject({
    ok: true,
    restoration: {
      encounter: { id: encounter.id, status: "waiting" },
      queueEntry: { id: queueEntry.id, status: "waiting" },
    },
  });
});

test("encounter restore route and migration keep write boundary explicit", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/encounters/[encounterId]/restore/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/reception/server-encounter-restore.ts",
    "utf8",
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260618121000_reception_restore_writers.sql",
    "utf8",
  );

  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("reception_encounter_restore");
  expect(serverSource).toContain('import "server-only"');
  expect(migrationSource).toContain(
    "create or replace function public.clair_restore_reception_encounter",
  );
  expect(migrationSource).toContain("for update");
  expect(migrationSource).toContain("status = 'waiting'");
  expect(migrationSource).toContain("finished_at = null");
  expect(migrationSource).toContain(
    "grant execute on function public.clair_restore_reception_encounter",
  );
  expect(`${routeSource}\n${serverSource}\n${migrationSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});
