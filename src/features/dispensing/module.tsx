"use client";

import { useState } from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  FilterIcon,
  MenuIcon,
  PanelOpenIcon,
  PrinterIcon,
  SearchIcon,
  SlidersIcon,
} from "@/components/icons";
import { CollapseGnbIcon } from "@/components/gnb-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { useLayoutStore } from "@/stores/layout-store";
import { historyGroups, orderRows, patient } from "@/features/dispensing/data";
import type { ShellComponentProps } from "@/types/emr";

const sideItems = Array.from({ length: 8 }, (_, index) => ({
  id: index,
  selected: index === 2,
}));

const orderGroups = [
  { label: "추가된 오더", count: 1, tone: "bg-[var(--clair-color-atomic-green-500)]" },
  { label: "수정된 오더", count: 2, tone: "bg-[var(--clair-color-atomic-orange-400)]" },
  { label: "요청된 오더", count: 2, tone: "bg-[var(--clair-color-atomic-blue-500)]" },
  { label: "취소된 오더", count: 1, tone: "bg-[var(--clair-color-atomic-red-500)]" },
];

export function DispensingSidePanel({ moduleLabel }: ShellComponentProps) {
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex h-16 items-start p-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded bg-transparent text-[#4a5568] hover:bg-muted hover:text-[#171923]"
            aria-label="사이드 패널 접기"
            onClick={() => setModulePanelOpen(false)}
          >
            <span className="flex size-6 items-center justify-center" aria-hidden="true">
              <CollapseGnbIcon className="h-[11.5px] w-[15px]" />
            </span>
          </Button>
          <span
            className="truncate text-[18px] font-semibold leading-[26px] tracking-[-0.036px] text-[#171923]"
            data-testid="module-side-panel-title"
          >
            {moduleLabel}
          </span>
        </div>
      </div>
      <div className="flex h-12 items-center gap-2 px-4">
        <Button variant="outline" size="icon-sm" className="bg-card" aria-label="이전 날짜">
          <ChevronLeftIcon />
        </Button>
        <div className="flex h-8 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-foreground">
          <CalendarIcon className="size-4 text-muted-foreground" />
          yy.mm.dd(week)
          <Badge variant="outline" className="h-5 rounded-md bg-card px-1.5 text-[11px]">
            오늘
          </Badge>
        </div>
        <Button variant="outline" size="icon-sm" className="bg-card" aria-label="다음 날짜">
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="mx-4 flex h-10 items-center justify-between border-y border-border text-[13px] text-muted-foreground">
        <div className="flex items-center gap-2">
          total
          <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[11px]">
            2
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="정렬">
            <SlidersIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="필터">
            <FilterIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="검색">
            <SearchIcon />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 px-4 py-2">
          {sideItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="flex h-8 items-center justify-between text-[13px] text-muted-foreground">
                <div className="border-l-2 border-[var(--clair-color-atomic-orange-400)] pl-3">text num</div>
                <ChevronDownIcon className="size-4" />
              </div>
              <div
                className={`rounded-lg border p-3 transition-colors ${
                  item.selected
                    ? "border-[var(--selection-border)] bg-selection"
                    : "border-border bg-card hover:bg-background"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-foreground">
                      titletext · titletext
                    </div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      subtext · Description
                    </div>
                  </div>
                  <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[11px]">
                    Badge
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[var(--clair-color-line-subtle)] pt-2 text-[11px] text-muted-foreground">
                  <div className="flex gap-1">
                    <Badge variant="outline" className="h-5 rounded px-1.5 font-medium">
                      title text
                    </Badge>
                    <Badge variant="outline" className="h-5 rounded px-1.5 font-medium">
                      title text
                    </Badge>
                  </div>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    hh:mm state
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DispensingHeader() {
  const { contentAsideOpen, setContentAsideOpen } = useLayoutStore();

  return (
    <div className="border-b border-border bg-card">
      <div className="flex h-[50px] items-center gap-3 px-4">
        <Button
          variant={contentAsideOpen ? "secondary" : "outline"}
          size="xs"
          className="h-[26px] bg-card"
          onClick={() => setContentAsideOpen(!contentAsideOpen)}
        >
          {contentAsideOpen ? <PanelOpenIcon data-icon="inline-start" /> : <ClockIcon data-icon="inline-start" />}
          검사이력
        </Button>
        <div className="h-[18px] w-px bg-border" />
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {[
            ["환자", patient.name],
            ["보호자", patient.guardian],
            ["품종", "코리안숏헤어"],
            ["나이", patient.age],
            ["성별", patient.sex],
            ["체중", patient.weight],
            ["체온", patient.temperature],
            ["호흡", patient.respiration],
          ].map(([label, value]) => (
            <span
              key={`${label}-${value}`}
              className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-md bg-background px-2 text-[12px] font-medium text-muted-foreground"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="text-foreground">{value}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="이전">
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="다음">
            <ChevronRightIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="메뉴">
            <MenuIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DispensingContentAside() {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="mx-4 flex h-12 items-center justify-between border-b border-border">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <ChevronLeftIcon className="size-4" />
          검사이력 <span className="text-muted-foreground">12</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="정렬">
            <SlidersIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="필터">
            <FilterIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="검색">
            <SearchIcon />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col">
          {historyGroups.map((group) => (
            <section key={group.date} className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
                <span>
                  {group.date} <span>{group.count}</span>
                </span>
                <ChevronDownIcon className="size-4" />
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {group.items.map((item) => (
                  <div key={item} className="text-[12px] leading-5">
                    <div className="font-semibold text-foreground">{item}</div>
                    <div className="text-muted-foreground">담당자명 · 10:30 요청</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DispensingContent() {
  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <div className="mb-3 flex h-9 items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-[16px] font-semibold text-foreground">조제 지시서</h1>
          <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] text-muted-foreground">
            RX-260414-0008
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-card">
            <DownloadIcon data-icon="inline-start" />
            PDF 다운로드
          </Button>
          <Button variant="outline" size="sm" className="bg-card">
            <PrinterIcon data-icon="inline-start" />
            출력하기
          </Button>
          <Button size="sm">
            담당하기
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-5 rounded-lg border border-border bg-card px-4 py-3">
        {[
          ["요청 일시", "2026.04.14 10:30"],
          ["환자 정보", `${patient.name}(${patient.age}) · 코리...`],
          ["요청 수의사", "이수지"],
          ["조제 담당", "미지정"],
          ["조제 시작", "대기중"],
        ].map(([label, value]) => (
          <div key={label} className="border-r border-border px-3 last:border-r-0">
            <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
            <div className="mt-1 text-[13px] font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Tabs defaultValue="result">
          <TabsList className="h-8 rounded-full bg-transparent p-0">
            <TabsTrigger value="result" className="h-8 rounded-full px-3 text-[12px]">
              전체 10
            </TabsTrigger>
            <TabsTrigger value="condition" className="h-8 rounded-full px-3 text-[12px]">
              정규제 8
            </TabsTrigger>
            <TabsTrigger value="tab" className="h-8 rounded-full px-3 text-[12px]">
              기타 8
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <ChevronDownIcon className="size-4 text-muted-foreground" />
            <span className="text-[14px] font-semibold text-foreground">항생제 세트 A</span>
            <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[11px]">
              6
            </Badge>
            <span className="text-[12px] text-muted-foreground">subtext</span>
          </div>
          <div className="flex items-center gap-2">
            {["수정이력조회", "리마인"].map((label) => (
              <Button key={label} variant="outline" size="xs" className="bg-card">
                {label}
                <MenuIcon data-icon="inline-end" />
              </Button>
            ))}
            <Button variant="outline" size="xs" className="border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]">
              조제중
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-4 pt-3">
            {orderGroups.map((group, section) => (
              <div key={group.label} className="mb-4">
                <div className="mb-2 flex h-6 items-center gap-2 text-[13px] font-medium text-foreground">
                  <span className={`size-3 rounded-[3px] ${group.tone}`} />
                  {group.label}
                  <span className="text-[12px] text-muted-foreground">{group.count}</span>
                </div>
                <EmrDataTable rows={orderRows} sectionId={`section-${section}`} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}

export function DispensingDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const order = orderRows.find((row) => row.id === activeDrawer?.id) ?? orderRows[0];

  return (
    <div className="flex h-[calc(100%-48px)] flex-col gap-4 overflow-y-auto p-4">
      <div className="rounded-md border bg-background p-3">
        <div className="text-[12px] text-muted-foreground">오더명</div>
        <div className="mt-1 text-base font-semibold">{order.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["구분", order.category],
          ["상태", order.status],
          ["경로", order.route],
          ["빈도", order.frequency],
          ["요청 일시", order.requestedAt],
          ["요청 수의사", order.doctor],
        ].map(([label, value]) => (
          <label key={label} className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            {label}
            <Input value={value} readOnly className="h-8 bg-card text-foreground" />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        용량
        <DoseInput key={order.id} initialDose={order.dose} />
      </label>
      <div className="mt-auto flex justify-end gap-2 border-t pt-4">
        <Button variant="outline">변경 이력</Button>
        <Button>수정 저장</Button>
      </div>
    </div>
  );
}

function DoseInput({ initialDose }: { initialDose: string }) {
  const [doseValue, setDoseValue] = useState(initialDose);

  return (
    <Input
      value={doseValue}
      onValueChange={setDoseValue}
      className="h-8 bg-card text-foreground"
    />
  );
}
