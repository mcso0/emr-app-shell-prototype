import {
  appendLiveAuditEvent,
  createMockLiveAuditAppendGateway,
  type LiveAuditAppendGateway,
  type LiveAuditEventInput,
  type LiveAuditEventRecord,
} from "@/features/audit/server-audit-log-persistence-core";

export type LiveMutationAuditOptions = {
  auditGateway?: LiveAuditAppendGateway | null;
  auditNow?: () => string;
  auditRequestId?: string | null;
};

export type LiveMutationAuditResult =
  | { ok: true; event?: LiveAuditEventRecord; skipped?: true }
  | { ok: false; error: "audit_write_failed" };

export async function emitLiveMutationAuditEvent({
  auditGateway,
  auditNow,
  input,
}: {
  auditGateway?: LiveAuditAppendGateway | null;
  auditNow?: () => string;
  input: LiveAuditEventInput;
}): Promise<LiveMutationAuditResult> {
  if (auditGateway === null) return { ok: true, skipped: true };

  const result = await appendLiveAuditEvent({
    gateway: auditGateway ?? createMockLiveAuditAppendGateway(),
    input,
    now: auditNow,
  });

  return result.ok
    ? { ok: true, event: result.event }
    : { ok: false, error: "audit_write_failed" };
}

export function getAuditRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || null;
}
