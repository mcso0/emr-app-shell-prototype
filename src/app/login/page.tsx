import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Login | CLAiR EMR",
  description: "Role-based MVP login entry for the CLAiR EMR prototype.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--clair-color-background-surface)] px-6 text-[var(--clair-color-label-strong)]">
      <div className="rounded-[var(--clair-radius-lg)] border border-[var(--clair-color-line-normal)] bg-white px-6 py-5 text-center shadow-sm">
        <p className="text-[14px] font-semibold">로그인 화면 준비 중</p>
      </div>
    </main>
  );
}
