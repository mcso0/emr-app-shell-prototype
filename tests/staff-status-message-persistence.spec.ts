import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseWorkspaceStatusMessageGateway,
  updateWorkspaceStatusMessage,
  type SupabaseWorkspaceStatusMessageClient,
  type WorkspaceStatusMessageGateway,
} from "../src/features/staff/server-workspace-status-message-core";

const workspaceId = "workspace-clair-cheongdam";
const actorUserId = "00000000-0000-4000-8000-000000000031";
const confirmedAt = "2026-07-16T01:00:00.000Z";

test("status message trims, persists at 60 Unicode code points, and deletes empty input", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const gateway: WorkspaceStatusMessageGateway = {
    async writeStatusMessage(input) {
      writes.push(input);
      return {
        ok: true,
        message: input.message,
        updatedAt: input.message ? "2026-07-16T01:01:00.000Z" : null,
      };
    },
  };
  const sixtyEmoji = "🐶".repeat(60);

  const saved = await updateWorkspaceStatusMessage({
    actorUserId,
    expectedUpdatedAt: confirmedAt,
    gateway,
    message: `  ${sixtyEmoji}  `,
    permissionAdapter: createPermissionAdapter(actorUserId, workspaceId),
    workspaceId,
  });
  const removed = await updateWorkspaceStatusMessage({
    actorUserId,
    expectedUpdatedAt: "2026-07-16T01:01:00.000Z",
    gateway,
    message: "   ",
    permissionAdapter: createPermissionAdapter(actorUserId, workspaceId),
    workspaceId,
  });

  expect(saved).toMatchObject({
    ok: true,
    status: 200,
    message: sixtyEmoji,
    updatedAt: "2026-07-16T01:01:00.000Z",
  });
  expect(removed).toMatchObject({
    ok: true,
    status: 200,
    message: null,
    updatedAt: null,
  });
  expect(writes).toEqual([
    {
      expectedUpdatedAt: confirmedAt,
      message: sixtyEmoji,
      userId: actorUserId,
      workspaceId,
    },
    {
      expectedUpdatedAt: "2026-07-16T01:01:00.000Z",
      message: null,
      userId: actorUserId,
      workspaceId,
    },
  ]);
});

test("status message rejects invalid length and version before the gateway", async () => {
  let calls = 0;
  const gateway: WorkspaceStatusMessageGateway = {
    async writeStatusMessage() {
      calls += 1;
      return { ok: true, message: null, updatedAt: null };
    },
  };
  const permissionAdapter = createPermissionAdapter(actorUserId, workspaceId);

  await expect(
    updateWorkspaceStatusMessage({
      actorUserId,
      expectedUpdatedAt: confirmedAt,
      gateway,
      message: "가".repeat(61),
      permissionAdapter,
      workspaceId,
    }),
  ).resolves.toEqual({
    ok: false,
    status: 400,
    error: "invalid_status_message",
  });
  await expect(
    updateWorkspaceStatusMessage({
      actorUserId,
      expectedUpdatedAt: "not-a-timestamp",
      gateway,
      message: "진료 중",
      permissionAdapter,
      workspaceId,
    }),
  ).resolves.toEqual({ ok: false, status: 400, error: "invalid_version" });
  expect(calls).toBe(0);
});

test("status message blocks inactive and cross-workspace actors before mutation", async () => {
  let calls = 0;
  const gateway: WorkspaceStatusMessageGateway = {
    async writeStatusMessage() {
      calls += 1;
      return { ok: true, message: null, updatedAt: null };
    },
  };
  const deniedAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-other",
        workspaceId: "workspace-other",
        userId: actorUserId,
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-inactive",
        workspaceId,
        userId: "00000000-0000-4000-8000-000000000032",
        roles: ["vet"],
        status: "inactive",
      },
    ],
  });

  await expect(
    updateWorkspaceStatusMessage({
      actorUserId,
      expectedUpdatedAt: null,
      gateway,
      message: "진료 중",
      permissionAdapter: deniedAdapter,
      workspaceId,
    }),
  ).resolves.toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
  await expect(
    updateWorkspaceStatusMessage({
      actorUserId: "00000000-0000-4000-8000-000000000032",
      expectedUpdatedAt: null,
      gateway,
      message: "진료 중",
      permissionAdapter: deniedAdapter,
      workspaceId,
    }),
  ).resolves.toMatchObject({ ok: false, status: 403 });
  expect(calls).toBe(0);
});

