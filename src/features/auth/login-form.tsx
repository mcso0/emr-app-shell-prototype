"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CheckIcon, WorkspaceLogoMarkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
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
import {
  MOCK_AUTH_ROLES,
  type MockAuthRole,
  type MockSessionStorageMode,
} from "@/features/auth/mock-session";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  createInviteOtpRedirectTo,
  getSafeInviteNextHref,
} from "@/features/auth/invite-otp-handoff";
import { cn } from "@/lib/utils";

const storageOptions: Array<{
  id: MockSessionStorageMode;
  label: string;
  description: string;
}> = [
  {
    id: "session",
    label: "이번 탭만",
    description: "현재 브라우저 탭에서만 로그인 상태를 유지합니다.",
  },
  {
    id: "local",
    label: "브라우저에 유지",
    description: "새로고침 뒤에도 역할 선택을 유지합니다.",
  },
];

const defaultWorkspaceHref = "/w/clair-demo/reception?modulePanel=open&aside=closed";
const loginPanelClassName =
  "flex min-h-[520px] flex-col bg-card px-6 py-6 md:px-10 md:py-8";
const loginFormClassName = "flex w-full max-w-[380px] flex-col gap-6";
const loginControlsClassName = "flex w-full max-w-[456px] flex-col gap-6";

function getSafeNextHref(value: string | null) {
  if (!value) return defaultWorkspaceHref;
  if (!value.startsWith("/")) return defaultWorkspaceHref;
  if (value.startsWith("//")) return defaultWorkspaceHref;
  if (value.startsWith("/login")) return defaultWorkspaceHref;

  return value;
}

function getAuthSessionNotice(reason: string | null) {
  if (reason === "session_required") {
    return {
      title: "로그인이 필요하거나 세션이 만료되었습니다.",
      description: "계정 확인 후 요청한 워크스페이스로 다시 이동합니다.",
      tone: "warning",
    } as const;
  }

  if (reason === "invite_existing_account") {
    return {
      title: "초대받은 이메일로 로그인하세요.",
      description: "로그인 후 초대 화면으로 돌아가 워크스페이스 멤버십을 활성화합니다.",
      tone: "warning",
    } as const;
  }

  if (reason === "invite_email_otp") {
    return {
      title: "초대받은 이메일로 계속하세요.",
      description: "계정 확인 후 초대 화면으로 돌아가 워크스페이스 멤버십을 활성화합니다.",
      tone: "warning",
    } as const;
  }

  if (reason === "signed_out") {
    return {
      title: "안전하게 로그아웃되었습니다.",
      description: "다시 접속하려면 계정 정보로 로그인하세요.",
      tone: "success",
    } as const;
  }

  if (reason === "unauthorized") {
    return {
      title: "이 워크스페이스에 접근할 권한이 없습니다.",
      description: "다른 계정으로 로그인하거나 병원 관리자에게 초대를 요청하세요.",
      tone: "danger",
    } as const;
  }

  return null;
}

function isInviteLoginReason(reason: string | null) {
  return reason === "invite_existing_account" || reason === "invite_email_otp";
}

