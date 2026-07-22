import type {
  HospitalScheduleNonWorkEntry,
  HospitalScheduleWorkBlock,
} from "./revision-types";

export type HospitalScheduleRevisionCommand =
  | {
      type: "create_draft";
      weekStart: string;
      sourceRevisionId: string | null;
    }
  | {
      type: "validate_revision";
      revisionId: string;
      expectedLockVersion: number;
    }
  | {
      type: "save_work_block";
      revisionId: string;
      expectedLockVersion: number;
      workBlock: HospitalScheduleWorkBlockInput;
    }
  | {
      type: "save_non_work_entry";
      revisionId: string;
      expectedLockVersion: number;
      nonWorkEntry: HospitalScheduleNonWorkEntryInput;
    }
  | {
      type: "apply_fixed_week";
      revisionId: string;
      expectedLockVersion: number;
      weekdays: number[];
      startMinutes: number;
      endMinutes: number;
      roles: Array<"veterinarian" | "technician" | "reception">;
    }
  | {
      type: "delete_entry";
      revisionId: string;
      expectedLockVersion: number;
      entryKind: "work_block" | "non_work_entry";
      entryId: string;
    }
  | {
      type: "discard_draft";
      revisionId: string;
      expectedLockVersion: number;
    }
  | {
      type: "publish_revision";
      revisionId: string;
      expectedLockVersion: number;
    };

export type HospitalScheduleWorkBlockInput = Omit<HospitalScheduleWorkBlock, "id"> & {
  id: string | null;
};

export type HospitalScheduleNonWorkEntryInput = Omit<HospitalScheduleNonWorkEntry, "id"> & {
  id: string | null;
};

export type HospitalScheduleRevisionRpcClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

export type HospitalScheduleRevisionRpcFailure = Error & {
  code?: string;
};

export function parseHospitalScheduleRevisionCommand(
  value: unknown,
): HospitalScheduleRevisionCommand | null {
  const record = asRecord(value);

  switch (record.type) {
    case "create_draft":
      return isIsoDate(record.weekStart) && isNullableUuid(record.sourceRevisionId)
        ? {
            type: "create_draft",
            weekStart: record.weekStart,
            sourceRevisionId: record.sourceRevisionId,
          }
        : null;
    case "validate_revision":
    case "discard_draft":
    case "publish_revision":
      return isUuid(record.revisionId) && isLockVersion(record.expectedLockVersion)
        ? {
            type: record.type,
            revisionId: record.revisionId,
            expectedLockVersion: record.expectedLockVersion,
          }
        : null;
    case "save_work_block": {
      const workBlock = parseWorkBlock(record.workBlock);
      return isUuid(record.revisionId) && isLockVersion(record.expectedLockVersion) && workBlock
        ? {
            type: "save_work_block",
            revisionId: record.revisionId,
            expectedLockVersion: record.expectedLockVersion,
            workBlock,
          }
        : null;
    }
    case "save_non_work_entry": {
      const nonWorkEntry = parseNonWorkEntry(record.nonWorkEntry);
      return isUuid(record.revisionId) && isLockVersion(record.expectedLockVersion) && nonWorkEntry
        ? {
            type: "save_non_work_entry",
            revisionId: record.revisionId,
            expectedLockVersion: record.expectedLockVersion,
            nonWorkEntry,
          }
        : null;
    }
    case "apply_fixed_week":
      return (
        isUuid(record.revisionId) &&
        isLockVersion(record.expectedLockVersion) &&
        isWeekdayList(record.weekdays) &&
        isMinute(record.startMinutes) &&
        isMinute(record.endMinutes) &&
        record.endMinutes > record.startMinutes &&
        isRoleList(record.roles)
      )
        ? {
            type: "apply_fixed_week",
            revisionId: record.revisionId,
            expectedLockVersion: record.expectedLockVersion,
            weekdays: record.weekdays,
            startMinutes: record.startMinutes,
            endMinutes: record.endMinutes,
            roles: record.roles,
          }
        : null;
    case "delete_entry":
      return (
        isUuid(record.revisionId) &&
        isLockVersion(record.expectedLockVersion) &&
        (record.entryKind === "work_block" || record.entryKind === "non_work_entry") &&
        isUuid(record.entryId)
      )
        ? {
            type: "delete_entry",
            revisionId: record.revisionId,
            expectedLockVersion: record.expectedLockVersion,
            entryKind: record.entryKind,
            entryId: record.entryId,
          }
        : null;
    default:
      return null;
  }
}

