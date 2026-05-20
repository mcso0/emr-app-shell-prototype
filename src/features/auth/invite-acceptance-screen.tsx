"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
};

type AccountMode = "new" | "existing";

export function InviteAcceptanceScreen({
  invitationId,
  workspaceId,
  email,
}: InviteAcceptanceScreenProps) {
  const router = useRouter();
  const [accountMode, setAccountMode] = useState<AccountMode>("new");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const record = useMemo(
    () => resolveInviteAcceptanceRecord({ invitationId, workspaceId, email }),
    [email, invitationId, workspaceId]
  );
  const stateCopy = getStateCopy(record);

  async function acceptInvite() {
    if (!record.workspace || !record.invitation || record.status !== "pending") return;

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
      };

      if (!response.ok || !result.ok || !result.membership) {
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
    } catch {
      setError("초대 수락 상태를 확인해 주세요.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] px-4 py-10 text-foreground">
      <section className="mx-auto grid w-full max-w-[960px] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border border-border bg-card p-6 shadow-sm md:p-8">
          <p className="text-[13px] font-semibold text-muted-foreground">CLAiR EMR</p>
          <h1 className="mt-3 text-[28px] font-semibold leading-9 tracking-normal">
            {stateCopy.title}
          </h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-muted-foreground">
            {stateCopy.description}
          </p>

          {record.status === "pending" && record.invitation ? (
            <div className="mt-8 flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeButton
                  active={accountMode === "new"}
                  title="신규 계정으로 시작"
                  description="초대 이메일로 local-first mock 계정을 만들고 멤버십을 활성화합니다."
                  onClick={() => setAccountMode("new")}
                />
                <ModeButton
                  active={accountMode === "existing"}
                  title="기존 계정에 연결"
                  description="이미 같은 이메일로 로그인 가능한 사용자를 초대된 워크스페이스에 연결합니다."
                  onClick={() => setAccountMode("existing")}
                />
              </div>

              <div className="border border-border bg-background p-4">
                <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                  <Detail label="초대 이메일" value={record.invitation.email} />
                  <Detail
                    label="초대 역할"
                    value={getSessionWorkspaceRoleLabels(record.invitation.invitedRoles)}
                  />
                  <Detail label="워크스페이스" value={record.workspace?.displayName ?? "-"} />
                  <Detail label="만료 예정" value={formatDate(record.invitation.expiresAt)} />
                </dl>
              </div>

              {error ? (
                <p className="border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-3 py-2 text-[13px] text-[var(--emr-status-danger-text)]">
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full sm:w-fit"
                disabled={submitting}
                onClick={acceptInvite}
              >
                {submitting ? "초대 수락 중" : "초대 수락하고 워크스페이스 열기"}
              </Button>
            </div>
          ) : (
            <div className="mt-8 border border-border bg-background p-4 text-[13px] leading-6 text-muted-foreground">
              병원 관리자에게 새 초대를 요청하거나, 이미 계정이 있다면 로그인 화면에서
              워크스페이스 접근 상태를 확인하세요.
            </div>
          )}
        </div>

        <aside className="border border-border bg-card p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold">수락 상태</h2>
          <dl className="mt-4 flex flex-col gap-3 text-[13px]">
            <Detail label="상태" value={stateCopy.statusLabel} />
            <Detail label="계정 처리" value={stateCopy.accountPolicy} />
            <Detail label="이메일 발송" value="not_sent_approval_gated" />
          </dl>
        </aside>
      </section>
    </main>
  );
}

function ModeButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "border p-4 text-left transition-colors",
        active
          ? "border-primary bg-[var(--emr-state-selected)]"
          : "border-border bg-background hover:bg-accent",
      ].join(" ")}
    >
      <span className="block text-[14px] font-semibold">{title}</span>
      <span className="mt-1 block text-[12px] leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
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