function isInviteOtpReason(reason: string | null) {
  return reason === "invite_email_otp";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<MockAuthRole>("front_desk");
  const [storageMode, setStorageMode] = useState<MockSessionStorageMode>("session");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [inviteOtpSent, setInviteOtpSent] = useState(false);
  const [inviteOtpStatus, setInviteOtpStatus] = useState<string | null>(null);
  const [inviteOtpToken, setInviteOtpToken] = useState("");
  const {
    authProvider,
    hydrated,
    session,
    hydrate,
    signInWithMockRole,
    signInWithPassword,
    signInWithEmailOtp,
    verifyEmailOtp,
    signOut,
    supabaseConfigured,
  } = useAuthClient();
  const usesSupabaseProvider = authProvider === "supabase";
  const reason = searchParams.get("reason");
  const authSessionNotice = getAuthSessionNotice(reason);
  const inviteEmail = searchParams.get("inviteEmail");
  const isInviteLogin = isInviteLoginReason(reason);
  const isInviteOtpLogin = isInviteOtpReason(reason);
  const safeInviteNext = getSafeInviteNextHref(searchParams.get("next"));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const token = String(formData.get("otp-token") ?? "").trim();

    setIsSubmitting(true);
    setLoginError(null);
    setInviteOtpStatus(null);

    try {
      if (isInviteOtpLogin) {
        if (!email || !safeInviteNext) {
          throw new Error("invite-otp-invalid-context");
        }

        if (token) {
          if (usesSupabaseProvider) {
            if (!supabaseConfigured) {
              throw new Error("supabase-not-configured");
            }

            await verifyEmailOtp({ email, token });
          } else if (token !== "000000") {
            throw new Error("invite-otp-token-invalid");
          }

          router.replace(safeInviteNext);
          return;
        }

        if (!inviteOtpSent) {
          const response = await fetch("/api/auth/invite-otp/request", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              email,
              next: safeInviteNext,
            }),
          });

          if (!response.ok) {
            throw new Error("invite-otp-request-failed");
          }

          if (usesSupabaseProvider) {
            if (!supabaseConfigured) {
              throw new Error("supabase-not-configured");
            }

            await signInWithEmailOtp({
              email,
              redirectTo: createInviteOtpRedirectTo({
                origin: window.location.origin,
                next: safeInviteNext,
              }),
            });
          }

          setInviteOtpSent(true);
          setInviteOtpStatus("인증 코드를 보냈습니다.");
          setIsSubmitting(false);
          return;
        }

        throw new Error("invite-otp-token-required");
      }

      if (usesSupabaseProvider) {
        if (!supabaseConfigured) {
          throw new Error("supabase-not-configured");
        }

        if (!email || !password) {
          throw new Error("supabase-missing-credentials");
        }

        await signInWithPassword({ email, password });
      } else {
        await signInWithMockRole(selectedRole, storageMode, {
          forceProviderError: searchParams.get("mockProviderError") === "1",
        });
      }

      router.replace(getSafeNextHref(searchParams.get("next")));
    } catch {
      setLoginError(
        isInviteOtpLogin
          ? "초대 이메일 인증을 진행할 수 없습니다. 초대 링크와 인증 코드를 확인하세요."
          : usesSupabaseProvider
          ? "Supabase 로그인 처리 중 문제가 발생했습니다. 계정 정보와 환경 설정을 확인하세요."
          : "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하세요."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] text-foreground">
      <section className="grid min-h-svh lg:grid-cols-2">
        <div className={loginPanelClassName}>
          <div className="flex items-center gap-2 text-[13px] font-semibold leading-5">
            <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] bg-primary text-primary-foreground">
              <WorkspaceLogoMarkIcon aria-hidden="true" />
            </span>
            CLAiR EMR
          </div>

          <div className="flex flex-1 items-center justify-center py-12">
            <form
              onSubmit={handleSubmit}
              className={loginFormClassName}
            >
              <FieldGroup>
                <div className="flex flex-col gap-2">
                  <h1 className="text-[28px] font-semibold leading-9 tracking-normal">
                    {isInviteOtpLogin ? "초대 이메일 인증" : "CLAiR EMR에 로그인"}
                  </h1>
                  <p className="text-[14px] leading-6 text-muted-foreground">
                    {isInviteOtpLogin
                      ? "초대받은 이메일로 인증 코드를 받아 계정 확인을 이어갑니다."
                      : isInviteLogin
                      ? "초대받은 워크스페이스에 연결하려면 초대 이메일 계정으로 로그인하세요."
                      : "병원 워크스페이스에 접속하려면 계정 정보를 입력하세요."}
                  </p>
                </div>

                {authSessionNotice ? (
                  <div
                    role="status"
                    data-testid="auth-session-notice"
                    className={cn(
                      "rounded-[var(--clair-radius-md)] border px-3 py-2 text-[13px] leading-5",
                      authSessionNotice.tone === "success"
                        ? "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]"
                        : authSessionNotice.tone === "danger"
                          ? "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]"
                          : "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]"
                    )}
                  >
                    <p className="font-semibold">{authSessionNotice.title}</p>
                    <p className="mt-0.5 text-[12px] opacity-90">
                      {authSessionNotice.description}
                    </p>
                  </div>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="mock-email">이메일</FieldLabel>
                  <Input
                    id="mock-email"
                    type="email"
                    name="email"
                    placeholder="name@hospital.com"
                    defaultValue={inviteEmail ?? undefined}
                    autoComplete="email"
                    disabled={isSubmitting}
                    readOnly={isInviteOtpLogin}
                    aria-describedby="mock-email-description"
                  />
                  <FieldDescription id="mock-email-description" className="text-[12px]">
                    {isInviteOtpLogin && inviteEmail
                      ? `${inviteEmail} 주소로 인증 코드를 보냅니다.`
                      : isInviteLogin && inviteEmail
                      ? `${inviteEmail} 계정으로 로그인해야 이 초대를 수락할 수 있습니다.`
                      : "Mock 모드에서는 역할 선택으로 로그인하고, Supabase 모드에서는 계정 정보를 확인합니다."}
                  </FieldDescription>
                </Field>

                {isInviteOtpLogin ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="otp-token">인증 코드</FieldLabel>
                      <Input
                        id="otp-token"
                        name="otp-token"
                        inputMode="numeric"
                        placeholder="인증 코드"
                        autoComplete="one-time-code"
                        disabled={isSubmitting}
                        value={inviteOtpToken}
                        onChange={(event) => {
                          setInviteOtpToken(event.target.value);
                          if (loginError) setLoginError(null);
                        }}
                      />
                      <FieldDescription className="text-[12px]">
                        {usesSupabaseProvider
                          ? "이미 받은 코드가 있다면 바로 입력해 초대 화면으로 돌아갈 수 있습니다."
                          : "데모 인증 코드: 000000"}
                      </FieldDescription>
                    </Field>
                    {inviteOtpStatus ? (
                      <div className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-success-text)]">
                        {inviteOtpStatus}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <Field>
                    <FieldLabel htmlFor="mock-password">비밀번호</FieldLabel>
                    <Input
                      id="mock-password"
                      type="password"
                      name="password"
                      placeholder="비밀번호"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                    />
                  </Field>
                )}

                {loginError ? (
                  <FieldError className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-danger-text)]">
                    {loginError}
                  </FieldError>
                ) : null}

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isInviteOtpLogin
                    ? isSubmitting
                      ? "처리 중"
                      : inviteOtpToken.trim()
                        ? "인증하고 초대 화면으로 돌아가기"
                        : "인증 코드 받기"
                    : isSubmitting
                      ? "로그인 중"
                      : "로그인"}
                </Button>
              </FieldGroup>
            </form>
          </div>
        </div>

        <aside className="flex min-h-[520px] items-center justify-center border-t border-border bg-[var(--emr-surface-muted)] px-5 py-8 md:px-10 lg:border-l lg:border-t-0">
          <div className={loginControlsClassName}>
            {usesSupabaseProvider || isInviteLogin ? (
              <InviteLoginContext inviteEmail={inviteEmail} />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--emr-status-info-text)]">
                    Development controls
                  </p>
                  <h2 className="text-[24px] font-semibold leading-8 tracking-normal">
                    MVP 테스트 옵션
                  </h2>
                  <p className="text-[14px] leading-6 text-muted-foreground">
                    현재는 Supabase Auth 연결 전 mock session으로 진입합니다.
                  </p>
                </div>

                <FieldSet className="gap-3">
                  <FieldLegend className="mb-0 text-[13px]">역할 선택</FieldLegend>
                  <div className="grid gap-2">
                    {MOCK_AUTH_ROLES.map((role) => {
                      const selected = selectedRole === role.id;

                      return (
                        <button
                          key={role.id}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${role.label} 역할 선택`}
                          disabled={isSubmitting}
                          onClick={() => setSelectedRole(role.id)}
                          className={cn(
                            "flex min-h-[68px] items-start gap-3 rounded-[var(--clair-radius-md)] border bg-card p-3 text-left transition-colors",
                            "disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            selected
                              ? "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
                              : "border-border hover:bg-[var(--emr-state-hover)]"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[var(--clair-radius-full)] border",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-transparent"
                            )}
                            aria-hidden="true"
                          >
                            <CheckIcon />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold leading-5">
                              {role.label}
                            </span>
                            <span className="mt-1 block text-[12px] leading-4 text-muted-foreground">
                              {role.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </FieldSet>

                <FieldSet className="gap-3">
                  <FieldLegend className="mb-0 text-[13px]">로그인 유지</FieldLegend>
                  <div className="grid gap-2">
                    {storageOptions.map((option) => (
                      <label
                        key={option.id}
                        className={cn(
                          "flex min-h-[64px] cursor-pointer gap-3 rounded-[var(--clair-radius-md)] border bg-card p-3",
                          storageMode === option.id
                            ? "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
                            : "border-border"
                        )}
                      >
                        <input
                          type="radio"
                          name="mock-session-storage"
                          value={option.id}
                          checked={storageMode === option.id}
                          disabled={isSubmitting}
                          onChange={() => setStorageMode(option.id)}
                          className="mt-1 size-4 accent-[var(--emr-state-selected-border)]"
                        />
                        <span>
                          <span className="block text-[13px] font-semibold leading-5">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </FieldSet>
              </>
            )}

            <div
              className="rounded-[var(--clair-radius-md)] border border-border bg-[var(--emr-surface-subpanel)] p-3"
              data-testid="mock-session-status"
            >
              <p className="text-[12px] font-semibold leading-4 text-muted-foreground">
                현재 로그인
              </p>
              {!hydrated ? (
                <p className="mt-2 text-[13px] text-muted-foreground">확인 중</p>
              ) : session ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid gap-2 text-[13px]">
                    <div>
                      <p className="text-[12px] text-muted-foreground">
                        상태
                      </p>
                      <p className="font-semibold">로그인됨</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-muted-foreground">
                        역할
                      </p>
                      <p className="font-medium">
                        {session.roleLabel}{" "}
                        <span className="text-[12px]">({session.role})</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] text-muted-foreground">
                        저장소
                      </p>
                      <p className="font-medium">
                        {session.storageMode === "cookie"
                          ? "Supabase cookie session"
                          : session.storageMode === "session"
                            ? "이번 탭만"
                            : "브라우저에 유지"}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={signOut}>
                    로그아웃
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  로그인 전
                </p>
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function InviteLoginContext({ inviteEmail }: { inviteEmail: string | null }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--clair-radius-lg)] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--emr-status-info-text)]">
          Invitation login
        </p>
        <h2 className="text-[24px] font-semibold leading-8 tracking-normal">
          초대 계정 확인
        </h2>
        <p className="text-[14px] leading-6 text-muted-foreground">
          이 로그인은 초대받은 워크스페이스 멤버십을 활성화하기 위한 단계입니다.
        </p>
      </div>

      <dl className="grid gap-3 text-[13px]">
        <div>
          <dt className="text-[12px] text-muted-foreground">초대 이메일</dt>
          <dd className="mt-0.5 font-medium">{inviteEmail ?? "초대 링크에서 확인 중"}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted-foreground">다음 단계</dt>
          <dd className="mt-0.5 font-medium">
            로그인 성공 후 초대 수락 화면으로 돌아갑니다.
          </dd>
        </div>
      </dl>
    </div>
  );
}