export async function executeHospitalScheduleRevisionCommand({
  client,
  command,
  idempotencyKey,
  workspaceId,
}: {
  client: HospitalScheduleRevisionRpcClient;
  command: HospitalScheduleRevisionCommand;
  idempotencyKey: string;
  workspaceId: string;
}) {
  const { functionName, args } = toRevisionRpcArgs({
    command,
    idempotencyKey,
    workspaceId,
  });
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw toRevisionRpcFailure(error);
  return data;
}

export function toRevisionRpcArgs({
  command,
  idempotencyKey,
  workspaceId,
}: {
  command: HospitalScheduleRevisionCommand;
  idempotencyKey: string;
  workspaceId: string;
}) {
  const base = {
    p_workspace_id: workspaceId,
    p_idempotency_key: idempotencyKey,
  };

  switch (command.type) {
    case "create_draft":
      return {
        functionName: "hospital_schedule_create_draft_v2",
        args: {
          ...base,
          p_week_start: command.weekStart,
          p_source_revision_id: command.sourceRevisionId,
        },
      };
    case "validate_revision":
      return {
        functionName: "hospital_schedule_validate_revision_v2",
        args: {
          ...base,
          p_revision_id: command.revisionId,
          p_expected_lock_version: command.expectedLockVersion,
        },
      };
    case "save_work_block":
      return {
        functionName: "hospital_schedule_save_work_block_v2",
        args: {
          ...base,
          p_revision_id: command.revisionId,
          p_expected_lock_version: command.expectedLockVersion,
          p_payload: {
            id: command.workBlock.id,
            staffProfileId: command.workBlock.staffProfileId,
            shiftDate: command.workBlock.shiftDate,
            startMinutes: command.workBlock.startMinutes,
            endMinutes: command.workBlock.endMinutes,
            workKind: command.workBlock.workKind,
            workLabelSnapshot: command.workBlock.workLabelSnapshot,
            locationLabelSnapshot: command.workBlock.locationLabelSnapshot,
            privateNote: command.workBlock.privateNote,
          },
        },
      };
    case "save_non_work_entry":
      return {
        functionName: "hospital_schedule_save_non_work_entry_v2",
        args: {
          ...base,
          p_revision_id: command.revisionId,
          p_expected_lock_version: command.expectedLockVersion,
          p_payload: {
            id: command.nonWorkEntry.id,
            staffProfileId: command.nonWorkEntry.staffProfileId,
            entryDate: command.nonWorkEntry.entryDate,
            entryKind: command.nonWorkEntry.entryKind,
            leaveSubtype: command.nonWorkEntry.leaveSubtype,
            startMinutes: command.nonWorkEntry.startMinutes,
            endMinutes: command.nonWorkEntry.endMinutes,
            privateNote: command.nonWorkEntry.privateNote,
          },
        },
      };
    case "apply_fixed_week":
      return {
        functionName: "hospital_schedule_apply_fixed_week_v2",
        args: {
          ...base,
          p_revision_id: command.revisionId,
          p_expected_lock_version: command.expectedLockVersion,
          p_weekdays: command.weekdays,
          p_start_minutes: command.startMinutes,
          p_end_minutes: command.endMinutes,
          p_roles: command.roles,
        },
      };
    case "delete_entry":
      return {
        functionName: "hospital_schedule_delete_entry_v2",
        args: {
          ...base,
          p_revision_id: command.revisionId,
          p_expected_lock_version: command.expectedLockVersion,
          p_entry_kind: command.entryKind,
          p_entry_id: command.entryId,
        },
      };
    case "discard_draft":
      return {
        functionName: "hospital_schedule_discard_draft_v2",
        args: {
          ...base,
          p_revision_id: command.revisionId,
          p_expected_lock_version: command.expectedLockVersion,
        },
      };
    case "publish_revision":
      return {
        functionName: "hospital_schedule_publish_revision_v2",
        args: {
          ...base,
          p_revision_id: command.revisionId,
          p_expected_lock_version: command.expectedLockVersion,
        },
      };
  }
}

