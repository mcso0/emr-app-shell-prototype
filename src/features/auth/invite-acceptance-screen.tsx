"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BuildingIcon,
  CheckIcon,
  ClockIcon,
  InfoIcon,
  UserIcon,
  WarningIcon,
  WorkspaceLogoMarkIcon,
} from "@/components/icons";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MOCK_AUTH_STORAGE_KEY,
  getMockRoleLabel,
  persistMockAuthSession,
  type MockAuthRole,
  type MockAuthSession,
} from "@/features/auth/mock-session";
import {
  resolveInviteAcceptanceRecord,
  type InviteAcceptanceRecord,
} from "@/features/auth/invite-acceptance-model";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import {
  SESSION_WORKSPACES_STORAGE_KEY,
  createEmptySessionWorkspacesState,
  getSessionWorkspaceRoleLabels,
  persistSessionWorkspacesState,
  readSessionWorkspacesState,
  type SessionWorkspaceMembership,
  type SessionWorkspaceRole,
} from "@/features/auth/workspace-session";

export type InviteAcceptanceScreenProps = {
  invitationId: string;
  workspaceId: string | null;
  email: string | null;
  initialRecord?: InviteAcceptanceRecord | null;
};

type AccountMode = "new" | "existing";

export function InviteAcceptanceScreen({
  invitationId,
  workspaceId,
  email,
  initialRecord = null,
}: InviteAcceptanceScreenProps) {
  const router = useRouter();
  const [accountMode, setAccountMode] = useState<AccountMode>("new");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const record = useMemo(
    () => initialRecord ?? resolveInviteAcceptanceRecord({ invitationId, workspaceId, email }),
    [email, initialRecord, invitationId, workspaceId]
  );
  const stateCopy = getStateCopy(record);
  const usesSupabaseProvider = getAuthRuntimeMode().authProvider === "supabase";

  function buildAccountPath(mode: AccountMode) {
    const next = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams({
      reason: mode === "new" ? "invite_new_account" : "invite_existing_account",
      next,
    });

    if (record.invitation?.email) {
      params.set("inviteEmail", record.invitation.email);
    }

    return mode === "new" ? `/signup?${params.toString()}` : `/login?${params.toString()}`;
  }

  function chooseAccountMode(mode: AccountMode) {
    setAccountMode(mode);

    if (usesSupabaseProvider) {
      router.push(buildAccountPath(mode));
    }
  }

  async function acceptInvite() {
    if (!record.workspace || !record.invitation || record.status !== "pending") return;

    if (usesSupabaseProvider) {
      router.push(buildAccountPath(accountMode));
      return;
    }

    setSubmitting(true);
    setError(null);

    const actorUserId = `invitee:${record.invitation.email}`;

    try {
      const response = await fetch(
        `/api/workspaces/${record.workspace.id}/invitations/${record.invitation.id}/accept`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-clair-demo-session-user-id": actorUserId,
          },
          body: JSON.stringify({ accountMode }),
        }
      );
      const result = (await response.json()) as {
        ok?: boolean;
        membership?: SessionWorkspaceMembership;
        sessionStatus?: string;
        denialReason?: string;
      };

      if (!response.ok || !result.ok || !result.membership) {
        if (response.status === 401 || result.denialReason === "unauthenticated") {
          throw new Error("invite-login-required");
        }

        throw new Error("invite-accept-failed");
      }

      persistAcceptedInvite({
        record,
        actorUserId,
        accountMode,
        membership: {
          ...result.membership,
          email: record.invitation.email,
          displayName: record.invitation.email.split("@")[0],
          roles: record.invitation.invitedRoles,
          title: record.invitation.title,
          department: record.invitation.department,
        },
      });

      router.replace(`/w/${record.workspace.id}/reception?modulePanel=open&aside=closed`);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "invite-login-required"
          ? "초대받은 이메일 계정으로 로그인한 뒤 다시 수락해 주세요."
          : "초대 수락 상태를 확인해 주세요."
      );
      setSubmitting(false);
    }
  }

  function goToLogin() {
    const next = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams({
      reason: "invite_existing_account",
      next,
    });

    if (record.invitation?.email) {
      params.set("inviteEmail", record.invitation.email);
    }

    router.push(`/login?${params.toString()}`);
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] text-foreground">
      <section className="grid min-h-svh lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)]">
        <InviteContextPanel record={record} stateCopy={stateCopy} />

        <div className="flex min-h-[560px] items-center justify-center border-t border-border bg-[var(--emr-surface-muted)] px-4 py-8 md:px-10 lg:border-l lg:border-t-0">
          <div className="flex w-full max-w-[680px] flex-col gap-5">
            {record.status === "pending" && record.invitation ? (
              <>
                <div className="border border-border bg-card p-5 shadow-sm md:p-6">
                  <div className="flex flex-col gap-2">
                    <Badge
                      variant="outline"
                      className="h-6 w-fit rounded-[var(--clair-radius-full)] border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] px-2.5 text-[var(--emr-status-info-text)]"
                    >
                      초대 대기
                    </Badge>
                    <h2 className="text-[22px] font-semibold leading-8 tracking-normal">
                      계정 확인 후 워크스페이스에 입장
                    </h2>
                    <p className="max-w-[560px] text-[14px] leading-6 text-muted-foreground">
                      초대받은 이메일 계정으로 로그인하거나 계정 생성을 시작하면, 이
                      초대 화면으로 돌아와 멤버십을 활성화합니다.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <ModeButton
                      active={accountMode === "new"}
                      title="신규 계정으로 시작"
                      description={
                        usesSupabaseProvider
                          ? "초대 이메일로 계정을 만든 뒤 이 워크스페이스 초대로 돌아옵니다."
                          : "초대 이메일로 local-first mock 계정을 만들고 멤버십을 활성화합니다."
                      }
                      icon={<UserIcon className="size-4" />}
                      onClick={() => chooseAccountMode("new")}
                    />
                    <ModeButton
                      active={accountMode === "existing"}
                      title="기존 계정에 연결"
                      description="이미 같은 이메일로 로그인 가능한 사용자를 초대된 워크스페이스에 연결합니다."
                      icon={<CheckIcon className="size-4" />}
                      onClick={() => chooseAccountMode("existing")}
                    />
                  </div>

                  {error ? (
                    <EmrInlineAlert
                      className="mt-5"
                      severity="error"
                      title={error}
                      action={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full bg-card text-foreground sm:w-fit"
                          onClick={goToLogin}
                        >
                          로그인하고 돌아오기
                        </Button>
                      }
                    >
                      초대받은 이메일 계정으로 먼저 로그인해야 수락할 수 있습니다.
                    </EmrInlineAlert>
                  ) : (
                    <EmrInlineAlert
                      className="mt-5"
                      severity="info"
                      title="초대 이메일 확인 필요"
                    >
                      staging Supabase 초대는 초대받은 이메일로 로그인한 뒤 수락됩니다.
                    </EmrInlineAlert>
                  )}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      size="lg"
                      className="w-full sm:w-fit"
                      disabled={submitting}
                      onClick={acceptInvite}
                    >
                      {submitting
                        ? "초대 수락 중"
                        : usesSupabaseProvider
                          ? "선택한 방식으로 계속하기"
                          : "초대 수락하고 워크스페이스 열기"}
                    </Button>
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      선택한 경로와 초대 이메일은 다음 화면에 유지됩니다.
                    </p>
                  </div>
                </div>

                <StatusPanel stateCopy={stateCopy} />
              </>
            ) : (
              <div className="border border-border bg-card p-6 shadow-sm">
                <EmrInlineAlert
                  severity={record.status === "accepted" ? "success" : "warning"}
                  title={stateCopy.title}
                >
                  병원 관리자에게 새 초대를 요청하거나, 이미 계정이 있다면 로그인
                  화면에서 워크스페이스 접근 상태를 확인하세요.
                </EmrInlineAlert>
                <div className="mt-5">
                  <StatusPanel stateCopy={stateCopy} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function InviteContextPanel({
  record,
  stateCopy,
}: {
  record: InviteAcceptanceRecord;
  stateCopy: ReturnType<typeof getStateCopy>;
}) {
  const roleLabel = record.invitation
    ? getSessionWorkspaceRoleLabels(record.invitation.invitedRoles)
    : "-";

  return (
    <div className="flex min-h-[520px] flex-col bg-card px-6 py-6 md:px-10 md:py-8">
      <div className="flex items-center gap-2 text-[13px] font-semibold leading-5">
        <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] bg-primary text-primary-foreground">
          <WorkspaceLogoMarkIcon aria-hidden="true" />
        </span>
        CLAiR EMR
      </div>

      <div className="flex flex-1 items-center py-12">
        <div className="w-full max-w-[520px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <span className="flex size-8 items-center justify-center rounded-[var(--clair-radius-full)] border border-border bg-[var(--emr-surface-subpanel)] text-[var(--emr-text-secondary)]">
              <InfoIcon className="size-4" aria-hidden="true" />
            </span>
            이메일 초대
          </div>
          <h1 className="mt-4 text-[32px] font-semibold leading-10 tracking-normal">
            {stateCopy.title}
          </h1>
          <p className="mt-3 max-w-[480px] text-[14px] leading-6 text-muted-foreground">
            {stateCopy.description}
          </p>

          <div className="mt-8 border border-border bg-[var(--emr-surface-subpanel)] p-4">
            <dl className="grid gap-4 text-[13px]">
              <DetailRow
                icon={<UserIcon className="size-4" />}
                label="초대 이메일"
                value={record.invitation?.email ?? "확인 불가"}
              />
              <DetailRow icon={<CheckIcon className="size-4" />} label="초대 역할" value={roleLabel} />
              <DetailRow
                icon={<BuildingIcon className="size-4" />}
                label="워크스페이스"
                value={record.workspace?.displayName ?? "-"}
              />
              <DetailRow
                icon={<ClockIcon className="size-4" />}
                label="만료 예정"
                value={record.invitation ? formatDate(record.invitation.expiresAt) : "-"}
              />
            </dl>
          </div>

          <ol className="mt-6 grid gap-2 text-[12px] leading-5 text-muted-foreground sm:grid-cols-3">
            <StepItem index="1" label="초대 확인" active />
            <StepItem index="2" label="계정 확인" active={record.status === "pending"} />
            <StepItem index="3" label="워크스페이스 입장" />
          </ol>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  title,
  description,
  onClick,
  icon,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "group flex min-h-[132px] flex-col justify-between border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
          : "border-border bg-background hover:bg-accent",
      ].join(" ")}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="block text-[14px] font-semibold leading-5">{title}</span>
        <span
          className={[
            "flex size-7 shrink-0 items-center justify-center rounded-[var(--clair-radius-full)] border",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground group-hover:text-foreground",
          ].join(" ")}
          aria-hidden="true"
        >
          {icon}
        </span>
      </span>
      <span className="mt-4 block text-[12px] leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] border border-border bg-card text-[var(--emr-text-secondary)]">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[12px] text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 truncate font-medium">{value}</dd>
      </div>
    </div>
  );
}

