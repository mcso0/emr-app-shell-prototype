import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  FulfillmentQueueType,
  FulfillmentWorkItemStatus,
} from "@/features/fulfillment/server-fulfillment-work-item-core";
import type { PermissionId } from "@/types/emr-domain";

const pageSize = 20;
const cursorIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StaffAssignedWorkCursor = {
  id: string;
  requestedAt: string;
};

export type StaffAssignedWorkSourceItem = {
  createdAt: string;
  description?: string;
  encounterId: string;
  guardianName?: string;
  id: string;
  orderId: string;
  patientName?: string;
  queueType: FulfillmentQueueType;
  requestedByName?: string;
  status: FulfillmentWorkItemStatus;
  title: string;
};

export type StaffAssignedWorkItemsGateway = {
  listAssignedWorkItems(input: {
    cursor?: StaffAssignedWorkCursor;
    limit: number;
    userId: string;
    workspaceId: string;
  }): Promise<
    | {
        ok: true;
        items: StaffAssignedWorkSourceItem[];
        timezone: string;
      }
    | { ok: false; error: "db_read_failed" | "not_found" }
  >;
};

type SupabaseAssignedWorkQueryResult = {
  data: Array<Record<string, unknown>> | null;
  error: { message?: string } | null;
};

type SupabaseAssignedWorkQueryBuilder =
  PromiseLike<SupabaseAssignedWorkQueryResult> & {
    eq(column: string, value: string): SupabaseAssignedWorkQueryBuilder;
    in(column: string, values: string[]): SupabaseAssignedWorkQueryBuilder;
    limit(value: number): SupabaseAssignedWorkQueryBuilder;
    or(filters: string): SupabaseAssignedWorkQueryBuilder;
    order(
      column: string,
      options: { ascending: boolean },
    ): SupabaseAssignedWorkQueryBuilder;
    select(columns: string): SupabaseAssignedWorkQueryBuilder;
  };

export type SupabaseStaffAssignedWorkItemsClient = {
  from(table: string): SupabaseAssignedWorkQueryBuilder;
};

export type StaffAssignedWorkItem = {
  category: "lab" | "imaging" | "procedure" | "other";
  categoryLabel: string;
  description?: string;
  guardianName?: string;
  href: string | null;
  id: string;
  operatingDate: string;
  orderId: string;
  patientName?: string;
  queueType: FulfillmentQueueType;
  requestedAt: string;
  requestedByName?: string;
  status: FulfillmentWorkItemStatus;
  statusLabel: string;
  title: string;
};

export type StaffAssignedWorkItemsReadResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "staff-assigned-work-items-read";
      items: StaffAssignedWorkItem[];
      nextCursor: string | null;
      timezone: string;
    }
  | { ok: false; status: 400; error: "invalid_cursor" }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 404; error: "not_found" }
  | { ok: false; status: 500; error: "db_read_failed" };

