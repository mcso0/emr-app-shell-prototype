import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import * as operationalProfileModule from "../src/features/staff/server-operational-profile-core";

const route =
  "/api/workspaces/clair-demo/staff/user-vet-suji/operational-profile?date=2026-05-01";

test("operational profile route never falls back to runtime demo staff data", async ({
  request,
}) => {
  const response = await request.get(route, {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });

  expect(response.status()).toBe(503);
  const body = await response.json();
  expect(body).toEqual({
    ok: false,
    status: 503,
    error: "configured_data_source_required",
  });
  expect(body).not.toHaveProperty("profile");
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

test("operational profile route does not disclose targets through demo fallback", async ({
  request,
}) => {
  const response = await request.get(
    "/api/workspaces/clair-demo/staff/user-from-another-workspace/operational-profile?date=2026-05-01&context=reception",
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );

  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    status: 503,
    error: "configured_data_source_required",
  });
});

test("operational profile route requires authentication and a configured source", async ({
  request,
}) => {
  const unauthenticated = await request.get(route);
  expect(unauthenticated.status()).toBe(401);

  const wrongWorkspace = await request.get(
    "/api/workspaces/workspace-b/staff/user-vet-suji/operational-profile?date=2026-05-01&context=reception",
    { headers: { "x-clair-demo-session-user-id": "user-admin" } },
  );
  expect(wrongWorkspace.status()).toBe(503);
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
      workspace_member_activity: [
        {
          workspace_id: "workspace-clair-cheongdam",
          user_id: "user-suji",
          last_seen_at: "2026-07-14T11:55:00.000Z",
        },
      ],
      workspace_member_status_messages: [
        {
          workspace_id: "workspace-clair-cheongdam",
          user_id: "user-suji",
          status_message: "진료 중입니다",
          updated_at: "2026-07-14T12:00:00.000Z",
        },
      ],
      users: [
        {
          id: "user-suji",
          display_name: "이수지",
          email: "suji@example.test",
          initial: "SJ",
          phone: "010-0000-0000",
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
        week: { publicationState: "published" },
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
    }) as unknown as operationalProfileModule.SupabaseStaffOperationalProfileClient,
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
    capabilities: {
      canEditStatusMessage: false,
      canManageMember: false,
      manageMemberHref: null,
      scheduleHref:
        "/w/workspace-clair-cheongdam/hospital-admin?modulePanel=open&section=schedule&staffId=schedule-profile-suji&weekStart=2026-07-13",
    },
    profile: {
      avatarUrl: "https://storage.local/avatars/user-suji.png",
      department: "진료팀",
      displayName: "이수지",
      email: "suji@example.test",
      initials: "SJ",
      jobPositionLabel: "수의사",
      lastSeenAt: "2026-07-14T11:55:00.000Z",
      membershipStatus: "active",
      phone: "010-0000-0000",
      statusMessage: "진료 중입니다",
      statusMessageUpdatedAt: "2026-07-14T12:00:00.000Z",
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

test("Supabase operational profile derives the nearest 14-day absence and first return from published weeks", async () => {
  const baseRows = {
    hospital_schedule_staff_profiles: [],
    user_memberships: [
      {
        id: "membership-suji",
        workspace_id: "workspace-clair-cheongdam",
        user_id: "user-suji",
        status: "active",
      },
    ],
    user_profiles: [],
    users: [
      {
        id: "user-suji",
        display_name: "이수지",
        status: "active",
      },
    ],
    workspace_job_positions: [],
    workspace_member_activity: [],
    workspace_membership_job_position_assignments: [],
  };
  const staff = [
    { id: "schedule-profile-suji", membershipId: "membership-suji" },
  ];
  const gateway = operationalProfileModule.createSupabaseStaffOperationalProfileGateway(
    createSupabaseProfileClient({
      ...baseRows,
      scheduleSnapshots: {
        "2026-07-13": {
          week: { publicationState: "published" },
          staff,
          shifts: [
            {
              staffProfileId: "schedule-profile-suji",
              date: "2026-07-16",
              startMinutes: 540,
              endMinutes: 1080,
              kind: "clinical",
              workLabel: "진료",
              locationLabel: null,
              note: "API에 노출하면 안 되는 메모",
            },
          ],
        },
        "2026-07-20": {
          week: { publicationState: "changed" },
          staff,
          shifts: [
            {
              staffProfileId: "schedule-profile-suji",
              date: "2026-07-22",
              startMinutes: 0,
              endMinutes: 0,
              kind: "off",
              workLabel: "휴무",
              locationLabel: null,
              note: "개인 사유",
            },
            {
              staffProfileId: "schedule-profile-suji",
              date: "2026-07-23",
              startMinutes: 600,
              endMinutes: 1080,
              kind: "clinical",
              workLabel: "진료",
              locationLabel: "제2진료실",
            },
          ],
        },
        "2026-07-27": {
          week: { publicationState: "draft" },
          staff,
          shifts: [
            {
              staffProfileId: "schedule-profile-suji",
              date: "2026-07-27",
              startMinutes: 0,
              endMinutes: 0,
              kind: "leave",
              workLabel: "휴가",
              locationLabel: null,
            },
          ],
        },
      },
    }) as unknown as operationalProfileModule.SupabaseStaffOperationalProfileClient,
  );

  const result = await operationalProfileModule.readStaffOperationalProfile({
    actorUserId: "user-front-desk",
    date: "2026-07-16",
    gateway,
    permissionAdapter: createReceptionViewPermissionAdapter(),
    userId: "user-suji",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    ok: true,
    availability: {
      event: { date: "2026-07-22", kind: "off" },
      returnShift: {
        date: "2026-07-23",
        startMinutes: 600,
        endMinutes: 1080,
        kind: "clinical",
      },
    },
  });
  expect(JSON.stringify(result)).not.toContain("개인 사유");
  expect(JSON.stringify(result)).not.toContain("노출하면 안 되는 메모");
});

test("Supabase operational profile remains available while activity storage is unavailable", async () => {
  const gateway =
    operationalProfileModule.createSupabaseStaffOperationalProfileGateway(
      createSupabaseProfileClient({
        activityError: true,
        hospital_schedule_staff_profiles: [],
        user_memberships: [
          {
            id: "membership-suji",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "user-suji",
            status: "active",
          },
        ],
        user_profiles: [],
        users: [
          {
            id: "user-suji",
            display_name: "이수지",
            status: "active",
          },
        ],
        workspace_job_positions: [],
        workspace_member_activity: [],
        workspace_membership_job_position_assignments: [],
      }) as unknown as operationalProfileModule.SupabaseStaffOperationalProfileClient,
    );

  await expect(
    gateway.readProfile({
      date: "2026-07-14",
      userId: "user-suji",
      workspaceId: "workspace-clair-cheongdam",
    }),
  ).resolves.toMatchObject({
    ok: true,
    profile: {
      displayName: "이수지",
      membershipStatus: "active",
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
      workspace_member_activity: [],
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

test("operational profile keeps nullable contacts absent and does not require reception permission", async () => {
  const gateway = operationalProfileModule.createSupabaseStaffOperationalProfileGateway(
    createSupabaseProfileClient({
      hospital_schedule_staff_profiles: [],
      user_memberships: [
        {
          id: "membership-suji",
          workspace_id: "workspace-clair-cheongdam",
          user_id: "user-suji",
          status: "active",
        },
      ],
      user_profiles: [],
      users: [
        {
          id: "user-suji",
          display_name: "이수지",
          email: null,
          phone: "   ",
          status: "active",
        },
      ],
      workspace_job_positions: [],
      workspace_member_activity: [],
      workspace_membership_job_position_assignments: [],
    }) as unknown as operationalProfileModule.SupabaseStaffOperationalProfileClient,
  );

  const result = await operationalProfileModule.readStaffOperationalProfile({
    actorUserId: "user-suji",
    date: "2026-07-14",
    gateway,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-suji", status: "active" }],
      memberships: [
        {
          id: "membership-reader",
          workspaceId: "workspace-clair-cheongdam",
          userId: "user-suji",
          roles: [],
          status: "active",
        },
      ],
    }),
    userId: "user-suji",
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.capabilities.canEditStatusMessage).toBe(true);
  expect(result.profile).not.toHaveProperty("email");
  expect(result.profile).not.toHaveProperty("phone");
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
  activityError?: boolean;
  hospital_schedule_staff_profiles: Array<Record<string, unknown>>;
  user_memberships: Array<Record<string, unknown>>;
  user_profiles: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  workspace_job_positions: Array<Record<string, unknown>>;
  workspace_member_activity: Array<Record<string, unknown>>;
  workspace_member_status_messages?: Array<Record<string, unknown>>;
  workspace_membership_job_position_assignments: Array<Record<string, unknown>>;
  scheduleError?: boolean;
  scheduleSnapshot?: Record<string, unknown>;
  scheduleSnapshots?: Record<string, Record<string, unknown>>;
};

function createSupabaseProfileClient(rows: SupabaseProfileRows) {
  return {
    from(table: string) {
      const tableRows: Record<string, Array<Record<string, unknown>>> = {
        hospital_schedule_staff_profiles: rows.hospital_schedule_staff_profiles,
        user_memberships: rows.user_memberships,
        user_profiles: rows.user_profiles,
        users: rows.users,
        workspace_member_activity: rows.workspace_member_activity,
        workspace_member_status_messages:
          rows.workspace_member_status_messages ?? [],
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
            data: typeof selectedRows | null;
            error: { message: string } | null;
          }) => unknown,
        ) {
          const error =
            table === "workspace_member_activity" && rows.activityError
              ? { message: "relation does not exist" }
              : null;
          return Promise.resolve({
            data: error ? null : selectedRows,
            error,
          }).then(onfulfilled);
        },
      };
      return query;
    },
    rpc(_functionName: string, args: Record<string, unknown>) {
      const weekStart = args.p_week_start;
      return Promise.resolve(
        rows.scheduleError
          ? { data: null, error: { message: "schedule_read_failed" } }
          : {
              data:
                (typeof weekStart === "string"
                  ? rows.scheduleSnapshots?.[weekStart]
                  : undefined) ??
                rows.scheduleSnapshot ?? { staff: [], shifts: [] },
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
