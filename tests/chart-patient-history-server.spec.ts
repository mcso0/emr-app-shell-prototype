import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import type { ChartPatientHistoryPage } from "../src/features/chart/chart-patient-history";
import { loadCompleteChartPatientHistory } from "../src/features/chart/chart-patient-history-client";
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
const encounterId = "21213000-0000-4000-8000-000000000001";
const chartId = "21215000-0000-4000-8000-000000000001";

const livePage = {
  items: [
    {
      chart: {
        id: chartId,
        encounterId,
        authorUserId: actorUserId,
        authorDisplayName: "이수지",
        assessment: "구토 빈도 추적",
        status: "autosaved",
        clinicalAt: "2026-09-08T06:30:00.000Z",
        createdAt: "2026-09-12T14:59:00.000Z",
        updatedAt: "2026-09-13T01:30:00.000Z",
      },
      encounter: {
        id: encounterId,
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
          chart: { ...livePage.items[0].chart, status: "unknown" },
        },
      ],
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
  expect(
    parseChartPatientHistoryPage({
      ...livePage,
      items: [
        {
          ...livePage.items[0],
          chart: { ...livePage.items[0].chart, encounterId: crypto.randomUUID() },
        },
      ],
    }),
  ).toBeNull();
  expect(
    parseChartPatientHistoryPage({
      ...livePage,
      items: [
        {
          ...livePage.items[0],
          chart: { ...livePage.items[0].chart, status: "voided" },
        },
      ],
    }),
  ).toBeNull();
});

test("patient chart history parser keeps an uncalled waiting reception without inventing a chart", () => {
  const waitingEncounterId = "21213000-0000-4000-8000-000000000099";
  const parsed = parseChartPatientHistoryPage({
    ...livePage,
    items: [
      {
        ...livePage.items[0],
        chart: null,
        diagnoses: [],
        encounter: {
          ...livePage.items[0].encounter,
          id: waitingEncounterId,
          encounterNo: "E-260908-WAITING",
          status: "waiting",
          checkedInAt: "2026-09-08T06:00:00.000Z",
        },
        queueEntry: {
          id: "21216000-0000-4000-8000-000000000099",
          workspaceId,
          encounterId: waitingEncounterId,
          queueType: "consultation",
          status: "waiting",
          priority: "normal",
          sortOrder: 1,
          enteredAt: "2026-09-08T06:00:00.000Z",
        },
      },
    ],
    nextCursor: null,
    totalCount: 1,
  });

  expect(parsed?.items[0]).toMatchObject({
    chart: null,
    encounter: {
      id: waitingEncounterId,
      status: "waiting",
    },
    queueEntry: {
      encounterId: waitingEncounterId,
      queueType: "consultation",
      status: "waiting",
    },
  });
});

test("patient chart history parser rejects a chartless reception without a waiting consultation queue", () => {
  const waitingEncounterId = "21213000-0000-4000-8000-000000000099";
  const record = {
    ...livePage.items[0],
    chart: null,
    diagnoses: [],
    encounter: {
      ...livePage.items[0].encounter,
      id: waitingEncounterId,
      status: "waiting",
    },
    queueEntry: null,
  };

  expect(
    parseChartPatientHistoryPage({
      ...livePage,
      items: [record],
      nextCursor: null,
      totalCount: 1,
    }),
  ).toBeNull();
  expect(
    parseChartPatientHistoryPage({
      ...livePage,
      items: [
        {
          ...record,
          encounter: { ...record.encounter, status: "completed" },
        },
      ],
      nextCursor: null,
      totalCount: 1,
    }),
  ).toBeNull();
  const recordWithoutChartKey = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "chart"),
  );
  expect(
    parseChartPatientHistoryPage({
      ...livePage,
      items: [recordWithoutChartKey],
      nextCursor: null,
      totalCount: 1,
    }),
  ).toBeNull();
});

test("patient chart history keeps immutable creation time separate from clinical and update times", () => {
  const parsed = parseChartPatientHistoryPage(livePage);
  expect(parsed?.items[0].chart).toMatchObject({
    id: chartId,
    encounterId,
    clinicalAt: "2026-09-08T06:30:00.000Z",
    createdAt: "2026-09-12T14:59:00.000Z",
    updatedAt: "2026-09-13T01:30:00.000Z",
  });
});

test("complete patient chart history loads every page and sorts same-minute charts stably", async () => {
  const firstChart = livePage.items[0];
  const secondChart = {
    ...firstChart,
    chart: {
      ...firstChart.chart,
      id: "21215000-0000-4000-8000-000000000002",
      createdAt: "2026-09-12T14:59:30.000Z",
    },
  };
  const cursors: Array<string | undefined> = [];
  const result = await loadCompleteChartPatientHistory({
    patientId,
    workspaceId,
    loadPage: async ({ cursor }) => {
      cursors.push(cursor);
      return cursor
        ? {
            ...livePage,
            items: [firstChart],
            nextCursor: null,
            totalCount: 2,
            ok: true,
            status: 200,
            enforcedBy: "chart-patient-history-read",
          }
        : {
            ...livePage,
            items: [secondChart],
            nextCursor: "page-2",
            totalCount: 2,
            ok: true,
            status: 200,
            enforcedBy: "chart-patient-history-read",
          };
    },
  });

  expect(cursors).toEqual([undefined, "page-2"]);
  expect(result.ok && result.items.map((item) => item.chart?.id)).toEqual([
    secondChart.chart.id,
    firstChart.chart.id,
  ]);
});

test("complete patient chart history retries a page set that would omit a chart", async () => {
  const firstChart = livePage.items[0];
  const secondChart = {
    ...firstChart,
    chart: {
      ...firstChart.chart,
      id: "21215000-0000-4000-8000-000000000002",
      createdAt: "2026-09-12T15:00:00.000Z",
    },
  };
  const cursors: Array<string | undefined> = [];
  const result = await loadCompleteChartPatientHistory({
    patientId,
    workspaceId,
    loadPage: async ({ cursor }) => {
      cursors.push(cursor);
      const retrying = cursors.length > 2;
      return {
        ...livePage,
        items: cursor && retrying ? [firstChart] : [secondChart],
        nextCursor: cursor ? null : "page-2",
        totalCount: 2,
        ok: true,
        status: 200,
        enforcedBy: "chart-patient-history-read",
      };
    },
  });

  expect(cursors).toEqual([undefined, "page-2", undefined, "page-2"]);
  expect(result.ok && result.items.map((item) => item.chart?.id)).toEqual([
    secondChart.chart.id,
    firstChart.chart.id,
  ]);
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
    "supabase/migrations/20260920090000_chart_history_uncalled_waiting_receptions.sql",
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
  expect(migration).toContain("private.clair_chart_note_json(s)");
  expect(migration).toContain("q.queue_type = 'consultation'");
  expect(migration).toContain("q.status = 'waiting'");
  expect(migration).toContain("e.status = 'waiting'");
  expect(migration).toContain("'chart', chart");
  expect(migration).toContain("'queueEntry', case");
  expect(migration).toContain("order by history_at desc, history_id desc");
  expect(migration).toContain("'totalCount', (select count(*) from base)");
  expect(migration).toContain("and s.status <> 'voided'");
  expect(migration).toContain("and existing_chart.status <> 'voided'");
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
