"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CdsActionsCopyIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import {
  CdsCommunicationMailIcon,
  CdsCommunicationPhoneIcon,
} from "@/components/cds-icons/communication-and-media";
import { CdsFilesCalendarIcon } from "@/components/cds-icons/files-and-layout";
import { CdsMedicalStethoscopeIcon } from "@/components/cds-icons/medical-and-domain";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tab, TabGroup, TabPanel, TabsList } from "@/components/ui/tabs";
import {
  EditableProfileAvatar,
  PresenceBadge,
  ProfileHeaderActionMenu,
} from "@/features/staff/components/profile-side-panel-v2-header";
import { ProfileAvailabilitySummary } from "@/features/staff/components/profile-side-panel-v2-profile";
import {
  ProfileWorkStatusTab,
  WorkNavigationDialog,
  type ProfileAssignedWorkItem,
  type ProfileWorkDateGroup,
} from "@/features/staff/components/profile-side-panel-v2-work";
import type {
  StaffOperationalAvailability,
  StaffOperationalProfile,
  StaffOperationalProfileCapabilities,
  StaffOperationalShift,
} from "@/features/staff/server-operational-profile-core";
import type { StaffAssignedWorkItem } from "@/features/staff/server-staff-assigned-work-items-core";
import {
  formatStaffLastSeenLabel,
  useWorkspaceStaffPresenceState,
} from "@/features/staff/workspace-staff-presence";

type StaffOperationalProfileResponse =
  | {
      ok: true;
      availability: StaffOperationalAvailability | null;
      capabilities: StaffOperationalProfileCapabilities;
      profile: StaffOperationalProfile;
      shift: StaffOperationalShift | null;
      sectionErrors?: {
        availability?: "schedule_read_failed";
        shift?: "schedule_read_failed";
      };
    }
  | { ok: false; error?: string; denialReason?: string };

type StaffAssignedWorkItemsResponse =
  | {
      ok: true;
      items: StaffAssignedWorkItem[];
      nextCursor: string | null;
      timezone: string;
    }
  | { ok: false; error?: string; denialReason?: string };

type WorkReadState = {
  items: StaffAssignedWorkItem[];
  loadingNextPage: boolean;
  nextCursor: string | null;
  nextPageError: boolean;
  state: "idle" | "loading" | "ready" | "error";
  timezone: string | null;
};

const initialWorkReadState: WorkReadState = {
  items: [],
  loadingNextPage: false,
  nextCursor: null,
  nextPageError: false,
  state: "idle",
  timezone: null,
};

