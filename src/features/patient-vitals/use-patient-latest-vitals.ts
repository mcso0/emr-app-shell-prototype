"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePatientVitalActorScope } from "./use-patient-vital-actor-scope";
import { createPatientLatestVitalsResource } from "./patient-latest-vitals-resource";
import {
  formatPatientVitalDisplayItemsForSettings,
  type PatientVitalDisplayItem,
  type PatientVitalMeasurement,
  type PatientVitalSummary,
} from "@/features/patient-vitals/patient-vital-types";
import {
  getEnabledWorkspaceVitalSettings,
  type WorkspaceVitalKey,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";

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
  const actorScope = usePatientVitalActorScope();
  const actorHeaderKey = JSON.stringify(Array.from(new Headers(actorHeaders).entries()).sort());
  const scope = JSON.stringify([workspaceId, encounterId ?? "", actorScope, actorHeaderKey]);
  const resource = useMemo(() => createPatientLatestVitalsResource({
    key: scope,
    enabled: actorScope !== null,
    workspaceId,
    encounterId,
    actorHeaders: Object.fromEntries(JSON.parse(actorHeaderKey) as [string, string][]),
  }), [scope, workspaceId, encounterId, actorHeaderKey, actorScope]);
  const { latest: result, settings: vitalSettings, settingsStatus: vitalSettingsStatus } = useSyncExternalStore(
    resource.subscribe, resource.getSnapshot, resource.getServerSnapshot,
  );
  const refresh = resource.refresh;

  // Keep the existing callback contract. A corrected old row must not replace
  // the latest summary; refresh the authoritative per-field projection.
  const replaceVital: (vital: PatientVitalMeasurement) => Promise<void> = refresh;

  return useMemo(
    () => ({
      canWriteVitals:
        result.status === "ready"
          ? result.canWriteVitals
          : false,
      items:
        result.vital !== undefined
          ? formatLatestSummaryItems(result.summary, result.vital, vitalSettings)
          : fallbackItems
            ? orderFallbackVitalItems(fallbackItems, vitalSettings)
            : formatPatientVitalDisplayItemsForSettings(undefined, vitalSettings).map((item) => ({
                ...item,
                loading: result.status === "loading",
              })),
      refresh,
      replaceVital,
      status: result.status,
      vital:
        result.status === "ready"
          ? result.vital
          : null,
      vitalSettings,
      vitalSettingsStatus,
    }),
    [
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
