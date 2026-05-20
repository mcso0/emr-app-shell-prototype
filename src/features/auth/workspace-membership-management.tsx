"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  SESSION_WORKSPACE_ROLES,
  acceptSessionWorkspaceInvitation,
  appendSessionWorkspaceInvitation,
  cancelSessionWorkspaceInvitation,
  createEmptySessionWorkspacesState,
  createSessionWorkspaceInvitation,
  getSessionWorkspaceRoleLabels,
  persistSessionWorkspacesState,
  readSessionWorkspacesState,
  resendSessionWorkspaceInvitation,
  validateWorkspaceInvitationInput,
  type SessionWorkspaceInvitation,
  type SessionWorkspaceMembership,
  type SessionWorkspaceRole,
  type SessionWorkspacesState,
  type WorkspaceInvitationFieldErrors,
  deactivateSessionWorkspaceMembership,
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
  if (row.rowType === "invitation") return row.status;
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

function getEffectivePermissionSummary(roles: SessionWorkspaceRole[]) {
  if (roles.includes("hospital_admin")) {
    return "전체 관리자 권한";
  }

  const summaries = [];

  if (roles.includes("vet")) summaries.push("진료/차트 수정 가능");
  if (roles.includes("front_desk")) summaries.push("접수/수납 처리 가능");
  if (roles.includes("technician")) summaries.push("검사/처치 완료 가능");

  if (roles.length > 1) summaries.unshift("역할 합산 권한");

  return summaries.join(" · ") || "권한 없음";
}

export function WorkspaceMembershipManagement({
  workspaceId,
}: WorkspaceMembershipManagementProps) {
  const { hydrated, hydrate, session } = useAuthClient();
  const [state, setState] = useState<SessionWorkspacesState>(getBrowserWorkspaceState);
  const [fieldErrors, setFieldErrors] = useState<WorkspaceInvitationFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusReadState, setStatusReadState] =
    useState<"idle" | "loading" | "error">("idle");
  const [submittingInvitation, setSubmittingInvitation] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<SessionWorkspaceRole[]>([]);
  const [editingMembership, setEditingMembership] = useState<SessionWorkspaceMembership | null>(
    null
  );
  const [editingRoles, setEditingRoles] = useState<SessionWorkspaceRole[]>([]);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);
  const [submittingRoleChange, setSubmittingRoleChange] = useState(false);
  const [confirmRoleChangeOpen, setConfirmRoleChangeOpen] = useState(false);
  const [deactivatingMembership, setDeactivatingMembership] =
    useState<SessionWorkspaceMembership | null>(null);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);