test("status message maps optimistic concurrency conflict without overwriting", async () => {
  const gateway: WorkspaceStatusMessageGateway = {
    async writeStatusMessage() {
      return { ok: false, error: "conflict" };
    },
  };

  await expect(
    updateWorkspaceStatusMessage({
      actorUserId,
      expectedUpdatedAt: confirmedAt,
      gateway,
      message: "곧 복귀합니다",
      permissionAdapter: createPermissionAdapter(actorUserId, workspaceId),
      workspaceId,
    }),
  ).resolves.toEqual({
    ok: false,
    status: 409,
    error: "status_message_conflict",
  });
});

test("Supabase status-message gateway sends only self-write RPC inputs", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> =
    [];
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          message: "진료 중",
          updatedAt: "2026-07-16T01:01:00.000Z",
        },
        error: null,
      };
    },
  } as SupabaseWorkspaceStatusMessageClient;
  const gateway = createSupabaseWorkspaceStatusMessageGateway(client);

  await expect(
    gateway.writeStatusMessage({
      expectedUpdatedAt: confirmedAt,
      message: "진료 중",
      userId: actorUserId,
      workspaceId,
    }),
  ).resolves.toEqual({
    ok: true,
    message: "진료 중",
    updatedAt: "2026-07-16T01:01:00.000Z",
  });
  expect(calls).toEqual([
    {
      functionName: "clair_set_my_workspace_status_message",
      args: {
        p_expected_updated_at: confirmedAt,
        p_status_message: "진료 중",
        p_workspace_id: workspaceId,
      },
    },
  ]);
  expect(JSON.stringify(calls)).not.toContain(actorUserId);
});

test("status-message migration keeps workspace ownership, RLS, CAS, and safe audit together", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20260716010000_workspace_member_status_messages.sql",
  );
  const source = fs.readFileSync(migrationPath, "utf8");

  expect(source).toContain(
    "create table if not exists public.workspace_member_status_messages",
  );
  expect(source).toContain(
    "references public.user_memberships (workspace_id, user_id)",
  );
  expect(source).toContain("char_length(status_message) <= 60");
  expect(source).toContain("status_message = btrim(status_message)");
  expect(source).toContain(
    "private.clair_is_active_workspace_member(workspace_id)",
  );
  expect(source).toContain("user_id = auth.uid()");
  expect(source).toContain("user_id = (select auth.uid())");
  expect(source).toContain("clair_set_my_workspace_status_message");
  expect(source).toContain("p_expected_updated_at");
  expect(source).toContain("nullif(regexp_replace(p_status_message");
  expect(source).toContain("status_message_conflict");
  expect(source).toContain("user.workspace_status_message_updated");
  expect(source).toContain("workspace.membership_archived");
  expect(source).toContain("workspace.permission_role_updated");
  expect(source).toContain("workspace.job_position_reactivated");
  expect(source).toContain("hospital.operating_hours_updated");
  expect(source).toContain("beforeLength");
  expect(source).toContain("afterLength");
  expect(source).not.toContain("workspace_member_activity");
  expect(source).not.toMatch(/before_snapshot[^\n]*status_message/i);
  expect(source).not.toMatch(/after_snapshot[^\n]*status_message/i);
});

test("status message route does not accept runtime demo mutation fallback", async ({
  request,
}) => {
  const response = await request.patch(
    "/api/workspaces/clair-demo/members/me/status-message",
    {
      data: { expectedUpdatedAt: null, message: "진료 중" },
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    },
  );

  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    status: 503,
    error: "configured_data_source_required",
  });
});

function createPermissionAdapter(userId: string, targetWorkspaceId: string) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: userId, status: "active" }],
    memberships: [
      {
        id: `membership-${userId}`,
        workspaceId: targetWorkspaceId,
        userId,
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}
