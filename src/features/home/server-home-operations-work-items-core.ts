import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  createMockInvoiceCandidateSyncGateway,
  type BillingInvoiceCandidateLine,
  type InvoiceCandidateSyncGateway,
} from "@/features/billing/server-invoice-candidate-sync-core";
import {
  createMockFulfillmentWorkItemGateway,
  type FulfillmentQueueType,
  type FulfillmentWorkItem,
} from "@/features/fulfillment/server-fulfillment-work-item-core";
import {
  createMockReceptionCalendarReadGateway,
} from "@/features/reception/server-reception-calendar-read-core";
import type { ReceptionCalendarReadRecord } from "@/features/reception/reception-calendar-read";
import { getWorkspaceOperatingDate, isIsoOperatingDate } from "@/lib/emr-domain/demo-date";
import {
  mockEncounters,
  mockGuardians,
  mockInvoices,
  mockPatients,
} from "@/mocks/emr-domain";
import type { PermissionId } from "@/types/emr-domain";
import type { Encounter, Invoice } from "@/types/emr-domain";
import type { WorkspaceStaffReadGateway } from "@/features/staff/server-workspace-staff-core";
import type {
  HomeOperationsAccessIssue,
  HomeOperationsAttentionSignal,
  HomeOperationsProgressState,
  HomeOperationsSourceType,
  HomeOperationsSummary,
  HomeOperationsWorkItem,
  HomeOperationsWorkItemsResponse,
} from "@/features/home/home.types";

export type HomeOperationsScope = "all" | "mine";

export type HomeOperationsWorkItemFilters = {
  date?: string | null;
  includeCancelled?: boolean;
  includeCompleted?: boolean;
  scope?: string | null;
};

export type HomeOperationsGatewayResult =
  | {
      ok: true;
      generatedAt: string;
      items: HomeOperationsWorkItem[];
      sourceStatus: "empty" | "live" | "partial";
      accessIssues?: HomeOperationsAccessIssue[];
      currentPatients?: { present: number; waiting: number; inProgress: number } | null;
    }
  | {
      ok: false;
      error: "db_read_failed";
      retryable?: boolean;
    };

export type HomeOperationsWorkItemGateway = {
  listHomeOperationsWorkItems(input: {
    actorUserId: string;
    allowedSourceTypes: HomeOperationsSourceType[];
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    scope: HomeOperationsScope;
    workspaceId: string;
  }): Promise<HomeOperationsGatewayResult>;
};

export type HomeOperationsWorkItemReadResult =
  | (Extract<HomeOperationsWorkItemsResponse, { ok: true }> & {
      enforcedBy: "home-operations-work-items";
      status: 200;
    })
  | (Extract<HomeOperationsWorkItemsResponse, { ok: false }> & {
      status: 400 | 401 | 403 | 500;
    });

const sourceTypes: HomeOperationsSourceType[] = [
  "reception",
  "appointment",
  "consultation",
  "lab",
  "imaging",
  "dispensing",
  "treatment",
  "billing",
  "inpatient",
];

const progressStates: HomeOperationsProgressState[] = [
  "waiting",
  "in_progress",
  "completed",
  "cancelled",
];

const attentionSignals: HomeOperationsAttentionSignal[] = [
  "urgent",
  "re_requested",
  "assignment_missing",
  "team_queue",
  "long_stay",
];

const fulfillmentQueueTypes: FulfillmentQueueType[] = [
  "lab",
  "imaging",
  "dispensing",
  "treatment",
];

export async function readHomeOperationsWorkItems({
  actorUserId,
  filters,
  gateway,
  permissionAdapter = createMockWorkspacePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  filters: HomeOperationsWorkItemFilters;
  gateway?: HomeOperationsWorkItemGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<HomeOperationsWorkItemReadResult> {
  const operatingDate = normalizeOperatingDate(filters.date, workspaceId);
  if (!operatingDate) {
    return buildErrorResponse({
      code: "invalid_operating_date",
      message: "운영일 형식이 올바르지 않습니다.",
      operatingDate: getWorkspaceOperatingDate(workspaceId),
      retryable: false,
      sourceStatus: "error",
      status: 400,
      workspaceId,
    });
  }

  const scope = normalizeScope(filters.scope);
  if (!scope) {
    return buildErrorResponse({
      code: "invalid_scope",
      message: "업무 범위 값이 올바르지 않습니다.",
      operatingDate,
      retryable: false,
      sourceStatus: "error",
      status: 400,
      workspaceId,
    });
  }

  const boardPermission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "reception:view",
  });
  if (!boardPermission.allowed) {
    return buildPermissionDeniedResponse({
      denialReason: boardPermission.denialReason,
      operatingDate,
      workspaceId,
    });
  }

  if (!gateway || !actorUserId) {
    return buildErrorResponse({
      code: "supabase_client_missing",
      message: "원내 현황 데이터를 읽을 서버 연결이 없습니다.",
      operatingDate,
      retryable: true,
      sourceStatus: "error",
      status: 500,
      workspaceId,
    });
  }

  const allowedSourceTypes = sourceTypes.filter((sourceType) => {
    const requiredPermission = getProcessPermissionForSource(sourceType);
    return requiredPermission !== null && resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: actorUserId, workspaceId, requiredPermission,
    }).allowed;
  });
  const result = await gateway.listHomeOperationsWorkItems({
    actorUserId,
    allowedSourceTypes,
    includeCancelled: filters.includeCancelled === true,
    includeCompleted: filters.includeCompleted === true,
    operatingDate,
    scope,
    workspaceId,
  });

  if (!result.ok) {
    return buildErrorResponse({
      code: result.error,
      message: "원내 현황 데이터를 불러오지 못했습니다.",
      operatingDate,
      retryable: result.retryable ?? true,
      sourceStatus: "error",
      status: 500,
      workspaceId,
    });
  }

  const itemsWithMine = result.items
    .filter((item) => item.workspaceId === workspaceId && allowedSourceTypes.includes(item.sourceType) && item.permissionMode !== "hidden")
    .map((item) => ({
      ...item,
      isMyWork: item.assigneeUserId === actorUserId || item.assigneeUserIds?.includes(actorUserId) === true,
      isRequestedWork: item.requesterUserId === actorUserId,
    }));
  const scopedItems = scope === "mine"
    ? itemsWithMine.filter((item) => item.isMyWork)
    : itemsWithMine;
  const summary = summarizeOperationsWorkItems(scopedItems);

  return {
    ok: true,
    status: 200,
    enforcedBy: "home-operations-work-items",
    workspaceId,
    operatingDate,
    sourceStatus: result.sourceStatus === "partial"
      ? "partial"
      : scopedItems.length > 0
        ? "live"
        : "empty",
    items: scopedItems,
    currentPatients: result.currentPatients ?? null,
    summary,
    ...(result.accessIssues?.length ? { accessIssues: result.accessIssues } : {}),
    generatedAt: result.generatedAt,
  };
}

