import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartDiagnosisGateway,
  createSupabaseChartDiagnosisGateway,
  saveChartDiagnoses,
} from "../src/features/chart/server-diagnosis-persistence-core";
import type { Encounter } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const migrationPath =
  "supabase/migrations/20260519200000_chart_diagnosis_persistence_rpc.sql";
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const closureMigrationPath =
  "supabase/migrations/20260815120000_chart_diagnosis_closure.sql";
const closureMigration = existsSync(closureMigrationPath)
  ? readFileSync(closureMigrationPath, "utf8")
  : "";
const multiPrimaryMigrationPath =
  "supabase/migrations/20260825133000_chart_multi_primary_diagnoses.sql";
const multiPrimaryMigration = existsSync(multiPrimaryMigrationPath)
  ? readFileSync(multiPrimaryMigrationPath, "utf8")
  : "";

const validDiagnosisInput = {
  encounterId,
  diagnoses: [
    {
      id: "diagnosis-coco-gastroenteritis",
      diagnosisCatalogId: "dx-acute-gastroenteritis",
      diagnosisText: "급성 위장관염 의심",
      diagnosisType: "confirmed" as const,
      isClosed: true,
      isPrimary: true,
    },
    {
      diagnosisText: "보호자 설명용 임시 진단",
      diagnosisType: "suspected" as const,
      isClosed: false,
      isPrimary: false,
    },
  ],
};

const waitingEncounter: Encounter = {
  id: "encounter-diagnosis-waiting-lock",
  workspaceId,
  patientId: "patient-diagnosis-waiting-lock",
  guardianId: "guardian-diagnosis-waiting-lock",
  encounterNo: "E-DX-LOCK",
  status: "waiting",
  checkedInAt: "2026-06-25T14:15:00+09:00",
  createdAt: "2026-06-25T14:15:00+09:00",
  updatedAt: "2026-06-25T14:15:00+09:00",
};