const canManageMembers = session?.role === "hospital_admin" || session?.role === "supabase";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session) return;

    let canceled = false;

    async function loadPersistedMembershipStatus() {
      setStatusReadState("loading");

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/memberships`, {
          headers:
            session?.role === "supabase"
              ? undefined
              : { "x-clair-demo-session-user-id": getDemoInvitationActorId(session?.role ?? "") },
        });
        const result = await response.json() as WorkspaceMembershipStatusRouteResponse;

        if (canceled) return;

        if (!response.ok || !result.ok) {
          setStatusReadState("error");
          return;
        }

        if (result.memberships.length > 0 || result.invitations.length > 0) {
          updateState(
            mergePersistedWorkspaceMembershipStatus(state, workspaceId, {
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
  }, [hydrated, session?.id, session?.role, workspaceId]);

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

  function updateState(nextState: SessionWorkspacesState) {
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
  }

  function handleRoleToggle(role: SessionWorkspaceRole, checked: boolean) {
    setSelectedRoles((current) =>
      checked
        ? Array.from(new Set([...current, role]))
        : current.filter((item) => item !== role)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canManageMembers) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = {
      email: String(formData.get("email") ?? ""),
      roles: selectedRoles,
      title: String(formData.get("title") ?? ""),
      department: String(formData.get("department") ?? ""),
    };
    const validation = validateWorkspaceInvitationInput(input, state, workspaceId);

    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
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
      setSelectedRoles([]);
      form.reset();
    } catch {
      const invitation = createSessionWorkspaceInvitation(input, workspaceId, {
        sessionId: session.id,
        storageMode: session.storageMode,
      });
      updateState(appendSessionWorkspaceInvitation(state, invitation));
      setFieldErrors({});
      setSelectedRoles([]);
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
    } catch {
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
    } catch {
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
    } catch {
      // Mock fallback state still supports local demo operation.
    }

    updateState(acceptSessionWorkspaceInvitation(state, invitationId));
  }

  function openRoleEditor(membership: SessionWorkspaceMembership) {
    setEditingMembership(membership);
    setEditingRoles(membership.roles);
    setRoleChangeError(null);
    setConfirmRoleChangeOpen(false);
  }

  function handleEditingRoleToggle(role: SessionWorkspaceRole, checked: boolean) {
    setEditingRoles((current) =>
      checked
        ? Array.from(new Set([...current, role]))
        : current.filter((item) => item !== role)
    );
    setRoleChangeError(null);
  }

  function handleRoleChangeReview() {
    if (!editingMembership) return;

    const result = updateSessionWorkspaceMembershipRoles(
      state,
      editingMembership.id,
      editingRoles
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
          body: JSON.stringify({ roles: editingRoles }),
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

    const result = updateSessionWorkspaceMembershipRoles(
      state,
      editingMembership.id,
      editingRoles
    );

    if (!result.success) {
      setRoleChangeError(getMembershipMutationErrorMessage(result.reason));
      setConfirmRoleChangeOpen(false);
      return;
    }

    updateState(result.state);
    setEditingMembership(null);
    setEditingRoles([]);
    setRoleChangeError(null);
    setConfirmRoleChangeOpen(false);
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
          ? "마지막 병원관리자는 비활성화할 수 없습니다."
          : getMembershipMutationErrorMessage(result.reason)
      );
      setDeactivatingMembership(null);
      return;
    }

    updateState(result.state);
    setDeactivatingMembership(null);
    setDeactivationError(null);
  }

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] text-[13px] text-muted-foreground">
        구성원 정보를 불러옵니다.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]">
      <section className="border-b bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-7">구성원 및 초대</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
              병원관리자가 직원을 이메일로 초대하고, 역할과 멤버십 상태를 session-only로
              확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Badge variant="secondary">활성 {activeMembers.length}명</Badge>
            <Badge variant="outline">대기 {pendingInvitations.length}건</Badge>
            <Badge variant="outline">비활성 {inactiveMembers.length}명</Badge>
          </div>
        </div>
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
        <form className="border-b bg-card p-4 lg:border-b-0 lg:border-r" onSubmit={handleSubmit}>
          <FieldGroup>
            <div>
              <h2 className="text-[15px] font-semibold">직원 초대</h2>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                실제 이메일 발송 없이 초대 상태만 저장합니다.
              </p>
            </div>

            {!canManageMembers ? (
              <p
                role="alert"
                className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-warning-text)]"
              >
                병원관리자만 직원을 초대하거나 멤버십을 변경할 수 있습니다.
              </p>
            ) : null}

            {statusReadState === "loading" ? (
              <p className="text-[12px] text-muted-foreground">서버 상태를 불러오는 중입니다.</p>
            ) : statusReadState === "error" ? (
              <p role="alert" className="text-[12px] text-[var(--emr-status-warning-text)]">
                서버 상태를 읽지 못해 브라우저 임시 상태를 표시합니다.
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
                placeholder="staff@hospital.com"
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
              <FieldLegend className="mb-0 text-[13px]">역할</FieldLegend>
              <FieldDescription className="text-[12px]">
                여러 역할을 선택하면 권한은 합산됩니다.
              </FieldDescription>
              <div className="grid gap-2">
                {SESSION_WORKSPACE_ROLES.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 text-[13px] text-[var(--emr-text-primary)]"
                  >
                    <Checkbox
                      aria-label={role.label}
                      checked={selectedRoles.includes(role.id)}
                      disabled={!canManageMembers || submittingInvitation}
                      onCheckedChange={(checked) => handleRoleToggle(role.id, Boolean(checked))}
                    />
                    {role.label}
                  </label>
                ))}
              </div>
              {fieldErrors.roles ? (
                <FieldError className="text-[12px] text-[var(--emr-status-danger-text)]">
                  {fieldErrors.roles}
                </FieldError>
              ) : null}
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="workspace-invitation-title">직책</FieldLabel>
              <Input
                id="workspace-invitation-title"
                name="title"
                placeholder="진료팀장"
                disabled={!canManageMembers || submittingInvitation}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="workspace-invitation-department">부서</FieldLabel>
              <Input
                id="workspace-invitation-department"
                name="department"
                placeholder="진료팀"
                disabled={!canManageMembers || submittingInvitation}
              />
            </Field>

            <Button type="submit" disabled={!canManageMembers || submittingInvitation}>
              {submittingInvitation ? "초대 저장 중" : "초대 만들기"}
            </Button>
          </FieldGroup>
        </form>

        <ScrollArea className="min-h-0 bg-[var(--emr-surface-workspace)]">
          <div className="p-4">
            <Table className="min-w-[820px] table-fixed text-[13px]">
              <TableHeader className="bg-[var(--emr-surface-muted)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[220px]">이메일</TableHead>
                  <TableHead className="w-[180px]">역할</TableHead>
                  <TableHead className="w-[110px]">상태</TableHead>
                  <TableHead className="w-[230px]">권한 요약</TableHead>
                  <TableHead className="w-[160px]">직책/부서</TableHead>
                  <TableHead className="w-[220px] text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaceRows.map((row) => {
                  const pending = row.rowType === "invitation" && row.status === "pending";

                  return (
                    <TableRow key={`${row.rowType}-${row.id}`} className="bg-card">
                      <TableCell className="font-semibold">{getRowEmail(row)}</TableCell>
                      <TableCell>{getSessionWorkspaceRoleLabels(getRowRoles(row))}</TableCell>
                      <TableCell>
                        <Badge variant={pending ? "secondary" : "outline"}>
                          {getStatusLabel(row)}
                        </Badge>
                        {row.rowType === "invitation" && row.resendCount > 0 ? (
                          <span className="ml-2 text-[12px] text-muted-foreground">
                            재발송 {row.resendCount}회
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getEffectivePermissionSummary(getRowRoles(row))}
                      </TableCell>
                      <TableCell className="truncate">
                        {[row.title, row.department].filter(Boolean).join(" · ") || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {pending ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={!canManageMembers}
                              onClick={() => handleResend(row.id)}
                            >
                              초대 재발송
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={!canManageMembers}
                              onClick={() => handleAccept(row.id)}
                            >
                              수락 시뮬레이션
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              disabled={!canManageMembers}
                              onClick={() => handleCancel(row.id)}
                            >
                              초대 취소
                            </Button>
                          </div>
                        ) : row.rowType === "member" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={!canManageMembers || row.status !== "active"}
                              onClick={() => openRoleEditor(row)}
                            >
                              역할 수정
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              disabled={!canManageMembers || row.status !== "active"}
                              onClick={() => {
                                setDeactivationError(null);
                                setDeactivatingMembership(row);
                              }}
                            >
                              비활성화
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">초대 기록</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {workspaceRows.length === 0 ? (
                  <TableRow className="bg-card">
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      아직 이 워크스페이스에 표시할 구성원이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </section>

      <Dialog
        open={Boolean(editingMembership)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMembership(null);
            setEditingRoles([]);
            setRoleChangeError(null);
            setConfirmRoleChangeOpen(false);
          }
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-[500px]">
          <DialogHeader className="px-6 pb-3 pt-6">
            <DialogTitle>구성원 역할 수정</DialogTitle>
            <DialogDescription>
              {editingMembership?.email ?? editingMembership?.userSessionId}의 역할을 조정합니다.
              실제 DB 저장 전까지는 이 브라우저 세션에만 반영됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-6 pb-5">
            <div className="grid gap-2">
              {SESSION_WORKSPACE_ROLES.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 text-[13px] text-[var(--emr-text-primary)]"
                >
                  <Checkbox
                    aria-label={role.label}
                    checked={editingRoles.includes(role.id)}
                    onCheckedChange={(checked) =>
                      handleEditingRoleToggle(role.id, Boolean(checked))
                    }
                  />
                  {role.label}
                </label>
              ))}
            </div>
            <div className="rounded-[var(--clair-radius-md)] border bg-[var(--emr-surface-muted)] px-3 py-2 text-[13px] leading-5 text-muted-foreground">
              {getEffectivePermissionSummary(editingRoles)}
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
                setEditingRoles([]);
              }}
            >
              역할 수정 닫기
            </Button>
            <Button type="button" onClick={handleRoleChangeReview}>
              변경 검토
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRoleChangeOpen} onOpenChange={setConfirmRoleChangeOpen}>
        <EmrConfirmDialogContent
          title="역할 변경 확인"
          description={
            <>
              선택한 역할은 즉시 session-only 멤버십에 반영됩니다. 변경 후 권한은{" "}
              <strong>{getEffectivePermissionSummary(editingRoles)}</strong>입니다.
            </>
          }
          cancelLabel="취소"
          confirmLabel={submittingRoleChange ? "서버 확인 중" : "역할 변경"}
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
    return "최소 1명의 활성 병원관리자가 필요합니다.";
  }
  if (reason === "invalid_roles") {
    return "하나 이상의 역할을 선택하세요.";
  }
  return "멤버십 변경 대상을 찾을 수 없습니다.";
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
