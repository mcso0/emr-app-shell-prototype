import { expect, test } from "@playwright/test";

const headers = { "x-clair-demo-session-user-id": "user-admin" };

test("permission role management lists and creates workspace definitions", async ({ request }) => {
  const listed = await request.get("/api/workspaces/workspace-a/permission-roles", { headers });
  expect(listed.status()).toBe(200);
  expect((await listed.json()).roles).toEqual(expect.arrayContaining([expect.objectContaining({ roleKey: "owner", isSystem: true })]));

  const created = await request.post("/api/workspaces/workspace-a/permission-roles", {
    headers,
    data: { label: "검사 보조", permissionIds: ["reception:view"] },
  });
  expect(created.status()).toBe(201);
  expect((await created.json()).role).toEqual(expect.objectContaining({ label: "검사 보조", roleType: "custom", status: "active" }));
});

test("permission role management denies unauthorized and owner-only grants", async ({ request }) => {
  const denied = await request.get("/api/workspaces/workspace-a/permission-roles", { headers: { "x-clair-demo-session-user-id": "user-vet" } });
  expect(denied.status()).toBe(403);
  const invalid = await request.post("/api/workspaces/workspace-a/permission-roles", { headers, data: { label: "위험 역할", permissionIds: ["workspace:transfer_owner"] } });
  expect(invalid.status()).toBe(400);
});
