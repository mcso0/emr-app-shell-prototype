"use client";

import { HomeWidgetCard } from "@/features/home/components/home-widget-card";
import type { HomeWidget } from "@/features/home/home.types";

type RoleWidgetGridProps = {
  widgets: HomeWidget[];
};

export function RoleWidgetGrid({ widgets }: RoleWidgetGridProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-5">역할별 주요 위젯</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            역할 preset 기준으로 오늘 가장 먼저 볼 업무를 보여줍니다.
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {widgets.map((widget) => (
          <HomeWidgetCard key={widget.id} widget={widget} />
        ))}
      </div>
    </section>
  );
}
