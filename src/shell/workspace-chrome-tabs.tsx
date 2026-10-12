"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CdsActionsPlusIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GnbIcon } from "@/shell/module-nav-icons";

export type WorkspaceChromeTabItem = {
  icon?: GnbIcon;
  iconClassName?: string;
  id: string;
  title: string;
  tooltipDescription?: string;
  tooltipTitle?: string;
};

type WorkspaceChromeTabsProps = {
  activeTabId: string | null;
  tabs: WorkspaceChromeTabItem[];
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onReorderTabs: (orderedTabIds: string[]) => void;
};

const WORKSPACE_TAB_WIDTH_CLASS_NAME =
  "min-w-[80px] max-w-[var(--emr-topbar-tab-max-width)] flex-[1_1_var(--emr-topbar-tab-max-width)]";
const workspaceTabButtonClassName =
  "h-[var(--emr-topbar-control-size)] min-w-0 flex-1 justify-start gap-0 truncate rounded-[var(--emr-topbar-tab-radius)] border-transparent bg-transparent py-[var(--emr-topbar-tab-padding-y)] pl-[var(--emr-topbar-tab-padding-x)] pr-[var(--emr-topbar-tab-padding-right)] text-left [font-size:var(--emr-type-size-body)] font-medium ![letter-spacing:var(--emr-type-tracking-section)] [line-height:var(--emr-type-leading-body)] shadow-none hover:bg-transparent";
const workspaceTabCloseClassName =
  "mr-[var(--emr-topbar-tab-padding-x)] shrink-0 bg-transparent text-[var(--emr-topbar-tab-close)] opacity-0 transition-opacity duration-[var(--emr-topbar-motion-duration)] pointer-events-none hover:bg-[var(--emr-state-hover)] hover:text-[var(--emr-topbar-tab-active-close)] group-hover/workspace-tab:pointer-events-auto group-hover/workspace-tab:opacity-100 group-focus-within/workspace-tab:pointer-events-auto group-focus-within/workspace-tab:opacity-100 motion-reduce:transition-none";
const workspaceTabIconFrameClassName =
  "flex size-[var(--clair-spacing-16)] shrink-0 items-center justify-center";
const workspaceTabTooltipClassName =
  "max-w-[260px] flex-col items-start gap-0.5 px-2.5 py-2 text-left";
const workspaceTabFrameClassName =
  "group/workspace-tab relative flex h-[var(--emr-topbar-control-size)] items-center gap-[var(--emr-topbar-tab-inner-gap)] rounded-[var(--emr-topbar-tab-radius)] border transition-colors motion-reduce:transition-none";

