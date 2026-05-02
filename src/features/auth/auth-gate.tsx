"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMockAuthStore } from "@/features/auth/session-store";

type AuthGateProps = {
  children: React.ReactNode;
};

function buildLoginHref(pathname: string, search: string) {
  const next = `${pathname}${search ? `?${search}` : ""}`;
  const params = new URLSearchParams({ next });

  return `/login?${params.toString()}`;
}

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const hydrated = useMockAuthStore((state) => state.hydrated);
  const session = useMockAuthStore((state) => state.session);
  const hydrate = useMockAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || session) return;

    router.replace(buildLoginHref(pathname, search));
  }, [hydrated, pathname, router, search, session]);

  if (!hydrated || !session) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--clair-color-background-surface)] px-6 text-[var(--clair-color-label-strong)]">
        <div className="rounded-[var(--clair-radius-lg)] border border-[var(--clair-color-line-normal)] bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-[14px] font-semibold">로그인 확인 중</p>
          <p className="mt-1 text-[12px] text-[var(--clair-color-label-neutral)]">
            워크스페이스 접근 권한을 확인합니다.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
