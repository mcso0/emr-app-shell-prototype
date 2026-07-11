import { expect, test } from "@playwright/test";
import {
  createWorkspaceRoleCatalogApi,
  WorkspaceRoleCatalogApiError,
} from "@/features/hospital-admin/role-permission-management/server-catalog";

const snapshot = {
  permissionRoles: [],
  jobPositions: [],
  access: { canManage: false },
  ownerReconciliation: { needsConfirmation: false, membershipIds: [] },
};

test("role catalog client reads and mutates through the workspace-scoped route", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const api = createWorkspaceRoleCatalogApi(async (input, init) => {
    requests.push({ url: String(input), init });
    return Response.json({ ok: true, snapshot });
  });

  await expect(api.load("workspace-a")).resolves.toEqual(snapshot);
  await expect(
    api.mutate("workspace-a", {
      action: "role.create",
      role: { label: "검사 보조", permissionIds: ["lab:complete"] },
    })
  ).resolves.toEqual(snapshot);

  expect(requests).toEqual([
    {
      url: "/api/workspaces/workspace-a/role-permission-management",
      init: { method: "GET", headers: { accept: "application/json" } },
    },
    {
      url: "/api/workspaces/workspace-a/role-permission-management",
      init: {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          action: "role.create",
          role: { label: "검사 보조", permissionIds: ["lab:complete"] },
        }),
      },
    },
  ]);
});

test("role catalog client exposes server denial as a stable UI error", async () => {
  const api = createWorkspaceRoleCatalogApi(async () =>
    Response.json({ ok: false, error: "permission_missing" }, { status: 403 })
  );

  await expect(api.load("workspace-a")).rejects.toEqual(
    new WorkspaceRoleCatalogApiError("permission_missing", 403)
  );
});
