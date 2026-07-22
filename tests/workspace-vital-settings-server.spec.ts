import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockWorkspaceVitalSettingsGateway,
  createSupabaseWorkspaceVitalSettingsGateway,
  readWorkspaceVitalSettings,
  replaceWorkspaceVitalSettings,
  type SupabaseWorkspaceVitalSettingsClient,
} from "../src/features/hospital-admin/vital-settings/server-workspace-vital-settings-core";
import { createDefaultWorkspaceVitalSettingsSnapshot } from "../src/features/patient-vitals/workspace-vital-settings";

const workspaceId = "clair-demo";
const actorUserId = "user-admin";

test("workspace vital settings allow member reads and report manage eligibility", async () => {
  const result = await readWorkspaceVitalSettings({
    actorUserId,
    workspaceId,
    gateway: createMockWorkspaceVitalSettingsGateway(),
    permissionAdapter: permissionAdapter("hospital_admin"),
  });

  expect(result).toMatchObject({ ok: true, status: 200, canManage: true });
  if (result.ok) {
    expect(result.items.map((item) => item.key)).toEqual([
      "weight",
      "temperature",
      "heart_rate",
      "respiratory_rate",
    ]);
  }
});

test("workspace vital settings reject non-managers before the write gateway", async () => {
  let gatewayCalled = false;
  const result = await replaceWorkspaceVitalSettings({
    actorUserId,
    workspaceId,
    items: createDefaultWorkspaceVitalSettingsSnapshot().items,
    permissionAdapter: permissionAdapter("front_desk"),
    gateway: {
      async get() {
        return { ok: false, error: "db_read_failed" };
      },
      async replace() {
        gatewayCalled = true;
        return { ok: false, error: "db_write_failed" };
      },
    },
  });

  expect(result).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  expect(gatewayCalled).toBe(false);
});

test("workspace vital settings validate supported units and unique order before writing", async () => {
  const result = await replaceWorkspaceVitalSettings({
    actorUserId,
    workspaceId,
    items: [
      { key: "weight", enabled: true, displayUnit: "lb", sortOrder: 0 },
      { key: "temperature", enabled: true, displayUnit: "°C", sortOrder: 0 },
    ],
    permissionAdapter: permissionAdapter("hospital_admin"),
    gateway: createMockWorkspaceVitalSettingsGateway(),
  });

  expect(result).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
});

test("Supabase vital settings gateway uses only workspace-scoped read and replace RPCs", async () => {
  const calls: unknown[] = [];
  const snapshot = createDefaultWorkspaceVitalSettingsSnapshot();
  const client = {
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push([functionName, args]);
      return { data: snapshot, error: null };
    },
  } as SupabaseWorkspaceVitalSettingsClient;
  const gateway = createSupabaseWorkspaceVitalSettingsGateway(client);

  expect((await gateway.get(workspaceId)).ok).toBe(true);
  expect((await gateway.replace({ actorUserId, workspaceId, items: snapshot.items })).ok).toBe(true);
  expect(calls).toEqual([
    ["clair_get_workspace_vital_settings", { p_workspace_id: workspaceId }],
    ["clair_replace_workspace_vital_settings", {
      p_actor_user_id: actorUserId,
      p_items: snapshot.items,
      p_workspace_id: workspaceId,
    }],
  ]);
});

function permissionAdapter(role: "hospital_admin" | "front_desk") {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [{
      id: `membership-${role}`,
      workspaceId,
      userId: actorUserId,
      roles: [role],
      status: "active",
    }],
  });
}