async function listBillingFallbackItemsFromSnapshot(
  client: SupabaseHomeOperationsWorkItemsRpcClient,
  input: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): Promise<{ ok: true; items: HomeOperationsWorkItem[] } | { ok: false }> {
  const [invoices, invoiceLines, encounters, patients, guardians, orders] = await Promise.all([
    listSnapshotRows(
      client,
      "invoices", input.workspaceId),
    listSnapshotRows(
      client,
      "invoice_lines", input.workspaceId),
    listSnapshotRows(
      client,
      "encounters", input.workspaceId),
    listSnapshotRows(
      client,
      "patients", input.workspaceId),
    listSnapshotRows(
      client,
      "guardians", input.workspaceId),
    listSnapshotRows(client, "orders", input.workspaceId),
  ]);

  if (!invoices.ok || !invoiceLines.ok || !encounters.ok || !patients.ok || !guardians.ok || !orders.ok) {
    return { ok: false };
  }

  return {
    ok: true,
    items: mapBillingFallbackItemsFromRows({
      encounters: encounters.rows,
      guardians: guardians.rows,
      input,
      invoiceLines: invoiceLines.rows,
      orders: orders.rows,
      invoices: invoices.rows,
      patients: patients.rows,
    }),
  };
}

async function listSnapshotRows(
  client: SupabaseHomeOperationsWorkItemsRpcClient,
  tableName: string,
  workspaceId: string,
): Promise<{ ok: true; rows: unknown[] } | { ok: false }> {
  const rows = client.sourceRows?.[tableName];
  return rows ? { ok: true, rows: rows.filter((value) => getString(getRecord(value)?.workspace_id) === workspaceId) } : { ok: false };
}

function mapBillingFallbackItemsFromRows({
  encounters,
  guardians,
  input,
  invoiceLines,
  orders,
  invoices,
  patients,
}: {
  encounters: unknown[];
  guardians: unknown[];
  input: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  };
  invoiceLines: unknown[];
  orders: unknown[];
  invoices: unknown[];
  patients: unknown[];
}): HomeOperationsWorkItem[] {
  const encounterById = new Map(
    recordsById(encounters).map((record) => [getString(record.id), record]),
  );
  const patientById = new Map(
    recordsById(patients).map((record) => [getString(record.id), record]),
  );
  const guardianById = new Map(
    recordsById(guardians).map((record) => [getString(record.id), record]),
  );
  const orderById = new Map(recordsById(orders).map((row) => [getString(row.id), row]));
  const linesByInvoiceId = new Map<string, Record<string, unknown>[]>();

  for (const line of recordsById(invoiceLines)) {
    const invoiceId = getString(line.invoice_id) ?? getString(line.invoiceId);
    if (!invoiceId) continue;
    const lines = linesByInvoiceId.get(invoiceId) ?? [];
    lines.push(line);
    linesByInvoiceId.set(invoiceId, lines);
  }

  const items: HomeOperationsWorkItem[] = [];
  for (const invoice of recordsById(invoices)) {
    const invoiceId = getString(invoice.id);
    const encounterId = getString(invoice.encounter_id) ?? getString(invoice.encounterId);
    if (!invoiceId || !encounterId) continue;

    const lines = linesByInvoiceId.get(invoiceId) ?? [];
    const hasBillingCandidate = lines.some(
      (line) =>
        Boolean(getString(line.billing_candidate_id) ?? getString(line.billingCandidateId)) ||
        Boolean(orderById.get(getString(line.order_id) ?? getString(line.orderId))?.billing_candidate_id),
    );
    if (!hasBillingCandidate) continue;

    const requestedAt =
      getString(invoice.billing_requested_at) ??
      getEarliestIso(lines.map((line) => getString(line.created_at) ?? getString(line.createdAt))) ??
      getString(invoice.created_at) ??
      getString(invoice.createdAt);
    if (!requestedAt) continue;

    const status = getString(invoice.status) ?? "draft";
    const paymentState = getString(invoice.payment_state) ?? getString(invoice.paymentState);
    const progressState = getBillingProgressState({ paymentState, status });
    if (!shouldIncludeOperatingDate(progressState, requestedAt, input.operatingDate)) continue;
    if (!shouldIncludeProgress(progressState, input.includeCompleted, input.includeCancelled)) continue;

    const encounter = encounterById.get(encounterId);
    const patientId = getString(encounter?.patient_id) ?? getString(encounter?.patientId);
    const guardianId =
      getString(encounter?.guardian_id) ??
      getString(encounter?.guardianId) ??
      getString(invoice.guardian_id) ??
      getString(invoice.guardianId);
    const patient = patientById.get(patientId);
    const guardian = guardianById.get(guardianId);
    const totalAmount =
      getNumber(invoice.total_amount) ??
      getNumber(invoice.totalAmount) ??
      lines.reduce((sum, line) => sum + (getNumber(line.line_total) ?? getNumber(line.lineTotal) ?? 0), 0);
    const invoiceNo = getString(invoice.invoice_no) ?? getString(invoice.invoiceNo) ?? invoiceId;
    const stateEnteredAt =
      getString(invoice.paid_at) ??
      getString(invoice.paidAt) ??
      getString(invoice.issued_at) ??
      getString(invoice.issuedAt) ??
      getLatestIso(lines.map((line) => getString(line.updated_at) ?? getString(line.updatedAt))) ??
      requestedAt;

    items.push({
      id: `billing:${invoiceId}`,
      workspaceId: input.workspaceId,
      sourceType: "billing",
      sourceId: invoiceId,
      sourceStatus: `${status}:${paymentState ?? "none"}`,
      encounterId,
      patientId,
      guardianId,
      title: `${invoiceNo} 수납 요청`,
      patientName: getString(patient?.name),
      guardianName: getString(guardian?.name),
      progressState,
      queueCardSecondLineText: `오더 ${lines.length}건 · ${formatKrwAmount(totalAmount)}원`,
      receptionType: getReceptionType(
        getString(encounter?.reception_type) ??
        getString(encounter?.receptionType) ??
        (getString(encounter?.appointment_id) ? "appointment" : undefined),
      ) ?? "외래",
      attentionSignals: getFallbackAttentionSignals({
        priority: "normal",
        progressState,
        requestedAt,
        sourceStatus: status,
        teamQueueId: "billing",
        operatingDate: input.operatingDate,
      }),

      requestedAt,
      stateEnteredAt,
      operatingDate: toSeoulDate(requestedAt),
      sourceHref: `/w/${input.workspaceId}/billing?invoiceId=${invoiceId}&encounterId=${encounterId}`,
      drawerSummary: "청구 후보 또는 수납 진행 상태를 확인합니다.",
      permissionMode: "full",
      teamQueueId: "billing",
      teamQueueLabel: getFallbackTeamQueueLabel("billing"),
    });
  }

  return items;
}

export type SupabaseHomeOperationsWorkItemsRpcClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  sourceRows?: Record<string, unknown[]>;
};

