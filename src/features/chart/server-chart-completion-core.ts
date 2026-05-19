import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockEncounters } from "@/mocks/emr-domain";
import type { Encounter, EncounterStatus } from "@/types/emr-domain";

export type ChartCompletionInput = {
  encounterId?: string;
};

export type ChartCompletionSnapshot = {
  encounterId: string;
  workspaceId: string;
  status: EncounterStatus;
  chartCompletedAt?: string;
  chartCompletedByUserId?: string;
  updatedAt: string;
};

export type ChartCompletionGatewayResult =
  | { ok: true; completion: ChartCompletionSnapshot }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartCompletionGateway = {
  completeChart(input: {
    actorUserId: string;
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartCompletionGatewayResult>;
  readCompletion(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartCompletionGatewayResult>;
};

export type ChartCompletionReadResult =
  | {
      ok: true;
      status: 200;
      completion: ChartCompletionSnapshot;
      enforcedBy: "chart-completion-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartCompletionSaveResult =
  | {
      ok: true;
      status: 200;
      completion: ChartCompletionSnapshot;
      enforcedBy: "chart-completion-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<keyof ChartCompletionInput, string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockChartCompletionStore = new Map<string, ChartCompletionSnapshot>();

export async function readChartCompletion({
  actorUserId,
  encounterId,
  gateway = createMockChartCompletionGateway(),
  permissionAdapter = createDemoChartCompletionPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<ChartCompletionGateway, "readCompletion">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartCompletionReadResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);

  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "진료 차트를 선택해 주세요." },
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.readCompletion({
    encounterId: normalizedEncounterId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    completion: result.completion,
    enforcedBy: "chart-completion-persistence",
  };
}

export async function completeChart({
  actorUserId,
  gateway = createMockChartCompletionGateway(),
  input,
  permissionAdapter = createDemoChartCompletionPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<ChartCompletionGateway, "completeChart">;
  input: ChartCompletionInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartCompletionSaveResult> {
  const normalizedEncounterId = trimToUndefined(input.encounterId);

  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "진료 차트를 선택해 주세요." },
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:update",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.completeChart({
    actorUserId: actorUserId ?? "",
    encounterId: normalizedEncounterId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    completion: result.completion,
    enforcedBy: "chart-completion-persistence",
  };
}

export function createMockChartCompletionGateway(
  dataset: {
    encounters?: Encounter[];
  } = {
    encounters: mockEncounters,
  },
  now = () => new Date().toISOString()
): ChartCompletionGateway {
  const encounters = dataset.encounters ?? [];

  return {
    async completeChart({ actorUserId, encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      const stored = getStoredOrSeedCompletion({ encounter, workspaceId });
      const timestamp = now();
      const completion: ChartCompletionSnapshot = {
        encounterId,
        workspaceId,
        status: stored.status === "completed" ? "completed" : "ready_for_billing",
        chartCompletedAt: stored.chartCompletedAt ?? timestamp,
        chartCompletedByUserId: stored.chartCompletedByUserId ?? actorUserId,
        updatedAt: timestamp,
      };

      mockChartCompletionStore.set(buildCompletionKey(workspaceId, encounterId), completion);

      return { ok: true, completion };
    },
    async readCompletion({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      return {
        ok: true,
        completion: getStoredOrSeedCompletion({ encounter, workspaceId }),
      };
    },
  };
}

export type SupabaseChartCompletionRpcClient = {
  rpc(
    functionName: "clair_get_chart_completion",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_complete_chart",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartCompletionGateway(
  client: SupabaseChartCompletionRpcClient
): ChartCompletionGateway {
  return {
    async completeChart({ actorUserId, encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_complete_chart", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const completion = mapChartCompletion(data);
      if (!completion) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, completion };
    },
    async readCompletion({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_completion", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      const completion = mapChartCompletion(data);
      if (!completion) return { ok: false, status: 500, error: "db_read_failed" };

      return { ok: true, completion };
    },
  };
}

export function createDemoChartCompletionPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

function findEncounter(encounters: Encounter[], workspaceId: string, encounterId: string) {
  return encounters.find(
    (encounter) =>
      encounter.id === encounterId &&
      encounter.workspaceId === workspaceId &&
      encounter.status !== "cancelled"
  );
}

function getStoredOrSeedCompletion({
  encounter,
  workspaceId,
}: {
  encounter: Encounter;
  workspaceId: string;
}): ChartCompletionSnapshot {
  const stored = mockChartCompletionStore.get(buildCompletionKey(workspaceId, encounter.id));
  if (stored) return stored;

  return {
    encounterId: encounter.id,
    workspaceId,
    status: encounter.status,
    chartCompletedAt: encounter.chartCompletedAt,
    chartCompletedByUserId: encounter.chartCompletedByUserId,
    updatedAt: encounter.updatedAt,
  };
}

function buildCompletionKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mapChartCompletion(value: unknown): ChartCompletionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ChartCompletionSnapshot>;

  if (
    typeof row.encounterId !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.status !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    encounterId: row.encounterId,
    workspaceId: row.workspaceId,
    status: row.status as EncounterStatus,
    chartCompletedAt: trimToUndefined(row.chartCompletedAt),
    chartCompletedByUserId: trimToUndefined(row.chartCompletedByUserId),
    updatedAt: row.updatedAt,
  };
}
