export * from "@/features/reception/server-encounter-vital-core";

import { parsePatientVitalMeasurement } from "@/features/patient-vitals/server-patient-vital";
import type { ReceptionEncounterVitalGateway } from "@/features/reception/server-encounter-vital-core";

export type SupabaseReceptionEncounterVitalClient = {
  rpc(
    functionName: "clair_get_reception_encounter_vital",
    args: {
      p_encounter_id: string;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionEncounterVitalGateway(
  client: SupabaseReceptionEncounterVitalClient,
): ReceptionEncounterVitalGateway {
  return {
    async readEncounterVital({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_get_reception_encounter_vital",
        {
          p_encounter_id: encounterId,
          p_workspace_id: workspaceId,
        },
      );
      if (error) {
        return {
          ok: false as const,
          error: error.message?.includes("encounter_unavailable")
            ? ("encounter_unavailable" as const)
            : ("db_read_failed" as const),
        };
      }
      if (!isRecord(data)) {
        return { ok: false as const, error: "db_read_failed" as const };
      }
      if (data.vital === null || data.vital === undefined) {
        return { ok: true as const, vital: null };
      }

      const vital = parsePatientVitalMeasurement(data.vital);
      return vital
        ? { ok: true as const, vital }
        : { ok: false as const, error: "db_read_failed" as const };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