export function createSupabaseHomeOperationsWorkItemGateway(
  client: SupabaseHomeOperationsWorkItemsRpcClient,
  staffGateway?: WorkspaceStaffReadGateway,
): HomeOperationsWorkItemGateway {
  return {
    async listHomeOperationsWorkItems(input) {
      const result = await listHomeOperationsWorkItemsFromExistingSources(client, input);
      if (!result.ok || !staffGateway) return result;
      const visibleItems = result.items.filter((item) =>
        item.workspaceId === input.workspaceId &&
        input.allowedSourceTypes.includes(item.sourceType) &&
        item.permissionMode === "full",
      );
      if (!visibleItems.some((item) => item.requesterUserId || item.assigneeUserId || item.assigneeUserIds?.length)) return result;
      // Optional pictures must not turn a successful work read into an error.
      // The staff gateway scopes active membership and signs private pictures.
      try {
        const staff = await staffGateway.listWorkspaceStaff({ workspaceId: input.workspaceId });
        if (!staff.ok) return result;
        const photos = new Map(staff.staff.filter((member) => member.status === "active" && member.avatarUrl).map((member) => [member.id, member.avatarUrl!]));
        for (const item of visibleItems) {
          item.requesterAvatarUrl = photos.get(item.requesterUserId ?? "");
          const assigneeIds = item.assigneeUserIds?.length ? item.assigneeUserIds : item.assigneeUserId ? [item.assigneeUserId] : [];
          item.assigneeAvatarUrls = Object.fromEntries(assigneeIds.flatMap((id) => {
            const photo = photos.get(id);
            return photo ? [[id, photo]] : [];
          }));
        }
      } catch {
        // Keep names and fallback avatars when the optional profile read fails.
      }
      return result;
    },
  };
}

export function createDemoHomeOperationsPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

export function createDemoHomeOperationsWorkItemGateway(): HomeOperationsWorkItemGateway {
  const calendarGateway = createMockReceptionCalendarReadGateway();
  const fulfillmentGateway = createMockFulfillmentWorkItemGateway();
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway();

  return {
    async listHomeOperationsWorkItems(input) {
      const generatedAt = new Date().toISOString();
      const items: HomeOperationsWorkItem[] = [];

      const calendar = await calendarGateway.listReceptionDay({
        date: input.operatingDate,
        workspaceId: input.workspaceId,
      });
      if (calendar.ok) {
        items.push(
          ...mapCalendarFallbackItems(
            calendar.records.map(enrichDemoCalendarRecord),
            input,
          ),
        );
      }

      for (const queueType of fulfillmentQueueTypes) {
        const fulfillment = await fulfillmentGateway.listWorkItems({
          queueType,
          workspaceId: input.workspaceId,
        });
        if (!fulfillment.ok) continue;

        items.push(
          ...fulfillment.workItems
            .map((workItem) => mapDemoFulfillmentWorkItem(workItem, input))
            .filter((item): item is HomeOperationsWorkItem => Boolean(item)),
        );
      }

      items.push(...await listDemoBillingItems(input, invoiceCandidateGateway));

      return {
        ok: true,
        generatedAt,
        items: sortOperationsItems(deduplicateOperationsItems(items)),
        sourceStatus: items.length > 0 ? "live" : "empty",
      };
    },
  };
}

