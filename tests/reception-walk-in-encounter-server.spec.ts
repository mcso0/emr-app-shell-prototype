import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockReceptionWalkInEncounterGateway,
  createSupabaseReceptionWalkInEncounterGateway,
  createReceptionWalkInEncounter,
} from "../src/features/reception/server-walk-in-encounter-core";
import type { ReceptionWalkInEncounterInput } from "../src/features/reception/walk-in-encounter";

type SupabaseWalkInClient = Parameters<
  typeof createSupabaseReceptionWalkInEncounterGateway
>[0];

const validVitals = {
  weightKg: 4.35,
  temperatureC: 38.6,
  respiratoryRateRpm: 24,
  bloodPressure: { systolicMmhg: 132, diastolicMmhg: 84 },
};

const validWalkInInput = {
  assignedStaffUserIds: ["user-desk-yuna"],
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "49110000-0000-4000-8000-000000000003",
  plannedStartAt: "2026-05-19T11:15:00+09:00",
  department: "내과",
  durationMinutes: 30,
  visitPurpose: "구토 재진 상담",
  memo: "보호자가 식욕 저하를 걱정함",
  vitals: validVitals,
};

test("walk-in encounter route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.post(
    "/api/workspaces/clair-demo/reception/walk-in-encounters",
    { data: validWalkInInput },
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const mockFallback = await request.post(
    "/api/workspaces/clair-demo/reception/walk-in-encounters",
    {
      data: validWalkInInput,
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    },
  );
  expect(mockFallback.status()).toBe(201);
  const body = (await mockFallback.json()) as {
    ok: true;
    workspaceId: string;
    walkIn: {
      encounter: {
        id: string;
        appointmentId?: string;
        checkedInAt?: string;
        durationMinutes?: number;
        patientId: string;
        guardianId?: string;
        receptionType?: string;
        status: string;
      };
      queueEntry: {
        encounterId: string;
        enteredAt?: string;
        queueType: string;
        status: string;
      };
    };
    enforcedBy: string;
  };

  expect(body.ok).toBe(true);
  expect(body.workspaceId).toBe("clair-demo");
  expect(body.enforcedBy).toBe("reception-walk-in-encounter");
	      expect(body.walkIn.encounter).toMatchObject({
	        patientId: "patient-coco",
	        guardianId: "guardian-lee-jieun",
	        durationMinutes: 30,
	        status: "waiting",
	        checkedInAt: "2026-05-19T11:15:00+09:00",
	      });
  expect(body.walkIn.encounter.appointmentId).toBeUndefined();
  expect(body.walkIn.queueEntry).toMatchObject({
    encounterId: body.walkIn.encounter.id,
    queueType: "consultation",
	    status: "waiting",
	    enteredAt: "2026-05-19T11:15:00+09:00",
	  });

  const invalidDuration = await request.post(
    "/api/workspaces/clair-demo/reception/walk-in-encounters",
    {
      data: { ...validWalkInInput, durationMinutes: 22 },
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    },
  );
  expect(invalidDuration.status()).toBe(400);
  await expectJson(invalidDuration, {
    ok: false,
    error: "invalid_input",
    fieldErrors: {
      durationMinutes: "예상 진료시간은 15분 단위로 설정해 주세요.",
    },
  });
});

test("walk-in encounter core enforces reception create permission", async () => {
  const denied = await createReceptionWalkInEncounter({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    input: validWalkInInput,
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

test("walk-in encounter requires exactly one reception assignee", async () => {
  for (const assignedStaffUserIds of [
    [],
    ["user-desk-yuna", "user-tech-hayun"],
  ]) {
    const result = await createReceptionWalkInEncounter({
      actorUserId: "user-front-desk",
      workspaceId: "clair-demo",
      input: { ...validWalkInInput, assignedStaffUserIds },
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: {
        assignedStaffUserIds: "접수 담당자를 1명 선택해 주세요.",
      },
    });
  }
});

test("walk-in encounter core validates patient and guardian workspace context", async () => {
  const missingPatient = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: { ...validWalkInInput, patientId: "patient-missing" },
  });
  expect(missingPatient).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "patient_unavailable",
  });

  const unlinkedGuardian = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: { ...validWalkInInput, guardianId: "guardian-oh-sea" },
  });
  expect(unlinkedGuardian).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "patient_guardian_link_missing",
  });
});

