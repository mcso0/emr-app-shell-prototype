"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckIcon, ChevronLeftIcon, UserIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  createEmptyPersonalProfilesState,
  createPersonalProfileSession,
  derivePersonalProfileInitials,
  getSessionPersonalProfile,
  persistPersonalProfilesState,
  readPersonalProfilesState,
  upsertSessionPersonalProfile,
  validatePersonalProfileInput,
  type PersonalProfileFieldErrors,
  type PersonalProfileSession,
  type SessionPersonalProfile,
} from "@/features/auth/personal-profile-session";
import { useSessionWorkspaceDisplayName } from "@/features/auth/workspace-display";
import {
  DEFAULT_PREPARED_EMPTY_CLINIC_RECEPTION_HREF,
  resolveWorkspacePathname,
} from "@/lib/emr-domain/demo-workspaces";
import { cn } from "@/lib/utils";

const defaultReturnHref = DEFAULT_PREPARED_EMPTY_CLINIC_RECEPTION_HREF;
const profileNoticeClassNames = {
  error:
    "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  success:
    "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
} as const;

function getBrowserProfileState() {
  if (typeof window === "undefined") return null;

  return readPersonalProfilesState(window.sessionStorage, window.localStorage);
}

function isSafeReturnHref(value: string | null) {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}

function toEditableProfile(profile: SessionPersonalProfile) {
  return {
    displayName: profile.displayName,
    phone: profile.phone ?? "",
    notificationOptIn: profile.notificationOptIn,
  };
}

export function PersonalProfileSettings() {
  const searchParams = useSearchParams();
  const { hydrated, session, hydrate } = useAuthClient();
  const profileSession = useMemo(
    () => (session ? createPersonalProfileSession(session) : null),
    [session]
  );
  const profile = useMemo(
    () => (profileSession ? getSessionPersonalProfile(getBrowserProfileState(), profileSession) : null),
    [profileSession]
  );
  const returnHref = isSafeReturnHref(searchParams.get("returnTo"))
    ? searchParams.get("returnTo")!
    : defaultReturnHref;
  const returnWorkspaceId = resolveWorkspacePathname(returnHref);
  const workspaceDisplayName = useSessionWorkspaceDisplayName(returnWorkspaceId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated || !session || !profileSession || !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--emr-surface-muted)] px-6 text-foreground">
        <div className="rounded-[var(--clair-radius-lg)] border border-border bg-card px-6 py-5 text-center shadow-sm">
          <p className="text-[14px] font-semibold">프로필 확인 중</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            개인 프로필을 불러옵니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PersonalProfileForm
      profile={profile}
      profileSession={profileSession}
      returnHref={returnHref}
      workspaceDisplayName={workspaceDisplayName}
    />
  );
}

type PersonalProfileFormProps = {
  profile: SessionPersonalProfile;
  profileSession: PersonalProfileSession;
  returnHref: string;
  workspaceDisplayName: string;
};

