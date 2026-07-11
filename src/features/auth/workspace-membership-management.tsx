"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CdsPeopleUserPlusIcon } from "@/components/cds-icons/people-and-places";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
import { EmrPageHeader } from "@/components/emr/page-header";
import { EmrRowActionMenu, type EmrRowActionMenuItem } from "@/components/emr/row-action-menu";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG,
  acceptSessionWorkspaceInvitation,
  appendSessionWorkspaceInvitation,
  cancelSessionWorkspaceInvitation,
  createOrUpdateSessionWorkspaceCustomPermissionRole,
  createEmptySessionWorkspacesState,
  createSessionWorkspaceCustomJobPosition,
  createSessionWorkspaceInvitation,
  getSessionWorkspaceJobPositionLabel,
  getSessionWorkspaceJobPositions,
  getSessionWorkspaceLegacyRolesForAssignment,
  getSessionWorkspacePermissionRoleLabel,
  getSessionWorkspacePermissionRoleSummary,
  getSessionWorkspacePermissionRoles,
  persistSessionWorkspacesState,
  readSessionWorkspacesState,
  resendSessionWorkspaceInvitation,
  validateWorkspaceInvitationInput,
  type SessionWorkspaceInvitation,
  type SessionWorkspaceMembership,
  type SessionWorkspacesState,
  type WorkspaceInvitationFieldErrors,
  deactivateSessionWorkspaceMembership,
  updateSessionWorkspaceMembershipStatus,
  updateSessionWorkspaceMembershipRoles,
} from "@/features/auth/workspace-session";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";

type WorkspaceMembershipManagementProps = {
  workspaceId: string;
};

type MemberRow = SessionWorkspaceMembership & {
  rowType: "member";
};

type InvitationRow = SessionWorkspaceInvitation & {
  rowType: "invitation";
};

type MembershipRow = MemberRow | InvitationRow;
type MembershipDirectoryTab = "all" | "pending" | "inactive" | "deleted";

type WorkspaceInvitationRouteResponse =
  | {
      ok: true;
      invitation: SessionWorkspaceInvitation;
    }
  | {
      ok: false;
      error?: "invalid_input";
      fieldErrors?: WorkspaceInvitationFieldErrors;
      denialReason?:
        | "duplicate_pending_invitation"
        | "active_membership_exists"
        | "permission_missing"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "unauthenticated";
    };

type WorkspaceMembershipStatusRouteResponse =
  | {
      ok: true;
      memberships: SessionWorkspaceMembership[];
      invitations: SessionWorkspaceInvitation[];
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
    };

function getBrowserWorkspaceState() {
  if (typeof window === "undefined") return createEmptySessionWorkspacesState();

  return (
    readSessionWorkspacesState(window.sessionStorage, window.localStorage) ??
    createEmptySessionWorkspacesState()
  );
}

function getStatusLabel(row: MembershipRow) {
  if (row.rowType === "invitation") return row.status === "pending" ? "초대 대기" : row.status;
  if (row.status === "soft_deleted") return "삭제됨";
  if (row.status === "inactive") return "비활성";
  if (row.status === "active") return "활성";
  return row.status;
}

function getRowEmail(row: MembershipRow) {
  if (row.rowType === "invitation") return row.email;
  return row.email ?? row.userSessionId;
}

function getRowRoles(row: MembershipRow) {
  if (row.rowType === "invitation") return row.invitedRoles;
  return row.roles;
}

function getRowPermissionRoleKey(row: MembershipRow) {
  const roleKey = row.rowType === "invitation" ? row.permissionRoleKey : row.permissionRoleKey;
  if (roleKey) return roleKey;
  return getRowRoles(row).includes("hospital_admin") ? "owner" : "general";
}

function getRowJobPositionKey(row: MembershipRow) {
  const positionKey = row.rowType === "invitation" ? row.jobPositionKey : row.jobPositionKey;
  if (positionKey) return positionKey;
  const roles = getRowRoles(row);
  if (roles.includes("vet")) return "veterinarian";
  if (roles.includes("technician")) return "technician";
  if (roles.includes("hospital_admin")) return "hospital_director";
  return "front_desk";
}

function getMembershipDisplayName(membership: SessionWorkspaceMembership) {
  return membership.displayName || membership.email || membership.userSessionId;
}

function getMembershipPermissionRoleKey(membership: SessionWorkspaceMembership) {
  if (membership.permissionRoleKey) return membership.permissionRoleKey;
  return membership.roles.includes("hospital_admin") ? "owner" : "general";
}

function getMembershipJobPositionKey(membership: SessionWorkspaceMembership) {
  if (membership.jobPositionKey) return membership.jobPositionKey;
  if (membership.roles.includes("vet")) return "veterinarian";
  if (membership.roles.includes("technician")) return "technician";
  if (membership.roles.includes("hospital_admin")) return "hospital_director";
  return "front_desk";
}

function formatMembershipDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "-";
}

function MembershipDetailItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-card px-3 py-2">
      <dt className="text-[12px] leading-4 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] font-medium leading-5 text-[var(--emr-text-primary)]">
        {value}
      </dd>
    </div>
  );
}