test("walk-in encounter core validates duration as a positive 15 minute step", async () => {
  const invalidDuration = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: { ...validWalkInInput, durationMinutes: 22 },
  });

  expect(invalidDuration).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: {
      durationMinutes: "예상 진료시간은 15분 단위로 설정해 주세요.",
    },
  });
});

test("walk-in encounter core validates nested vitals before gateway access", async () => {
  const invalidCases = [
    { vitals: { weightKg: 0 }, field: "vitals.weightKg" },
    { vitals: { weightKg: Number.NaN }, field: "vitals.weightKg" },
    { vitals: { temperatureC: -1 }, field: "vitals.temperatureC" },
    {
      vitals: { respiratoryRateRpm: 22.5 },
      field: "vitals.respiratoryRateRpm",
    },
    {
      vitals: { respiratoryRateRpm: Number.POSITIVE_INFINITY },
      field: "vitals.respiratoryRateRpm",
    },
    {
      vitals: { heartRateBpm: 88.5 },
      field: "vitals.heartRateBpm",
    },
    {
      vitals: { bloodPressure: { diastolicMmhg: 84 } },
      field: "vitals.bloodPressure.systolicMmhg",
    },
    {
      vitals: { bloodPressure: { systolicMmhg: 0, diastolicMmhg: 84 } },
      field: "vitals.bloodPressure.systolicMmhg",
    },
    {
      vitals: { bloodPressure: { systolicMmhg: 132, diastolicMmhg: 84.5 } },
      field: "vitals.bloodPressure.diastolicMmhg",
    },
  ] as const;

  let gatewayCalls = 0;
  for (const invalidCase of invalidCases) {
    const result = await createReceptionWalkInEncounter({
      actorUserId: "user-front-desk",
      workspaceId: "clair-demo",
      input: { ...validWalkInInput, vitals: invalidCase.vitals } as never,
      gateway: {
        async createWalkInEncounter() {
          gatewayCalls += 1;
          throw new Error("gateway must not run for invalid vitals");
        },
      },
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { [invalidCase.field]: expect.any(String) },
    });
  }
  expect(gatewayCalls).toBe(0);
});

test("walk-in encounter core omits an empty nested vitals object", async () => {
  let receivedInput: Record<string, unknown> | undefined;
  const mockGateway = createMockReceptionWalkInEncounterGateway();
  const result = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: { ...validWalkInInput, vitals: {} } as never,
    gateway: {
      async createWalkInEncounter(args) {
        receivedInput = args.input as unknown as Record<string, unknown>;
        return mockGateway.createWalkInEncounter(args);
      },
    },
  });

  expect(result).toMatchObject({ ok: true, status: 201 });
  expect(receivedInput).not.toHaveProperty("vitals");
  expect(receivedInput).not.toHaveProperty("weightKg");
});

test("walk-in encounter core rejects reception times outside business hours", async () => {
  const beforeOpen = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: { ...validWalkInInput, plannedStartAt: "2026-05-19T08:30:00+09:00" },
  });

  expect(beforeOpen).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "walk_in_outside_business_hours",
  });

  const afterClose = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: { ...validWalkInInput, plannedStartAt: "2026-05-19T18:45:00+09:00" },
  });

  expect(afterClose).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "walk_in_outside_business_hours",
  });
});

test("walk-in encounter core allows a reception that overlaps the configured break", async () => {
  const result = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: {
      ...validWalkInInput,
      plannedStartAt: "2026-05-19T13:45:00+09:00",
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 201,
    walkIn: {
      encounter: {
        checkedInAt: "2026-05-19T13:45:00+09:00",
        durationMinutes: 30,
      },
    },
  });
});

