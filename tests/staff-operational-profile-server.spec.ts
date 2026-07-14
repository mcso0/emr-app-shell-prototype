import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import * as operationalProfileModule from "../src/features/staff/server-operational-profile-core";

const route =
  "/api/workspaces/clair-demo/staff/user-vet-suji/operational-profile?date=2026-05-01&context=reception";

test("operational profile route returns only display-safe same-workspace staff data", async ({
  request,
}) => {
  const response = await request.get(route, {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();

  expect(body).toMatchObject({
    ok: true,
    profile: {
      avatarUrl: "/avatars/49110000-0000-4000-8000-000000000003.png",
      department: "진료",
      displayName: "이수지",
      initials: "SJ",
      jobPositionLabel: "수의사",
      membershipStatus: "active",
    },
    shift: null,
    enforcedBy: "staff-operational-profile-read",
  });
  expect(body.profile).not.toHaveProperty("email");
  expect(body.profile).not.toHaveProperty("phone");
  expect(body.profile).not.toHaveProperty("roles");
  expect(body.profile).not.toHaveProperty("permissionRole");
  expect(body.profile).not.toHaveProperty("membershipId");
  expect(body.profile).not.toHaveProperty("userId");
  expect(body.profile).not.toHaveProperty("title");
});

test("operational profile route validates the selected date", async ({
  request,
}) => {
  const response = await request.get(
    "/api/workspaces/clair-demo/staff/user-vet-suji/operational-profile?date=today&context=reception",
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: "invalid_date",
  });

  const impossibleDate = await request.get(
    "/api/workspaces/clair-demo/staff/user-vet-suji/operational-profile?date=2026-02-30&context=reception",
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );
  expect(impossibleDate.status()).toBe(400);
});

test("operational profile route does not disclose an unavailable target", async ({
  request,
}) => {
  const response = await request.get(
    "/api/workspaces/clair-demo/staff/user-from-another-workspace/operational-profile?date=2026-05-01&context=reception",
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    status: 404,
    error: "not_found",
  });
});

test("operational profile route enforces active workspace reception access", async ({
  request,
}) => {
  const unauthenticated = await request.get(route);
  expect(unauthenticated.status()).toBe(401);

  const wrongWorkspace = await request.get(
    "/api/workspaces/workspace-b/staff/user-vet-suji/operational-profile?date=2026-05-01&context=reception",
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );
  expect(wrongWorkspace.status()).toBe(403);
  await expect(wrongWorkspace.json()).resolves.not.toHaveProperty("profile");
});

test("Supabase operational profile gateway joins membership, job position, avatar, and shift", async () => {
  const createGateway = (
    operationalProfileModule as typeof operationalProfileModule & {
      createSupabaseStaffOperationalProfileGateway?: (
        client: unknown,
      ) => operationalProfileModule.StaffOperationalProfileGateway;
    }
  ).createSupabaseStaffOperationalProfileGateway;
  expect(typeof createGateway).toBe("function");

  const gateway = createGateway!(
    createSupabaseProfileClient({
      hospital_schedule_staff_profiles: [],
      user_memberships: [
        {
          id: "membership-suji",
          workspace_id: "workspace-clair-cheongdam",
          user_id: "user-suji",
          department: "진료팀",
          title: "진료팀장",
          status: "active",
        },
      ],
      user_profiles: [{ user_id: "user-suji", avatar_url: "user-suji.png" }],
      users: [
        {
          id: "user-suji",
          display_name: "이수지",
          initial: "SJ",
          status: "active",
        },
      ],
      workspace_job_positions: [
        {
          id: "position-vet",
          workspace_id: "workspace-clair-cheongdam",
          label: "수의사",
        },
      ],
      workspace_membership_job_position_assignments: [
        {
          workspace_id: "workspace-clair-cheongdam",
          membership_id: "membership-suji",
          job_position_id: "position-vet",
        },
      ],
      scheduleSnapshot: {
        staff: [
          {
            id: "schedule-profile-suji",
            membershipId: "membership-suji",
          },
        ],
        shifts: [
          {
            id: "shift-suji",
            staffProfileId: "schedule-profile-suji",
            date: "2026-07-14",
            startMinutes: 540,
            endMinutes: 1080,
            kind: "clinical",
            workLabel: "진료",
            locationLabel: "제2진료실",
          },
        ],
      },
    }),
  );

  const result = await operationalProfileModule.readStaffOperationalProfile({
    actorUserId: "user-front-desk",
    date: "2026-07-14",
    gateway,
    permissionAdapter: createReceptionViewPermissionAdapter(),
    userId: "user-suji",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    ok: true,
    profile: {
      avatarUrl: "https://storage.local/avatars/user-suji.png",
      department: "진료팀",
      displayName: "이수지",
      initials: "SJ",
      jobPositionLabel: "수의사",
      membershipStatus: "active",
      title: "진료팀장",
    },
    shift: {
      date: "2026-07-14",
      startMinutes: 540,
      endMinutes: 1080,
      kind: "clinical",
      workLabel: "진료",
      locationLabel: "제2진료실",
    },
  });
});

