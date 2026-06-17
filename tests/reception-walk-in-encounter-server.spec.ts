import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseReceptionWalkInEncounterGateway,
  createReceptionWalkInEncounter,
} from "../src/features/reception/server-walk-in-encounter-core";

type SupabaseWalkInClient = Parameters<
  typeof createSupabaseReceptionWalkInEncounterGateway
>[0];

const validWalkInInput = {
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "49110000-0000-4000-8000-000000000003",
  plannedStartAt: "2026-05-19T11:15:00+09:00",
  department: "내과",
  durationMinutes: 30,
  visitPurpose: "구토 재진 상담",
  memo: "보호자가 식욕 저하를 걱정함",
  weightKg: 4.35,
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
        patientId: string;
        guardianId?: string;
        receptionType?: string;
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
  expect(body.enforcedBy).toBe("reception-walk-in-encounter");
	      expect(body.walkIn.encounter).toMatchObject({
	        patientId: "patient-coco",
	        guardianId: "guardian-lee-jieun",
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

test("supabase walk-in encounter gateway keeps workspace scope in the RPC write", async () => {
  const calls: string[] = [];
  let createPayload:
    | { plannedStartAt?: string; primaryVeterinarianId?: string; weightKg?: number }
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
        p_walk_in: { patientId: string; primaryVeterinarianId?: string; weightKg?: number };
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
    input: validWalkInInput,
  });

  expect(calls).toEqual([
    "clair_search_reception_patient_guardian_lookup:clair-demo:choco",
    "clair_create_reception_walk_in_encounter:clair-demo:19421000-0000-4000-8000-000000000005",
  ]);
  expect(createPayload?.primaryVeterinarianId).toBe(
    "49110000-0000-4000-8000-000000000003",
  );
  expect(createPayload?.plannedStartAt).toBe("2026-05-19T11:15:00+09:00");
  expect(createPayload?.weightKg).toBe(4.35);
  expect(result).toMatchObject({
    ok: true,
    walkIn: {
      encounter: { id: "encounter-db-walkin-coco", workspaceId: "clair-demo" },
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
