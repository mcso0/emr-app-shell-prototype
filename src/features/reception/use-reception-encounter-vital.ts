"use client";

import { useCallback, useEffect, useState } from "react";
import type { PatientVitalMeasurement } from "@/features/patient-vitals/patient-vital-types";
import type { ReceptionEncounterVitalReadResponse } from "@/features/reception/encounter-vital";

type ReceptionEncounterVitalState =
  | { status: "loading"; vital: null }
  | { status: "ready"; vital: PatientVitalMeasurement | null }
  | { status: "denied"; vital: null }
  | { status: "error"; vital: null };

export function useReceptionEncounterVital({
  encounterId,
  workspaceId,
}: {
  encounterId: string;
  workspaceId: string;
}) {
  const [state, setState] = useState<ReceptionEncounterVitalState>({
    status: "loading",
    vital: null,
  });

  const reload = useCallback(async () => {
    setState({ status: "loading", vital: null });
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/encounters/${encodeURIComponent(encounterId)}/vital`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as ReceptionEncounterVitalReadResponse;
      if (response.status === 401 || response.status === 403) {
        setState({ status: "denied", vital: null });
        return;
      }
      if (!response.ok || !body.ok) {
        setState({ status: "error", vital: null });
        return;
      }
      setState({ status: "ready", vital: body.vital });
    } catch {
      setState({ status: "error", vital: null });
    }
  }, [encounterId, workspaceId]);

  useEffect(() => {
    // Fetching is the external synchronization owned by this resource hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { ...state, reload };
}
