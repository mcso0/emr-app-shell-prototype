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

test("permission role assignment is authoritative when present and legacy roles remain fallback", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [
      { id: "user-custom", status: "active", displayName: "김하늘" },
      { id: "user-legacy", status: "active", displayName: "이도윤" },
    ],
    memberships: [
      {
        id: "membership-custom",
        workspaceId: "workspace-a",
        userId: "user-custom",
        roles: ["vet"],
        permissionRole: {
          id: "role-chart-readonly",
          key: "chart_readonly",
          label: "차트 열람",
          roleType: "custom",
          permissionIds: ["chart:view"],
        },
        jobPosition: {
          id: "position-veterinarian",
          key: "veterinarian",
          label: "수의사",
        },
        status: "active",
      },
      {
        id: "membership-legacy",
        workspaceId: "workspace-a",
        userId: "user-legacy",
        roles: ["vet"],
        status: "active",
      },
    ],
  });

  const customView = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-custom",
    workspaceId: "workspace-a",
    requiredPermission: "chart:view",
  });
  const customUpdate = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-custom",
    workspaceId: "workspace-a",
    requiredPermission: "chart:update",
  });
  const legacyUpdate = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-legacy",
    workspaceId: "workspace-a",
    requiredPermission: "chart:update",
  });

  expect(customView.allowed).toBe(true);
  expect(customView.assignedPermissionRole).toMatchObject({
    key: "chart_readonly",
    label: "차트 열람",
    roleType: "custom",
  });
  expect(customView.jobPosition).toMatchObject({ key: "veterinarian", label: "수의사" });
  expect(customView.assignedRoles).toEqual(["vet"]);
  expect(customView.effectivePermissionIds).toEqual(["chart:view"]);
  expect(customView.hasFullWorkspaceAccess).toBe(false);
  expect(customView.hasOwnerWorkspaceAccess).toBe(false);

  expect(customUpdate.allowed).toBe(false);
  expect(customUpdate.denialReason).toBe("permission_missing");
  expect(legacyUpdate.allowed).toBe(true);
});

test("owner permission role grants owner/full workspace flags without requiring legacy hospital_admin", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [{ id: "user-owner", status: "active", displayName: "박서진" }],
    memberships: [
      {
        id: "membership-owner",
        workspaceId: "workspace-a",
        userId: "user-owner",
        roles: ["front_desk"],
        permissionRole: {
          id: "role-owner",
          key: "owner",
          label: "소유자",
          roleType: "owner",
          permissionIds: ["*"],
        },
        status: "active",
      },
    ],
  });

  const result = resolveWorkspacePermission(adapter, {
    sessionUserId: "user-owner",
    workspaceId: "workspace-a",
    requiredPermission: "role_permission:manage",
  });

  expect(result.allowed).toBe(true);
  expect(result.assignedPermissionRole).toMatchObject({ key: "owner", label: "소유자" });
  expect(result.hasFullWorkspaceAccess).toBe(true);
  expect(result.hasOwnerWorkspaceAccess).toBe(true);
  expect(result.effectivePermissionIds).toEqual(expect.arrayContaining(["role_permission:manage"]));
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

test("workspace membership from another workspace does not grant access", () => {
  const adapter = createMockWorkspacePermissionAdapter({
    now,
    users: [{ id: "user-admin", status: "active" }],
    memberships: [
      {
        id: "membership-admin-b",
        workspaceId: "workspace-b",
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

  expect(result.allowed).toBe(false);
  expect(result.denialReason).toBe("workspace_membership_missing");
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
