"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { useAuthClient, type AuthSession } from "./auth-client";
import {
  notifyPersonalProfileChanged,
  createEmptyPersonalProfilesState,
  createPersonalProfileSession,
  derivePersonalProfileInitials,
  getSessionPersonalProfile,
  persistPersonalProfilesState,
  readPersonalProfilesState,
  upsertSessionPersonalProfile,
  validatePersonalProfileInput,
  type CurrentPersonalProfile,
} from "./personal-profile-session";
import {
  PersonalSettingsAvatar,
  savePersonalSettingsAvatar,
  type AvatarDraft,
} from "./personal-settings-avatar";
import { PersonalPasswordDialog } from "./personal-password-dialog";
import { useSessionWorkspaceDisplayName } from "./workspace-display";
import {
  DEFAULT_PREPARED_EMPTY_CLINIC_RECEPTION_HREF,
  resolveWorkspacePathname,
} from "@/lib/emr-domain/demo-workspaces";
import {
  NOTIFICATION_PREFERENCES_EVENT,
  notificationPreferenceCategories,
  parseNotificationPreferences,
  type NotificationPreferences,
} from "@/features/notifications/notification-preferences";
import type { StaffOperationalProfile } from "@/features/staff/server-operational-profile-core";
import { cn } from "@/lib/utils";