async function listCalendarItemsFromSnapshot(
  client: SupabaseHomeOperationsWorkItemsRpcClient,
  input: Parameters<HomeOperationsWorkItemGateway["listHomeOperationsWorkItems"]>[0],
): Promise<{ ok: true; items: HomeOperationsWorkItem[]; currentPatients: { present: number; waiting: number; inProgress: number }; assignmentReadFailed: boolean } | { ok: false }> {
  const [appointments, encounters, queues, patients, guardians] = await Promise.all([
    listSnapshotRows(client, "appointments", input.workspaceId),
    listSnapshotRows(client, "encounters", input.workspaceId),
    listSnapshotRows(client, "waiting_queue_entries", input.workspaceId),
    listSnapshotRows(client, "patients", input.workspaceId),
    listSnapshotRows(client, "guardians", input.workspaceId),
  ]);
  if (!appointments.ok || !encounters.ok || !queues.ok || !patients.ok || !guardians.ok) return { ok: false };
  const camel = (value: unknown) => Object.fromEntries(Object.entries(getRecord(value) ?? {}).map(([key, field]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), field]));
  const encounterRows = encounters.rows.map(camel);
  const encounterById = new Map(encounterRows.map((row) => [getString(row.id), row]));
  const patientById = new Map(patients.rows.map(camel).map((row) => [getString(row.id), row]));
  const guardianById = new Map(guardians.rows.map(camel).map((row) => [getString(row.id), row]));
  const context = (row: Record<string, unknown>) => ({
    patient: patientById.get(getString(row.patientId)),
    primaryGuardian: guardianById.get(getString(row.guardianId)),
  });
  const records: Record<string, unknown>[] = [];
  if (input.allowedSourceTypes.includes("appointment")) {
    for (const appointment of appointments.rows.map(camel)) {
      records.push({ appointment, encounter: encounterRows.find((row) => row.appointmentId === appointment.id), ...context(appointment) });
    }
  }
  for (const queueEntry of queues.rows.map(camel)) {
    // Treatment and billing are represented by their authoritative work-item readers.
    if (queueEntry.queueType !== "reception" && queueEntry.queueType !== "consultation") continue;
    if (!input.allowedSourceTypes.includes(queueEntry.queueType)) continue;
    const encounter = encounterById.get(getString(queueEntry.encounterId));
    if (encounter) records.push({ encounter, queueEntry, ...context(encounter) });
  }
  if (input.allowedSourceTypes.includes("reception")) {
    const queuedReception = new Set(queues.rows.map(camel).filter((row) => row.queueType === "reception").map((row) => row.encounterId));
    for (const encounter of encounterRows) {
      if (queuedReception.has(encounter.id)) continue;
      // An encounter is the authoritative reception record even when its queue
      // has already been routed to consultation. This is a read projection.
      records.push({ encounter, ...context(encounter), queueEntry: {
        id: encounter.id, queueType: "reception", enteredAt: encounter.checkedInAt,
        status: encounter.status === "waiting" ? "waiting" : encounter.status === "cancelled" ? "cancelled" : "done",
      } });
    }
  }
  const assignmentReadFailed = false;
  const present = new Map<string, string>();
  for (const encounter of encounterRows) {
    const patientId = getString(encounter.patientId);
    const status = getString(encounter.status);
    const checkedInAt = getString(encounter.checkedInAt);
    if (!patientId || !checkedInAt || Date.parse(checkedInAt) > Date.now() || !status || !["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(status)) continue;
    const currentStatus = present.get(patientId);
    if (!currentStatus || status === "in_consultation" || status === "ordered" || (status === "waiting" && currentStatus === "ready_for_billing")) {
      present.set(patientId, status);
    }
  }
  const inProgress = [...present.values()].filter((status) => status === "in_consultation" || status === "ordered").length;
  const waiting = [...present.values()].filter((status) => status === "waiting").length;
  return { ok: true, items: mapCalendarFallbackItems(records, input), assignmentReadFailed, currentPatients: { present: present.size, waiting, inProgress } };
}

async function listHomeOperationsWorkItemsFromExistingSources(
  client: SupabaseHomeOperationsWorkItemsRpcClient,
  input: {
    actorUserId: string;
    allowedSourceTypes: HomeOperationsSourceType[];
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    scope: HomeOperationsScope;
    workspaceId: string;
  },
): Promise<HomeOperationsGatewayResult> {
  const generatedAt = new Date().toISOString();
  const accessIssues: HomeOperationsAccessIssue[] = [];
  const items: HomeOperationsWorkItem[] = [];

  const readArgs = {
    p_workspace_id: input.workspaceId,
    p_date: input.operatingDate,
    p_include_completed: input.includeCompleted,
    p_include_cancelled: input.includeCancelled,
  };
  // A scalar JSON snapshot contains the complete operational source/dependency
  // set in one statement, avoiding historical offset pages and row-limit caps.
  const snapshot = await client.rpc("clair_get_home_operations_source_snapshot_v2", readArgs);
  const page = getRecord(snapshot.data);
  const tables = ["appointments", "encounters", "waiting_queue_entries", "patients", "guardians", "invoices", "invoice_lines", "orders", "user_memberships"];
  if (snapshot.error || !page || tables.some((table) => !Array.isArray(page[table]))) {
    return { ok: false, error: "db_read_failed", retryable: true };
  }
  const sourceRows = Object.fromEntries(tables.map((table) => [table, page[table] as unknown[]]));
  const sourceClient: SupabaseHomeOperationsWorkItemsRpcClient = {
    rpc: (name, args) => client.rpc(name, args), sourceRows,
  };
  const calendar = await listCalendarItemsFromSnapshot(sourceClient, input);
  if (!calendar.ok) {
    accessIssues.push({ code: "reception_calendar_read_failed", message: "접수/예약 업무를 불러오지 못했습니다.", sourceType: "reception" });
  } else {
    items.push(...calendar.items);
    if (calendar.assignmentReadFailed) accessIssues.push({ code: "assignment_read_failed", message: "일부 접수·예약 담당 정보를 불러오지 못했습니다.", sourceType: "reception" });
  }
  for (const queueType of fulfillmentQueueTypes.filter((type) => input.allowedSourceTypes.includes(type))) {
    const fulfillment = await client.rpc("clair_list_home_fulfillment_work_items", {
      ...readArgs, p_queue_type: queueType,
    });
    if (fulfillment.error || !Array.isArray(fulfillment.data)) {
      accessIssues.push({ code: "fulfillment_read_failed", message: "오더 기반 업무를 불러오지 못했습니다.", sourceType: queueType });
    } else {
      items.push(...mapFulfillmentFallbackItems(fulfillment.data, input).filter((item) => item.sourceType === queueType));
    }
  }
  if (input.allowedSourceTypes.includes("billing")) {
    const billing = await listBillingFallbackItemsFromSnapshot(sourceClient, input);
    if (!billing.ok) accessIssues.push({ code: "billing_read_failed", message: "수납 업무를 불러오지 못했습니다.", sourceType: "billing" });
    else items.push(...billing.items);
  }

  const patientsById = new Map(recordsById(sourceRows.patients).filter((row) => row.workspace_id === input.workspaceId).map((row) => [getString(row.id), row]));
  const guardiansById = new Map(recordsById(sourceRows.guardians).filter((row) => row.workspace_id === input.workspaceId).map((row) => [getString(row.id), row]));
  const encountersById = new Map(recordsById(sourceRows.encounters).filter((row) => row.workspace_id === input.workspaceId).map((row) => [getString(row.id), row]));
  for (const item of items) {
    const encounter = encountersById.get(item.encounterId);
    item.patientId ??= getString(encounter?.patient_id);
    item.guardianId ??= getString(encounter?.guardian_id);
    item.patientName ??= getString(patientsById.get(item.patientId)?.name);
    item.guardianName ??= getString(guardiansById.get(item.guardianId)?.name);
  }
  const memberNames = await listSnapshotRows(sourceClient, "user_memberships", input.workspaceId);
  if (memberNames.ok) {
    const names = new Map(recordsById(memberNames.rows).map((row) => [getString(row.user_id), getString(getRecord(row.users)?.display_name)]));
    for (const item of items) {
      item.assigneeNames = (item.assigneeUserIds ?? (item.assigneeUserId ? [item.assigneeUserId] : [])).map((id) => names.get(id) ?? "담당자 지정됨");
      item.assigneeName = item.assigneeNames.join(", ") || item.assigneeName;
      item.requesterName = names.get(item.requesterUserId) ?? item.requesterName;
    }
  } else accessIssues.push({ code: "member_names_read_failed", message: "담당자 이름을 불러오지 못했습니다." });

  if (items.length === 0 && accessIssues.length > 0) {
    return { ok: false, error: "db_read_failed", retryable: true };
  }

  return {
    ok: true,
    generatedAt,
    currentPatients: calendar.ok ? calendar.currentPatients : null,
    items: sortOperationsItems(deduplicateOperationsItems(items)),
    sourceStatus: accessIssues.length > 0 ? "partial" : items.length > 0 ? "live" : "empty",
    ...(accessIssues.length > 0 ? { accessIssues } : {}),
  };
}

export function createMockHomeOperationsWorkItemGateway(
  response: HomeOperationsGatewayResult,
): HomeOperationsWorkItemGateway {
  return {
    async listHomeOperationsWorkItems() {
      return response;
    },
  };
}

function mapCalendarFallbackItems(
  value: unknown,
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): HomeOperationsWorkItem[] {
  if (!Array.isArray(value)) return [];

  const items: HomeOperationsWorkItem[] = [];
  for (const recordValue of value) {
    if (!recordValue || typeof recordValue !== "object") continue;
    const record = recordValue as Record<string, unknown>;
    const appointment = getRecord(record.appointment);
    const encounter = getRecord(record.encounter);
    const patient = getRecord(record.patient);
    const guardian = getRecord(record.primaryGuardian);
    const queueEntry = getRecord(record.queueEntry);

    if (appointment) {
      const appointmentItem = mapAppointmentFallbackItem({
        appointment,
        encounter,
        guardian,
        includeCancelled,
        includeCompleted,
        operatingDate,
        patient,
        workspaceId,
      });
      if (appointmentItem) items.push(appointmentItem);
    }

    if (queueEntry && encounter) {
      const queueItem = mapQueueFallbackItem({
        encounter,
        guardian,
        includeCancelled,
        includeCompleted,
        operatingDate,
        patient,
        queueEntry,
        workspaceId,
      });
      if (queueItem) items.push(queueItem);
    }
  }

  return items;
}

function mapAppointmentFallbackItem({
  appointment,
  encounter,
  guardian,
  includeCancelled,
  includeCompleted,
  operatingDate,
  patient,
  workspaceId,
}: {
  appointment: Record<string, unknown>;
  encounter?: Record<string, unknown>;
  guardian?: Record<string, unknown>;
  includeCancelled: boolean;
  includeCompleted: boolean;
  operatingDate: string;
  patient?: Record<string, unknown>;
  workspaceId: string;
}): HomeOperationsWorkItem | null {
  const sourceId = getString(appointment.id);
  const sourceStatus = getString(appointment.status) ?? "unknown";
  const scheduledAt = getString(appointment.scheduledStartAt);
  const requestedAt = getString(appointment.createdAt) ?? scheduledAt;
  if (!sourceId || !requestedAt) return null;

  const progressState = sourceStatus === "checked_in"
    ? "completed"
    : sourceStatus === "cancelled" || sourceStatus === "no_show"
      ? "cancelled"
      : "waiting";
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) return null;

  if (!shouldIncludeOperatingDate(progressState, scheduledAt ?? requestedAt, operatingDate)) return null;
  const patientName = getString(patient?.name);
  const teamQueueId = "reception";
  const drawerSummary =
    getString(appointment.visitPurpose) ??
    getString(appointment.symptomNote) ??
    "예약 접수 상태를 확인합니다.";
  return {
    id: `appointment:${sourceId}`,
    workspaceId,
    sourceType: "appointment",
    sourceId,
    sourceStatus,
    encounterId: getString(encounter?.id),
    patientId: getString(appointment.patientId),
    guardianId: getString(appointment.guardianId),
    title: patientName ? `${patientName} 예약 확인` : "예약 확인",
    patientName,
    guardianName: getString(guardian?.name),
    progressState,
    queueCardEventText: progressState === "cancelled"
      ? `${getSeoulShortTime(getString(appointment.updatedAt) ?? requestedAt)} 취소`
      : `${getSeoulShortTime(scheduledAt ?? requestedAt)} 예약`,
    queueCardSecondLineBadgeLabel: progressState === "cancelled" ? "취소" : "대기",
    queueCardSecondLineText: drawerSummary,
    receptionType: "예약",
    attentionSignals: getFallbackAttentionSignals({
      priority: "normal",
      progressState,
      requestedAt: scheduledAt ?? requestedAt,
      sourceStatus,
      teamQueueId,
      operatingDate,
    }),
    requestedAt,
    scheduledAt,
    requesterUserId: getString(appointment.createdByUserId),
    assigneeName: appointment.assignmentUnknown ? "담당 정보 확인 필요" : undefined,
    assigneeUserIds: Array.isArray(appointment.assignedStaffUserIds) ? appointment.assignedStaffUserIds.filter((value): value is string => typeof value === "string") : [],
    stateEnteredAt: getString(appointment.updatedAt) ?? requestedAt,
    operatingDate: toSeoulDate(scheduledAt ?? requestedAt),
    sourceHref: `/w/${workspaceId}/reception?appointmentId=${sourceId}&modulePanel=open`,
    drawerSummary,
    permissionMode: "full",
    teamQueueId,
    teamQueueLabel: "접수팀 큐",
  };
}