export function StaffOperationalProfilePanel({
  actorUserId,
  currentMinutes,
  onClose,
  todayDate,
  userId,
  workspaceId,
}: {
  actorUserId?: string;
  currentMinutes: number;
  date: string;
  onClose: () => void;
  todayDate: string;
  userId: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "work">("profile");
  const [loadResult, setLoadResult] = useState<{
    key: string;
    response: Extract<StaffOperationalProfileResponse, { ok: true }> | null;
    state: "ready" | "error";
  } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [workRead, setWorkRead] = useState<WorkReadState>(initialWorkReadState);
  const [navigationItem, setNavigationItem] =
    useState<ProfileAssignedWorkItem | null>(null);
  const presence = useWorkspaceStaffPresenceState({ userId, workspaceId });

  const loadProfile = useCallback(
    () => setRetryNonce((value) => value + 1),
    [],
  );
  const requestKey = `${workspaceId}:${userId}:${todayDate}:${retryNonce}`;
  const requestState =
    loadResult?.key === requestKey
      ? loadResult.state === "ready"
        ? "idle"
        : "error"
      : "loading";
  const response =
    loadResult?.key === requestKey && loadResult.state === "ready"
      ? loadResult.response
      : null;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/staff/${encodeURIComponent(userId)}/operational-profile?date=${encodeURIComponent(todayDate)}`,
      {
        cache: "no-store",
        headers: actorUserId
          ? { "x-clair-demo-session-user-id": actorUserId }
          : undefined,
        signal: controller.signal,
      },
    )
      .then(async (result) => {
        const body = (await result.json()) as StaffOperationalProfileResponse;
        if (!result.ok || !body.ok) throw new Error("profile_read_failed");
        setLoadResult({ key: requestKey, response: body, state: "ready" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadResult({ key: requestKey, response: null, state: "error" });
      });
    return () => controller.abort();
  }, [actorUserId, requestKey, todayDate, userId, workspaceId]);

  const loadWorkPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      setWorkRead((current) => ({
        ...current,
        ...(append
          ? { loadingNextPage: true, nextPageError: false }
          : { state: "loading", nextPageError: false }),
      }));
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      try {
        const result = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/staff/${encodeURIComponent(userId)}/work-items${params.size ? `?${params.toString()}` : ""}`,
          {
            cache: "no-store",
            headers: actorUserId
              ? { "x-clair-demo-session-user-id": actorUserId }
              : undefined,
          },
        );
        const body = (await result.json()) as StaffAssignedWorkItemsResponse;
        if (!result.ok || !body.ok) throw new Error("work_items_read_failed");
        setWorkRead((current) => ({
          items: append
            ? mergeWorkItems(current.items, body.items)
            : body.items,
          loadingNextPage: false,
          nextCursor: body.nextCursor,
          nextPageError: false,
          state: "ready",
          timezone: body.timezone,
        }));
      } catch {
        setWorkRead((current) =>
          append
            ? {
                ...current,
                loadingNextPage: false,
                nextPageError: true,
              }
            : { ...initialWorkReadState, state: "error" },
        );
      }
    },
    [actorUserId, userId, workspaceId],
  );

  const profile = response?.profile;
  const workGroups = useMemo(
    () =>
      buildWorkGroups(
        workRead.items,
        workRead.timezone,
        todayDate,
      ),
    [todayDate, workRead.items, workRead.timezone],
  );

  const navigate = (href: string | null | undefined) => {
    if (!href) return;
    router.push(href);
  };

  return (
    <section
      aria-label="직원 운영 프로필"
      className="h-full min-h-0 bg-[var(--emr-surface-rightpanel)]"
      data-testid="staff-operational-profile-panel"
    >
      <TabGroup
        value={activeTab}
        className="h-full min-h-0 gap-0"
        onValueChange={(value) => {
          const nextTab = value === "work" ? "work" : "profile";
          setActiveTab(nextTab);
          if (nextTab === "work" && workRead.state === "idle") {
            void loadWorkPage(null, false);
          }
        }}
      >
        <header className="relative h-[var(--emr-profile-header-height)] shrink-0 border-b border-[var(--emr-border-default)] px-4 pt-3">
          {profile ? (
            <ProfileHeader
              presence={presence}
              profile={profile}
            />
          ) : (
            <ProfileHeaderSkeleton />
          )}
          <div className="absolute right-3 top-3 flex gap-1">
            {profile && response ? (
              <ProfileHeaderActionMenu
                canManageMember={response.capabilities.canManageMember}
                canViewSchedule={Boolean(response.capabilities.scheduleHref)}
                hasContact={Boolean(profile.email || profile.phone)}
                onCopyContact={() => void copyContact(profile)}
                onManageMember={() => navigate(response.capabilities.manageMemberHref)}
                onOpenSchedule={() => navigate(response.capabilities.scheduleHref)}
              />
            ) : null}
            <Button
              ref={closeButtonRef}
              type="button"
              aria-label="직원 운영 프로필 닫기"
              size="icon-sm"
              variant="ghost"
              onClick={onClose}
            >
              <CdsActionsXIcon aria-hidden="true" size={16} />
            </Button>
          </div>
          <TabsList
            activateOnFocus
            aria-label="직원 프로필 탭"
            className="absolute bottom-0 left-4 right-4 w-auto"
            variant="line"
          >
            <Tab value="profile">프로필</Tab>
            <Tab value="work">업무 현황</Tab>
          </TabsList>
        </header>

        <TabPanel className="min-h-0 overflow-y-auto p-4" value="profile">
          {requestState === "loading" ? (
            <ProfileLoadingState />
          ) : requestState === "error" ? (
            <EmrInlineAlert
              severity="error"
              title="운영 프로필을 불러오지 못했어요"
              action={
                <Button type="button" size="sm" variant="outline" onClick={loadProfile}>
                  다시 시도
                </Button>
              }
            >
              직원 정보 원본을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.
            </EmrInlineAlert>
          ) : profile && response ? (
            <div className="grid gap-5">
              <AccountInformation profile={profile} />
              <TodayShiftSection
                currentMinutes={currentMinutes}
                error={Boolean(response.sectionErrors?.shift)}
                onRetry={loadProfile}
                shift={response.shift}
                todayDate={todayDate}
              />
              <section aria-labelledby="staff-availability-heading">
                <SectionTitle id="staff-availability-heading">
                  다가오는 부재와 다음 복귀
                </SectionTitle>
                <div className="mt-2.5">
                  <ProfileAvailabilitySummary
                    eventLabel={formatAvailabilityEvent(response.availability)}
                    onRetry={loadProfile}
                    returnLabel={formatAvailabilityReturn(response.availability)}
                    state={
                      response.sectionErrors?.availability
                        ? "error"
                        : response.availability
                          ? "ready"
                          : "empty"
                    }
                  />
                </div>
              </section>
            </div>
          ) : null}
        </TabPanel>

        <TabPanel className="min-h-0 overflow-y-auto p-4" value="work">
          <ProfileWorkStatusTab
            groups={workGroups}
            hasNextPage={Boolean(workRead.nextCursor)}
            loadingNextPage={workRead.loadingNextPage}
            nextPageError={workRead.nextPageError}
            state={
              workRead.state === "idle" || workRead.state === "loading"
                ? "loading"
                : workRead.state === "error"
                  ? "error"
                  : workRead.items.length === 0
                    ? "empty"
                    : "ready"
            }
            onLoadMore={() =>
              void loadWorkPage(workRead.nextCursor, true)
            }
            onRequestNavigation={setNavigationItem}
            onRetry={() => void loadWorkPage(null, false)}
            onRetryNextPage={() =>
              void loadWorkPage(workRead.nextCursor, true)
            }
          />
        </TabPanel>
      </TabGroup>

      <WorkNavigationDialog
        item={navigationItem}
        open={Boolean(navigationItem)}
        onConfirm={(item) => {
          setNavigationItem(null);
          navigate(item.href);
        }}
        onOpenChange={(open) => !open && setNavigationItem(null)}
      />
    </section>
  );
}

