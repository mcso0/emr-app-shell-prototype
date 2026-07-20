import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createReceptionAppointment,
  createSupabaseReceptionAppointmentCreateGateway,
  type SupabaseReceptionAppointmentCreateRpcClient,
} from "../src/features/reception/server-appointment-create-core";

const validInput = {
  assignedVeterinarianId: "user-vet-doyun",
  durationMinutes: 30,
  guardianId: "guardian-oh-sea",
  patientId: "patient-nabi",
  reservationMemo: "DEN-516 예약 메모",
  scheduledStartAt: "2026-05-01T13:00:00+09:00",
};

function getUniqueBusinessStartAt() {
  const date = new Date(Date.UTC(2027, 0, 1 + (Date.now() % 700)));
  while (date.getUTCDay() === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T14:00:00+09:00`;
}

test("appointment create route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const routeInput = {
    ...validInput,
    scheduledStartAt: getUniqueBusinessStartAt(),
  };
  const unauthenticated = await request.post(
    "/api/workspaces/clair-demo/reception/appointments",
    { data: routeInput },
  );
  expect(unauthenticated.status()).toBe(401);
  await expect(unauthenticated.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "unauthenticated",
  });

  const created = await request.post(
    "/api/workspaces/clair-demo/reception/appointments",
    {
      data: routeInput,
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    },
  );
  expect(created.status()).toBe(201);
  const body = await created.json() as {
    ok: true;
    appointment: {
      patientId: string;
      scheduledStartAt: string;
      status: string;
      visitPurpose?: string;
    };
    enforcedBy: string;
  };

  expect(body.ok).toBe(true);
  expect(body.enforcedBy).toBe("reception-appointment-create");
  expect(body.appointment).toMatchObject({
    patientId: "patient-nabi",
    scheduledStartAt: routeInput.scheduledStartAt,
    status: "confirmed",
    visitPurpose: validInput.reservationMemo,
  });
});

test("prepared clinic appointment create route rejects demo-header fallback", async ({
  request,
}) => {
  const denied = await request.post(
    "/api/workspaces/workspace-clair-cheongdam/reception/appointments",
    {
      data: {
        ...validInput,
        patientId: "49121000-0000-4000-8000-000000000004",
        guardianId: undefined,
        assignedVeterinarianId: "user-cheongdam-director",
        scheduledStartAt: "2026-06-17T10:00:00+09:00",
      },
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    },
  );

  expect(denied.status()).toBe(401);
  await expect(denied.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "unauthenticated",
    sessionReason: "supabase_session_required",
  });
});

test("supabase appointment create gateway rejects mock veterinarian IDs before RPC write", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionAppointmentCreateGateway({
    async rpc(functionName: string) {
      calls.push(`rpc:${functionName}`);
      return {
        data: null,
        error: {
          message: 'invalid input syntax for type uuid: "user-vet-suji"',
        },
      };
    },
  } as SupabaseReceptionAppointmentCreateRpcClient);

  const result = await gateway.createAppointment({
    actorUserId: "49110000-0000-4000-8000-000000000001",
    workspaceId: "workspace-clair-cheongdam",
    input: {
      ...validInput,
      assignedVeterinarianId: "user-vet-suji",
      guardianId: "49120000-0000-4000-8000-000000000004",
      patientId: "49121000-0000-4000-8000-000000000004",
      scheduledStartAt: "2026-06-22T10:30:00+09:00",
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "primary_veterinarian_unavailable",
  });
  expect(calls).not.toContain("rpc:clair_create_reception_appointment");
});

test("appointment create core enforces reception create permission", async () => {
  const denied = await createReceptionAppointment({
    actorUserId: "user-vet",
    input: validInput,
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

test("appointment create core validates patient, business hours, closed day, and slot conflicts", async () => {
  const missingPatient = await createReceptionAppointment({
    actorUserId: "user-front-desk",
    input: { ...validInput, patientId: "patient-missing" },
    workspaceId: "clair-demo",
  });
  expect(missingPatient).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "patient_unavailable",
  });

  const outsideBusinessHours = await createReceptionAppointment({
    actorUserId: "user-front-desk",
    input: { ...validInput, scheduledStartAt: "2026-05-01T08:30:00+09:00" },
    workspaceId: "clair-demo",
  });
  expect(outsideBusinessHours).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "appointment_outside_business_hours",
  });

  const closedDay = await createReceptionAppointment({
    actorUserId: "user-front-desk",
    input: { ...validInput, scheduledStartAt: "2026-05-03T10:00:00+09:00" },
    workspaceId: "clair-demo",
  });
  expect(closedDay).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "appointment_closed_day",
  });

  const conflict = await createReceptionAppointment({
    actorUserId: "user-front-desk",
    input: { ...validInput, scheduledStartAt: "2026-05-01T10:50:00+09:00" },
    workspaceId: "clair-demo",
  });
  expect(conflict).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "appointment_slot_unavailable",
  });
});

test("appointment create persists role-agnostic operational assignees", async () => {
  const created = await createReceptionAppointment({
    actorUserId: "user-front-desk",
    input: {
      ...validInput,
      assignedStaffUserIds: ["user-tech-hayun", "user-desk-yuna", "user-billing-harin"],
      scheduledStartAt: getUniqueBusinessStartAt().replace("14:00", "16:00"),
    },
    workspaceId: "clair-demo",
  });
  expect(created).toMatchObject({
    ok: true,
    appointment: {
      assignedStaffUserIds: expect.arrayContaining([
        "user-vet-doyun",
        "user-tech-hayun",
        "user-desk-yuna",
        "user-billing-harin",
      ]),
    },
  });

  const invalidAssignee = await createReceptionAppointment({
    actorUserId: "user-front-desk",
    input: {
      ...validInput,
      assignedStaffUserIds: ["user-not-in-workspace"],
      scheduledStartAt: getUniqueBusinessStartAt(),
    },
    workspaceId: "clair-demo",
  });
  expect(invalidAssignee).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "assigned_staff_unavailable",
  });
});

test("supabase appointment create gateway keeps workspace scope in the RPC write", async () => {
  const calls: string[] = [];
  const rpcPayloads: unknown[] = [];
  const rpcInput = {
    ...validInput,
    assignedVeterinarianId: "00000000-0000-4000-8000-000000000002",
  };
  const gateway = createSupabaseReceptionAppointmentCreateGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_appointment.patientId}`);
      rpcPayloads.push(args.p_appointment);
      return {
        data: {
          id: "appointment-den516",
          workspaceId: "clair-demo",
          patientId: "patient-nabi",
          guardianId: "guardian-oh-sea",
          assignedVeterinarianId: rpcInput.assignedVeterinarianId,
          scheduledStartAt: validInput.scheduledStartAt,
          scheduledEndAt: "2026-05-01T13:30:00+09:00",
          visitPurpose: validInput.reservationMemo,
          status: "confirmed",
          createdByUserId: "user-front-desk",
          createdAt: "2026-06-16T10:00:00+09:00",
          updatedAt: "2026-06-16T10:00:00+09:00",
        },
        error: null,
      };
    },
  });

  const result = await gateway.createAppointment({
    actorUserId: "user-front-desk",
    input: rpcInput,
    workspaceId: "clair-demo",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected appointment create success");
  expect(result.appointment.status).toBe("confirmed");
  expect(calls).toEqual([
    "clair_create_reception_appointment:clair-demo:patient-nabi",
  ]);
  expect(rpcPayloads).toEqual([
    expect.objectContaining({
      patientId: "patient-nabi",
    }),
  ]);
  expect(rpcPayloads[0]).not.toHaveProperty("weightKg");
});

