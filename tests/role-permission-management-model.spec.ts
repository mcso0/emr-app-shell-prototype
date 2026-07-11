import { expect, test } from "@playwright/test";
import {
  buildRolePermissionGroups,
  createRoleDraft,
  getRoleAssignedMembers,
  getRoleManagementAccess,
  isRoleDraftDirty,
  validateRoleDraft,
} from "../src/features/hospital-admin/role-permission-management/model";
import type {
  SessionWorkspaceMembership,
  SessionWorkspacePermissionRole,
  SessionWorkspacesState,
} from "../src/features/auth/workspace-session";
import {
  archiveSessionWorkspaceCustomJobPosition,
  deleteSessionWorkspaceCustomPermissionRole,
  updateSessionWorkspaceCustomJobPosition,
  validateWorkspaceInvitationInput,
} from "../src/features/auth/workspace-session";

const workspaceId = "workspace-a";

const customRole: SessionWorkspacePermissionRole = {
  workspaceId: "workspace-a",
  roleKey: "custom:lab-assistant",
  label: "검사 보조",
  roleType: "custom",
  permissionIds: ["reception:view", "lab:complete"],
  isSystem: false,
  isAssignable: true,
  sortOrder: 100,
};

const legacyOwner: SessionWorkspaceMembership = {
  id: "membership-legacy-owner",
  workspaceId: "workspace-a",
  userSessionId: "legacy-owner",
  email: "legacy-owner@clair.local",
  roles: ["hospital_admin"],
  status: "active",
  createdAt: "2026-07-11T00:00:00.000Z",
};

const state: SessionWorkspacesState = {
  currentWorkspaceId: "workspace-a",
  workspaces: [],
  memberships: [legacyOwner],
  invitations: [],
  permissionRoles: [customRole],
  jobPositions: [],
  updatedAt: "2026-07-11T00:00:00.000Z",
};

test("role permission model groups safe permissions and locks owner-only capabilities", () => {
  const groups = buildRolePermissionGroups(customRole);

  expect(groups.find((group) => group.id === "reception_customer")).toMatchObject({
    allowedCount: 1,
  });
  expect(groups.find((group) => group.id === "fulfillment")).toMatchObject({
    allowedCount: 1,
  });
  expect(groups.find((group) => group.id === "owner_only")?.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "workspace:delete", editable: false, lockReason: "owner_only" }),
    ])
  );
});

test("role permission model uses the legacy owner fallback for assigned members", () => {
  expect(getRoleAssignedMembers(state, "workspace-a", "owner").map((member) => member.id)).toEqual([
    "membership-legacy-owner",
  ]);
});

test("role_permission:view allows local read-only access without catalog mutations", () => {
  const access = getRoleManagementAccess(
    {
      ...state,
      memberships: [
        {
          ...state.memberships[0],
          userSessionId: "role-viewer",
          roles: ["front_desk"],
          permissionRoleKey: "role_viewer",
        },
      ],
      permissionRoles: [
        {
          workspaceId,
          roleKey: "role_viewer",
          label: "권한 조회자",
          roleType: "custom",
          permissionIds: ["role_permission:view"],
          isSystem: false,
          isAssignable: true,
          sortOrder: 200,
        },
      ],
    },
    workspaceId,
    { id: "role-viewer", role: "front_desk" }
  );

  expect(access).toEqual({ canView: true, canManage: false });
});

test("custom role drafts reject owner-only and unknown permissions while keeping dirty state explicit", () => {
  const draft = createRoleDraft(customRole);

  expect(isRoleDraftDirty(draft, customRole)).toBe(false);
  expect(isRoleDraftDirty({ ...draft, label: "검사 보조 2" }, customRole)).toBe(true);
  expect(validateRoleDraft({ ...draft, permissionIds: ["*"] })).toEqual({
    valid: false,
    reason: "owner_only_permission",
  });
  expect(validateRoleDraft({ ...draft, permissionIds: ["unknown:permission"] })).toEqual({
    valid: false,
    reason: "invalid_permission",
  });
});

test("mock-session catalog keeps custom role deletion and job archive separate from system rows", () => {
  const initial: SessionWorkspacesState = {
    ...state,
    permissionRoles: [customRole],
    jobPositions: [
      {
        workspaceId,
        positionKey: "custom_coordinator",
        label: "CS 코디네이터",
        isSystem: false,
        isActive: true,
        sortOrder: 100,
      },
    ],
  };

  const updatedJob = updateSessionWorkspaceCustomJobPosition(initial, {
    workspaceId,
    positionKey: "custom_coordinator",
    label: "고객 코디네이터",
  });
  expect(updatedJob.success).toBe(true);

  const archivedJob = archiveSessionWorkspaceCustomJobPosition(updatedJob.state, {
    workspaceId,
    positionKey: "custom_coordinator",
  });
  expect(archivedJob).toMatchObject({ success: true });
  expect(archivedJob.state.jobPositions).toEqual(
    expect.arrayContaining([expect.objectContaining({ positionKey: "custom_coordinator", isActive: false })])
  );

  const deletedRole = deleteSessionWorkspaceCustomPermissionRole(archivedJob.state, {
    workspaceId,
    roleKey: customRole.roleKey,
  });
  expect(deletedRole).toMatchObject({ success: true });
  expect(deletedRole.state.permissionRoles).toEqual([]);
});

test("server catalog keys are accepted when assigning a newly created role or job", () => {
  expect(
    validateWorkspaceInvitationInput(
      {
        email: "new-staff@clair.local",
        roles: ["front_desk"],
        permissionRoleKey: "custom_lab_assistant",
        jobPositionKey: "custom_coordinator",
        title: "검사 보조",
        department: "검사",
      },
      state,
      workspaceId,
      {
        permissionRoleKeys: ["owner", "admin", "general", "custom_lab_assistant"],
        jobPositionKeys: ["front_desk", "custom_coordinator"],
      }
    )
  ).toEqual({ valid: true, fieldErrors: {} });
});
