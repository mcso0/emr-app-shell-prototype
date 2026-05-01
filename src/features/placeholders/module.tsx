"use client";

import { ActivityIcon, CheckIcon, ClipboardListIcon } from "@/components/icons";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { OrderQueueSelectionSummary } from "@/components/emr/order-queue-summary";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getOrderQueueItems,
  getOrderQueueStatuses,
  getSelectedOrderQueueItem,
} from "@/features/order-queue/data";
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
