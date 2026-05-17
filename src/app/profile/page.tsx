import { Suspense } from "react";
import { AuthGate } from "@/features/auth/auth-gate";
import { PersonalProfileSettings } from "@/features/auth/personal-profile-settings";

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <AuthGate>
        <PersonalProfileSettings />
      </AuthGate>
    </Suspense>
  );
}

function ProfileLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--emr-surface-muted)] px-6 text-foreground">
      <div className="rounded-[var(--clair-radius-lg)] border border-border bg-card px-6 py-5 text-center shadow-sm">
        <p className="text-[14px] font-semibold">프로필 준비 중</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          개인 설정 화면을 불러옵니다.
        </p>
      </div>
    </main>
  );
}
