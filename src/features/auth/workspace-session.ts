import type { MockSessionStorageMode } from "@/features/auth/mock-session";
import {
  LEGACY_SALES_DEMO_WORKSPACE_DISPLAY_NAME,
  LEGACY_SALES_DEMO_WORKSPACE_ID,
  PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME,
  PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
} from "@/lib/emr-domain/demo-workspaces";

export type SessionWorkspaceSubscriptionStatus = "trialing" | "active" | "none";
export type SessionWorkspaceRole = "hospital_admin" | "vet" | "technician" | "front_desk";
export type SessionWorkspacePermissionRoleType = "owner" | "admin" | "standard" | "custom";
export type CanonicalWorkspaceMembershipStatus = "active" | "inactive" | "archived";
export type SessionWorkspaceMembershipStatus =
  | CanonicalWorkspaceMembershipStatus
  | "pending"
  | "suspended"
  | "soft_deleted";
export type SessionWorkspaceInvitationStatus = "pending" | "accepted" | "canceled" | "expired";
export type SessionWorkspaceAccessStatus =
  | "unknown"
  | "active"
  | "pending"
  | "inactive"
  | "suspended"
  | "archived"
  | "soft_deleted"
  | "missing";

export function normalizeWorkspaceMembershipStatus(
  status: SessionWorkspaceMembershipStatus
): SessionWorkspaceMembershipStatus {
  return status === "soft_deleted" ? "archived" : status;
}

export function isArchivedMembershipStatus(status: SessionWorkspaceMembershipStatus) {
  return status === "archived" || status === "soft_deleted";
}

export type WorkspaceCreationInput = {
  hospitalName: string;
  adminDisplayName: string;
  contactEmail: string;
  contactPhone: string;
  subscriptionStatus: SessionWorkspaceSubscriptionStatus;
};

export type WorkspaceCreationFieldErrors = Partial<
  Record<"hospitalName" | "adminDisplayName" | "contactEmail", string>
>;

export type WorkspaceCreationValidationResult =
  | { valid: true; fieldErrors: Record<string, never> }
  | { valid: false; fieldErrors: WorkspaceCreationFieldErrors };

export type WorkspaceInvitationInput = {
  email: string;
  roles: SessionWorkspaceRole[];
  permissionRoleKey?: string | null;
  jobPositionKey?: string | null;
  title: string;
  department: string;
};

export type WorkspaceInvitationFieldErrors = Partial<
  Record<"email" | "roles" | "permissionRoleKey" | "jobPositionKey", string>
>;

export type WorkspaceInvitationValidationResult =
  | { valid: true; fieldErrors: Record<string, never> }
  | { valid: false; fieldErrors: WorkspaceInvitationFieldErrors };

export type WorkspaceMembershipMutationReason =
  | "membership_not_found"
  | "invalid_roles"
  | "last_admin_protected";

export type WorkspaceMembershipMutationResult =
  | { success: true; state: SessionWorkspacesState }
  | { success: false; reason: WorkspaceMembershipMutationReason; state: SessionWorkspacesState };

export type WorkspaceCustomPermissionRoleMutationResult =
  | {
      success: true;
      state: SessionWorkspacesState;
      role: SessionWorkspacePermissionRole;
    }
  | {
      success: false;
      reason:
        | "empty_label"
        | "empty_permissions"
        | "invalid_permission"
        | "owner_only_permission"
        | "system_role_immutable";
      state: SessionWorkspacesState;
    };

export type WorkspaceCustomJobPositionMutationResult =
  | {
      success: true;
      state: SessionWorkspacesState;
      position: SessionWorkspaceJobPosition;
    }
  | {
      success: false;
      reason: "empty_label" | "duplicate_position" | "custom_job_position_missing" | "system_job_immutable";
      state: SessionWorkspacesState;
    };

export type WorkspaceCustomPermissionRoleDeleteResult =
  | { success: true; state: SessionWorkspacesState }
  | {
      success: false;
      reason: "custom_role_missing" | "system_role_immutable" | "role_referenced";
      state: SessionWorkspacesState;
    };

export type SessionWorkspace = {
  id: string;
  displayName: string;
  representativeName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  subscriptionStatus: SessionWorkspaceSubscriptionStatus;
  createdBySessionId: string;
  createdAt: string;
};

export type SessionWorkspacePermissionRole = {
  workspaceId: string | null;
  roleKey: string;
  label: string;
  roleType: SessionWorkspacePermissionRoleType;
  permissionIds: string[];
  isSystem: boolean;
  isAssignable: boolean;
  description?: string;
  sortOrder: number;
};

export type SessionWorkspaceJobPosition = {
  workspaceId: string | null;
  positionKey: string;
  label: string;
  isSystem: boolean;
  isActive: boolean;
  description?: string;
  sortOrder: number;
};

export type SessionWorkspaceMembership = {
  id: string;
  workspaceId: string;
  userSessionId: string;
  displayName?: string;
  email?: string | null;
  roles: SessionWorkspaceRole[];
  permissionRoleKey?: string | null;
  jobPositionKey?: string | null;
  status: SessionWorkspaceMembershipStatus;
  title?: string | null;
  department?: string | null;
  createdAt: string;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  archivedAt?: string | null;
  archivedByUserId?: string | null;
  archivedReason?: string | null;
  deletedAt?: string | null;
  deletedByUserId?: string | null;
  deletedReason?: string | null;
  restoredAt?: string | null;
  restoredByUserId?: string | null;
  lastLoginAt?: string | null;
};

