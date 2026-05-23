import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  CheckIcon,
  ClockIcon,
  InfoIcon,
  UserIcon,
  WorkspaceLogoMarkIcon,
} from "@/components/icons";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Account Setup",
  description: "Invite-based account setup entry for the CLAiR EMR prototype.",
};

type SignupPageProps = {
  searchParams: Promise<{
    inviteEmail?: string | string[];
    next?: string | string[];
    reason?: string | string[];
  }>;
};

const defaultLoginHref = "/login";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeNextHref(value: string | undefined) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/signup")) return null;

  return value;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const inviteEmail = getSingleParam(params.inviteEmail);
  const safeNext = getSafeNextHref(getSingleParam(params.next));
  const loginParams = new URLSearchParams({
    reason: "invite_existing_account",
  });

  if (safeNext) loginParams.set("next", safeNext);
  if (inviteEmail) loginParams.set("inviteEmail", inviteEmail);

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] text-foreground">
      <section className="grid min-h-svh lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)]">
        <div className="flex min-h-[520px] flex-col bg-card px-6 py-6 md:px-10 md:py-8">
          <div className="flex items-center gap-2 text-[13px] font-semibold leading-5">
            <span className="flex size-7 items-center justify-center rounded-[var(--clair-radius-md)] bg-primary text-primary-foreground">
              <WorkspaceLogoMarkIcon aria-hidden="true" />
            </span>
            CLAiR EMR
          </div>

          <div className="flex flex-1 items-center py-12">
            <div className="w-full max-w-[500px]">
              <Badge
                variant="outline"
                className="h-6 rounded-[var(--clair-radius-full)] border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-2.5 text-[var(--emr-status-warning-text)]"
              >
                계정 생성 준비 중
              </Badge>
              <h1 className="mt-4 text-[32px] font-semibold leading-10 tracking-normal">
                초대받은 이메일을 먼저 확인해야 합니다
              </h1>
              <p className="mt-3 max-w-[480px] text-[14px] leading-6 text-muted-foreground">
                신규 계정 생성은 Supabase Auth 계정 생성 정책과 이메일 인증 설정이
                확정된 뒤 활성화됩니다. 지금은 이미 준비된 초대 이메일 계정으로 로그인해
                수락을 이어갈 수 있습니다.
              </p>

              <ol className="mt-8 grid gap-2 text-[12px] leading-5 text-muted-foreground">
                <SignupStep icon={<InfoIcon className="size-4" />} label="초대 링크 확인" active />
                <SignupStep icon={<UserIcon className="size-4" />} label="계정 생성 정책 확정 필요" />
                <SignupStep icon={<CheckIcon className="size-4" />} label="로그인 후 초대 수락" />
              </ol>
            </div>
          </div>
        </div>

        <div className="flex min-h-[560px] items-center justify-center border-t border-border bg-[var(--emr-surface-muted)] px-4 py-8 md:px-10 lg:border-l lg:border-t-0">
          <div className="w-full max-w-[560px] border border-border bg-card p-5 shadow-sm md:p-6">
            <h2 className="text-[22px] font-semibold leading-8 tracking-normal">
              초대 계정 생성 준비 중
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
              이 단계에서는 계정을 임의로 만들지 않고, 초대 이메일과 일치하는 기존 계정
              로그인으로 이어갑니다.
            </p>

            <dl className="mt-6 grid gap-4 border border-border bg-[var(--emr-surface-subpanel)] p-4 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-muted-foreground">초대 이메일</dt>
                <dd className="mt-0.5 font-medium">{inviteEmail ?? "초대 링크에서 확인 중"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">상태</dt>
                <dd className="mt-0.5 font-medium">signup_not_ready</dd>
              </div>
            </dl>

            <EmrInlineAlert
              className="mt-5"
              severity="warning"
              title="신규 계정 생성은 아직 승인 전입니다"
              icon={<ClockIcon className="size-4" />}
            >
              실제 계정 생성과 이메일 인증은 별도 승인 후 Supabase Auth 경로로 연결합니다.
            </EmrInlineAlert>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={`/login?${loginParams.toString()}`}
                className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}
              >
                기존 계정으로 로그인
              </a>
              {safeNext ? (
                <a
                  href={safeNext}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full sm:w-fit"
                  )}
                >
                  초대 화면으로 돌아가기
                </a>
              ) : (
                <a
                  href={defaultLoginHref}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full sm:w-fit"
                  )}
                >
                  로그인으로 이동
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SignupStep({
  active = false,
  icon,
  label,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <li
      className={[
        "flex items-center gap-3 border border-border bg-[var(--emr-surface-subpanel)] px-3 py-2",
        active ? "text-[var(--emr-text-secondary)]" : "text-muted-foreground",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-7 shrink-0 items-center justify-center rounded-[var(--clair-radius-md)] border",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground",
        ].join(" ")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>{label}</span>
    </li>
  );
}