function StepItem({ index, label, active = false }: { index: string; label: string; active?: boolean }) {
  return (
    <li
      className={[
        "flex items-center gap-2 border border-border bg-[var(--emr-surface-subpanel)] px-3 py-2",
        active ? "text-[var(--emr-text-secondary)]" : "text-muted-foreground",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-5 shrink-0 items-center justify-center rounded-[var(--clair-radius-full)] text-[11px] font-semibold",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-[var(--emr-surface-disabled)] text-muted-foreground",
        ].join(" ")}
      >
        {index}
      </span>
      <span className="truncate">{label}</span>
    </li>
  );
}

function StatusPanel({ stateCopy }: { stateCopy: ReturnType<typeof getStateCopy> }) {
  return (
    <aside className="border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]">
          <WarningIcon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-[15px] font-semibold">수락 상태</h2>
      </div>
      <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-3 lg:grid-cols-1">
        <Detail label="상태" value={stateCopy.statusLabel} />
        <Detail label="계정 처리" value={stateCopy.accountPolicy} />
        <Detail label="이메일 발송" value="not_sent_approval_gated" />
      </dl>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function getStateCopy(record: InviteAcceptanceRecord) {
  if (record.status === "pending") {
    return {
      title: "초대 수락",
      description:
        "초대된 이메일을 확인하고 계정 처리 방식을 선택하면 병원 워크스페이스 멤버십이 활성화됩니다.",
      statusLabel: "pending",
      accountPolicy: "new_or_existing_account_link",
    };
  }

  if (record.status === "expired") {
    return {
      title: "초대가 만료되었습니다",
      description: "만료된 초대는 계정이나 멤버십을 만들 수 없습니다.",
      statusLabel: "expired",
      accountPolicy: "blocked",
    };
  }

  if (record.status === "canceled") {
    return {
      title: "취소된 초대입니다",
      description: "병원 관리자가 취소한 초대는 수락할 수 없습니다.",
      statusLabel: "canceled",
      accountPolicy: "blocked",
    };
  }

  if (record.status === "accepted") {
    return {
      title: "이미 수락된 초대입니다",
      description: "이미 처리된 초대는 다시 멤버십을 만들지 않습니다.",
      statusLabel: "accepted",
      accountPolicy: "blocked",
    };
  }

  return {
    title: "초대 링크를 확인할 수 없습니다",
    description: "워크스페이스 또는 초대 식별자가 올바르지 않습니다.",
    statusLabel: "missing",
    accountPolicy: "blocked",
  };
}

function persistAcceptedInvite({
  record,
  actorUserId,
  accountMode,
  membership,
}: {
  record: InviteAcceptanceRecord;
  actorUserId: string;
  accountMode: AccountMode;
  membership: SessionWorkspaceMembership;
}) {
  if (!record.workspace || !record.invitation) return;

  const now = new Date().toISOString();
  const role = toMockRole(record.invitation.invitedRoles[0]);
  const authSession: MockAuthSession = {
    id: actorUserId,
    role,
    roleLabel: getMockRoleLabel(role),
    storageMode: "local",
    issuedAt: now,
  };
  const current =
    readSessionWorkspacesState(window.sessionStorage, window.localStorage) ??
    createEmptySessionWorkspacesState(now);
  const acceptedInvitation = {
    ...record.invitation,
    status: "accepted" as const,
    acceptedBySessionId: actorUserId,
    acceptedAt: now,
    updatedAt: now,
  };
  const nextState = {
    currentWorkspaceId: record.workspace.id,
    workspaces: [
      ...current.workspaces.filter((workspace) => workspace.id !== record.workspace?.id),
      record.workspace,
    ],
    memberships: [
      ...current.memberships.filter(
        (item) =>
          !(item.workspaceId === membership.workspaceId && item.userSessionId === actorUserId)
      ),
      membership,
    ],
    invitations: [
      ...current.invitations.filter((item) => item.id !== record.invitation?.id),
      acceptedInvitation,
    ],
    updatedAt: now,
  };

  persistMockAuthSession(authSession, window.sessionStorage, window.localStorage);
  persistSessionWorkspacesState(nextState, "local", window.sessionStorage, window.localStorage);
  window.localStorage.setItem(
    "clair.inviteAcceptance.v1",
    JSON.stringify({
      invitationId: record.invitation.id,
      workspaceId: record.workspace.id,
      accountMode,
      acceptedAt: now,
    })
  );
  window.dispatchEvent(new Event(MOCK_AUTH_STORAGE_KEY));
  window.dispatchEvent(new Event(SESSION_WORKSPACES_STORAGE_KEY));
}

function toMockRole(role: SessionWorkspaceRole): MockAuthRole {
  if (role === "technician") return "nurse";
  return role;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
