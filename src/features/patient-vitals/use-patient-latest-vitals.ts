"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatPatientVitalDisplayItemsForSettings,
  type PatientVitalDisplayItem,
  type PatientVitalMeasurement,
  type PatientVitalSummary,
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
      summary?: PatientVitalSummary;
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
  const scope = `${workspaceId}:${encounterId ?? ""}`;
  const { snapshot: vitalSettings, status: vitalSettingsStatus } = useWorkspaceVitalSettings({ workspaceId });
  const requestIdRef = useRef(0);
  const [result, setResult] = useState<
    | { scope?: string; status: "loading"; vital?: PatientVitalMeasurement | null; summary?: PatientVitalSummary }
    | {
        canWriteVitals: boolean;
        scope: string;
        status: "ready";
        vital: PatientVitalMeasurement | null;
        summary?: PatientVitalSummary;
      }
    | { scope?: string; status: "error"; vital?: PatientVitalMeasurement | null; summary?: PatientVitalSummary }
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
          scope,
          status: "ready",
          vital: body.vital,
          summary: body.summary,
        });
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setResult({ scope, status: "error" });
      });
    return () => { requestIdRef.current += 1; };
  }, [encounterId, requestLatestVital, scope]);

  const refresh = useCallback(async () => {
    if (!encounterId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setResult((current) => current.scope === scope
      ? { ...current, status: "loading" }
      : { scope, status: "loading" });
    try {
      const body = await requestLatestVital();
      if (requestIdRef.current !== requestId) return;
      setResult({
        canWriteVitals: body.canWriteVitals,
        scope,
        status: "ready",
        vital: body.vital,
        summary: body.summary,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setResult((current) => ({ ...current, scope, status: "error" }));
      throw error;
    }
  }, [encounterId, requestLatestVital, scope]);

  // Keep the existing callback contract. A corrected old row must not replace
  // the latest summary; refresh the authoritative per-field projection.
  const replaceVital: (vital: PatientVitalMeasurement) => Promise<void> = refresh;

  return useMemo(
    () => ({
      canWriteVitals:
        result.status === "ready" && result.scope === scope
          ? result.canWriteVitals
          : false,
      items:
        result.scope === scope && result.vital !== undefined
          ? formatLatestSummaryItems(result.summary, result.vital, vitalSettings)
          : fallbackItems
            ? orderFallbackVitalItems(fallbackItems, vitalSettings)
            : formatPatientVitalDisplayItemsForSettings(undefined, vitalSettings),
      refresh,
      replaceVital,
      status: result.scope === scope ? result.status : "loading",
      vital:
        result.status === "ready" && result.scope === scope
          ? result.vital
          : null,
      vitalSettings,
      vitalSettingsStatus,
    }),
    [
      scope,
      fallbackItems,
      refresh,
      replaceVital,
      result,
      vitalSettings,
      vitalSettingsStatus,
    ],
  );
}

function formatLatestSummaryItems(
  summary: PatientVitalSummary | undefined,
  vital: PatientVitalMeasurement | null,
  settings: WorkspaceVitalSettingsSnapshot,
) {
  const items = formatPatientVitalDisplayItemsForSettings(summary?.values ?? vital, settings);
  const fieldsByLabel = {
    체중: ["weightKg"], 체온: ["temperatureC"], 심박수: ["heartRateBpm"], 호흡: ["respiratoryRateRpm"],
    혈압: ["bloodPressureSystolicMmhg", "bloodPressureDiastolicMmhg"],
  } as const;
  return items.map((item) => {
    const fields = fieldsByLabel[item.label as keyof typeof fieldsByLabel] ?? [];
    const times = fields.flatMap((field) => {
      const time = summary?.measuredAtByField[field];
      if (!time) return [];
      const label = field === "bloodPressureSystolicMmhg" ? "수축기 " : field === "bloodPressureDiastolicMmhg" ? "이완기 " : "";
      return [`${label}${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time))} 측정`];
    });
    return { ...item, measurementTooltip: times.length ? times.join(" · ") : undefined };
  });
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