test("appointment create keeps the created reservation when audit append fails after DB write", async () => {
  const scheduledStartAt = getUniqueBusinessStartAt();
  const appointment = {
    id: "appointment-cheongdam-gureum-0900",
    workspaceId: "workspace-clair-cheongdam",
    patientId: "49121000-0000-4000-8000-000000000004",
    guardianId: "49120000-0000-4000-8000-000000000004",
    assignedVeterinarianId: "49110000-0000-4000-8000-000000000003",
    scheduledStartAt,
    scheduledEndAt: scheduledStartAt.replace("13:00:00", "13:30:00"),
    visitPurpose: "구름 09시 예약",
    symptomNote: "구름 09시 예약",
    status: "confirmed" as const,
    createdByUserId: "49110000-0000-4000-8000-000000000001",
    createdAt: "2026-06-25T23:55:00+09:00",
    updatedAt: "2026-06-25T23:55:00+09:00",
  };

  const result = await createReceptionAppointment({
    actorUserId: "49110000-0000-4000-8000-000000000001",
    workspaceId: "workspace-clair-cheongdam",
    input: {
      assignedVeterinarianId: appointment.assignedVeterinarianId,
      durationMinutes: 30,
      guardianId: appointment.guardianId,
      patientId: appointment.patientId,
      reservationMemo: appointment.visitPurpose,
      scheduledStartAt,
    },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [
        {
          id: "49110000-0000-4000-8000-000000000001",
          status: "active",
        },
      ],
      memberships: [
        {
          id: "membership-cheongdam-owner",
          workspaceId: "workspace-clair-cheongdam",
          userId: "49110000-0000-4000-8000-000000000001",
          roles: ["hospital_admin"],
          status: "active",
        },
      ],
    }),
    gateway: {
      async createAppointment() {
        return { ok: true, appointment };
      },
    },
    auditGateway: {
      async appendEvent() {
        return { ok: false, status: 500, error: "db_write_failed" };
      },
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 201,
    workspaceId: "workspace-clair-cheongdam",
    appointment: {
      id: "appointment-cheongdam-gureum-0900",
      patientId: "49121000-0000-4000-8000-000000000004",
      scheduledStartAt,
      status: "confirmed",
    },
  });
});