export function WorkspaceMembershipManagement({
  workspaceId,
}: WorkspaceMembershipManagementProps) {
  const { hydrated, hydrate, session } = useAuthClient();
  const [state, setState] = useState<SessionWorkspacesState>(getBrowserWorkspaceState);
  const stateRef = useRef(state);
  const [fieldErrors, setFieldErrors] = useState<WorkspaceInvitationFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingInvitation, setEditingInvitation] = useState<SessionWorkspaceInvitation | null>(null);
  const [statusReadState, setStatusReadState] =
    useState<"idle" | "loading" | "error">("idle");
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [submittingInvitation, setSubmittingInvitation] = useState(false);
  const [selectedPermissionRoleKey, setSelectedPermissionRoleKey] = useState("general");
  const [selectedJobPositionKey, setSelectedJobPositionKey] = useState("front_desk");
  const [selectedMembership, setSelectedMembership] = useState<SessionWorkspaceMembership | null>(
    null
  );
  const [editingMembership, setEditingMembership] = useState<SessionWorkspaceMembership | null>(
    null
  );
  const [editingPermissionRoleKey, setEditingPermissionRoleKey] = useState("general");
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);
  const [submittingRoleChange, setSubmittingRoleChange] = useState(false);
  const [confirmRoleChangeOpen, setConfirmRoleChangeOpen] = useState(false);
  const [customRoleName, setCustomRoleName] = useState("");
  const [customRolePermissionIds, setCustomRolePermissionIds] = useState<string[]>([]);
  const [editingCustomRoleKey, setEditingCustomRoleKey] = useState<string | null>(null);
  const [customRoleError, setCustomRoleError] = useState<string | null>(null);
  const [customJobPositionName, setCustomJobPositionName] = useState("");
  const [customJobPositionError, setCustomJobPositionError] = useState<string | null>(null);
  const [deactivatingMembership, setDeactivatingMembership] =
    useState<SessionWorkspaceMembership | null>(null);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);
  const [directoryTab, setDirectoryTab] = useState<MembershipDirectoryTab>("all");
  const [memberQuery, setMemberQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [archivingMembership, setArchivingMembership] = useState<SessionWorkspaceMembership | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [submittingArchive, setSubmittingArchive] = useState(false);
  const canManageMembers = session?.role === "hospital_admin" || session?.role === "supabase";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const workspaceRows = useMemo<MembershipRow[]>(() => {
    const memberships = state.memberships
      .filter((membership) => membership.workspaceId === workspaceId)
      .map((membership): MemberRow => ({ ...membership, rowType: "member" }));
    const invitations = state.invitations
      .filter((invitation) => invitation.workspaceId === workspaceId)
      .map((invitation): InvitationRow => ({ ...invitation, rowType: "invitation" }));

    return [...memberships, ...invitations].sort((left, right) =>
      getRowEmail(left).localeCompare(getRowEmail(right))
    );
  }, [state.invitations, state.memberships, workspaceId]);
  const permissionRoles = useMemo(
    () => getSessionWorkspacePermissionRoles(state, workspaceId),
    [state, workspaceId]
  );
  const jobPositions = useMemo(
    () => getSessionWorkspaceJobPositions(state, workspaceId),
    [state, workspaceId]
  );
  const customPermissionRoles = permissionRoles.filter((role) => role.roleType === "custom");

  const activeMembers = state.memberships.filter(
    (membership) => membership.workspaceId === workspaceId && membership.status === "active"
  );
  const inactiveMembers = state.memberships.filter(
    (membership) =>
      membership.workspaceId === workspaceId &&
      (membership.status === "inactive" || membership.status === "suspended")
  );
  const pendingInvitations = state.invitations.filter(
    (invitation) => invitation.workspaceId === workspaceId && invitation.status === "pending"
  );
  const softDeletedMembers = state.memberships.filter(
    (membership) => membership.workspaceId === workspaceId && membership.status === "soft_deleted"
  );
  const activeOwnerCount = activeMembers.filter(
    (membership) => getMembershipPermissionRoleKey(membership) === "owner" || membership.roles.includes("hospital_admin")
  ).length;
  const currentActorId = session ? getDemoInvitationActorId(session.role) : null;
  const jobFilterOptions = Array.from(
    new Set(workspaceRows.map((row) => getSessionWorkspaceJobPositionLabel(getRowJobPositionKey(row), state, workspaceId)))
  );
  const departmentFilterOptions = Array.from(
    new Set(workspaceRows.map((row) => row.department).filter((department): department is string => Boolean(department)))
  );
  const visibleRows = workspaceRows.filter((row) => {
    const query = memberQuery.trim().toLowerCase();
    const matchesQuery = !query || [getRowEmail(row), row.rowType === "member" ? row.displayName ?? "" : ""].some((value) => value.toLowerCase().includes(query));
    const matchesJob = jobFilter === "all" || getSessionWorkspaceJobPositionLabel(getRowJobPositionKey(row), state, workspaceId) === jobFilter;
    const matchesDepartment = departmentFilter === "all" || row.department === departmentFilter;
    const matchesTab = directoryTab === "all"
      ? row.rowType === "invitation" || row.status !== "soft_deleted"
      : directoryTab === "pending"
        ? row.rowType === "invitation" && row.status === "pending"
        : directoryTab === "inactive"
          ? row.rowType === "member" && (row.status === "inactive" || row.status === "suspended")
          : row.rowType === "member" && row.status === "soft_deleted";
    return matchesQuery && matchesJob && matchesDepartment && matchesTab;
  });

  const updateState = useCallback((nextState: SessionWorkspacesState) => {
    stateRef.current = nextState;
    setState(nextState);
    if (session) {
      persistSessionWorkspacesState(
        nextState,
        session.storageMode,
        window.sessionStorage,
        window.localStorage
      );
      window.dispatchEvent(new Event("clair.sessionWorkspaces.v1"));
    }
  }, [session]);

  useEffect(() => {
    if (!hydrated || !session) return;

    const activeSession = session;
    let canceled = false;

    async function loadPersistedMembershipStatus() {
      setStatusReadState("loading");

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/memberships?includeDeleted=true`, {
          headers:
            activeSession.role === "supabase"
              ? undefined
              : { "x-clair-demo-session-user-id": getDemoInvitationActorId(activeSession.role) },
        });
        const result = await response.json() as WorkspaceMembershipStatusRouteResponse;

        if (canceled) return;

        if (!response.ok || !result.ok) {
          setStatusReadState("error");
          return;
        }

        if (result.memberships.length > 0 || result.invitations.length > 0) {
          updateState(
            mergePersistedWorkspaceMembershipStatus(stateRef.current, workspaceId, {
              memberships: result.memberships,
              invitations: result.invitations,
            })
          );
        }

        setStatusReadState("idle");
      } catch {
        if (!canceled) setStatusReadState("error");
      }
    }

    void loadPersistedMembershipStatus();

    return () => {
      canceled = true;
    };
  }, [hydrated, session, updateState, workspaceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManageMembers) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedRoles = getSessionWorkspaceLegacyRolesForAssignment({
      permissionRoleKey: selectedPermissionRoleKey,
      jobPositionKey: selectedJobPositionKey,
    });
    const input = {
      email: String(formData.get("email") ?? ""),
      roles: selectedRoles,
      permissionRoleKey: selectedPermissionRoleKey,
      jobPositionKey: selectedJobPositionKey,
      title: String(formData.get("title") ?? ""),
      department: String(formData.get("department") ?? ""),
    };
    const validation = validateWorkspaceInvitationInput(input, state, workspaceId);

    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    if (editingInvitation) {
      const now = new Date().toISOString();
      updateState({
        ...state,
        invitations: state.invitations.map((invitation) =>
          invitation.id === editingInvitation.id
            ? { ...invitation, ...input, title: input.title || null, department: input.department || null, updatedAt: now }
            : invitation
        ),
        updatedAt: now,
      });
      setEditingInvitation(null);
      setFieldErrors({});
      setInviteSheetOpen(false);
      return;
    }

    setSubmittingInvitation(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session.role === "supabase"
            ? {}
            : { "x-clair-demo-session-user-id": getDemoInvitationActorId(session.role) }),
        },
        body: JSON.stringify(input),
      });
      const result = await response.json() as WorkspaceInvitationRouteResponse;

      if (!result.ok) {
        if (result.error === "invalid_input") {
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }

        if (result.denialReason === "duplicate_pending_invitation") {
          setFieldErrors({
            email: "이미 대기 중인 초대가 있습니다. 재발송을 사용하세요.",
          });
          return;
        }

        if (result.denialReason === "active_membership_exists") {
          setFieldErrors({ email: "이미 활성 멤버로 등록된 이메일입니다." });
          return;
        }

        setSubmitError("초대 저장 권한 또는 서버 상태를 확인해 주세요.");
        return;
      }

      if (!response.ok) {
        setSubmitError("초대 저장 권한 또는 서버 상태를 확인해 주세요.");
        return;
      }

      updateState(appendSessionWorkspaceInvitation(state, result.invitation));
      setFieldErrors({});
      setSelectedPermissionRoleKey("general");
      setSelectedJobPositionKey("front_desk");
      setInviteSheetOpen(false);
      form.reset();
    } catch {
      const invitation = createSessionWorkspaceInvitation(input, workspaceId, {
        sessionId: session.id,
        storageMode: session.storageMode,
      });
      updateState(appendSessionWorkspaceInvitation(state, invitation));
      setFieldErrors({});
      setSelectedPermissionRoleKey("general");
      setSelectedJobPositionKey("front_desk");
      setInviteSheetOpen(false);
      form.reset();
    } finally {
      setSubmittingInvitation(false);
    }
  }

  async function handleResend(invitationId: string) {
    if (!session || !canManageMembers) return;

    try {
      const response = await postInvitationLifecycle({
        workspaceId,
        invitationId,
        action: "resend",
        actorRole: session.role,
      });
      if (!response.ok) {
        setSubmitError("초대 재발송 권한 또는 서버 상태를 확인해 주세요.");
        return;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      // Mock fallback state still supports local demo operation.
    }

    updateState(resendSessionWorkspaceInvitation(state, invitationId));
  }

  async function handleCancel(invitationId: string) {
    if (!session || !canManageMembers) return;

    try {
      const response = await postInvitationLifecycle({
        workspaceId,
        invitationId,
        action: "cancel",
        actorRole: session.role,
      });
      if (!response.ok) {
        setSubmitError("초대 취소 권한 또는 서버 상태를 확인해 주세요.");
        return;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      // Mock fallback state still supports local demo operation.
    }

    updateState(cancelSessionWorkspaceInvitation(state, invitationId));
  }

  async function handleAccept(invitationId: string) {
    if (!session || !canManageMembers) return;

    try {
      const response = await postInvitationLifecycle({
        workspaceId,
        invitationId,
        action: "accept",
        actorRole: session.role,
      });
      if (!response.ok) {
        setSubmitError("초대 수락 시뮬레이션 상태를 확인해 주세요.");
        return;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      // Mock fallback state still supports local demo operation.
    }

    updateState(acceptSessionWorkspaceInvitation(state, invitationId));
  }

  function openRoleEditor(membership: SessionWorkspaceMembership) {
    setEditingMembership(membership);
    setEditingPermissionRoleKey(membership.permissionRoleKey ?? "general");
    setRoleChangeError(null);
    setConfirmRoleChangeOpen(false);
  }

  function handleRoleChangeReview() {
    if (!editingMembership) return;

    const editingRoles = getSessionWorkspaceLegacyRolesForAssignment({
      permissionRoleKey: editingPermissionRoleKey,
      jobPositionKey: editingMembership.jobPositionKey,
    });
    const result = updateSessionWorkspaceMembershipRoles(
      state,
      editingMembership.id,
      {
        roles: editingRoles,
        permissionRoleKey: editingPermissionRoleKey,
        jobPositionKey: editingMembership.jobPositionKey,
      }
    );

    if (!result.success) {
      setRoleChangeError(getMembershipMutationErrorMessage(result.reason));
      return;
    }

    setConfirmRoleChangeOpen(true);
  }

  async function handleRoleChangeConfirm() {
    if (!editingMembership || !session) return;

    setSubmittingRoleChange(true);
    setRoleChangeError(null);

    try {
      const editingRoles = getSessionWorkspaceLegacyRolesForAssignment({
        permissionRoleKey: editingPermissionRoleKey,
        jobPositionKey: editingMembership.jobPositionKey,
      });
      const response = await fetch(
        `/api/workspaces/${workspaceId}/memberships/${editingMembership.id}/roles`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(session.role === "supabase"
              ? {}
              : { "x-clair-demo-session-user-id": getDemoInvitationActorId(session.role) }),
          },
          body: JSON.stringify({
            roles: editingRoles,
            permissionRoleKey: editingPermissionRoleKey,
            jobPositionKey: editingMembership.jobPositionKey,
          }),
        }
      );
      const serverResult = await response.json() as {
        ok: boolean;
        denialReason?: string;
        error?: string;
      };

      if (!response.ok || !serverResult.ok) {
        setRoleChangeError(getMembershipMutationErrorMessage(serverResult.denialReason ?? serverResult.error ?? ""));
        setConfirmRoleChangeOpen(false);
        return;
      }
    } catch {
      setRoleChangeError("서버 권한 확인에 실패했습니다.");
      setConfirmRoleChangeOpen(false);
      return;
    } finally {
      setSubmittingRoleChange(false);
    }

    const editingRoles = getSessionWorkspaceLegacyRolesForAssignment({
      permissionRoleKey: editingPermissionRoleKey,
      jobPositionKey: editingMembership.jobPositionKey,
    });
    const result = updateSessionWorkspaceMembershipRoles(
      state,
      editingMembership.id,
      {
        roles: editingRoles,
        permissionRoleKey: editingPermissionRoleKey,
        jobPositionKey: editingMembership.jobPositionKey,
      }
    );

    if (!result.success) {
      setRoleChangeError(getMembershipMutationErrorMessage(result.reason));
      setConfirmRoleChangeOpen(false);
      return;
    }

    updateState(result.state);
    setEditingMembership(null);
    setEditingPermissionRoleKey("general");
    setRoleChangeError(null);
    setConfirmRoleChangeOpen(false);
  }

  function handleCustomRolePermissionToggle(permissionId: string, checked: boolean) {
    setCustomRolePermissionIds((current) =>
      checked
        ? Array.from(new Set([...current, permissionId]))
        : current.filter((item) => item !== permissionId)
    );
    setCustomRoleError(null);
  }

  function handleCustomRoleSubmit() {
    if (!canManageMembers) return;

    const result = createOrUpdateSessionWorkspaceCustomPermissionRole(state, {
      workspaceId,
      roleKey: editingCustomRoleKey,
      label: customRoleName,
      permissionIds: customRolePermissionIds,
    });

    if (!result.success) {
      setCustomRoleError(getCustomRoleErrorMessage(result.reason));
      return;
    }

    updateState(result.state);
    setSelectedPermissionRoleKey(result.role.roleKey);
    setCustomRoleName("");
    setCustomRolePermissionIds([]);
    setEditingCustomRoleKey(null);
    setCustomRoleError(null);
  }

  function handleCustomRoleEdit(roleKey: string) {
    const role = customPermissionRoles.find((item) => item.roleKey === roleKey);
    if (!role) return;

    setEditingCustomRoleKey(role.roleKey);
    setCustomRoleName(role.label);
    setCustomRolePermissionIds(role.permissionIds);
    setCustomRoleError(null);
  }

  function handleCustomJobPositionSubmit() {
    if (!canManageMembers) return;

    const result = createSessionWorkspaceCustomJobPosition(state, {
      workspaceId,
      label: customJobPositionName,
    });

    if (!result.success) {
      setCustomJobPositionError(getCustomJobPositionErrorMessage(result.reason));
      return;
    }

    updateState(result.state);
    setSelectedJobPositionKey(result.position.positionKey);
    setCustomJobPositionName("");
    setCustomJobPositionError(null);
  }

  async function handleDeactivationConfirm() {
    if (!deactivatingMembership || !session) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/memberships/${deactivatingMembership.id}/status`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...(session.role === "supabase"
              ? {}
              : { "x-clair-demo-session-user-id": getDemoInvitationActorId(session.role) }),
          },
          body: JSON.stringify({ status: "inactive" }),
        }
      );
      const serverResult = await response.json() as {
        ok: boolean;
        denialReason?: string;
        error?: string;
      };

      if (!response.ok || !serverResult.ok) {
        setDeactivationError(
          serverResult.denialReason === "last_admin_protected"
            ? "마지막 병원관리자는 비활성화할 수 없습니다."
            : "서버 권한 확인에 실패했습니다."
        );
        setDeactivatingMembership(null);
        return;
      }
    } catch {
      setDeactivationError("서버 권한 확인에 실패했습니다.");
      setDeactivatingMembership(null);
      return;
    }

    const result = deactivateSessionWorkspaceMembership(state, deactivatingMembership.id);

    if (!result.success) {
      setDeactivationError(
        result.reason === "last_admin_protected"
          ? "마지막 소유자는 비활성화할 수 없습니다."
          : getMembershipMutationErrorMessage(result.reason)
      );
      setDeactivatingMembership(null);
      return;
    }

    updateState(result.state);
    setDeactivatingMembership(null);
    setSelectedMembership(null);
    setDeactivationError(null);
  }

  async function handleMembershipActivation(membership: SessionWorkspaceMembership) {
    if (!session) return;

    const response = await fetch(
      `/api/workspaces/${workspaceId}/memberships/${membership.id}/status`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(session.role === "supabase"
            ? {}
            : { "x-clair-demo-session-user-id": getDemoInvitationActorId(session.role) }),
        },
        body: JSON.stringify({ status: "active" }),
      }
    );
    const result = await response.json() as { ok?: boolean };
    if (!response.ok || !result.ok) {
      setDeactivationError("구성원을 다시 활성화하지 못했습니다.");
      return;
    }

    const local = updateSessionWorkspaceMembershipStatus(state, membership.id, "active");
    if (local.success) updateState(local.state);
  }

  async function handleArchiveConfirm() {
    if (!archivingMembership || !session) return;
    const reason = archiveReason.trim();
    if (!reason) {
      setArchiveError("구성원 삭제 사유를 입력하세요.");
      return;
    }

    setSubmittingArchive(true);
    setArchiveError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/memberships/${archivingMembership.id}/archive`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(session.role === "supabase"
              ? {}
              : { "x-clair-demo-session-user-id": getDemoInvitationActorId(session.role) }),
          },
          body: JSON.stringify({ action: "soft_delete", reason }),
        }
      );
      const result = await response.json() as { ok?: boolean; denialReason?: string };
      if (!response.ok || !result.ok) {
        setArchiveError(
          result.denialReason === "self_action_protected"
            ? "본인 구성원 기록은 삭제할 수 없습니다."
            : result.denialReason === "last_admin_protected"
              ? "다른 활성 소유자를 지정한 후 삭제할 수 있습니다."
              : "구성원 삭제 권한 또는 상태를 확인해 주세요."
        );
        return;
      }
      const local = updateSessionWorkspaceMembershipStatus(
        state,
        archivingMembership.id,
        "soft_deleted",
        { deletedAt: new Date().toISOString(), deletedByUserId: currentActorId, deletedReason: reason, restoredAt: null, restoredByUserId: null }
      );
      if (local.success) updateState(local.state);
      setSelectedMembership(null);
      setArchivingMembership(null);
      setArchiveReason("");
    } catch {
      setArchiveError("구성원 삭제 요청을 완료하지 못했습니다.");
    } finally {
      setSubmittingArchive(false);
    }
  }

  async function handleRestore(membership: SessionWorkspaceMembership) {
    if (!session) return;
    const response = await fetch(`/api/workspaces/${workspaceId}/memberships/${membership.id}/archive`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(session.role === "supabase"
          ? {}
          : { "x-clair-demo-session-user-id": getDemoInvitationActorId(session.role) }),
      },
      body: JSON.stringify({ action: "restore" }),
    });
    const result = await response.json() as { ok?: boolean };
    if (!response.ok || !result.ok) {
      setDeactivationError("구성원을 복구하지 못했습니다.");
      return;
    }
    const local = updateSessionWorkspaceMembershipStatus(
      state,
      membership.id,
      "inactive",
      { restoredAt: new Date().toISOString(), restoredByUserId: currentActorId }
    );
    if (local.success) updateState(local.state);
  }

  function getRowActions(row: MembershipRow): EmrRowActionMenuItem[] {
    if (row.rowType === "invitation") {
      return [
        { key: "edit-invitation", label: "초대 정보 수정", description: "역할·직무·소속 정보를 수정합니다.", onSelect: () => { setEditingInvitation(row); setSelectedPermissionRoleKey(getRowPermissionRoleKey(row)); setSelectedJobPositionKey(getRowJobPositionKey(row)); setInviteSheetOpen(true); }, disabled: !canManageMembers },
        { key: "resend", label: "초대 재발송", onSelect: () => handleResend(row.id), disabled: !canManageMembers },
        { key: "accept", label: "수락 시뮬레이션", onSelect: () => handleAccept(row.id), disabled: !canManageMembers },
        { key: "cancel", label: "초대 취소", onSelect: () => handleCancel(row.id), disabled: !canManageMembers, variant: "destructive" },
      ];
    }
    const selfAction = row.userSessionId === currentActorId;
    const lastOwner = row.status === "active" && activeOwnerCount <= 1 && (getMembershipPermissionRoleKey(row) === "owner" || row.roles.includes("hospital_admin"));
    const protectionDescription = selfAction ? "본인 구성원 기록은 이 화면에서 변경할 수 없습니다." : lastOwner ? "다른 활성 소유자를 지정한 후 진행할 수 있습니다." : undefined;
    if (row.status === "soft_deleted") {
      return [{ key: "restore", label: "복구", description: "복구 후 비활성 상태로 전환됩니다.", onSelect: () => void handleRestore(row), disabled: !canManageMembers }];
    }
    if (row.status === "inactive" || row.status === "suspended") {
      return [
        { key: "activate", label: "다시 활성화", onSelect: () => void handleMembershipActivation(row), disabled: !canManageMembers || selfAction, description: protectionDescription },
        { key: "soft-delete", label: "구성원 삭제", description: protectionDescription ?? "삭제됨 탭에서 복구할 수 있습니다.", onSelect: () => { setArchiveError(null); setArchiveReason(""); setArchivingMembership(row); }, disabled: !canManageMembers || selfAction || lastOwner, variant: "destructive" },
      ];
    }
    return [
      { key: "edit", label: "권한·직무 수정", onSelect: () => openRoleEditor(row), disabled: !canManageMembers },
      { key: "deactivate", label: "비활성화", description: protectionDescription, onSelect: () => { setDeactivationError(null); setDeactivatingMembership(row); }, disabled: !canManageMembers || selfAction || lastOwner },
      { key: "soft-delete", label: "구성원 삭제", description: protectionDescription ?? "삭제됨 탭에서 복구할 수 있습니다.", onSelect: () => { setArchiveError(null); setArchiveReason(""); setArchivingMembership(row); }, disabled: !canManageMembers || selfAction || lastOwner, variant: "destructive" },
    ];
  }

  const selectedMembershipPermissionRoleKey = selectedMembership
    ? getMembershipPermissionRoleKey(selectedMembership)
    : "general";
  const selectedMembershipJobPositionKey = selectedMembership
    ? getMembershipJobPositionKey(selectedMembership)
    : "front_desk";
  const selectedMembershipPermissionRoleLabel = getSessionWorkspacePermissionRoleLabel(
    selectedMembershipPermissionRoleKey,
    state,
    workspaceId
  );
  const selectedMembershipJobPositionLabel = getSessionWorkspaceJobPositionLabel(
    selectedMembershipJobPositionKey,
    state,
    workspaceId
  );

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] text-[13px] text-muted-foreground">
        구성원 정보를 불러옵니다.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-[var(--emr-surface-workspace)] lg:overflow-hidden">
      <section className="border-b bg-card px-5 py-4">
        <EmrPageHeader
          title="병원 구성원"
          actions={
            <Button type="button" size="sm" disabled={!canManageMembers} onClick={() => { setSelectedMembership(null); setInviteSheetOpen(true); }}>
              <CdsPeopleUserPlusIcon data-icon="inline-start" aria-hidden="true" />
              직원 초대
            </Button>
          }
        />
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">구성원의 소속과 권한을 확인하고 초대를 관리해.</p>
      </section>

      <section className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full min-h-0 bg-[var(--emr-surface-workspace)]">
          <div className="p-4">
            {statusReadState === "loading" ? (
              <p className="mb-3 rounded-[var(--clair-radius-md)] border border-[var(--emr-line-hairline)] bg-card px-3 py-2 text-[12px] text-muted-foreground">
                서버 상태를 불러오는 중입니다.
              </p>
            ) : statusReadState === "error" ? (
              <p
                role="alert"
                className="mb-3 rounded-[var(--clair-radius-md)] border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-3 py-2 text-[12px] text-[var(--emr-status-warning-text)]"
              >
                서버 상태를 읽지 못해 브라우저 임시 상태를 표시합니다.
              </p>
            ) : null}

            <div className="mb-4 flex flex-col gap-3">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                <Input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="이름 또는 이메일 검색" aria-label="구성원 검색" />
                <Select value={jobFilter} onValueChange={(value) => setJobFilter(value ?? "all")}>
                  <SelectTrigger><SelectValue placeholder="모든 직무" /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="all">모든 직무</SelectItem>{jobFilterOptions.map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value ?? "all")}>
                  <SelectTrigger><SelectValue placeholder="모든 부서" /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="all">모든 부서</SelectItem>{departmentFilterOptions.map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </div>
              <LineTabs
                aria-label="구성원 상태"
                size="default"
                value={directoryTab}
                onValueChange={setDirectoryTab}
                items={[
                  { value: "all", label: "전체", count: activeMembers.length + inactiveMembers.length + pendingInvitations.length },
                  { value: "pending", label: "초대 대기", count: pendingInvitations.length },
                  { value: "inactive", label: "비활성", count: inactiveMembers.length },
                  { value: "deleted", label: "삭제됨", count: softDeletedMembers.length },
                ]}
              />
            </div>

            {submitError ? (
              <p
                role="alert"
                className="mb-3 rounded-[var(--clair-radius-md)] border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-danger-text)]"
              >
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 md:hidden">
              {statusReadState === "loading" ? Array.from({ length: 4 }, (_, index) => <Skeleton key={`member-card-skeleton-${index}`} className="h-24 w-full" />) : visibleRows.map((row) => (
                <button key={`member-card-${row.rowType}-${row.id}`} type="button" className="rounded-md border bg-card p-3 text-left" onClick={() => row.rowType === "member" && setSelectedMembership(row)}>
                  <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Avatar className="size-8"><AvatarFallback>{(row.rowType === "member" ? getMembershipDisplayName(row) : getRowEmail(row)).slice(0, 1)}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.rowType === "member" ? getMembershipDisplayName(row) : getRowEmail(row)}</p><p className="truncate text-xs text-muted-foreground">{getRowEmail(row)}</p></div></div><span onClick={(event) => event.stopPropagation()}><EmrRowActionMenu ariaLabel={`${getRowEmail(row)} 작업`} items={getRowActions(row)} /></span></div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{getSessionWorkspaceJobPositionLabel(getRowJobPositionKey(row), state, workspaceId)}</span><span>·</span><span>{row.department ?? "소속 미지정"}</span><Badge variant="outline">{getSessionWorkspacePermissionRoleLabel(getRowPermissionRoleKey(row), state, workspaceId)}</Badge><Badge variant={row.status === "soft_deleted" ? "destructive" : "outline"}>{getStatusLabel(row)}</Badge></div>
                  {row.rowType === "member" && row.status === "soft_deleted" ? <p className="mt-2 text-xs text-muted-foreground">삭제 사유: {row.deletedReason ?? "-"} · 검토 예정일: {row.deletedAt ? formatMembershipDate(new Date(new Date(row.deletedAt).getTime() + 90 * 86400000).toISOString()) : "-"}</p> : null}
                </button>
              ))}
              {statusReadState !== "loading" && visibleRows.length === 0 ? <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">현재 조건에 맞는 구성원이 없습니다.</p> : null}
            </div>

            <Table minWidth={720} className="hidden table-fixed text-[13px] md:table">
              <TableHeader className="bg-[var(--emr-surface-muted)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[240px]">구성원</TableHead>
                  <TableHead className="w-[150px]">조직 정보</TableHead>
                  <TableHead className="w-[110px]">권한</TableHead>
                  <TableHead className="w-[110px]">최근 로그인</TableHead>
                  <TableHead className="w-[90px]">상태</TableHead>
                  <TableHead className="w-[52px] text-right"><span className="sr-only">작업</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusReadState === "loading" ? Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={`member-skeleton-${index}`}><TableCell><Skeleton className="h-9 w-44" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-12" /></TableCell><TableCell><Skeleton className="h-4 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-14" /></TableCell><TableCell /></TableRow>
                )) : visibleRows.map((row) => {
                  const pending = row.rowType === "invitation" && row.status === "pending";
                  const selectable = row.rowType === "member";

                  return (
                    <TableRow
                      key={`${row.rowType}-${row.id}`}
                      aria-label={selectable ? `${getRowEmail(row)} 상세 보기` : undefined}
                      className={
                        selectable
                          ? "cursor-pointer bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[-2px]"
                          : "bg-card"
                      }
                      data-state={selectedMembership?.id === row.id ? "selected" : undefined}
                      tabIndex={selectable ? 0 : undefined}
                      onClick={() => {
                        if (row.rowType === "member") setSelectedMembership(row);
                      }}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (row.rowType !== "member") return;
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedMembership(row);
                      }}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2.5"><Avatar className="size-8"><AvatarFallback>{(row.rowType === "member" ? getMembershipDisplayName(row) : getRowEmail(row)).slice(0, 1)}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-semibold">{row.rowType === "member" ? getMembershipDisplayName(row) : getRowEmail(row)}</p><p className="truncate text-[12px] text-muted-foreground">{getRowEmail(row)}</p></div></div>
                      </TableCell>
                      <TableCell>
                        <div>{getSessionWorkspaceJobPositionLabel(getRowJobPositionKey(row), state, workspaceId)}</div><div className="text-[12px] text-muted-foreground">{[row.department, row.title].filter(Boolean).join(" · ") || "소속 미지정"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getSessionWorkspacePermissionRoleLabel(getRowPermissionRoleKey(row), state, workspaceId)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.rowType === "member" ? formatMembershipDate(row.lastLoginAt) === "-" ? "로그인 기록 없음" : formatMembershipDate(row.lastLoginAt) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={pending ? "secondary" : row.status === "soft_deleted" ? "destructive" : "outline"}>{getStatusLabel(row)}</Badge>
                      </TableCell>
                      <TableCell className="text-right"><EmrRowActionMenu ariaLabel={`${getRowEmail(row)} 작업`} items={getRowActions(row)} /></TableCell>
                    </TableRow>
                  );
                })}
                {statusReadState !== "loading" && visibleRows.length === 0 ? (
                  <TableRow className="bg-card">
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      현재 조건에 맞는 구성원이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </section>

      <Sheet open={inviteSheetOpen} onOpenChange={(open) => { setInviteSheetOpen(open); if (!open) setEditingInvitation(null); }}>
        <SheetContent className="w-[min(520px,calc(100vw-1rem))] gap-0 p-0 sm:max-w-[520px]">
          <SheetHeader className="border-b border-[var(--emr-line-hairline)] px-5 py-4">
            <SheetTitle className="text-[16px] leading-6">{editingInvitation ? "초대 정보 수정" : "직원 초대"}</SheetTitle>
            <SheetDescription className="text-[12px] leading-5">
              실제 이메일 발송 없이 초대 상태만 저장합니다.
            </SheetDescription>
          </SheetHeader>
          <form key={editingInvitation?.id ?? "new"} className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <ScrollArea className="min-h-0 flex-1">
              <FieldGroup className="p-4">
                {!canManageMembers ? (
                  <p
                    role="alert"
                    className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-warning-text)]"
                  >
                    병원관리자만 직원을 초대하거나 멤버십을 변경할 수 있습니다.
                  </p>
                ) : null}

                {submitError ? (
                  <p
                    role="alert"
                    className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-danger-text)]"
                  >
                    {submitError}
                  </p>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="workspace-invitation-email">초대 이메일</FieldLabel>
                  <Input
                    id="workspace-invitation-email"
                    name="email"
                    type="email"
                    placeholder="staff@hos.kr"
                    defaultValue={editingInvitation?.email ?? ""}
                    disabled={!canManageMembers || submittingInvitation}
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  {fieldErrors.email ? (
                    <FieldError className="text-[12px] text-[var(--emr-status-danger-text)]">
                      {fieldErrors.email}
                    </FieldError>
                  ) : null}
                </Field>

                <FieldSet className="gap-2">
                  <FieldLegend className="mb-0 text-[13px]">권한 역할</FieldLegend>
                  <FieldDescription className="hidden text-[12px] sm:block">
                    할 수 있는 작업 범위를 정합니다. 새 역할은 역할 및 권한 화면에서 관리합니다.
                  </FieldDescription>
                  <RadioGroup
                    aria-label="권한 역할"
                    className="gap-2"
                    value={selectedPermissionRoleKey}
                    onValueChange={(value) => {
                      setSelectedPermissionRoleKey(String(value));
                      setFieldErrors((current) => ({ ...current, permissionRoleKey: undefined }));
                    }}
                  >
                    {permissionRoles.map((role) => (
                      <label
                        key={role.roleKey}
                        className="flex items-start gap-2 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-card px-3 py-2 text-[13px] text-[var(--emr-text-primary)]"
                      >
                        <Radio
                          aria-label={role.label}
                          value={role.roleKey}
                          disabled={!canManageMembers || submittingInvitation}
                        />
                        <span className="grid gap-0.5">
                          <span className="font-medium">{role.label}</span>
                          <span className="hidden text-[12px] leading-4 text-muted-foreground sm:inline">
                            {getSessionWorkspacePermissionRoleSummary(role.roleKey, state, workspaceId)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  <p className="hidden text-[12px] leading-5 text-muted-foreground sm:block">등록된 역할만 선택할 수 있습니다.</p>
                  {fieldErrors.permissionRoleKey || fieldErrors.roles ? (
                    <FieldError className="text-[12px] text-[var(--emr-status-danger-text)]">
                      {fieldErrors.permissionRoleKey ?? fieldErrors.roles}
                    </FieldError>
                  ) : null}
                </FieldSet>

                <FieldSet className="gap-2">
                  <FieldLegend className="mb-0 text-[13px]">직무</FieldLegend>
                  <FieldDescription className="hidden text-[12px] sm:block">
                    병원 안에서의 직무입니다. 권한 판단에는 사용하지 않습니다.
                  </FieldDescription>
                  <RadioGroup
                    aria-label="직무"
                    className="grid grid-cols-2 gap-2"
                    value={selectedJobPositionKey}
                    onValueChange={(value) => {
                      setSelectedJobPositionKey(String(value));
                      setFieldErrors((current) => ({ ...current, jobPositionKey: undefined }));
                    }}
                  >
                    {jobPositions.map((position) => (
                      <label
                        key={position.positionKey}
                        className="flex items-center gap-2 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-card px-3 py-2 text-[13px] text-[var(--emr-text-primary)]"
                      >
                        <Radio
                          aria-label={position.label}
                          value={position.positionKey}
                          disabled={!canManageMembers || submittingInvitation}
                        />
                        {position.label}
                      </label>
                    ))}
                  </RadioGroup>
                  {fieldErrors.jobPositionKey ? (
                    <FieldError className="text-[12px] text-[var(--emr-status-danger-text)]">
                      {fieldErrors.jobPositionKey}
                    </FieldError>
                  ) : null}
                </FieldSet>

                <Field>
                  <FieldLabel htmlFor="workspace-invitation-title">직책</FieldLabel>
                  <Input
                    id="workspace-invitation-title"
                    name="title"
                    placeholder="진료팀장"
                    defaultValue={editingInvitation?.title ?? ""}
                    disabled={!canManageMembers || submittingInvitation}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="workspace-invitation-department">부서</FieldLabel>
                  <Input
                    id="workspace-invitation-department"
                    name="department"
                    placeholder="진료팀"
                    defaultValue={editingInvitation?.department ?? ""}
                    disabled={!canManageMembers || submittingInvitation}
                  />
                </Field>

                <div className="hidden" aria-hidden="true">
                  <div>
                    <h3 className="text-[13px] font-semibold">권한 역할 설정</h3>
                    <p className="mt-1 hidden text-[12px] leading-5 text-muted-foreground sm:block">
                      소유자 전용 권한은 커스텀 역할에서 선택할 수 없습니다.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="workspace-custom-role-name">커스텀 역할 이름</FieldLabel>
                    <Input
                      id="workspace-custom-role-name"
                      value={customRoleName}
                      placeholder="검사 보조"
                      disabled={!canManageMembers || submittingInvitation}
                      onChange={(event) => {
                        setCustomRoleName(event.target.value);
                        setCustomRoleError(null);
                      }}
                    />
                  </Field>
                  <div className="grid gap-2">
                    {SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-center gap-2 text-[13px] text-[var(--emr-text-primary)]"
                      >
                        <Checkbox
                          aria-label={permission.label}
                          checked={customRolePermissionIds.includes(permission.id)}
                          disabled={!canManageMembers || submittingInvitation}
                          onCheckedChange={(checked) =>
                            handleCustomRolePermissionToggle(permission.id, Boolean(checked))
                          }
                        />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                  {customRoleError ? (
                    <FieldError className="text-[12px] text-[var(--emr-status-danger-text)]">
                      {customRoleError}
                    </FieldError>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManageMembers || submittingInvitation}
                      onClick={handleCustomRoleSubmit}
                    >
                      커스텀 역할 저장
                    </Button>
                    {editingCustomRoleKey ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCustomRoleKey(null);
                          setCustomRoleName("");
                          setCustomRolePermissionIds([]);
                          setCustomRoleError(null);
                        }}
                      >
                        편집 취소
                      </Button>
                    ) : null}
                  </div>
                  {customPermissionRoles.length > 0 ? (
                    <div className="grid gap-1">
                      {customPermissionRoles.map((role) => (
                        <div
                          key={role.roleKey}
                          className="flex items-center justify-between gap-2 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] px-3 py-2 text-[12px]"
                        >
                          <span className="min-w-0 truncate">{role.label}</span>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => handleCustomRoleEdit(role.roleKey)}
                          >
                            수정
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 border-t border-[var(--emr-line-hairline)] pt-4">
                  <div>
                    <h3 className="text-[13px] font-semibold">직무 설정</h3>
                    <p className="mt-1 hidden text-[12px] leading-5 text-muted-foreground sm:block">
                      기본 직무 외 병원별 직무를 추가합니다.
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="workspace-custom-job-position-name">
                      커스텀 직무 이름
                    </FieldLabel>
                    <Input
                      id="workspace-custom-job-position-name"
                      value={customJobPositionName}
                      placeholder="CS"
                      disabled={!canManageMembers || submittingInvitation}
                      onChange={(event) => {
                        setCustomJobPositionName(event.target.value);
                        setCustomJobPositionError(null);
                      }}
                    />
                  </Field>
                  {customJobPositionError ? (
                    <FieldError className="text-[12px] text-[var(--emr-status-danger-text)]">
                      {customJobPositionError}
                    </FieldError>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canManageMembers || submittingInvitation}
                    onClick={handleCustomJobPositionSubmit}
                  >
                    직무 추가
                  </Button>
                </div>
              </FieldGroup>
            </ScrollArea>
            <SheetFooter className="border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={submittingInvitation}
                onClick={() => setInviteSheetOpen(false)}
              >
                닫기
              </Button>
              <Button type="submit" disabled={!canManageMembers || submittingInvitation}>
                {submittingInvitation ? "저장 중" : editingInvitation ? "초대 정보 저장" : "초대 만들기"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(selectedMembership)}
        onOpenChange={(open) => {
          if (!open) setSelectedMembership(null);
        }}
      >
        <SheetContent className="w-[min(460px,calc(100vw-1rem))] gap-0 p-0 sm:max-w-[460px]">
          <SheetHeader className="border-b border-[var(--emr-line-hairline)] px-5 py-4">
            <SheetTitle className="text-[16px] leading-6">
              {selectedMembership ? getMembershipDisplayName(selectedMembership) : "구성원 상세"}
            </SheetTitle>
            <SheetDescription className="text-[12px] leading-5">
              기본 정보와 권한 역할을 확인합니다. 개인 프로필 정보는 본인 프로필에서 관리합니다.
            </SheetDescription>
          </SheetHeader>

          {selectedMembership ? (
            <>
              <ScrollArea className="min-h-0 flex-1">
                <div className="grid gap-4 p-4">
                  <section className="grid gap-2">
                    <h3 className="text-[13px] font-semibold">기본 정보</h3>
                    <dl className="grid gap-2">
                      <MembershipDetailItem
                        label="이름"
                        value={getMembershipDisplayName(selectedMembership)}
                      />
                      <MembershipDetailItem
                        label="이메일"
                        value={selectedMembership.email ?? "-"}
                      />
                      <MembershipDetailItem
                        label="사용자 ID"
                        value={selectedMembership.userSessionId}
                      />
                      <MembershipDetailItem label="상태" value={selectedMembership.status} />
                      <MembershipDetailItem label="직책" value={selectedMembership.title ?? "-"} />
                      <MembershipDetailItem
                        label="부서"
                        value={selectedMembership.department ?? "-"}
                      />
                    </dl>
                  </section>

                  <section className="grid gap-2">
                    <h3 className="text-[13px] font-semibold">권한 및 직무</h3>
                    <dl className="grid gap-2">
                      <MembershipDetailItem
                        label="권한 역할"
                        value={selectedMembershipPermissionRoleLabel}
                      />
                      <MembershipDetailItem
                        label="권한 설명"
                        value={getSessionWorkspacePermissionRoleSummary(
                          selectedMembershipPermissionRoleKey,
                          state,
                          workspaceId
                        )}
                      />
                      <MembershipDetailItem label="직무" value={selectedMembershipJobPositionLabel} />
                    </dl>
                  </section>

                  <section className="grid gap-2">
                    <h3 className="text-[13px] font-semibold">멤버십 이력</h3>
                    <dl className="grid gap-2">
                      <MembershipDetailItem
                        label="생성일"
                        value={formatMembershipDate(selectedMembership.createdAt)}
                      />
                      <MembershipDetailItem
                        label="활성화일"
                        value={formatMembershipDate(selectedMembership.activatedAt)}
                      />
                      <MembershipDetailItem
                        label="비활성화일"
                        value={formatMembershipDate(selectedMembership.deactivatedAt)}
                      />
                      <MembershipDetailItem
                        label="삭제일"
                        value={formatMembershipDate(selectedMembership.deletedAt)}
                      />
                      <MembershipDetailItem
                        label="삭제 사유"
                        value={selectedMembership.deletedReason || "-"}
                      />
                      {selectedMembership.deletedAt ? (
                        <MembershipDetailItem
                          label="검토 예정일"
                          value={formatMembershipDate(new Date(new Date(selectedMembership.deletedAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString())}
                        />
                      ) : null}
                    </dl>
                  </section>
                </div>
              </ScrollArea>

              <SheetFooter className="border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-3 sm:flex-row sm:justify-end">
                {!canManageMembers ? (
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    일반 계정은 이 페이지에서 조회만 가능합니다. 본인 정보는 프로필에서 변경하세요.
                  </p>
                ) : selectedMembership.status === "soft_deleted" ? (
                  <Button type="button" variant="outline" onClick={() => void handleRestore(selectedMembership)}>
                    복구
                  </Button>
                ) : selectedMembership.status !== "active" ? (
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    비활성 구성원은 현재 화면에서 권한을 수정할 수 없습니다.
                  </p>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedMembership(null);
                        openRoleEditor(selectedMembership);
                      }}
                    >
                      권한 수정
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setDeactivationError(null);
                        setDeactivatingMembership(selectedMembership);
                      }}
                    >
                      비활성화
                    </Button>
                  </>
                )}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(editingMembership)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMembership(null);
            setEditingPermissionRoleKey("general");
            setRoleChangeError(null);
            setConfirmRoleChangeOpen(false);
          }
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-[500px]">
          <DialogHeader className="px-6 pb-3 pt-6">
            <DialogTitle>구성원 권한 역할 수정</DialogTitle>
            <DialogDescription>
              {editingMembership?.email ?? editingMembership?.userSessionId}의 권한 역할을 조정합니다.
              실제 DB 저장 전까지는 이 브라우저 세션에만 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-6 pb-5">
            <RadioGroup
              aria-label="구성원 권한 역할"
              className="gap-2"
              value={editingPermissionRoleKey}
              onValueChange={(value) => {
                setEditingPermissionRoleKey(String(value));
                setRoleChangeError(null);
              }}
            >
              {permissionRoles.map((role) => (
                <label
                  key={role.roleKey}
                  className="flex items-start gap-2 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-card px-3 py-2 text-[13px] text-[var(--emr-text-primary)]"
                >
                  <Radio
                    aria-label={role.label}
                    value={role.roleKey}
                  />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{role.label}</span>
                    <span className="text-[12px] leading-4 text-muted-foreground">
                      {getSessionWorkspacePermissionRoleSummary(role.roleKey, state, workspaceId)}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div className="rounded-[var(--clair-radius-md)] border bg-[var(--emr-surface-muted)] px-3 py-2 text-[13px] leading-5 text-muted-foreground">
              {getSessionWorkspacePermissionRoleSummary(
                editingPermissionRoleKey,
                state,
                workspaceId
              )}
            </div>
            {roleChangeError ? (
              <p role="alert" className="text-[13px] text-[var(--emr-status-danger-text)]">
                {roleChangeError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="border-t bg-[var(--emr-surface-panel)] px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingMembership(null);
                setEditingPermissionRoleKey("general");
              }}
            >
              권한 수정 닫기
            </Button>
            <Button type="button" onClick={handleRoleChangeReview}>
              변경 검토
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRoleChangeOpen} onOpenChange={setConfirmRoleChangeOpen}>
        <EmrConfirmDialogContent
          title="권한 역할 변경 확인"
          description={
            <>
              선택한 권한 역할은 즉시 session-only 멤버십에 반영됩니다. 변경 후 권한은{" "}
              <strong>
                {getSessionWorkspacePermissionRoleSummary(
                  editingPermissionRoleKey,
                  state,
                  workspaceId
                )}
              </strong>
              입니다.
            </>
          }
          cancelLabel="취소"
          confirmLabel={submittingRoleChange ? "서버 확인 중" : "권한 역할 변경"}
          onCancel={() => setConfirmRoleChangeOpen(false)}
          onConfirm={handleRoleChangeConfirm}
        />
      </Dialog>

      <Dialog
        open={Boolean(deactivatingMembership)}
        onOpenChange={(open) => {
          if (!open) setDeactivatingMembership(null);
        }}
      >
        <EmrConfirmDialogContent
          title="구성원 비활성화 확인"
          description={
            <>
              {deactivatingMembership?.email ?? deactivatingMembership?.userSessionId} 구성원을
              비활성화합니다. 비활성 구성원은 이 워크스페이스의 활성 권한을 잃습니다.
            </>
          }
          cancelLabel="취소"
          confirmLabel="비활성화"
          confirmButtonVariant="destructive"
          onCancel={() => setDeactivatingMembership(null)}
          onConfirm={handleDeactivationConfirm}
        />
      </Dialog>

      <Dialog open={Boolean(archivingMembership)} onOpenChange={(open) => { if (!open) setArchivingMembership(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>구성원 삭제</DialogTitle>
            <DialogDescription>
              {archivingMembership?.displayName ?? archivingMembership?.email} 구성원의 접근을 해제하고 삭제됨 탭으로 이동합니다. 기록은 유지되며 복구하면 비활성 상태로 돌아옵니다.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(archiveError)}>
              <FieldLabel htmlFor="workspace-membership-delete-reason">삭제 사유</FieldLabel>
              <Input id="workspace-membership-delete-reason" value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="예: 퇴사 처리" aria-invalid={Boolean(archiveError)} />
              {archiveError ? <FieldError>{archiveError}</FieldError> : <FieldDescription>90일 후 영구 삭제 검토 필요로 표시되지만 자동 삭제되지는 않습니다.</FieldDescription>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setArchivingMembership(null)}>취소</Button>
            <Button type="button" variant="destructive" disabled={submittingArchive} onClick={() => void handleArchiveConfirm()}>{submittingArchive ? "삭제 중" : "구성원 삭제"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deactivationError ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-[var(--clair-radius-md)] border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-4 py-3 text-[13px] text-[var(--emr-status-danger-text)] shadow-lg">
          {deactivationError}
        </div>
      ) : null}
    </div>
  );
}

function getMembershipMutationErrorMessage(reason: string) {
  if (reason === "last_admin_protected") {
    return "최소 1명의 활성 소유자가 필요합니다.";
  }
  if (reason === "invalid_roles") {
    return "하나 이상의 역할을 선택하세요.";
  }
  return "멤버십 변경 대상을 찾을 수 없습니다.";
}

function getCustomRoleErrorMessage(reason: string) {
  if (reason === "empty_label") return "커스텀 역할 이름을 입력하세요.";
  if (reason === "empty_permissions") return "하나 이상의 권한을 선택하세요.";
  if (reason === "owner_only_permission") return "소유자 전용 권한은 커스텀 역할에 넣을 수 없습니다.";
  return "선택할 수 없는 권한이 포함되어 있습니다.";
}

function getCustomJobPositionErrorMessage(reason: string) {
  if (reason === "empty_label") return "커스텀 직무 이름을 입력하세요.";
  if (reason === "duplicate_position") return "이미 있는 직무입니다.";
  return "직무를 추가할 수 없습니다.";
}

function getDemoInvitationActorId(role: string) {
  if (role === "hospital_admin" || role === "billing_admin") return "user-admin";
  if (role === "front_desk") return "user-desk";
  if (role === "nurse") return "user-tech";
  return "user-vet";
}

function mergePersistedWorkspaceMembershipStatus(
  state: SessionWorkspacesState,
  workspaceId: string,
  persisted: {
    memberships: SessionWorkspaceMembership[];
    invitations: SessionWorkspaceInvitation[];
  },
  now = new Date().toISOString()
): SessionWorkspacesState {
  return {
    ...state,
    memberships: [
      ...state.memberships.filter((membership) => membership.workspaceId !== workspaceId),
      ...persisted.memberships,
    ],
    invitations: [
      ...state.invitations.filter((invitation) => invitation.workspaceId !== workspaceId),
      ...persisted.invitations,
    ],
    updatedAt: now,
  };
}

function postInvitationLifecycle({
  workspaceId,
  invitationId,
  action,
  actorRole,
}: {
  workspaceId: string;
  invitationId: string;
  action: "resend" | "cancel" | "accept";
  actorRole: string;
}) {
  return fetch(`/api/workspaces/${workspaceId}/invitations/${invitationId}/${action}`, {
    method: "POST",
    headers:
      actorRole === "supabase"
        ? undefined
        : { "x-clair-demo-session-user-id": getDemoInvitationActorId(actorRole) },
  });
}