type Category = "profile" | "security" | "notifications";
const categories: { key: Category; label: string; description: string }[] = [
  {
    key: "profile",
    label: "프로필",
    description: "동료에게 표시되는 사진과 기본 정보를 관리합니다.",
  },
  {
    key: "security",
    label: "계정·보안",
    description: "로그인 정보와 계정 보안을 관리합니다.",
  },
  {
    key: "notifications",
    label: "알림",
    description: "현재 병원의 알림 표시 방법을 설정합니다.",
  },
];
export function safePersonalSettingsReturn(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return DEFAULT_PREPARED_EMPTY_CLINIC_RECEPTION_HREF;
  return value;
}
export function PersonalProfileSettings() {
  const params = useSearchParams();
  const { hydrated, session, hydrate } = useAuthClient();
  const returnHref = safePersonalSettingsReturn(params.get("returnTo"));
  const workspaceId = resolveWorkspacePathname(returnHref);
  const workspaceName = useSessionWorkspaceDisplayName(workspaceId);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  if (!hydrated || !session)
    return (
      <main className="grid min-h-svh place-items-center bg-[var(--emr-surface-2)]">
        <p role="status">개인 설정을 불러옵니다.</p>
      </main>
    );
  return (
    <PersonalSettingsForm
      key={`${session.id}:${workspaceId}`}
      session={session}
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      returnHref={returnHref}
    />
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="pb-2">
      <h2 className="flex h-[52px] items-center px-4 text-base font-semibold leading-6">
        {title}
      </h2>
      <Card className="gap-0 overflow-hidden rounded-xl border-0 bg-card py-0 shadow-[var(--clair-shadow-xs)] ring-1 ring-[var(--emr-border-default)]">
        {children}
      </Card>
    </section>
  );
}
function SettingsRow({
  label,
  description,
  children,
  fieldId,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  fieldId?: string;
}) {
  return (
    <>
      <div className="flex min-h-[85px] flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="min-w-0 text-sm font-medium leading-5 tracking-[.014em]">
          {fieldId ? <label htmlFor={fieldId}>{label}</label> : <p>{label}</p>}
          {description ? (
            <p className="mt-1 font-normal text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="w-full shrink-0 md:w-[320px]">{children}</div>
      </div>
      <Separator className="mx-4 !w-auto bg-[var(--emr-border-default)] last:hidden md:mx-6" />
    </>
  );
}
export function PersonalSettingsForm({
  session,
  workspaceId,
  workspaceName,
  returnHref,
}: {
  session: AuthSession;
  workspaceId: string;
  workspaceName: string;
  returnHref: string;
}) {
  const router = useRouter();
  const profileSession = useMemo(
    () => createPersonalProfileSession(session),
    [session],
  );
  const [category, setCategory] = useState<Category>("profile");
  const [profile, setProfile] = useState<CurrentPersonalProfile | null>(null);
  const [operational, setOperational] =
    useState<StaffOperationalProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [reload, setReload] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [avatar, setAvatar] = useState<AvatarDraft>({ url: null, file: null });
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [savedPreferences, setSavedPreferences] =
    useState<NotificationPreferences | null>(null);
  const [preferenceError, setPreferenceError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [pending, setPending] = useState<
    Category | "return" | "revert" | "recovery" | "reload" | null
  >(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const live = session.role === "supabase";
  const userId = live ? session.userId : session.id;
  const preferenceUrl = `/api/workspaces/${encodeURIComponent(workspaceId)}/members/me/notification-preferences`;
  const basicDirty =
    !!profile &&
    (displayName !== profile.displayName || phone !== (profile.phone ?? ""));
  const avatarDirty =
    !!profile &&
    (avatar.file !== null || avatar.url !== (profile.avatarUrl ?? null));
  const statusDirty =
    !!operational && statusMessage !== (operational.statusMessage ?? "");
  const dirty =
    category === "profile"
      ? basicDirty || avatarDirty || statusDirty
      : category === "notifications" &&
        JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        let loaded: CurrentPersonalProfile;
        if (live) {
          const response = await fetch("/api/users/me/profile", {
            cache: "no-store",
            signal: controller.signal,
          });
          const result = await response.json();
          if (!response.ok || !result.ok || !result.profile) throw new Error();
          loaded = result.profile;
        } else {
          loaded = getSessionPersonalProfile(
            readPersonalProfilesState(
              window.sessionStorage,
              window.localStorage,
            ),
            profileSession,
          );
        }
        if (controller.signal.aborted) return;
        setProfile(loaded);
        setDisplayName(loaded.displayName);
        setPhone(loaded.phone ?? "");
        setAvatar({ url: loaded.avatarUrl ?? null, file: null });
        setProfileError("");
      } catch {
        if (!controller.signal.aborted)
          setProfileError("프로필을 불러오지 못했습니다.");
      }
    }
    void load();
    return () => controller.abort();
  }, [live, profileSession, reload]);
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    const date = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Seoul",
    });
    void fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/staff/${encodeURIComponent(userId)}/operational-profile?date=${date}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error();
        if (!controller.signal.aborted) {
          setOperational(body.profile);
          setStatusMessage(body.profile.statusMessage ?? "");
          setWorkspaceError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setWorkspaceError("병원 소속 정보를 불러오지 못했습니다.");
      });
    void fetch(preferenceUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        const parsed = parseNotificationPreferences(body.preferences);
        if (!response.ok || !body.ok || !parsed) throw new Error();
        if (!controller.signal.aborted) {
          setPreferences(parsed);
          setSavedPreferences(parsed);
          setPreferenceError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPreferenceError("알림 설정을 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [live, preferenceUrl, reload, userId, workspaceId]);
  useEffect(() => {
    if (!dirty && !saving) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, saving]);
  function revert() {
    if (category === "profile" && profile) {
      setDisplayName(profile.displayName);
      setPhone(profile.phone ?? "");
      setAvatar({ url: profile.avatarUrl ?? null, file: null });
      setStatusMessage(operational?.statusMessage ?? "");
    }
    if (category === "notifications") setPreferences(savedPreferences);
    setFieldErrors({});
    setNotice("");
  }
  function navigate(target: Exclude<typeof pending, null>) {
    if (saving) return;
    if (dirty) {
      setPending(target);
      return;
    }
    finishNavigation(target);
  }
  function finishNavigation(target: Exclude<typeof pending, null>) {
    if (target === "return") router.push(returnHref);
    else if (target === "recovery") router.push("/reset-password");
    else if (target === "reload") setReload((value) => value + 1);
    else if (target !== "revert") {
      setCategory(target);
      setNotice("");
      requestAnimationFrame(() => heading.current?.focus());
    }
  }
  async function save() {
    if (saving || !dirty || !profile) return;
    setNotice("");
    setFieldErrors({});
    const input = {
      displayName,
      phone,
      initials: derivePersonalProfileInitials(displayName),
      notificationOptIn: profile.notificationOptIn,
    };
    if (category === "profile") {
      const validation = validatePersonalProfileInput(input);
      const errors: Record<string, string | undefined> = {
        ...validation.fieldErrors,
      };
      if ([...statusMessage.trim()].length > 60)
        errors.statusMessage = "상태 메시지는 60자 이내로 입력해 주세요.";
      if (Object.keys(errors).length) {
        setFieldErrors(errors);
        requestAnimationFrame(() =>
          document
            .getElementById(
              errors.displayName
                ? "profile-display-name"
                : errors.phone
                  ? "profile-phone"
                  : "profile-status-message",
            )
            ?.focus(),
        );
        return;
      }
    }
    setSaving(true);
    const failed: string[] = [];
    let succeeded = 0;
    try {
      if (category === "notifications" && preferences) {
        const response = await fetch(preferenceUrl, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(preferences),
        });
        const result = await response.json();
        const parsed = parseNotificationPreferences(result.preferences);
        if (!response.ok || !result.ok || !parsed) throw new Error();
        setPreferences(parsed);
        setSavedPreferences(parsed);
        window.dispatchEvent(new Event(NOTIFICATION_PREFERENCES_EVENT));
        succeeded++;
      } else if (category === "profile") {
        if (basicDirty) {
          try {
            const response = await fetch("/api/users/me/profile", {
              method: "PATCH",
              headers: {
                "content-type": "application/json",
                ...(live ? {} : { "x-clair-demo-session-user-id": session.id }),
              },
              body: JSON.stringify(input),
            });
            const result = await response.json();
            if (!response.ok || !result.ok || !result.profile) {
              setFieldErrors(result.fieldErrors ?? {});
              throw new Error();
            }
            const saved = result.profile;
            setProfile((current) =>
              current ? { ...current, ...saved } : saved,
            );
            setDisplayName(saved.displayName);
            setPhone(saved.phone ?? "");
            try {
              const state =
                readPersonalProfilesState(
                  window.sessionStorage,
                  window.localStorage,
                ) ?? createEmptyPersonalProfilesState();
              persistPersonalProfilesState(
                upsertSessionPersonalProfile(state, profileSession, {
                  ...saved,
                  phone: saved.phone ?? "",
                }),
                profileSession.storageMode,
                window.sessionStorage,
                window.localStorage,
              );
            } catch {
              /* Browser cache failure does not undo the confirmed server write. */
            }
            notifyPersonalProfileChanged();
            succeeded++;
          } catch {
            failed.push("이름·연락처");
          }
        }
        if (avatarDirty) {
          try {
            const url = await savePersonalSettingsAvatar(workspaceId, avatar);
            setAvatar({ url, file: null });
            setProfile((current) =>
              current ? { ...current, avatarUrl: url ?? undefined } : current,
            );
            notifyPersonalProfileChanged();
            succeeded++;
          } catch {
            failed.push("프로필 사진");
          }
        }
        if (statusDirty && operational) {
          try {
            const response = await fetch(
              `/api/workspaces/${encodeURIComponent(workspaceId)}/members/me/status-message`,
              {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  message: statusMessage,
                  expectedUpdatedAt: operational.statusMessageUpdatedAt ?? null,
                }),
              },
            );
            const result = await response.json();
            if (!response.ok || !result.ok) {
              if (response.status === 409)
                setFieldErrors({
                  statusMessage:
                    "다른 화면에서 변경되었습니다. 현재 내용을 복사한 뒤 새로 불러와 주세요.",
                });
              throw new Error();
            }
            setOperational((current) =>
              current
                ? {
                    ...current,
                    statusMessage: result.message ?? "",
                    statusMessageUpdatedAt: result.updatedAt ?? undefined,
                  }
                : current,
            );
            setStatusMessage(result.message ?? "");
            notifyPersonalProfileChanged();
            succeeded++;
          } catch {
            failed.push("상태 메시지");
          }
        }
      }
      setNotice(
        failed.length
          ? `${succeeded ? "일부 항목은 저장되었습니다. " : ""}${failed.join(", ")} 저장에 실패했습니다. 다시 저장하면 남은 변경사항만 재시도합니다.`
          : "변경사항을 저장했습니다.",
      );
    } catch {
      setNotice(
        "저장하지 못했습니다. 변경사항을 유지했으니 다시 시도해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  }
  const selected = categories.find((item) => item.key === category)!;
  return (
    <main className="grid min-h-svh bg-[var(--emr-surface-2)] text-foreground lg:h-svh lg:grid-cols-[240px_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="border-b border-[var(--emr-border-default)] bg-card p-4 lg:border-r lg:border-b-0">
        <Button
          variant="ghost"
          className="w-full justify-start"
          disabled={saving}
          onClick={() => navigate("return")}
        >
          <ChevronLeftIcon aria-hidden="true" />{" "}
          <span className="truncate">{workspaceName}</span>
        </Button>
        <p className="mt-6 px-3 text-xs font-medium text-muted-foreground">
          개인 설정
        </p>
        <nav aria-label="개인 설정" className="mt-3 flex gap-1 lg:flex-col">
          {categories.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-current={category === item.key ? "page" : undefined}
              disabled={saving}
              onClick={() => navigate(item.key)}
              className={cn(
                "min-h-10 rounded-md px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                category === item.key
                  ? "bg-[var(--emr-state-selected)]"
                  : "hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 overflow-y-auto pb-28">
        <EmrMainContentHeader heightMode="adaptive" />
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 md:px-0">
          <header className="flex min-h-[92px] flex-col justify-center gap-2 p-4">
            <h1
              ref={heading}
              tabIndex={-1}
              className="text-2xl font-semibold leading-8 outline-none"
            >
              {selected.label}
            </h1>
            <p className="text-sm leading-5 text-muted-foreground">
              {selected.description}
            </p>
          </header>
          {notice ? (
            <p
              role="status"
              className="mx-4 rounded-md border border-border bg-card p-3 text-sm"
            >
              {notice}
            </p>
          ) : null}
          {profileError ? (
            <div role="alert" className="p-4">
              {profileError}
              <Button
                variant="outline"
                onClick={() => setReload((value) => value + 1)}
              >
                다시 불러오기
              </Button>
            </div>
          ) : !profile ? (
            <p role="status" className="p-4">
              프로필을 불러옵니다.
            </p>
          ) : (
            <>
              {category === "profile" ? (
                <>
                  <SettingsSection title="기본 정보">
                    <SettingsRow
                      label="프로필 사진"
                      description="동료에게 표시되는 사진입니다."
                    >
                      <PersonalSettingsAvatar
                        value={avatar}
                        initials={derivePersonalProfileInitials(displayName)}
                        disabled={saving || !live || !operational}
                        onChange={setAvatar}
                      />
                    </SettingsRow>
                    <SettingsRow
                      label="이름"
                      fieldId="profile-display-name"
                      description="모든 소속 병원에 함께 적용됩니다."
                    >
                      <Input
                        id="profile-display-name"
                        value={displayName}
                        disabled={saving}
                        aria-invalid={!!fieldErrors.displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                      {fieldErrors.displayName ? (
                        <p
                          role="alert"
                          className="mt-1 text-xs text-destructive"
                        >
                          {fieldErrors.displayName}
                        </p>
                      ) : null}
                    </SettingsRow>
                    <SettingsRow label="연락처" fieldId="profile-phone">
                      <Input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        disabled={saving}
                        aria-invalid={!!fieldErrors.phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      {fieldErrors.phone ? (
                        <p
                          role="alert"
                          className="mt-1 text-xs text-destructive"
                        >
                          {fieldErrors.phone}
                        </p>
                      ) : null}
                    </SettingsRow>
                    <SettingsRow
                      label="상태 메시지"
                      fieldId="profile-status-message"
                      description="현재 병원의 동료에게만 표시됩니다."
                    >
                      <Input
                        id="profile-status-message"
                        value={statusMessage}
                        disabled={saving || !operational}
                        aria-invalid={!!fieldErrors.statusMessage}
                        onChange={(e) => setStatusMessage(e.target.value)}
                      />
                      <p className="mt-1 text-right text-xs text-muted-foreground">
                        {[...statusMessage].length}/60
                      </p>
                      {fieldErrors.statusMessage ? (
                        <p role="alert" className="text-xs text-destructive">
                          {fieldErrors.statusMessage}
                        </p>
                      ) : null}
                    </SettingsRow>
                  </SettingsSection>
                  <SettingsSection title="소속 정보">
                    <SettingsRow label="병원">
                      <p className="text-sm">{workspaceName}</p>
                    </SettingsRow>
                    <SettingsRow label="직책">
                      <p className="text-sm">
                        {operational
                          ? operational.jobPositionLabel ||
                            operational.title ||
                            "등록되지 않았습니다."
                          : "소속 정보 확인이 필요합니다."}
                      </p>
                    </SettingsRow>
                    <SettingsRow label="부서">
                      <p className="text-sm">
                        {operational
                          ? operational.department || "등록되지 않았습니다."
                          : "소속 정보 확인이 필요합니다."}
                      </p>
                    </SettingsRow>
                  </SettingsSection>
                  {fieldErrors.statusMessage?.startsWith("다른 화면") ? (
                    <Button
                      className="mx-4 w-fit"
                      variant="outline"
                      disabled={saving}
                      onClick={() => navigate("reload")}
                    >
                      최신 정보 다시 불러오기
                    </Button>
                  ) : null}
                  {workspaceError ? (
                    <p role="alert" className="px-4 text-sm">
                      {workspaceError}
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => navigate("reload")}
                      >
                        다시 불러오기
                      </Button>
                    </p>
                  ) : null}
                  {!live ? (
                    <p className="px-4 text-sm text-muted-foreground">
                      사진과 병원별 상태는 연결된 계정에서 관리할 수 있습니다.
                    </p>
                  ) : null}
                </>
              ) : category === "security" ? (
                <SettingsSection title="로그인 정보">
                  <SettingsRow
                    label="이메일"
                    description="로그인에 사용하는 이메일입니다."
                  >
                    <p className="break-all text-sm">
                      {profileSession.email ?? "이메일이 없습니다."}
                    </p>
                  </SettingsRow>
                  <SettingsRow
                    label="비밀번호"
                    description="변경 후 다시 로그인해 주세요."
                  >
                    <PersonalPasswordDialog disabled={!live || saving} />
                  </SettingsRow>
                  <SettingsRow
                    label="비밀번호를 잊으셨나요?"
                    description="이메일로 재설정 안내를 받을 수 있습니다."
                  >
                    <Button
                      variant="outline"
                      disabled={!live || saving}
                      onClick={() => navigate("recovery")}
                    >
                      비밀번호 재설정
                    </Button>
                  </SettingsRow>
                </SettingsSection>
              ) : (
                <>
                  <p className="px-4 text-sm text-muted-foreground">
                    {workspaceName}에만 적용됩니다. 알림함의 기록은 유지되며,
                    긴급 알림은 설정과 관계없이 표시됩니다.
                  </p>
                  {!live ? (
                    <p className="px-4 text-sm">
                      알림 설정은 연결된 계정에서 관리할 수 있습니다.
                    </p>
                  ) : preferenceError ? (
                    <div role="alert" className="px-4 text-sm">
                      {preferenceError}
                      <Button
                        variant="outline"
                        disabled={dirty}
                        onClick={() => setReload((value) => value + 1)}
                      >
                        다시 불러오기
                      </Button>
                    </div>
                  ) : !preferences ? (
                    <p role="status" className="px-4">
                      알림 설정을 불러옵니다.
                    </p>
                  ) : (
                    <>
                      <SettingsSection title="알림 종류">
                        {notificationPreferenceCategories.map((item) => (
                          <SettingsRow
                            key={item.key}
                            label={item.label}
                            description={item.description}
                            fieldId={`notification-${item.key}`}
                          >
                            <div className="flex md:justify-end">
                              <Switch
                                id={`notification-${item.key}`}
                                checked={preferences.categories[item.key]}
                                disabled={saving}
                                onCheckedChange={(checked) =>
                                  setPreferences({
                                    ...preferences,
                                    categories: {
                                      ...preferences.categories,
                                      [item.key]: checked,
                                    },
                                  })
                                }
                              />
                            </div>
                          </SettingsRow>
                        ))}
                      </SettingsSection>
                      <SettingsSection title="알림 방식">
                        <SettingsRow
                          label="화면 알림"
                          fieldId="notification-popup"
                          description="새 알림을 화면에 표시합니다."
                        >
                          <div className="flex md:justify-end">
                            <Switch
                              id="notification-popup"
                              checked={preferences.popup}
                              disabled={saving}
                              onCheckedChange={(popup) =>
                                setPreferences({ ...preferences, popup })
                              }
                            />
                          </div>
                        </SettingsRow>
                        <SettingsRow
                          label="알림 소리"
                          fieldId="notification-sound"
                          description="브라우저에서 화면을 조작한 뒤 소리가 재생됩니다."
                        >
                          <div className="flex md:justify-end">
                            <Switch
                              id="notification-sound"
                              checked={preferences.sound}
                              disabled={saving}
                              onCheckedChange={(sound) =>
                                setPreferences({ ...preferences, sound })
                              }
                            />
                          </div>
                        </SettingsRow>
                      </SettingsSection>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {dirty ? (
        <div className="fixed right-4 bottom-4 left-4 z-30 lg:left-[256px]">
          <div className="mx-auto flex max-w-[808px] items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-lg">
            <p className="text-sm">저장하지 않은 변경사항이 있습니다.</p>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => setPending("revert")}
              >
                되돌리기
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void save()}>
                {saving ? "저장 중" : "저장"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <EmrConfirmDialogContent
          title="변경사항을 되돌릴까요?"
          description="저장하지 않은 변경사항을 되돌립니다. 이미 저장된 항목은 유지됩니다."
          cancelLabel="계속 편집"
          confirmLabel="변경사항 되돌리기"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const target = pending;
            revert();
            setPending(null);
            if (target) finishNavigation(target);
          }}
        />
      </Dialog>
    </main>
  );
}
