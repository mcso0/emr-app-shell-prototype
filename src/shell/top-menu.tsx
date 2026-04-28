"use client";

import { Bell, ChevronDown, Command, HelpCircle, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function TopMenu({ workspaceId }: { workspaceId: string }) {
  return (
    <header className="flex h-[52px] items-center px-2.5">
      <Button
        variant="outline"
        size="sm"
        className="h-8 min-w-[204px] justify-start gap-2 bg-card"
        aria-label={`${workspaceId} 워크스페이스 선택`}
      >
        <span className="flex size-4 items-center justify-center rounded-md bg-brand text-[9px] font-semibold text-brand-foreground">
          C
        </span>
        <span className="truncate font-semibold">VIP 동물의료센터 청담점</span>
        <ChevronDown data-icon="inline-end" />
      </Button>
      <Separator orientation="vertical" className="mx-2 hidden h-6" />
      <div className="mx-auto flex h-8 w-[560px] items-center rounded-lg border border-input bg-card px-3">
        <Search className="size-3.5 text-muted-foreground" />
        <Input
          className="h-8 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
          placeholder="동물명 또는 보호자명으로 검색"
        />
        <Command className="size-3 text-muted-foreground" />
        <span className="ml-1 text-[11px] text-muted-foreground">K</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="알림">
          <Bell />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="도움말">
          <HelpCircle />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="설정">
          <Settings />
        </Button>
        <div className="ml-1 flex size-7 items-center justify-center rounded-full bg-[var(--clair-color-status-info-background)] text-[11px] font-semibold text-[var(--clair-color-status-info-foreground)]">
          이
        </div>
      </div>
    </header>
  );
}
