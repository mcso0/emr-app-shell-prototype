import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

export type CustomerProfileSubjectType = "patient" | "guardian";
export type CustomerProfileSection = "history" | "reservations" | "billing";
export type CustomerProfilePermission =
  | "patient:view"
  | "chart:view"
  | "reception:view"
  | "billing:view";

export type CustomerProfileAccess = {
  allowed: boolean;
  requiredPermission: CustomerProfilePermission;
};

export type CustomerProfileOverview = {
  subjectType: CustomerProfileSubjectType;
  subjectId: string;
  profile: Record<string, unknown>;
  relationships: Record<string, unknown>;
  access: {
    information: CustomerProfileAccess;
    history: CustomerProfileAccess;
    reservations: CustomerProfileAccess;
    billing: CustomerProfileAccess;
  };
};

export type CustomerProfileHistoryProjection = {
  id: string;
  patientId: string;
  patientName?: string;
  occurredAt?: string;
  status: string;
  visitPurpose?: string;
  clinicianName?: string;
};

export type CustomerProfileReservationProjection = {
  id: string;
  patientId: string;
  patientName?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  visitPurpose?: string;
  symptomNote?: string;
  status: string;
};

export type CustomerProfileBillingProjection = {
  id: string;
  invoiceNo: string;
  encounterId: string;
  patientId: string;
  patientName?: string;
  activityAt?: string;
  status: string;
  paymentState: string;
  totalAmount: number;
  approvedAmount: number;
  lineSummary?: string;
};

export type CustomerProfileSectionItems = {
  history: CustomerProfileHistoryProjection;
  reservations: CustomerProfileReservationProjection;
  billing: CustomerProfileBillingProjection;
};

export type CustomerProfileSectionResult<S extends CustomerProfileSection = CustomerProfileSection> = {
  section: S;
  items: Array<CustomerProfileSectionItems[S]>;
  nextCursor: string | null;
};

export type CustomerProfileOverviewGateway = {
  readOverview(input: {
    subjectId: string;
    subjectType: CustomerProfileSubjectType;
    workspaceId: string;
  }): Promise<
    | { ok: true; overview: CustomerProfileOverview }
    | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
    | { ok: false; status: 404; error: "subject_not_found" }
    | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" }
  >;
  readSection<S extends CustomerProfileSection>(input: {
    cursor?: string;
    limit: number;
    months?: number;
    patientId?: string;
    section: S;
    subjectId: string;
    subjectType: CustomerProfileSubjectType;
    workspaceId: string;
    month?: string;
  }): Promise<
    | { ok: true; result: CustomerProfileSectionResult<S> }
    | { ok: false; status: 400; error: "invalid_filter" }
    | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
    | { ok: false; status: 404; error: "subject_not_found" }
    | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" }
  >;
};

export type CustomerProfileOverviewResult =
  | {
      ok: true;
      status: 200;
      overview: CustomerProfileOverview;
      enforcedBy: "customer-profile-overview-read";
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 404; error: "subject_not_found" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type CustomerProfileSectionReadResult<S extends CustomerProfileSection = CustomerProfileSection> =
  | {
      ok: true;
      status: 200;
      section: S;
      items: Array<CustomerProfileSectionItems[S]>;
      nextCursor: string | null;
      enforcedBy: "customer-profile-section-read";
    }
  | { ok: false; status: 400; error: "invalid_filter" }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 404; error: "subject_not_found" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

const sectionPermissions: Record<CustomerProfileSection, CustomerProfilePermission> = {
  history: "chart:view",
  reservations: "reception:view",
  billing: "billing:view",
};

const sectionLimit = (value: number | undefined) =>
  Math.min(Math.max(Number.isFinite(value) ? Math.floor(value as number) : 20, 1), 50);

const sectionMonths = (value: number | undefined) =>
  value === 12 ? 12 : 6;

export async function readCustomerProfileOverview({
  actorUserId,
  gateway = createMockCustomerProfileOverviewGateway(),
  permissionAdapter = createMockWorkspacePermissionAdapter(),
  subjectId,
  subjectType,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerProfileOverviewGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  subjectId: string;
  subjectType: CustomerProfileSubjectType;
  workspaceId: string;
}): Promise<CustomerProfileOverviewResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "patient:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.readOverview({ subjectId, subjectType, workspaceId });
  if (!result.ok) return result;

  return {
    ok: true,
    status: 200,
    overview: result.overview,
    enforcedBy: "customer-profile-overview-read",
  };
}

