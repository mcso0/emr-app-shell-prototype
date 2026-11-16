import { getClinicalOrderFieldSchema } from "@/features/chart/order-execution-domain";
import { formatPlanOrderTableUnit } from "@/features/chart/chart-order-table-presentation";
import { getDispenseRequestCourseQuantity, getDispenseRequestUnit } from "@/features/chart/dispense-request-quantity";
import type {
  InstructionDocument,
  InstructionItem,
} from "@/features/fulfillment/instruction-contract";

import type { DispensingOrderChange, TaskInstructionReview } from "@/features/fulfillment/task-instruction-review-contract";

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
  planSummary?: string;
  setInstruction?: string;
  hasExecution?: boolean;
  hasResult?: boolean;
  status: InstructionItem["status"];
  assignees: string[];
  change: "added" | "modified" | "existing";
  canAssign: boolean;
  canComplete: boolean;
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
  type: "assign" | "complete";
  itemId?: string;
  assignees?: string[];
};

export function isPendingFulfillmentRerequest(
  status: InstructionItem["status"],
  attemptNo: number,
  assigneeId?: string | null,
) {
  return attemptNo > 1 && (status === "requested" || (status === "paused" && !assigneeId));
}

export function hasPendingInstructionRerequest(document: InstructionDocument) {
  return document.items.some((item) => isPendingFulfillmentRerequest(item.status, item.attemptNo, item.assigneeId));
}

export function isWaitingInstruction(document: InstructionDocument) {
  if (document.finalized || !document.items.length) return false;
  if (document.items.every((item) => item.status === "requested")) return true;
  if (document.mainAssigneeId) return false;

  const unfinished = document.items.filter(
    (item) => !["completed", "cancelled", "returned"].includes(item.status),
  );
  return unfinished.some((item) => item.status === "paused") &&
    unfinished.every((item) => !item.assigneeId && (item.status === "requested" || item.status === "paused"));
}