export async function readStaffAssignedWorkItems({
  actorUserId,
  cursor,
  gateway,
  permissionAdapter,
  userId,
  workspaceId,
}: {
  actorUserId: string | null;
  cursor: string | null;
  gateway: StaffAssignedWorkItemsGateway;
  permissionAdapter: WorkspacePermissionAdapter;
  userId: string;
  workspaceId: string;
}): Promise<StaffAssignedWorkItemsReadResult> {
  const decodedCursor = decodeCursor(cursor);
  if (cursor && !decodedCursor) {
    return { ok: false, status: 400, error: "invalid_cursor" };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const source = await gateway.listAssignedWorkItems({
    ...(decodedCursor ? { cursor: decodedCursor } : {}),
    limit: pageSize + 1,
    userId,
    workspaceId,
  });
  if (!source.ok) {
    return source.error === "not_found"
      ? { ok: false, status: 404, error: "not_found" }
      : { ok: false, status: 500, error: "db_read_failed" };
  }

  if (!isValidTimezone(source.timezone)) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  const visibleItems = source.items.slice(0, pageSize);
  const hasNextPage = source.items.length > pageSize;
  const lastItem = visibleItems.at(-1);

  return {
    ok: true,
    status: 200,
    enforcedBy: "staff-assigned-work-items-read",
    items: visibleItems.map((item) => ({
      ...mapCategory(item.queueType),
      ...copyOptional("description", item.description),
      ...copyOptional("guardianName", item.guardianName),
      ...copyOptional("patientName", item.patientName),
      ...copyOptional("requestedByName", item.requestedByName),
      href: canNavigateToQueue(
        permission.effectivePermissionIds,
        item.queueType,
      )
        ? buildWorkItemHref({ item, workspaceId })
        : null,
      id: item.id,
      operatingDate: getOperatingDate(item.createdAt, source.timezone),
      orderId: item.orderId,
      queueType: item.queueType,
      requestedAt: item.createdAt,
      status: item.status,
      statusLabel: statusLabels[item.status],
      title: item.title,
    })),
    nextCursor:
      hasNextPage && lastItem
        ? encodeCursor({ id: lastItem.id, requestedAt: lastItem.createdAt })
        : null,
    timezone: source.timezone,
  };
}

export function createSupabaseStaffAssignedWorkItemsGateway(
  client: SupabaseStaffAssignedWorkItemsClient,
): StaffAssignedWorkItemsGateway {
  return {
    async listAssignedWorkItems({
      cursor,
      limit,
      userId,
      workspaceId,
    }) {
      try {
        const memberships = await readRows(
          client
            .from("user_memberships")
            .select("id, workspace_id, user_id, status")
            .eq("workspace_id", workspaceId)
            .eq("user_id", userId),
        );
        if (!memberships.some((row) => row.status === "active")) {
          return { ok: false, error: "not_found" };
        }

        const workspaces = await readRows(
          client
            .from("workspaces")
            .select("id, timezone")
            .eq("id", workspaceId),
        );
        const timezone = workspaces[0]?.timezone;
        if (typeof timezone !== "string" || !timezone.trim()) {
          return { ok: false, error: "db_read_failed" };
        }

        let query = client
          .from("order_fulfillment_work_items")
          .select(
            "id, workspace_id, encounter_id, order_id, queue_type, status, requested_by_user_id, assigned_to_user_id, source_snapshot, created_at",
          )
          .eq("workspace_id", workspaceId)
          .eq("assigned_to_user_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.requestedAt},and(created_at.eq.${cursor.requestedAt},id.lt.${cursor.id})`,
          );
        }
        const rows = await readRows(query);
        const requesterIds = [
          ...new Set(
            rows
              .map((row) => row.requested_by_user_id)
              .filter((value): value is string => typeof value === "string"),
          ),
        ];
        const requesters = requesterIds.length
          ? await readRows(
              client
                .from("users")
                .select("id, display_name")
                .in("id", requesterIds),
            )
          : [];
        const requesterNames = new Map(
          requesters.flatMap((row) =>
            typeof row.id === "string" && typeof row.display_name === "string"
              ? [[row.id, row.display_name.trim()] as const]
              : [],
          ),
        );

        return {
          ok: true,
          items: rows.map((row) =>
            mapSupabaseWorkItem(row, requesterNames),
          ),
          timezone: timezone.trim(),
        };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
  };
}

async function readRows(query: SupabaseAssignedWorkQueryBuilder) {
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "db_read_failed");
  return data ?? [];
}

function mapSupabaseWorkItem(
  row: Record<string, unknown>,
  requesterNames: ReadonlyMap<string, string>,
): StaffAssignedWorkSourceItem {
  const snapshot = asRecord(row.source_snapshot);
  const detail = asRecord(snapshot.detail);
  if (
    typeof row.id !== "string" ||
    typeof row.encounter_id !== "string" ||
    typeof row.order_id !== "string" ||
    !isQueueType(row.queue_type) ||
    !isFulfillmentStatus(row.status) ||
    typeof row.created_at !== "string" ||
    Number.isNaN(Date.parse(row.created_at)) ||
    typeof snapshot.orderDisplayName !== "string" ||
    !snapshot.orderDisplayName.trim()
  ) {
    throw new Error("invalid_work_item");
  }

  const requestedByName =
    typeof row.requested_by_user_id === "string"
      ? requesterNames.get(row.requested_by_user_id)
      : undefined;
  const standardOrderName =
    typeof detail.standardOrderName === "string" &&
    detail.standardOrderName.trim() !== snapshot.orderDisplayName.trim()
      ? detail.standardOrderName.trim()
      : undefined;

  return {
    createdAt: row.created_at,
    ...copySourceOptional("description", standardOrderName),
    encounterId: row.encounter_id,
    ...copySourceOptional("guardianName", snapshot.guardianName),
    id: row.id,
    orderId: row.order_id,
    ...copySourceOptional("patientName", snapshot.patientName),
    queueType: row.queue_type,
    ...copySourceOptional("requestedByName", requestedByName),
    status: row.status,
    title: snapshot.orderDisplayName.trim(),
  };
}

function copySourceOptional<
  TKey extends "description" | "guardianName" | "patientName" | "requestedByName",
>(
  key: TKey,
  value: unknown,
): Pick<StaffAssignedWorkSourceItem, TKey> | Record<string, never> {
  return typeof value === "string" && value.trim()
    ? ({ [key]: value.trim() } as Pick<StaffAssignedWorkSourceItem, TKey>)
    : {};
}

function isQueueType(value: unknown): value is FulfillmentQueueType {
  return (
    value === "lab" ||
    value === "imaging" ||
    value === "dispensing" ||
    value === "treatment"
  );
}

function isFulfillmentStatus(
  value: unknown,
): value is FulfillmentWorkItemStatus {
  return (
    value === "requested" ||
    value === "accepted" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "returned"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapCategory(queueType: FulfillmentQueueType): Pick<
  StaffAssignedWorkItem,
  "category" | "categoryLabel"
> {
  if (queueType === "lab") {
    return { category: "lab", categoryLabel: "임상병리" };
  }
  if (queueType === "imaging") {
    return { category: "imaging", categoryLabel: "영상검사" };
  }
  if (queueType === "dispensing") {
    return { category: "procedure", categoryLabel: "조제" };
  }
  if (queueType === "treatment") {
    return { category: "procedure", categoryLabel: "처치" };
  }
  return { category: "other", categoryLabel: "기타" };
}

const statusLabels: Record<FulfillmentWorkItemStatus, string> = {
  requested: "요청",
  accepted: "접수",
  in_progress: "진행 중",
  completed: "완료",
  cancelled: "취소",
  returned: "반려",
};

function canNavigateToQueue(
  permissionIds: PermissionId[],
  queueType: FulfillmentQueueType,
) {
  return permissionIds.includes(permissionForQueue(queueType));
}

function permissionForQueue(queueType: FulfillmentQueueType): PermissionId {
  if (queueType === "lab") return "lab:view";
  if (queueType === "imaging") return "imaging:view";
  return "dispensing:view";
}

function buildWorkItemHref({
  item,
  workspaceId,
}: {
  item: StaffAssignedWorkSourceItem;
  workspaceId: string;
}) {
  const params = new URLSearchParams({
    encounterId: item.encounterId,
    orderId: item.orderId,
    modulePanel: "open",
  });
  return `/w/${encodeURIComponent(workspaceId)}/${item.queueType}?${params.toString()}`;
}

function encodeCursor(cursor: StaffAssignedWorkCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string | null): StaffAssignedWorkCursor | null {
  if (!value || value.length > 512) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      typeof parsed.id !== "string" ||
      !cursorIdPattern.test(parsed.id) ||
      typeof parsed.requestedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.requestedAt))
    ) {
      return null;
    }
    return { id: parsed.id, requestedAt: parsed.requestedAt };
  } catch {
    return null;
  }
}

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function getOperatingDate(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_requested_at");
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function copyOptional<TKey extends "description" | "guardianName" | "patientName" | "requestedByName">(
  key: TKey,
  value: string | undefined,
): Pick<StaffAssignedWorkItem, TKey> | Record<string, never> {
  return value?.trim()
    ? ({ [key]: value.trim() } as Pick<StaffAssignedWorkItem, TKey>)
    : {};
}