function ProfileHeader({
  presence,
  profile,
}: {
  presence: "online" | "offline" | "unknown";
  profile: StaffOperationalProfile;
}) {
  const secondary = [profile.jobPositionLabel, profile.department]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-start gap-3 pr-20">
      <EditableProfileAvatar
        alt={profile.displayName}
        editable={false}
        initials={profile.initials ?? profile.displayName.slice(0, 2)}
        src={profile.avatarUrl}
      />
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate text-lg font-semibold text-[var(--emr-text-primary)]">
            {profile.displayName}
          </h2>
          <PresenceBadge state={presence} />
        </div>
        <p className="mt-1 truncate text-sm text-[var(--emr-text-secondary)]">
          {secondary || "등록 정보 없음"}
        </p>
        <p className="mt-1 truncate text-xs text-[var(--emr-text-tertiary)]">
          {presence === "online"
            ? "접속 중"
            : presence === "unknown"
              ? "접속 상태를 확인할 수 없음"
              : formatStaffLastSeenLabel(profile.lastSeenAt)}
        </p>
      </div>
    </div>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-start gap-3 pr-20">
      <Skeleton className="size-[var(--emr-profile-avatar-size)] shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function ProfileLoadingState() {
  return (
    <div
      aria-live="polite"
      className="space-y-4"
      data-testid="staff-operational-profile-loading"
    >
      <span className="sr-only">직원 운영 프로필 불러오는 중</span>
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-[72px] w-full rounded-xl" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

function SectionTitle({ children, id }: { children: string; id: string }) {
  return (
    <h3
      className="flex h-6 items-center text-sm font-medium text-[var(--emr-text-secondary)]"
      id={id}
    >
      {children}
    </h3>
  );
}

function AccountInformation({ profile }: { profile: StaffOperationalProfile }) {
  return (
    <section aria-labelledby="staff-account-heading">
      <SectionTitle id="staff-account-heading">계정 정보</SectionTitle>
      <dl className="mt-2.5 grid gap-2 rounded-xl border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] p-3 text-sm">
        <AccountRow
          icon={CdsPeopleUserIcon}
          label="역할"
          value={profile.jobPositionLabel}
        />
        <AccountRow
          icon={CdsMedicalStethoscopeIcon}
          label="진료과"
          value={profile.department}
        />
        <AccountRow
          copyLabel="이메일 복사"
          icon={CdsCommunicationMailIcon}
          label="이메일"
          value={profile.email}
        />
        <AccountRow
          copyLabel="전화번호 복사"
          icon={CdsCommunicationPhoneIcon}
          label="전화번호"
          value={profile.phone}
        />
      </dl>
    </section>
  );
}

function AccountRow({
  copyLabel,
  icon: Icon,
  label,
  value,
}: {
  copyLabel?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean; size?: number }>;
  label: string;
  value?: string;
}) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)_24px] items-center gap-2">
      <dt className="flex items-center gap-2 text-[var(--emr-text-tertiary)]">
        <Icon aria-hidden={true} size={15} />
        {label}
      </dt>
      <dd className="min-w-0 truncate font-medium text-[var(--emr-text-primary)]" title={value}>
        {value || "미등록"}
      </dd>
      <dd>
        {value && copyLabel ? (
          <Button
            type="button"
            aria-label={copyLabel}
            size="icon-xs"
            variant="ghost"
            onClick={() => void copyValue(value, label)}
          >
            <CdsActionsCopyIcon aria-hidden="true" size={14} />
          </Button>
        ) : null}
      </dd>
    </div>
  );
}

