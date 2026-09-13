import { resolveWorkspacePermission, type WorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import { emitLiveMutationAuditEvent, type LiveMutationAuditOptions } from "@/features/audit/server-mutation-audit-core";
import {
  createDemoChartSoapPermissionAdapter,
  createMockEncounterChart,
  getMockEncounterCharts,
  mapChartSoapConflict,
  mapSoapNote,
  putMockEncounterChart,
} from "@/features/chart/server-soap-note-persistence-core";
import { mockEncounters } from "@/mocks/emr-domain";
import type { SoapNote } from "@/types/emr-domain";

export type EncounterChartsInput = {
  encounterId?: string;
  chartId?: string;
  creationRequestId?: string;
  clinicalAt?: string;
  expectedUpdatedAt?: string;
};
type ChartOperation = "list" | "create" | "ensure" | "sign";
type ChartGatewayInput = {
  operation: ChartOperation;
  workspaceId: string;
  actorUserId: string;
  actorDisplayName?: string;
  encounterId: string;
  chartId?: string;
  creationRequestId?: string;
  clinicalAt?: string;
  expectedUpdatedAt?: string;
  requestId?: string | null;
};
export type EncounterChartsResult =
  | { ok: true; status: 200; charts?: SoapNote[]; chart?: SoapNote; auditRecorded?: boolean }
  | { ok: false; status: 400 | 401 | 403 | 409 | 500; denialReason?: string; error?: string };
type GatewayResult = EncounterChartsResult & { auditHandledBy?: string; auditEventId?: string; idempotentReplay?: boolean };
export type EncounterChartsGateway = { execute(input: ChartGatewayInput): Promise<GatewayResult> };

export async function manageEncounterCharts({
  operation, workspaceId, actorUserId, input,
  permissionAdapter = createDemoChartSoapPermissionAdapter(),
  gateway = createMockEncounterChartsGateway(), auditGateway, auditRequestId,
}: {
  operation: ChartOperation; workspaceId: string; actorUserId: string | null; input: EncounterChartsInput;
  permissionAdapter?: WorkspacePermissionAdapter; gateway?: EncounterChartsGateway;
  auditGateway?: LiveMutationAuditOptions["auditGateway"]; auditRequestId?: string | null;
}): Promise<EncounterChartsResult> {
  const encounterId = normalize(input.encounterId);
  const chartId = normalize(input.chartId);
  const creationRequestId = normalize(input.creationRequestId);
  const clinicalAt = normalize(input.clinicalAt);
  const expectedUpdatedAt = normalize(input.expectedUpdatedAt);
  if (!encounterId || (operation === "create" && (!creationRequestId || !isUuid(creationRequestId)))
    || (operation === "sign" && (!chartId || !expectedUpdatedAt || !validDate(expectedUpdatedAt)))
    || (clinicalAt !== undefined && !validDate(clinicalAt))) {
    return { ok: false, status: 400, error: "invalid_input" };
  }
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId, workspaceId,
    requiredPermission: operation === "list" ? "chart:view" : "chart:update",
  });
  if (!permission.allowed || !actorUserId) return {
    ok: false, status: permission.denialReason === "unauthenticated" || !actorUserId ? 401 : 403,
    denialReason: permission.denialReason ?? "permission_missing",
  };
  const result = await gateway.execute({ operation, workspaceId, actorUserId, encounterId,
    actorDisplayName: permissionAdapter.users.find((user) => user.id === actorUserId)?.displayName,
    chartId, creationRequestId, clinicalAt, expectedUpdatedAt, requestId: auditRequestId });
  if (!result.ok || operation === "list") return result;
  if (!result.chart) return { ok: false, status: 500, error: "db_write_failed" };
  if (result.idempotentReplay) return { ok: true, status: 200, chart: result.chart, auditRecorded: false };
  let auditRecorded = result.auditHandledBy === "database_transaction" && result.auditRecorded === true
    && Boolean(result.auditEventId);
  if (!auditRecorded) {
    const audit = await emitLiveMutationAuditEvent({ auditGateway, input: {
      workspaceId, actorUserId, eventType: "chart.soap_saved", targetType: "soap_note",
      targetId: result.chart.id, encounterId, requestId: auditRequestId,
      after: { mode: operation === "create" ? "created" : "signed", chartId: result.chart.id },
      metadata: { source: "encounter-charts" },
    } });
    if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };
    auditRecorded = true;
  }
  return { ok: true, status: 200, chart: result.chart, auditRecorded };
}

