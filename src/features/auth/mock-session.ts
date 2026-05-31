export type MockAuthRole =
  | "front_desk"
  | "vet"
  | "nurse"
  | "billing_admin"
  | "hospital_admin";

export type MockSessionStorageMode = "session" | "local";

export type MockAuthSession = {
  id: string;
  role: MockAuthRole;
  roleLabel: string;
  storageMode: MockSessionStorageMode;
  issuedAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const MOCK_AUTH_STORAGE_KEY = "clair.mockAuth.session.v1";

export const MOCK_AUTH_ROLES: Array<{
  id: MockAuthRole;
  label: string;
  description: string;
}> = [
  {
    id: "front_desk",
    label: "프론트 데스크",
    description: "접수, 예약, 보호자 응대 흐름을 확인합니다.",
  },
  {
    id: "vet",
    label: "수의사",
    description: "진료 차트, 오더, 검사 결과 맥락을 확인합니다.",
  },
  {
    id: "nurse",
    label: "간호사",
    description: "검사, 처치, 조제 보조 업무 흐름을 확인합니다.",
  },
  {
    id: "billing_admin",
    label: "수납 관리자",
    description: "청구 묶음, 미납, 결제 흐름을 확인합니다.",
  },
  {
    id: "hospital_admin",
    label: "병원 관리자",
    description: "운영자 관점의 권한 mock 기반을 확인합니다.",
  },
];

const roleLabels = new Map(MOCK_AUTH_ROLES.map((role) => [role.id, role.label]));
const roleIds = new Set(MOCK_AUTH_ROLES.map((role) => role.id));
const demoEmailRoleMap = new Map<string, MockAuthRole>([
  ["admin@clair.local", "hospital_admin"],
  ["vet@clair.local", "vet"],
  ["technician@clair.local", "nurse"],
  ["front-desk@clair.local", "front_desk"],
  ["vet2@clair.local", "vet"],
  ["vet3@clair.local", "vet"],
  ["tech2@clair.local", "nurse"],
  ["tech3@clair.local", "nurse"],
  ["tech4@clair.local", "nurse"],
  ["front-desk2@clair.local", "front_desk"],
  ["front-desk3@clair.local", "front_desk"],
]);

export function isMockAuthRole(value: unknown): value is MockAuthRole {
  return typeof value === "string" && roleIds.has(value as MockAuthRole);
}

export function getMockRoleLabel(role: MockAuthRole) {
  return roleLabels.get(role) ?? role;
}

export function resolveDemoMockAuthRoleFromEmail(email: string): MockAuthRole | null {
  return demoEmailRoleMap.get(email.trim().toLowerCase()) ?? null;
}

export function createMockAuthSession(
  role: MockAuthRole,
  storageMode: MockSessionStorageMode
): MockAuthSession {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mock-session-${Date.now()}`;

  return {
    id: randomId,
    role,
    roleLabel: getMockRoleLabel(role),
    storageMode,
    issuedAt: new Date().toISOString(),
  };
}

export function parseMockAuthSession(value: string | null): MockAuthSession | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<MockAuthSession>;

    if (
      typeof parsed.id !== "string" ||
      !isMockAuthRole(parsed.role) ||
      (parsed.storageMode !== "session" && parsed.storageMode !== "local") ||
      typeof parsed.issuedAt !== "string"
    ) {
      return null;
    }

    return {
      id: parsed.id,
      role: parsed.role,
      roleLabel: getMockRoleLabel(parsed.role),
      storageMode: parsed.storageMode,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

export function readMockAuthSessionFromStorage(
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
) {
  const sessionSession = parseMockAuthSession(
    sessionStorageLike?.getItem(MOCK_AUTH_STORAGE_KEY) ?? null
  );

  if (sessionSession) return sessionSession;

  return parseMockAuthSession(localStorageLike?.getItem(MOCK_AUTH_STORAGE_KEY) ?? null);
}

export function persistMockAuthSession(
  session: MockAuthSession,
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
) {
  const target = session.storageMode === "session" ? sessionStorageLike : localStorageLike;
  const other = session.storageMode === "session" ? localStorageLike : sessionStorageLike;

  target?.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(session));
  other?.removeItem(MOCK_AUTH_STORAGE_KEY);
}

export function logoutMockAuthSession(
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
) {
  sessionStorageLike?.removeItem(MOCK_AUTH_STORAGE_KEY);
  localStorageLike?.removeItem(MOCK_AUTH_STORAGE_KEY);
}
