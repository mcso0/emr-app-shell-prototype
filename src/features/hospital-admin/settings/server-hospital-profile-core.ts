import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  HospitalContactUpdateInput,
  HospitalProfile,
  HospitalProfileChangeRequestInput,
  HospitalProfilePendingChangeRequest,
} from "@/features/hospital-admin/settings/hospital-profile-model";

export type { HospitalProfile } from "@/features/hospital-admin/settings/hospital-profile-model";

export type HospitalProfileGateway = {
  read(workspaceId: string): Promise<
    | { ok: true; profile: HospitalProfile }
    | { ok: false; error: "db_read_failed" }
  >;
  updateContact(input: {
    actorUserId: string;
    workspaceId: string;
    revision: number;
    contact: HospitalContactUpdateInput["contact"];
    requestId: string | null;
  }): Promise<
    | { ok: true; profile: HospitalProfile }
    | { ok: false; error: "hospital_profile_stale" | "db_write_failed" }
  >;
  createChangeRequest(input: {
    actorUserId: string;
    workspaceId: string;
    fields: HospitalProfileChangeRequestInput["fields"];
    detail: string;
    requestId: string | null;
  }): Promise<
    | { ok: true; request: HospitalProfilePendingChangeRequest }
    | { ok: false; error: "db_write_failed" }
  >;
};

type PermissionFailure = {
  ok: false;
  status: 401 | 403;
  denialReason: WorkspacePermissionDenialReason;
};

export type HospitalProfileReadResult =
  | {
      ok: true;
      status: 200;
      profile: HospitalProfile;
      enforcedBy: "hospital-profile-read";
    }
  | PermissionFailure
  | { ok: false; status: 500; error: "db_read_failed" };

export type HospitalContactUpdateResult =
  | {
      ok: true;
      status: 200;
      profile: HospitalProfile;
      enforcedBy: "hospital-profile-contact-update";
    }
  | PermissionFailure
  | { ok: false; status: 409; error: "hospital_profile_stale" }
  | { ok: false; status: 500; error: "db_write_failed" };

export type HospitalProfileChangeRequestResult =
  | {
      ok: true;
      status: 201;
      request: HospitalProfilePendingChangeRequest;
      enforcedBy: "hospital-profile-change-request";
    }
  | PermissionFailure
  | { ok: false; status: 500; error: "db_write_failed" };

