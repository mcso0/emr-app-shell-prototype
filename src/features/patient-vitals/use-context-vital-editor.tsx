"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChartVitalDialog } from "@/features/chart/components/chart-vital-dialog";
import type { ContextBarVitalAction } from "@/components/emr/patient-context-bar";
import type { usePatientLatestVitalItems } from "@/features/patient-vitals/use-patient-latest-vitals";

type LatestVitals = ReturnType<typeof usePatientLatestVitalItems>;

export function useContextVitalEditor({
  encounterId,
  encounterIsActive,
  latestVitals,
  workspaceId,
}: {
  encounterId?: string;
  encounterIsActive: boolean;
  latestVitals: LatestVitals;
  workspaceId: string;
}) {
  const [openEncounterId, setOpenEncounterId] = useState<string | null>(null);
  const isCurrentMeasurement = latestVitals.vital?.encounterId === encounterId;
  const disabled = !encounterIsActive || !latestVitals.canWriteVitals || latestVitals.vitalSettingsStatus !== "ready";
  const disabledReason = !encounterIsActive
    ? "진료가 끝난 접수의 바이탈은 여기서 수정할 수 없어요."
    : latestVitals.vitalSettingsStatus !== "ready"
      ? "바이탈 입력 설정을 확인하지 못했어요."
      : latestVitals.status === "loading"
      ? "바이탈 입력 권한을 확인하고 있어요."
      : latestVitals.status === "error"
        ? "바이탈 입력 권한을 확인하지 못했어요."
        : "바이탈을 입력할 권한이 없어요.";
  const vitalAction: ContextBarVitalAction = {
    ariaLabel: isCurrentMeasurement ? "오늘 바이탈 수정" : "오늘 바이탈 입력",
    disabled,
    disabledReason,
    onActivate: () => {
      if (encounterId && !disabled) setOpenEncounterId(encounterId);
    },
  };

  return {
    vitalAction,
    vitalDialog: encounterId ? (
      <ChartVitalDialog
        encounterId={encounterId}
        measurement={isCurrentMeasurement ? latestVitals.vital ?? undefined : undefined}
        mode="in_consultation"
        open={openEncounterId === encounterId}
        onOpenChange={(open) => setOpenEncounterId(open ? encounterId : null)}
        onSaved={async (vital) => {
          await latestVitals.replaceVital(vital);
          toast.success("바이탈을 저장했어요.");
        }}
        vitalSettings={latestVitals.vitalSettings}
        workspaceId={workspaceId}
      />
    ) : null,
  };
}
