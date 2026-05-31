export type SupabaseEncounterIdBridgeClient = {
  rpc(
    functionName: "clair_resolve_encounter_id",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type EncounterIdBridgeResult =
  | { ok: true; encounterId: string }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: { encounterId: string };
    }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const stagingDemoEncounterNoCandidates: Record<string, string[]> = {
  "encounter-coco-260501": ["E-260501-0001", "E-DEN194-0005"],
  "encounter-dubu-260501": ["E-260501-0002", "E-DEN194-0003"],
  "encounter-haru-260430": ["E-260430-0005", "E-DEN194-0004"],
  "encounter-kong-260501": ["E-260501-0003", "E-DEN194-0001"],
  "encounter-nabi-260414": ["E-260414-0007", "E-DEN194-0002"],
};

export async function resolveServerChartEncounterId({
  client,
  encounterId,
  workspaceId,
}: {
  client?: SupabaseEncounterIdBridgeClient | null;
  encounterId: string | null | undefined;
  workspaceId: string;
}): Promise<EncounterIdBridgeResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);
  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "진료 차트를 선택해 주세요." },
    };
  }

  if (!client || uuidPattern.test(normalizedEncounterId)) {
    return { ok: true, encounterId: normalizedEncounterId };
  }

  const candidateEncounterIds = [
    normalizedEncounterId,
    ...(stagingDemoEncounterNoCandidates[normalizedEncounterId] ?? []),
  ].filter(
    (candidate, index, candidates) => candidates.indexOf(candidate) === index,
  );

  for (const candidateEncounterId of candidateEncounterIds) {
    const { data, error } = await client.rpc("clair_resolve_encounter_id", {
      p_workspace_id: workspaceId,
      p_encounter_id: candidateEncounterId,
    });

    if (error) {
      if (error.message?.includes("encounter_unavailable")) {
        continue;
      }
      return { ok: false, status: 500, error: "db_read_failed" };
    }

    if (typeof data !== "string" || !uuidPattern.test(data)) {
      return { ok: false, status: 500, error: "db_read_failed" };
    }

    return { ok: true, encounterId: data };
  }

  return { ok: false, status: 409, denialReason: "encounter_unavailable" };
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
