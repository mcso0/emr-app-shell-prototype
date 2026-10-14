import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthEntryHeading, AuthEntryPanel, AuthEntryScene } from "@/features/auth/auth-entry";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "CLAiR EMR 로그인",
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
    <AuthEntryScene><AuthEntryPanel>
      <AuthEntryHeading title="로그인" />
      <p role="status" className="mt-6 text-center text-sm text-muted-foreground">로그인 화면 준비 중</p>
    </AuthEntryPanel></AuthEntryScene>
  );
}
