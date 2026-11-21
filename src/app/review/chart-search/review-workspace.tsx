"use client";

import { useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  medicationFrequencies,
  sectionNames,
} from "@/features/chart/advanced-search/contract";
import {
  receptionCreatedEvent,
  type SearchEntry,
} from "@/features/chart/advanced-search/events";
import { ChartSearchWorkspace } from "@/features/chart/advanced-search/workspace";
import { useLayoutStore } from "@/stores/layout-store";
import { createReviewSession } from "./review-session";

const workspaceId = "chart-search-review";

export function ReviewWorkspace() {
  const [, refresh] = useReducer((n) => n + 1, 0);
  const [session] = useState(() => createReviewSession(refresh));
  const [entry, setEntry] = useState<SearchEntry>({ workspaceId });
  const [opened, setOpened] = useState(true);
  const [chartId, setChartId] = useState<string | null>(null);
  const drawer = useLayoutStore((s) => s.activeDrawer);
  const chart = chartId ? session.chart(chartId) : undefined;
  const registering = drawer?.type === "reception-form";
  function register() {
    if (drawer?.type !== "reception-form") return;
    const visit = session.register("별이");
    window.dispatchEvent(
      new CustomEvent(receptionCreatedEvent, {
        detail: { ...visit, workspaceId, registrationId: drawer.id },
      }),
    );
    useLayoutStore.getState().setActiveDrawer(null);
  }
  return (
    <main className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex min-h-12 flex-wrap items-center gap-3 border-b px-4 py-2 text-sm">
        <strong>합성 차트 검수</strong>
        <span className="text-muted-foreground">
          새로고침하면 초기화됩니다.
        </span>
        {session.waiting().map((visit) => (
          <Button
            key={visit.id}
            size="sm"
            variant="outline"
            onClick={() => {
              const resume = session.resume(visit);
              if (resume) {
                setEntry({ workspaceId, chartId: resume.target.id, resume });
                setChartId(null);
                setOpened(true);
              }
            }}
          >
            {visit.patient} · 첫 차트에서 복사 이어가기
          </Button>
        ))}
        <a
          className="ml-auto text-xs text-muted-foreground underline"
          href="/chart-search-review/credits.txt"
          target="_blank"
          rel="noreferrer"
        >
          이미지 출처
        </a>
      </header>
      {registering && (
        <section className="mx-auto my-12 grid gap-4 rounded-lg border p-6">
          <h1 className="text-lg font-bold">합성 환자 접수</h1>
          <p>별이 · 고양이 · 재진</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => useLayoutStore.getState().setActiveDrawer(null)}
            >
              취소
            </Button>
            <Button onClick={register}>별이 접수</Button>
          </div>
        </section>
      )}
      {opened && (
        <div
          className="relative min-h-0 flex-1"
          hidden={!!chart || registering}
        >
          <ChartSearchWorkspace
            key={entry.resume?.pending.id ?? "search"}
            entry={entry}
            api={session.api}
            onClose={() => {
              setOpened(false);
              setEntry({ workspaceId });
            }}
            onViewChart={(target) => setChartId(target.chartId)}
          />
        </div>
      )}
      {chart && (
        <article className="mx-auto grid w-full max-w-3xl gap-5 overflow-auto px-6 py-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold">{chart.patient} 진료 차트</h1>
            <Button variant="outline" onClick={() => setChartId(null)}>
              검색 결과로 돌아가기
            </Button>
          </div>
          <p>{chart.purpose}</p>
          {Object.entries(sectionNames).map(([key, label]) => (
            <section key={key}>
              <h2 className="mb-1 font-semibold">{label}</h2>
              {chart.paragraphs
                .filter((p) => p.section === key)
                .map((p) => (
                  <p key={p.id}>{p.text}</p>
                ))}
            </section>
          ))}
          <section>
            <h2 className="mb-1 font-semibold">진단</h2>
            {chart.diagnoses.map((d) => (
              <p key={d.id}>
                {d.name}
                {d.primary && " · 주진단"}
              </p>
            ))}
          </section>
          <section>
            <h2 className="mb-1 font-semibold">오더</h2>
            {chart.orders.map((o) => (
              <p key={o.id}>
                {o.name}
                {session.isCopiedOrder(o.id) && " · 미확정"}
                {o.inputs.dose != null &&
                  " · " +
                    String(o.inputs.dose) +
                    " " +
                    String(o.inputs.doseUnit ?? "") +
                    " · " +
                    (medicationFrequencies.find(
                      ([value]) => value === o.inputs.frequency,
                    )?.[1] ?? String(o.inputs.frequency ?? "")) +
                    " · " +
                    String(o.inputs.durationDays ?? "") +
                    "일"}
              </p>
            ))}
          </section>
        </article>
      )}
      {!opened && (
        <div className="m-auto">
          <Button onClick={() => setOpened(true)}>차트 상세 검색 열기</Button>
        </div>
      )}
    </main>
  );
}