function sameTabOrder(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function WorkspaceTabLabel({
  tab,
  active,
}: {
  tab: WorkspaceChromeTabItem;
  active: boolean;
}) {
  const TabIcon = tab.icon;

  return (
    <span className="flex min-w-0 items-center gap-[var(--emr-topbar-tab-inner-gap)]">
      {TabIcon ? (
        <span
          className={cn(
            workspaceTabIconFrameClassName,
            active
              ? "text-[var(--emr-topbar-tab-active-icon)]"
              : "text-[var(--emr-topbar-tab-icon)] group-hover/workspace-tab:text-[var(--emr-topbar-tab-active-icon)]",
          )}
          aria-hidden="true"
        >
          <TabIcon
            className={cn(
              tab.iconClassName,
              "h-4 w-4 origin-center scale-[var(--emr-topbar-tab-icon-scale)] text-current",
            )}
          />
        </span>
      ) : null}
      <span className="truncate px-[var(--emr-topbar-tab-label-padding-x)]">{tab.title}</span>
    </span>
  );
}

function SortableWorkspaceTab({
  tab,
  active,
  hasMultipleTabs,
  focusable,
  insertionSide,
  onActivateTab,
  onCloseTab,
  onFocusTab,
  onKeyDown,
  onPrepareDrag,
}: {
  tab: WorkspaceChromeTabItem;
  active: boolean;
  hasMultipleTabs: boolean;
  focusable: boolean;
  insertionSide: "left" | "right" | null;
  onActivateTab: (tabId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onCloseTab: (tabId: string) => void;
  onFocusTab: (tabId: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => void;
  onPrepareDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: tab.id, disabled: !hasMultipleTabs });

  return (
    <div
      ref={setNodeRef}
      role="presentation"
      data-slot="workspace-tab"
      data-dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        workspaceTabFrameClassName,
        WORKSPACE_TAB_WIDTH_CLASS_NAME,
        active
          ? "border-[var(--emr-topbar-tab-active-border)] bg-[var(--emr-topbar-tab-active-bg)] shadow-[var(--emr-topbar-tab-active-shadow)]"
          : "border-transparent bg-[var(--emr-topbar-tab-bg)] hover:border-transparent hover:bg-[var(--emr-topbar-tab-hover-bg)]",
        isDragging && "opacity-30",
        "motion-reduce:![transition:none]",
      )}
    >
      {insertionSide ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 z-10 w-0.5 rounded-full bg-primary",
            insertionSide === "left" ? "-left-1" : "-right-1",
          )}
        />
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              {...attributes}
              ref={setActivatorNodeRef}
              type="button"
              role="tab"
              variant="ghost"
              size="default"
              aria-disabled={undefined}
              aria-pressed={undefined}
              aria-roledescription={hasMultipleTabs ? "이동 가능한 업무 탭" : undefined}
              aria-selected={active}
              tabIndex={focusable ? 0 : -1}
              className={cn(
                workspaceTabButtonClassName,
                hasMultipleTabs && "cursor-grab pr-0 active:cursor-grabbing",
                active
                  ? "text-[var(--emr-topbar-tab-active-text)] hover:text-[var(--emr-topbar-tab-active-text)]"
                  : "text-[var(--emr-topbar-tab-text)] hover:text-[var(--emr-topbar-tab-active-text)] group-hover/workspace-tab:text-[var(--emr-topbar-tab-active-text)]",
              )}
              onPointerDown={(event) => {
                onPrepareDrag(event);
                if (event.pointerType !== "mouse" || event.button !== 0) return;
                listeners?.onPointerDown?.(event);
                // Keep editor focus until a click selects the tab. A drag does not select it.
                event.preventDefault();
              }}
              onFocus={() => onFocusTab(tab.id)}
              onKeyDown={(event) => onKeyDown(event, tab.id)}
              onClick={(event) => onActivateTab(tab.id, event)}
            >
              <WorkspaceTabLabel tab={tab} active={active} />
            </Button>
          }
        />
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className={workspaceTabTooltipClassName}
        >
          <span className="max-w-full truncate text-[12px] font-semibold">
            {tab.tooltipTitle ?? tab.title}
          </span>
          {tab.tooltipDescription ? (
            <span className="max-w-full truncate text-[11px] opacity-80">
              {tab.tooltipDescription}
            </span>
          ) : null}
        </TooltipContent>
      </Tooltip>
      {hasMultipleTabs ? (
        <Button
          type="button"
          variant="ghost"
          size="tiny"
          aria-label={`${tab.title} 탭 닫기`}
          className={cn(
            workspaceTabCloseClassName,
            active && "text-[var(--emr-topbar-tab-active-close)]",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onCloseTab(tab.id);
          }}
        >
          <CdsActionsXIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function WorkspaceChromeTabs({
  activeTabId,
  tabs,
  onActivateTab,
  onCloseTab,
  onNewTab,
  onReorderTabs,
}: WorkspaceChromeTabsProps) {
  const hasMultipleTabs = tabs.length > 1;
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
  const membershipKey = JSON.stringify([...tabIds].sort());
  const latestTabIds = useRef(tabIds);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragSnapshot = useRef<{ ids: string[]; tabId: string } | null>(null);
  const suppressClick = useRef(false);
  const [draggingTab, setDraggingTab] = useState<WorkspaceChromeTabItem | null>(null);
  const [dragWidth, setDragWidth] = useState<number>();
  const [overId, setOverId] = useState<string | null>(null);
  const [edgeThreshold, setEdgeThreshold] = useState(0.1);
  const [focusedTabId, setFocusedTabId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function cancelPointerGesture() {
    if (pointerRef.current) {
      // PointerSensor has no imperative cancel API. Forward focus loss as pointer cancellation.
      document.dispatchEvent(new PointerEvent("pointercancel", {
        pointerId: pointerRef.current.id,
        bubbles: true,
      }));
      pointerRef.current = null;
    }
  }

  useLayoutEffect(() => {
    latestTabIds.current = tabIds;
    if (dragSnapshot.current && !sameTabOrder(dragSnapshot.current.ids, tabIds)) {
      cancelPointerGesture();
    }
  }, [tabIds]);

  useLayoutEffect(() => {
    if (!activeTabId) return;
    const viewport = viewportRef.current;
    const activeTab = viewport?.querySelector('[role="tab"][aria-selected="true"]')
      ?.closest<HTMLElement>('[data-slot="workspace-tab"]');
    if (!viewport || !activeTab) return;
    const viewportRect = viewport.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    if (tabRect.left < viewportRect.left) viewport.scrollLeft += tabRect.left - viewportRect.left;
    else if (tabRect.right > viewportRect.right) viewport.scrollLeft += tabRect.right - viewportRect.right;
  }, [activeTabId, membershipKey]);

  useEffect(() => {
    function rememberPointer(event: PointerEvent) {
      if (pointerRef.current?.id === event.pointerId) {
        pointerRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
      }
    }

    document.addEventListener("pointermove", rememberPointer, true);
    document.addEventListener("pointerup", rememberPointer, true);
    window.addEventListener("blur", cancelPointerGesture);
    return () => {
      document.removeEventListener("pointermove", rememberPointer, true);
      document.removeEventListener("pointerup", rememberPointer, true);
      window.removeEventListener("blur", cancelPointerGesture);
      cancelPointerGesture();
    };
  }, []);

  function isInsideViewport(point: { x: number; y: number } | null) {
    const rect = viewportRef.current?.getBoundingClientRect();
    return !!point && !!rect && point.x >= rect.left && point.x <= rect.right &&
      point.y >= rect.top && point.y <= rect.bottom;
  }

  const collisionDetection: CollisionDetection = (args) =>
    isInsideViewport(args.pointerCoordinates) ? closestCenter(args) : [];

  function finishDrag() {
    dragSnapshot.current = null;
    pointerRef.current = null;
    setDraggingTab(null);
    setOverId(null);
  }

  function commitReorder(nextIds: string[], movedTabId: string) {
    const currentIds = latestTabIds.current;
    if (sameTabOrder(currentIds, nextIds)) return;
    onReorderTabs(nextIds);
    const title = tabs.find((tab) => tab.id === movedTabId)?.title ?? "업무";
    setAnnouncement(`${title} 탭이 ${nextIds.length}개 중 ${nextIds.indexOf(movedTabId) + 1}번째로 이동되었습니다.`);
  }

  function handleDragStart(event: DragStartEvent) {
    const tabId = String(event.active.id);
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    dragSnapshot.current = { ids: [...latestTabIds.current], tabId };
    suppressClick.current = true;
    setDraggingTab(tab);
    setDragWidth(event.active.rect.current.initial?.width);
    setEdgeThreshold(Math.min(0.5, 32 / Math.max(viewportRef.current?.clientWidth ?? 64, 64)));
  }

  function shouldCancelDrop(event: DragEndEvent) {
    const snapshot = dragSnapshot.current;
    return !snapshot || !sameTabOrder(snapshot.ids, latestTabIds.current) ||
      !isInsideViewport(pointerRef.current) || !event.over;
  }

  function handleDragEnd(event: DragEndEvent) {
    const snapshot = dragSnapshot.current;
    if (snapshot && !shouldCancelDrop(event)) {
      const oldIndex = snapshot.ids.indexOf(snapshot.tabId);
      const newIndex = snapshot.ids.indexOf(String(event.over?.id));
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        commitReorder(arrayMove(snapshot.ids, oldIndex, newIndex), snapshot.tabId);
      }
    }
    finishDrag();
  }

  function handleActivateTab(tabId: string, event: MouseEvent<HTMLButtonElement>) {
    if (suppressClick.current && event.detail > 0) {
      event.preventDefault();
      return;
    }
    event.currentTarget.focus({ preventScroll: true });
    onActivateTab(tabId);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: string) {
    const index = tabIds.indexOf(tabId);
    let nextIndex: number;
    switch (event.key) {
      case "ArrowLeft": nextIndex = (index - 1 + tabIds.length) % tabIds.length; break;
      case "ArrowRight": nextIndex = (index + 1) % tabIds.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = tabIds.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const nextButton = viewportRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex];
    nextButton?.focus({ preventScroll: true });
    nextButton?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  const focusableTabId = tabIds.includes(focusedTabId ?? "")
    ? focusedTabId
    : activeTabId ?? tabIds[0];
  const draggedIndex = tabIds.indexOf(draggingTab?.id ?? "");
  const overIndex = tabIds.indexOf(overId ?? "");

  return (
    <div className="hidden min-w-0 flex-1 items-center gap-[var(--emr-topbar-tab-gap)] sm:flex">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        modifiers={[({ transform }) => ({ ...transform, y: 0 })]}
        autoScroll={{
          canScroll: (element) => element === viewportRef.current,
          threshold: { x: edgeThreshold, y: 0 },
          layoutShiftCompensation: false,
        }}
        accessibility={{
          restoreFocus: false,
          screenReaderInstructions: {
            draggable: "탭 제목이나 아이콘을 마우스로 끌어 순서를 변경해 주세요. Esc 키를 누르시면 취소됩니다.",
          },
          announcements: {
            onDragStart: ({ active }) => `${tabs.find((tab) => tab.id === active.id)?.title ?? "업무"} 탭을 이동하고 있습니다. Esc 키를 누르시면 취소됩니다.`,
            onDragOver: () => undefined,
            onDragEnd: () => undefined,
            onDragCancel: () => undefined,
          },
        }}
        onDragStart={handleDragStart}
        onDragOver={(event) => setOverId(event.over ? String(event.over.id) : null)}
        cancelDrop={shouldCancelDrop}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          finishDrag();
          setAnnouncement("탭 이동이 취소되었습니다. 기존 순서를 유지합니다.");
        }}
        onDragAbort={() => { pointerRef.current = null; }}
      >
        <div
          ref={viewportRef}
          data-slot="workspace-tab-viewport"
          className="min-w-0 flex-[0_1_auto] overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            flexBasis: `calc(${tabs.length} * var(--emr-topbar-tab-max-width) + ${Math.max(0, tabs.length - 1)} * var(--emr-topbar-tab-gap))`,
          }}
        >
          <div
            role="tablist"
            aria-label="열린 업무 탭"
            className="flex w-full items-center gap-[var(--emr-topbar-tab-gap)]"
            style={{
              minWidth: `calc(${tabs.length} * 80px + ${Math.max(0, tabs.length - 1)} * var(--emr-topbar-tab-gap))`,
            }}
          >
            <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
              {tabs.map((tab) => (
                <SortableWorkspaceTab
                  key={tab.id}
                  tab={tab}
                  active={tab.id === activeTabId}
                  hasMultipleTabs={hasMultipleTabs}
                  focusable={tab.id === focusableTabId}
                  insertionSide={overId === tab.id && draggedIndex >= 0 && overIndex !== draggedIndex
                    ? overIndex > draggedIndex ? "right" : "left"
                    : null}
                  onActivateTab={handleActivateTab}
                  onCloseTab={onCloseTab}
                  onFocusTab={setFocusedTabId}
                  onKeyDown={handleTabKeyDown}
                  onPrepareDrag={(event) => {
                    suppressClick.current = false;
                    if (hasMultipleTabs && event.pointerType === "mouse" && event.button === 0) {
                      pointerRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
                    }
                  }}
                />
              ))}
            </SortableContext>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {draggingTab ? (
            <div
              aria-hidden="true"
              style={{ width: dragWidth }}
              className={cn(
                workspaceTabFrameClassName,
                WORKSPACE_TAB_WIDTH_CLASS_NAME,
                "cursor-grabbing border-[var(--emr-topbar-tab-active-border)] bg-[var(--emr-topbar-tab-active-bg)] shadow-[var(--clair-shadow-md)]",
              )}
            >
              <span className={cn(workspaceTabButtonClassName, "flex items-center text-[var(--emr-topbar-tab-active-text)]")}>
                <WorkspaceTabLabel tab={draggingTab} active={draggingTab.id === activeTabId} />
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="새 업무 탭"
        onClick={onNewTab}
        className="size-[var(--emr-topbar-control-size)] shrink-0 rounded-[var(--emr-topbar-control-radius)] border-transparent bg-transparent text-[var(--emr-topbar-icon)] shadow-none hover:bg-[var(--emr-topbar-tab-hover-bg)] hover:text-[var(--emr-topbar-icon-strong)]"
      >
        <CdsActionsPlusIcon className="size-4" aria-hidden="true" />
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
  );
}
