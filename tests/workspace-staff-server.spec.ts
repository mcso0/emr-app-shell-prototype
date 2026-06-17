import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseWorkspaceStaffReadGateway,
  readWorkspaceStaff,
} from "../src/features/staff/server-workspace-staff-core";

type SupabaseStaffClient = Parameters<
  typeof createSupabaseWorkspaceStaffReadGateway
>[0];

test("workspace staff read filters active same-workspace veterinarians", async () => {
  const gateway = createSupabaseWorkspaceStaffReadGateway({
    from(tableName: string) {
      if (tableName === "user_memberships") {
        return createSupabaseRows([
          {
            id: "membership-vet-suji",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000003",
            roles: ["vet"],
            department: "Medical",
            title: "수의사",
            status: "active",
          },
          {
            id: "membership-front-desk",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000005",
            roles: ["front_desk"],
            department: "Reception",
            title: "데스크",
            status: "active",
          },
          {
            id: "membership-vet-inactive",
            workspace_id: "workspace-clair-cheongdam",
            user_id: "49110000-0000-4000-8000-000000000006",
            roles: ["vet"],
            department: "Medical",
            title: "수의사",
            status: "inactive",
          },
        ]);
      }

      return createSupabaseRows([
        {
          id: "49110000-0000-4000-8000-000000000003",
          display_name: "이수지",
          initial: "이",
          status: "active",
        },
        {
          id: "49110000-0000-4000-8000-000000000005",
          display_name: "청담 데스크",
          initial: "데",
          status: "active",
        },
        {
          id: "49110000-0000-4000-8000-000000000006",
          display_name: "김도윤",
          initial: "김",
          status: "active",
        },
      ]);
    },
  } as unknown as SupabaseStaffClient);

  const result = await readWorkspaceStaff({
    actorUserId: "user-front-desk",
    workspaceId: "workspace-clair-cheongdam",
    role: "vet",
    gateway,
    permissionAdapter: createMockWorkspacePermissionAdapter({
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
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    staff: [
      {
        id: "49110000-0000-4000-8000-000000000003",
        displayName: "이수지",
        roles: ["vet"],
        status: "active",
      },
    ],
    enforcedBy: "workspace-staff-read",
  });
});

test("workspace staff read enforces reception view permission", async () => {
  const result = await readWorkspaceStaff({
    actorUserId: "user-missing",
    workspaceId: "workspace-clair-cheongdam",
    role: "vet",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-missing", status: "active" }],
      memberships: [],
    }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
});

function createSupabaseRows<Row>(rows: Row[]) {
  let filteredRows = rows;
  const query = {
    eq(column: string, value: string) {
      filteredRows = filteredRows.filter(
        (row) => (row as Record<string, unknown>)[column] === value,
      );
      return query;
    },
    in(column: string, values: string[]) {
      filteredRows = filteredRows.filter((row) =>
        values.includes((row as Record<string, string>)[column]),
      );
      return query;
    },
    select() {
      return query;
    },
    then(onfulfilled: (value: { data: Row[]; error: null }) => unknown) {
      return Promise.resolve({ data: filteredRows, error: null }).then(
        onfulfilled,
      );
    },
  };

  return query;
}