test("Supabase operational profile gateway preserves inactive profile when schedule read fails", async () => {
  const createGateway = (
    operationalProfileModule as typeof operationalProfileModule & {
      createSupabaseStaffOperationalProfileGateway: (
        client: unknown,
      ) => operationalProfileModule.StaffOperationalProfileGateway;
    }
  ).createSupabaseStaffOperationalProfileGateway;

  const gateway = createGateway(
    createSupabaseProfileClient({
      hospital_schedule_staff_profiles: [],
      user_memberships: [
        {
          id: "membership-suji",
          workspace_id: "workspace-clair-cheongdam",
          user_id: "user-suji",
          department: "진료팀",
          title: "진료팀장",
          status: "inactive",
        },
      ],
      user_profiles: [],
      users: [
        {
          id: "user-suji",
          display_name: "이수지",
          initial: "SJ",
          status: "active",
        },
      ],
      workspace_job_positions: [],
      workspace_membership_job_position_assignments: [],
      scheduleError: true,
    }),
  );

  const result = await operationalProfileModule.readStaffOperationalProfile({
    actorUserId: "user-front-desk",
    date: "2026-07-14",
    gateway,
    permissionAdapter: createReceptionViewPermissionAdapter(),
    userId: "user-suji",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    ok: true,
    profile: { membershipStatus: "inactive" },
    shift: null,
    sectionErrors: { shift: "schedule_read_failed" },
  });
});

function createReceptionViewPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-front-desk", status: "active" }],
    memberships: [
      {
        id: "membership-reader",
        workspaceId: "workspace-clair-cheongdam",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
    ],
  });
}

type SupabaseProfileRows = {
  hospital_schedule_staff_profiles: Array<Record<string, unknown>>;
  user_memberships: Array<Record<string, unknown>>;
  user_profiles: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  workspace_job_positions: Array<Record<string, unknown>>;
  workspace_membership_job_position_assignments: Array<Record<string, unknown>>;
  scheduleError?: boolean;
  scheduleSnapshot?: Record<string, unknown>;
};

function createSupabaseProfileClient(rows: SupabaseProfileRows) {
  return {
    from(table: string) {
      const tableRows: Record<string, Array<Record<string, unknown>>> = {
        hospital_schedule_staff_profiles: rows.hospital_schedule_staff_profiles,
        user_memberships: rows.user_memberships,
        user_profiles: rows.user_profiles,
        users: rows.users,
        workspace_job_positions: rows.workspace_job_positions,
        workspace_membership_job_position_assignments:
          rows.workspace_membership_job_position_assignments,
      };
      let selectedRows = [...(tableRows[table] ?? [])];
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: string) {
          selectedRows = selectedRows.filter((row) => row[column] === value);
          return query;
        },
        then(
          onfulfilled: (value: {
            data: typeof selectedRows;
            error: null;
          }) => unknown,
        ) {
          return Promise.resolve({ data: selectedRows, error: null }).then(
            onfulfilled,
          );
        },
      };
      return query;
    },
    rpc() {
      return Promise.resolve(
        rows.scheduleError
          ? { data: null, error: { message: "schedule_read_failed" } }
          : {
              data: rows.scheduleSnapshot ?? { staff: [], shifts: [] },
              error: null,
            },
      );
    },
    storage: {
      from(bucket: string) {
        return {
          getPublicUrl(path: string) {
            return {
              data: { publicUrl: `https://storage.local/${bucket}/${path}` },
            };
          },
        };
      },
    },
  };
}
