"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatPatientVitalDisplayItems,
  type PatientVitalDisplayItem,
  type PatientVitalMeasurement,
} from "@/features/patient-vitals/patient-vital-types";

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
          ? formatPatientVitalDisplayItems(result.vital)
          : fallbackItems ?? formatPatientVitalDisplayItems(),
      status: result.encounterId === encounterId ? result.status : "loading",
    }),
    [encounterId, fallbackItems, result],
  );
}
