"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  MOCK_AUTH_ROLES,
  type MockAuthRole,
  type MockSessionStorageMode,
} from "@/features/auth/mock-session";
import { useMockAuthStore } from "@/features/auth/session-store";
import { cn } from "@/lib/utils";

const storageOptions: Array<{
  id: MockSessionStorageMode;
  label: string;
  description: string;
}> = [
  {
    id: "session",
    label: "탭 세션",
    description: "현재 브라우저 탭에서만 mock session을 유지합니다.",
  },
  {
    id: "local",
    label: "브라우저 localStorage",
    description: "새로고침 뒤에도 역할 선택을 유지합니다.",
  },
];

export function LoginForm() {
  const [selectedRole, setSelectedRole] = useState<MockAuthRole>("front_desk");
  const [storageMode, setStorageMode] = useState<MockSessionStorageMode>("session");
  const hydrated = useMockAuthStore((state) => state.hydrated);
  const session = useMockAuthStore((state) => state.session);
  const hydrate = useMockAuthStore((state) => state.hydrate);
  const login = useMockAuthStore((state) => state.login);
  const logout = useMockAuthStore((state) => state.logout);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login(selectedRole, storageMode);
  }

  return (
    <main className="min-h-screen bg-[var(--clair-color-background-surface)] px-6 py-8 text-[var(--clair-color-label-strong)]">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1120px] flex-col justify-center gap-6">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[var(--clair-radius-lg)] border border-[var(--clair-color-line-normal)] bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex flex-col gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--clair-color-primary-normal)]">
                CLAiR EMR mock auth
              </p>
              <h1 className="text-[28px] font-semibold leading-9 tracking-normal">
                로그인 역할 선택
              </h1>
              <p className="max-w-[640px] text-[14px] leading-6 text-[var(--clair-color-label-neutral)]">
                실제 인증 provider 없이 데모 사용자의 역할과 저장 방식을 선택합니다.
              </p>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-[13px] font-semibold text-[var(--clair-color-label-strong)]">
                역할
              </legend>
              <div className="grid gap-3 md:grid-cols-2">
                {MOCK_AUTH_ROLES.map((role) => {
                  const selected = selectedRole === role.id;

                  return (
                    <button
                      key={role.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedRole(role.id)}
                      className={cn(
                        "min-h-[112px] rounded-[var(--clair-radius-md)] border bg-white p-4 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "border-[var(--clair-color-primary-normal)] bg-[var(--clair-color-primary-background)]"
                          : "border-[var(--clair-color-line-normal)] hover:bg-[var(--clair-color-background-subtle)]"
                      )}
                    >
                      <span className="block text-[15px] font-semibold leading-5">{role.label}</span>
                      <span className="mt-2 block text-[13px] leading-5 text-[var(--clair-color-label-neutral)]">
                        {role.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-6 space-y-3">
              <legend className="text-[13px] font-semibold text-[var(--clair-color-label-strong)]">
                Mock session 저장
              </legend>
              <div className="grid gap-3 md:grid-cols-2">
                {storageOptions.map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      "flex min-h-[88px] cursor-pointer gap-3 rounded-[var(--clair-radius-md)] border bg-white p-4",
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
                      <span className="block text-[14px] font-semibold leading-5">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[13px] leading-5 text-[var(--clair-color-label-neutral)]">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg">
                mock session 생성
              </Button>
              <Link
                href="/w/clair-demo/dispensing"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                워크스페이스 열기
              </Link>
            </div>
          </form>

          <aside className="rounded-[var(--clair-radius-lg)] border border-[var(--clair-color-line-normal)] bg-white p-5 shadow-sm">
            <p className="text-[13px] font-semibold text-[var(--clair-color-label-neutral)]">
              현재 mock session
            </p>
            <div
              className="mt-4 rounded-[var(--clair-radius-md)] border border-[var(--clair-color-line-normal)] bg-[var(--clair-color-background-subtle)] p-4"
              data-testid="mock-session-status"
            >
              {!hydrated ? (
                <p className="text-[14px] text-[var(--clair-color-label-neutral)]">확인 중</p>
              ) : session ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[12px] text-[var(--clair-color-label-neutral)]">상태</p>
                    <p className="text-[16px] font-semibold">로그인됨</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[var(--clair-color-label-neutral)]">역할</p>
                    <p className="text-[14px] font-medium">
                      {session.roleLabel} <span className="text-[12px]">({session.role})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[var(--clair-color-label-neutral)]">저장소</p>
                    <p className="text-[14px] font-medium">
                      {session.storageMode === "session" ? "탭 세션" : "브라우저 localStorage"}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={logout}>
                    로그아웃
                  </Button>
                </div>
              ) : (
                <p className="text-[14px] text-[var(--clair-color-label-neutral)]">
                  세션 없음
                </p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
