import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseStaffAssignedWorkItemsGateway,
  readStaffAssignedWorkItems,
  type SupabaseStaffAssignedWorkItemsClient,
  type StaffAssignedWorkItemsGateway,
  type StaffAssignedWorkSourceItem,
} from "../src/features/staff/server-staff-assigned-work-items-core";
import {
  clearWorkspaceStaffPresenceState,
  getWorkspaceStaffPresenceSnapshot,
  publishWorkspaceStaffPresenceState,
} from "../src/features/staff/workspace-staff-presence";

const workspaceId = "workspace-clair-cheongdam";
const targetUserId = "00000000-0000-4000-8000-000000000031";

test("staff assigned work route requires the configured Supabase source", async ({
  request,
}) => {
  const response = await request.get(
    `/api/workspaces/clair-demo/staff/${targetUserId}/work-items`,
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );
  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    status: 503,
    error: "configured_data_source_required",
  });
});

test("staff assigned work read returns a stable 20-row cursor page without source snapshots", async () => {
  const rows = Array.from({ length: 21 }, (_, index) =>
    makeWorkItem({
      createdAt: `2026-07-15T${String(23 - index).padStart(2, "0")}:00:00.000Z`,
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      queueType: index % 2 === 0 ? "lab" : "treatment",
    }),
  );
  const calls: Array<{ cursor?: { id: string; requestedAt: string }; limit: number }> = [];
  const gateway: StaffAssignedWorkItemsGateway = {
    async listAssignedWorkItems(input) {
      calls.push({ cursor: input.cursor, limit: input.limit });
      return { ok: true, items: rows, timezone: "Asia/Seoul" };
    },
  };

  const result = await readStaffAssignedWorkItems({
    actorUserId: "user-admin",
    cursor: null,
    gateway,
    permissionAdapter: createPermissionAdapter("user-admin", ["hospital_admin"]),
    userId: targetUserId,
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    timezone: "Asia/Seoul",
  });
  if (!result.ok) return;
  expect(calls).toEqual([{ cursor: undefined, limit: 21 }]);
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual(expect.any(String));
  expect(result.items[0]).toMatchObject({
    category: "lab",
    categoryLabel: "임상병리",
    href: `/w/${workspaceId}/lab?encounterId=encounter-1&orderId=order-1&modulePanel=open`,
    operatingDate: "2026-07-16",
    patientName: "합성 환자",
    guardianName: "합성 보호자",
    requestedByName: "합성 요청자",
    title: "합성 CBC",
  });
  expect(result.items[0]).not.toHaveProperty("sourceSnapshot");
  expect(JSON.stringify(result)).not.toContain("internal-only instruction");
});

