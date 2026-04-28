"use client";

import { Bell, ChevronDown, Command, HelpCircle, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function TopMenu({ workspaceId }: { workspaceId: string }) {
  return (
    <header className="emr-panel flex h-11 items-center border-b px-2">
      <Button variant="ghost" size="sm" className="h-8 min-w-[148px] justify-start gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
          CL
        </span>
        <span className="truncate font-semibold">{workspaceId}</span>
        <ChevronDown data-icon="inline-end" />
      </Button>
      <Separator orientation="vertical" className="mx-2 h-6" />
      <div className="mx-auto flex w-[560px] items-center rounded-md border bg-white px-2">
        <Search className="size-4 text-muted-foreground" />
        <Input
          className="h-8 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
          placeholder="환자명 또는 보호자명으로 검색"
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
        <div className="ml-1 flex size-7 items-center justify-center rounded-full bg-[#dbeafe] text-[11px] font-semibold text-[#1d4ed8]">
          이
        </div>
      </div>
    </header>
  );
}
