import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const coverageDocPath =
  "docs/engineering/auth-security/auth-login/launch-route-permission-enforcement-inventory.md";

test("launch route permission inventory documents coverage and remaining gaps", () => {
  const document = readFileSync(coverageDocPath, "utf8");

  expect(document).toContain("Launch-Critical Route Coverage");
  expect(document).toContain("Safe 401/403 Contract");
  expect(document).toContain("Mock Fallback Boundary");
  expect(document).toContain("Remaining Enforcement Gap");

  for (const route of [
    "/api/ops/tenant-applications/[applicationId]/workspace",
    "/api/workspaces",
    "/api/workspaces/[workspaceId]/invitations",
    "/api/workspaces/[workspaceId]/memberships",
    "/api/workspaces/[workspaceId]/memberships/[membershipId]/roles",
    "/api/workspaces/[workspaceId]/memberships/[membershipId]/status",
    "/api/users/me/profile",
    "/api/workspaces/[workspaceId]/audit/events",
  ]) {
    expect(document).toContain(route);
  }
});

test("launch-critical route sources keep server session and permission boundaries", () => {
  const routeExpectations = [
    {
      path: "src/app/api/ops/tenant-applications/[applicationId]/workspace/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity"],
      corePath: "src/features/ops/server-tenant-workspace-action-core.ts",
      coreTokens: ["tenant_approval:manage", "operator_permission_missing"],
    },
    {
      path: "src/app/api/workspaces/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity", "enforceWorkspaceMutationRateLimit"],
      corePath: "src/features/auth/server-workspace-creation.ts",
      coreTokens: ["unauthenticated", "workspace-creation-server-route"],
    },
    {
      path: "src/app/api/workspaces/[workspaceId]/invitations/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity"],
      corePath: "src/features/auth/server-workspace-invitation.ts",
      coreTokens: ["role_permission:manage", "duplicate_pending_invitation", "active_membership_exists"],
    },
    {
      path: "src/app/api/workspaces/[workspaceId]/memberships/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity"],
      corePath: "src/features/auth/server-workspace-membership-status.ts",
      coreTokens: ["role_permission:manage", "workspace-membership-status-reader"],
    },
    {
      path: "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity"],
      corePath: "src/features/auth/server-role-update-enforcement.ts",
      coreTokens: ["role_permission:manage", "assertLastWorkspaceAdminGuard", "invalid_roles"],
    },
    {
      path: "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity", "authorizeWorkspaceRoleUpdate"],
      corePath: "src/features/auth/server-role-update-enforcement.ts",
      coreTokens: ["role_permission:manage", "assertLastWorkspaceAdminGuard", "target_membership_missing"],
    },
    {
      path: "src/app/api/users/me/profile/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity", "enforceWorkspaceMutationRateLimit"],
      corePath: "src/features/auth/server-personal-profile.ts",
      coreTokens: ["profile_authority_field_forbidden", "personal-profile-server-route"],
    },
    {
      path: "src/app/api/workspaces/[workspaceId]/audit/events/route.ts",
      routeTokens: ["readServerSession", "resolveRoleUpdateActorIdentity"],
      corePath: "src/features/audit/server-audit-event-review-core.ts",
      coreTokens: ["role_permission:manage", "live-audit-review-reader"],
    },
  ];

  for (const expectation of routeExpectations) {
    const routeSource = readFileSync(expectation.path, "utf8");
    for (const token of expectation.routeTokens) {
      expect(routeSource).toContain(token);
    }
    expect(routeSource).not.toMatch(/localStorage|sessionStorage|window\\./);

    const coreSource = readFileSync(expectation.corePath, "utf8");
    for (const token of expectation.coreTokens) {
      expect(coreSource).toContain(token);
    }
    expect(coreSource).not.toMatch(/service_role|SUPABASE_SECRET|db_password/i);
  }
});