function mapQueueFallbackItem({
  encounter,
  guardian,
  includeCancelled,
  includeCompleted,
  operatingDate,
  patient,
  queueEntry,
  workspaceId,
}: {
  encounter: Record<string, unknown>;
  guardian?: Record<string, unknown>;
  includeCancelled: boolean;
  includeCompleted: boolean;
  operatingDate: string;
  patient?: Record<string, unknown>;
  queueEntry: Record<string, unknown>;
  workspaceId: string;
}): HomeOperationsWorkItem | null {
  const sourceId = getString(queueEntry.id);
  const encounterId = getString(encounter.id);
  const sourceStatus = getString(queueEntry.status) ?? "unknown";
  const requestedAt = getString(queueEntry.enteredAt);
  const queueType = getString(queueEntry.queueType) ?? "consultation";
  if (!sourceId || !encounterId || !requestedAt) return null;

  const encounterStatus = getString(encounter.status);
  const progressState = sourceStatus === "cancelled" || encounterStatus === "cancelled"
    ? "cancelled"
    : sourceStatus === "done" || encounterStatus === "completed" || encounterStatus === "ready_for_billing"
      ? "completed"
      : sourceStatus === "called" || sourceStatus === "in_progress" || encounterStatus === "in_consultation" || encounterStatus === "ordered"
        ? "in_progress"
        : "waiting";
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) return null;

  if (!shouldIncludeOperatingDate(progressState, requestedAt, operatingDate)) return null;

  const sourceType = queueType === "billing"
    ? "billing"
    : queueType === "treatment"
      ? "treatment"
      : queueType === "reception"
        ? "reception"
        : "consultation";
  const teamQueueId = sourceType === "consultation" ? "consultation" : sourceType;
  const patientName = getString(patient?.name);
  const receptionType = getString(encounter.appointmentId) || getString(encounter.appointment_id)
    ? "예약"
    : "외래";
  const drawerSummary =
    getString(encounter.visitPurpose) ??
    getString(encounter.chiefComplaint) ??
    "접수 후 원내 대기 상태를 확인합니다.";
  const queueEventLabel = receptionType === "예약" ? "예약" : "접수";
  const queueCardEventText = sourceType === "reception" || sourceType === "consultation"
    ? progressState === "cancelled"
      ? `${getSeoulShortTime(getString(queueEntry.finishedAt) ?? requestedAt)} 취소`
      : `${getSeoulShortTime(requestedAt)} ${queueEventLabel}`
    : undefined;

  return {
    id: `${sourceType}:${sourceId}`,
    workspaceId,
    sourceType,
    sourceId,
    sourceStatus,
    encounterId,
    patientId: getString(encounter.patientId),
    guardianId: getString(encounter.guardianId),
    title: getQueueFallbackTitle(sourceType, patientName),
    patientName,
    guardianName: getString(guardian?.name),
    progressState,
    queueCardEventText,
    queueCardSecondLineBadgeLabel: getQueueFallbackSecondLineBadgeLabel(sourceType, progressState),
    queueCardSecondLineText: drawerSummary,
    receptionType,
    attentionSignals: getFallbackAttentionSignals({
      priority: getString(queueEntry.priority),
      progressState,
      requestedAt,
      sourceStatus,
      teamQueueId,
      operatingDate,
    }),
    requesterUserId: getString(encounter.checkedInByUserId),
    assigneeName: sourceType === "reception" && encounter.assignmentUnknown ? "담당 정보 확인 필요" : undefined,
    assigneeUserId: sourceType === "consultation" ? getString(encounter.primaryVeterinarianId) : undefined,
    assigneeUserIds: sourceType === "reception" && Array.isArray(encounter.assignedStaffUserIds) ? encounter.assignedStaffUserIds.filter((value): value is string => typeof value === "string") : undefined,
    requestedAt,
    stateEnteredAt: getString(queueEntry.finishedAt) ?? getString(queueEntry.calledAt) ?? requestedAt,
    operatingDate: toSeoulDate(requestedAt),
    sourceHref: getFallbackSourceHref({ encounterId, sourceType, workspaceId }),
    drawerSummary,
    permissionMode: "full",
    teamQueueId,
    teamQueueLabel: getFallbackTeamQueueLabel(sourceType),
  };
}

function mapFulfillmentFallbackItems(
  rows: unknown[],
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): HomeOperationsWorkItem[] {
  return rows
    .map((row) =>
      mapFulfillmentFallbackItem(row, {
        includeCancelled,
        includeCompleted,
        operatingDate,
        workspaceId,
      }),
    )
    .filter((item): item is HomeOperationsWorkItem => Boolean(item));
}

