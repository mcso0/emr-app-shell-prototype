import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockDiagnoses, mockEncounters } from "@/mocks/emr-domain";
import type { Diagnosis, DiagnosisType, Encounter } from "@/types/emr-domain";

export type ChartDiagnosisRowInput = {
  id?: string;
  diagnosisCatalogId?: string;
  diagnosisText?: string;
  diagnosisType?: DiagnosisType;
  isPrimary?: boolean;
  sortOrder?: number;
};

export type ChartDiagnosisInput = {
  encounterId?: string;
  diagnoses?: ChartDiagnosisRowInput[];
};

export type ChartDiagnosisRow = Diagnosis & {
  isPrimary: boolean;
  sortOrder: number;
  updatedByUserId?: string;
  updatedAt: string;
};

export type ChartDiagnosisGatewayResult =
  | { ok: true; diagnoses: ChartDiagnosisRow[] }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartDiagnosisGateway = {
  readDiagnoses(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartDiagnosisGatewayResult>;
  saveDiagnoses(input: {
    actorUserId: string;
    diagnoses: NormalizedDiagnosisRowInput[];
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartDiagnosisGatewayResult>;
};

type NormalizedDiagnosisRowInput = Required<
  Pick<ChartDiagnosisRowInput, "diagnosisText" | "diagnosisType" | "isPrimary" | "sortOrder">
> &
  Pick<ChartDiagnosisRowInput, "diagnosisCatalogId" | "id">;

export type ChartDiagnosisReadResult =
  | {
      ok: true;
      status: 200;
      diagnoses: ChartDiagnosisRow[];
      enforcedBy: "chart-diagnosis-persistence";
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

export type ChartDiagnosisSaveResult =
  | {
      ok: true;
      status: 200;
      diagnoses: ChartDiagnosisRow[];
      enforcedBy: "chart-diagnosis-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"diagnoses" | "encounterId", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockDiagnosisStore = new Map<string, ChartDiagnosisRow[]>();
const diagnosisTypes = new Set<DiagnosisType>(["confirmed", "differential", "suspected"]);

export async function readChartDiagnoses({
  actorUserId,
  encounterId,
  gateway = createMockChartDiagnosisGateway(),
  permissionAdapter = createDemoChartDiagnosisPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<ChartDiagnosisGateway, "readDiagnoses">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartDiagnosisReadResult> {
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

  const result = await gateway.readDiagnoses({
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
    diagnoses: result.diagnoses,
    enforcedBy: "chart-diagnosis-persistence",
  };
}

export async function saveChartDiagnoses({
  actorUserId,
  gateway = createMockChartDiagnosisGateway(),
  input,
  permissionAdapter = createDemoChartDiagnosisPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<ChartDiagnosisGateway, "saveDiagnoses">;
  input: ChartDiagnosisInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartDiagnosisSaveResult> {
  const normalized = normalizeDiagnosisInput(input);
  const validation = validateDiagnosisInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
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

  const result = await gateway.saveDiagnoses({
    actorUserId: actorUserId ?? "",
    diagnoses: normalized.diagnoses,
    encounterId: normalized.encounterId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    diagnoses: result.diagnoses,
    enforcedBy: "chart-diagnosis-persistence",
  };
}

export function createMockChartDiagnosisGateway(
  dataset: {
    diagnoses?: Diagnosis[];
    encounters?: Encounter[];
  } = {
    diagnoses: mockDiagnoses,
    encounters: mockEncounters,
  },
  now = () => new Date().toISOString()
): ChartDiagnosisGateway {
  const encounters = dataset.encounters ?? [];
  const seedDiagnoses = dataset.diagnoses ?? [];

  return {
    async readDiagnoses({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      return {
        ok: true,
        diagnoses: getStoredOrSeedDiagnoses({
          encounterId,
          seedDiagnoses,
          workspaceId,
        }),
      };
    },
    async saveDiagnoses({ actorUserId, diagnoses, encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      const existingRows = getStoredOrSeedDiagnoses({
        encounterId,
        seedDiagnoses,
        workspaceId,
      });
      const timestamp = now();
      const rows = diagnoses.map((diagnosis, index) => {
        const existing = diagnosis.id
          ? existingRows.find((row) => row.id === diagnosis.id)
          : existingRows.find((row) => row.diagnosisText === diagnosis.diagnosisText);

        return {
          id: diagnosis.id ?? existing?.id ?? `diagnosis-${encounterId}-${index + 1}`,
          encounterId,
          diagnosisCatalogId: diagnosis.diagnosisCatalogId,
          diagnosisText: diagnosis.diagnosisText,
          diagnosisType: diagnosis.diagnosisType,
          isPrimary: diagnosis.isPrimary,
          sortOrder: diagnosis.sortOrder,
          createdByUserId: existing?.createdByUserId ?? actorUserId,
          updatedByUserId: actorUserId,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        } satisfies ChartDiagnosisRow;
      });

      mockDiagnosisStore.set(buildDiagnosisKey(workspaceId, encounterId), rows);

      return { ok: true, diagnoses: rows };
    },
  };
}

export type SupabaseChartDiagnosisRpcClient = {
  rpc(
    functionName: "clair_get_chart_diagnoses",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_chart_diagnoses",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_diagnoses: Array<{
        diagnosisCatalogId?: string;
        diagnosisText: string;
        diagnosisType: DiagnosisType;
        id?: string;
        isPrimary: boolean;
        sortOrder: number;
      }>;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartDiagnosisGateway(
  client: SupabaseChartDiagnosisRpcClient
): ChartDiagnosisGateway {
  return {
    async readDiagnoses({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_diagnoses", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      return { ok: true, diagnoses: mapDiagnosisRows(data) };
    },
    async saveDiagnoses({ actorUserId, diagnoses, encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_chart_diagnoses", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_diagnoses: diagnoses.map((diagnosis) => ({
          id: normalizeUuidForRpc(diagnosis.id),
          diagnosisCatalogId: normalizeUuidForRpc(diagnosis.diagnosisCatalogId),
          diagnosisText: diagnosis.diagnosisText,
          diagnosisType: diagnosis.diagnosisType,
          isPrimary: diagnosis.isPrimary,
          sortOrder: diagnosis.sortOrder,
        })),
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return { ok: true, diagnoses: mapDiagnosisRows(data) };
    },
  };
}

export function createDemoChartDiagnosisPermissionAdapter() {
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

function getStoredOrSeedDiagnoses({
  encounterId,
  seedDiagnoses,
  workspaceId,
}: {
  encounterId: string;
  seedDiagnoses: Diagnosis[];
  workspaceId: string;
}) {
  const stored = mockDiagnosisStore.get(buildDiagnosisKey(workspaceId, encounterId));
  if (stored) return stored;

  return seedDiagnoses
    .filter((diagnosis) => diagnosis.encounterId === encounterId)
    .map((diagnosis, index) => ({
      ...diagnosis,
      isPrimary: diagnosis.isPrimary ?? index === 0,
      sortOrder: diagnosis.sortOrder ?? index,
      updatedByUserId: diagnosis.updatedByUserId,
      updatedAt: diagnosis.updatedAt ?? diagnosis.createdAt,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function buildDiagnosisKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function normalizeDiagnosisInput(input: ChartDiagnosisInput) {
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    diagnoses: Array.isArray(input.diagnoses)
      ? input.diagnoses.map((row, index) => ({
          id: trimToUndefined(row.id),
          diagnosisCatalogId: trimToUndefined(row.diagnosisCatalogId),
          diagnosisText: normalizeField(row.diagnosisText),
          diagnosisType: diagnosisTypes.has(row.diagnosisType ?? "suspected")
            ? row.diagnosisType ?? "suspected"
            : "suspected",
          isPrimary: row.isPrimary === true,
          sortOrder: Number.isInteger(row.sortOrder) ? Number(row.sortOrder) : index,
        }))
      : [],
  };
}

function validateDiagnosisInput(input: ReturnType<typeof normalizeDiagnosisInput>) {
  const fieldErrors: Partial<Record<"diagnoses" | "encounterId", string>> = {};

  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (input.diagnoses.length > 30) fieldErrors.diagnoses = "진단명은 최대 30개까지 저장할 수 있습니다.";

  const hasInvalidRow = input.diagnoses.some(
    (row) => !row.diagnosisText || row.diagnosisText.length > 500
  );
  if (hasInvalidRow) fieldErrors.diagnoses = "진단명을 확인해 주세요.";

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function normalizeField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeUuidForRpc(value?: string) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

function mapDiagnosisRows(value: unknown): ChartDiagnosisRow[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ChartDiagnosisRow[]>((rows, item) => {
    const row = mapDiagnosisRow(item);
    if (row) rows.push(row);
    return rows;
  }, []);
}

function mapDiagnosisRow(value: unknown): ChartDiagnosisRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ChartDiagnosisRow>;

  if (
    typeof row.id !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.diagnosisText !== "string" ||
    typeof row.diagnosisType !== "string" ||
    typeof row.createdByUserId !== "string" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    encounterId: row.encounterId,
    diagnosisCatalogId: trimToUndefined(row.diagnosisCatalogId),
    diagnosisText: row.diagnosisText,
    diagnosisType: row.diagnosisType as DiagnosisType,
    isPrimary: row.isPrimary === true,
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    createdByUserId: row.createdByUserId,
    updatedByUserId: trimToUndefined(row.updatedByUserId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
