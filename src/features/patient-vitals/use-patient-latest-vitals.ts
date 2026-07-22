"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatPatientVitalDisplayItemsForSettings,
  type PatientVitalDisplayItem,
  type PatientVitalMeasurement,
} from "@/features/patient-vitals/patient-vital-types";
import { useWorkspaceVitalSettings } from "@/features/patient-vitals/use-workspace-vital-settings";
import {
  getEnabledWorkspaceVitalSettings,
  type WorkspaceVitalKey,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";

type PatientLatestVitalResponse =
  | { ok: true; status: 200; vital: PatientVitalMeasurement | null }
  | { ok: false; status: number; denialReason?: string; error?: string };

export function usePatientLatestVitalItems({
  encounterId,
  fallbackItems,
  workspaceId,
}: {
  encounterId?: string | null;
  fallbackItems?: PatientVitalDisplayItem[];
  workspaceId: string;
}) {
  const { snapshot: vitalSettings } = useWorkspaceVitalSettings({ workspaceId });
  const [result, setResult] = useState<
    | { encounterId?: string; status: "loading" }
    | { encounterId: string; status: "ready"; vital: PatientVitalMeasurement | null }
    | { encounterId?: string; status: "error" }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (!encounterId) return;
    void fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/patient-vitals/latest?encounterId=${encodeURIComponent(encounterId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const body = (await response.json()) as PatientLatestVitalResponse;
        if (!response.ok || !body.ok) throw new Error("patient_latest_vital_unavailable");
        return body.vital;
      })
      .then((vital) => {
        if (!cancelled) setResult({ encounterId, status: "ready", vital });
      })
      .catch(() => {
        if (!cancelled) setResult({ encounterId, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [encounterId, workspaceId]);

  return useMemo(
    () => ({
      items:
        result.status === "ready" && result.encounterId === encounterId
          ? formatPatientVitalDisplayItemsForSettings(result.vital, vitalSettings)
          : fallbackItems
            ? orderFallbackVitalItems(fallbackItems, vitalSettings)
            : formatPatientVitalDisplayItemsForSettings(undefined, vitalSettings),
      status: result.encounterId === encounterId ? result.status : "loading",
    }),
    [encounterId, fallbackItems, result, vitalSettings],
  );
}

const fallbackLabelsByKey: Record<WorkspaceVitalKey, string[]> = {
  weight: ["체중"],
  temperature: ["체온"],
  heart_rate: ["심박수"],
  respiratory_rate: ["호흡", "호흡수"],
  blood_pressure: ["혈압"],
};

function orderFallbackVitalItems(
  fallbackItems: PatientVitalDisplayItem[],
  settings: WorkspaceVitalSettingsSnapshot,
) {
  return getEnabledWorkspaceVitalSettings(settings).map((setting) => {
    const fallback = fallbackItems.find((item) =>
      fallbackLabelsByKey[setting.key].includes(item.label),
    );
    return fallback ?? formatPatientVitalDisplayItemsForSettings(undefined, {
      ...settings,
      items: [{ ...setting, sortOrder: 0 }],
    })[0];
  });
}
