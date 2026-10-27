import { getClinicalOrderFieldSchema } from "@/features/chart/order-execution-domain";
import type {
  InstructionDocument,
  InstructionItem,
} from "@/features/fulfillment/instruction-contract";

export type InstructionViewItem = {
  id: string;
  name: string;
  dose: string;
  doseUnit: string;
  frequency: string;
  days: string;
  total: string;
  totalUnit: string;
  route: string;
  medicationGuide: string;
  storage: string;
  note: string;
  status: InstructionItem["status"];
  assignees: string[];
  change: "added" | "modified" | "existing";
  canAssign: boolean;
  canComplete: boolean;
  canReopen: boolean;
  previous?: Partial<InstructionViewItem>;
};
export type InstructionViewOrder = {
  id: string;
  name: string;
  kind: "조제" | "처치";
  set: boolean;
  status: "requested" | "in_progress" | "completed" | "cancelled";
  items: InstructionViewItem[];
};
export type InstructionViewEvent = {
  id: string;
  orderId: string;
  at: string;
  actor: string;
  changes: { itemId: string; field: string; before: string; after: string }[];
};
export type InstructionViewAction = {
  type: "assign" | "toggle_complete";
  itemId?: string;
  assignees?: string[];
};

export function getInstructionStatusLabel(document: InstructionDocument) {
  if (document.finalized) return "완료";
  const active = document.items.filter((item) => item.status !== "cancelled");
  if (!active.length) return "취소";
  if (active.every((item) => item.status === "returned")) return "반려";
  if (active.every((item) => item.status === "requested")) return "대기중";
  if (active.every((item) => item.status === "paused")) return "일시중지";
  return "진행중";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value.every((item) => typeof item === "string"))
      return value.join(", ");
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    if (typeof value === "string" && value.trim()) return value;
  }
  return "—";
}

/** Display persisted values verbatim. Never infer a clinical dose or total. */
function displayFields(
  plan: Record<string, unknown>,
  source: Record<string, unknown>,
  note: string,
  queueType: "dispensing" | "treatment",
) {
  const inputs = record(plan.detailInputs ?? source.detailInputs);
  const calculation = record(
    plan.calculationOutputs ?? source.calculationOutputs,
  );
  const columnKeys = new Set([
    "dose",
    "doseUnit",
    "frequency",
    "durationDays",
    "totalQuantity",
    "totalQuantityUnit",
    "route",
    "administrationRoute",
    "medicationInstruction",
    "storageMethod",
  ]);
  const schema = getClinicalOrderFieldSchema(
    queueType,
    typeof plan.detailSchemaVersion === "number"
      ? plan.detailSchemaVersion
      : typeof source.detailSchemaVersion === "number"
        ? source.detailSchemaVersion
        : undefined,
  );
  const detailLines =
    schema?.fields
      .filter(
        (field) =>
          !columnKeys.has(field.key) && text(inputs[field.key]) !== "—",
      )
      .map((field) => `${field.label}: ${text(inputs[field.key])}`) ?? [];
  return {
    dose: text(inputs.dose),
    doseUnit: text(inputs.doseUnit),
    frequency: text(inputs.frequency),
    days: text(inputs.durationDays),
    total: text(
      inputs.totalQuantity,
      calculation.plannedPracticalTotalQuantity,
      calculation.totalRequiredDispenseQuantity,
    ),
    totalUnit: text(inputs.totalQuantityUnit, calculation.dispenseUnit),
    route: text(inputs.route, inputs.administrationRoute),
    medicationGuide: text(inputs.medicationInstruction),
    storage: text(inputs.storageMethod),
    note: [note, ...detailLines].filter(Boolean).join("\n"),
  };
}
const fields = [
  "dose",
  "doseUnit",
  "frequency",
  "days",
  "total",
  "totalUnit",
  "route",
  "medicationGuide",
  "storage",
  "note",
] as const;

export function createInstructionView(document: InstructionDocument) {
  const names: Record<string, string> = {};
  const events: InstructionViewEvent[] = [];
  const orderedChanges = [...document.changes].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const items = document.items.map((item): InstructionViewItem => {
    if (item.assigneeId) names[item.assigneeId] = item.assigneeName ?? "담당자";
    const current = displayFields(
      item.plan,
      item.sourceSnapshot,
      item.instruction,
      document.queueType,
    );
    const previous: Partial<InstructionViewItem> = {};
    for (const change of orderedChanges.filter(
      (change) => change.orderId === item.orderId,
    )) {
      const before = displayFields(
        change.before,
        {},
        text(change.before.instruction) === "—"
          ? ""
          : text(change.before.instruction),
        document.queueType,
      );
      const after = displayFields(
        change.after,
        {},
        text(change.after.instruction) === "—"
          ? ""
          : text(change.after.instruction),
        document.queueType,
      );
      const changes = fields
        .filter((field) => before[field] !== after[field])
        .map((field) => {
          // Show the latest actual change for each field, even after several edits.
          if (after[field] === current[field]) previous[field] = before[field];
          else delete previous[field];
          return {
            itemId: item.id,
            field,
            before: before[field],
            after: after[field],
          };
        });
      if (changes.length) {
        names[change.id] = change.actorName ?? "작성자 정보 없음";
        events.push({
          id: change.id,
          orderId: document.rootOrderId,
          at: change.createdAt,
          actor: change.id,
          changes,
        });
      }
    }
    return {
      ...current,
      id: item.id,
      name: item.name,
      status: item.status,
      assignees: item.assigneeId ? [item.assigneeId] : [],
      change: Object.keys(previous).length
        ? "modified"
        : item.attemptNo === 1 && item.status === "requested"
          ? "added"
          : "existing",
      canAssign: item.canAssign,
      canComplete: item.canComplete,
      canReopen: item.canReopen,
      previous,
    };
  });
  if (document.isSet)
    for (const change of orderedChanges.filter(
      (change) =>
        change.orderId === document.rootOrderId &&
        "instruction" in change.after,
    )) {
      names[change.id] = change.actorName ?? "작성자 정보 없음";
      events.push({
        id: change.id,
        orderId: document.rootOrderId,
        at: change.createdAt,
        actor: change.id,
        changes: [
          {
            itemId: document.rootOrderId,
            field: "instruction",
            before: String(change.before.instruction ?? ""),
            after: String(change.after.instruction ?? ""),
          },
        ],
      });
    }
  const order: InstructionViewOrder = {
    id: document.rootOrderId,
    name: document.name,
    kind: document.queueType === "dispensing" ? "조제" : "처치",
    set: document.isSet,
    status: document.finalized
      ? "completed"
      : items.every((item) => item.status === "cancelled")
        ? "cancelled"
        : "in_progress",
    items,
  };
  return { orders: [order], events, names };
}