function PersonalProfileForm({
  profile,
  profileSession,
  returnHref,
  workspaceDisplayName,
}: PersonalProfileFormProps) {
  const initialProfile = toEditableProfile(profile);
  const [fieldErrors, setFieldErrors] = useState<PersonalProfileFieldErrors>({});
  const [saveNotice, setSaveNotice] = useState<{
    tone: keyof typeof profileNoticeClassNames;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const hasUnsavedChanges = displayName !== savedProfile.displayName || phone !== savedProfile.phone;
  const profileInitials = derivePersonalProfileInitials(displayName || savedProfile.displayName);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = {
      displayName,
      initials: derivePersonalProfileInitials(displayName),
      phone,
      notificationOptIn: savedProfile.notificationOptIn,
    };
    const validation = validatePersonalProfileInput(input);

    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setSaveNotice(null);
      return;
    }

    let persistedInput = input;
    setIsSaving(true);

    try {
      const response = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(profileSession.role === "supabase"
            ? {}
            : { "x-clair-demo-session-user-id": profileSession.sessionId }),
        },
        body: JSON.stringify(input),
      });
      const result = await response.json() as {
        ok: boolean;
        profile?: {
          displayName: string;
          initials: string;
          phone: string | null;
          notificationOptIn: boolean;
        };
        fieldErrors?: PersonalProfileFieldErrors;
      };

      if (!response.ok || !result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setSaveNotice({
          tone: "error",
          message: "프로필 저장 권한 또는 서버 상태를 확인해 주세요.",
        });
        return;
      }

      if (result.profile) {
        persistedInput = {
          displayName: result.profile.displayName,
          initials: result.profile.initials,
          phone: result.profile.phone ?? "",
          notificationOptIn: result.profile.notificationOptIn,
        };
      }
    } catch {
      setSaveNotice({
        tone: "error",
        message: "프로필 저장 권한 또는 서버 상태를 확인해 주세요.",
      });
      return;
    } finally {
      setIsSaving(false);
    }

    const currentState = getBrowserProfileState() ?? createEmptyPersonalProfilesState();
    const nextState = upsertSessionPersonalProfile(currentState, profileSession, persistedInput);
    persistPersonalProfilesState(
      nextState,
      profileSession.storageMode,
      window.sessionStorage,
      window.localStorage
    );
    window.dispatchEvent(new Event("clair.personalProfiles.v1"));
    setFieldErrors({});
    setSaveNotice({ tone: "success", message: "프로필이 저장되었습니다." });
    setDisplayName(persistedInput.displayName);
    setPhone(persistedInput.phone);
    setSavedProfile({
      displayName: persistedInput.displayName,
      phone: persistedInput.phone,
      notificationOptIn: persistedInput.notificationOptIn,
    });
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] text-foreground">
      <div className="grid min-h-svh lg:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--emr-border-strong)] bg-[var(--emr-surface-panel)] px-5 py-5 lg:border-b-0 lg:border-r">
          <Link
            href={returnHref}
            className="inline-flex max-w-full items-center gap-2 rounded-[var(--emr-radius-control)] px-1 py-1 text-[14px] font-semibold leading-5 text-foreground transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{workspaceDisplayName}</span>
          </Link>

          <nav aria-label="내 정보" className="mt-10">
            <p className="px-2 text-[12px] font-semibold leading-4 text-[var(--emr-text-tertiary)]">
              내 정보
            </p>
            <div className="mt-3">
              <span className="flex h-10 items-center gap-2 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-selected)] bg-[var(--emr-state-selected)] px-3 text-[14px] font-semibold leading-5 text-foreground">
                <UserIcon aria-hidden="true" className="size-4 shrink-0" />
                개인 프로필
              </span>
            </div>
          </nav>
        </aside>

        <section className="px-6 py-8 sm:px-10 lg:px-24 lg:py-14">
          <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-[800px] flex-col">
            <header className="flex flex-col gap-3">
              <p className="text-[13px] font-semibold leading-5 text-[var(--emr-text-tertiary)]">
                Personal profile
              </p>
              <h1 className="text-[30px] font-semibold leading-9 tracking-normal text-[var(--emr-text-primary)]">
                개인 프로필
              </h1>
              <p className="max-w-[560px] text-[15px] leading-6 text-[var(--emr-text-secondary)]">
                워크스페이스 안에서 동료에게 보이는 이름과 연락처를 관리합니다.
              </p>
            </header>

            {saveNotice ? (
              <p
                role={saveNotice.tone === "error" ? "alert" : "status"}
                className={cn(
                  "rounded-[var(--clair-radius-md)] border px-3 py-2 text-[13px] leading-5",
                  profileNoticeClassNames[saveNotice.tone]
                )}
              >
                {saveNotice.message}
              </p>
            ) : null}

            <Separator className="mt-8 bg-[var(--emr-border-default)]" />

            <section className="grid gap-5 py-9 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                <h2 className="text-[17px] font-semibold leading-6 text-[var(--emr-text-primary)]">
                  사진
                </h2>
                <p className="max-w-[220px] text-[13px] leading-5 text-[var(--emr-text-secondary)]">
                  프로필 목록에 표시됩니다.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="flex size-[88px] shrink-0 items-center justify-center rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-selected)] bg-[var(--emr-accent-subtle)] text-[28px] font-semibold leading-none text-[var(--emr-text-primary)]">
                  {profileInitials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold leading-6 text-[var(--emr-text-primary)]">
                    {displayName || "이름 없음"}
                  </p>
                  {profileSession.email ? (
                    <p className="truncate text-[13px] leading-5 text-[var(--emr-text-secondary)]">
                      {profileSession.email}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <Separator className="bg-[var(--emr-border-default)]" />

            <section className="grid gap-5 py-9 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                <h2 className="text-[17px] font-semibold leading-6 text-[var(--emr-text-primary)]">
                  기본 정보
                </h2>
                <p className="max-w-[220px] text-[13px] leading-5 text-[var(--emr-text-secondary)]">
                  진료, 접수, 감사 로그에 표시됩니다.
                </p>
              </div>

              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="profile-display-name">이름</FieldLabel>
                  <Input
                    id="profile-display-name"
                    name="displayName"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.currentTarget.value);
                      setFieldErrors((current) => {
                        const next = { ...current };
                        delete next.displayName;
                        return next;
                      });
                      setSaveNotice(null);
                    }}
                    aria-invalid={Boolean(fieldErrors.displayName)}
                    disabled={isSaving}
                  />
                  {fieldErrors.displayName ? (
                    <FieldError className="text-[12px] text-[var(--emr-status-danger-text)]">
                      {fieldErrors.displayName}
                    </FieldError>
                  ) : null}
                </Field>

                {profileSession.email ? (
                  <Field>
                    <FieldLabel htmlFor="profile-email">이메일</FieldLabel>
                    <Input
                      id="profile-email"
                      type="email"
                      value={profileSession.email}
                      readOnly
                      aria-readonly="true"
                      className="bg-[var(--emr-surface-muted)] text-[var(--emr-text-secondary)]"
                    />
                    <p className="text-[12px] leading-5 text-[var(--emr-text-secondary)]">
                      로그인에 사용하는 이메일입니다.
                    </p>
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="profile-phone">연락처</FieldLabel>
                  <Input
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.currentTarget.value);
                      setSaveNotice(null);
                    }}
                    placeholder="010-0000-0000"
                    disabled={isSaving}
                  />
                </Field>
              </FieldGroup>
            </section>

            <Separator className="bg-[var(--emr-border-default)]" />

            <div className="flex items-center justify-end pt-6">
              <Button type="submit" disabled={isSaving || !hasUnsavedChanges}>
                <CheckIcon data-icon="inline-start" aria-hidden="true" />
                {isSaving ? "저장 중" : "저장하기"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
