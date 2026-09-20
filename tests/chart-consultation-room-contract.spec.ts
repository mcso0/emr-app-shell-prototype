import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import {
  getConsultationCallRoomById,
  getConsultationCallRooms,
  parseConsultationCallRoomResponse,
} from "../src/features/chart/consultation-room-contract";
import type { WorkspaceSpaceManagementSnapshot } from "../src/features/hospital-admin/space-management/model";

const workspaceId = "clair-demo";
const consultationRoomMigrationPath =
  "supabase/migrations/20260920120000_chart_workspace_consultation_rooms.sql";
const consultationRoomMigration = existsSync(consultationRoomMigrationPath)
  ? readFileSync(consultationRoomMigrationPath, "utf8")
  : "";

const snapshot: WorkspaceSpaceManagementSnapshot = {
  workspaceId,
  canManage: false,
  categories: [
    {
      id: "category-treatment",
      name: "처치 공간",
      iconKey: "treatment",
      sortOrder: 1,
      spaces: [
        {
          id: "space-treatment-1",
          categoryId: "category-treatment",
          name: "처치실 1",
          sortOrder: 0,
        },
      ],
    },
    {
      id: "category-consult",
      name: "진료 공간",
      iconKey: "consult",
      sortOrder: 0,
      spaces: [
        {
          id: "space-consult-new",
          categoryId: "category-consult",
          name: "3진료실",
          sortOrder: 2,
        },
        {
          id: "space-consult-primary",
          categoryId: "category-consult",
          name: "1진료실",
          sortOrder: 0,
        },
      ],
    },
  ],
};

test("consultation call rooms come from the active workspace consult category", () => {
  expect(getConsultationCallRooms(snapshot)).toEqual([
    {
      id: "space-consult-primary",
      name: "1진료실",
      spaceType: "consultation_room",
      status: "active",
      isCallTarget: true,
      sortOrder: 0,
    },
    {
      id: "space-consult-new",
      name: "3진료실",
      spaceType: "consultation_room",
      status: "active",
      isCallTarget: true,
      sortOrder: 2,
    },
  ]);
  expect(getConsultationCallRoomById(snapshot, "space-consult-new")?.name).toBe(
    "3진료실",
  );
  expect(getConsultationCallRoomById(snapshot, "space-treatment-1")).toBeUndefined();

  const parsed = parseConsultationCallRoomResponse({
    workspaceId,
    rooms: getConsultationCallRooms(snapshot),
  });
  expect(parsed?.rooms.map((room) => room.id)).toEqual([
    "space-consult-primary",
    "space-consult-new",
  ]);
  expect(parseConsultationCallRoomResponse({
    workspaceId,
    rooms: [{ ...getConsultationCallRooms(snapshot)[0], status: "archived" }],
  })).toBeNull();
});

test("consultation call RPC resolves an active workspace consultation space", () => {
  expect(consultationRoomMigration).toContain(
    "create or replace function public.clair_call_consultation_queue",
  );
  expect(consultationRoomMigration).toContain("from public.workspace_spaces space");
  expect(consultationRoomMigration).toContain(
    "join public.workspace_space_categories category",
  );
  expect(consultationRoomMigration).toContain("category.icon_key = 'consult'");
  expect(consultationRoomMigration).toContain("space.archived_at is null");
  expect(consultationRoomMigration).toContain("category.archived_at is null");
  expect(consultationRoomMigration).toContain("v_resolved_room_id text");
  expect(consultationRoomMigration).toContain(
    "v_requested_room_id = any (array['room-consult-1', 'room-consult-2', 'room-cat', 'room-director'])",
  );
  expect(consultationRoomMigration).toContain(
    "'roomId', v_resolved_room_id",
  );
  expect(consultationRoomMigration).toContain("v_actor_user_id <> auth.uid()");
  expect(consultationRoomMigration).toContain(
    "private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')",
  );
  expect(
    consultationRoomMigration.match(/security definer\nset search_path = ''/g),
  ).toHaveLength(2);
  expect(consultationRoomMigration).toContain(
    "alter function public.clair_call_consultation_queue(text, text, uuid, text)\n  set search_path = ''",
  );
  expect(consultationRoomMigration).toContain("raise exception 'room_unavailable'");
  expect(consultationRoomMigration).not.toContain(
    "v_room_name := case p_room_id",
  );
});
