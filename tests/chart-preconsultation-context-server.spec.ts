import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import type { ChartPreconsultationContext } from "../src/features/chart/preconsultation-context";
import {
  createSupabaseChartPreconsultationContextGateway,
  parseChartPreconsultationContext,
  readChartPreconsultationContext,
  type SupabaseChartPreconsultationContextClient,
} from "../src/features/chart/server-preconsultation-context-core";
import type { PermissionId } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "19426000-0000-4000-8000-000000000001";
const actorUserId = "19410000-0000-4000-8000-000000000001";

const liveContext = {
  encounter: {
    id: encounterId,
    encounterNo: "E-DEN194-0001",
    receptionType: "appointment",
    visitPurpose: "피부 재진",
    chiefComplaint: "반복되는 가려움",
    receptionMemo: "밤사이 발을 자주 핥았어요.",
    checkedInAt: "2026-07-16T06:30:00.000Z",
    status: "waiting",
  },
  queue: { id: "queue-den194", status: "waiting" },
  patient: {
    id: "19421000-0000-4000-8000-000000000001",
    patientNo: "P-DEN194-0001",
    name: "초코",
    species: "dog",
    breed: "Poodle",
    estimatedAgeText: "7세",
    sex: "female",
    neutered: true,
    handlingCautionNote: "보정 시 보호자 동행 선호",
  },
  guardian: {
    id: "19420000-0000-4000-8000-000000000001",
    name: "최도현",
    memo: "최근 약 복용은 잘했어요.",
  },
  veterinarian: { id: actorUserId, displayName: "이수지" },
  priorEncounterCount: 2,
  vitals: [
    {
      id: "vital-den194-current",
      encounterId,
      measuredAt: "2026-07-16T06:35:00.000Z",
      weightKg: 4.82,
      temperatureC: 38.7,
      respiratoryRateRpm: 24,
      bloodPressureSystolicMmhg: 132,
    },
  ],
  history: [
    {
      encounterId,
      encounterNo: "E-DEN194-0001",
      checkedInAt: "2026-07-16T06:30:00.000Z",
      status: "waiting",
      chiefComplaint: "반복되는 가려움",
    },
  ],
} satisfies ChartPreconsultationContext;

test("preconsultation context requires chart:view before the DB gateway runs", async () => {
  let gatewayCalled = false;
  const result = await readChartPreconsultationContext({
    actorUserId,
    encounterId,
    gateway: {
      async readContext() {
        gatewayCalled = true;
        return { ok: true, context: liveContext };
      },
    },
    permissionAdapter: createPermissionAdapter(["reception:view"]),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
  expect(gatewayCalled).toBe(false);
});

test("preconsultation context returns the DB-backed read model for chart viewers", async () => {
  const result = await readChartPreconsultationContext({
    actorUserId,
    encounterId,
    gateway: { async readContext() { return { ok: true, context: liveContext }; } },
    permissionAdapter: createPermissionAdapter(["chart:view"]),
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "chart-preconsultation-context-read",
    context: {
      encounter: { id: encounterId, receptionType: "appointment" },
      patient: { name: "초코" },
      guardian: { name: "최도현" },
      vitals: [{ weightKg: 4.82 }],
    },
  });
});

test("Supabase gateway calls only the preconsultation RPC and preserves nullable vital values", async () => {
  const calls: unknown[] = [];
  const gateway = createSupabaseChartPreconsultationContextGateway({
    async rpc(functionName, args) {
      calls.push([functionName, args]);
      return {
        data: {
          ...liveContext,
          vitals: [
            {
              ...liveContext.vitals[0],
              weightKg: null,
              temperatureC: null,
            },
          ],
        },
        error: null,
      };
    },
  } satisfies SupabaseChartPreconsultationContextClient);

  const result = await gateway.readContext({ encounterId, workspaceId });
  expect(calls).toEqual([
    [
      "clair_get_chart_preconsultation_context",
      { p_encounter_id: encounterId, p_workspace_id: workspaceId },
    ],
  ]);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.context.vitals[0]).not.toHaveProperty("weightKg");
  expect(result.context.vitals[0]).not.toHaveProperty("temperatureC");
});

test("preconsultation parser rejects incomplete primary records instead of inventing fallback data", () => {
  expect(parseChartPreconsultationContext({ ...liveContext, queue: null })).toBeNull();
  expect(parseChartPreconsultationContext({ ...liveContext, patient: { name: "초코" } })).toBeNull();
});

test("preconsultation route and migration keep reads and mutations server-owned", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/preconsultation-context/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/chart/server-preconsultation-context.ts",
    "utf8",
  );
  const migration = readFileSync(
    "supabase/migrations/20260716054716_chart_preconsultation_context.sql",
    "utf8",
  );
  const vitalComparisonMigration = readFileSync(
    "supabase/migrations/20260719000000_chart_preconsultation_vital_comparison.sql",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseChartPreconsultationContextGateway");
  expect(routeSource).not.toMatch(/mock|fixture|fallback/i);
  expect(serverSource).toContain('import "server-only"');
  expect(migration).toContain("clair_get_chart_preconsultation_context");
  expect(migration).toContain("'chart:view'");
  expect(migration).toContain("'chart:update'");
  expect(migration).toContain("v_actor_user_id <> auth.uid()");
  expect(migration).toContain("raise exception 'actor_mismatch'");
  expect(migration).toContain("clair_call_consultation_queue_internal");
  expect(migration).toContain("clair_return_consultation_to_waiting_internal");
  expect(migration).toContain("grant execute on function public.clair_get_chart_preconsultation_context");
  expect(vitalComparisonMigration).toContain("with current_vital as");
  expect(vitalComparisonMigration).toContain("previous_encounter as");
  expect(vitalComparisonMigration).toContain("previous_vital as");
  expect(vitalComparisonMigration).toContain("vm.encounter_id = e.id");
  expect(vitalComparisonMigration).toContain("prior.checked_in_at < e.checked_in_at");
  expect(vitalComparisonMigration).toContain("order by prior.checked_in_at desc");
  expect(vitalComparisonMigration).toContain("grant execute on function public.clair_get_chart_preconsultation_context");
  expect(vitalComparisonMigration).not.toMatch(/vital_encounter\.checked_in_at <= e\.checked_in_at[\s\S]*limit 2/);
  expect(`${routeSource}\n${serverSource}\n${migration}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
  expect(vitalComparisonMigration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

function createPermissionAdapter(permissionIds: PermissionId[]) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-den194",
        workspaceId,
        userId: actorUserId,
        roles: ["vet"],
        status: "active",
      },
    ],
    permissionPolicies: [
      { workspaceId, role: "vet", permissionIds },
    ],
  });
}