export function toRevisionRpcFailure(error: { code?: string; message?: string }) {
  const failure = new Error(error.message ?? error.code ?? "schedule_revision_rpc_failed") as HospitalScheduleRevisionRpcFailure;
  failure.code = error.code;
  return failure;
}

function parseWorkBlock(value: unknown): HospitalScheduleWorkBlockInput | null {
  const record = asRecord(value);
  if (
    !isNullableUuid(record.id) ||
    !isNullableUuid(record.staffProfileId) ||
    !isIsoDate(record.shiftDate) ||
    !isMinute(record.startMinutes) ||
    !isMinute(record.endMinutes) ||
    record.endMinutes <= record.startMinutes ||
    (record.workKind !== "clinical" && record.workKind !== "support" && record.workKind !== "reception") ||
    !isText(record.workLabelSnapshot, 80)
  ) {
    return null;
  }
  return {
    id: record.id,
    staffProfileId: record.staffProfileId,
    shiftDate: record.shiftDate,
    startMinutes: record.startMinutes,
    endMinutes: record.endMinutes,
    workKind: record.workKind,
    workLabelSnapshot: record.workLabelSnapshot.trim(),
    locationLabelSnapshot: isOptionalText(record.locationLabelSnapshot)
      ? record.locationLabelSnapshot
      : null,
    privateNote: isOptionalText(record.privateNote) ? record.privateNote : null,
  };
}

function parseNonWorkEntry(value: unknown): HospitalScheduleNonWorkEntryInput | null {
  const record = asRecord(value);
  if (
    !isNullableUuid(record.id) ||
    !isUuid(record.staffProfileId) ||
    !isIsoDate(record.entryDate) ||
    (record.entryKind !== "leave" && record.entryKind !== "off") ||
    !isNullableMinute(record.startMinutes) ||
    !isNullableMinute(record.endMinutes) ||
    !isOptionalText(record.privateNote)
  ) {
    return null;
  }
  if ((record.startMinutes === null) !== (record.endMinutes === null)) return null;
  if (
    record.startMinutes !== null &&
    record.endMinutes !== null &&
    record.endMinutes <= record.startMinutes
  ) {
    return null;
  }
  if (
    record.entryKind === "off" &&
    (record.startMinutes !== null || record.endMinutes !== null || record.leaveSubtype !== null)
  ) {
    return null;
  }
  if (
    record.entryKind === "leave" &&
    record.leaveSubtype !== null &&
    record.leaveSubtype !== "annual" &&
    record.leaveSubtype !== "same_day"
  ) {
    return null;
  }
  return {
    id: record.id,
    staffProfileId: record.staffProfileId,
    entryDate: record.entryDate,
    entryKind: record.entryKind,
    leaveSubtype:
      record.entryKind === "leave" &&
      (record.leaveSubtype === "annual" || record.leaveSubtype === "same_day")
        ? record.leaveSubtype
        : null,
    startMinutes: record.entryKind === "leave" ? record.startMinutes : null,
    endMinutes: record.entryKind === "leave" ? record.endMinutes : null,
    privateNote: record.privateNote,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isNullableUuid(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

function isLockVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1440;
}

function isNullableMinute(value: unknown): value is number | null {
  return value === null || isMinute(value);
}

function isWeekdayList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 7 &&
    new Set(value).size === value.length &&
    value.every((weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7)
  );
}

function isRoleList(
  value: unknown,
): value is Array<"veterinarian" | "technician" | "reception"> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 3 &&
    new Set(value).size === value.length &&
    value.every(
      (role) => role === "veterinarian" || role === "technician" || role === "reception",
    )
  );
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isOptionalText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
