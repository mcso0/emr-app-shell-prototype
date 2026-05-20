import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockGuardians } from "@/mocks/emr-domain";
import type { Guardian } from "@/types/emr-domain";

export type CustomerGuardianCashReceiptType =
  | "none"
  | "personal_income_deduction"
  | "business_income_deduction";
export type CustomerGuardianEmailDomainMode = "preset" | "direct_input";
export type CustomerGuardianConsentStatus = "granted" | "refused" | "unknown" | "revoked";

export type CustomerGuardianProfileConsent = {
  consentType: string;
  status: CustomerGuardianConsentStatus;
  documentVersion?: string;
  sourceSurface?: string;
  consentedAt?: string;
  refusedAt?: string;
};

export type CustomerGuardianProfile = {
  id: string;
  workspaceId: string;
  name: string;
  mobilePhone?: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  address?: string;
  memo?: string;
  guardianCode?: string;
  additionalPhoneNumbers: string[];
  postalCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  emailLocalPart?: string;
  emailDomainMode?: CustomerGuardianEmailDomainMode;
  emailDomain?: string;
  cashReceiptType: CustomerGuardianCashReceiptType;
  cashReceiptNumber?: string;
  residentRegistrationNumberMasked?: string;
  residentRegistrationNumberToken?: string;
  vehicleNumber?: string;
  status: "active" | "soft_deleted";
  referralSources: string[];
  consents: CustomerGuardianProfileConsent[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerGuardianProfileUpdateInput = Partial<
  Pick<
    CustomerGuardianProfile,
    | "additionalPhoneNumbers"
    | "address"
    | "addressLine1"
    | "addressLine2"
    | "birthDate"
    | "cashReceiptNumber"
    | "cashReceiptType"
    | "email"
    | "emailDomain"
    | "emailDomainMode"
    | "emailLocalPart"
    | "memo"
    | "mobilePhone"
    | "name"
    | "phone"
    | "postalCode"
    | "referralSources"
    | "residentRegistrationNumberMasked"
    | "residentRegistrationNumberToken"
    | "vehicleNumber"
  >
>;

export type CustomerGuardianProfileFieldErrors = Partial<
  Record<
    | "cashReceiptNumber"
    | "emailDomainMode"
    | "guardianId"
    | "memo"
    | "name"
    | "residentRegistrationNumberToken",
    string
  >
>;

export type CustomerGuardianProfileGateway = {
  readGuardianProfile(input: {
    guardianId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; profile: CustomerGuardianProfile }
    | { ok: false; status: 404; denialReason: "guardian_not_found" }
    | { ok: false; status: 500; error: "db_read_failed" }
  >;
  updateGuardianProfile(input: {
    actorUserId: string;
    guardianId: string;
    update: CustomerGuardianProfileUpdateInput;
    workspaceId: string;
  }): Promise<
    | { ok: true; profile: CustomerGuardianProfile }
    | { ok: false; status: 404; denialReason: "guardian_not_found" }
    | { ok: false; status: 500; error: "db_write_failed" }
  >;
};

type SupabaseQueryResponse = { data: unknown; error: { message?: string } | null };
type SupabaseFilterChain = PromiseLike<SupabaseQueryResponse> & {
  eq(column: string, value: unknown): SupabaseFilterChain;
  order(column: string, options?: { ascending?: boolean }): SupabaseFilterChain;
  select(columns?: string): SupabaseFilterChain;
  maybeSingle(): Promise<SupabaseQueryResponse>;
};
type SupabaseTableBuilder = {
  delete(): SupabaseFilterChain;
  insert(values: Record<string, unknown> | Array<Record<string, unknown>>): Promise<SupabaseQueryResponse>;
  select(columns: string): SupabaseFilterChain;
  update(values: Record<string, unknown>): SupabaseFilterChain;
};
export type SupabaseCustomerGuardianProfileClient = {
  from(tableName: string): SupabaseTableBuilder;
};

export type CustomerGuardianProfileReadResult =
  | {
      ok: true;
      status: 200;
      profile: CustomerGuardianProfile;
      enforcedBy: "customer-guardian-profile-read";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 404; denialReason: "guardian_not_found" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type CustomerGuardianProfileUpdateResult =
  | {
      ok: true;
      status: 200;
      profile: CustomerGuardianProfile;
      enforcedBy: "customer-guardian-profile-update";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: CustomerGuardianProfileFieldErrors;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 404; denialReason: "guardian_not_found" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const maxMemoLength = 1500;
const rawIdentifierDigits = /^\d{10,}$/;
const rawResidentRegistrationDigits = /^\d{6}-?\d{7}$/;

export async function readCustomerGuardianProfile({
  actorUserId,
  gateway = createMockCustomerGuardianProfileGateway(),
  guardianId,
  permissionAdapter = createDemoCustomerGuardianProfilePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerGuardianProfileGateway;
  guardianId: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<CustomerGuardianProfileReadResult> {
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

  const result = await gateway.readGuardianProfile({ guardianId, workspaceId });
  if (!result.ok) return result;

  return {
    ok: true,
    status: 200,
    profile: result.profile,
    enforcedBy: "customer-guardian-profile-read",
  };
}

export async function updateCustomerGuardianProfile({
  actorUserId,
  gateway = createMockCustomerGuardianProfileGateway(),
  guardianId,
  input,
  permissionAdapter = createDemoCustomerGuardianProfilePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerGuardianProfileGateway;
  guardianId: string;
  input: CustomerGuardianProfileUpdateInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<CustomerGuardianProfileUpdateResult> {
  const normalized = normalizeGuardianProfileUpdate(input);
  const validation = validateGuardianProfileUpdate(guardianId, normalized);

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
    requiredPermission: "patient:update",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.updateGuardianProfile({
    actorUserId: actorUserId ?? "",
    guardianId,
    workspaceId,
    update: normalized,
  });
  if (!result.ok) return result;

  return {
    ok: true,
    status: 200,
    profile: result.profile,
    enforcedBy: "customer-guardian-profile-update",
  };
}

export function createMockCustomerGuardianProfileGateway(
  profiles?: CustomerGuardianProfile[],
  now = new Date().toISOString()
): CustomerGuardianProfileGateway {
  const store =
    profiles === undefined
      ? defaultMockGuardianProfileStore
      : new Map(profiles.map((profile) => [profile.id, { ...profile }]));

  return {
    async readGuardianProfile({ guardianId, workspaceId }) {
      const profile = store.get(guardianId);
      if (!profile || profile.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "guardian_not_found" };
      }

      return { ok: true, profile: { ...profile } };
    },
    async updateGuardianProfile({ actorUserId, guardianId, update, workspaceId }) {
      const current = store.get(guardianId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "guardian_not_found" };
      }

      const next: CustomerGuardianProfile = {
        ...current,
        ...update,
        updatedAt: now,
      };
      store.set(guardianId, next);

      void actorUserId;
      return { ok: true, profile: { ...next } };
    },
  };
}

const defaultMockGuardianProfileStore = new Map(
  mockGuardians.map(mapLegacyGuardianProfile).map((profile) => [profile.id, { ...profile }])
);

export function createSupabaseCustomerGuardianProfileGateway(
  client: SupabaseCustomerGuardianProfileClient
): CustomerGuardianProfileGateway {
  return {
    async readGuardianProfile({ guardianId, workspaceId }) {
      const profile = await readSupabaseGuardianProfile(client, { guardianId, workspaceId });
      if (!profile.ok) return profile;
      return { ok: true, profile: profile.profile };
    },
    async updateGuardianProfile({ actorUserId, guardianId, update, workspaceId }) {
      const updatePayload = mapGuardianUpdatePayload(update, actorUserId);
      const { data, error } = await client
        .from("guardians")
        .update(updatePayload)
        .eq("workspace_id", workspaceId)
        .eq("id", guardianId)
        .select(guardianSelectColumns)
        .maybeSingle();

      if (error) return { ok: false, status: 500, error: "db_write_failed" };
      if (!data) return { ok: false, status: 404, denialReason: "guardian_not_found" };

      if ("referralSources" in update) {
        const deleteResult = await client
          .from("guardian_referral_sources")
          .delete()
          .eq("workspace_id", workspaceId)
          .eq("guardian_id", guardianId);
        if (deleteResult.error) return { ok: false, status: 500, error: "db_write_failed" };

        const referralRows = (update.referralSources ?? []).map((sourceType) => ({
          workspace_id: workspaceId,
          guardian_id: guardianId,
          source_type: sourceType,
        }));
        if (referralRows.length > 0) {
          const insertResult = await client.from("guardian_referral_sources").insert(referralRows);
          if (insertResult.error) return { ok: false, status: 500, error: "db_write_failed" };
        }
      }

      await client.from("customer_profile_change_logs").insert({
        workspace_id: workspaceId,
        subject_type: "guardian",
        subject_id: guardianId,
        change_type: "update",
        changed_by_user_id: actorUserId,
        before_value: {},
        after_value: { fields: Object.keys(updatePayload) },
        reason: "customer guardian profile update",
      });

      const profile = await readSupabaseGuardianProfile(client, { guardianId, workspaceId });
      if (!profile.ok) return { ok: false, status: 500, error: "db_write_failed" };
      return { ok: true, profile: profile.profile };
    },
  };
}

export function createDemoCustomerGuardianProfilePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
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

function normalizeGuardianProfileUpdate(
  input: CustomerGuardianProfileUpdateInput
): CustomerGuardianProfileUpdateInput {
  const next: CustomerGuardianProfileUpdateInput = {};

  if ("name" in input) next.name = trim(input.name);
  if ("mobilePhone" in input) next.mobilePhone = trimToUndefined(input.mobilePhone);
  if ("phone" in input) next.phone = trimToUndefined(input.phone);
  if ("email" in input) next.email = trimToUndefined(input.email);
  if ("birthDate" in input) next.birthDate = trimToUndefined(input.birthDate);
  if ("address" in input) next.address = trimToUndefined(input.address);
  if ("memo" in input) next.memo = trimToUndefined(input.memo);
  if ("postalCode" in input) next.postalCode = trimToUndefined(input.postalCode);
  if ("addressLine1" in input) next.addressLine1 = trimToUndefined(input.addressLine1);
  if ("addressLine2" in input) next.addressLine2 = trimToUndefined(input.addressLine2);
  if ("emailLocalPart" in input) next.emailLocalPart = trimToUndefined(input.emailLocalPart);
  if ("emailDomainMode" in input) next.emailDomainMode = input.emailDomainMode;
  if ("emailDomain" in input) next.emailDomain = trimToUndefined(input.emailDomain);
  if ("cashReceiptType" in input) next.cashReceiptType = input.cashReceiptType ?? "none";
  if ("cashReceiptNumber" in input) {
    next.cashReceiptNumber = trimToUndefined(input.cashReceiptNumber);
  }
  if ("residentRegistrationNumberMasked" in input) {
    next.residentRegistrationNumberMasked = trimToUndefined(
      input.residentRegistrationNumberMasked
    );
  }
  if ("residentRegistrationNumberToken" in input) {
    next.residentRegistrationNumberToken = trimToUndefined(
      input.residentRegistrationNumberToken
    );
  }
  if ("vehicleNumber" in input) next.vehicleNumber = trimToUndefined(input.vehicleNumber);
  if ("additionalPhoneNumbers" in input) {
    next.additionalPhoneNumbers = normalizeStringList(input.additionalPhoneNumbers).slice(0, 2);
  }
  if ("referralSources" in input) {
    next.referralSources = normalizeStringList(input.referralSources);
  }

  return next;
}

function validateGuardianProfileUpdate(
  guardianId: string,
  input: CustomerGuardianProfileUpdateInput
) {
  const fieldErrors: CustomerGuardianProfileFieldErrors = {};

  if (!guardianId.trim()) fieldErrors.guardianId = "보호자를 찾을 수 없습니다.";
  if ("name" in input && !input.name) fieldErrors.name = "보호자명은 필수입니다.";
  if (input.memo && input.memo.length > maxMemoLength) {
    fieldErrors.memo = `메모는 ${maxMemoLength}자 이하로 입력해 주세요.`;
  }
  if (
    input.emailDomainMode &&
    input.emailDomainMode !== "preset" &&
    input.emailDomainMode !== "direct_input"
  ) {
    fieldErrors.emailDomainMode = "이메일 도메인 방식을 확인해 주세요.";
  }
  if (input.cashReceiptNumber && rawIdentifierDigits.test(input.cashReceiptNumber)) {
    fieldErrors.cashReceiptNumber = "현금영수증 번호는 synthetic placeholder만 저장할 수 있습니다.";
  }
  if (
    input.residentRegistrationNumberToken &&
    rawResidentRegistrationDigits.test(input.residentRegistrationNumberToken)
  ) {
    fieldErrors.residentRegistrationNumberToken =
      "주민등록번호 원문 형태는 저장할 수 없습니다.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function mapLegacyGuardianProfile(guardian: Guardian): CustomerGuardianProfile {
  return {
    id: guardian.id,
    workspaceId: guardian.workspaceId,
    name: guardian.name,
    mobilePhone: guardian.mobilePhone,
    phone: guardian.phone,
    email: guardian.email,
    birthDate: guardian.birthDate,
    address: guardian.address,
    memo: guardian.memo,
    additionalPhoneNumbers: [],
    cashReceiptType: "none",
    status: "active",
    referralSources: [],
    consents: [],
    createdAt: guardian.createdAt,
    updatedAt: guardian.updatedAt,
  };
}

const guardianSelectColumns = `
  id,
  workspace_id,
  name,
  mobile_phone,
  phone,
  email,
  birth_date,
  address,
  memo,
  guardian_code,
  additional_phone_numbers,
  postal_code,
  address_line1,
  address_line2,
  email_local_part,
  email_domain_mode,
  email_domain,
  cash_receipt_type,
  cash_receipt_number,
  resident_registration_number_masked,
  resident_registration_number_token,
  vehicle_number,
  status,
  created_at,
  updated_at
`;

async function readSupabaseGuardianProfile(
  client: SupabaseCustomerGuardianProfileClient,
  {
    guardianId,
    workspaceId,
  }: {
    guardianId: string;
    workspaceId: string;
  }
): Promise<
  | { ok: true; profile: CustomerGuardianProfile }
  | { ok: false; status: 404; denialReason: "guardian_not_found" }
  | { ok: false; status: 500; error: "db_read_failed" }
> {
  const { data, error } = await client
    .from("guardians")
    .select(guardianSelectColumns)
    .eq("workspace_id", workspaceId)
    .eq("id", guardianId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: "db_read_failed" };
  if (!data) return { ok: false, status: 404, denialReason: "guardian_not_found" };

  const referralResult = await client
    .from("guardian_referral_sources")
    .select("source_type")
    .eq("workspace_id", workspaceId)
    .eq("guardian_id", guardianId)
    .order("source_type", { ascending: true });
  if (referralResult.error) return { ok: false, status: 500, error: "db_read_failed" };

  const consentResult = await client
    .from("consents")
    .select("consent_type,status,document_version,source_surface,consented_at,refused_at")
    .eq("workspace_id", workspaceId)
    .eq("guardian_id", guardianId)
    .order("consent_type", { ascending: true });
  if (consentResult.error) return { ok: false, status: 500, error: "db_read_failed" };

  return {
    ok: true,
    profile: mapGuardianProfileRow(data, {
      consents: mapConsentRows(consentResult.data),
      referralSources: mapReferralRows(referralResult.data),
    }),
  };
}

function mapGuardianUpdatePayload(
  input: CustomerGuardianProfileUpdateInput,
  actorUserId: string
) {
  const payload: Record<string, unknown> = {
    last_updated_by_user_id: actorUserId,
  };
  const set = (key: string, value: unknown) => {
    if (value !== undefined) payload[key] = value;
  };

  set("name", input.name);
  set("mobile_phone", input.mobilePhone);
  set("mobile_phone_normalized", input.mobilePhone?.replace(/\D/g, ""));
  set("phone", input.phone);
  set("email", input.email);
  set("birth_date", input.birthDate);
  set("address", input.address);
  set("memo", input.memo);
  set("additional_phone_numbers", input.additionalPhoneNumbers);
  set("postal_code", input.postalCode);
  set("address_line1", input.addressLine1);
  set("address_line2", input.addressLine2);
  set("email_local_part", input.emailLocalPart);
  set("email_domain_mode", input.emailDomainMode);
  set("email_domain", input.emailDomain);
  set("cash_receipt_type", input.cashReceiptType);
  set("cash_receipt_number", input.cashReceiptNumber);
  set("resident_registration_number_masked", input.residentRegistrationNumberMasked);
  set("resident_registration_number_token", input.residentRegistrationNumberToken);
  set("vehicle_number", input.vehicleNumber);

  return payload;
}

function mapGuardianProfileRow(
  data: unknown,
  related: {
    consents: CustomerGuardianProfileConsent[];
    referralSources: string[];
  }
): CustomerGuardianProfile {
  const row = data as Record<string, unknown>;

  return {
    id: getString(row.id) ?? "",
    workspaceId: getString(row.workspace_id) ?? "",
    name: getString(row.name) ?? "",
    mobilePhone: getString(row.mobile_phone),
    phone: getString(row.phone),
    email: getString(row.email),
    birthDate: getString(row.birth_date),
    address: getString(row.address),
    memo: getString(row.memo),
    guardianCode: getString(row.guardian_code),
    additionalPhoneNumbers: normalizeStringList(readStringArray(row.additional_phone_numbers)),
    postalCode: getString(row.postal_code),
    addressLine1: getString(row.address_line1),
    addressLine2: getString(row.address_line2),
    emailLocalPart: getString(row.email_local_part),
    emailDomainMode: getEmailDomainMode(row.email_domain_mode),
    emailDomain: getString(row.email_domain),
    cashReceiptType: getCashReceiptType(row.cash_receipt_type),
    cashReceiptNumber: getString(row.cash_receipt_number),
    residentRegistrationNumberMasked: getString(row.resident_registration_number_masked),
    residentRegistrationNumberToken: getString(row.resident_registration_number_token),
    vehicleNumber: getString(row.vehicle_number),
    status: row.status === "soft_deleted" ? "soft_deleted" : "active",
    referralSources: related.referralSources,
    consents: related.consents,
    createdAt: getString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapReferralRows(data: unknown) {
  if (!Array.isArray(data)) return [];
  return normalizeStringList(
    data.map((row) => getString((row as Record<string, unknown>).source_type) ?? "")
  );
}

function mapConsentRows(data: unknown): CustomerGuardianProfileConsent[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): CustomerGuardianProfileConsent | null => {
      const value = row as Record<string, unknown>;
      const consentType = getString(value.consent_type);
      const status = getConsentStatus(value.status);
      if (!consentType || !status) return null;

      return {
        consentType,
        status,
        documentVersion: getString(value.document_version),
        sourceSurface: getString(value.source_surface),
        consentedAt: getString(value.consented_at),
        refusedAt: getString(value.refused_at),
      };
    })
    .filter((item): item is CustomerGuardianProfileConsent => Boolean(item));
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getCashReceiptType(value: unknown): CustomerGuardianCashReceiptType {
  return value === "personal_income_deduction" || value === "business_income_deduction"
    ? value
    : "none";
}

function getEmailDomainMode(value: unknown): CustomerGuardianEmailDomainMode | undefined {
  return value === "preset" || value === "direct_input" ? value : undefined;
}

function getConsentStatus(value: unknown): CustomerGuardianConsentStatus | null {
  if (value === "granted" || value === "refused" || value === "unknown" || value === "revoked") {
    return value;
  }

  return null;
}

function normalizeStringList(values?: string[]) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function trimToUndefined(value: unknown) {
  const next = trim(value);
  return next.length > 0 ? next : undefined;
}
