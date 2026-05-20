import { Suspense } from "react";
import { AuthGate } from "@/features/auth/auth-gate";
import { TenantApprovalSurface } from "@/features/ops/tenant-approval-surface";

export default function OpsTenantApprovalsPage() {
  return (
    <Suspense fallback={<OpsTenantApprovalsLoading />}>
      <AuthGate>
        <TenantApprovalSurface />
      </AuthGate>
    </Suspense>
  );
}

function OpsTenantApprovalsLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--emr-surface-muted)] px-6 text-foreground">
      <div className="rounded-[var(--clair-radius-lg)] border border-border bg-card px-6 py-5 text-center shadow-sm">
        <p className="text-[14px] font-semibold">운영 승인 화면 준비 중</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Tenant application surface를 불러옵니다.
        </p>
      </div>
    </main>
  );
}