function TodayShiftSection({
  currentMinutes,
  error,
  onRetry,
  shift,
  todayDate,
}: {
  currentMinutes: number;
  error: boolean;
  onRetry: () => void;
  shift: StaffOperationalShift | null;
  todayDate: string;
}) {
  return (
    <section aria-labelledby="staff-shift-heading">
      <SectionTitle id="staff-shift-heading">오늘 근무 정보</SectionTitle>
      <div className="mt-2.5">
        {error ? (
          <EmrInlineAlert
            severity="error"
            title="오늘 근무를 불러오지 못했어요"
            action={
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                다시 시도
              </Button>
            }
          >
            조회 실패를 휴무로 표시하지 않았어요.
          </EmrInlineAlert>
        ) : shift ? (
          <ShiftSummary
            currentMinutes={currentMinutes}
            shift={shift}
            todayDate={todayDate}
          />
        ) : (
          <p className="rounded-xl border border-[var(--emr-border-default)] p-3 text-sm text-[var(--emr-text-tertiary)]">
            오늘 게시된 근무가 없어요
          </p>
        )}
      </div>
    </section>
  );
}

function ShiftSummary({
  currentMinutes,
  shift,
  todayDate,
}: {
  currentMinutes: number;
  shift: StaffOperationalShift;
  todayDate: string;
}) {
  const state = getShiftStateLabel({ currentMinutes, shift, todayDate });
  const kindLabel =
    shift.kind === "leave"
      ? "휴가"
      : shift.kind === "off"
        ? "휴무"
        : shift.workLabel;
  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-xl border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] p-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--emr-surface-muted)] text-[var(--emr-text-tertiary)]">
        <CdsFilesCalendarIcon aria-hidden="true" size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium tabular-nums text-[var(--emr-text-primary)]">
          {formatMinutes(shift.startMinutes)}–{formatMinutes(shift.endMinutes)}
        </p>
        <p className="mt-1 truncate text-sm text-[var(--emr-text-secondary)]">
          {[state, kindLabel, shift.locationLabel].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function buildWorkGroups(
  items: StaffAssignedWorkItem[],
  timezone: string | null,
  todayDate: string,
): ProfileWorkDateGroup[] {
  const groups = new Map<string, ProfileAssignedWorkItem[]>();
  for (const item of items) {
    const existing = groups.get(item.operatingDate) ?? [];
    existing.push({
      category: item.category,
      categoryLabel: item.categoryLabel,
      guardianName: item.guardianName,
      href: item.href,
      id: item.id,
      navigationAvailable: Boolean(item.href),
      patientName: item.patientName,
      requestedAtLabel: formatRequestedAt(item.requestedAt, timezone),
      requestedByName: item.requestedByName,
      status: item.status,
      statusLabel: item.statusLabel,
      subtitle: item.description,
      title: item.title,
    });
    groups.set(item.operatingDate, existing);
  }
  return Array.from(groups, ([date, groupedItems]) => ({
    dateLabel: date === todayDate ? "오늘" : formatDateLabel(date),
    items: groupedItems,
  }));
}

function mergeWorkItems(
  current: StaffAssignedWorkItem[],
  next: StaffAssignedWorkItem[],
) {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !ids.has(item.id))];
}

function formatAvailabilityEvent(
  availability: StaffOperationalAvailability | null,
) {
  if (!availability) return undefined;
  return `${formatDateLabel(availability.event.date)} ${availability.event.kind === "leave" ? "휴가" : "휴무"}`;
}

function formatAvailabilityReturn(
  availability: StaffOperationalAvailability | null,
) {
  if (!availability?.returnShift) return undefined;
  return `${formatDateLabel(availability.returnShift.date)} ${formatMinutes(availability.returnShift.startMinutes)} 복귀`;
}

function formatDateLabel(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function formatRequestedAt(value: string, timezone: string | null) {
  if (!timezone) return "요청 시각 확인 불가";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function getShiftStateLabel({
  currentMinutes,
  shift,
  todayDate,
}: {
  currentMinutes: number;
  shift: StaffOperationalShift;
  todayDate: string;
}) {
  if (shift.kind === "leave") return "휴가";
  if (shift.kind === "off") return "휴무";
  if (shift.date < todayDate) return "근무 종료";
  if (shift.date > todayDate) return "근무 예정";
  if (currentMinutes < shift.startMinutes) return "근무 전";
  if (currentMinutes >= shift.endMinutes) return "근무 종료";
  return "근무 중";
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

async function copyContact(profile: StaffOperationalProfile) {
  const contact = [profile.email, profile.phone].filter(Boolean).join("\n");
  if (!contact) return;
  await copyValue(contact, "연락처");
}

async function copyValue(value: string, label: string) {
  try {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("clipboard_write_failed");
    }
    toast.success(`${label}을 복사했어요`);
  } catch {
    toast.error(`${label}을 복사하지 못했어요`);
  }
}