function mapFulfillmentFallbackItem(
  rowValue: unknown,
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): HomeOperationsWorkItem | null {
  if (!rowValue || typeof rowValue !== "object") return null;
  const row = rowValue as Record<string, unknown>;
  if (getString(row.workspace_id) !== workspaceId) return null;
  const sourceId = getString(row.id);
  const queueType = getSourceType(row.queue_type);
  const sourceStatus = getString(row.status) ?? "unknown";
  const requestedAt = getString(row.created_at);
  const encounterId = getString(row.encounter_id);
  if (!sourceId || !queueType || !requestedAt || !encounterId) return null;

  const progressState = sourceStatus === "completed"
    ? "completed"
    : sourceStatus === "cancelled"
      ? "cancelled"
      : sourceStatus === "in_progress"
        ? "in_progress"
        : "waiting";
  if (!shouldIncludeOperatingDate(progressState, getString(row.due_at) ?? requestedAt, operatingDate)) return null;
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) return null;

  const sourceSnapshot = getRecord(row.source_snapshot);
  const title =
    getString(sourceSnapshot?.orderDisplayName) ??
    getString(sourceSnapshot?.billingName) ??
    getFallbackFulfillmentTitle(queueType);
  const queueCardSecondLineBadgeLabel = getFulfillmentQueueCardSecondLineBadgeLabel(
    queueType,
    sourceSnapshot,
    title,
  );

  return {
    id: `${queueType}:${sourceId}`,
    workspaceId,
    sourceType: queueType,
    sourceId,
    sourceStatus,
    encounterId,
    patientId: getString(row.patient_id),
    title,
    patientName: getString(sourceSnapshot?.patientName),
    guardianName: getString(sourceSnapshot?.guardianName),
    progressState,
    queueCardSecondLineBadgeLabel,
    queueCardSecondLineText: title,
    receptionType: getSourceSnapshotReceptionType(sourceSnapshot),
    attentionSignals: getFallbackAttentionSignals({
      priority: getString(row.priority),
      progressState,
      requestedAt: getString(row.due_at) ?? requestedAt,
      sourceStatus,
      teamQueueId: queueType,
      operatingDate,
    }),
    assigneeUserId: getString(row.assigned_to_user_id),
    requesterUserId: getString(row.requested_by_user_id),
    scheduledAt: getString(row.due_at),
    requesterName: getString(sourceSnapshot?.requestingVetName),
    requestedAt,
    stateEnteredAt:
      getString(row.returned_at) ??
      getString(row.completed_at) ??
      getString(row.cancelled_at) ??
      getString(row.updated_at) ??
      requestedAt,
    operatingDate: toSeoulDate(getString(row.due_at) ?? requestedAt),
    sourceHref: `${getFallbackSourceHref({ encounterId, sourceType: queueType, workspaceId })}&workItemId=${sourceId}&date=${toSeoulDate(getString(row.due_at) ?? requestedAt)}${queueType === "lab" ? `&labResultId=live-lab-${sourceId}` : queueType === "imaging" ? `&imagingStudyId=live-imaging-${sourceId}` : ""}`,
    drawerSummary: getString(sourceSnapshot?.instruction) ?? "오더 기반 업무 상태를 확인합니다.",
    permissionMode: "full",
    teamQueueId: queueType,
    teamQueueLabel: getFallbackTeamQueueLabel(queueType),
  };
}

function enrichDemoCalendarRecord(
  record: ReceptionCalendarReadRecord,
): ReceptionCalendarReadRecord {
  const patientId = record.appointment?.patientId ?? record.encounter?.patientId;
  const guardianId = record.appointment?.guardianId ?? record.encounter?.guardianId;

  return {
    ...record,
    patient: record.patient ?? mockPatients.find(
      (patient) =>
        patient.id === patientId &&
        patient.workspaceId === (
          record.appointment?.workspaceId ??
          record.encounter?.workspaceId
        ),
    ),
    primaryGuardian: record.primaryGuardian ?? mockGuardians.find(
      (guardian) =>
        guardian.id === guardianId &&
        guardian.workspaceId === (
          record.appointment?.workspaceId ??
          record.encounter?.workspaceId
        ),
    ),
  };
}

function mapDemoFulfillmentWorkItem(
  workItem: FulfillmentWorkItem,
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
): HomeOperationsWorkItem | null {
  const queueType = getSourceType(workItem.queueType);
  if (!queueType) return null;

  const progressState = workItem.status === "completed"
    ? "completed"
    : workItem.status === "cancelled"
      ? "cancelled"
      : workItem.status === "in_progress"
        ? "in_progress"
        : "waiting";
  if (!shouldIncludeOperatingDate(progressState, workItem.createdAt, operatingDate)) {
    return null;
  }
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) {
    return null;
  }

  const encounter = findDemoEncounter(workspaceId, workItem.encounterId);
  const patient = encounter ? findDemoPatient(workspaceId, encounter.patientId) : undefined;
  const guardian = encounter?.guardianId
    ? findDemoGuardian(workspaceId, encounter.guardianId)
    : undefined;
  const sourceSnapshot = workItem.sourceSnapshot as unknown as Record<string, unknown>;
  const title =
    workItem.sourceSnapshot.orderDisplayName ??
    getFallbackFulfillmentTitle(queueType);

  return {
    id: `${queueType}:${workItem.id}`,
    workspaceId,
    sourceType: queueType,
    sourceId: workItem.id,
    sourceStatus: workItem.status,
    encounterId: workItem.encounterId,
    patientId: encounter?.patientId,
    guardianId: encounter?.guardianId,
    title,
    patientName: workItem.sourceSnapshot.patientName ?? patient?.name,
    guardianName: workItem.sourceSnapshot.guardianName ?? guardian?.name,
    progressState,
    queueCardSecondLineBadgeLabel: getFulfillmentQueueCardSecondLineBadgeLabel(
      queueType,
      sourceSnapshot,
      title,
    ),
    queueCardSecondLineText: title,
    receptionType: getSourceSnapshotReceptionType(sourceSnapshot) ??
      getReceptionType(encounter?.receptionType),
    attentionSignals: getFallbackAttentionSignals({
      priority: workItem.priority,
      progressState,
      requestedAt: workItem.createdAt,
      sourceStatus: workItem.status,
      teamQueueId: queueType,
      operatingDate,
    }),
    assigneeUserId: workItem.assignedToUserId ?? undefined,
    requesterName: workItem.sourceSnapshot.requestingVetName,
    requestedAt: workItem.createdAt,
    stateEnteredAt:
      workItem.returnedAt ??
      workItem.completedAt ??
      workItem.cancelledAt ??
      workItem.updatedAt ??
      workItem.createdAt,
    operatingDate: toSeoulDate(workItem.createdAt),
    sourceHref: getFallbackSourceHref({
      encounterId: workItem.encounterId,
      sourceType: queueType,
      workspaceId,
    }),
    drawerSummary: workItem.sourceSnapshot.instruction ?? "오더 기반 업무 상태를 확인합니다.",
    permissionMode: "full",
    teamQueueId: queueType,
    teamQueueLabel: getFallbackTeamQueueLabel(queueType),
  };
}

async function listDemoBillingItems(
  {
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  }: {
    includeCancelled: boolean;
    includeCompleted: boolean;
    operatingDate: string;
    workspaceId: string;
  },
  invoiceCandidateGateway: Pick<InvoiceCandidateSyncGateway, "listInvoiceCandidates">,
): Promise<HomeOperationsWorkItem[]> {
  const items: HomeOperationsWorkItem[] = [];

  for (const encounter of mockEncounters.filter((item) => item.workspaceId === workspaceId)) {
    const result = await invoiceCandidateGateway.listInvoiceCandidates({
      encounterId: encounter.id,
      workspaceId,
    });
    if (!result.ok) continue;

    const candidatesByInvoiceId = groupCandidatesByInvoiceId(result.candidates);
    for (const [invoiceId, candidates] of candidatesByInvoiceId) {
      const invoice = mockInvoices.find(
        (item) => item.id === invoiceId && item.workspaceId === workspaceId,
      );
      if (!invoice) continue;

      const item = mapBillingCandidatesToHomeItem({
        candidates,
        encounter,
        includeCancelled,
        includeCompleted,
        invoice,
        operatingDate,
        workspaceId,
      });
      if (item) items.push(item);
    }
  }

  return items;
}

