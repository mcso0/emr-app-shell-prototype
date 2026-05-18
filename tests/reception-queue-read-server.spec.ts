import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockReceptionQueueReadGateway,
  createSupabaseReceptionQueueReadGateway,
  readReceptionQueue,
} from "../src/features/reception/server-reception-queue-read-core";
import type { Encounter, WaitingQueueEntry } from "../src/types/emr-domain";

const encounter: Encounter = {
  id: "encounter-db-walkin-coco",
  workspaceId: "clair-demo",
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "staff-vet-lee",
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
};

const queueEntry: WaitingQueueEntry = {
  id: "queue-db-walkin-coco",
  workspaceId: "clair-demo",
  encounterId: encounter.id,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: 1,
  enteredAt: "2026-05-19T00:00:00.000Z",
};

test("reception queue read route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.get("/api/workspaces/clair-demo/reception/queue");
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const mockFallback = await request.get("/api/workspaces/clair-demo/reception/queue", {
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(mockFallback.status()).toBe(200);
  await expectJson(mockFallback, {
    ok: true,
    queue: [],
    enforcedBy: "reception-queue-read",
  });
});

test("reception queue read core enforces active workspace membership and reception view", async () => {
  const missingMembership = await readReceptionQueue({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
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
    gateway: createMockReceptionQueueReadGateway({
      queue: [{ encounter, queueEntry }],
    }),
  });

  expect(missingMembership).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });

  const noReceptionView = await readReceptionQueue({
    actorUserId: "user-without-view",
    workspaceId: "clair-demo",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-without-view", status: "active" }],
      memberships: [
        {
          id: "membership-without-view",
          workspaceId: "clair-demo",
          userId: "user-without-view",
          roles: ["vet"],
          status: "active",
        },
      ],
      permissionPolicies: [
        {
          workspaceId: "clair-demo",
          role: "vet",
          permissionIds: ["chart:view"],
        },
      ],
    }),
    gateway: createMockReceptionQueueReadGateway({
      queue: [{ encounter, queueEntry }],
    }),
  });

  expect(noReceptionView).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("supabase reception queue gateway maps rows and keeps workspace scope in the RPC read", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionQueueReadGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_limit}`);
      return {
        data: [{ encounter, queueEntry }],
        error: null,
      };
    },
  });

  const result = await gateway.listReceptionQueue({ workspaceId: "clair-demo" });

  expect(calls).toEqual(["clair_list_reception_queue:clair-demo:100"]);
  expect(result).toMatchObject({
    ok: true,
    queue: [
      {
        encounter: { id: "encounter-db-walkin-coco", workspaceId: "clair-demo" },
        queueEntry: { id: "queue-db-walkin-coco", workspaceId: "clair-demo" },
      },
    ],
  });
});

test("reception queue read route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/queue/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/reception/server-reception-queue-read.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

test("reception queue reader migration keeps queue rows workspace-scoped", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260519140000_reception_queue_reader.sql",
    "utf8"
  );

  expect(migrationSource).toContain("create or replace function public.clair_list_reception_queue");
  expect(migrationSource).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migrationSource).toContain("q.workspace_id = p_workspace_id");
  expect(migrationSource).toContain("q.queue_type in ('consultation', 'billing')");
  expect(migrationSource).toContain("grant execute on function public.clair_list_reception_queue");
  expect(migrationSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  await expect(response.json()).resolves.toMatchObject(expected);
}
