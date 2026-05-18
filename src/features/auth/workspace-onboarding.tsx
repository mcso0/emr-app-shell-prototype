"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  appendSessionWorkspace,
  createEmptySessionWorkspacesState,
  createSessionWorkspace,
  persistSessionWorkspacesState,
  readSessionWorkspacesState,
  validateWorkspaceCreationInput,
  type SessionWorkspaceSubscriptionStatus,
  type WorkspaceCreationFieldErrors,
} from "@/features/auth/workspace-session";

const defaultSubscriptionStatus: SessionWorkspaceSubscriptionStatus = "trialing";

function getBrowserWorkspaceState() {
  if (typeof window === "undefined") return null;

  return readSessionWorkspacesState(window.sessionStorage, window.localStorage);
}

function getCurrentBrowserWorkspaceName() {
  const state = getBrowserWorkspaceState();
  const currentWorkspace = state?.workspaces.find(
    (workspace) => workspace.id === state.currentWorkspaceId
  );

  return currentWorkspace?.displayName ?? null;
}

export function WorkspaceOnboarding() {
  const router = useRouter();
  const { hydrated, session, hydrate } = useAuthClient();
  const [fieldErrors, setFieldErrors] = useState<WorkspaceCreationFieldErrors>({});
  const [existingWorkspaceName] = useState<string | null>(getCurrentBrowserWorkspaceName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCreateWorkspace = useMemo(() => {
    if (!session) return false;
    if (session.role === "supabase") return true;
    return session.role === "hospital_admin";
  }, [session]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !canCreateWorkspace) return;

    const formData = new FormData(event.currentTarget);
    const input = {
      hospitalName: String(formData.get("hospitalName") ?? ""),
      adminDisplayName: String(formData.get("adminDisplayName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      subscriptionStatus: defaultSubscriptionStatus,
    };
    const validation = validateWorkspaceCreationInput(input);

    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session.role === "supabase" ? {} : { "x-clair-demo-session-user-id": session.id }),
      },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as
      | {
          ok: true;
          workspace: ReturnType<typeof createSessionWorkspace>["workspace"];
          membership: ReturnType<typeof createSessionWorkspace>["membership"];
        }
      | {
          ok: false;
          error?: "invalid_input";
          fieldErrors?: WorkspaceCreationFieldErrors;
        };

    if (!result.ok) {
      if (result.error === "invalid_input" && result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      setIsSubmitting(false);
      return;
    }

    const currentState = getBrowserWorkspaceState() ?? createEmptySessionWorkspacesState();
    const nextState = appendSessionWorkspace(currentState, {
      workspace: result.workspace,
      membership: result.membership,
    });
    persistSessionWorkspacesState(
      nextState,
      session.storageMode,
      window.sessionStorage,
      window.localStorage
    );
    window.dispatchEvent(new Event("clair.sessionWorkspaces.v1"));
    router.replace(`/w/${result.workspace.id}/home?modulePanel=open&aside=closed`);
  }

  if (!hydrated || !session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--emr-surface-muted)] px-6 text-foreground">
        <div className="rounded-[var(--clair-radius-lg)] border border-border bg-card px-6 py-5 text-center shadow-sm">
          <p className="text-[14px] font-semibold">로그인 확인 중</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            워크스페이스 생성 권한을 확인합니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] px-5 py-8 text-foreground">
      <section className="mx-auto grid min-h-[calc(100svh-64px)] w-full max-w-[1120px] items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
        <div className="flex flex-col gap-5">
          <span className="flex size-11 items-center justify-center rounded-[var(--clair-radius-md)] bg-primary text-primary-foreground">
            <BuildingIcon aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[var(--emr-status-info-text)]">
              Workspace onboarding
            </p>
            <h1 className="text-[32px] font-semibold leading-10 tracking-normal">
              워크스페이스 만들기
            </h1>
            <p className="max-w-[520px] text-[15px] leading-7 text-muted-foreground">
              구독을 시작한 병원 대표나 관리자가 병원 워크스페이스를 만들고, 최초 생성자는
              자동으로 병원관리자 권한을 받습니다.
            </p>
          </div>
          <div className="rounded-[var(--clair-radius-md)] border border-border bg-card p-4 text-[13px] leading-6 text-muted-foreground">
            {existingWorkspaceName ? (
              <p>
                현재 세션에 선택된 워크스페이스는{" "}
                <strong className="font-semibold text-foreground">{existingWorkspaceName}</strong>
                입니다. 새로 만들면 현재 워크스페이스가 새 병원으로 바뀝니다.
              </p>
            ) : (
              <p>
                아직 생성된 병원 워크스페이스가 없습니다. 아래 정보를 입력하면 현재 로그인한
                사용자를 최초 병원관리자로 등록합니다.
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--clair-radius-lg)] border border-border bg-card p-6 shadow-sm"
        >
          <FieldGroup>
            <div className="flex flex-col gap-1">
              <h2 className="text-[20px] font-semibold leading-7 tracking-normal">
                병원 기본 정보
              </h2>
              <p className="text-[13px] leading-5 text-muted-foreground">
                이 정보는 session-only prototype 상태로 저장되며, 실제 결제나 Supabase DB에는 아직
                기록하지 않습니다.
              </p>
            </div>

            {!canCreateWorkspace ? (
              <p
                role="alert"
                className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-warning-text)]"
              >
                워크스페이스 생성은 병원 관리자 역할로 로그인한 사용자만 진행할 수 있습니다.
              </p>
            ) : null}

            <Field>
              <FieldLabel htmlFor="workspace-hospital-name">병원/워크스페이스 이름</FieldLabel>
              <Input
                id="workspace-hospital-name"
                name="hospitalName"
                placeholder="Hanbit Animal Hospital"
                aria-invalid={Boolean(fieldErrors.hospitalName)}
              />
              {fieldErrors.hospitalName ? (
                <p role="alert" className="text-[12px] text-[var(--emr-status-danger-text)]">
                  {fieldErrors.hospitalName}
                </p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="workspace-admin-name">대표/관리자 이름</FieldLabel>
              <Input
                id="workspace-admin-name"
                name="adminDisplayName"
                placeholder="김승욱"
                aria-invalid={Boolean(fieldErrors.adminDisplayName)}
              />
              {fieldErrors.adminDisplayName ? (
                <p role="alert" className="text-[12px] text-[var(--emr-status-danger-text)]">
                  {fieldErrors.adminDisplayName}
                </p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="workspace-contact-email">연락 이메일</FieldLabel>
              <Input
                id="workspace-contact-email"
                type="email"
                name="contactEmail"
                placeholder="owner@hospital.com"
                aria-invalid={Boolean(fieldErrors.contactEmail)}
              />
              {fieldErrors.contactEmail ? (
                <p role="alert" className="text-[12px] text-[var(--emr-status-danger-text)]">
                  {fieldErrors.contactEmail}
                </p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="workspace-contact-phone">연락처</FieldLabel>
              <Input
                id="workspace-contact-phone"
                name="contactPhone"
                placeholder="010-1234-5678"
              />
            </Field>

            <div className="rounded-[var(--clair-radius-md)] border border-border bg-[var(--emr-surface-subpanel)] px-3 py-2 text-[12px] leading-5 text-muted-foreground">
              구독 상태는 MVP placeholder로 <strong className="font-semibold">trialing</strong>을
              저장합니다. 실제 결제 제공자 연동은 후속 범위입니다.
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!canCreateWorkspace || isSubmitting}>
              {isSubmitting ? "생성 중" : "워크스페이스 만들기"}
            </Button>
          </FieldGroup>
        </form>
      </section>
    </main>
  );
}
