import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  assertLastWorkspaceAdminGuard,
  canCreate,
  canUpdate,
  canView,
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
} from "../src/features/auth/permission-resolver";

const now = "2026-05-17T12:00:00.000Z";

test("hospital admin receives full workspace permissions from active membership", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [{ id: "user-admin", status: "active", displayName: "송민재" }],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: "workspace-a",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });

  const result = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-admin",
    workspaceId: "workspace-a",
    requiredPermission: "role_permission:manage",
  });

  expect(result.allowed).toBe(true);
  expect(result.assignedRoles).toEqual(["hospital_admin"]);
  expect(result.hasFullWorkspaceAccess).toBe(true);
  expect(result.effectivePermissionIds).toEqual(
    expect.arrayContaining(["chart:update", "billing:issue", "role_permission:manage"])
  );
});

test("multi-role membership grants additive permissions without admin escalation", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [{ id: "user-ops", status: "active" }],
    memberships: [
      {
        id: "membership-ops",
        workspaceId: "workspace-a",
        userId: "user-ops",
        roles: ["front_desk", "technician"],
        status: "active",
      },
    ],
  });

  const result = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-ops",
    workspaceId: "workspace-a",
    requiredPermission: "billing:issue",
  });

  expect(result.allowed).toBe(true);
  expect(result.assignedRoles).toEqual(["front_desk", "technician"]);
  expect(result.hasFullWorkspaceAccess).toBe(false);
  expect(result.effectivePermissionIds).toEqual(
    expect.arrayContaining(["reception:update", "chart:view", "billing:issue", "lab:complete"])
  );
  expect(result.effectivePermissionIds).not.toContain("chart:update");
  expect(result.effectivePermissionIds).not.toContain("role_permission:manage");
});

test("vet can update charts while technician and front desk remain chart view-only", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
      { id: "user-desk", status: "active" },
    ],
    memberships: [
      {
        id: "membership-vet",
        workspaceId: "workspace-a",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: "workspace-a",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
      {
        id: "membership-desk",
        workspaceId: "workspace-a",
        userId: "user-desk",
        roles: ["front_desk"],
        status: "active",
      },
    ],
  });

  expect(canUpdate(adapter, "user-vet", "workspace-a", "chart")).toBe(true);
  expect(canView(adapter, "user-tech", "workspace-a", "chart")).toBe(true);
  expect(canUpdate(adapter, "user-tech", "workspace-a", "chart")).toBe(false);
  expect(canView(adapter, "user-desk", "workspace-a", "chart")).toBe(true);
  expect(canUpdate(adapter, "user-desk", "workspace-a", "chart")).toBe(false);
  expect(canCreate(adapter, "user-desk", "workspace-a", "reception")).toBe(true);
});

test("resolver returns typed denial reasons for unauthenticated, inactive, missing, and permission gaps", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [
      { id: "user-inactive", status: "inactive" },
      { id: "user-suspended", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
      {
        id: "membership-suspended",
        workspaceId: "workspace-a",
        userId: "user-suspended",
        roles: ["vet"],
        status: "suspended",
      },
      {
        id: "membership-vet",
        workspaceId: "workspace-a",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });

  expect(
    resolveWorkspacePermission(adapter, {
      sessionUserId: null,
      workspaceId: "workspace-a",
      requiredPermission: "chart:view",
    }).denialReason
  ).toBe("unauthenticated");
  expect(
    resolveWorkspacePermission(adapter, {
      sessionUserId: "user-inactive",
      workspaceId: "workspace-a",
      requiredPermission: "chart:view",
    }).denialReason
  ).toBe("inactive_user");
  expect(
    resolveWorkspacePermission(adapter, {
      sessionUserId: "user-missing-membership",
      workspaceId: "workspace-a",
      requiredPermission: "chart:view",
    }).denialReason
  ).toBe("workspace_membership_missing");
  expect(
    resolveWorkspacePermission(adapter, {
      sessionUserId: "user-suspended",
      workspaceId: "workspace-a",
      requiredPermission: "chart:view",
    }).denialReason
  ).toBe("workspace_membership_inactive");
  expect(
    resolveWorkspacePermission(adapter, {
      sessionUserId: "user-vet",
      workspaceId: "workspace-a",
      requiredPermission: "role_permission:manage",
    }).denialReason
  ).toBe("permission_missing");
});

test("last active hospital admin guard blocks demotion or deactivation", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [{ id: "user-admin", status: "active" }],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: "workspace-a",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });

  expect(
    assertLastWorkspaceAdminGuard(adapter, {
      workspaceId: "workspace-a",
      targetMembershipId: "membership-admin",
      nextRoles: ["vet"],
      nextStatus: "active",
    })
  ).toMatchObject({ allowed: false, denialReason: "last_admin_protected" });
  expect(
    assertLastWorkspaceAdminGuard(adapter, {
      workspaceId: "workspace-a",
      targetMembershipId: "membership-admin",
      nextRoles: ["hospital_admin"],
      nextStatus: "inactive",
    })
  ).toMatchObject({ allowed: false, denialReason: "last_admin_protected" });
});

test("server resolver entrypoint is marked server-only and keeps client storage out", () => {
  const source = readFileSync("src/features/auth/permission-resolver.server.ts", "utf8");

  expect(source).toContain('import "server-only"');
  expect(source).not.toMatch(/sessionStorage|localStorage|window\\./);
});
