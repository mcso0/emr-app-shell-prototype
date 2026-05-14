import type { HomeDashboardData } from "@/features/home/home.types";

type HomeCommandHeaderProps = {
  data: HomeDashboardData;
};

export function HomeCommandHeader({ data }: HomeCommandHeaderProps) {
  return (
    <section className="border-b border-border bg-card px-5 py-5">
      <div className="max-w-3xl">
        <p className="text-[12px] font-medium text-[var(--emr-status-info-text)]">
          {data.todayLabel} · {data.hospitalName}
        </p>
        <h1 className="mt-1 text-[22px] font-semibold leading-8">
          좋은 아침입니다, {data.userName}
        </h1>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          오늘/지금 처리해야 할 요청 업무와 역할별 시작점을 확인합니다.
        </p>
      </div>
    </section>
  );
}
