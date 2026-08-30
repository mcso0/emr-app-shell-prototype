import type { AuthSession } from "@/features/auth/auth-client";
import type { MockAuthRole, MockSessionStorageMode } from "@/features/auth/mock-session";

export type PersonalProfileInput = {
  displayName: string;
  initials: string;
  phone: string;
  notificationOptIn: boolean;
};

export type PersonalProfileFieldErrors = Partial<
  Record<"displayName" | "initials", string>
>;

export type PersonalProfileValidationResult =
  | { valid: true; fieldErrors: Record<string, never> }
  | { valid: false; fieldErrors: PersonalProfileFieldErrors };

export type SessionPersonalProfile = {
  sessionId: string;
  displayName: string;
  initials: string;
  phone: string | null;
  notificationOptIn: boolean;
  updatedAt: string;
};

export type CurrentPersonalProfile = SessionPersonalProfile & {
  avatarUrl?: string;
};

export type PersonalProfilesState = {
  profiles: SessionPersonalProfile[];
  updatedAt: string;
};

export type PersonalProfileSession = {
  sessionId: string;
  storageMode: MockSessionStorageMode | "cookie";
  role: MockAuthRole | "supabase";
  roleLabel: string;
  email?: string | null;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const PERSONAL_PROFILE_STORAGE_KEY = "clair.personalProfiles.v1";
export const PERSONAL_PROFILE_STORAGE_EVENT = "clair.personalProfiles.v1";

const defaultMockProfiles: Record<MockAuthRole, Pick<SessionPersonalProfile, "displayName" | "initials">> = {
  billing_admin: { displayName: "정하린", initials: "HR" },
  front_desk: { displayName: "최유나", initials: "YN" },
  hospital_admin: { displayName: "송민재", initials: "MJ" },
  nurse: { displayName: "송하윤", initials: "HY" },
  vet: { displayName: "이수지", initials: "SJ" },
};

export function createEmptyPersonalProfilesState(
  now = new Date().toISOString()
): PersonalProfilesState {
  return {
    profiles: [],
    updatedAt: now,
  };
}

export function createPersonalProfileSession(session: AuthSession): PersonalProfileSession {
  return {
    sessionId: session.id,
    storageMode: session.storageMode,
    role: session.role,
    roleLabel: session.roleLabel,
    email: "email" in session ? session.email : null,
  };
}

export function getDefaultSessionPersonalProfile(
  session: Pick<PersonalProfileSession, "sessionId" | "role" | "roleLabel" | "email">,
  now = new Date().toISOString()
): SessionPersonalProfile {
  const mockProfile = session.role === "supabase" ? null : defaultMockProfiles[session.role];
  const fallbackName = session.email ?? session.roleLabel;
  const fallbackInitials = derivePersonalProfileInitials(fallbackName);

  return {
    sessionId: session.sessionId,
    displayName: mockProfile?.displayName ?? fallbackName,
    initials: mockProfile?.initials ?? fallbackInitials,
    phone: null,
    notificationOptIn: false,
    updatedAt: now,
  };
}

export function validatePersonalProfileInput(
  input: PersonalProfileInput
): PersonalProfileValidationResult {
  const fieldErrors: PersonalProfileFieldErrors = {};
  const initials = input.initials.trim();

  if (!input.displayName.trim()) {
    fieldErrors.displayName = "이름을 입력하세요.";
  }

  if (initials.length < 1 || initials.length > 3) {
    fieldErrors.initials = "이니셜은 1~3자로 입력하세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  return { valid: true, fieldErrors: {} };
}

export function upsertSessionPersonalProfile(
  state: PersonalProfilesState,
  session: PersonalProfileSession,
  input: PersonalProfileInput,
  now = new Date().toISOString()
): PersonalProfilesState {
  const profile: SessionPersonalProfile = {
    sessionId: session.sessionId,
    displayName: input.displayName.trim(),
    initials: input.initials.trim().toUpperCase(),
    phone: input.phone.trim() || null,
    notificationOptIn: input.notificationOptIn,
    updatedAt: now,
  };

  return {
    profiles: [
      ...state.profiles.filter((item) => item.sessionId !== session.sessionId),
      profile,
    ],
    updatedAt: now,
  };
}

export function getSessionPersonalProfile(
  state: PersonalProfilesState | null,
  session: PersonalProfileSession,
  now = new Date().toISOString()
) {
  return (
    state?.profiles.find((profile) => profile.sessionId === session.sessionId) ??
    getDefaultSessionPersonalProfile(session, now)
  );
}

export function parsePersonalProfilesState(value: string | null): PersonalProfilesState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PersonalProfilesState>;

    if (!Array.isArray(parsed.profiles) || typeof parsed.updatedAt !== "string") {
      return null;
    }

    return {
      profiles: parsed.profiles.filter(isSessionPersonalProfile),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readPersonalProfilesState(
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
): PersonalProfilesState | null {
  const sessionState = parsePersonalProfilesState(
    sessionStorageLike?.getItem(PERSONAL_PROFILE_STORAGE_KEY) ?? null
  );

  if (sessionState) return sessionState;

  return parsePersonalProfilesState(
    localStorageLike?.getItem(PERSONAL_PROFILE_STORAGE_KEY) ?? null
  );
}

export function persistPersonalProfilesState(
  state: PersonalProfilesState,
  storageMode: MockSessionStorageMode | "cookie",
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
) {
  const target = storageMode === "session" ? sessionStorageLike : localStorageLike;
  const other = storageMode === "session" ? localStorageLike : sessionStorageLike;

  target?.setItem(PERSONAL_PROFILE_STORAGE_KEY, JSON.stringify(state));
  other?.removeItem(PERSONAL_PROFILE_STORAGE_KEY);
}

export function derivePersonalProfileInitials(label: string) {
  const compact = label.replace(/[^A-Za-z0-9가-힣]/g, "");
  return (compact.slice(0, 2) || "U").toUpperCase();
}

export function formatCompactAvatarInitials(initials: string) {
  const compact = Array.from(initials.replace(/[^A-Za-z0-9가-힣]/g, ""));
  return (compact[0] || "U").toUpperCase();
}

function isSessionPersonalProfile(value: unknown): value is SessionPersonalProfile {
  const profile = value as Partial<SessionPersonalProfile>;

  return (
    typeof profile.sessionId === "string" &&
    typeof profile.displayName === "string" &&
    typeof profile.initials === "string" &&
    (typeof profile.phone === "string" || profile.phone === null) &&
    typeof profile.notificationOptIn === "boolean" &&
    typeof profile.updatedAt === "string"
  );
}