export type SessionWorkspaceInvitation = {
  id: string;
  workspaceId: string;
  email: string;
  invitedRoles: SessionWorkspaceRole[];
  permissionRoleKey?: string | null;
  jobPositionKey?: string | null;
  title: string | null;
  department: string | null;
  status: SessionWorkspaceInvitationStatus;
  invitedBySessionId: string;
  acceptedBySessionId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  canceledAt: string | null;
  resentAt: string | null;
  resendCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SessionWorkspaceCreation = {
  workspace: SessionWorkspace;
  membership: SessionWorkspaceMembership;
};

export type SessionWorkspacesState = {
  currentWorkspaceId: string | null;
  workspaces: SessionWorkspace[];
  memberships: SessionWorkspaceMembership[];
  invitations: SessionWorkspaceInvitation[];
  permissionRoles?: SessionWorkspacePermissionRole[];
  jobPositions?: SessionWorkspaceJobPosition[];
  updatedAt: string;
};

export type WorkspaceCreatorSession = {
  sessionId: string;
  storageMode: MockSessionStorageMode | "cookie";
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const SESSION_WORKSPACES_STORAGE_KEY = "clair.sessionWorkspaces.v1";
export const DEMO_WORKSPACE_ID = LEGACY_SALES_DEMO_WORKSPACE_ID;
export const DEMO_WORKSPACE_DISPLAY_NAME = LEGACY_SALES_DEMO_WORKSPACE_DISPLAY_NAME;
export const SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS = [
  "*",
  "workspace:delete",
  "workspace:ownership_transfer",
  "billing:contract_manage",
  "data:dangerous_delete",
] as const;
export const SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG = [
  { id: "reception:view", label: "접수/예약 조회" },
  { id: "reception:create", label: "접수/예약 생성" },
  { id: "reception:update", label: "접수/예약 수정" },
  { id: "patient:view", label: "보호자/환자 조회" },
  { id: "chart:view", label: "차트 조회" },
  { id: "chart:update", label: "차트 작성/수정" },
  { id: "order:request", label: "오더 생성" },
  { id: "order:update", label: "오더 상태 변경" },
  { id: "lab:complete", label: "검사/처치 결과 입력" },
  { id: "billing:view", label: "수납 조회" },
  { id: "billing:issue", label: "수납 처리" },
  { id: "service_catalog:view", label: "병원 설정 조회" },
] as const;
export const SESSION_WORKSPACE_PERMISSION_ROLES: SessionWorkspacePermissionRole[] = [
  {
    workspaceId: null,
    roleKey: "owner",
    label: "소유자",
    roleType: "owner",
    permissionIds: ["*"],
    isSystem: true,
    isAssignable: true,
    description: "워크스페이스 소유권과 위험 작업을 포함한 보호 권한",
    sortOrder: 10,
  },
  {
    workspaceId: null,
    roleKey: "admin",
    label: "관리자",
    roleType: "admin",
    permissionIds: [
      "reception:view",
      "reception:create",
      "reception:update",
      "patient:view",
      "patient:create",
      "patient:update",
      "encounter:view",
      "encounter:create",
      "encounter:update",
      "chart:view",
      "chart:update",
      "order:view",
      "order:request",
      "order:update",
      "dispensing:view",
      "dispensing:complete",
      "lab:view",
      "lab:complete",
      "imaging:view",
      "imaging:complete",
      "billing:view",
      "billing:issue",
      "service_catalog:view",
      "service_catalog:manage",
      "role_permission:view",
      "role_permission:manage",
    ],
    isSystem: true,
    isAssignable: true,
    description: "대부분의 병원 운영 권한, 소유자 전용 위험 작업 제외",
    sortOrder: 20,
  },
  {
    workspaceId: null,
    roleKey: "general",
    label: "일반",
    roleType: "standard",
    permissionIds: [
      "reception:view",
      "reception:create",
      "reception:update",
      "patient:view",
      "patient:create",
      "patient:update",
      "encounter:view",
      "encounter:create",
      "encounter:update",
      "chart:view",
      "chart:update",
      "order:view",
      "order:request",
      "order:update",
      "dispensing:view",
      "dispensing:complete",
      "lab:view",
      "lab:complete",
      "imaging:view",
      "imaging:complete",
      "billing:view",
      "billing:issue",
      "service_catalog:view",
    ],
    isSystem: true,
    isAssignable: true,
    description: "진료/접수/검사/수납을 포함한 일반 운영 권한",
    sortOrder: 30,
  },
];
export const SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS: SessionWorkspaceJobPosition[] = [
  {
    workspaceId: null,
    positionKey: "hospital_director",
    label: "병원장",
    isSystem: true,
    isActive: true,
    sortOrder: 10,
  },
  {
    workspaceId: null,
    positionKey: "veterinarian",
    label: "수의사",
    isSystem: true,
    isActive: true,
    sortOrder: 20,
  },
  {
    workspaceId: null,
    positionKey: "technician",
    label: "테크니션",
    isSystem: true,
    isActive: true,
    sortOrder: 30,
  },
  {
    workspaceId: null,
    positionKey: "front_desk",
    label: "데스크",
    isSystem: true,
    isActive: true,
    sortOrder: 40,
  },
];
export const SESSION_WORKSPACE_ROLES: Array<{
  id: SessionWorkspaceRole;
  label: string;
}> = [
  { id: "hospital_admin", label: "병원관리자" },
  { id: "vet", label: "수의사" },
  { id: "technician", label: "테크니션" },
  { id: "front_desk", label: "데스크" },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roleIds = new Set(SESSION_WORKSPACE_ROLES.map((role) => role.id));
const defaultPermissionRoleKeys = new Set(
  SESSION_WORKSPACE_PERMISSION_ROLES.map((role) => role.roleKey)
);
const defaultJobPositionKeys = new Set(
  SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS.map((position) => position.positionKey)
);
const safeCustomPermissionIds = new Set<string>(
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG.map((permission) => permission.id)
);
const ownerOnlyPermissionIds = new Set<string>(SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS);

export function isSessionWorkspaceRole(value: unknown): value is SessionWorkspaceRole {
  return typeof value === "string" && roleIds.has(value as SessionWorkspaceRole);
}

export function getSessionWorkspaceRoleLabel(role: SessionWorkspaceRole) {
  return SESSION_WORKSPACE_ROLES.find((item) => item.id === role)?.label ?? role;
}

export function getSessionWorkspaceRoleLabels(roles: SessionWorkspaceRole[]) {
  return roles.map(getSessionWorkspaceRoleLabel).join(", ");
}

export function getSessionWorkspacePermissionRoles(
  state: Pick<SessionWorkspacesState, "permissionRoles"> | null | undefined,
  workspaceId: string
) {
  return [
    ...SESSION_WORKSPACE_PERMISSION_ROLES,
    ...(state?.permissionRoles ?? []).filter(
      (role) =>
        role.workspaceId === workspaceId &&
        role.roleType === "custom" &&
        role.isAssignable
    ),
  ].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}

export function getSessionWorkspaceJobPositions(
  state: Pick<SessionWorkspacesState, "jobPositions"> | null | undefined,
  workspaceId: string
) {
  return [
    ...SESSION_WORKSPACE_DEFAULT_JOB_POSITIONS,
    ...(state?.jobPositions ?? []).filter(
      (position) => position.workspaceId === workspaceId && position.isActive
    ),
  ].sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label));
}

export function getSessionWorkspacePermissionRoleLabel(
  roleKey: string | null | undefined,
  state?: Pick<SessionWorkspacesState, "permissionRoles"> | null,
  workspaceId = ""
) {
  if (!roleKey) return "일반";
  return (
    getSessionWorkspacePermissionRoles(state, workspaceId).find((role) => role.roleKey === roleKey)
      ?.label ?? roleKey
  );
}

export function getSessionWorkspaceJobPositionLabel(
  positionKey: string | null | undefined,
  state?: Pick<SessionWorkspacesState, "jobPositions"> | null,
  workspaceId = ""
) {
  if (!positionKey) return "데스크";
  return (
    getSessionWorkspaceJobPositions(state, workspaceId).find(
      (position) => position.positionKey === positionKey
    )?.label ?? positionKey
  );
}

export function getSessionWorkspacePermissionRoleSummary(
  roleKey: string | null | undefined,
  state?: Pick<SessionWorkspacesState, "permissionRoles"> | null,
  workspaceId = ""
) {
  const role = getSessionWorkspacePermissionRoles(state, workspaceId).find(
    (item) => item.roleKey === roleKey
  );

  if (!role) return "권한 역할을 선택하세요.";
  if (role.roleType === "owner") return "소유자 전용 위험 작업 포함";
  if (role.roleType === "admin") return "대부분의 병원 운영 권한";
  if (role.roleType === "standard") return "일반 운영 권한";
  return `${role.permissionIds.length}개 권한으로 구성`;
}

export function getSessionWorkspaceEffectivePermissionRoleKey(
  membership: Pick<SessionWorkspaceMembership, "permissionRoleKey" | "roles">
) {
  if (membership.permissionRoleKey) return membership.permissionRoleKey;
  return membership.roles.includes("hospital_admin") ? "owner" : "general";
}

export function getSessionWorkspaceEffectiveJobPositionKey(
  membership: Pick<SessionWorkspaceMembership, "jobPositionKey" | "roles">
) {
  if (membership.jobPositionKey) return membership.jobPositionKey;
  if (membership.roles.includes("vet")) return "veterinarian";
  if (membership.roles.includes("technician")) return "technician";
  if (membership.roles.includes("hospital_admin")) return "hospital_director";
  return "front_desk";
}

export function getSessionWorkspaceLegacyRolesForAssignment({
  permissionRoleKey,
  jobPositionKey,
}: {
  permissionRoleKey: string | null | undefined;
  jobPositionKey: string | null | undefined;
}): SessionWorkspaceRole[] {
  if (permissionRoleKey === "owner" || permissionRoleKey === "admin") {
    return ["hospital_admin"];
  }

  if (jobPositionKey === "veterinarian") return ["vet"];
  if (jobPositionKey === "technician") return ["technician"];
  return ["front_desk"];
}

export function normalizeWorkspaceInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateWorkspaceCreationInput(
  input: WorkspaceCreationInput
): WorkspaceCreationValidationResult {
  const fieldErrors: WorkspaceCreationFieldErrors = {};

  if (!input.hospitalName.trim()) {
    fieldErrors.hospitalName = "병원/워크스페이스 이름을 입력하세요.";
  }

  if (!input.adminDisplayName.trim()) {
    fieldErrors.adminDisplayName = "대표/관리자 이름을 입력하세요.";
  }

  if (input.contactEmail.trim() && !emailPattern.test(input.contactEmail.trim())) {
    fieldErrors.contactEmail = "올바른 이메일 형식으로 입력하세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  return { valid: true, fieldErrors: {} };
}

export function validateWorkspaceInvitationInput(
  input: WorkspaceInvitationInput,
  state: SessionWorkspacesState,
  workspaceId: string,
  catalog?: {
    permissionRoleKeys?: Iterable<string>;
    jobPositionKeys?: Iterable<string>;
  }
): WorkspaceInvitationValidationResult {
  const fieldErrors: WorkspaceInvitationFieldErrors = {};
  const email = normalizeWorkspaceInviteEmail(input.email);

  if (!email) {
    fieldErrors.email = "초대 이메일을 입력하세요.";
  } else if (!emailPattern.test(email)) {
    fieldErrors.email = "올바른 이메일 형식으로 입력하세요.";
  }

  if (input.roles.length === 0 || input.roles.some((role) => !isSessionWorkspaceRole(role))) {
    fieldErrors.roles = "하나 이상의 역할을 선택하세요.";
  }

  const permissionRoleKey = input.permissionRoleKey ?? inferPermissionRoleKeyFromRoles(input.roles);
  const jobPositionKey = input.jobPositionKey ?? inferJobPositionKeyFromRoles(input.roles);
  const availableRoleKeys = new Set(
    catalog?.permissionRoleKeys ??
      getSessionWorkspacePermissionRoles(state, workspaceId).map((role) => role.roleKey)
  );
  const availableJobPositionKeys = new Set(
    catalog?.jobPositionKeys ??
      getSessionWorkspaceJobPositions(state, workspaceId).map((position) => position.positionKey)
  );

  if (!availableRoleKeys.has(permissionRoleKey)) {
    fieldErrors.permissionRoleKey = "권한 역할을 선택하세요.";
  }

  if (!availableJobPositionKeys.has(jobPositionKey)) {
    fieldErrors.jobPositionKey = "직무를 선택하세요.";
  }

  if (!fieldErrors.email) {
    const hasPendingInvitation = state.invitations.some(
      (invitation) =>
        invitation.workspaceId === workspaceId &&
        invitation.email === email &&
        invitation.status === "pending"
    );
    const hasActiveMembership = state.memberships.some(
      (membership) =>
        membership.workspaceId === workspaceId &&
        membership.email === email &&
        membership.status === "active"
    );

    if (hasPendingInvitation) {
      fieldErrors.email = "이미 대기 중인 초대가 있습니다. 재발송을 사용하세요.";
    } else if (hasActiveMembership) {
      fieldErrors.email = "이미 활성 멤버로 등록된 이메일입니다.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, fieldErrors };
  }

  return { valid: true, fieldErrors: {} };
}

export function createWorkspaceId(displayName: string) {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "workspace";
}

export function createSessionWorkspace(
  input: WorkspaceCreationInput,
  creator: WorkspaceCreatorSession,
  now = new Date().toISOString()
): SessionWorkspaceCreation {
  const workspaceId = createWorkspaceId(input.hospitalName);

  return {
    workspace: {
      id: workspaceId,
      displayName: input.hospitalName.trim(),
      representativeName: input.adminDisplayName.trim(),
      contactEmail: input.contactEmail.trim() || null,
      contactPhone: input.contactPhone.trim() || null,
      subscriptionStatus: input.subscriptionStatus,
      createdBySessionId: creator.sessionId,
      createdAt: now,
    },
    membership: {
      id: `${workspaceId}:${creator.sessionId}:hospital_admin`,
      workspaceId,
      userSessionId: creator.sessionId,
      displayName: input.adminDisplayName.trim(),
      email: input.contactEmail.trim() || null,
      roles: ["hospital_admin"],
      permissionRoleKey: "owner",
      jobPositionKey: "hospital_director",
      status: "active",
      title: "워크스페이스 생성자",
      department: "병원관리",
      createdAt: now,
      activatedAt: now,
      deactivatedAt: null,
    },
  };
}

export function createSessionWorkspaceInvitation(
  input: WorkspaceInvitationInput,
  workspaceId: string,
  inviter: WorkspaceCreatorSession,
  now = new Date().toISOString()
): SessionWorkspaceInvitation {
  const normalizedEmail = normalizeWorkspaceInviteEmail(input.email);
  const expiresAt = new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1000).toISOString();
  const roles = Array.from(new Set(input.roles.filter(isSessionWorkspaceRole)));
  const permissionRoleKey = input.permissionRoleKey ?? inferPermissionRoleKeyFromRoles(roles);
  const jobPositionKey = input.jobPositionKey ?? inferJobPositionKeyFromRoles(roles);

  return {
    id: `${workspaceId}:invite:${normalizedEmail}`,
    workspaceId,
    email: normalizedEmail,
    invitedRoles: roles,
    permissionRoleKey,
    jobPositionKey,
    title: input.title.trim() || null,
    department: input.department.trim() || null,
    status: "pending",
    invitedBySessionId: inviter.sessionId,
    acceptedBySessionId: null,
    expiresAt,
    acceptedAt: null,
    canceledAt: null,
    resentAt: null,
    resendCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptySessionWorkspacesState(now = new Date().toISOString()): SessionWorkspacesState {
  return {
    currentWorkspaceId: null,
    workspaces: [],
    memberships: [],
    invitations: [],
    permissionRoles: [],
    jobPositions: [],
    updatedAt: now,
  };
}

export function createOrUpdateSessionWorkspaceCustomPermissionRole(
  state: SessionWorkspacesState,
  input: {
    workspaceId: string;
    roleKey?: string | null;
    label: string;
    description?: string;
    permissionIds: string[];
  },
  now = new Date().toISOString()
): WorkspaceCustomPermissionRoleMutationResult {
  const label = input.label.trim();

  if (!label) {
    return { success: false, reason: "empty_label", state };
  }

  const requestedPermissionIds = Array.from(
    new Set(input.permissionIds.map((permissionId) => permissionId.trim()).filter(Boolean))
  );

  if (requestedPermissionIds.length === 0) {
    return { success: false, reason: "empty_permissions", state };
  }

  if (requestedPermissionIds.some((permissionId) => ownerOnlyPermissionIds.has(permissionId))) {
    return { success: false, reason: "owner_only_permission", state };
  }

  if (requestedPermissionIds.some((permissionId) => !safeCustomPermissionIds.has(permissionId))) {
    return { success: false, reason: "invalid_permission", state };
  }

  const existingRoles = state.permissionRoles ?? [];
  const existingRole = input.roleKey
    ? getSessionWorkspacePermissionRoles(state, input.workspaceId).find(
        (role) => role.roleKey === input.roleKey
      )
    : null;
  if (existingRole?.isSystem) {
    return { success: false, reason: "system_role_immutable", state };
  }
  const roleKey = input.roleKey ?? createCustomCatalogKey(label, existingRoles.map((role) => role.roleKey));
  const role: SessionWorkspacePermissionRole = {
    workspaceId: input.workspaceId,
    roleKey,
    label,
    description: input.description?.trim() || undefined,
    roleType: "custom",
    permissionIds: requestedPermissionIds,
    isSystem: false,
    isAssignable: true,
    sortOrder: 100 + existingRoles.length,
  };

  return {
    success: true,
    role,
    state: {
      ...state,
      permissionRoles: [
        ...existingRoles.filter(
          (item) => !(item.workspaceId === input.workspaceId && item.roleKey === roleKey)
        ),
        role,
      ],
      updatedAt: now,
    },
  };
}

export function createSessionWorkspaceCustomJobPosition(
  state: SessionWorkspacesState,
  input: {
    workspaceId: string;
    label: string;
    description?: string;
  },
  now = new Date().toISOString()
): WorkspaceCustomJobPositionMutationResult {
  const label = input.label.trim();

  if (!label) {
    return { success: false, reason: "empty_label", state };
  }

  const existingPositions = state.jobPositions ?? [];
  const existingLabels = new Set(
    getSessionWorkspaceJobPositions(state, input.workspaceId).map((position) => position.label)
  );

  if (existingLabels.has(label)) {
    return { success: false, reason: "duplicate_position", state };
  }

  const position: SessionWorkspaceJobPosition = {
    workspaceId: input.workspaceId,
    positionKey: createCustomCatalogKey(
      label,
      existingPositions.map((item) => item.positionKey)
    ),
    label,
    description: input.description?.trim() || undefined,
    isSystem: false,
    isActive: true,
    sortOrder: 100 + existingPositions.length,
  };

  return {
    success: true,
    position,
    state: {
      ...state,
      jobPositions: [...existingPositions, position],
      updatedAt: now,
    },
  };
}

export function updateSessionWorkspaceCustomJobPosition(
  state: SessionWorkspacesState,
  input: {
    workspaceId: string;
    positionKey: string;
    label: string;
    description?: string;
  },
  now = new Date().toISOString()
): WorkspaceCustomJobPositionMutationResult {
  const position = getSessionWorkspaceJobPositions(state, input.workspaceId).find(
    (item) => item.positionKey === input.positionKey
  );
  if (!position) return { success: false, reason: "custom_job_position_missing", state };
  if (position.isSystem) return { success: false, reason: "system_job_immutable", state };

  const label = input.label.trim();
  if (!label) return { success: false, reason: "empty_label", state };

  const duplicate = getSessionWorkspaceJobPositions(state, input.workspaceId).some(
    (item) => item.positionKey !== input.positionKey && item.label === label
  );
  if (duplicate) return { success: false, reason: "duplicate_position", state };

  const updatedPosition: SessionWorkspaceJobPosition = {
    ...position,
    label,
    description: input.description?.trim() || undefined,
  };
  return {
    success: true,
    position: updatedPosition,
    state: {
      ...state,
      jobPositions: (state.jobPositions ?? []).map((item) =>
        item.workspaceId === input.workspaceId && item.positionKey === input.positionKey
          ? updatedPosition
          : item
      ),
      updatedAt: now,
    },
  };
}

export function archiveSessionWorkspaceCustomJobPosition(
  state: SessionWorkspacesState,
  input: { workspaceId: string; positionKey: string },
  now = new Date().toISOString()
): WorkspaceCustomJobPositionMutationResult {
  const position = getSessionWorkspaceJobPositions(state, input.workspaceId).find(
    (item) => item.positionKey === input.positionKey
  );
  if (!position) return { success: false, reason: "custom_job_position_missing", state };
  if (position.isSystem) return { success: false, reason: "system_job_immutable", state };

  const archivedPosition: SessionWorkspaceJobPosition = { ...position, isActive: false };
  return {
    success: true,
    position: archivedPosition,
    state: {
      ...state,
      jobPositions: (state.jobPositions ?? []).map((item) =>
        item.workspaceId === input.workspaceId && item.positionKey === input.positionKey
          ? archivedPosition
          : item
      ),
      updatedAt: now,
    },
  };
}

export function deleteSessionWorkspaceCustomPermissionRole(
  state: SessionWorkspacesState,
  input: { workspaceId: string; roleKey: string },
  now = new Date().toISOString()
): WorkspaceCustomPermissionRoleDeleteResult {
  const role = getSessionWorkspacePermissionRoles(state, input.workspaceId).find(
    (item) => item.roleKey === input.roleKey
  );
  if (!role) return { success: false, reason: "custom_role_missing", state };
  if (role.isSystem) return { success: false, reason: "system_role_immutable", state };

  const referencedByMembership = state.memberships.some(
    (membership) =>
      membership.workspaceId === input.workspaceId &&
      getSessionWorkspaceEffectivePermissionRoleKey(membership) === input.roleKey
  );
  const referencedByInvitation = state.invitations.some(
    (invitation) =>
      invitation.workspaceId === input.workspaceId &&
      (invitation.permissionRoleKey === input.roleKey ||
        (!invitation.permissionRoleKey && invitation.invitedRoles.includes("hospital_admin") && input.roleKey === "owner"))
  );
  if (referencedByMembership || referencedByInvitation) {
    return { success: false, reason: "role_referenced", state };
  }

  return {
    success: true,
    state: {
      ...state,
      permissionRoles: (state.permissionRoles ?? []).filter(
        (item) => !(item.workspaceId === input.workspaceId && item.roleKey === input.roleKey)
      ),
      updatedAt: now,
    },
  };
}

export function appendSessionWorkspace(
  state: SessionWorkspacesState,
  creation: SessionWorkspaceCreation,
  now = new Date().toISOString()
): SessionWorkspacesState {
  const otherWorkspaces = state.workspaces.filter(
    (workspace) => workspace.id !== creation.workspace.id
  );
  const otherMemberships = state.memberships.filter(
    (membership) =>
      !(
        membership.workspaceId === creation.membership.workspaceId &&
        membership.userSessionId === creation.membership.userSessionId
      )
  );

  return {
    currentWorkspaceId: creation.workspace.id,
    workspaces: [...otherWorkspaces, creation.workspace],
    memberships: [...otherMemberships, creation.membership],
    invitations: state.invitations,
    updatedAt: now,
  };
}

export function appendSessionWorkspaceInvitation(
  state: SessionWorkspacesState,
  invitation: SessionWorkspaceInvitation,
  now = new Date().toISOString()
): SessionWorkspacesState {
  return {
    ...state,
    invitations: [
      ...state.invitations.filter((item) => item.id !== invitation.id),
      { ...invitation, updatedAt: now },
    ],
    updatedAt: now,
  };
}

export function cancelSessionWorkspaceInvitation(
  state: SessionWorkspacesState,
  invitationId: string,
  now = new Date().toISOString()
): SessionWorkspacesState {
  return {
    ...state,
    invitations: state.invitations.map((invitation) =>
      invitation.id === invitationId && invitation.status === "pending"
        ? { ...invitation, status: "canceled", canceledAt: now, updatedAt: now }
        : invitation
    ),
    updatedAt: now,
  };
}

export function resendSessionWorkspaceInvitation(
  state: SessionWorkspacesState,
  invitationId: string,
  now = new Date().toISOString()
): SessionWorkspacesState {
  const expiresAt = new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...state,
    invitations: state.invitations.map((invitation) =>
      invitation.id === invitationId && invitation.status === "pending"
        ? {
            ...invitation,
            expiresAt,
            resentAt: now,
            resendCount: invitation.resendCount + 1,
            updatedAt: now,
          }
        : invitation
    ),
    updatedAt: now,
  };
}

export function acceptSessionWorkspaceInvitation(
  state: SessionWorkspacesState,
  invitationId: string,
  now = new Date().toISOString()
): SessionWorkspacesState {
  const invitation = state.invitations.find((item) => item.id === invitationId);

  if (!invitation || invitation.status !== "pending") return state;

  const inviteeSessionId = `invitee:${invitation.email}`;
  const membership: SessionWorkspaceMembership = {
    id: `${invitation.workspaceId}:${inviteeSessionId}`,
    workspaceId: invitation.workspaceId,
    userSessionId: inviteeSessionId,
    displayName: invitation.email.split("@")[0],
    email: invitation.email,
    roles: invitation.invitedRoles,
    permissionRoleKey: invitation.permissionRoleKey ?? inferPermissionRoleKeyFromRoles(invitation.invitedRoles),
    jobPositionKey: invitation.jobPositionKey ?? inferJobPositionKeyFromRoles(invitation.invitedRoles),
    status: "active",
    title: invitation.title,
    department: invitation.department,
    createdAt: now,
    activatedAt: now,
    deactivatedAt: null,
  };

  return {
    ...state,
    memberships: [
      ...state.memberships.filter(
        (item) =>
          !(
            item.workspaceId === membership.workspaceId &&
            item.email === membership.email
          )
      ),
      membership,
    ],
    invitations: state.invitations.map((item) =>
      item.id === invitationId
        ? {
            ...item,
            status: "accepted",
            acceptedBySessionId: inviteeSessionId,
            acceptedAt: now,
            updatedAt: now,
          }
        : item
    ),
    updatedAt: now,
  };
}

export function updateSessionWorkspaceMembershipRoles(
  state: SessionWorkspacesState,
  membershipId: string,
  roles:
    | SessionWorkspaceRole[]
    | {
        roles: SessionWorkspaceRole[];
        permissionRoleKey?: string | null;
        jobPositionKey?: string | null;
      },
  now = new Date().toISOString()
): WorkspaceMembershipMutationResult {
  const membership = state.memberships.find((item) => item.id === membershipId);

  if (!membership) {
    return { success: false, reason: "membership_not_found", state };
  }

  const nextRolesInput = Array.isArray(roles) ? roles : roles.roles;
  const nextRoles = Array.from(new Set(nextRolesInput.filter(isSessionWorkspaceRole)));
  const nextPermissionRoleKey = Array.isArray(roles)
    ? inferPermissionRoleKeyFromRoles(nextRoles)
    : roles.permissionRoleKey ?? inferPermissionRoleKeyFromRoles(nextRoles);
  const nextJobPositionKey = Array.isArray(roles)
    ? membership.jobPositionKey ?? inferJobPositionKeyFromRoles(nextRoles)
    : roles.jobPositionKey ?? membership.jobPositionKey ?? inferJobPositionKeyFromRoles(nextRoles);

  if (nextRoles.length === 0) {
    return { success: false, reason: "invalid_roles", state };
  }

  if (
    wouldRemoveLastActiveWorkspaceOwner(
      state,
      membership,
      nextPermissionRoleKey,
      membership.status
    )
  ) {
    return { success: false, reason: "last_admin_protected", state };
  }

  return {
    success: true,
    state: {
      ...state,
      memberships: state.memberships.map((item) =>
        item.id === membershipId
          ? {
              ...item,
              roles: nextRoles,
              permissionRoleKey: nextPermissionRoleKey,
              jobPositionKey: nextJobPositionKey,
            }
          : item
      ),
      updatedAt: now,
    },
  };
}

export function deactivateSessionWorkspaceMembership(
  state: SessionWorkspacesState,
  membershipId: string,
  now = new Date().toISOString()
): WorkspaceMembershipMutationResult {
  const membership = state.memberships.find((item) => item.id === membershipId);

  if (!membership) {
    return { success: false, reason: "membership_not_found", state };
  }

  if (
    wouldRemoveLastActiveWorkspaceOwner(
      state,
      membership,
      getMembershipPermissionRoleKey(membership),
      "inactive"
    )
  ) {
    return { success: false, reason: "last_admin_protected", state };
  }

  return {
    success: true,
    state: {
      ...state,
      memberships: state.memberships.map((item) =>
        item.id === membershipId
          ? { ...item, status: "inactive", deactivatedAt: now }
          : item
      ),
      updatedAt: now,
    },
  };
}

export function updateSessionWorkspaceMembershipStatus(
  state: SessionWorkspacesState,
  membershipId: string,
  status: Extract<SessionWorkspaceMembershipStatus, "active" | "inactive" | "soft_deleted">,
  metadata: Pick<SessionWorkspaceMembership, "deletedAt" | "deletedByUserId" | "deletedReason" | "restoredAt" | "restoredByUserId"> = {},
  now = new Date().toISOString()
): WorkspaceMembershipMutationResult {
  const membership = state.memberships.find((item) => item.id === membershipId);
  if (!membership) return { success: false, reason: "membership_not_found", state };

  if (
    status !== "active" &&
    wouldRemoveLastActiveWorkspaceOwner(state, membership, getMembershipPermissionRoleKey(membership), status)
  ) {
    return { success: false, reason: "last_admin_protected", state };
  }

  return {
    success: true,
    state: {
      ...state,
      memberships: state.memberships.map((item) =>
        item.id === membershipId
          ? {
              ...item,
              ...metadata,
              status,
              activatedAt: status === "active" ? now : item.activatedAt,
              deactivatedAt: status === "active" ? item.deactivatedAt : now,
            }
          : item
      ),
      updatedAt: now,
    },
  };
}

export function parseSessionWorkspacesState(value: string | null): SessionWorkspacesState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<SessionWorkspacesState>;
    if (
      typeof parsed.updatedAt !== "string" ||
      !Array.isArray(parsed.workspaces) ||
      !Array.isArray(parsed.memberships) ||
      (parsed.invitations !== undefined && !Array.isArray(parsed.invitations)) ||
      (parsed.currentWorkspaceId !== null && typeof parsed.currentWorkspaceId !== "string")
    ) {
      return null;
    }

    return {
      currentWorkspaceId: parsed.currentWorkspaceId ?? null,
      workspaces: parsed.workspaces.filter(isSessionWorkspace),
      memberships: parsed.memberships.filter(isSessionWorkspaceMembership),
      invitations: (parsed.invitations ?? []).filter(isSessionWorkspaceInvitation),
      permissionRoles: Array.isArray(parsed.permissionRoles)
        ? parsed.permissionRoles.filter(isSessionWorkspacePermissionRole)
        : [],
      jobPositions: Array.isArray(parsed.jobPositions)
        ? parsed.jobPositions.filter(isSessionWorkspaceJobPosition)
        : [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readSessionWorkspacesState(
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
): SessionWorkspacesState | null {
  const sessionState = parseSessionWorkspacesState(
    sessionStorageLike?.getItem(SESSION_WORKSPACES_STORAGE_KEY) ?? null
  );

  if (sessionState) return sessionState;

  return parseSessionWorkspacesState(
    localStorageLike?.getItem(SESSION_WORKSPACES_STORAGE_KEY) ?? null
  );
}

export function persistSessionWorkspacesState(
  state: SessionWorkspacesState,
  storageMode: MockSessionStorageMode | "cookie",
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
) {
  const target = storageMode === "session" ? sessionStorageLike : localStorageLike;
  const other = storageMode === "session" ? localStorageLike : sessionStorageLike;

  target?.setItem(SESSION_WORKSPACES_STORAGE_KEY, JSON.stringify(state));
  other?.removeItem(SESSION_WORKSPACES_STORAGE_KEY);
}

export function getSessionWorkspaceDisplayName(
  workspaceId: string,
  sessionStorageLike?: StorageLike,
  localStorageLike?: StorageLike
) {
  if (workspaceId === DEMO_WORKSPACE_ID) return DEMO_WORKSPACE_DISPLAY_NAME;
  if (workspaceId === PREPARED_EMPTY_CLINIC_WORKSPACE_ID) {
    return PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME;
  }

  const state = readSessionWorkspacesState(sessionStorageLike, localStorageLike);
  return state?.workspaces.find((workspace) => workspace.id === workspaceId)?.displayName ?? workspaceId;
}

export function resolveSessionWorkspaceAccess(
  state: SessionWorkspacesState | null,
  workspaceId: string,
  userSessionId: string | null | undefined
): SessionWorkspaceAccessStatus {
  if (workspaceId === DEMO_WORKSPACE_ID) return "active";
  if (workspaceId === PREPARED_EMPTY_CLINIC_WORKSPACE_ID) return "active";
  if (!state) return "unknown";
  if (!userSessionId) return "missing";
  if (!state.workspaces.some((workspace) => workspace.id === workspaceId)) return "missing";

  const membership = state.memberships.find(
    (item) => item.workspaceId === workspaceId && item.userSessionId === userSessionId
  );

  return membership?.status ?? "missing";
}

function isSessionWorkspace(value: unknown): value is SessionWorkspace {
  const workspace = value as Partial<SessionWorkspace>;

  return (
    typeof workspace.id === "string" &&
    typeof workspace.displayName === "string" &&
    typeof workspace.representativeName === "string" &&
    typeof workspace.createdBySessionId === "string" &&
    typeof workspace.createdAt === "string" &&
    (workspace.subscriptionStatus === "trialing" ||
      workspace.subscriptionStatus === "active" ||
      workspace.subscriptionStatus === "none")
  );
}

function isSessionWorkspaceMembership(value: unknown): value is SessionWorkspaceMembership {
  const membership = value as Partial<SessionWorkspaceMembership>;

  return (
    typeof membership.id === "string" &&
    typeof membership.workspaceId === "string" &&
    typeof membership.userSessionId === "string" &&
    Array.isArray(membership.roles) &&
    membership.roles.length > 0 &&
    membership.roles.every(isSessionWorkspaceRole) &&
    (membership.status === "pending" ||
      membership.status === "active" ||
      membership.status === "inactive" ||
      membership.status === "suspended" ||
      membership.status === "soft_deleted") &&
    typeof membership.createdAt === "string"
  );
}

function isSessionWorkspaceInvitation(value: unknown): value is SessionWorkspaceInvitation {
  const invitation = value as Partial<SessionWorkspaceInvitation>;

  return (
    typeof invitation.id === "string" &&
    typeof invitation.workspaceId === "string" &&
    typeof invitation.email === "string" &&
    Array.isArray(invitation.invitedRoles) &&
    invitation.invitedRoles.length > 0 &&
    invitation.invitedRoles.every(isSessionWorkspaceRole) &&
    (invitation.status === "pending" ||
      invitation.status === "accepted" ||
      invitation.status === "canceled" ||
      invitation.status === "expired") &&
    typeof invitation.invitedBySessionId === "string" &&
    typeof invitation.expiresAt === "string" &&
    typeof invitation.createdAt === "string" &&
    typeof invitation.updatedAt === "string"
  );
}

function isSessionWorkspacePermissionRole(value: unknown): value is SessionWorkspacePermissionRole {
  const role = value as Partial<SessionWorkspacePermissionRole>;

  return (
    (role.workspaceId === null || typeof role.workspaceId === "string") &&
    typeof role.roleKey === "string" &&
    typeof role.label === "string" &&
    (role.roleType === "owner" ||
      role.roleType === "admin" ||
      role.roleType === "standard" ||
      role.roleType === "custom") &&
    Array.isArray(role.permissionIds) &&
    role.permissionIds.every((permissionId) => typeof permissionId === "string") &&
    typeof role.isSystem === "boolean" &&
    typeof role.isAssignable === "boolean" &&
    typeof role.sortOrder === "number"
  );
}

function isSessionWorkspaceJobPosition(value: unknown): value is SessionWorkspaceJobPosition {
  const position = value as Partial<SessionWorkspaceJobPosition>;

  return (
    (position.workspaceId === null || typeof position.workspaceId === "string") &&
    typeof position.positionKey === "string" &&
    typeof position.label === "string" &&
    typeof position.isSystem === "boolean" &&
    typeof position.isActive === "boolean" &&
    typeof position.sortOrder === "number"
  );
}

function wouldRemoveLastActiveWorkspaceOwner(
  state: SessionWorkspacesState,
  target: SessionWorkspaceMembership,
  nextPermissionRoleKey: string | null | undefined,
  nextStatus: SessionWorkspaceMembershipStatus
) {
  const activeOwnerCount = state.memberships.filter(
    (membership) =>
      membership.workspaceId === target.workspaceId &&
      membership.status === "active" &&
      getMembershipPermissionRoleKey(membership) === "owner"
  ).length;
  const targetIsActiveOwner =
    target.status === "active" && getMembershipPermissionRoleKey(target) === "owner";
  const targetWillRemainActiveOwner = nextStatus === "active" && nextPermissionRoleKey === "owner";

  return targetIsActiveOwner && activeOwnerCount <= 1 && !targetWillRemainActiveOwner;
}

function getMembershipPermissionRoleKey(membership: SessionWorkspaceMembership) {
  return membership.permissionRoleKey ?? inferPermissionRoleKeyFromRoles(membership.roles);
}

function inferPermissionRoleKeyFromRoles(roles: SessionWorkspaceRole[]) {
  return roles.includes("hospital_admin") ? "owner" : "general";
}

function inferJobPositionKeyFromRoles(roles: SessionWorkspaceRole[]) {
  if (roles.includes("vet")) return "veterinarian";
  if (roles.includes("technician")) return "technician";
  if (roles.includes("hospital_admin")) return "hospital_director";
  return "front_desk";
}

function createCustomCatalogKey(label: string, existingKeys: string[]) {
  const existing = new Set([...existingKeys, ...defaultPermissionRoleKeys, ...defaultJobPositionKeys]);
  const asciiSlug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const base = `custom:${asciiSlug || hashLabel(label)}`;
  let candidate = base;
  let index = 2;

  while (existing.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }

  return candidate.slice(0, 63);
}

function hashLabel(label: string) {
  let hash = 0;

  for (const char of label) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash.toString(36);
}