test("appointment create route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/appointments/route.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource).toContain("permissionAdapter");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("isPreparedEmptyClinicWorkspace");
  expect(routeSource).toContain("supabase_session_required");
  expect(routeSource).not.toContain("SUPABASE_SERVICE_ROLE");
  expect(routeSource).not.toContain("service_role");
});

test("appointment create writer migration inserts workspace-scoped appointments and blocks conflicts", () => {
  const baseMigration = readFileSync(
    "supabase/migrations/20260616100000_reception_appointment_create_writer.sql",
    "utf8",
  );
  const weightMigration = readFileSync(
    "supabase/migrations/20260617113000_reception_appointment_create_weight_writer.sql",
    "utf8",
  );
  const migration = `${baseMigration}\n${weightMigration}`;

  expect(migration).toContain("clair_create_reception_appointment");
  expect(migration).toContain("reception.appointment_created");
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain("insert into public.appointments");
  expect(migration).toContain("appointment_slot_unavailable");
  expect(migration).toContain("appointment_outside_business_hours");
  expect(migration).toContain("appointment_closed_day");
  expect(migration).toContain("v_weight_kg");
  expect(migration).toContain("weight_kg = round(v_weight_kg, 2)");
  expect(migration).toContain("insert into public.appointment_change_logs");
  expect(migration).toContain("grant execute on function public.clair_create_reception_appointment");

  const assignmentMigration = readFileSync(
    "supabase/migrations/20260720121207_appointment_staff_assignments.sql",
    "utf8",
  );
  expect(assignmentMigration).toContain("appointment_staff_assignments");
  expect(assignmentMigration).toContain("assignedStaffUserIds");
  expect(assignmentMigration).toContain("m.roles @> array['vet']::text[]");
});
