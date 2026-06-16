import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  createMockReceptionPatientGuardianLookupGateway,
  createSupabaseReceptionPatientGuardianLookupGateway,
  lookupReceptionPatientGuardians,
} from "../src/features/reception/server-patient-guardian-lookup-core";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";

test("reception patient lookup route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.get(
    "/api/workspaces/clair-demo/reception/patient-guardian-lookup?query=콩"
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const mockFallback = await request.get(
    "/api/workspaces/clair-demo/reception/patient-guardian-lookup?query=콩",
    {
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    }
  );
  expect(mockFallback.status()).toBe(200);
  const body = await mockFallback.json() as {
    ok: true;
    patients: Array<{ patient: { id: string; workspaceId: string; name: string } }>;
    enforcedBy: string;
  };

  expect(body.ok).toBe(true);
  expect(body.enforcedBy).toBe("reception-patient-guardian-lookup");
  expect(body.patients.map((item) => item.patient.id)).toContain("patient-kong");
  expect(body.patients.every((item) => item.patient.workspaceId === "clair-demo")).toBe(true);
});

test("reception patient lookup core enforces active workspace membership", async () => {
  const denied = await lookupReceptionPatientGuardians({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    query: "콩",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-other",
          workspaceId: "other-workspace",
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
    gateway: createMockReceptionPatientGuardianLookupGateway(),
  });

  expect(denied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
});

test("supabase reception lookup gateway maps DB rows and keeps workspace scope in the query", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionPatientGuardianLookupGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_query}`);
      return {
        data: [
          {
            patient: {
              id: "patient-db-luna",
              workspaceId: "clair-demo",
              patientNo: "P-DB-0001",
              name: "루나",
              species: "cat",
              breed: "Korean Shorthair",
              sex: "female",
              neutered: true,
              handlingCautionLocked: true,
              status: "active",
              createdAt: "2026-05-19T00:00:00.000Z",
              updatedAt: "2026-05-19T00:00:00.000Z",
            },
            primaryGuardian: {
              id: "guardian-db-jiyu",
              workspaceId: "clair-demo",
              name: "박지유",
              mobilePhone: "010-2222-3333",
              createdAt: "2026-05-19T00:00:00.000Z",
              updatedAt: "2026-05-19T00:00:00.000Z",
            },
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.searchPatientGuardianLookup({
    workspaceId: "clair-demo",
    query: "루나",
  });

  expect(calls).toEqual(["clair_search_reception_patient_guardian_lookup:clair-demo:루나"]);
  expect(result).toMatchObject({
    ok: true,
    patients: [
      {
        patient: { id: "patient-db-luna", name: "루나", workspaceId: "clair-demo" },
        primaryGuardian: { id: "guardian-db-jiyu", name: "박지유" },
      },
    ],
  });
});

test("supabase reception lookup gateway maps snake_case DB profile rows", async () => {
  const gateway = createSupabaseReceptionPatientGuardianLookupGateway({
    async rpc() {
      return {
        data: [
          {
            patient: {
              id: "patient-db-maru",
              workspace_id: "clair-demo",
              patient_no: "P-DB-0003",
              name: "마루",
              species: "dog",
              birth_date: "2021-03-12",
              estimated_age_text: "5세",
              sex: "male",
              neutered: true,
              handling_caution_locked: true,
              status: "active",
              created_at: "2026-05-19T00:00:00.000Z",
              updated_at: "2026-05-19T00:00:00.000Z",
            },
            primary_guardian: {
              id: "guardian-db-harin",
              workspace_id: "clair-demo",
              name: "정하린",
              mobile_phone: "010-4444-5555",
              created_at: "2026-05-19T00:00:00.000Z",
              updated_at: "2026-05-19T00:00:00.000Z",
            },
            search_text: "마루 정하린 010-4444-5555",
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.searchPatientGuardianLookup({
    workspaceId: "clair-demo",
    query: "마루",
  });

  expect(result).toMatchObject({
    ok: true,
    patients: [
      {
        patient: {
          id: "patient-db-maru",
          workspaceId: "clair-demo",
          patientNo: "P-DB-0003",
          name: "마루",
          estimatedAgeText: "5세",
        },
        primaryGuardian: {
          id: "guardian-db-harin",
          name: "정하린",
          mobilePhone: "010-4444-5555",
        },
        searchText: "마루 정하린 010-4444-5555",
      },
    ],
  });
});

test("supabase reception lookup gateway resolves Korean staging display aliases", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionPatientGuardianLookupGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_query}`);
      return {
        data:
          args.p_query === "nabi"
            ? [
                {
                  patient: {
                    id: "19421000-0000-4000-8000-000000000002",
                    workspaceId: "clair-demo",
                    patientNo: "P-DEN194-02",
                    name: "Nabi Synthetic",
                    species: "cat",
                    sex: "female",
                    status: "active",
                    createdAt: "2026-05-19T00:00:00.000Z",
                    updatedAt: "2026-05-19T00:00:00.000Z",
                  },
                  primaryGuardian: {
                    id: "19420000-0000-4000-8000-000000000002",
                    workspaceId: "clair-demo",
                    name: "DEN-194 Guardian 02",
                    createdAt: "2026-05-19T00:00:00.000Z",
                    updatedAt: "2026-05-19T00:00:00.000Z",
                  },
                },
              ]
            : [],
        error: null,
      };
    },
  });

  const result = await gateway.searchPatientGuardianLookup({
    workspaceId: "clair-demo",
    query: "나비",
  });

  expect(calls).toEqual([
    "clair_search_reception_patient_guardian_lookup:clair-demo:나비",
    "clair_search_reception_patient_guardian_lookup:clair-demo:nabi",
  ]);
  expect(result).toMatchObject({
    ok: true,
    patients: [{ patient: { name: "Nabi Synthetic" } }],
  });
});

test("reception lookup route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/patient-guardian-lookup/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/reception/server-patient-guardian-lookup.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource).toContain("permissionAdapter");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

test("reception lookup reader migration keeps the query workspace-scoped", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260519100000_reception_patient_guardian_lookup_reader.sql",
    "utf8"
  );

  expect(migrationSource).toContain("create or replace function public.clair_search_reception_patient_guardian_lookup");
  expect(migrationSource).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migrationSource).toContain("p.workspace_id = p_workspace_id");
  expect(migrationSource).toContain("grant execute on function public.clair_search_reception_patient_guardian_lookup");
  expect(migrationSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