test("diagnosis route requires an actor, saves via mock fallback, and reads after save", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/diagnoses`,
    { data: validDiagnosisInput },
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const saved = await request.patch(
    `/api/workspaces/${workspaceId}/chart/diagnoses`,
    {
      data: validDiagnosisInput,
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    },
  );
  expect(saved.status()).toBe(200);
  const savedBody = (await saved.json()) as {
    ok: true;
    diagnoses: Array<{
      encounterId: string;
      diagnosisCatalogId?: string;
      diagnosisText: string;
      diagnosisType: string;
      closedAt?: string;
      closedByUserId?: string;
      isPrimary?: boolean;
      sortOrder?: number;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.ok).toBe(true);
  expect(savedBody.enforcedBy).toBe("chart-diagnosis-persistence");
  expect(savedBody.diagnoses).toMatchObject([
    {
      encounterId,
      diagnosisCatalogId: "dx-acute-gastroenteritis",
      diagnosisText: "급성 위장관염 의심",
      diagnosisType: "confirmed",
      closedAt: expect.any(String),
      closedByUserId: "user-vet",
      isPrimary: true,
      sortOrder: 0,
    },
    {
      encounterId,
      diagnosisText: "보호자 설명용 임시 진단",
      diagnosisType: "suspected",
      isPrimary: false,
      sortOrder: 1,
    },
  ]);

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/diagnoses?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(readBack.status()).toBe(200);
  const readBody = (await readBack.json()) as {
    ok: true;
    diagnoses: Array<{ diagnosisText: string }>;
  };
  expect(
    readBody.diagnoses.map((diagnosis) => diagnosis.diagnosisText),
  ).toEqual(["급성 위장관염 의심", "보호자 설명용 임시 진단"]);
});

test("diagnosis core enforces active workspace membership, chart update permission, and encounter scope", async () => {
  const frontDeskDenied = await saveChartDiagnoses({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validDiagnosisInput,
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
  expect(frontDeskDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await saveChartDiagnoses({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: validDiagnosisInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet-other",
          workspaceId: "other-workspace",
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
  });
  expect(crossWorkspaceDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_unavailable",
  });

  const allowedVet = await saveChartDiagnoses({
    actorUserId: "user-vet",
    workspaceId,
    input: validDiagnosisInput,
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
    gateway: createMockChartDiagnosisGateway(
      undefined,
      () => "2026-05-19T14:00:00.000Z",
    ),
  });
  expect(allowedVet).toMatchObject({
    ok: true,
    status: 200,
    diagnoses: [
      {
        diagnosisText: "급성 위장관염 의심",
        diagnosisType: "confirmed",
        closedAt: "2026-05-19T14:00:00.000Z",
        closedByUserId: "user-vet",
        isPrimary: true,
        sortOrder: 0,
        updatedAt: "2026-05-19T14:00:00.000Z",
      },
      {
        diagnosisText: "보호자 설명용 임시 진단",
        diagnosisType: "suspected",
        closedAt: undefined,
        isPrimary: false,
        sortOrder: 1,
        updatedAt: "2026-05-19T14:00:00.000Z",
      },
    ],
  });
});

test("diagnosis core blocks chart mutation before consultation starts", async () => {
  const blocked = await saveChartDiagnoses({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      ...validDiagnosisInput,
      encounterId: waitingEncounter.id,
    },
    gateway: createMockChartDiagnosisGateway({
      diagnoses: [],
      encounters: [{ ...waitingEncounter }],
    }),
  });

  expect(blocked).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "stale_status",
  });
});

test("diagnosis Supabase gateway keeps workspace, encounter, rows, and actor scope in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartDiagnosisGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id}`,
      );
      return {
        data: [
          {
            id: "diagnosis-db-den-71",
            encounterId,
            diagnosisCatalogId: "dx-acute-gastroenteritis",
            diagnosisText: "급성 위장관염 의심",
            diagnosisType: "confirmed",
            closedAt: "2026-05-19T14:00:00.000Z",
            closedByUserId: "00000000-0000-4000-8000-000000000002",
            isPrimary: true,
            sortOrder: 0,
            createdByUserId: "00000000-0000-4000-8000-000000000002",
            updatedByUserId: "00000000-0000-4000-8000-000000000002",
            createdAt: "2026-05-19T14:00:00.000Z",
            updatedAt: "2026-05-19T14:00:00.000Z",
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.saveDiagnoses({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    diagnoses: [
      {
        diagnosisCatalogId: "dx-acute-gastroenteritis",
        diagnosisText: "급성 위장관염 의심",
        diagnosisType: "confirmed",
        isClosed: true,
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  });

  expect(calls).toEqual([
    `clair_save_chart_diagnoses:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    diagnoses: [
      { id: "diagnosis-db-den-71", encounterId, isPrimary: true, sortOrder: 0 },
    ],
  });
});

test("diagnosis core preserves more than one primary diagnosis", async () => {
  const result = await saveChartDiagnoses({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      ...validDiagnosisInput,
      diagnoses: validDiagnosisInput.diagnoses.map((diagnosis) => ({
        ...diagnosis,
        isPrimary: true,
      })),
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    diagnoses: [
      { diagnosisText: "급성 위장관염 의심", isPrimary: true, sortOrder: 0 },
      {
        diagnosisText: "보호자 설명용 임시 진단",
        isPrimary: true,
        sortOrder: 1,
      },
    ],
  });
});

test("diagnosis persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain(
    "create or replace function public.clair_get_chart_diagnoses",
  );
  expect(migration).toContain(
    "create or replace function public.clair_save_chart_diagnoses",
  );
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain("from public.encounters e");
  expect(migration).toContain("from public.diagnoses d");
  expect(migration).toContain("jsonb_array_elements");
  expect(migration).toContain("sort_order");
  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_diagnoses",
  );
  expect(migration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );

  expect(closureMigration).toContain("add column if not exists closed_at");
  expect(closureMigration).toContain("closed_by_user_id");
  expect(closureMigration).toContain("multiple_primary_diagnoses");
  expect(closureMigration).toContain("'isClosed', d.closed_at is not null");
  expect(closureMigration).toContain("v_existing_closure");
  expect(closureMigration).toContain(
    "v_actor_user_id is distinct from auth.uid()",
  );
  expect(closureMigration).toContain("'chart:view'");
  expect(closureMigration).toContain("'chart:update'");
  expect(closureMigration.match(/set search_path = ''/g)).toHaveLength(2);
  expect(closureMigration).toContain("pg_catalog.gen_random_uuid()");
  expect(closureMigration).toContain(
    "grant execute on function public.clair_save_chart_diagnoses",
  );
  expect(closureMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );

  expect(multiPrimaryMigration).toContain(
    "drop index if exists public.diagnoses_workspace_encounter_primary_key",
  );
  expect(multiPrimaryMigration).toContain(
    "create or replace function public.clair_save_chart_diagnoses",
  );
  expect(multiPrimaryMigration).not.toContain("multiple_primary_diagnoses");
  expect(multiPrimaryMigration).toContain("'isPrimary', is_primary");
  expect(multiPrimaryMigration).toContain("order by sort_order, id");
  expect(multiPrimaryMigration).toContain(
    "grant execute on function public.clair_save_chart_diagnoses",
  );
  expect(multiPrimaryMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("diagnosis route stays server-owned and secret-free", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/diagnoses/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/chart/server-diagnosis-persistence.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("permissionAdapter");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(
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
