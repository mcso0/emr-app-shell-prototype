"use client";

import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buttonVariants } from "@/components/ui/button";
import { createDemoHref, getGoldenDemoScenario } from "@/lib/emr-domain/demo-scenarios";
import { cn } from "@/lib/utils";

export function DemoLauncher() {
  const workspaceId = "clair-demo";
  const scenario = getGoldenDemoScenario();
  const quickStarts = [
    ["데스크", "접수에서 김하늘/콩이 내원 맥락 확인", "reception"],
    ["수의사", "SOAP, Assessment, 검사/영상/처방 오더 확인", "treatment"],
    ["검사", "CBC 결과와 장비 수신 내역 확인", "lab"],
    ["영상", "복부 영상 판독과 종합소견 확인", "imaging"],
    ["수납", "청구 항목과 156,500원 수납 흐름 확인", "billing"],
  ] as const;
  const spine = [
    "접수/예약",
    "진료/차트",
    "검사/영상",
    "조제/처치",
    "수납",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]">
      <section className="border-b bg-card px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold text-[var(--emr-status-info-text)]">
              Sales Demo Prototype
            </div>
            <h1 className="mt-1 text-[22px] font-semibold leading-8">{scenario.title}</h1>
            <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted-foreground">
              {scenario.description}
            </p>
          </div>
          <Link
            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
            href={createDemoHref({ moduleId: "reception", workspaceId })}
          >
            데모 시작
          </Link>
        </div>
      </section>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-5">
          <section className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold">7분 골든 경로</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  한 환자/보호자/encounter 맥락으로 외래 하루 흐름을 설명합니다.
                </p>
              </div>
              <div className="text-[12px] text-muted-foreground">{scenario.subtitle}</div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {spine.map((label, index) => (
                <div
                  key={label}
                  className="rounded-md border bg-[var(--emr-surface-muted)] p-3"
                >
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    STEP {index + 1}
                  </div>
                  <div className="mt-2 text-[13px] font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="grid gap-3 md:grid-cols-5">
            {quickStarts.map(([role, description, moduleId]) => (
              <Link
                key={role}
                href={createDemoHref({ moduleId, workspaceId })}
                className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-[var(--emr-state-hover)]"
              >
                <div className="text-[14px] font-semibold">{role}</div>
                <p className="mt-2 min-h-12 text-[12px] leading-5 text-muted-foreground">
                  {description}
                </p>
                <div className="mt-3 text-[12px] font-semibold text-[var(--emr-status-info-text)]">
                  바로 열기
                </div>
              </Link>
            ))}
          </section>
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-[15px] font-semibold">데모 운영 메모</h2>
            <div className="mt-3 grid gap-2 text-[13px] leading-5 text-muted-foreground md:grid-cols-3">
              <p>새로고침 후 persistence를 약속하지 않고 session-only prototype으로 설명합니다.</p>
              <p>조제/처치 화면은 현재 디자인을 보존하고 연결 업무 큐로 설명합니다.</p>
              <p>실제 DB/API/auth/외부 연동은 제품 MVP 범위로 분리해 설명합니다.</p>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
