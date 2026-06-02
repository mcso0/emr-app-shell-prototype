import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createReceptionAppointmentCheckIn,
  createSupabaseReceptionAppointmentCheckInGateway,
} from "../src/features/reception/server-appointment-check-in-core";

const appointmentId = "appointment-nabi-260501";

test("appointment check-in route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.post(
    `/api/workspaces/clair-demo/reception/appointments/${appointmentId}/check-in`
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const mockFallback = await request.post(
    `/api/workspaces/clair-demo/reception/appointments/${appointmentId}/check-in`,
    {
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    }
  );
  expect(mockFallback.status()).toBe(201);
  const body = await mockFallback.json() as {
    ok: true;
    workspaceId: string;
    checkIn: {
      appointment: {
        id: string;
        status: string;
      };
      encounter: {
        id: string;
        appointmentId?: string;
        patientId: string;
        status: string;
      };
      queueEntry: {
        encounterId: string;
        queueType: string;
        status: string;
      };
    };
    enforcedBy: string;
  };

  expect(body.ok).toBe(true);
  expect(body.workspaceId).toBe("clair-demo");
  expect(body.enforcedBy).toBe("reception-appointment-check-in");
  expect(body.checkIn.appointment).toMatchObject({
    id: appointmentId,
    status: "checked_in",
  });
  expect(body.checkIn.encounter).toMatchObject({
    appointmentId,
    patientId: "patient-nabi",
    status: "waiting",
  });
  expect(body.checkIn.queueEntry).toMatchObject({
    encounterId: body.checkIn.encounter.id,
    queueType: "consultation",
    status: "waiting",
  });
});

test("appointment check-in core enforces reception create permission", async () => {
  const denied = await createReceptionAppointmentCheckIn({
    actorUserId: "user-vet",
    appointmentId,
    workspaceId: "clair-demo",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet",
          workspaceId: "clair-demo",
          userId: "user-vet",
          roles: ["vet"],
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
});

test("appointment check-in core validates appointment state and duplicate guard", async () => {
  const missing = await createReceptionAppointmentCheckIn({
    actorUserId: "user-front-desk",
    appointmentId: "appointment-missing",
    workspaceId: "clair-demo",
  });
  expect(missing).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "appointment_unavailable",
  });

  const alreadyCheckedIn = await createReceptionAppointmentCheckIn({
    actorUserId: "user-front-desk",
    appointmentId: "appointment-coco-260501",
    workspaceId: "clair-demo",
  });
  expect(alreadyCheckedIn).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "appointment_already_checked_in",
  });

  const notCheckInReady = await createReceptionAppointmentCheckIn({
    actorUserId: "user-front-desk",
    appointmentId: "appointment-haru-260501",
    workspaceId: "clair-demo",
  });
  expect(notCheckInReady).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "appointment_not_check_in_ready",
  });
});

test("supabase appointment check-in gateway keeps workspace scope in the RPC write", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionAppointmentCheckInGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_appointment_id}`);
      return {
        data: {
          appointment: {
            id: appointmentId,
            workspaceId: "clair-demo",
            patientId: "patient-nabi",
            guardianId: "guardian-oh-sea",
            assignedVeterinarianId: "user-vet-doyun",
            scheduledStartAt: "2026-05-01T10:45:00.000Z",
            scheduledEndAt: "2026-05-01T11:00:00.000Z",
            visitPurpose: "피부 재진",
            status: "checked_in",
            createdAt: "2026-04-30T11:10:00.000Z",
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
          encounter: {
            id: "encounter-db-appointment-nabi",
            workspaceId: "clair-demo",
            patientId: "patient-nabi",
            guardianId: "guardian-oh-sea",
            appointmentId,
            primaryVeterinarianId: "user-vet-doyun",
            encounterNo: "E-DB-0002",
            receptionType: "appointment",
            durationMinutes: 20,
            chiefComplaint: "피부 재진",
            visitPurpose: "피부 재진",
            status: "waiting",
            checkedInAt: "2026-05-19T00:00:00.000Z",
            createdAt: "2026-05-19T00:00:00.000Z",
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
          queueEntry: {
            id: "queue-db-appointment-nabi",
            workspaceId: "clair-demo",
            encounterId: "encounter-db-appointment-nabi",
            queueType: "consultation",
            status: "waiting",
            priority: "normal",
            enteredAt: "2026-05-19T00:00:00.000Z",
          },
        },
        error: null,
      };
    },
  });

  const result = await gateway.checkInAppointment({
    actorUserId: "user-front-desk",
    appointmentId,
    workspaceId: "clair-demo",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected appointment check-in success");
  expect(result.checkIn.appointment.status).toBe("checked_in");
  expect(result.checkIn.encounter.appointmentId).toBe(appointmentId);
  expect(calls).toEqual([
    `clair_check_in_reception_appointment:clair-demo:${appointmentId}`,
  ]);
});

test("appointment check-in route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in/route.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource).toContain("permissionAdapter");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).not.toContain("SUPABASE_SERVICE_ROLE");
  expect(routeSource).not.toContain("service_role");
});

test("appointment check-in writer migration updates appointment and creates linked queue", () => {
  const migration = readFileSync(
    "supabase/migrations/20260519130000_reception_appointment_check_in_writer.sql",
    "utf8"
  );

  expect(migration).toContain("clair_check_in_reception_appointment");
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain("status = 'checked_in'");
  expect(migration).toContain("appointment_already_checked_in");
  expect(migration).toContain("insert into public.encounters");
  expect(migration).toContain("appointment_id");
  expect(migration).toContain("insert into public.waiting_queue_entries");
  expect(migration).toContain("insert into public.appointment_change_logs");
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  await expect(response.json()).resolves.toMatchObject(expected);
}
