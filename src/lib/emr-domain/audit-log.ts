import type {
  AuditLogChange,
  AuditLogEvent,
  AuditLogMetadata,
  AuditLogSnapshot,
  BillingActionAuditLogEvent,
  BuildAuditLogEventInput,
  BuildBillingActionAuditLogInput,
  BuildOrderStatusChangeAuditLogInput,
  BuildProfileEditAuditLogInput,
  BuildSoapSaveAuditLogInput,
  BuildStatusTransitionAuditLogInput,
  OrderStatusChangeAuditLogEvent,
  ProfileEditAuditLogEvent,
  SoapSaveAuditLogEvent,
  StatusTransitionAuditLogEvent,
} from "@/types/audit-log";

const normalizeAuditLogIdPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const stableSerializeAuditValue = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerializeAuditValue(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerializeAuditValue(item)}`)
    .join(",")}}`;
};

const snapshotFromChanges = (
  changes: AuditLogChange[],
  valueKey: "before" | "after"
): AuditLogSnapshot | undefined => {
  if (changes.length === 0) return undefined;

  return changes.reduce<AuditLogSnapshot>((snapshot, change) => {
    snapshot[change.field] = change[valueKey];

    return snapshot;
  }, {});
};

export const buildAuditLogId = ({
  eventType,
  entityType,
  entityId,
  occurredAt,
}: Pick<AuditLogEvent, "eventType" | "entityType" | "entityId"> & {
  occurredAt: string;
}) =>
  [
    "audit",
    eventType,
    entityType,
    entityId,
    occurredAt ?? "",
  ]
    .map(normalizeAuditLogIdPart)
    .filter(Boolean)
    .join("-");

export const buildAuditLogChanges = (
  beforeValue: AuditLogSnapshot = {},
  afterValue: AuditLogSnapshot = {},
  fieldLabels: Record<string, string> = {}
): AuditLogChange[] => {
  const fields = Array.from(
    new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)])
  ).sort((left, right) => left.localeCompare(right));

  return fields
    .filter(
      (field) =>
        stableSerializeAuditValue(beforeValue[field]) !==
        stableSerializeAuditValue(afterValue[field])
    )
    .map((field) => ({
      field,
      label: fieldLabels[field],
      before: beforeValue[field],
      after: afterValue[field],
    }));
};

export function buildAuditLogEvent<
  EventType extends AuditLogEvent["eventType"],
  Action extends AuditLogEvent["action"],
  EntityType extends AuditLogEvent["entityType"],
  Metadata extends AuditLogMetadata,
>({
  id,
  eventType,
  action,
  entityType,
  entityId,
  workspaceId,
  actorUserId,
  patientId,
  guardianId,
  encounterId,
  occurredAt,
  reason,
  summary,
  changes = [],
  metadata,
}: BuildAuditLogEventInput<EventType, Action, EntityType, Metadata>) {
  return {
    id:
      id ??
      buildAuditLogId({
        eventType,
        entityType,
        entityId,
        occurredAt,
      }),
    workspaceId,
    actorUserId,
    action,
    entityType,
    entityId,
    patientId,
    guardianId,
    encounterId,
    summary,
    changes,
    beforeValue: snapshotFromChanges(changes, "before"),
    afterValue: snapshotFromChanges(changes, "after"),
    reason,
    createdAt: occurredAt,
    eventType,
    metadata: metadata ?? ({} as Metadata),
  };
}

export const appendAuditLogEvent = <Event extends AuditLogEvent>(
  events: readonly Event[],
  event: Event
) =>
  [...events, event].sort((left, right) => {
    const timeOrder = left.createdAt.localeCompare(right.createdAt);

    if (timeOrder !== 0) return timeOrder;

    return left.id.localeCompare(right.id);
  });

export const buildStatusTransitionAuditEvent = ({
  field = "status",
  beforeStatus,
  afterStatus,
  ...input
}: BuildStatusTransitionAuditLogInput): StatusTransitionAuditLogEvent =>
  buildAuditLogEvent({
    ...input,
    eventType: "status_transition",
    action: "status_change",
    changes: [
      {
        field,
        before: beforeStatus,
        after: afterStatus,
      },
    ],
    metadata: {
      field,
      fromStatus: beforeStatus,
      toStatus: afterStatus,
    },
  });

export const buildProfileEditAuditEvent = ({
  beforeValue,
  afterValue,
  fieldLabels,
  ...input
}: BuildProfileEditAuditLogInput): ProfileEditAuditLogEvent => {
  const changes = buildAuditLogChanges(beforeValue, afterValue, fieldLabels);

  return buildAuditLogEvent({
    ...input,
    eventType: "profile_edit",
    action: "update",
    changes,
    metadata: {
      editedFieldCount: changes.length,
    },
  });
};

export const buildSoapSaveAuditEvent = ({
  soapNoteId,
  saveMode,
  status,
  beforeValue = {},
  afterValue = {},
  fieldLabels,
  ...input
}: BuildSoapSaveAuditLogInput): SoapSaveAuditLogEvent =>
  buildAuditLogEvent({
    ...input,
    eventType: "soap_save",
    action: Object.keys(beforeValue).length === 0 ? "create" : "update",
    entityType: "soap_note",
    entityId: soapNoteId,
    changes: buildAuditLogChanges(beforeValue, afterValue, fieldLabels),
    metadata: {
      saveMode,
      status,
    },
  });

export const buildOrderStatusChangeAuditEvent = ({
  orderId,
  beforeStatus,
  afterStatus,
  orderType,
  ...input
}: BuildOrderStatusChangeAuditLogInput): OrderStatusChangeAuditLogEvent =>
  buildAuditLogEvent({
    ...input,
    eventType: "order_status_change",
    action: "status_change",
    entityType: "order",
    entityId: orderId,
    changes: [
      {
        field: "status",
        before: beforeStatus,
        after: afterStatus,
      },
    ],
    metadata: {
      fromStatus: beforeStatus,
      toStatus: afterStatus,
      orderType,
    },
  });

export const buildBillingActionAuditEvent = ({
  entityType,
  entityId,
  billingAction,
  action = billingAction === "refund_requested"
    ? "refund_request"
    : billingAction === "refund_approved"
      ? "refund_approve"
      : billingAction === "invoice_voided"
        ? "cancel"
        : "update",
  invoiceStatus,
  amount,
  beforeValue = {},
  afterValue = {},
  fieldLabels,
  ...input
}: BuildBillingActionAuditLogInput): BillingActionAuditLogEvent =>
  buildAuditLogEvent({
    ...input,
    eventType: "billing_action",
    action,
    entityType,
    entityId,
    changes: buildAuditLogChanges(beforeValue, afterValue, fieldLabels),
    metadata: {
      billingAction,
      invoiceStatus,
      amount,
    },
  });
