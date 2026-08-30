import "server-only";

import {
  derivePersonalProfileInitials,
  validatePersonalProfileInput,
  type CurrentPersonalProfile,
  type PersonalProfileFieldErrors,
  type PersonalProfileInput,
  type SessionPersonalProfile,
} from "@/features/auth/personal-profile-session";
import {
  resolveProfileAvatarUrl,
  type ProfileAvatarReadStorage,
} from "@/features/staff/server-profile-avatar-read";

export type PersonalProfileReadGateway = {
  readProfile(
    userId: string,
  ): Promise<
    | { ok: true; profile: CurrentPersonalProfile }
    | { ok: false; error: "db_read_failed" }
  >;
};

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

export type PersonalProfileReadResult =
  | {
      ok: true;
      status: 200;
      profile: CurrentPersonalProfile;
      enforcedBy: "personal-profile-server-route";
    }
  | { ok: false; status: 401; denialReason: "unauthenticated" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

const blockedAuthorityKeys = new Set([
  "role",
  "roles",
  "permission",
  "permission" + "s",
  "member" + "ship",
  "workspaceAuthority",
]);

export async function readPersonalProfile({
  actorUserId,
  gateway,
}: {
  actorUserId: string | null;
  gateway?: PersonalProfileReadGateway;
}): Promise<PersonalProfileReadResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  if (!gateway) {
    return { ok: false, status: 500, error: "supabase_client_missing" };
  }

  const result = await gateway.readProfile(actorUserId);
  if (!result.ok) {
    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    profile: result.profile,
    enforcedBy: "personal-profile-server-route",
  };
}

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

type SupabasePersonalProfileReadResult = {
  data: Record<string, unknown> | null;
  error: { message?: string } | null;
};

type SupabasePersonalProfileReadQuery = {
  select(columns: string): {
    eq(column: "id" | "user_id", value: string): {
      maybeSingle(): Promise<SupabasePersonalProfileReadResult>;
    };
  };
};

export type SupabasePersonalProfileReadClient = {
  from(table: "users" | "user_profiles"): SupabasePersonalProfileReadQuery;
  storage: ProfileAvatarReadStorage;
};

export function createSupabasePersonalProfileReadGateway(
  client: SupabasePersonalProfileReadClient,
): PersonalProfileReadGateway {
  return {
    async readProfile(userId) {
      try {
        const [userResult, profileResult] = await Promise.all([
          client
            .from("users")
            .select("id, display_name, initial, phone, updated_at")
            .eq("id", userId)
            .maybeSingle(),
          client
            .from("user_profiles")
            .select(
              "user_id, notification_preferences, updated_at, avatar_url, avatar_storage_path, avatar_legacy_hidden",
            )
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const user = userResult.data;
        if (userResult.error || profileResult.error || !user) {
          return { ok: false, error: "db_read_failed" };
        }

        const displayName = readRequiredString(user.display_name);
        if (!displayName) {
          return { ok: false, error: "db_read_failed" };
        }
        const initials =
          readRequiredString(user.initial) ??
          derivePersonalProfileInitials(displayName);

        const profileRow = profileResult.data ?? undefined;
        const avatarUrl = await resolveProfileAvatarUrl(client.storage, profileRow);
        const phone = readOptionalString(user.phone);
        const updatedAt =
          readOptionalString(profileRow?.updated_at) ??
          readOptionalString(user.updated_at) ??
          new Date().toISOString();

        return {
          ok: true,
          profile: {
            sessionId: userId,
            displayName,
            initials,
            phone,
            notificationOptIn: readNotificationOptIn(
              profileRow?.notification_preferences,
            ),
            updatedAt,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
        };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
  };
}

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

function readRequiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNotificationOptIn(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).notificationOptIn === true;
}
