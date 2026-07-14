"use client";

import { useCallback, useEffect, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  StaffOperationalProfile,
  StaffOperationalShift,
} from "@/features/staff/server-operational-profile-core";

type StaffOperationalProfileResponse =
  | {
      ok: true;
      profile: StaffOperationalProfile;
      shift: StaffOperationalShift | null;
      sectionErrors?: { shift?: "schedule_read_failed" };
    }
  | { ok: false; error?: string; denialReason?: string };

export type StaffOperationalProfileContextSummary = {
  date: string;
  processedCount: number;
  remainingCount: number;
  totalCount: number;
};

export function StaffOperationalProfileDrawer({
  actorUserId,
  contextSummary,
  currentMinutes,
  date,
  onOpenChange,
  open,
  todayDate,
  userId,
  workspaceId,
}: {
  actorUserId?: string;
  contextSummary?: StaffOperationalProfileContextSummary;
  currentMinutes: number;
  date: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  todayDate: string;
  userId: string | null;
  workspaceId: string;
}) {
  const [loadResult, setLoadResult] = useState<{
    key: string;
    response: Extract<StaffOperationalProfileResponse, { ok: true }> | null;
    state: "ready" | "error";
  } | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const loadProfile = useCallback(
    () => setRetryNonce((value) => value + 1),
    [],
  );
  const requestKey =
    open && userId ? `${workspaceId}:${userId}:${date}:${retryNonce}` : null;
  const requestState = !requestKey
    ? "idle"
    : loadResult?.key === requestKey
      ? loadResult.state === "ready"
        ? "idle"
        : "error"
      : "loading";
  const response =
    requestKey && loadResult?.key === requestKey && loadResult.state === "ready"
      ? loadResult.response
      : null;

  useEffect(() => {
    if (!requestKey || !userId) return;

    const controller = new AbortController();

    void fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/staff/${encodeURIComponent(userId)}/operational-profile?date=${encodeURIComponent(date)}&context=reception`,
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
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setLoadResult({ key: requestKey, response: null, state: "error" });
      });

    return () => controller.abort();
  }, [actorUserId, date, requestKey, userId, workspaceId]);

  const profile = response?.profile;
  const shift = response?.shift ?? null;
  const shiftSectionTitle =
    date === todayDate ? "오늘 근무" : formatDateSection(date);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        aria-describedby="staff-operational-profile-description"
        className="!w-screen !max-w-none gap-0 p-0 sm:!w-[440px] sm:!min-w-[400px] sm:!max-w-[480px]"
        data-testid="staff-operational-profile-drawer"
        showCloseButton={false}
      >
        <SheetHeader className="relative border-b border-[var(--emr-line-hairline)] px-5 py-4 pr-14">
          <SheetTitle>직원 운영 프로필</SheetTitle>
          <SheetDescription
            className="sr-only"
            id="staff-operational-profile-description"
          >
            직원의 공통 프로필, 조직 정보, 선택 날짜 근무 정보를 조회합니다.
          </SheetDescription>
          <SheetClose
            aria-label="운영 프로필 닫기"
            render={
              <Button
                className="absolute right-3 top-3"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <CloseIcon aria-hidden="true" />
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {requestState === "loading" ? (
            <ProfileLoadingState />
          ) : requestState === "error" ? (
            <div
              className="m-5 rounded-lg border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] p-4"
              role="alert"
            >
              <div className="font-semibold text-[var(--emr-status-danger-text)]">
                운영 프로필을 불러오지 못했어
              </div>
              <p className="mt-1 text-sm text-[var(--emr-text-secondary)]">
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
            <div className="divide-y divide-[var(--emr-line-hairline)]">
              <ProfileHeader profile={profile} />
              <section
                className="px-5 py-5"
                aria-labelledby="staff-organization-heading"
              >
                <h2
                  className="text-sm font-semibold"
                  id="staff-organization-heading"
                >
                  조직 정보
                </h2>
                <dl className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                  <ProfileField label="직무" value={profile.jobPositionLabel} />
                  <ProfileField label="직책" value={profile.title} />
                  <ProfileField label="부서" value={profile.department} />
                  <ProfileField
                    label="소속 상태"
                    value={getMembershipStatusLabel(profile.membershipStatus)}
                  />
                </dl>
              </section>
              <section
                className="px-5 py-5"
                aria-labelledby="staff-shift-heading"
              >
                <h2 className="text-sm font-semibold" id="staff-shift-heading">
                  {shiftSectionTitle}
                </h2>
                {response.sectionErrors?.shift ? (
                  <div
                    className="mt-3 rounded-lg border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] p-3"
                    role="alert"
                  >
                    <div className="text-sm font-semibold text-[var(--emr-status-warning-text)]">
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
                    shift={shift}
                    todayDate={todayDate}
                  />
                ) : (
                  <p className="mt-3 text-sm text-[var(--emr-text-secondary)]">
                    {date === todayDate
                      ? "오늘 등록된 근무가 없어요"
                      : "선택한 날짜에 등록된 근무가 없어요"}
                  </p>
                )}
              </section>
              {contextSummary ? (
                <ReceptionContextSummary summary={contextSummary} />
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProfileLoadingState() {
  return (
    <div
      className="space-y-6 p-5"
      data-testid="staff-operational-profile-loading"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
      </div>
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

function ProfileHeader({ profile }: { profile: StaffOperationalProfile }) {
  const statusLabel = getMembershipStatusLabel(profile.membershipStatus);
  return (
    <section className="flex items-center gap-4 px-5 py-5">
      <Avatar roundness="roundrect" size="lg">
        {profile.avatarUrl ? (
          <AvatarImage src={profile.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback>
          {profile.initials ?? profile.displayName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-semibold">
            {profile.displayName}
          </h2>
          <Badge
            variant={
              profile.membershipStatus === "active" ? "outline" : "secondary"
            }
          >
            {statusLabel}
          </Badge>
        </div>
        <p className="mt-1 truncate text-sm text-[var(--emr-text-secondary)]">
          {[profile.jobPositionLabel, profile.title]
            .filter(Boolean)
            .join(" · ") || "조직 정보 미지정"}
        </p>
        {profile.department ? (
          <p className="mt-0.5 text-xs text-[var(--emr-text-tertiary)]">
            {profile.department}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ProfileField({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <dt className="text-[var(--emr-text-secondary)]">{label}</dt>
      <dd className="min-w-0 font-medium text-[var(--emr-text-primary)]">
        {value || "미지정"}
      </dd>
    </>
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
    <div className="mt-3 rounded-lg border border-[var(--emr-line-default)] bg-[var(--emr-surface-subtle)] p-4">
      <div className="text-base font-semibold tabular-nums">
        {formatMinutes(shift.startMinutes)}–{formatMinutes(shift.endMinutes)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-[var(--emr-text-secondary)]">
        <span>{kindLabel}</span>
        {shift.locationLabel ? <span>· {shift.locationLabel}</span> : null}
        <span>· {state}</span>
      </div>
    </div>
  );
}

function ReceptionContextSummary({
  summary,
}: {
  summary: StaffOperationalProfileContextSummary;
}) {
  return (
    <section
      className="px-5 py-5"
      aria-labelledby="staff-reception-summary-heading"
    >
      <h2
        className="text-sm font-semibold"
        id="staff-reception-summary-heading"
      >
        선택 날짜 예약
      </h2>
      {summary.totalCount === 0 ? (
        <p className="mt-3 text-sm text-[var(--emr-text-secondary)]">
          선택한 날짜에 예약이 없어요
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["전체", summary.totalCount],
            ["처리", summary.processedCount],
            ["남은 예약", summary.remainingCount],
          ].map(([label, value]) => (
            <div
              className="rounded-lg border border-[var(--emr-line-default)] bg-[var(--emr-surface-subtle)] px-3 py-3"
              key={label}
            >
              <dt className="text-xs text-[var(--emr-text-secondary)]">
                {label}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function getMembershipStatusLabel(
  status: StaffOperationalProfile["membershipStatus"],
) {
  if (status === "inactive") return "비활성";
  if (status === "suspended") return "중지됨";
  return "활성";
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
  return `${month}월 ${day}일 근무`;
}
