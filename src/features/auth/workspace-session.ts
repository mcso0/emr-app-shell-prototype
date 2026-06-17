import type { MockSessionStorageMode } from "@/features/auth/mock-session";
import {
  LEGACY_SALES_DEMO_WORKSPACE_DISPLAY_NAME,
  LEGACY_SALES_DEMO_WORKSPACE_ID,
  PREPARED_EMPTY_CLINIC_WORKSPACE_DISPLAY_NAME,
  PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
} from "@/lib/emr-domain/demo-workspaces";

export type SessionWorkspaceSubscriptionStatus = "trialing" | "active" | "none";
export type SessionWorkspaceRole = "hospital_admin" | "vet" | "technician" | "front_desk";
export type SessionWorkspaceMembershipStatus = "pending" | "active" | "inactive" | "suspended";
export type SessionWorkspaceInvitationStatus = "pending" | "accepted" | "canceled" | "expired";
export type SessionWorkspaceAccessStatus =
  | "unknown"
  | "active"
  | "pending"
  | "inactive"
  | "suspended"
  | "missing";

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
  title: string;
  department: string;
};

export type WorkspaceInvitationFieldErrors = Partial<
  Record<"email" | "roles", string>
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

export type SessionWorkspaceMembership = {
  id: string;
  workspaceId: string;
  userSessionId: string;
  displayName?: string;
  email?: string | null;
  roles: SessionWorkspaceRole[];
  status: SessionWorkspaceMembershipStatus;
  title?: string | null;
  department?: string | null;
  createdAt: string;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
};

export type SessionWorkspaceInvitation = {
  id: string;
  workspaceId: string;
  email: string;
  invitedRoles: SessionWorkspaceRole[];
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

export function isSessionWorkspaceRole(value: unknown): value is SessionWorkspaceRole {
  return typeof value === "string" && roleIds.has(value as SessionWorkspaceRole);
}

export function getSessionWorkspaceRoleLabel(role: SessionWorkspaceRole) {
  return SESSION_WORKSPACE_ROLES.find((item) => item.id === role)?.label ?? role;
}

export function getSessionWorkspaceRoleLabels(roles: SessionWorkspaceRole[]) {
  return roles.map(getSessionWorkspaceRoleLabel).join(", ");
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
  workspaceId: string
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

  return {
    id: `${workspaceId}:invite:${normalizedEmail}`,
    workspaceId,
    email: normalizedEmail,
    invitedRoles: roles,
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
    updatedAt: now,
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
  roles: SessionWorkspaceRole[],
  now = new Date().toISOString()
): WorkspaceMembershipMutationResult {
  const membership = state.memberships.find((item) => item.id === membershipId);

  if (!membership) {
    return { success: false, reason: "membership_not_found", state };
  }

  const nextRoles = Array.from(new Set(roles.filter(isSessionWorkspaceRole)));

  if (nextRoles.length === 0) {
    return { success: false, reason: "invalid_roles", state };
  }

  if (wouldRemoveLastActiveHospitalAdmin(state, membership, nextRoles, membership.status)) {
    return { success: false, reason: "last_admin_protected", state };
  }

  return {
    success: true,
    state: {
      ...state,
      memberships: state.memberships.map((item) =>
        item.id === membershipId ? { ...item, roles: nextRoles } : item
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

  if (wouldRemoveLastActiveHospitalAdmin(state, membership, membership.roles, "inactive")) {
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
      membership.status === "suspended") &&
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

function wouldRemoveLastActiveHospitalAdmin(
  state: SessionWorkspacesState,
  target: SessionWorkspaceMembership,
  nextRoles: SessionWorkspaceRole[],
  nextStatus: SessionWorkspaceMembershipStatus
) {
  const activeAdminCount = state.memberships.filter(
    (membership) =>
      membership.workspaceId === target.workspaceId &&
      membership.status === "active" &&
      membership.roles.includes("hospital_admin")
  ).length;
  const targetIsActiveAdmin =
    target.status === "active" && target.roles.includes("hospital_admin");
  const targetWillRemainActiveAdmin =
    nextStatus === "active" && nextRoles.includes("hospital_admin");

  return targetIsActiveAdmin && activeAdminCount <= 1 && !targetWillRemainActiveAdmin;
}
