"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CheckIcon, WorkspaceLogoMarkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Field,
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

function getSafeNextHref(value: string | null) {
  if (!value) return defaultWorkspaceHref;
  if (!value.startsWith("/")) return defaultWorkspaceHref;
  if (value.startsWith("//")) return defaultWorkspaceHref;
  if (value.startsWith("/login")) return defaultWorkspaceHref;

  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<MockAuthRole>("front_desk");
  const [storageMode, setStorageMode] = useState<MockSessionStorageMode>("session");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const {
    authProvider,
    hydrated,
    session,
    hydrate,
    signInWithMockRole,
    signInWithPassword,
    signOut,
    supabaseConfigured,
  } = useAuthClient();
  const usesSupabaseProvider = authProvider === "supabase";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);
    setLoginError(null);

    try {
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
        usesSupabaseProvider
          ? "Supabase 로그인 처리 중 문제가 발생했습니다. 계정 정보와 환경 설정을 확인하세요."
          : "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하세요."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] text-foreground">
      <section className="grid min-h-svh lg:grid-cols-2">
        <div className="flex min-h-[520px] flex-col bg-card px-6 py-6 md:px-10 md:py-8">
          <div className="flex items-center gap-2 text-[13px] font-semibold leading-5">
            <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] bg-primary text-primary-foreground">
              <WorkspaceLogoMarkIcon aria-hidden="true" />
            </span>
            CLAiR EMR
          </div>

          <div className="flex flex-1 items-center justify-center py-12">
            <form
              onSubmit={handleSubmit}
              className="flex w-full max-w-[380px] flex-col gap-6"
            >
              <FieldGroup>
                <div className="flex flex-col gap-2">
                  <h1 className="text-[28px] font-semibold leading-9 tracking-normal">
                    CLAiR EMR에 로그인
                  </h1>
                  <p className="text-[14px] leading-6 text-muted-foreground">
                    병원 워크스페이스에 접속하려면 계정 정보를 입력하세요.
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="mock-email">이메일</FieldLabel>
                  <Input
                    id="mock-email"
                    type="email"
                    name="email"
                    placeholder="name@hospital.com"
                    autoComplete="email"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="mock-password">비밀번호</FieldLabel>
                  <Input
                    id="mock-password"
                    type="password"
                    name="password"
                    placeholder="비밀번호"
                    autoComplete="current-password"
                  />
                </Field>

                {loginError ? (
                  <p
                    role="alert"
                    className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-danger-text)]"
                  >
                    {loginError}
                  </p>
                ) : null}

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "로그인 중" : "로그인"}
                </Button>
              </FieldGroup>
            </form>
          </div>
        </div>

        <aside className="flex min-h-[520px] items-center justify-center border-t border-border bg-[var(--emr-surface-muted)] px-5 py-8 md:px-10 lg:border-l lg:border-t-0">
          <div className="flex w-full max-w-[456px] flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--emr-status-info-text)]">
                Development controls
              </p>
              <h2 className="text-[24px] font-semibold leading-8 tracking-normal">
                MVP 테스트 옵션
              </h2>
              <p className="text-[14px] leading-6 text-muted-foreground">
                {usesSupabaseProvider
                  ? "Supabase Auth로 로그인합니다. MVP 테스트 옵션은 local demo 확인용으로 유지합니다."
                  : "현재는 Supabase Auth 연결 전 mock session으로 진입합니다."}
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
                      onClick={() => setSelectedRole(role.id)}
                      className={cn(
                        "flex min-h-[68px] items-start gap-3 rounded-[var(--clair-radius-md)] border bg-card p-3 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
