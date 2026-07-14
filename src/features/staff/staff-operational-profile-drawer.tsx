"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { toast } from "sonner";
import { CdsActionsCopyIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import {
  CdsCommunicationMailIcon,
  CdsCommunicationPhoneIcon,
} from "@/components/cds-icons/communication-and-media";
import {
  CdsFilesCalendarIcon,
  CdsFilesFileTextIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tab,
  TabGroup,
  TabPanel,
  TabsList,
} from "@/components/ui/tabs";
import type {
  StaffOperationalProfile,
  StaffOperationalShift,
} from "@/features/staff/server-operational-profile-core";
import {
  formatStaffLastSeenLabel,
  useWorkspaceStaffOnlineStatus,
} from "@/features/staff/workspace-staff-presence";

type StaffOperationalProfileResponse =
  | {
      ok: true;
      profile: StaffOperationalProfile;
      shift: StaffOperationalShift | null;
      sectionErrors?: { shift?: "schedule_read_failed" };
    }
  | { ok: false; error?: string; denialReason?: string };

export function StaffOperationalProfilePanel({
  actorUserId,
  currentMinutes,
  date,
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loadResult, setLoadResult] = useState<{
    key: string;
    response: Extract<StaffOperationalProfileResponse, { ok: true }> | null;
    state: "ready" | "error";
  } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const online = useWorkspaceStaffOnlineStatus({ userId, workspaceId });

  const loadProfile = useCallback(
    () => setRetryNonce((value) => value + 1),
    [],
  );
  const requestKey = `${workspaceId}:${userId}:${date}:${retryNonce}`;
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
      `/api/workspaces/${encodeURIComponent(workspaceId)}/staff/${encodeURIComponent(userId)}/operational-profile?date=${encodeURIComponent(date)}`,
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
  }, [actorUserId, date, requestKey, userId, workspaceId]);

  const profile = response?.profile;
  const shift = response?.shift ?? null;
  const shiftSectionTitle =
    date === todayDate ? "오늘 근무 정보" : formatDateSection(date);

  return (
    <section
      aria-label="직원 운영 프로필"
      className="h-full min-h-0 bg-white"
      data-testid="staff-operational-profile-panel"
    >
      <TabGroup value="profile" className="h-full min-h-0 gap-0">
        <header className="relative h-32 shrink-0 border-b border-[#e5e5e5] px-4 pt-3">
          {profile ? (
            <ProfileHeader profile={profile} online={online} />
          ) : (
            <ProfileHeaderSkeleton />
          )}
          <Button
            ref={closeButtonRef}
            aria-label="직원 운영 프로필 닫기"
            className="absolute right-3 top-3 size-8 rounded-lg text-[#404040]"
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
          >
            <CdsActionsXIcon aria-hidden="true" size={16} />
          </Button>
          <TabsList
            activateOnFocus
            aria-label="직원 프로필 탭"
            className="absolute bottom-0 left-4 h-[34px] gap-2 p-0"
            variant="line"
          >
            <Tab
              className="h-[34px] min-w-0 flex-none rounded-none px-2 py-[7px] text-sm leading-5 text-[#737373] after:bottom-0 after:h-px data-active:text-[#262626]"
              value="profile"
            >
              프로필
            </Tab>
            <Tab
              className="h-[34px] min-w-0 flex-none rounded-none px-2 py-[7px] text-sm leading-5 text-[#737373] after:bottom-0 after:h-px"
              value="tab2"
              disabled
            >
              tab2
            </Tab>
            <Tab
              className="h-[34px] min-w-0 flex-none rounded-none px-2 py-[7px] text-sm leading-5 text-[#737373] after:bottom-0 after:h-px"
              value="tab3"
              disabled
            >
              tab3
            </Tab>
          </TabsList>
        </header>

        <TabPanel
          className="min-h-0 overflow-y-auto outline-none"
          value="profile"
        >
          {requestState === "loading" ? (
            <ProfileLoadingState />
          ) : requestState === "error" ? (
            <div
              className="m-4 rounded-lg border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] p-4"
              role="alert"
            >
              <div className="text-sm font-semibold text-[var(--emr-status-danger-text)]">
                운영 프로필을 불러오지 못했어
              </div>
              <p className="mt-1 text-[13px] leading-[18px] text-[#737373]">
                직원 정보 원본을 확인할 수 없어. 잠시 후 다시 시도해줘.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={loadProfile}
              >
                다시 시도
              </Button>
            </div>
          ) : profile ? (
            <div className="px-4 pt-4">
              <section aria-labelledby="staff-shift-heading">
                <SectionTitle id="staff-shift-heading">
                  {shiftSectionTitle}
                </SectionTitle>
                {response?.sectionErrors?.shift ? (
                  <div
                    className="mt-2.5 rounded-xl border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] p-3"
                    role="alert"
                  >
                    <div className="text-[13px] font-semibold leading-[18px] text-[var(--emr-status-warning-text)]">
                      근무 정보를 불러오지 못했어
                    </div>
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      onClick={loadProfile}
                    >
                      근무 정보 다시 시도
                    </Button>
                  </div>
                ) : shift ? (
                  <ShiftSummary
                    currentMinutes={currentMinutes}
                    onScheduleCheck={onClose}
                    shift={shift}
                    todayDate={todayDate}
                  />
                ) : (
                  <p className="mt-2.5 rounded-xl border border-[#e5e5e5] px-3 py-4 text-[13px] leading-[18px] text-[#737373]">
                    {date === todayDate
                      ? "오늘 등록된 근무가 없어요"
                      : "선택한 날짜에 등록된 근무가 없어요"}
                  </p>
                )}
              </section>

              <div className="my-4 h-px bg-[#e5e5e5]" />

              <AccountInformation profile={profile} />
            </div>
          ) : null}
        </TabPanel>
      </TabGroup>
    </section>
  );
}

