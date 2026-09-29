import { resolveWorkspacePermission, type WorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import { isIsoOperatingDate } from "@/lib/emr-domain/demo-date";
import { resolveBillingLifecycleStatus } from "./billing-data-contract";
import type { BillingQueueItem } from "./billing-queue";

export type BillingQueueGateway = {
  list(input: { workspaceId: string; date: string }): Promise<{ ok: true; rows: BillingQueueItem[] } | { ok: false; permissionDenied?: boolean }>;
};
export type BillingQueueReadResult = { ok: true; status: 200; rows: BillingQueueItem[] } | { ok: false; status: 400 | 401 | 403 | 500; denialReason?: string; error?: string };

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
export function parseBillingQueueItem(value: unknown, workspaceId: string): BillingQueueItem | null {
  const row = record(value), invoice = record(row?.invoice);
  if (!row || !invoice || invoice.workspaceId !== workspaceId ||
    ![invoice.id, invoice.encounterId, invoice.invoiceNo, invoice.createdAt].every(v => typeof v === "string" && v.length > 0) ||
    !Number.isFinite(Date.parse(String(invoice.createdAt))) ||
    !["draft", "issued", "paid", "refund_requested", "refunded", "voided"].includes(String(invoice.status)) ||
    (invoice.paymentState !== undefined && !["none", "unpaid", "paid", "failed", "refunded"].includes(String(invoice.paymentState))) ||
    typeof invoice.totalAmount !== "number" || !Number.isFinite(invoice.totalAmount) || invoice.totalAmount < 0 ||
    typeof row.lineCount !== "number" || !Number.isInteger(row.lineCount) || row.lineCount < 0 || typeof row.lineSummary !== "string") return null;
  const encounter = record(row.encounter);
  const patient = record(row.patient), guardian = record(row.guardian);
  const optionalTime = (key: string) => typeof invoice[key] === "string" && Number.isFinite(Date.parse(invoice[key] as string)) ? invoice[key] as string : undefined;
  return {
    invoice: { id: invoice.id as string, workspaceId, encounterId: invoice.encounterId as string, invoiceNo: invoice.invoiceNo as string,
      status: invoice.status as BillingQueueItem["invoice"]["status"], paymentState: invoice.paymentState as BillingQueueItem["invoice"]["paymentState"],
      unpaidReason: typeof invoice.unpaidReason === "string" ? invoice.unpaidReason : undefined,
      totalAmount: invoice.totalAmount, createdAt: invoice.createdAt as string, issuedAt: optionalTime("issuedAt"), billingRequestedAt: optionalTime("billingRequestedAt") },
    encounter: { receptionType: encounter?.receptionType as BillingQueueItem["encounter"]["receptionType"] },
    patient: typeof patient?.name === "string" ? { name: patient.name } : undefined,
    guardian: typeof guardian?.name === "string" ? { name: guardian.name } : undefined,
    lineCount: row.lineCount, lineSummary: row.lineSummary, requestedByName: typeof row.requestedByName === "string" ? row.requestedByName : "미지정",
  };
}

export async function readBillingQueue({ actorUserId, workspaceId, date, gateway, permissionAdapter }: {
  actorUserId: string | null; workspaceId: string; date: string | null; gateway?: BillingQueueGateway; permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<BillingQueueReadResult> {
  if (!date || !isIsoOperatingDate(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return { ok: false, status: 400, error: "invalid_operating_date" };
  const permission = resolveWorkspacePermission(permissionAdapter ?? { now: new Date().toISOString(), users: [], memberships: [] }, { sessionUserId: actorUserId, workspaceId, requiredPermission: "billing:view" });
  if (!permission.allowed) return { ok: false, status: permission.denialReason === "unauthenticated" ? 401 : 403, denialReason: permission.denialReason };
  try {
    const result = await gateway?.list({ workspaceId, date });
    if (!result?.ok) return result?.permissionDenied
      ? { ok: false, status: 403, denialReason: "permission_missing" }
      : { ok: false, status: 500, error: "db_read_failed" };
    const rows = result.rows.map(row => parseBillingQueueItem(row, workspaceId));
    if (rows.some(row => row === null)) return { ok: false, status: 500, error: "invalid_queue_response" };
    const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
    return { ok: true, status: 200, rows: (rows as BillingQueueItem[]).filter(row => {
      const requestedDate = formatter.format(new Date(row.invoice.billingRequestedAt ?? row.invoice.issuedAt ?? row.invoice.createdAt));
      const status = resolveBillingLifecycleStatus(row.invoice);
      return status === "waiting" || status === "unpaid" ? requestedDate <= date : requestedDate === date;
    }) };
  } catch { return { ok: false, status: 500, error: "db_read_failed" }; }
}

export type BillingQueueRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export function createSupabaseBillingQueueGateway(client: BillingQueueRpcClient): BillingQueueGateway {
  return { async list({ workspaceId, date }) {
    const rows: BillingQueueItem[] = [];
    for (let offset = 0; offset < 100000; offset += 200) {
      const result = await client.rpc("clair_list_billing_queue", { p_workspace_id: workspaceId, p_operating_date: date, p_offset: offset, p_limit: 200 });
      if (result.error) return { ok: false, permissionDenied: record(result.error)?.code === "42501" };
      if (!Array.isArray(result.data)) return { ok: false };
      for (const value of result.data) {
        const row = parseBillingQueueItem(value, workspaceId);
        if (!row) return { ok: false };
        rows.push(row);
      }
      if (result.data.length < 200) return { ok: true, rows };
    }
    return { ok: false };
  } };
}
