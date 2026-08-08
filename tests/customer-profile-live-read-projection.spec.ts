import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockCustomerProfileOverviewGateway,
  readCustomerProfileOverview,
  readCustomerProfileSection,
  type CustomerProfileOverview,
  type CustomerProfileOverviewGateway,
} from "../src/features/customer/server-profile-overview-core";

const migrationPath = "supabase/migrations/20260808055307_customer_profile_live_read_projection.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const overview: CustomerProfileOverview = {
  subjectType: "patient",
  subjectId: "00000000-0000-4000-8000-000000000001",
  profile: {
    id: "00000000-0000-4000-8000-000000000001",
    workspaceId: "workspace-a",
    name: "콩이",
    species: "dog",
    breed: "Poodle",
  },
  relationships: { guardians: [] },
  access: {
    information: { allowed: true, requiredPermission: "patient:view" },
    history: { allowed: true, requiredPermission: "chart:view" },
    reservations: { allowed: false, requiredPermission: "reception:view" },
    billing: { allowed: true, requiredPermission: "billing:view" },
  },
};

function permissionAdapter(permissionIds: string[] = ["patient:view", "chart:view", "billing:view"]) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-a", status: "active" }],
    memberships: [
      {
        id: "membership-a",
        workspaceId: "workspace-a",
        userId: "user-a",
        roles: ["front_desk"],
        status: "active",
      },
    ],
    permissionPolicies: [
      {
        workspaceId: "workspace-a",
        role: "front_desk",
        permissionIds: permissionIds as never,
      },
    ],
  });
}

test("profile overview enforces workspace membership and returns access map", async () => {
  const result = await readCustomerProfileOverview({
    actorUserId: "user-a",
    gateway: createMockCustomerProfileOverviewGateway(overview),
    permissionAdapter: permissionAdapter(),
    subjectId: overview.subjectId,
    subjectType: "patient",
    workspaceId: "workspace-a",
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    overview: { profile: { name: "콩이" }, access: { reservations: { allowed: false } } },
  });
});

test("profile overview denies a subject from another workspace before gateway read", async () => {
  const result = await readCustomerProfileOverview({
    actorUserId: "user-a",
    gateway: createMockCustomerProfileOverviewGateway(overview),
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-a", status: "active" }],
      memberships: [],
    }),
    subjectId: overview.subjectId,
    subjectType: "patient",
    workspaceId: "workspace-a",
  });

  expect(result).toMatchObject({ ok: false, status: 403, denialReason: "workspace_membership_missing" });
});

test("section read enforces section-specific permission and does not call the gateway when denied", async () => {
  let called = false;
  const gateway: CustomerProfileOverviewGateway = {
    ...createMockCustomerProfileOverviewGateway(overview),
    async readSection(input) {
      called = true;
      return { ok: true, result: { section: input.section, items: [], nextCursor: null } } as never;
    },
  };

  const result = await readCustomerProfileSection({
    actorUserId: "user-a",
    gateway,
    permissionAdapter: permissionAdapter(["patient:view"]),
    section: "history",
    subjectId: overview.subjectId,
    subjectType: "patient",
    workspaceId: "workspace-a",
  });

  expect(result).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  expect(called).toBe(false);
});

test("section read clamps page size and preserves subject filter and cursor inputs", async () => {
  let received: Record<string, unknown> | undefined;
  const gateway: CustomerProfileOverviewGateway = {
    ...createMockCustomerProfileOverviewGateway(overview),
    async readSection(input) {
      received = input as unknown as Record<string, unknown>;
      return {
        ok: true,
        result: { section: input.section, items: [], nextCursor: "next" },
      } as never;
    },
  };

  const result = await readCustomerProfileSection({
    actorUserId: "user-a",
    cursor: "opaque",
    gateway,
    limit: 500,
    months: 12,
    patientId: overview.subjectId,
    permissionAdapter: permissionAdapter(),
    section: "history",
    subjectId: overview.subjectId,
    subjectType: "patient",
    workspaceId: "workspace-a",
  });

  expect(result).toMatchObject({ ok: true, nextCursor: "next", items: [] });
  expect(received).toMatchObject({ cursor: "opaque", limit: 50, months: 12, patientId: overview.subjectId });
});

test("profile projection migration is function-only and applies strict read boundaries", () => {
  expect(migration).toContain("auth.uid()");
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain("private.clair_current_user_has_workspace_permission");
  expect(migration).toContain("set search_path = public, private, pg_temp");
  expect(migration).toContain("grant execute on function");
  expect(migration).toContain("revoke all on function");
  expect(migration).toContain("i.guardian_id = p_subject_id");
  expect(migration).toContain("e.patient_id = p_subject_id");
  expect(migration).toContain("pg.unlinked_at is null");
  expect(migration).not.toMatch(/create table|create index|insert into|update public\.|delete from public\./i);
  expect(migration).not.toContain("resident_registration_number_token");
  expect(migration).not.toContain("cash_receipt_number");
  expect(migration).not.toContain("vehicle_number");
});