export type EncounterChartsRpcClient = {
  rpc(name: "clair_list_encounter_charts" | "clair_create_encounter_chart" | "clair_ensure_encounter_first_chart" | "clair_sign_encounter_chart",
    args: Record<string, string | null>): Promise<{ data: unknown; error: { message?: string } | null }>;
};
export function createSupabaseEncounterChartsGateway(client: EncounterChartsRpcClient): EncounterChartsGateway {
  return { async execute(input) {
    const args: Record<string, string | null> = { p_workspace_id: input.workspaceId, p_encounter_id: input.encounterId };
    let name: Parameters<EncounterChartsRpcClient["rpc"]>[0] = "clair_list_encounter_charts";
    if (input.operation === "create") {
      name = "clair_create_encounter_chart";
      Object.assign(args, { p_actor_user_id: input.actorUserId, p_creation_request_id: input.creationRequestId!, p_clinical_at: input.clinicalAt ?? null });
    } else if (input.operation === "ensure") {
      name = "clair_ensure_encounter_first_chart";
      Object.assign(args, { p_actor_user_id: input.actorUserId });
    } else if (input.operation === "sign") {
      name = "clair_sign_encounter_chart";
      Object.assign(args, { p_actor_user_id: input.actorUserId, p_chart_id: input.chartId!,
        p_expected_updated_at: input.expectedUpdatedAt!, p_request_id: input.requestId ?? null });
    }
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const reason = mapChartSoapConflict(error.message);
      if (reason) return { ok: false, status: 409, denialReason: reason };
      if (/unauthenticated|actor_mismatch|permission_missing|workspace_membership_missing/.test(error.message ?? "")) {
        return { ok: false, status: 403, denialReason: "permission_missing" };
      }
      return { ok: false, status: 500, error: input.operation === "list" ? "db_read_failed" : "db_write_failed" };
    }
    if (input.operation === "list") {
      if (!Array.isArray(data)) return { ok: false, status: 500, error: "db_read_failed" };
      const charts = data.map(mapSoapNote);
      if (charts.some((note) => !note)) return { ok: false, status: 500, error: "db_read_failed" };
      return { ok: true, status: 200, charts: charts as SoapNote[] };
    }
    const chart = mapSoapNote(data);
    if (!chart) return { ok: false, status: 500, error: "db_write_failed" };
    const audit = data as { auditEventId?: string; idempotentReplay?: boolean };
    return { ok: true, status: 200, chart, auditHandledBy: "database_transaction", auditRecorded: true, auditEventId: audit.auditEventId, idempotentReplay: audit.idempotentReplay };
  } };
}

export function createMockEncounterChartsGateway(): EncounterChartsGateway {
  return { async execute(input) {
    const encounter = mockEncounters.find((row) => row.workspaceId === input.workspaceId && row.id === input.encounterId);
    if (!encounter || encounter.status === "cancelled") return { ok: false, status: 409, denialReason: "encounter_unavailable" };
    const charts = getMockEncounterCharts(input.workspaceId, input.encounterId);
    if (input.operation === "list") return { ok: true, status: 200, charts };
    if (encounter.status !== "in_consultation" && encounter.status !== "ordered") return { ok: false, status: 409, denialReason: "stale_status" };
    if (input.operation === "create") {
      const chart = createMockEncounterChart(input.workspaceId, input.encounterId, input.actorUserId, input.creationRequestId!, input.clinicalAt, input.actorDisplayName);
      if (chart.authorUserId !== input.actorUserId) return { ok: false, status: 403, denialReason: "actor_mismatch" };
      return { ok: true, status: 200, chart };
    }
    if (input.operation === "ensure") {
      const existing = charts.at(-1);
      if (existing) return { ok: true, status: 200, chart: existing, idempotentReplay: true };
      return { ok: true, status: 200, chart: createMockEncounterChart(
        input.workspaceId, input.encounterId, input.actorUserId, `initial-${input.encounterId}`, undefined, input.actorDisplayName,
      ) };
    }
    const chart = charts.find((row) => row.id === input.chartId);
    if (!chart) return { ok: false, status: 409, denialReason: "chart_unavailable" };
    if (chart.status === "signed" || chart.status === "amended") return { ok: true, status: 200, chart };
    if (chart.updatedAt !== input.expectedUpdatedAt) return { ok: false, status: 409, denialReason: "soap_note_conflict" };
    const timestamp = new Date(Math.max(Date.now(), Date.parse(chart.updatedAt) + 1)).toISOString();
    const signed: SoapNote = { ...chart, status: "signed", signedAt: timestamp, updatedAt: timestamp };
    putMockEncounterChart(input.workspaceId, signed);
    return { ok: true, status: 200, chart: signed };
  } };
}
function normalize(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function validDate(value: string) { return !Number.isNaN(Date.parse(value)); }
function isUuid(value: string) { return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value); }