export function getInstructionStatusLabel(document: InstructionDocument) {
  if (document.finalized) return "완료";
  if (hasPendingInstructionRerequest(document)) return "재요청";
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

/** Display saved instructions and the canonical course request. */
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
  const requestQuantity = queueType === "dispensing" ? getDispenseRequestCourseQuantity(calculation) : null;
  const requestUnit = requestQuantity === null ? null : getDispenseRequestUnit(calculation);
  // Explicit instructions, memos and treatment quantities belong here. Internal
  // calculation selectors and identifiers stay in the persisted plan.
  const instructionKeys = new Set(queueType === "dispensing"
    ? ["taperSchedule", "compoundNote", "guardianNote"]
    : ["method", "site", "schedule", "plannedRoute", "deviceProtocol",
      "observationDomains", "stagedInstructions", "exceptions", "administeredAmount",
      "plannedProcedureCount", "procedureCountUnit", "plannedAmount", "plannedAmountUnit",
      "measurementUnit", "administrationPolicy", "productReference"]);
  const schema = getClinicalOrderFieldSchema(
    queueType,
    typeof plan.detailSchemaVersion === "number"
      ? plan.detailSchemaVersion
      : typeof source.detailSchemaVersion === "number"
        ? source.detailSchemaVersion
        : undefined,
  );
  const valueLabels: Record<string, Record<string, string>> = {
    procedureCountUnit: { session: "회", site: "부위", tooth: "치아", specimen: "검체", load: "적재 회차" },
    administrationPolicy: { not_applicable: "해당 없음", separate_medication_order: "별도 약품 오더 연결", direct_quantity: "재료·용액 사용량 직접 계획" },
  };
  const detailLines =
    schema?.fields
      .filter(
        (field) =>
          instructionKeys.has(field.key) && text(inputs[field.key]) !== "—",
      )
      .map((field) => `${field.label}: ${valueLabels[field.key]?.[text(inputs[field.key])] ?? text(inputs[field.key])}`) ?? [];
  return {
    dose: text(inputs.dose),
    doseUnit: text(inputs.doseUnit),
    frequency: text(inputs.frequency),
    days: text(inputs.durationDays),
    total: text(
      requestQuantity,
      inputs.totalQuantity,
      calculation.plannedPracticalTotalQuantity,
      calculation.totalRequiredDispenseQuantity,
    ),
    totalUnit: text(formatPlanOrderTableUnit(requestUnit), inputs.totalQuantityUnit, calculation.dispenseUnit),
    route: text(inputs.route, inputs.administrationRoute),
    medicationGuide: text(inputs.medicationInstruction),
    storage: text(inputs.storageMethod),
    planSummary: detailLines[0],
    note: [note.trim() ? `오더별 지시: ${note}` : "", ...detailLines].filter(Boolean).join("\n"),
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
      setInstruction: document.isSet ? document.instruction : undefined,
      hasExecution: item.resultRequired || item.hasResult,
      hasResult: item.hasResult,
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

const routeLabels: Record<string, string> = {
  PO: "경구",
  topical: "외용",
  ophthalmic: "점안",
  otic: "점이",
};
const storageLabels: Record<string, string> = {
  room_temp: "실온",
  room_temp_light_protected: "실온·차광",
  refrigerated: "냉장",
  refrigerated_light_protected: "냉장·차광",
};

export const formatInstructionValue = (k: string, v: unknown) =>
    k === "medicationGuide"
      ? {
          before_meal: "식전",
          after_meal: "식후",
          with_meal: "식사와 함께",
          any_time: "시간 무관",
        }[String(v)] || String(v)
      : k === "route"
        ? routeLabels[String(v)] || String(v)
        : k === "storage"
          ? storageLabels[String(v)] || String(v)
          : String(v ?? "없음");

const dispensingChangeLabels: Record<string, string> = {
  dose: "1회 용량",
  doseUnit: "용량 단위",
  instruction: "지시",
  memo: "메모",
  administrationTiming: "복용 시점",
  totalOccurrences: "총 시행 횟수",
  maximumAuthorizedCount: "최대 허용 횟수",
};

function dispensingChangeValue(field: string, value: unknown) {
  if (typeof value === "boolean") return value ? "예" : "아니요";
  const formatted = text(value);
  if (formatted === "—" && value && typeof value === "object") return JSON.stringify(value);
  const displayField = field === "medicationInstruction" ? "medicationGuide" : field === "storageMethod" ? "storage" : field;
  return formatInstructionValue(displayField, formatted);
}

export function getDispensingRerequestChanges(document: InstructionDocument, reviews: TaskInstructionReview[]) {
  const result = new Map<string, DispensingOrderChange | null>();
  if (document.queueType !== "dispensing") return result;

  for (const item of document.items) {
    if (item.attemptNo < 2) continue;
    const review = reviews.find(review => review.taskId === item.taskId);
    const entry = review?.current?.entries.find(entry => entry.kind === "clinical_edit" && entry.orderId === item.orderId);
    if (!entry || entry.deleted) continue;
    result.set(item.taskId, null);
    if (!entry.createdAt) continue;

    // The two records of a confirmed edit share the transaction timestamp.
    // Keep the original review when the latest re-request cannot be matched uniquely.
    const revisions = document.changes.filter(change => change.orderId === item.orderId && change.changeType === "re_request");
    const revision = revisions.at(-1);
    if (revision?.createdAt !== entry.createdAt ||
        revisions.filter(change => change.createdAt === entry.createdAt).length !== 1) continue;

    const reasonSeparator = "\n사유: ";
    const reasonIndex = entry.instruction.indexOf(reasonSeparator);
    if (reasonIndex < 0 || reasonIndex !== entry.instruction.lastIndexOf(reasonSeparator)) continue;
    const reason = entry.instruction.slice(reasonIndex + reasonSeparator.length);
    if (!reason.trim()) continue;

    const before = displayFields(revision.before, {}, "", "dispensing");
    const after = displayFields(revision.after, {}, "", "dispensing");
    const beforeInputs = record(revision.before.detailInputs);
    const afterInputs = record(revision.after.detailInputs);
    const schemaVersion = revision.after.detailSchemaVersion ?? revision.before.detailSchemaVersion;
    const schema = getClinicalOrderFieldSchema("dispensing", typeof schemaVersion === "number" ? schemaVersion : undefined);
    const keys = new Set([...Object.keys(beforeInputs), ...Object.keys(afterInputs)]);
    const fields: DispensingOrderChange["fields"] = [];

    const add = (key: string, label: string, before: string, after: string) => {
      if (before !== after) fields.push({ key, label, before, after });
    };
    const quantity = ({ total, totalUnit }: typeof before) =>
      total === "—" || totalUnit === "—" ? total : `${total} ${totalUnit}`;
    add("frequency", "복용 주기", before.frequency, after.frequency);
    add("requestQuantity", "요청 조제량", quantity(before), quantity(after));
    keys.delete("frequency");
    if (before.total === text(beforeInputs.totalQuantity) && after.total === text(afterInputs.totalQuantity)) keys.delete("totalQuantity");
    if (before.totalUnit === text(formatPlanOrderTableUnit(text(beforeInputs.totalQuantityUnit))) &&
        after.totalUnit === text(formatPlanOrderTableUnit(text(afterInputs.totalQuantityUnit)))) keys.delete("totalQuantityUnit");

    for (const key of keys) {
      const label = Object.hasOwn(dispensingChangeLabels, key)
        ? dispensingChangeLabels[key]
        : schema?.fields.find(field => field.key === key)?.label ?? "기타 업무 항목";
      add(key, label, dispensingChangeValue(key, beforeInputs[key]), dispensingChangeValue(key, afterInputs[key]));
    }
    const mode = (plan: Record<string, unknown>) =>
      record(plan.calculationOutputs).actualDispenseSource === "manual_override" ? "수동 지정" : "자동 계산";
    add("requestMode", "조제량 입력 방식", mode(revision.before), mode(revision.after));

    if (fields.length) result.set(item.taskId, { entry, orderName: item.name || document.name, reason, fields });
  }
  return result;
}
