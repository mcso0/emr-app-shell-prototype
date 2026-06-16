"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CdsActionsRotateCcwIcon } from "@/components/cds-icons/actions-and-controls";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import type { AuthSession } from "@/features/auth/auth-client";
import {
  PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME,
  PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  isPreparedEmptyClinicWorkspace,
} from "@/lib/emr-domain/demo-workspaces";

type DemoSessionResetControlProps = {
  session: AuthSession | null;
  showTrailingDivider?: boolean;
  workspaceId: string;
};

export function DemoSessionResetControl({
  session,
  showTrailingDivider = false,
  workspaceId,
}: DemoSessionResetControlProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const showResetControl =
    session?.role === "hospital_admin" || session?.role === "supabase";

  if (!isPreparedEmptyClinicWorkspace(workspaceId) || !showResetControl) {
    return null;
  }

  async function resetSession() {
    if (resetting) return;

    setResetting(true);

    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/demo/session-reset`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...getDemoActorHeaders(session),
          },
          body: JSON.stringify({ workspaceId }),
        }
      );
      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            counts?: { encounters?: number; generatedPatients?: number };
            mode?: string;
            denialReason?: string;
            error?: string;
          }
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.denialReason ?? result?.error ?? "demo_session_reset_failed");
      }

      clearDemoBrowserState(workspaceId);
      setConfirmOpen(false);
      toast.success(getResetSuccessMessage(result));
      router.refresh();
    } catch (error) {
      toast.error(getResetFailureMessage(error));
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-[var(--clair-radius-atomic-8)] px-2.5 text-[12px] font-semibold"
        data-testid="demo-session-reset-button"
        disabled={resetting}
        aria-busy={resetting}
        onClick={() => setConfirmOpen(true)}
      >
        <CdsActionsRotateCcwIcon className="size-4" />
        {resetting ? "초기화 중" : "세션 초기화"}
      </Button>
      {showTrailingDivider ? (
        <div
          className="h-[var(--emr-topbar-divider-height)] w-[var(--emr-topbar-divider-width)] shrink-0 bg-[var(--emr-topbar-divider)]"
          aria-hidden="true"
        />
      ) : null}
      <Dialog open={confirmOpen} onOpenChange={(open) => !resetting && setConfirmOpen(open)}>
        <EmrConfirmDialogContent
          title="데모 세션을 처음 상태로 초기화할까?"
          description={
            <span>
              {PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME} synthetic demo data만
              대상으로 접수, 진료, 오더, 처리, 수납 흐름을 비워. 실제 환자/보호자/결제/외부
              연동 데이터는 대상이 아니야.
            </span>
          }
          cancelLabel="취소"
          confirmLabel={resetting ? "초기화 중" : "초기화"}
          confirmButtonVariant="destructive"
          closeAriaLabel="데모 세션 초기화 확인 닫기"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void resetSession()}
        />
      </Dialog>
    </>
  );
}

function getResetSuccessMessage(result: {
  counts?: { encounters?: number; generatedPatients?: number };
  mode?: string;
}) {
  if (result.mode === "local_only") {
    return "브라우저 데모 상태를 초기화했어.";
  }

  const encounterCount = result.counts?.encounters ?? 0;
  const patientCount = result.counts?.generatedPatients ?? 0;
  return `데모 세션을 초기화했어. 접수 ${encounterCount}건, 신규 환자 ${patientCount}건 정리됨.`;
}

function getResetFailureMessage(error: unknown) {
  if (!(error instanceof Error)) return "데모 세션 초기화에 실패했어.";
  if (error.message === "workspace_admin_required") {
    return "병원 관리자 권한이 있어야 초기화할 수 있어.";
  }
  if (error.message === "unsupported_workspace") {
    return "Cheongdam synthetic demo workspace에서만 초기화할 수 있어.";
  }
  return "데모 세션 초기화에 실패했어.";
}

function clearDemoBrowserState(workspaceId: string) {
  if (workspaceId !== PREPARED_EMPTY_CLINIC_WORKSPACE_ID) return;

  window.sessionStorage.removeItem("clair-demo-client-session-id");
  window.localStorage.removeItem(`clair-emr:chart-selected-encounter:v1:${workspaceId}`);
  window.localStorage.removeItem("clair-emr:chart-live-encounter-handoffs:v1");
}
