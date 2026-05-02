"use client";

import Link from "next/link";
import { ActivityIcon, CheckIcon, ClipboardListIcon } from "@/components/icons";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { OrderQueueSelectionSummary } from "@/components/emr/order-queue-summary";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getOrderQueueItems,
  getOrderQueueStatuses,
  getSelectedOrderQueueItem,
} from "@/features/order-queue/data";
import { createDemoHref, getGoldenDemoScenario } from "@/lib/emr-domain/demo-scenarios";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";

export function PlaceholderSidePanel({ moduleId, moduleLabel }: ShellComponentProps) {
  const { selectedQueueItemIds, setModulePanelOpen, setSelectedQueueItem } = useLayoutStore();
  const items = getOrderQueueItems(moduleId);
  const statuses = getOrderQueueStatuses(moduleId);

  return (
    <EmrOrderQueueSidePanel
      items={items}
      statuses={statuses}
      title={moduleLabel}
      selectedItemId={selectedQueueItemIds[moduleId]}
      onCollapse={() => setModulePanelOpen(false)}
      onSelectItem={(itemId) => setSelectedQueueItem(moduleId, itemId)}
    />
  );
}

export function PlaceholderContent({ hasRightPanel, moduleId }: ShellComponentProps) {
  const { rightPanelOpen, selectedQueueItemIds, setRightPanelOpen } = useLayoutStore();
  const statuses = getOrderQueueStatuses(moduleId);
  const selectedQueueItem = getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);

  if (moduleId === "home") {
    return <DemoLauncher />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{moduleId} workspace</h1>
          <p className="text-[12px] text-muted-foreground">
            메뉴별 RightPanel 유무와 App Shell 확장 구조를 확인하는 화면입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasRightPanel ? (
            <Button
              variant="outline"
              size="sm"
              aria-label={rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"}
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
            >
              {rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"}
            </Button>
          ) : null}
          <Button size="sm">
            <ClipboardListIcon data-icon="inline-start" />
            새 작업
          </Button>
        </div>
      </div>
      <OrderQueueSelectionSummary
        className="mb-4"
        item={selectedQueueItem}
        statuses={statuses}
      />
      <div className="grid flex-1 grid-cols-3 gap-3">
        {[
          ["대기", "12", ActivityIcon],
          ["진행중", "8", ClipboardListIcon],
          ["완료", "24", CheckIcon],
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="h-32 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="size-4" />
              {label as string}
            </div>
            <div className="mt-5 text-3xl font-semibold">{value as string}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoLauncher() {
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
    "진료(차트)",
    "검사/영상",
    "조제/처치",
    "수납",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--clair-color-background-normal)]">
      <section className="border-b bg-white px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold text-[var(--clair-color-primary-normal)]">
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
          <section className="rounded-lg border bg-white p-4">
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
                <div key={label} className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
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
                className="rounded-lg border bg-white p-4 text-left transition-colors hover:bg-[var(--clair-color-background-surface)]"
              >
                <div className="text-[14px] font-semibold">{role}</div>
                <p className="mt-2 min-h-12 text-[12px] leading-5 text-muted-foreground">
                  {description}
                </p>
                <div className="mt-3 text-[12px] font-semibold text-[var(--clair-color-primary-normal)]">
                  바로 열기
                </div>
              </Link>
            ))}
          </section>
          <section className="rounded-lg border bg-white p-4">
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

export function PlaceholderRightPanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-col justify-center border-b px-3">
        <div className="text-sm font-semibold">Right Subpanel</div>
        <div className="text-[11px] text-muted-foreground">화면별 보조 패널</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {["상세 정보", "보조 정보", "액션"].map((item) => (
            <div key={item} className="rounded-md border bg-card p-3">
              <div className="font-semibold">{item}</div>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                이 메뉴에서는 우측 패널을 접고 펼칠 수 있습니다.
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
