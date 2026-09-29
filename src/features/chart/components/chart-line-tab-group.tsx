import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TabItem<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  count?: number;
};

function tabClassName(selected: boolean) {
  return cn(
    "relative inline-flex h-full shrink-0 items-center whitespace-nowrap border-b-2 border-transparent px-0 pt-3 pb-2.5 text-[13px] font-medium leading-[18px] tracking-[.247px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    selected && "border-foreground font-semibold text-foreground",
  );
}

export function ChartLineTabGroup<TValue extends string>({
  "aria-label": ariaLabel,
  items,
  onValueChange,
  value,
}: {
  items: Array<TabItem<TValue>>;
  "aria-label": string;
  onValueChange: (value: TValue) => void;
  value: TValue;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef(new Map<TValue, HTMLButtonElement>());
  const [hasOverflow, setHasOverflow] = useState(false);
  const [hasLeftOverflow, setHasLeftOverflow] = useState(false);
  const [hasRightOverflow, setHasRightOverflow] = useState(false);
  const [hiddenValues, setHiddenValues] = useState<TValue[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const itemsRef = useRef(items);
  const tabKey = items.map((item) => item.value).join("|");

  const measureTabs = useCallback(() => {
    const shell = shellRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!shell || !viewport || !track) return;

    // Test intrinsic tab width against the full row width. The More control
    // then takes its own fixed space, without creating resize hysteresis.
    const overflow = track.scrollWidth > shell.clientWidth + 1;
    const left = viewport.scrollLeft > 1;
    const right = track.scrollWidth - viewport.clientWidth - viewport.scrollLeft > 1;
    const bounds = viewport.getBoundingClientRect();
    const hidden = itemsRef.current.flatMap((item) => {
      const element = tabRefs.current.get(item.value);
      if (!element) return [];
      const rect = element.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
        ? [item.value]
        : [];
    });

    setHasOverflow(overflow);
    setHasLeftOverflow(left);
    setHasRightOverflow(right);
    setViewportWidth((current) => current === viewport.clientWidth ? current : viewport.clientWidth);
    setHiddenValues((current) =>
      current.length === hidden.length && current.every((item, index) => item === hidden[index])
        ? current
        : hidden,
    );
    if (!overflow) setMenuOpen(false);
  }, []);

  const revealTab = useCallback((tabValue: TValue) => {
    const viewport = viewportRef.current;
    const element = tabRefs.current.get(tabValue);
    if (!viewport || !element) return;
    const viewportBounds = viewport.getBoundingClientRect();
    const tabBounds = element.getBoundingClientRect();
    if (tabBounds.left < viewportBounds.left) {
      viewport.scrollLeft -= viewportBounds.left - tabBounds.left + 8;
    } else if (tabBounds.right > viewportBounds.right) {
      viewport.scrollLeft += tabBounds.right - viewportBounds.right + 8;
    }
    measureTabs();
  }, [measureTabs]);

  useLayoutEffect(() => {
    itemsRef.current = items;
    measureTabs();
  }, [items, measureTabs, tabKey]);

  useLayoutEffect(() => {
    measureTabs();
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const shell = shellRef.current;
    if (!shell || !viewport || !track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureTabs);
    observer.observe(shell);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measureTabs, tabKey, hasOverflow]);

  useLayoutEffect(() => {
    revealTab(value);
  }, [revealTab, tabKey, value, hasOverflow, viewportWidth]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const targetIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowRight"
          ? (index + 1) % items.length
          : event.key === "ArrowLeft"
            ? (index + items.length - 1) % items.length
            : null;
    if (targetIndex === null) return;
    event.preventDefault();
    const next = items[targetIndex];
    if (!next) return;
    onValueChange(next.value);
    requestAnimationFrame(() => tabRefs.current.get(next.value)?.focus({ preventScroll: true }));
  };

  const hiddenItems = items.filter((item) => hiddenValues.includes(item.value));

  return (
    <div ref={shellRef} className="flex min-w-0 flex-1 items-stretch gap-2">
      <div className="relative min-w-0 flex-1">
        <div
          ref={viewportRef}
          className="h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={measureTabs}
        >
          <div ref={trackRef} className="flex h-full min-w-max items-stretch gap-3" role="tablist" aria-label={ariaLabel}>
            {items.map((item, index) => (
              <button
                key={item.value}
                ref={(element) => {
                  if (element) tabRefs.current.set(item.value, element);
                  else tabRefs.current.delete(item.value);
                }}
                type="button"
                role="tab"
                data-soap-system-tab={item.value}
                aria-selected={value === item.value}
                aria-controls="chart-soap-editor-panel"
                tabIndex={value === item.value ? 0 : -1}
                className={tabClassName(value === item.value)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                onClick={() => {
                  onValueChange(item.value);
                  revealTab(item.value);
                }}
              >
                <span>{item.label}</span>
                {typeof item.count === "number" ? <span className="ml-1 font-semibold tabular-nums">{item.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
        {hasLeftOverflow ? <span aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0.5 left-0 z-10 w-5 bg-gradient-to-r from-[var(--emr-surface-panel)] to-transparent" /> : null}
        {hasRightOverflow ? <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 bottom-0.5 z-10 w-5 bg-gradient-to-l from-[var(--emr-surface-panel)] to-transparent" /> : null}
      </div>
      {hasOverflow ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            ref={moreRef}
            aria-label="숨긴 진단계통 더보기"
            title="숨긴 진단계통"
            className="my-auto inline-flex h-7 shrink-0 items-center rounded-lg bg-transparent px-2 text-[13px] font-normal leading-[18px] tracking-[.247px] text-foreground outline-none transition-colors hover:bg-[var(--emr-state-hover)] aria-expanded:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            더보기
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>숨긴 진단계통</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={value}
                onValueChange={(nextValue) => {
                  const nextTab = nextValue as TValue;
                  onValueChange(nextTab);
                  setMenuOpen(false);
                  requestAnimationFrame(() => revealTab(nextTab));
                }}
              >
                {hiddenItems.map((item) => (
                  <DropdownMenuRadioItem
                    key={item.value}
                    value={item.value}
                    className="h-8 cursor-pointer"
                    onClick={() => {
                      setMenuOpen(false);
                      requestAnimationFrame(() => {
                        revealTab(item.value);
                        tabRefs.current.get(item.value)?.focus({ preventScroll: true });
                      });
                    }}
                  >
                    {item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
