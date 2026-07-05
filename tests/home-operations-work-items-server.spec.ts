import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockHomeOperationsWorkItemGateway,
  createSupabaseHomeOperationsWorkItemGateway,
  readHomeOperationsWorkItems,
} from "../src/features/home/server-home-operations-work-items-core";
import type { HomeOperationsWorkItem } from "../src/features/home/home.types";

const workspaceId = "workspace-clair-cheongdam";
const actorUserId = "49110000-0000-4000-8000-000000000001";
const operatingDate = "2026-07-05";
const migration = readFileSync(
  "supabase/migrations/20260705120000_home_operations_work_items_reader.sql",
  "utf8",
);

test("home operations core denies board access instead of returning empty work", async () => {
  const result = await readHomeOperationsWorkItems({
    actorUserId,
    workspaceId,
    filters: { date: operatingDate },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: actorUserId, status: "active" }],
      memberships: [],
    }),
    gateway: createMockHomeOperationsWorkItemGateway({
      ok: true,
      generatedAt: "2026-07-05T09:00:00+09:00",
      sourceStatus: "empty",
      items: [],
    }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    sourceStatus: "permission_denied",
    error: {
      code: "workspace_membership_missing",
    },
  });
});

test("home operations scope mine keeps personal work and processable team queues", async () => {
  const personal = createWorkItem({
    id: "lab:personal",
    assigneeUserId: actorUserId,
    sourceType: "lab",
  });
  const teamQueue = createWorkItem({
    id: "billing:team",
    sourceType: "billing",
    teamQueueId: "billing",
    teamQueueLabel: "수납팀 큐",
  });
  const assignmentMissing = createWorkItem({
    id: "imaging:missing",
    attentionSignals: ["assignment_missing"],
    sourceType: "imaging",
    teamQueueId: undefined,
    teamQueueLabel: undefined,
  });
  const result = await readHomeOperationsWorkItems({
    actorUserId,
    workspaceId,
    filters: { date: operatingDate, scope: "mine" },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: actorUserId, status: "active" }],
      memberships: [
        {
          id: "membership-general",
          workspaceId,
          userId: actorUserId,
          roles: ["technician"],
          status: "active",
        },
      ],
    }),
    gateway: createMockHomeOperationsWorkItemGateway({
      ok: true,
      generatedAt: "2026-07-05T09:00:00+09:00",
      sourceStatus: "live",
      items: [personal, teamQueue, assignmentMissing],
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    sourceStatus: "live",
    summary: {
      totalVisible: 2,
      mineCount: 2,
    },
  });
  expect(result.ok && result.items.map((item) => item.id)).toEqual([
    "lab:personal",
    "billing:team",
  ]);
});

test("supabase home operations gateway calls the aggregate RPC and maps rows", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseHomeOperationsWorkItemGateway({
    async rpc(functionName, args) {
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_actor_user_id}:${args.p_operating_date}:${args.p_scope}:${args.p_include_completed}:${args.p_include_cancelled}`,
      );
      return {
        error: null,
        data: {
          generatedAt: "2026-07-05T09:00:00+09:00",
          sourceStatus: "live",
          items: [
            {
              id: "appointment:00000000-0000-4000-8000-000000000001",
              workspaceId,
              sourceType: "appointment",
              sourceId: "00000000-0000-4000-8000-000000000001",
              sourceStatus: "confirmed",
              title: "나나 예약 확인",
              progressState: "waiting",
              attentionSignals: ["team_queue"],
              requestedAt: "2026-07-05T10:00:00+09:00",
              operatingDate,
              sourceHref: `/w/${workspaceId}/reception?appointmentId=00000000-0000-4000-8000-000000000001&modulePanel=open`,
              permissionMode: "full",
            },
          ],
        },
      };
    },
  });

  const result = await gateway.listHomeOperationsWorkItems({
    actorUserId,
    includeCancelled: true,
    includeCompleted: false,
    operatingDate,
    scope: "all",
    workspaceId,
  });

  expect(calls).toEqual([
    `clair_list_home_operations_work_items:${workspaceId}:${actorUserId}:${operatingDate}:all:false:true`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    sourceStatus: "live",
    items: [
      {
        id: "appointment:00000000-0000-4000-8000-000000000001",
        sourceType: "appointment",
        progressState: "waiting",
      },
    ],
  });
});

test("home operations migration is additive and exposes read-only aggregate RPC", () => {
  expect(migration).toContain(
    "create or replace function public.clair_list_home_operations_work_items",
  );
  expect(migration).toContain("from public.appointments");
  expect(migration).toContain("from public.waiting_queue_entries");
  expect(migration).toContain("from public.order_fulfillment_work_items");
  expect(migration).toContain("from public.invoice_lines");
  expect(migration).toContain(
    "grant execute on function public.clair_list_home_operations_work_items",
  );
  expect(migration).not.toMatch(/\b(drop|truncate|delete\s+from|update\s+public\.)\b/i);
});

function createWorkItem(
  overrides: Partial<HomeOperationsWorkItem>,
): HomeOperationsWorkItem {
  return {
    id: "lab:default",
    workspaceId,
    sourceType: "lab",
    sourceId: "00000000-0000-4000-8000-000000000001",
    sourceStatus: "requested",
    title: "CBC 검사",
    progressState: "waiting",
    attentionSignals: ["team_queue"],
    requestedAt: "2026-07-05T09:00:00+09:00",
    operatingDate,
    sourceHref: `/w/${workspaceId}/lab?modulePanel=open`,
    permissionMode: "full",
    teamQueueId: "lab",
    teamQueueLabel: "임상병리팀 큐",
    ...overrides,
  };
}
