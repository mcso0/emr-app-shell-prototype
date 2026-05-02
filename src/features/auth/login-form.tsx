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
  const { hydrated, session, hydrate, signInWithMockRole, signOut } = useAuthClient();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);

    try {
      await signInWithMockRole(selectedRole, storageMode, {
        forceProviderError: searchParams.get("mockProviderError") === "1",
      });
      router.replace(getSafeNextHref(searchParams.get("next")));
    } catch {
      setLoginError("로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하세요.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-[var(--clair-color-background-normal)] text-[var(--clair-color-label-strong)]">
      <section className="grid min-h-svh lg:grid-cols-2">
        <div className="flex min-h-[520px] flex-col bg-white px-6 py-6 md:px-10 md:py-8">
          <div className="flex items-center gap-2 text-[13px] font-semibold leading-5">
            <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] bg-[var(--clair-color-atomic-gray-900)] text-[var(--clair-color-static-white)]">
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
                  <p className="text-[14px] leading-6 text-[var(--clair-color-label-neutral)]">
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
                    className="rounded-[var(--clair-radius-md)] border border-[var(--clair-color-status-negative-background)] bg-[var(--clair-color-status-negative-background)] px-3 py-2 text-[13px] leading-5 text-[var(--clair-color-status-negative-foreground)]"
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

        <aside className="flex min-h-[520px] items-center justify-center border-t border-[var(--clair-color-line-normal)] bg-[var(--clair-color-background-surface)] px-5 py-8 md:px-10 lg:border-l lg:border-t-0">
          <div className="flex w-full max-w-[456px] flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--clair-color-primary-normal)]">
                Development controls
              </p>
              <h2 className="text-[24px] font-semibold leading-8 tracking-normal">
                MVP 테스트 옵션
              </h2>
              <p className="text-[14px] leading-6 text-[var(--clair-color-label-neutral)]">
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
                      onClick={() => setSelectedRole(role.id)}
                      className={cn(
                        "flex min-h-[68px] items-start gap-3 rounded-[var(--clair-radius-md)] border bg-white p-3 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-[var(--clair-color-primary-normal)] bg-[var(--clair-color-primary-background)]"
                          : "border-[var(--clair-color-line-normal)] hover:bg-[var(--clair-color-background-subtle)]"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[var(--clair-radius-full)] border",
                          selected
                            ? "border-[var(--clair-color-primary-normal)] bg-[var(--clair-color-primary-normal)] text-[var(--clair-color-static-white)]"
                            : "border-[var(--clair-color-line-normal)] text-transparent"
                        )}
                        aria-hidden="true"
                      >
                        <CheckIcon />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-5">
                          {role.label}
                        </span>
                        <span className="mt-1 block text-[12px] leading-4 text-[var(--clair-color-label-neutral)]">
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
                      "flex min-h-[64px] cursor-pointer gap-3 rounded-[var(--clair-radius-md)] border bg-white p-3",
                      storageMode === option.id
                        ? "border-[var(--clair-color-primary-normal)] bg-[var(--clair-color-primary-background)]"
                        : "border-[var(--clair-color-line-normal)]"
                    )}
                  >
                    <input
                      type="radio"
                      name="mock-session-storage"
                      value={option.id}
                      checked={storageMode === option.id}
                      onChange={() => setStorageMode(option.id)}
                      className="mt-1 size-4 accent-[var(--clair-color-primary-normal)]"
                    />
                    <span>
                      <span className="block text-[13px] font-semibold leading-5">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-4 text-[var(--clair-color-label-neutral)]">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </FieldSet>

            <div
              className="rounded-[var(--clair-radius-md)] border border-[var(--clair-color-line-normal)] bg-[var(--clair-color-background-subtle)] p-3"
              data-testid="mock-session-status"
            >
              <p className="text-[12px] font-semibold leading-4 text-[var(--clair-color-label-neutral)]">
                현재 로그인
              </p>
              {!hydrated ? (
                <p className="mt-2 text-[13px] text-[var(--clair-color-label-neutral)]">확인 중</p>
              ) : session ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid gap-2 text-[13px]">
                    <div>
                      <p className="text-[12px] text-[var(--clair-color-label-neutral)]">
                        상태
                      </p>
                      <p className="font-semibold">로그인됨</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[var(--clair-color-label-neutral)]">
                        역할
                      </p>
                      <p className="font-medium">
                        {session.roleLabel}{" "}
                        <span className="text-[12px]">({session.role})</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[var(--clair-color-label-neutral)]">
                        저장소
                      </p>
                      <p className="font-medium">
                        {session.storageMode === "session" ? "이번 탭만" : "브라우저에 유지"}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={signOut}>
                    로그아웃
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--clair-color-label-neutral)]">
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