test("supabase walk-in encounter gateway keeps workspace scope in the RPC write", async () => {
  const calls: string[] = [];
  let createPayload:
    | {
        assignedStaffUserIds?: string[];
        durationMinutes?: number;
        plannedStartAt?: string;
        primaryVeterinarianId?: string;
        vitals?: typeof validVitals;
      }
    | undefined;
  const gateway = createSupabaseReceptionWalkInEncounterGateway({
    from(tableName: string) {
      if (tableName === "user_memberships") {
        return createSupabaseRows([
          {
            id: "membership-vet-suji",
            workspace_id: "clair-demo",
            user_id: "49110000-0000-4000-8000-000000000003",
            roles: ["vet"],
            status: "active",
          },
        ]);
      }

      return createSupabaseRows([
        {
          id: "49110000-0000-4000-8000-000000000003",
          status: "active",
        },
      ]);
    },
    async rpc(functionName: string, args: unknown) {
      if (functionName === "clair_search_reception_patient_guardian_lookup") {
        const lookupArgs = args as { p_query: string; p_workspace_id: string };
        calls.push(
          `${functionName}:${lookupArgs.p_workspace_id}:${lookupArgs.p_query}`,
        );
        return {
          data: [
            {
              patient: { id: "19421000-0000-4000-8000-000000000005" },
              primaryGuardian: { id: "19420000-0000-4000-8000-000000000005" },
            },
          ],
          error: null,
        };
      }

      const createArgs = args as {
        p_walk_in: {
          assignedStaffUserIds?: string[];
          durationMinutes?: number;
          patientId: string;
          plannedStartAt?: string;
          primaryVeterinarianId?: string;
          vitals?: typeof validVitals;
        };
        p_workspace_id: string;
      };
      createPayload = createArgs.p_walk_in;
      calls.push(
        `${functionName}:${createArgs.p_workspace_id}:${createArgs.p_walk_in.patientId}`,
      );
      return {
        data: {
          encounter: {
            id: "encounter-db-walkin-coco",
            workspaceId: "clair-demo",
	            patientId: "19421000-0000-4000-8000-000000000005",
	            guardianId: "19420000-0000-4000-8000-000000000005",
            primaryVeterinarianId: "49110000-0000-4000-8000-000000000003",
            assignedStaffUserIds: [
              "49110000-0000-4000-8000-000000000003",
              "49111000-0000-4000-8000-000000000004",
            ],
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
          },
          queueEntry: {
            id: "queue-db-walkin-coco",
            workspaceId: "clair-demo",
            encounterId: "encounter-db-walkin-coco",
            queueType: "consultation",
            status: "waiting",
            priority: "normal",
            enteredAt: "2026-05-19T00:00:00.000Z",
          },
        },
        error: null,
      };
    },
  } as unknown as SupabaseWalkInClient);

  const result = await gateway.createWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: {
      ...validWalkInInput,
      assignedStaffUserIds: ["49111000-0000-4000-8000-000000000004"],
    } as ReceptionWalkInEncounterInput & { assignedStaffUserIds: string[] },
  });

  expect(calls).toEqual([
    "clair_search_reception_patient_guardian_lookup:clair-demo:choco",
    "clair_create_reception_walk_in_encounter:clair-demo:19421000-0000-4000-8000-000000000005",
  ]);
  expect(createPayload?.primaryVeterinarianId).toBe(
    "49110000-0000-4000-8000-000000000003",
  );
  expect(createPayload?.assignedStaffUserIds).toEqual([
    "49111000-0000-4000-8000-000000000004",
  ]);
  expect(createPayload?.durationMinutes).toBe(30);
  expect(createPayload?.plannedStartAt).toBe("2026-05-19T11:15:00+09:00");
  expect(createPayload?.vitals).toEqual(validVitals);
  expect(createPayload).not.toHaveProperty("weightKg");
  expect(result).toMatchObject({
    ok: true,
    walkIn: {
      encounter: {
        id: "encounter-db-walkin-coco",
        workspaceId: "clair-demo",
        assignedStaffUserIds: [
          "49110000-0000-4000-8000-000000000003",
          "49111000-0000-4000-8000-000000000004",
        ],
      },
      queueEntry: { id: "queue-db-walkin-coco", workspaceId: "clair-demo" },
    },
  });
});

