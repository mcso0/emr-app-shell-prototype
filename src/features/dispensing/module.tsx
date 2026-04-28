"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  MoreHorizontal,
  PanelLeftOpen,
  Printer,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { useLayoutStore } from "@/stores/layout-store";
import { historyGroups, orderRows, patient } from "@/features/dispensing/data";

const sideItems = Array.from({ length: 8 }, (_, index) => ({
  id: index,
  selected: index === 2,
}));

export function DispensingSidePanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <Button variant="outline" size="icon-sm" aria-label="이전 날짜">
          <ChevronLeft />
        </Button>
        <div className="flex flex-1 items-center justify-center gap-2 font-medium">
          <CalendarDays className="size-4 text-muted-foreground" />
          yy.mm.dd(week)
        </div>
        <Button variant="outline" size="sm">
          오늘
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="다음 날짜">
          <ChevronRight />
        </Button>
      </div>
      <div className="flex h-10 items-center justify-between border-b px-3 text-sm">
        <div className="flex items-center gap-2">
          total
          <Badge variant="secondary">2</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="정렬">
            <SlidersHorizontal />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="필터">
            <Filter />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="검색">
            <Search />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {sideItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm text-[#40516c]">
                <div className="border-l-2 border-[#fb923c] pl-3">text num</div>
                <ChevronDown className="size-4" />
              </div>
              <div
                className={`rounded-md border bg-white p-3 ${
                  item.selected ? "border-[#53a5ff] bg-[#eef7ff]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">titletext · titletext</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      subtext · Description
                    </div>
                  </div>
                  <Badge variant="secondary">Badge</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2 text-[12px] text-muted-foreground">
                  <div className="flex gap-1">
                    <Badge variant="outline">title text</Badge>
                    <Badge variant="outline">title text</Badge>
                  </div>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
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
    <div className="border-b bg-white">
      <div className="flex h-11 items-center gap-2 px-4">
        <Button
          variant={contentAsideOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setContentAsideOpen(!contentAsideOpen)}
        >
          {contentAsideOpen ? <PanelLeftOpen data-icon="inline-start" /> : <Clock data-icon="inline-start" />}
          검사이력
        </Button>
        {[
          `환자 ${patient.name}`,
          `품종 코리안숏헤어`,
          `나이 ${patient.age}`,
          `성별 ${patient.sex}`,
          `보호자 ${patient.guardian}`,
          `체중 ${patient.weight}`,
          `체온 ${patient.temperature}`,
          `호흡 ${patient.respiration}`,
        ].map((value) => (
          <Badge key={value} variant="secondary" className="h-6 rounded-md px-2 font-medium">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function DispensingContentAside() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 font-semibold">
          <ChevronLeft className="size-4" />
          검사이력 <span className="text-muted-foreground">12</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="정렬">
            <SlidersHorizontal />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="필터">
            <Filter />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="검색">
            <Search />
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col">
          {historyGroups.map((group) => (
            <section key={group.date} className="border-b px-4 py-3">
              <div className="flex items-center justify-between font-medium text-[#40516c]">
                <span>
                  {group.date} <span>{group.count}</span>
                </span>
                <ChevronDown className="size-4" />
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {group.items.map((item) => (
                  <div key={item} className="text-[12px] leading-5">
                    <div className="font-semibold">{item}</div>
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
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-5 text-[#9fb2ca]" />
          <h1 className="truncate text-lg font-semibold">임상병리 검사결과지</h1>
          <Badge variant="secondary">RX-260414-0008</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download data-icon="inline-start" />
            PDF 다운로드
          </Button>
          <Button variant="outline" size="sm">
            <Printer data-icon="inline-start" />
            출력하기
          </Button>
          <Button size="sm">
            담당하기
            <ChevronDown data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-5 rounded-lg border bg-white p-3">
        {[
          ["요청 일시", "2026.04.14 10:30"],
          ["환자 정보", `${patient.name}(${patient.age}) · 코리...`],
          ["요청 수의사", "이수지"],
          ["조제 담당", "미지정"],
          ["조제 시작", "대기중"],
        ].map(([label, value]) => (
          <div key={label} className="border-r px-3 last:border-r-0">
            <div className="text-[12px] text-muted-foreground">{label}</div>
            <div className="mt-1 font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Tabs defaultValue="result">
          <TabsList className="h-9">
            <TabsTrigger value="result">검사결과 입력지</TabsTrigger>
            <TabsTrigger value="condition">검사 종합 소견지</TabsTrigger>
            <TabsTrigger value="tab">Tab</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex rounded-md bg-[#eef4fb] p-1">
          <Button variant="secondary" size="xs">
            TEXT
          </Button>
          <Button variant="ghost" size="xs">
            TEXT
          </Button>
        </div>
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-white">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <ChevronDown className="size-4 text-muted-foreground" />
            <span className="text-base font-semibold">Title</span>
            <Badge variant="secondary">88</Badge>
            <span className="text-[12px] text-muted-foreground">subtext</span>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Button key={index} variant="outline" size="sm">
                button
                <MoreHorizontal data-icon="inline-end" />
              </Button>
            ))}
            <Button variant="outline" size="sm" className="border-[#93c5fd] text-[#0b65c2]">
              CTA
              <ChevronDown data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-4">
            {Array.from({ length: 4 }).map((_, section) => (
              <div key={section} className="mb-5">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <span className="size-3 rounded-[3px] bg-[#47c083]" />
                  수정된 오더
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
      <div className="rounded-md border bg-[#f8fafc] p-3">
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
            <Input value={value} readOnly className="h-8 bg-white text-foreground" />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        용량
        <Input defaultValue={order.dose} className="h-8 bg-white text-foreground" />
      </label>
      <div className="mt-auto flex justify-end gap-2 border-t pt-4">
        <Button variant="outline">변경 이력</Button>
        <Button>수정 저장</Button>
      </div>
    </div>
  );
}
