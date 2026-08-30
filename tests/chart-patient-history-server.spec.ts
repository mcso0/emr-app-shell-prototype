import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import type { ChartPatientHistoryPage } from "../src/features/chart/chart-patient-history";
import {
  createSupabaseChartPatientHistoryGateway,
  parseChartPatientHistoryPage,
  readChartPatientHistory,
  type SupabaseChartPatientHistoryClient,
} from "../src/features/chart/server-chart-patient-history-core";
import type { PermissionId } from "../src/types/emr-domain";

const workspaceId = "workspace-clair-cheongdam";
const patientId = "21212000-0000-4000-8000-000000000001";
const actorUserId = "21210000-0000-4000-8000-000000000001";

const livePage = {
  items: [
    {
      encounter: {
        id: "21213000-0000-4000-8000-000000000001",
        workspaceId,
        patientId,
        guardianId: "21214000-0000-4000-8000-000000000001",
        primaryVeterinarianId: actorUserId,
        encounterNo: "E-260830-466148",
        receptionType: "walk_in",
        chiefComplaint: "구토",
        status: "in_consultation",
        checkedInAt: "2026-08-30T06:30:00.000Z",
        createdAt: "2026-08-30T06:30:00.000Z",
        updatedAt: "2026-08-30T06:35:00.000Z",
      },
      primaryGuardian: {
        id: "21214000-0000-4000-8000-000000000001",
        workspaceId,
        name: "최도현",
        mobilePhone: "010-4911-0004",
        createdAt: "2026-08-30T06:00:00.000Z",
        updatedAt: "2026-08-30T06:00:00.000Z",
      },
      veterinarianName: "이수지",
      diagnoses: [{ diagnosisText: "급성 위장관염 의심" }],
      soapNote: { assessment: "구토 빈도 추적" },
    },
  ],
  nextCursor: "eyJhdCI6IjIwMjYtMDgtMzBUMDY6MzA6MDAuMDAwWiJ9",
  totalCount: 27,
} satisfies ChartPatientHistoryPage;

test("patient chart history requires chart:view before the DB gateway runs", async () => {
  let gatewayCalled = false;
  const result = await readChartPatientHistory({
    actorUserId,
    gateway: {
      async listHistory() {
        gatewayCalled = true;
        return { ok: true, page: livePage };
      },
    },
    limit: 20,
    patientId,
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

test("patient chart history clamps the page size and returns the live projection", async () => {
  const calls: unknown[] = [];
  const result = await readChartPatientHistory({
    actorUserId,
    cursor: "next-page",
    gateway: {
      async listHistory(input) {
        calls.push(input);
        return { ok: true, page: livePage };
      },
    },
    limit: 500,
    patientId,
    permissionAdapter: createPermissionAdapter(["chart:view"]),
    workspaceId,
  });

  expect(calls).toEqual([
    { cursor: "next-page", limit: 50, patientId, workspaceId },
  ]);
  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "chart-patient-history-read",
    totalCount: 27,
    items: [{ encounter: { encounterNo: "E-260830-466148" } }],
  });
});

test("Supabase gateway calls only the scoped history RPC", async () => {
  const calls: unknown[] = [];
  const gateway = createSupabaseChartPatientHistoryGateway({
    async rpc(functionName, args) {
      calls.push([functionName, args]);
      return { data: livePage, error: null };
    },
  } satisfies SupabaseChartPatientHistoryClient);

  const result = await gateway.listHistory({
    cursor: "next-page",
    limit: 25,
    patientId,
    workspaceId,
  });

  expect(calls).toEqual([
    [
      "clair_list_chart_patient_history",
      {
        p_cursor: "next-page",
        p_limit: 25,
        p_patient_id: patientId,
        p_workspace_id: workspaceId,
      },
    ],
  ]);
  expect(result).toEqual({ ok: true, page: livePage });
});

test("patient chart history parser rejects incomplete records and invalid statuses", () => {
  expect(
    parseChartPatientHistoryPage({
      ...livePage,
      items: [{ ...livePage.items[0], encounter: { encounterNo: "broken" } }],
    }),
  ).toBeNull();
  expect(
    parseChartPatientHistoryPage({
      ...livePage,
      items: [
        {
          ...livePage.items[0],
          encounter: { ...livePage.items[0].encounter, status: "unknown" },
        },
      ],
    }),
  ).toBeNull();
});

test("patient chart history route and migration preserve the server-owned workspace boundary", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/history/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/chart/server-chart-patient-history.ts",
    "utf8",
  );
  const migration = readFileSync(
    "supabase/migrations/20260830082412_chart_patient_history_read_model.sql",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseChartPatientHistoryGateway");
  expect(routeSource).not.toMatch(/mock|fixture|fallback/i);
  expect(serverSource).toContain('import "server-only"');
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("auth.uid() is null");
  expect(migration).toContain("clair_is_active_workspace_member");
  expect(migration).toContain("clair_current_user_has_workspace_permission");
  expect(migration).toContain("'chart:view'");
  expect(migration).toMatch(/revoke all[\s\S]*from public, anon/);
  expect(migration).toMatch(/grant execute[\s\S]*to authenticated/);
  expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\b/i);
  expect(`${routeSource}\n${serverSource}\n${migration}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

function createPermissionAdapter(permissionIds: PermissionId[]) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-chart-history",
        workspaceId,
        userId: actorUserId,
        roles: ["vet"],
        status: "active",
      },
    ],
    permissionPolicies: [{ workspaceId, role: "vet", permissionIds }],
  });
}
