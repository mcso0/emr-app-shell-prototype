"use client";

import { Activity, CheckCircle2, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ShellComponentProps } from "@/types/emr";

export function PlaceholderSidePanel({ moduleId }: ShellComponentProps) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-2 p-3">
        {["전체", "대기", "진행중", "완료", "보류"].map((item, index) => (
          <button
            key={item}
            className={`flex h-9 items-center justify-between rounded-md px-3 text-left ${
              index === 0 ? "bg-[#eef7ff] text-[#0b65c2]" : "hover:bg-muted"
            }`}
          >
            <span>{item}</span>
            <Badge variant="secondary">{index + 2}</Badge>
          </button>
        ))}
        <div className="mt-4 rounded-md border bg-white p-3 text-[12px] leading-5 text-muted-foreground">
          {moduleId} 메뉴의 탐색/필터/그룹 패널을 검증하기 위한 저충실도 영역입니다.
        </div>
      </div>
    </ScrollArea>
  );
}

export function PlaceholderContent({ moduleId }: ShellComponentProps) {
  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{moduleId} workspace</h1>
          <p className="text-[12px] text-muted-foreground">
            메뉴별 RightPanel 유무와 App Shell 확장 구조를 확인하는 화면입니다.
          </p>
        </div>
        <Button size="sm">
          <ClipboardList data-icon="inline-start" />
          새 작업
        </Button>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-3">
        {[
          ["대기", "12", Activity],
          ["진행중", "8", ClipboardList],
          ["완료", "24", CheckCircle2],
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="h-32 rounded-lg border bg-white p-4">
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

export function PlaceholderRightPanel() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-3">
        {["상세 정보", "보조 정보", "액션"].map((item) => (
          <div key={item} className="rounded-md border bg-white p-3">
            <div className="font-semibold">{item}</div>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              이 메뉴에서는 우측 패널을 접고 펼칠 수 있습니다.
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