function ProfileHeaderSkeleton() {
  return (
    <div className="flex h-[66px] items-center gap-4 pr-9">
      <Skeleton className="size-[66px] shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

function ProfileLoadingState() {
  return (
    <div
      aria-live="polite"
      className="space-y-4 p-4"
      data-testid="staff-operational-profile-loading"
    >
      <span className="sr-only">직원 운영 프로필 불러오는 중</span>
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-[72px] w-full rounded-xl" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-[126px] w-full rounded-lg" />
    </div>
  );
}

function ProfileHeader({
  online,
  profile,
}: {
  online: boolean;
  profile: StaffOperationalProfile;
}) {
  const detailLine = [profile.jobPositionLabel, profile.email]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-[66px] items-center gap-4 pr-9">
      <Avatar
        className="size-[66px] rounded-md after:rounded-md after:border-[#e5e5e5]"
        roundness="roundrect"
      >
        {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-md text-base">
          {profile.initials ?? profile.displayName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 truncate text-lg font-semibold leading-[26px] text-[#171717]">
            {profile.displayName}
          </h2>
          <span
            className={
              online
                ? "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-[#9ae6b4] bg-[#f0fff4] px-1.5 py-0.5 text-xs font-medium leading-4 text-[#276749]"
                : "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-[#d4d4d4] bg-[#f5f5f5] px-1.5 py-0.5 text-xs font-medium leading-4 text-[#525252]"
            }
          >
            <span
              aria-hidden="true"
              className={online ? "size-1.5 rounded-full bg-[#48bb78]" : "size-1.5 rounded-full bg-[#a3a3a3]"}
            />
            {online ? "접속 중" : "오프라인"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[13px] font-medium leading-[18px] text-[#737373]">
          {detailLine || "등록 정보 없음"}
        </p>
        <p className="mt-0.5 truncate text-xs leading-4 text-[#a3a3a3]">
          {online ? "접속 중" : formatStaffLastSeenLabel(profile.lastSeenAt)}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  id,
}: {
  children: string;
  id: string;
}) {
  return (
    <h2 className="flex h-6 items-center text-sm font-medium leading-5 text-[#525252]" id={id}>
      {children}
    </h2>
  );
}

function ShiftSummary({
  currentMinutes,
  onScheduleCheck,
  shift,
  todayDate,
}: {
  currentMinutes: number;
  onScheduleCheck: () => void;
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
    <div className="mt-2.5 flex h-[72px] items-center gap-3 rounded-xl border border-[#e5e5e5] px-3 py-3">
      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-[#737373]">
        <CdsFilesCalendarIcon aria-hidden="true" size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-medium leading-6 text-[#404040] tabular-nums">
          {formatMinutes(shift.startMinutes)} - {formatMinutes(shift.endMinutes)}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] leading-[18px]">
          <span className="shrink-0 text-[#0080e5]">{state}</span>
          <span aria-hidden="true" className="size-0.5 shrink-0 rounded-full bg-[#d4d4d4]" />
          <span className="truncate text-[#737373]">
            {[kindLabel, shift.locationLabel].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <Button
        aria-label="근무 일정 확인"
        className="h-6 shrink-0 rounded-lg px-2 py-1 text-xs leading-4"
        size="xs"
        variant="outline"
        onClick={onScheduleCheck}
      >
        일정 확인
      </Button>
    </div>
  );
}

function AccountInformation({ profile }: { profile: StaffOperationalProfile }) {
  return (
    <section aria-labelledby="staff-account-heading" className="pb-4">
      <SectionTitle id="staff-account-heading">계정 정보</SectionTitle>
      <dl className="mt-2.5 grid grid-cols-[92px_minmax(0,1fr)_24px] items-center gap-x-3 gap-y-2.5 text-sm leading-5">
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
        <AccountRow icon={CdsPeopleUserIcon} label="직무" value={profile.jobPositionLabel} />
        <AccountRow icon={CdsFilesFileTextIcon} label="직책" value={profile.title} />
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
  const copyValue = async () => {
    if (!value) return;
    try {
      await copyText(value);
      toast.success(`${label}을 복사했어`);
    } catch {
      toast.error(`${label}을 복사하지 못했어`);
    }
  };

  return (
    <>
      <dt className="flex min-w-0 items-center gap-2 text-[#737373]">
        <Icon aria-hidden={true} size={15} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0 truncate font-medium text-[#404040]" title={value}>
        {value || "미등록"}
      </dd>
      <dd className="flex size-6 items-center justify-center">
        {value && copyLabel ? (
          <button
            aria-label={copyLabel}
            className="grid size-6 place-items-center rounded-md text-[#737373] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-ring/50"
            type="button"
            onClick={() => void copyValue()}
          >
            <CdsActionsCopyIcon aria-hidden="true" size={14} />
          </button>
        ) : null}
      </dd>
    </>
  );
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fall through to the selection-based browser fallback.
  }

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

function formatDateSection(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}월 ${day}일 근무 정보`;
}
