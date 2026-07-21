import { expect, test } from "@playwright/test";
import {
  parseHospitalScheduleRevisionCommand,
  toRevisionRpcArgs,
} from "@/features/hospital-admin/schedule/revision-api";

const revisionId = "2af8c8f5-2ee8-42b0-9f12-f2c40a1f5e8a";
const staffProfileId = "1af8c8f5-2ee8-42b0-9f12-f2c40a1f5e8a";

test("v2 mutation parser requires a revision version and a normalized entry payload", () => {
  const command = parseHospitalScheduleRevisionCommand({
    type: "save_work_block",
    revisionId,
    expectedLockVersion: 3,
    workBlock: {
      id: null,
      staffProfileId,
      shiftDate: "2026-07-21",
      startMinutes: 540,
      endMinutes: 720,
      workKind: "clinical",
      workLabelSnapshot: " 진료 ",
      locationLabelSnapshot: "진료실 1",
      privateNote: null,
    },
  });

  expect(command).toMatchObject({
    type: "save_work_block",
    revisionId,
    expectedLockVersion: 3,
    workBlock: { id: null, workLabelSnapshot: "진료" },
  });
  expect(
    parseHospitalScheduleRevisionCommand({
      type: "save_work_block",
      revisionId,
      expectedLockVersion: 0,
      workBlock: {},
    }),
  ).toBeNull();
});

test("v2 RPC args include revision locking and idempotency keys", () => {
  const command = parseHospitalScheduleRevisionCommand({
    type: "delete_entry",
    revisionId,
    expectedLockVersion: 4,
    entryKind: "work_block",
    entryId: "3af8c8f5-2ee8-42b0-9f12-f2c40a1f5e8a",
  });
  expect(command).not.toBeNull();
  if (!command) return;

  expect(
    toRevisionRpcArgs({
      command,
      workspaceId: "workspace-clair-cheongdam",
      idempotencyKey: "schedule-v2-test-key",
    }),
  ).toEqual({
    functionName: "hospital_schedule_delete_entry_v2",
    args: {
      p_workspace_id: "workspace-clair-cheongdam",
      p_idempotency_key: "schedule-v2-test-key",
      p_revision_id: revisionId,
      p_expected_lock_version: 4,
      p_entry_kind: "work_block",
      p_entry_id: "3af8c8f5-2ee8-42b0-9f12-f2c40a1f5e8a",
    },
  });
});
