import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseReceptionAppointmentRestoreGateway,
  restoreReceptionAppointment,
} from "../src/features/reception/server-appointment-restore-core";

type SupabaseAppointmentRestoreClient = Parameters<
  typeof createSupabaseReceptionAppointmentRestoreGateway
>[0];

const workspaceId = "clair-demo";
const appointment = {
  id: "appointment-restore-cancelled",
  workspaceId,
  patientId: "patient-luna",
  guardianId: "guardian-park-jiyu",
  assignedVeterinarianId: "user-vet-doyun",
  scheduledStartAt: "2026-06-18T11:00:00+09:00",
  scheduledEndAt: "2026-06-18T11:30:00+09:00",
  visitPurpose: "restore cancelled appointment",
  status: "cancelled" as const,
  createdAt: "2026-06-17T10:00:00+09:00",
  updatedAt: "2026-06-18T10:10:00+09:00",
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

test("appointment restore marks cancelled appointment confirmed", async () => {
  const result = await restoreReceptionAppointment({
    actorUserId: "user-front-desk",
    appointmentId: appointment.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async restoreAppointment() {
        return {
          ok: true,
          restoration: { appointment: { ...appointment, status: "confirmed" } },
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    workspaceId,
    restoration: {
      appointment: { id: appointment.id, status: "confirmed" },
    },
    enforcedBy: "reception-appointment-restore",
  });
});

test("appointment restore rejects appointments already linked to an active encounter", async () => {
  const result = await restoreReceptionAppointment({
    actorUserId: "user-front-desk",
    appointmentId: appointment.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async restoreAppointment() {
        return {
          ok: false,
          status: 409,
          denialReason: "appointment_active_encounter_exists",
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "appointment_active_encounter_exists",
  });
});

test("supabase appointment restore gateway calls scoped RPC and maps response", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionAppointmentRestoreGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_appointment_id}`);
      return {
        data: {
          appointment: { ...appointment, status: "confirmed" },
        },
        error: null,
      };
    },
  } satisfies SupabaseAppointmentRestoreClient);

  const result = await gateway.restoreAppointment({
    actorUserId: "user-front-desk",
    appointmentId: appointment.id,
    workspaceId,
  });

  expect(calls).toEqual([
    "clair_restore_reception_appointment:clair-demo:appointment-restore-cancelled",
  ]);
  expect(result).toMatchObject({
    ok: true,
    restoration: {
      appointment: { id: appointment.id, status: "confirmed" },
    },
  });
});

test("appointment restore route and migration keep write boundary explicit", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/restore/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/reception/server-appointment-restore.ts",
    "utf8",
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260618121000_reception_restore_writers.sql",
    "utf8",
  );

  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("reception_appointment_restore");
  expect(serverSource).toContain('import "server-only"');
  expect(migrationSource).toContain(
    "create or replace function public.clair_restore_reception_appointment",
  );
  expect(migrationSource).toContain("for update");
  expect(migrationSource).toContain("status = 'confirmed'");
  expect(migrationSource).toContain("appointment_active_encounter_exists");
  expect(migrationSource).toContain(
    "grant execute on function public.clair_restore_reception_appointment",
  );
  expect(`${routeSource}\n${serverSource}\n${migrationSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});
