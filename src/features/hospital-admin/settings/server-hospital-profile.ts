import "server-only";

import type {
  HospitalProfile,
  HospitalProfilePendingChangeRequest,
} from "@/features/hospital-admin/settings/hospital-profile-model";
import {
  HOSPITAL_LOGO_SIGNED_READ_SECONDS,
  PRIVATE_HOSPITAL_LOGO_BUCKET,
} from "@/features/hospital-admin/settings/server-hospital-logo-core";
import type { HospitalProfileGateway } from "@/features/hospital-admin/settings/server-hospital-profile-core";

export * from "@/features/hospital-admin/settings/server-hospital-profile-core";

type SupabaseResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

export type SupabaseHospitalProfileClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<SupabaseResult>;
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<SupabaseResult>;
    };
  };
};

export function createSupabaseHospitalProfileGateway(
  client: SupabaseHospitalProfileClient
): HospitalProfileGateway {
  return {
    async read(workspaceId) {
      try {
        const { data, error } = await client.rpc(
          "clair_get_workspace_hospital_profile",
          { p_workspace_id: workspaceId }
        );
        const profile = await mapProfileWithSignedLogo(client, data);
        return !error && profile
          ? { ok: true, profile }
          : { ok: false, error: "db_read_failed" };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
    async updateContact({
      actorUserId,
      contact,
      requestId,
      revision,
      workspaceId,
    }) {
      try {
        const { data, error } = await client.rpc(
          "clair_update_workspace_hospital_contact",
          {
            p_workspace_id: workspaceId,
            p_actor_user_id: actorUserId,
            p_expected_revision: revision,
            p_contact: contact,
            p_request_id: requestId,
          }
        );
        if (error) {
          return error.message?.includes("hospital_profile_stale") ||
            error.code === "40001"
            ? { ok: false, error: "hospital_profile_stale" }
            : { ok: false, error: "db_write_failed" };
        }
        const profile = await mapProfileWithSignedLogo(client, data);
        return profile
          ? { ok: true, profile }
          : { ok: false, error: "db_write_failed" };
      } catch {
        return { ok: false, error: "db_write_failed" };
      }
    },
    async createChangeRequest({
      actorUserId,
      detail,
      fields,
      requestId,
      workspaceId,
    }) {
      try {
        const { data, error } = await client.rpc(
          "clair_create_workspace_hospital_profile_change_request",
          {
            p_workspace_id: workspaceId,
            p_actor_user_id: actorUserId,
            p_fields: fields,
            p_detail: detail,
            p_request_id: requestId,
          }
        );
        const request = mapPendingRequest(data);
        return !error && request
          ? { ok: true, request }
          : { ok: false, error: "db_write_failed" };
      } catch {
        return { ok: false, error: "db_write_failed" };
      }
    },
  };
}

async function mapProfileWithSignedLogo(
  client: SupabaseHospitalProfileClient,
  value: unknown
) {
  const profile = mapProfile(value);
  if (!profile || !profile.logo.hasCustomLogo) return profile;
  const path = readString(value, "logoStoragePath");
  if (!path) return null;
  try {
    const { data, error } = await client.storage
      .from(PRIVATE_HOSPITAL_LOGO_BUCKET)
      .createSignedUrl(path, HOSPITAL_LOGO_SIGNED_READ_SECONDS);
    const signedUrl = readString(data, "signedUrl");
    return !error && signedUrl
      ? { ...profile, logo: { hasCustomLogo: true, url: signedUrl } }
      : null;
  } catch {
    return null;
  }
}

function mapProfile(value: unknown): HospitalProfile | null {
  if (!isRecord(value) || !isRecord(value.contact) || !isRecord(value.logo)) {
    return null;
  }
  const pendingChangeRequest =
    value.pendingChangeRequest === null
      ? null
      : mapPendingRequest(value.pendingChangeRequest);
  if (value.pendingChangeRequest !== null && !pendingChangeRequest) return null;

  const contact = value.contact;
  const logo = value.logo;
  if (
    typeof value.workspaceId !== "string" ||
    typeof value.name !== "string" ||
    (value.representativeName !== null &&
      typeof value.representativeName !== "string") ||
    (value.address !== null && typeof value.address !== "string") ||
    value.countryCode !== "KR" ||
    typeof value.timezone !== "string" ||
    !Number.isSafeInteger(value.revision) ||
    typeof value.profileComplete !== "boolean" ||
    !hasStringFields(contact, [
      "phone",
      "fax",
      "homepage",
      "instagram",
      "customerGuideMemo",
    ]) ||
    typeof logo.hasCustomLogo !== "boolean" ||
    (logo.url !== null && typeof logo.url !== "string")
  ) {
    return null;
  }

  return {
    workspaceId: value.workspaceId,
    name: value.name,
    representativeName: value.representativeName as string | null,
    address: value.address as string | null,
    countryCode: "KR",
    timezone: value.timezone,
    contact: {
      phone: contact.phone as string,
      fax: contact.fax as string,
      homepage: contact.homepage as string,
      instagram: contact.instagram as string,
      customerGuideMemo: contact.customerGuideMemo as string,
    },
    logo: {
      hasCustomLogo: logo.hasCustomLogo,
      url: logo.url as string | null,
    },
    revision: value.revision as number,
    profileComplete: value.profileComplete,
    pendingChangeRequest,
  };
}

function mapPendingRequest(
  value: unknown
): HospitalProfilePendingChangeRequest | null {
  if (!isRecord(value) || !Array.isArray(value.fields)) return null;
  const fields = value.fields.filter(
    (field): field is HospitalProfilePendingChangeRequest["fields"][number] =>
      field === "hospital_name" ||
      field === "representative_name" ||
      field === "address"
  );
  if (
    fields.length !== value.fields.length ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    (value.status !== "pending" && value.status !== "reviewing")
  ) {
    return null;
  }
  return {
    id: value.id,
    fields,
    createdAt: value.createdAt,
    status: value.status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStringFields(value: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => typeof value[field] === "string");
}

function readString(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const candidate = value[key];
  return typeof candidate === "string" && candidate ? candidate : null;
}
