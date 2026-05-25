"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
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
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  MOCK_AUTH_ROLES,
  type MockAuthRole,
  type MockSessionStorageMode,
} from "@/features/auth/mock-session";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
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
const inviteOtpLength = 8;
const mockInviteOtpToken = "0".repeat(inviteOtpLength);
const loginFormClassName = "flex w-full flex-col gap-5";
const loginSupportPanelClassName =
  "rounded-[var(--clair-radius-lg)] border border-border bg-[var(--emr-surface-panel)] p-4 shadow-[var(--clair-shadow-sm)]";

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
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState("");
  const {
    authProvider,
    hydrated,
    session,
    hydrate,
    signInWithMockRole,
    signInWithPassword,
    signInWithEmailOtp,
    verifyEmailOtp,
    updatePassword,
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
    const nextInvitePassword = String(formData.get("invite-password") ?? "");
    const nextInvitePasswordConfirm = String(formData.get("invite-password-confirm") ?? "");
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

            if (nextInvitePassword.length < 8) {
              throw new Error("invite-password-too-short");
            }

            if (nextInvitePassword !== nextInvitePasswordConfirm) {
              throw new Error("invite-password-mismatch");
            }

            await verifyEmailOtp({ email, token });
            await updatePassword({ password: nextInvitePassword });
          } else if (token !== mockInviteOtpToken) {
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
    } catch (caught) {
      const errorCode = caught instanceof Error ? caught.message : null;
      setLoginError(
        isInviteOtpLogin
          ? errorCode === "invite-password-too-short"
            ? "비밀번호는 8자 이상으로 설정해 주세요."
            : errorCode === "invite-password-mismatch"
              ? "비밀번호 확인이 일치하지 않습니다."
              : "초대 이메일 인증 또는 비밀번호 설정을 진행할 수 없습니다. 초대 링크와 인증 코드를 확인하세요."
          : usesSupabaseProvider
          ? "Supabase 로그인 처리 중 문제가 발생했습니다. 계정 정보와 환경 설정을 확인하세요."
          : "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하세요."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-muted)] text-foreground">
      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-2 text-[13px] font-semibold leading-5">
            <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] bg-primary text-primary-foreground shadow-[var(--clair-shadow-xs)]">
              <WorkspaceLogoMarkIcon aria-hidden="true" />
            </span>
            CLAiR EMR
          </div>
          <span className="text-[12px] font-medium leading-4 text-muted-foreground">
            KO
          </span>
        </header>

        <section className="flex flex-1 items-start justify-center px-4 pb-10 pt-[12vh] md:px-8 md:pt-[18vh]">
          <div className="grid w-full max-w-[760px] gap-4">
            <div className="mx-auto w-full max-w-[390px] rounded-[var(--clair-radius-lg)] border border-border bg-card p-5 shadow-[var(--clair-shadow-md)] md:p-6">
              <form onSubmit={handleSubmit} className={loginFormClassName}>
                <FieldGroup className="gap-5">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex size-8 items-center justify-center rounded-[var(--clair-radius-md)] bg-[var(--emr-accent-subtle)] text-[var(--emr-accent)]">
                      <WorkspaceLogoMarkIcon aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <h1 className="text-[22px] font-semibold leading-7 tracking-normal">
                        {isInviteOtpLogin ? "초대 이메일 인증" : "CLAiR EMR에 로그인"}
                      </h1>
                      <p className="text-[13px] leading-5 text-muted-foreground">
                        {isInviteOtpLogin
                          ? "초대받은 이메일로 인증 코드를 받아 계정 확인을 이어갑니다."
                          : isInviteLogin
                            ? "초대받은 워크스페이스에 연결하려면 초대 이메일 계정으로 로그인하세요."
                            : "병원 워크스페이스에 접속하려면 계정 정보를 입력하세요."}
                      </p>
                    </div>
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

                  <div className="grid gap-4">
                    <Field className="gap-1.5">
                      <FieldLabel htmlFor="mock-email" className="text-[12px]">
                        이메일
                      </FieldLabel>
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
                        className="h-[38px] bg-background"
                      />
                      <FieldDescription id="mock-email-description" className="text-[12px]">
                        {isInviteOtpLogin && inviteEmail
                          ? `${inviteEmail} 주소로 인증 코드를 보냅니다.`
                          : isInviteLogin && inviteEmail
                            ? `${inviteEmail} 계정으로 로그인해야 이 초대를 수락할 수 있습니다.`
                            : "등록된 이메일 또는 초대받은 이메일을 입력하세요."}
                      </FieldDescription>
                    </Field>

                    {isInviteOtpLogin ? (
                      <>
                        <Field className="gap-1.5">
                          <FieldLabel htmlFor="otp-token" className="text-[12px]">
                            인증 코드
                          </FieldLabel>
                          <InputOTP
                            id="otp-token"
                            name="otp-token"
                            maxLength={inviteOtpLength}
                            pattern={REGEXP_ONLY_DIGITS}
                            autoComplete="one-time-code"
                            disabled={isSubmitting}
                            value={inviteOtpToken}
                            onChange={(value) => {
                              setInviteOtpToken(value);
                              if (loginError) setLoginError(null);
                            }}
                            containerClassName="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
                            aria-label="인증 코드"
                          >
                            <InputOTPGroup className="grid grid-cols-4">
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup className="grid grid-cols-4">
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                              <InputOTPSlot index={6} />
                              <InputOTPSlot index={7} />
                            </InputOTPGroup>
                          </InputOTP>
                          <FieldDescription className="text-[12px]">
                            {usesSupabaseProvider
                              ? "받은 8자리 코드를 입력하면 초대 화면으로 돌아갑니다."
                              : `8자리 데모 인증 코드: ${mockInviteOtpToken}`}
                          </FieldDescription>
                        </Field>
                        {usesSupabaseProvider ? (
                          <>
                            <Field className="gap-1.5">
                              <FieldLabel htmlFor="invite-password" className="text-[12px]">
                                새 비밀번호
                              </FieldLabel>
                              <Input
                                id="invite-password"
                                type="password"
                                name="invite-password"
                                placeholder="8자 이상"
                                autoComplete="new-password"
                                disabled={isSubmitting}
                                value={invitePassword}
                                onChange={(event) => {
                                  setInvitePassword(event.target.value);
                                  if (loginError) setLoginError(null);
                                }}
                                className="h-[38px] bg-background"
                              />
                              <FieldDescription className="text-[12px]">
                                인증 코드 확인 후 이 비밀번호로 다시 로그인할 수 있습니다.
                              </FieldDescription>
                            </Field>
                            <Field className="gap-1.5">
                              <FieldLabel
                                htmlFor="invite-password-confirm"
                                className="text-[12px]"
                              >
                                비밀번호 확인
                              </FieldLabel>
                              <Input
                                id="invite-password-confirm"
                                type="password"
                                name="invite-password-confirm"
                                placeholder="다시 입력"
                                autoComplete="new-password"
                                disabled={isSubmitting}
                                value={invitePasswordConfirm}
                                onChange={(event) => {
                                  setInvitePasswordConfirm(event.target.value);
                                  if (loginError) setLoginError(null);
                                }}
                                className="h-[38px] bg-background"
                              />
                            </Field>
                          </>
                        ) : null}
                        {inviteOtpStatus ? (
                          <div className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-success-text)]">
                            {inviteOtpStatus}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <Field className="gap-1.5">
                        <FieldLabel htmlFor="mock-password" className="text-[12px]">
                          비밀번호
                        </FieldLabel>
                        <Input
                          id="mock-password"
                          type="password"
                          name="password"
                          placeholder="비밀번호"
                          autoComplete="current-password"
                          disabled={isSubmitting}
                          className="h-[38px] bg-background"
                        />
                      </Field>
                    )}
                  </div>

                  {loginError ? (
                    <FieldError className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-danger-text)]">
                      {loginError}
                    </FieldError>
                  ) : null}

                  <Button type="submit" size="lg" className="h-[42px] w-full" disabled={isSubmitting}>
                    {isInviteOtpLogin
                      ? isSubmitting
                        ? "처리 중"
                        : inviteOtpToken.trim()
                          ? usesSupabaseProvider
                            ? "인증하고 비밀번호 설정"
                            : "인증하고 초대 화면으로 돌아가기"
                          : "인증 코드 받기"
                      : isSubmitting
                        ? "로그인 중"
                        : "로그인"}
                  </Button>

                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 text-center text-[12px] leading-4 text-muted-foreground">
                    <span>초대 기반 가입</span>
                    <span>관리자에게 문의</span>
                  </div>
                </FieldGroup>
              </form>
            </div>

            <aside className="mx-auto w-full max-w-[760px]">
              {usesSupabaseProvider || isInviteLogin ? (
                <div className={loginSupportPanelClassName}>
                  <InviteLoginContext inviteEmail={inviteEmail} />
                  <SessionStatus
                    hydrated={hydrated}
                    session={session}
                    signOut={signOut}
                  />
                </div>
              ) : (
                <div className={cn(loginSupportPanelClassName, "flex flex-col gap-4")}>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] font-semibold leading-4 text-[var(--emr-status-info-text)]">
                      Development controls
                    </p>
                    <h2 className="text-[18px] font-semibold leading-6 tracking-normal">
                      MVP 테스트 옵션
                    </h2>
                    <p className="text-[13px] leading-5 text-muted-foreground">
                      현재는 Supabase Auth 연결 전 mock session으로 진입합니다.
                    </p>
                  </div>

                  <FieldSet className="gap-3">
                    <FieldLegend className="mb-0 text-[13px]">역할 선택</FieldLegend>
                    <div className="grid gap-2 md:grid-cols-2">
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
                              "flex min-h-[58px] items-start gap-2.5 rounded-[var(--clair-radius-md)] border bg-card p-3 text-left transition-colors",
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
                              <span className="block text-[13px] font-semibold leading-5">
                                {role.label}
                              </span>
                              <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
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
                    <div className="grid gap-2 md:grid-cols-2">
                      {storageOptions.map((option) => (
                        <label
                          key={option.id}
                          className={cn(
                            "flex min-h-[58px] cursor-pointer gap-2.5 rounded-[var(--clair-radius-md)] border bg-card p-3",
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

                  <SessionStatus hydrated={hydrated} session={session} signOut={signOut} />
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function InviteLoginContext({ inviteEmail }: { inviteEmail: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-semibold leading-4 text-[var(--emr-status-info-text)]">
          Invitation login
        </p>
        <h2 className="text-[18px] font-semibold leading-6 tracking-normal">
          초대 계정 확인
        </h2>
        <p className="text-[13px] leading-5 text-muted-foreground">
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

function SessionStatus({
  hydrated,
  session,
  signOut,
}: {
  hydrated: boolean;
  session: AuthSession | null;
  signOut: () => Promise<void>;
}) {
  return (
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
              <p className="text-[12px] text-muted-foreground">상태</p>
              <p className="font-semibold">로그인됨</p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">역할</p>
              <p className="font-medium">
                {session.roleLabel}{" "}
                <span className="text-[12px]">({session.role})</span>
              </p>
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">저장소</p>
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
        <p className="mt-2 text-[13px] text-muted-foreground">로그인 전</p>
      )}
    </div>
  );
}
