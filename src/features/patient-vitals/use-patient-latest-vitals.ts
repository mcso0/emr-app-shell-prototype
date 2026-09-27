"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  | {
      ok: true;
      status: 200;
      canWriteVitals: boolean;
      vital: PatientVitalMeasurement | null;
    }
  | { ok: false; status: number; denialReason?: string; error?: string };

export function usePatientLatestVitalItems({
  actorHeaders,
  encounterId,
  fallbackItems,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId?: string | null;
  fallbackItems?: PatientVitalDisplayItem[];
  workspaceId: string;
}) {
  const { snapshot: vitalSettings, status: vitalSettingsStatus } = useWorkspaceVitalSettings({ workspaceId });
  const requestIdRef = useRef(0);
  const [result, setResult] = useState<
    | { encounterId?: string; status: "loading" }
    | {
        canWriteVitals: boolean;
        encounterId: string;
        status: "ready";
        vital: PatientVitalMeasurement | null;
      }
    | { encounterId?: string; status: "error" }
  >({ status: "loading" });

  const requestLatestVital = useCallback(async () => {
    if (!encounterId) throw new Error("patient_latest_vital_unavailable");
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/patient-vitals/latest?encounterId=${encodeURIComponent(encounterId)}`,
      { cache: "no-store", headers: actorHeaders },
    );
    const body = (await response.json()) as PatientLatestVitalResponse;
    if (!response.ok || !body.ok) {
      throw new Error("patient_latest_vital_unavailable");
    }
    return body;
  }, [actorHeaders, encounterId, workspaceId]);

  useEffect(() => {
    if (!encounterId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void requestLatestVital()
      .then((body) => {
        if (requestIdRef.current !== requestId) return;
        setResult({
          canWriteVitals: body.canWriteVitals,
          encounterId,
          status: "ready",
          vital: body.vital,
        });
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setResult({ encounterId, status: "error" });
      });
  }, [encounterId, requestLatestVital]);

  const refresh = useCallback(async () => {
    if (!encounterId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setResult({ encounterId, status: "loading" });
    try {
      const body = await requestLatestVital();
      if (requestIdRef.current !== requestId) return;
      setResult({
        canWriteVitals: body.canWriteVitals,
        encounterId,
        status: "ready",
        vital: body.vital,
      });
    } catch {
      if (requestIdRef.current !== requestId) return;
      setResult({ encounterId, status: "error" });
    }
  }, [encounterId, requestLatestVital]);

  const replaceVital = useCallback(
    (vital: PatientVitalMeasurement) => {
      if (!encounterId) return;
      setResult((current) => ({
        canWriteVitals:
          current.status === "ready" && current.encounterId === encounterId
            ? current.canWriteVitals
            : false,
        encounterId,
        status: "ready",
        vital,
      }));
    },
    [encounterId],
  );

  return useMemo(
    () => ({
      canWriteVitals:
        result.status === "ready" && result.encounterId === encounterId
          ? result.canWriteVitals
          : false,
      items:
        result.status === "ready" && result.encounterId === encounterId
          ? formatPatientVitalDisplayItemsForSettings(result.vital, vitalSettings)
          : fallbackItems
            ? orderFallbackVitalItems(fallbackItems, vitalSettings)
            : formatPatientVitalDisplayItemsForSettings(undefined, vitalSettings),
      refresh,
      replaceVital,
      status: result.encounterId === encounterId ? result.status : "loading",
      vital:
        result.status === "ready" && result.encounterId === encounterId
          ? result.vital
          : null,
      vitalSettings,
      vitalSettingsStatus,
    }),
    [
      encounterId,
      fallbackItems,
      refresh,
      replaceVital,
      result,
      vitalSettings,
      vitalSettingsStatus,
    ],
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