test("staff assigned work read omits detail hrefs without category permission", async () => {
  const gateway: StaffAssignedWorkItemsGateway = {
    async listAssignedWorkItems() {
      return {
        ok: true,
        items: [makeWorkItem({ queueType: "lab" }), makeWorkItem({ id: "20000000-0000-4000-8000-000000000002", queueType: "dispensing" })],
        timezone: "Asia/Seoul",
      };
    },
  };

  const result = await readStaffAssignedWorkItems({
    actorUserId: "user-front-desk",
    cursor: null,
    gateway,
    permissionAdapter: createPermissionAdapter("user-front-desk", ["front_desk"]),
    userId: targetUserId,
    workspaceId,
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.items.map((item) => item.href)).toEqual([null, null]);
});

test("Supabase assigned-work gateway maps only the approved source projection", async () => {
  const gateway = createSupabaseStaffAssignedWorkItemsGateway(
    createSupabaseAssignedWorkClient({
      order_fulfillment_work_items: [
        {
          id: "10000000-0000-4000-8000-000000000000",
          workspace_id: workspaceId,
          encounter_id: "encounter-1",
          order_id: "order-1",
          queue_type: "lab",
          status: "requested",
          requested_by_user_id: "user-requester",
          assigned_to_user_id: targetUserId,
          created_at: "2026-07-15T23:00:00.000Z",
          source_snapshot: {
            orderDisplayName: "합성 CBC",
            patientName: "합성 환자",
            guardianName: "합성 보호자",
            instruction: "internal-only instruction",
            detail: { standardOrderName: "전혈구검사", secret: "never-return" },
          },
        },
      ],
      user_memberships: [
        {
          id: "membership-target",
          workspace_id: workspaceId,
          user_id: targetUserId,
          status: "active",
        },
      ],
      users: [{ id: "user-requester", display_name: "합성 요청자" }],
      workspaces: [{ id: workspaceId, timezone: "Asia/Seoul" }],
    }) as unknown as SupabaseStaffAssignedWorkItemsClient,
  );

  const result = await gateway.listAssignedWorkItems({
    limit: 21,
    userId: targetUserId,
    workspaceId,
  });

  expect(result).toEqual({
    ok: true,
    timezone: "Asia/Seoul",
    items: [
      {
        createdAt: "2026-07-15T23:00:00.000Z",
        description: "전혈구검사",
        encounterId: "encounter-1",
        guardianName: "합성 보호자",
        id: "10000000-0000-4000-8000-000000000000",
        orderId: "order-1",
        patientName: "합성 환자",
        queueType: "lab",
        requestedByName: "합성 요청자",
        status: "requested",
        title: "합성 CBC",
      },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("internal-only instruction");
  expect(JSON.stringify(result)).not.toContain("never-return");
});

test("staff assigned work read rejects malformed cursors before querying data", async () => {
  let called = false;
  const gateway: StaffAssignedWorkItemsGateway = {
    async listAssignedWorkItems() {
      called = true;
      return { ok: true, items: [], timezone: "Asia/Seoul" };
    },
  };

  const result = await readStaffAssignedWorkItems({
    actorUserId: "user-admin",
    cursor: "not-an-opaque-cursor",
    gateway,
    permissionAdapter: createPermissionAdapter("user-admin", ["hospital_admin"]),
    userId: targetUserId,
    workspaceId,
  });

  expect(result).toEqual({ ok: false, status: 400, error: "invalid_cursor" });
  expect(called).toBe(false);
});

test("staff assigned work read blocks inactive and cross-workspace actors before the gateway", async () => {
  let calls = 0;
  const gateway: StaffAssignedWorkItemsGateway = {
    async listAssignedWorkItems() {
      calls += 1;
      return { ok: true, items: [], timezone: "Asia/Seoul" };
    },
  };
  const permissionAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-other", status: "active" }],
    memberships: [
      {
        id: "membership-other",
        workspaceId: "workspace-other",
        userId: "user-other",
        roles: ["front_desk"],
        status: "active",
      },
    ],
  });

  await expect(
    readStaffAssignedWorkItems({
      actorUserId: "user-other",
      cursor: null,
      gateway,
      permissionAdapter,
      userId: targetUserId,
      workspaceId,
    }),
  ).resolves.toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
  expect(calls).toBe(0);
});

test("Presence stays unknown until an authoritative workspace snapshot arrives", () => {
  clearWorkspaceStaffPresenceState(workspaceId);
  expect(getWorkspaceStaffPresenceSnapshot(workspaceId, targetUserId)).toBe("unknown");

  publishWorkspaceStaffPresenceState(workspaceId, {});
  expect(getWorkspaceStaffPresenceSnapshot(workspaceId, targetUserId)).toBe("offline");

  publishWorkspaceStaffPresenceState(workspaceId, {
    [targetUserId]: [{ presence_ref: "synthetic-presence", userId: targetUserId }],
  });
  expect(getWorkspaceStaffPresenceSnapshot(workspaceId, targetUserId)).toBe("online");

  clearWorkspaceStaffPresenceState(workspaceId);
  expect(getWorkspaceStaffPresenceSnapshot(workspaceId, targetUserId)).toBe("unknown");
});

function makeWorkItem(
  overrides: Partial<StaffAssignedWorkSourceItem> = {},
): StaffAssignedWorkSourceItem {
  return {
    createdAt: "2026-07-15T23:00:00.000Z",
    description: "표준 검사",
    encounterId: "encounter-1",
    guardianName: "합성 보호자",
    id: "10000000-0000-4000-8000-000000000000",
    orderId: "order-1",
    patientName: "합성 환자",
    queueType: "lab",
    requestedByName: "합성 요청자",
    status: "requested",
    title: "합성 CBC",
    ...overrides,
  };
}

function createPermissionAdapter(
  userId: string,
  roles: Array<"hospital_admin" | "front_desk">,
) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: userId, status: "active" }],
    memberships: [
      {
        id: `membership-${userId}`,
        workspaceId,
        userId,
        roles,
        status: "active",
      },
    ],
  });
}

function createSupabaseAssignedWorkClient(
  rows: Record<string, Array<Record<string, unknown>>>,
) {
  return {
    from(table: string) {
      let selectedRows = [...(rows[table] ?? [])];
      let rowLimit: number | null = null;
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: string) {
          selectedRows = selectedRows.filter((row) => row[column] === value);
          return query;
        },
        in(column: string, values: string[]) {
          selectedRows = selectedRows.filter((row) =>
            typeof row[column] === "string" && values.includes(row[column]),
          );
          return query;
        },
        limit(value: number) {
          rowLimit = value;
          return query;
        },
        or() {
          return query;
        },
        order() {
          return query;
        },
        then(
          onfulfilled: (value: {
            data: typeof selectedRows;
            error: null;
          }) => unknown,
        ) {
          return Promise.resolve({
            data: rowLimit === null ? selectedRows : selectedRows.slice(0, rowLimit),
            error: null,
          }).then(onfulfilled);
        },
      };
      return query;
    },
  };
}
