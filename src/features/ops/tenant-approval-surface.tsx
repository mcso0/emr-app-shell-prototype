import {
  getTenantApplicationWorkspaceGate,
  tenantApplicationAuditHookTypes,
  tenantApplicationStatusLabels,
} from "@/features/ops/tenant-application-model";
import { opsTenantApplications } from "@/features/ops/tenant-approval-data";
import {
  getTenantOperationalAccessPolicy,
  tenantOperationalStatuses,
} from "@/features/ops/tenant-status-policy";

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusClass(status: keyof typeof tenantApplicationStatusLabels) {
  if (status === "approved") {
    return "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]";
  }

  if (status === "rejected") {
    return "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]";
  }

  if (status === "on_hold") {
    return "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]";
  }

  return "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]";
}

export function TenantApprovalSurface() {
  const pendingCount = opsTenantApplications.filter(
    (application) => application.status === "pending_review"
  ).length;
  const approvedWithoutWorkspaceCount = opsTenantApplications.filter((application) => {
    const gate = getTenantApplicationWorkspaceGate(application);
    return gate.canCreateWorkspace;
  }).length;
  const connectedCount = opsTenantApplications.filter(
    (application) => application.workspaceId
  ).length;

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] px-5 py-7 text-foreground">
      <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-border pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-[var(--emr-status-info-text)]">
                CLAiR ops admin
              </p>
              <h1 className="text-[28px] font-semibold leading-9 tracking-normal">
                CLAiR tenant approvals
              </h1>
              <p className="max-w-[720px] text-[14px] leading-6 text-muted-foreground">
                승인 대기 병원, 보류/반려 상태, 워크스페이스 생성 전후 상태를 한 화면에서
                확인합니다. 미승인 병원은 workspace/member flow에 들어가지 않습니다.
              </p>
            </div>
            <div className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-3 py-2 text-[12px] leading-5 text-[var(--emr-status-warning-text)]">
              Local mock surface. DEN-157에서 server operator guard와 persistence action을 연결합니다.
            </div>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryStat label="승인 대기" value={pendingCount} />
          <SummaryStat label="생성 가능" value={approvedWithoutWorkspaceCount} />
          <SummaryStat label="워크스페이스 연결" value={connectedCount} />
        </div>

        <section className="overflow-hidden rounded-[var(--clair-radius-md)] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-[16px] font-semibold leading-6">Tenant application queue</h2>
              <p className="text-[12px] text-muted-foreground">
                상태 전환은 mock/read-only이며 실제 승인 mutation은 후속 server action 범위입니다.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left text-[13px]">
              <thead className="bg-[var(--emr-surface-subpanel)] text-[12px] text-muted-foreground">
                <tr>
                  <th className="border-b border-border px-4 py-3 font-medium">병원</th>
                  <th className="border-b border-border px-4 py-3 font-medium">상태</th>
                  <th className="border-b border-border px-4 py-3 font-medium">워크스페이스</th>
                  <th className="border-b border-border px-4 py-3 font-medium">최초 관리자 초대</th>
                  <th className="border-b border-border px-4 py-3 font-medium">접수/검토</th>
                </tr>
              </thead>
              <tbody>
                {opsTenantApplications.map((application) => {
                  const gate = getTenantApplicationWorkspaceGate(application);

                  return (
                    <tr key={application.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-foreground">{application.hospitalName}</div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {application.representativeName} · {application.contactEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-[var(--clair-radius-sm)] border px-2 py-1 text-[12px] font-semibold ${getStatusClass(application.status)}`}
                        >
                          {tenantApplicationStatusLabels[application.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground">{gate.label}</div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {application.workspaceId ?? gate.reason ?? "approved"}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {application.firstAdminInvitationId ?? "승인 후 DEN-157에서 생성"}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        <div>접수 {formatDate(application.submittedAt)}</div>
                        <div>검토 {formatDate(application.reviewedAt)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[var(--clair-radius-md)] border border-border bg-card p-4">
            <h2 className="text-[16px] font-semibold leading-6">Tenant application state machine</h2>
            <div className="mt-3 grid gap-2 text-[13px] text-muted-foreground sm:grid-cols-4">
              <StateStep label="pending_review" description="운영자 검토 대기" />
              <StateStep label="on_hold" description="추가 확인 필요" />
              <StateStep label="approved" description="workspace 생성 가능" />
              <StateStep label="rejected" description="workspace flow 차단" />
            </div>
          </div>

          <div className="rounded-[var(--clair-radius-md)] border border-border bg-card p-4">
            <h2 className="text-[16px] font-semibold leading-6">Audit hook points</h2>
            <ul className="mt-3 flex flex-col gap-2 text-[13px] text-muted-foreground">
              {tenantApplicationAuditHookTypes.map((type) => (
                <li key={type}>
                  <code className="rounded-[var(--clair-radius-sm)] bg-[var(--emr-surface-subpanel)] px-2 py-1 text-[12px] text-foreground">
                    {type}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[var(--clair-radius-md)] border border-border bg-card p-4">
            <h2 className="text-[16px] font-semibold leading-6">Tenant status policy</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[680px] w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--emr-surface-subpanel)] text-[12px] text-muted-foreground">
                  <tr>
                    <th className="border-b border-border px-3 py-2 font-medium">Status</th>
                    <th className="border-b border-border px-3 py-2 font-medium">Workspace</th>
                    <th className="border-b border-border px-3 py-2 font-medium">First admin</th>
                    <th className="border-b border-border px-3 py-2 font-medium">Staff invites</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantOperationalStatuses.map((status) => {
                    const policy = getTenantOperationalAccessPolicy(status);

                    return (
                      <tr key={status} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 font-semibold text-foreground">{status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{policy.workspaceEntry}</td>
                        <td className="px-3 py-2 text-muted-foreground">{policy.firstAdminInvite}</td>
                        <td className="px-3 py-2 text-muted-foreground">{policy.staffInvites}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
              <code className="rounded-[var(--clair-radius-sm)] bg-[var(--emr-surface-subpanel)] px-1.5 py-0.5 text-foreground">
                ops.tenant_status_changed
              </code>{" "}
              audit event is required before status mutation becomes live.
            </p>
          </div>

          <div className="rounded-[var(--clair-radius-md)] border border-border bg-card p-4">
            <h2 className="text-[16px] font-semibold leading-6">Project 03 invite handoff</h2>
            <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-5 text-muted-foreground">
              <li>Tenant must be approved and operational status must be trial or active.</li>
              <li>Workspace and first hospital_admin invitation must already exist.</li>
              <li>Suspended or archived tenants cannot create staff invitations.</li>
              <li>Real email delivery remains approval-gated.</li>
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--clair-radius-md)] border border-border bg-card px-4 py-3">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-8">{value}</div>
    </div>
  );
}

function StateStep({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-[var(--clair-radius-sm)] border border-border bg-[var(--emr-surface-subpanel)] px-3 py-2">
      <div className="font-semibold text-foreground">{label}</div>
      <div className="mt-1 text-[12px]">{description}</div>
    </div>
  );
}