export async function readCustomerProfileSection<S extends CustomerProfileSection>({
  actorUserId,
  cursor,
  gateway = createMockCustomerProfileOverviewGateway(),
  limit,
  months,
  patientId,
  permissionAdapter = createMockWorkspacePermissionAdapter(),
  section,
  subjectId,
  subjectType,
  workspaceId,
  month,
}: {
  actorUserId: string | null;
  cursor?: string;
  gateway?: CustomerProfileOverviewGateway;
  limit?: number;
  months?: number;
  patientId?: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  section: S;
  subjectId: string;
  subjectType: CustomerProfileSubjectType;
  workspaceId: string;
  month?: string;
}): Promise<CustomerProfileSectionReadResult<S>> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: sectionPermissions[section],
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.readSection({
    cursor,
    limit: sectionLimit(limit),
    months: sectionMonths(months),
    patientId,
    section,
    subjectId,
    subjectType,
    workspaceId,
    month,
  });
  if (!result.ok) return result;

  return {
    ok: true,
    status: 200,
    section,
    items: result.result.items,
    nextCursor: result.result.nextCursor,
    enforcedBy: "customer-profile-section-read",
  } as CustomerProfileSectionReadResult<S>;
}

type SupabaseRpcError = { code?: string; message?: string; details?: string; hint?: string };

export type SupabaseCustomerProfileOverviewRpcClient = {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: SupabaseRpcError | null }>;
};

export function createSupabaseCustomerProfileOverviewGateway(
  client: SupabaseCustomerProfileOverviewRpcClient,
): CustomerProfileOverviewGateway {
  return {
    async readOverview({ subjectId, subjectType, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_customer_profile_overview", {
        p_workspace_id: workspaceId,
        p_subject_type: subjectType,
        p_subject_id: subjectId,
      });
      if (error) {
        const mapped = mapRpcError(error);
        return mapped.status === 400
          ? { ok: false, status: 500, error: "db_read_failed" as const }
          : mapped;
      }
      if (!isRecord(data)) return { ok: false, status: 500, error: "db_read_failed" };
      return { ok: true, overview: data as unknown as CustomerProfileOverview };
    },
    async readSection({
      cursor,
      limit,
      months,
      patientId,
      section,
      subjectId,
      subjectType,
      workspaceId,
      month,
    }) {
      const functionName = {
        history: "clair_list_customer_profile_history",
        reservations: "clair_list_customer_profile_reservations",
        billing: "clair_list_customer_profile_billing",
      }[section];
      const args = {
        p_workspace_id: workspaceId,
        p_subject_type: subjectType,
        p_subject_id: subjectId,
        p_cursor: cursor ?? null,
        p_limit: limit,
        p_months: months ?? 6,
        p_patient_id: patientId ?? null,
        p_month: month ?? null,
      };
      const { data, error } = await client.rpc(functionName, args);
      if (error) return mapRpcError(error);
      if (!isRecord(data)) return { ok: false, status: 500, error: "db_read_failed" };

      return {
        ok: true,
        result: {
          section,
          items: Array.isArray(data.items) ? (data.items as Array<CustomerProfileSectionItems[typeof section]>) : [],
          nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
        } as CustomerProfileSectionResult<typeof section>,
      };
    },
  };
}

export function createMockCustomerProfileOverviewGateway(
  overview?: CustomerProfileOverview,
): CustomerProfileOverviewGateway {
  return {
    async readOverview() {
      if (!overview) return { ok: false, status: 404, error: "subject_not_found" };
      return { ok: true, overview };
    },
    async readSection({ section }) {
      return {
        ok: true,
        result: { section, items: [], nextCursor: null } as CustomerProfileSectionResult<typeof section>,
      };
    },
  };
}

function mapRpcError(error: SupabaseRpcError) {
  const message = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (message.includes("subject_not_found")) {
    return { ok: false as const, status: 404 as const, error: "subject_not_found" as const };
  }
  if (message.includes("unauthenticated")) {
    return { ok: false as const, status: 401 as const, denialReason: "unauthenticated" as const };
  }
  if (message.includes("workspace_membership_missing")) {
    return { ok: false as const, status: 403 as const, denialReason: "workspace_membership_missing" as const };
  }
  if (message.includes("permission_missing")) {
    return { ok: false as const, status: 403 as const, denialReason: "permission_missing" as const };
  }
  if (message.includes("patient_filter_invalid") || message.includes("invalid_filter")) {
    return { ok: false as const, status: 400 as const, error: "invalid_filter" as const };
  }
  return { ok: false as const, status: 500 as const, error: "db_read_failed" as const };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
