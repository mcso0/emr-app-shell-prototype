"use client";

import { EmrEmptyState } from "@/components/emr/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function HospitalProfileReadState({
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: "idle" | "loading" | "denied" | "error";
}) {
  if (status === "idle" || status === "loading") {
    return (
      <div
        className="flex flex-col gap-3"
        aria-label="병원 정보 불러오는 중"
      >
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-[320px] w-full" />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <EmrEmptyState
          kind="no-permission"
          surface="content"
          priority="primary-decision"
          title="병원 정보를 볼 권한이 없습니다."
          description="워크스페이스 관리자에게 병원 설정 조회 권한을 요청해 주세요."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-80 items-center justify-center">
      <EmrEmptyState
        kind="read-error"
        surface="content"
        priority="local-recovery"
        title="병원 정보를 불러오지 못했습니다."
        description="잠시 후 다시 시도해 주세요."
        primaryAction={
          <Button type="button" onClick={onRetry}>
            다시 시도
          </Button>
        }
      />
    </div>
  );
}
