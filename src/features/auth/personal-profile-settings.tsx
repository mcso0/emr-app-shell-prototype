"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { UserIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  createEmptyPersonalProfilesState,
  createPersonalProfileSession,
  getSessionPersonalProfile,
  persistPersonalProfilesState,
  readPersonalProfilesState,
  upsertSessionPersonalProfile,
  validatePersonalProfileInput,
  type PersonalProfileFieldErrors,
} from "@/features/auth/personal-profile-session";

const defaultReturnHref = "/w/clair-demo/reception?modulePanel=open&aside=closed";

function getBrowserProfileState() {
  if (typeof window === "undefined") return null;

  return readPersonalProfilesState(window.sessionStorage, window.localStorage);
}

function isSafeReturnHref(value: string | null) {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}

export function PersonalProfileSettings() {
  const searchParams = useSearchParams();
  const { hydrated, session, hydrate } = useAuthClient();
  const [fieldErrors, setFieldErrors] = useState<PersonalProfileFieldErrors>({});
  const [saveMessage, setSaveMessage] = useState("");
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

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileSession) return;

    const formData = new FormData(event.currentTarget);
    const input = {
      displayName: String(formData.get("displayName") ?? ""),
      initials: String(formData.get("initials") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notificationOptIn: formData.get("notificationOptIn") === "on",
    };
    const validation = validatePersonalProfileInput(input);

    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setSaveMessage("");
      return;
    }

    const currentState = getBrowserProfileState() ?? createEmptyPersonalProfilesState();
    const nextState = upsertSessionPersonalProfile(currentState, profileSession, input);
    persistPersonalProfilesState(
      nextState,
      profileSession.storageMode,
      window.sessionStorage,
      window.localStorage
    );
    window.dispatchEvent(new Event("clair.personalProfiles.v1"));
    setFieldErrors({});
    setSaveMessage("프로필이 저장되었습니다.");
  }

  if (!hydrated || !session || !profileSession || !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--emr-surface-muted)] px-6 text-foreground">
        <div className="rounded-[var(--clair-radius-lg)] border border-border bg-card px-6 py-5 text-center shadow-sm">
          <p className="text-[14px] font-semibold">프로필 확인 중</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            개인 설정을 불러옵니다.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-[var(--emr-surface-app)] px-5 py-8 text-foreground">
      <section className="mx-auto grid w-full max-w-[1120px] gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(440px,1fr)]">
        <div className="flex flex-col gap-5">
          <span className="flex size-11 items-center justify-center rounded-[var(--clair-radius-md)] bg-primary text-primary-foreground">
            <UserIcon aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[var(--emr-status-info-text)]">
              Personal profile
            </p>
            <h1 className="text-[32px] font-semibold leading-10 tracking-normal">
              개인 프로필 설정
            </h1>
            <p className="max-w-[560px] text-[15px] leading-7 text-muted-foreground">
              이름, 이니셜, 연락처처럼 본인이 관리해도 되는 표시 정보를 수정합니다.
              워크스페이스 역할과 권한은 멤버십 정책에서만 결정됩니다.
            </p>
          </div>
          <div className="rounded-[var(--clair-radius-md)] border border-border bg-card p-4 text-[13px] leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">권한 정보는 워크스페이스 멤버십에서 관리됩니다.</p>
            <p className="mt-1">
              현재 로그인 역할은 <strong className="font-semibold text-foreground">{profileSession.roleLabel}</strong>
              이며, 이 화면에서는 역할 변경이나 권한 상승을 할 수 없습니다.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--clair-radius-lg)] border border-border bg-card p-6 shadow-sm"
        >
          <FieldGroup>
            <div className="flex flex-col gap-1">
              <h2 className="text-[20px] font-semibold leading-7 tracking-normal">
                표시 정보
              </h2>
              <p className="text-[13px] leading-5 text-muted-foreground">
                변경 내용은 현재 브라우저의 session-only profile 저장소에만 기록됩니다.
              </p>
            </div>

            {saveMessage ? (
              <p
                role="status"
                className="rounded-[var(--clair-radius-md)] border border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] px-3 py-2 text-[13px] leading-5 text-[var(--emr-status-success-text)]"
              >
                {saveMessage}
              </p>
            ) : null}

            <Field>
              <FieldLabel htmlFor="profile-display-name">이름</FieldLabel>
              <Input
                id="profile-display-name"
                name="displayName"
                defaultValue={profile.displayName}
                aria-invalid={Boolean(fieldErrors.displayName)}
              />
              {fieldErrors.displayName ? (
                <p role="alert" className="text-[12px] text-[var(--emr-status-danger-text)]">
                  {fieldErrors.displayName}
                </p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-initials">이니셜</FieldLabel>
              <Input
                id="profile-initials"
                name="initials"
                defaultValue={profile.initials}
                aria-invalid={Boolean(fieldErrors.initials)}
                maxLength={6}
              />
              {fieldErrors.initials ? (
                <p role="alert" className="text-[12px] text-[var(--emr-status-danger-text)]">
                  {fieldErrors.initials}
                </p>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-phone">연락처</FieldLabel>
              <Input
                id="profile-phone"
                name="phone"
                defaultValue={profile.phone ?? ""}
                placeholder="010-0000-0000"
              />
            </Field>

            <Field orientation="horizontal" className="rounded-[var(--clair-radius-md)] border border-border bg-[var(--emr-surface-subpanel)] p-3">
              <input
                id="profile-notification"
                name="notificationOptIn"
                type="checkbox"
                defaultChecked={profile.notificationOptIn}
                className="peer mt-0.5 size-4 shrink-0 rounded-[4px] border border-input accent-primary"
              />
              <FieldContent>
                <FieldLabel htmlFor="profile-notification">운영 알림 받기</FieldLabel>
                <FieldDescription>
                  추후 초대, 권한 변경, 보안 알림을 받을지 정하는 placeholder입니다.
                </FieldDescription>
              </FieldContent>
            </Field>

            <div className="rounded-[var(--clair-radius-md)] border border-border bg-[var(--emr-surface-subpanel)] px-3 py-2 text-[12px] leading-5 text-muted-foreground">
              읽기 전용 권한: <strong className="font-semibold text-foreground">{profileSession.roleLabel}</strong>
              . 권한 변경은 병원구성원 관리에서 병원관리자가 수행합니다.
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <Link href={returnHref} className={buttonVariants({ variant: "outline" })}>
                워크스페이스로 돌아가기
              </Link>
              <Button type="submit">저장</Button>
            </div>
          </FieldGroup>
        </form>
      </section>
    </main>
  );
}