test("supabase walk-in encounter gateway rejects mock veterinarian IDs before RPC write", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionWalkInEncounterGateway({
    from(tableName: string) {
      calls.push(`from:${tableName}`);
      return createSupabaseRows([]);
    },
    async rpc(functionName: string) {
      calls.push(`rpc:${functionName}`);
      if (functionName === "clair_search_reception_patient_guardian_lookup") {
        return { data: [], error: null };
      }

      return {
        data: null,
        error: {
          message: 'invalid input syntax for type uuid: "user-vet-suji"',
        },
      };
    },
  } as unknown as SupabaseWalkInClient);

  const result = await gateway.createWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId: "workspace-clair-cheongdam",
    input: {
      ...validWalkInInput,
      guardianId: "49120000-0000-4000-8000-000000000023",
	      patientId: "49121000-0000-4000-8000-000000000023",
	      primaryVeterinarianId: "user-vet-suji",
	    },
	  });

	  expect(result).toMatchObject({
	    ok: false,
	    status: 409,
	    denialReason: "primary_veterinarian_unavailable",
	  });
	  expect(calls).not.toContain("rpc:clair_create_reception_walk_in_encounter");
});

test("walk-in encounter route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/walk-in-encounters/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/reception/server-walk-in-encounter.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource).toContain("permissionAdapter");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("walk-in encounter writer migration keeps encounter and queue writes scoped", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260519120000_reception_walk_in_encounter_writer.sql",
    "utf8",
  );

  expect(migrationSource).toContain(
    "create or replace function public.clair_create_reception_walk_in_encounter",
  );
  expect(migrationSource).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migrationSource).toContain("insert into public.encounters");
  expect(migrationSource).toContain("appointment_id");
  expect(migrationSource).toContain("null");
	  expect(migrationSource).toContain("insert into public.waiting_queue_entries");
	  expect(migrationSource).toContain("v_planned_start_at");
	  expect(migrationSource).toContain("v_event_time");
	  expect(migrationSource).toContain("v_weight_kg");
	  expect(migrationSource).toContain("weight_kg = v_weight_kg");
	  expect(migrationSource).toContain("primary_veterinarian_unavailable");
	  expect(migrationSource).toContain("'vet' = any(um.roles)");
	  expect(migrationSource).toContain("'consultation'");
  expect(migrationSource).toContain(
    "grant execute on function public.clair_create_reception_walk_in_encounter",
  );
  expect(migrationSource).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("encounter staff assignment migration persists every active-role assignee and returns them in reception reads", () => {
  const migrationPath =
    "supabase/migrations/20260720124138_encounter_staff_assignments.sql";
  expect(existsSync(migrationPath)).toBe(true);
  if (!existsSync(migrationPath)) return;

  const migration = readFileSync(migrationPath, "utf8");
  expect(migration).toContain("encounters_workspace_id_id_key unique (workspace_id, id)");
  expect(migration).toContain("create table public.encounter_staff_assignments");
  expect(migration).toContain("alter table public.encounter_staff_assignments enable row level security");
  expect(migration).toContain("insert into public.encounter_staff_assignments");
  expect(migration).toContain("e.primary_veterinarian_id");
  expect(migration).toContain("assignedStaffUserIds");
  expect(migration).toContain("assigned_staff_unavailable");
  expect(migration).toContain("um.status <> 'active'");
  expect(migration).toContain("cardinality(um.roles) = 0");
  expect(migration).toContain("u.status <> 'active'");
  expect(migration).toContain("private.clair_list_reception_day_calendar_records");
  expect(migration).toContain("private.clair_list_reception_queue_internal");
  expect(migration).toContain(
    "grant execute on function public.clair_create_reception_walk_in_encounter",
  );
  expect(migration).not.toMatch(/grant\s+select\s+on\s+public\.encounter_staff_assignments/i);
});

test("encounter staff assignment audit actor foreign key has a covering index", () => {
  const migrationSource = readdirSync("supabase/migrations")
    .filter((name) => name.includes("encounter_staff_assignments"))
    .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
    .join("\n");

  expect(migrationSource).toContain(
    "create index encounter_staff_assignments_created_by_idx",
  );
});

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}

function createSupabaseRows<Row>(rows: Row[]) {
  const query = {
    eq() {
      return query;
    },
    select() {
      return query;
    },
    then(onfulfilled: (value: { data: Row[]; error: null }) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(onfulfilled);
    },
  };

  return query;
}