export async function readHospitalProfile(input: {
  actorUserId: string | null;
  workspaceId: string;
  gateway?: HospitalProfileGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<HospitalProfileReadResult> {
  const denied = authorize(input, "hospital_settings:view");
  if (denied) return denied;
  try {
    const result = await (
      input.gateway ?? createMockHospitalProfileGateway()
    ).read(input.workspaceId);
    return result.ok
      ? {
          ok: true,
          status: 200,
          profile: cloneProfile(result.profile),
          enforcedBy: "hospital-profile-read",
        }
      : { ok: false, status: 500, error: "db_read_failed" };
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

export async function updateHospitalContact(input: {
  actorUserId: string | null;
  workspaceId: string;
  input: HospitalContactUpdateInput;
  requestId?: string | null;
  gateway?: HospitalProfileGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<HospitalContactUpdateResult> {
  const denied = authorize(input, "hospital_settings:manage");
  if (denied) return denied;
  try {
    const result = await (
      input.gateway ?? createMockHospitalProfileGateway()
    ).updateContact({
      actorUserId: input.actorUserId!,
      workspaceId: input.workspaceId,
      revision: input.input.revision,
      contact: input.input.contact,
      requestId: input.requestId ?? null,
    });
    if (!result.ok) {
      return result.error === "hospital_profile_stale"
        ? { ok: false, status: 409, error: result.error }
        : { ok: false, status: 500, error: "db_write_failed" };
    }
    return {
      ok: true,
      status: 200,
      profile: cloneProfile(result.profile),
      enforcedBy: "hospital-profile-contact-update",
    };
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

export async function createHospitalProfileChangeRequest(input: {
  actorUserId: string | null;
  workspaceId: string;
  input: HospitalProfileChangeRequestInput;
  requestId?: string | null;
  gateway?: HospitalProfileGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
}): Promise<HospitalProfileChangeRequestResult> {
  const denied = authorize(input, "hospital_settings:manage");
  if (denied) return denied;
  try {
    const result = await (
      input.gateway ?? createMockHospitalProfileGateway()
    ).createChangeRequest({
      actorUserId: input.actorUserId!,
      workspaceId: input.workspaceId,
      fields: input.input.fields,
      detail: input.input.detail,
      requestId: input.requestId ?? null,
    });
    return result.ok
      ? {
          ok: true,
          status: 201,
          request: { ...result.request, fields: [...result.request.fields] },
          enforcedBy: "hospital-profile-change-request",
        }
      : { ok: false, status: 500, error: "db_write_failed" };
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function authorize(
  input: {
    actorUserId: string | null;
    workspaceId: string;
    permissionAdapter?: WorkspacePermissionAdapter;
  },
  requiredPermission: "hospital_settings:view" | "hospital_settings:manage"
): PermissionFailure | null {
  const resolved = resolveWorkspacePermission(
    input.permissionAdapter ?? createDemoHospitalProfilePermissionAdapter(),
    {
      sessionUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      requiredPermission,
    }
  );
  if (resolved.allowed) return null;
  return {
    ok: false,
    status: resolved.denialReason === "unauthenticated" ? 401 : 403,
    denialReason: resolved.denialReason ?? "permission_missing",
  };
}

const defaultMockProfiles = new Map<string, HospitalProfile>();

export function createMockHospitalProfileGateway(
  profiles?: HospitalProfile[],
  now = () => new Date().toISOString()
): HospitalProfileGateway {
  const store = profiles
    ? new Map(profiles.map((profile) => [profile.workspaceId, cloneProfile(profile)]))
    : defaultMockProfiles;

  return {
    async read(workspaceId) {
      const current = store.get(workspaceId) ?? createDefaultProfile(workspaceId);
      if (!store.has(workspaceId)) store.set(workspaceId, cloneProfile(current));
      return { ok: true, profile: cloneProfile(current) };
    },
    async updateContact({ workspaceId, revision, contact }) {
      const current = store.get(workspaceId) ?? createDefaultProfile(workspaceId);
      if (current.revision !== revision) {
        return { ok: false, error: "hospital_profile_stale" };
      }
      const next: HospitalProfile = {
        ...current,
        contact: { ...contact },
        revision: current.revision + 1,
        profileComplete: Boolean(
          current.name &&
            current.representativeName &&
            current.address &&
            contact.phone
        ),
      };
      store.set(workspaceId, cloneProfile(next));
      return { ok: true, profile: cloneProfile(next) };
    },
    async createChangeRequest({ workspaceId, fields }) {
      const current = store.get(workspaceId) ?? createDefaultProfile(workspaceId);
      const request: HospitalProfilePendingChangeRequest = {
        id: `request-${crypto.randomUUID()}`,
        fields: [...fields],
        status: "pending",
        createdAt: now(),
      };
      store.set(
        workspaceId,
        cloneProfile({ ...current, pendingChangeRequest: request })
      );
      return { ok: true, request: { ...request, fields: [...request.fields] } };
    },
  };
}

export function createDemoHospitalProfilePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
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
        id: "membership-front",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
    ],
  });
}

function createDefaultProfile(workspaceId: string): HospitalProfile {
  return {
    workspaceId,
    name:
      workspaceId === "clair-demo"
        ? "VIP동물의료센터 청담점"
        : "병원 워크스페이스",
    representativeName: workspaceId === "clair-demo" ? "김청담" : null,
    address: workspaceId === "clair-demo" ? "서울 강남구 도산대로 000" : null,
    countryCode: "KR",
    timezone: "Asia/Seoul",
    contact: {
      phone: workspaceId === "clair-demo" ? "02-6203-7582" : "",
      fax: workspaceId === "clair-demo" ? "02-6203-7583" : "",
      homepage: "",
      instagram: "",
      customerGuideMemo:
        workspaceId === "clair-demo"
          ? "주차는 건물 뒤편 발렛을 이용해 주세요."
          : "",
    },
    logo: { hasCustomLogo: false, url: null },
    revision: 1,
    profileComplete: workspaceId === "clair-demo",
    pendingChangeRequest: null,
  };
}

function cloneProfile(profile: HospitalProfile): HospitalProfile {
  return {
    ...profile,
    contact: { ...profile.contact },
    logo: { ...profile.logo },
    pendingChangeRequest: profile.pendingChangeRequest
      ? {
          ...profile.pendingChangeRequest,
          fields: [...profile.pendingChangeRequest.fields],
        }
      : null,
  };
}
