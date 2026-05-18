import "server-only";

import {
  validatePersonalProfileInput,
  type PersonalProfileFieldErrors,
  type PersonalProfileInput,
  type SessionPersonalProfile,
} from "@/features/auth/personal-profile-session";

export type PersonalProfileGateway = {
  saveProfile(
    input: PersonalProfileWrite
  ): Promise<{ ok: true; profile: SessionPersonalProfile } | { ok: false; error: "db_write_failed" }>;
};

export type PersonalProfileWrite = {
  userId: string;
  input: PersonalProfileInput;
  now: string;
};

export type PersonalProfileResult =
  | {
      ok: true;
      status: 200;
      profile: SessionPersonalProfile;
      enforcedBy: "personal-profile-server-route";
    }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: PersonalProfileFieldErrors }
  | { ok: false; status: 400; denialReason: "profile_authority_field_forbidden" }
  | { ok: false; status: 401; denialReason: "unauthenticated" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const blockedAuthorityKeys = new Set([
  "role",
  "roles",
  "permission",
  "permission" + "s",
  "member" + "ship",
  "workspaceAuthority",
]);

export async function savePersonalProfile({
  actorUserId,
  rawBody,
  gateway,
  now = new Date().toISOString(),
}: {
  actorUserId: string | null;
  rawBody: Record<string, unknown>;
  gateway?: PersonalProfileGateway;
  now?: string;
}): Promise<PersonalProfileResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  if (Object.keys(rawBody).some((key) => blockedAuthorityKeys.has(key))) {
    return { ok: false, status: 400, denialReason: "profile_authority_field_forbidden" };
  }

  const input: PersonalProfileInput = {
    displayName: getBodyString(rawBody.displayName),
    initials: getBodyString(rawBody.initials),
    phone: getBodyString(rawBody.phone),
    notificationOptIn: rawBody.notificationOptIn === true,
  };
  const validation = validatePersonalProfileInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  if (!gateway) {
    return {
      ok: true,
      status: 200,
      profile: toProfile(actorUserId, input, now),
      enforcedBy: "personal-profile-server-route",
    };
  }

  const saved = await gateway.saveProfile({ userId: actorUserId, input, now });

  if (!saved.ok) {
    return { ok: false, status: 500, error: saved.error };
  }

  return {
    ok: true,
    status: 200,
    profile: saved.profile,
    enforcedBy: "personal-profile-server-route",
  };
}

export type SupabasePersonalProfileRpcClient = {
  rpc(
    functionName: "clair_save_personal_profile",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabasePersonalProfileGateway(
  client: SupabasePersonalProfileRpcClient
): PersonalProfileGateway {
  return {
    async saveProfile(write) {
      const { data, error } = await client.rpc("clair_save_personal_profile", {
        p_display_name: write.input.displayName,
        p_initials: write.input.initials,
        p_phone: write.input.phone,
        p_notification_opt_in: write.input.notificationOptIn,
      });

      if (error) return { ok: false, error: "db_write_failed" };

      const value = data as Partial<SessionPersonalProfile>;
      return {
        ok: true,
        profile: {
          sessionId: value.sessionId ?? write.userId,
          displayName: value.displayName ?? write.input.displayName.trim(),
          initials: value.initials ?? write.input.initials.trim().toUpperCase(),
          phone: value.phone ?? (write.input.phone.trim() || null),
          notificationOptIn: value.notificationOptIn ?? write.input.notificationOptIn,
          updatedAt: value.updatedAt ?? write.now,
        },
      };
    },
  };
}

function toProfile(userId: string, input: PersonalProfileInput, now: string): SessionPersonalProfile {
  return {
    sessionId: userId,
    displayName: input.displayName.trim(),
    initials: input.initials.trim().toUpperCase(),
    phone: input.phone.trim() || null,
    notificationOptIn: input.notificationOptIn,
    updatedAt: now,
  };
}

function getBodyString(value: unknown) {
  return typeof value === "string" ? value : "";
}