function mapBillingCandidatesToHomeItem({
  candidates,
  encounter,
  includeCancelled,
  includeCompleted,
  invoice,
  operatingDate,
  workspaceId,
}: {
  candidates: BillingInvoiceCandidateLine[];
  encounter: Encounter;
  includeCancelled: boolean;
  includeCompleted: boolean;
  invoice: Invoice;
  operatingDate: string;
  workspaceId: string;
}): HomeOperationsWorkItem | null {
  if (!candidates.length) return null;

  const progressState = getBillingProgressState({
    paymentState: invoice.paymentState,
    status: invoice.status,
  });
  const requestedAt = invoice.createdAt;
  if (!shouldIncludeOperatingDate(progressState, requestedAt, operatingDate)) return null;
  if (!shouldIncludeProgress(progressState, includeCompleted, includeCancelled)) return null;

  const patient = findDemoPatient(workspaceId, encounter.patientId);
  const guardian = encounter.guardianId
    ? findDemoGuardian(workspaceId, encounter.guardianId)
    : undefined;
  const totalAmount = candidates.reduce(
    (sum, candidate) => sum + candidate.lineTotal,
    0,
  );
  const stateEnteredAt =
    invoice.paidAt ??
    invoice.issuedAt ??
    candidates
      .map((candidate) => candidate.syncedAt)
      .sort()
      .at(-1) ??
    requestedAt;

  return {
    id: `billing:${invoice.id}`,
    workspaceId,
    sourceType: "billing",
    sourceId: invoice.id,
    sourceStatus: `${invoice.status}:${invoice.paymentState ?? "none"}`,
    encounterId: encounter.id,
    patientId: encounter.patientId,
    guardianId: encounter.guardianId,
    title: `${invoice.invoiceNo} 수납 요청`,
    patientName: patient?.name,
    guardianName: guardian?.name,
    progressState,
    queueCardSecondLineText: `오더 ${candidates.length}건 · ${formatKrwAmount(totalAmount)}원`,
    receptionType: getReceptionType(encounter.receptionType) ?? "외래",
    attentionSignals: getFallbackAttentionSignals({
      priority: "normal",
      progressState,
      requestedAt,
      sourceStatus: invoice.status,
      teamQueueId: "billing",
      operatingDate,
    }),
    requesterName: "수납",
    requestedAt,
    stateEnteredAt,
    operatingDate: toSeoulDate(requestedAt),
    sourceHref: getFallbackSourceHref({
      encounterId: encounter.id,
      sourceType: "billing",
      workspaceId,
    }),
    drawerSummary: "청구 후보 또는 수납 진행 상태를 확인합니다.",
    permissionMode: "full",
    teamQueueId: "billing",
    teamQueueLabel: getFallbackTeamQueueLabel("billing"),
  };
}

function groupCandidatesByInvoiceId(candidates: BillingInvoiceCandidateLine[]) {
  const grouped = new Map<string, BillingInvoiceCandidateLine[]>();
  for (const candidate of candidates) {
    const rows = grouped.get(candidate.invoiceId) ?? [];
    rows.push(candidate);
    grouped.set(candidate.invoiceId, rows);
  }
  return grouped;
}

function getBillingProgressState({
  paymentState,
  status,
}: {
  paymentState?: string;
  status?: string;
}): HomeOperationsProgressState {
  if (status === "paid" || paymentState === "paid") return "completed";
  if (status === "voided" || status === "refunded" || paymentState === "refunded") {
    return "cancelled";
  }
  if (status === "issued" || paymentState === "unpaid" || paymentState === "failed") {
    return "in_progress";
  }
  return "waiting";
}

function findDemoEncounter(workspaceId: string, encounterId?: string) {
  if (!encounterId) return undefined;
  return mockEncounters.find(
    (encounter) =>
      encounter.id === encounterId &&
      encounter.workspaceId === workspaceId,
  );
}

function findDemoPatient(workspaceId: string, patientId?: string) {
  if (!patientId) return undefined;
  return mockPatients.find(
    (patient) =>
      patient.id === patientId &&
      patient.workspaceId === workspaceId,
  );
}

function findDemoGuardian(workspaceId: string, guardianId?: string) {
  if (!guardianId) return undefined;
  return mockGuardians.find(
    (guardian) =>
      guardian.id === guardianId &&
      guardian.workspaceId === workspaceId,
  );
}

function formatKrwAmount(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getFallbackAttentionSignals({
  operatingDate,
  priority,
  progressState,
  requestedAt,
  sourceStatus,
  teamQueueId,
}: {
  operatingDate: string;
  priority?: string;
  progressState: HomeOperationsProgressState;
  requestedAt: string;
  sourceStatus: string;
  teamQueueId?: string;
}): HomeOperationsAttentionSignal[] {
  const signals: HomeOperationsAttentionSignal[] = [];
  if (priority === "urgent") signals.push("urgent");
  if (sourceStatus === "returned" || sourceStatus === "re_requested") signals.push("re_requested");
  if (teamQueueId) signals.push("team_queue");
  else signals.push("assignment_missing");
  if (progressState !== "completed" && progressState !== "cancelled" && toSeoulDate(requestedAt) < operatingDate) {
    signals.push("long_stay");
  }
  return signals;
}

function shouldIncludeProgress(
  progressState: HomeOperationsProgressState,
  includeCompleted: boolean,
  includeCancelled: boolean,
) {
  if (progressState === "completed" && !includeCompleted) return false;
  if (progressState === "cancelled" && !includeCancelled) return false;
  return true;
}

function shouldIncludeOperatingDate(
  progressState: HomeOperationsProgressState,
  requestedAt: string,
  operatingDate: string,
) {
  const sourceOperatingDate = toSeoulDate(requestedAt);
  if (sourceOperatingDate === operatingDate) return true;
  return (
    sourceOperatingDate < operatingDate &&
    progressState !== "completed" &&
    progressState !== "cancelled"
  );
}

function sortOperationsItems(items: HomeOperationsWorkItem[]) {
  return [...items].sort((first, second) => {
    const score = (item: HomeOperationsWorkItem) => {
      if (item.attentionSignals.includes("urgent")) return 0;
      if (item.attentionSignals.includes("re_requested")) return 1;
      if (item.attentionSignals.includes("assignment_missing")) return 2;
      if (item.progressState === "in_progress") return 3;
      if (item.progressState === "waiting") return 4;
      if (item.progressState === "completed") return 5;
      return 6;
    };
    return score(first) - score(second) || first.requestedAt.localeCompare(second.requestedAt);
  });
}

function deduplicateOperationsItems(items: HomeOperationsWorkItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getQueueFallbackTitle(
  sourceType: HomeOperationsSourceType,
  patientName?: string,
) {
  const fallback = sourceType === "billing"
    ? "수납 대기"
    : sourceType === "treatment"
      ? "처치 대기"
      : sourceType === "reception"
        ? "접수 확인"
        : "진료 대기";
  return patientName ? `${patientName} ${fallback}` : fallback;
}

function getQueueFallbackSecondLineBadgeLabel(
  sourceType: HomeOperationsSourceType,
  progressState: HomeOperationsProgressState,
) {
  if (sourceType === "appointment" || sourceType === "reception") {
    return progressState === "cancelled" ? "취소" : "대기";
  }
  if (sourceType === "consultation") return "방문목적";
  if (sourceType === "treatment") return "처치";

  return undefined;
}

function getFulfillmentQueueCardSecondLineBadgeLabel(
  sourceType: HomeOperationsSourceType,
  sourceSnapshot: Record<string, unknown> | undefined,
  title: string,
) {
  if (sourceType === "lab") return title;
  if (sourceType === "imaging") {
    const detail = getRecord(sourceSnapshot?.detail);
    return getString(detail?.modality) ?? "영상";
  }
  if (sourceType === "dispensing") return "조제";
  if (sourceType === "treatment") return "처치";

  return undefined;
}

function getFallbackFulfillmentTitle(sourceType: HomeOperationsSourceType) {
  if (sourceType === "lab") return "임상병리 업무";
  if (sourceType === "imaging") return "영상 업무";
  if (sourceType === "dispensing") return "조제 업무";
  return "처치 업무";
}

function getFallbackTeamQueueLabel(sourceType: HomeOperationsSourceType) {
  if (sourceType === "appointment" || sourceType === "reception") return "접수팀 큐";
  if (sourceType === "consultation") return "진료 큐";
  if (sourceType === "lab") return "임상병리팀 큐";
  if (sourceType === "imaging") return "영상팀 큐";
  if (sourceType === "dispensing") return "조제팀 큐";
  if (sourceType === "billing") return "수납팀 큐";
  return "처치팀 큐";
}

function getFallbackSourceHref({
  encounterId,
  sourceType,
  workspaceId,
}: {
  encounterId: string;
  sourceType: HomeOperationsSourceType;
  workspaceId: string;
}) {
  if (sourceType === "reception") return `/w/${workspaceId}/reception?encounterId=${encounterId}&modulePanel=open`;
  if (sourceType === "lab") return `/w/${workspaceId}/lab?encounterId=${encounterId}&modulePanel=open`;
  if (sourceType === "imaging") return `/w/${workspaceId}/imaging?encounterId=${encounterId}&modulePanel=open`;
  if (sourceType === "dispensing" || sourceType === "treatment") {
    return `/w/${workspaceId}/dispensing?encounterId=${encounterId}&modulePanel=open`;
  }
  if (sourceType === "billing") return `/w/${workspaceId}/billing?encounterId=${encounterId}&modulePanel=open`;
  return `/w/${workspaceId}/treatment?encounterId=${encounterId}&modulePanel=open`;
}

function toSeoulDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  });
  return formatter.format(date);
}

function getSeoulShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16) || "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function summarizeOperationsWorkItems(
  items: HomeOperationsWorkItem[],
): HomeOperationsSummary {
  const bySourceType = Object.fromEntries(
    sourceTypes.map((sourceType) => [sourceType, 0]),
  ) as Record<HomeOperationsSourceType, number>;
  const byProgressState = Object.fromEntries(
    progressStates.map((progressState) => [progressState, 0]),
  ) as Record<HomeOperationsProgressState, number>;
  const byAttentionSignal = Object.fromEntries(
    attentionSignals.map((attentionSignal) => [attentionSignal, 0]),
  ) as Record<HomeOperationsAttentionSignal, number>;
  const byAssignmentState = {
    assignmentMissing: 0,
    personal: 0,
    teamQueue: 0,
  };

  for (const item of items) {
    bySourceType[item.sourceType] += 1;
    byProgressState[item.progressState] += 1;
    for (const signal of item.attentionSignals) {
      byAttentionSignal[signal] += 1;
    }
    if (item.attentionSignals.includes("assignment_missing")) {
      byAssignmentState.assignmentMissing += 1;
    } else if (item.assigneeUserId) {
      byAssignmentState.personal += 1;
    } else if (item.teamQueueId) {
      byAssignmentState.teamQueue += 1;
    }
  }

  return {
    byAssignmentState,
    byAttentionSignal,
    byProgressState,
    bySourceType,
    cancelledCount: byProgressState.cancelled,
    completedCount: byProgressState.completed,
    mineCount: items.filter((item) => item.isMyWork).length,
    totalVisible: items.length,
  };
}

function getProcessPermissionForSource(
  sourceType: HomeOperationsSourceType,
): PermissionId | null {
  if (sourceType === "appointment" || sourceType === "reception") return "reception:view";
  if (sourceType === "consultation") return "chart:view";
  if (sourceType === "lab") return "lab:view";
  if (sourceType === "imaging") return "imaging:view";
  if (sourceType === "dispensing" || sourceType === "treatment") return "dispensing:view";
  if (sourceType === "billing") return "billing:view";
  return null;
}

function buildPermissionDeniedResponse({
  denialReason,
  operatingDate,
  workspaceId,
}: {
  denialReason?: WorkspacePermissionDenialReason;
  operatingDate: string;
  workspaceId: string;
}): HomeOperationsWorkItemReadResult {
  const status = denialReason === "unauthenticated" ? 401 : 403;
  return buildErrorResponse({
    code: denialReason ?? "permission_missing",
    message: "원내 현황을 볼 권한이 없습니다.",
    operatingDate,
    retryable: false,
    sourceStatus: "permission_denied",
    status,
    workspaceId,
  });
}

function buildErrorResponse({
  code,
  message,
  operatingDate,
  retryable,
  sourceStatus,
  status,
  workspaceId,
}: {
  code: string;
  message: string;
  operatingDate: string;
  retryable: boolean;
  sourceStatus: "error" | "permission_denied";
  status: 400 | 401 | 403 | 500;
  workspaceId: string;
}): HomeOperationsWorkItemReadResult {
  return {
    ok: false,
    status,
    workspaceId,
    operatingDate,
    sourceStatus,
    error: {
      code,
      message,
      retryable,
    },
  };
}

function normalizeOperatingDate(date: string | null | undefined, workspaceId: string) {
  if (!date) return getWorkspaceOperatingDate(workspaceId);
  return isIsoOperatingDate(date) ? date : null;
}

function normalizeScope(scope: string | null | undefined): HomeOperationsScope | null {
  if (!scope || scope === "all") return "all";
  if (scope === "mine") return "mine";
  return null;
}

function getSourceType(value: unknown): HomeOperationsSourceType | null {
  return typeof value === "string" && sourceTypes.includes(value as HomeOperationsSourceType)
    ? (value as HomeOperationsSourceType)
    : null;
}

function getReceptionType(value: unknown): HomeOperationsWorkItem["receptionType"] {
  if (value === "예약" || value === "외래" || value === "접수") return value;
  if (value === "appointment") return "예약";
  if (value === "walk_in" || value === "reception") return "외래";
  return undefined;
}

function getSourceSnapshotReceptionType(
  sourceSnapshot?: Record<string, unknown>,
): HomeOperationsWorkItem["receptionType"] {
  return getReceptionType(
    sourceSnapshot?.receptionType ??
    sourceSnapshot?.reception_type,
  ) ?? "외래";
}

function getString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getEarliestIso(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()[0];
}

function getLatestIso(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function recordsById(values: unknown[]) {
  return values.filter(
    (value): value is Record<string, unknown> =>
      Boolean(getRecord(value)),
  );
}
