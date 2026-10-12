"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type EntrySession = {
  scrollTop: number;
  initialIds: Set<string>;
  lastIds: Set<string>;
  added: boolean;
  lockedTop: number | null;
};

/** Geometry for the chart's quick entry, outside the pinned table scroll canvas. */
export function useChartOrderQuickAddLayout({
  visible,
  open,
  sessionActive,
  orderIds,
  sorted,
  layoutKey,
}: {
  visible: boolean;
  open: boolean;
  sessionActive: boolean;
  orderIds: string[];
  sorted: boolean;
  layoutKey: unknown;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<EntrySession | null>(null);
  const wasOpenRef = useRef(false);
  const revealPendingRef = useRef(false);
  const [clearance, setClearance] = useState(0);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const composer = composerRef.current;
    const dock = dockRef.current;
    const owner = surface?.querySelector<HTMLElement>('[data-emr-pinned-table-scroll-owner="true"]');
    if (!surface || !owner) return;
    if (!sessionActive || !visible) {
      const previous = sessionRef.current;
      sessionRef.current = null;
      revealPendingRef.current = false;
      if (previous && !previous.added) owner.scrollTop = previous.scrollTop;
    } else if (!sessionRef.current) {
      sessionRef.current = {
        scrollTop: owner.scrollTop,
        initialIds: new Set(orderIds),
        lastIds: new Set(orderIds),
        added: false,
        lockedTop: null,
      };
    }
    const session = sessionRef.current;
    if (session) {
      const hasNew = orderIds.some((id) => !session.lastIds.has(id));
      if (orderIds.some((id) => !session.initialIds.has(id))) session.added = true;
      session.lastIds = new Set(orderIds);
      // Explicit sorting stays authoritative. Opening still reveals the entry point.
      if (open && ((!wasOpenRef.current) || (hasNew && !sorted))) {
        revealPendingRef.current = true;
        session.lockedTop = null;
      }
    }
    wasOpenRef.current = open;
    if (!visible || !composer) {
      if (dock) dock.hidden = true;
      setClearance(0);
      return;
    }
    const category = surface.querySelector<HTMLElement>('thead [data-column-id="orderType"]');
    const name = surface.querySelector<HTMLElement>('thead [data-column-id="displayName"]');
    const body = surface.querySelector("tbody");
    let dockTop = 0;
    let naturalTop = 0;
    let frame = 0;
    const updatePosition = (resizeNotification = false) => {
      if (!category || !name) return;
      const bounds = surface.getBoundingClientRect();
      const categoryBounds = category.getBoundingClientRect();
      const viewportBottom = owner.getBoundingClientRect().top - bounds.top + owner.clientHeight;
      const left = Math.max(12, categoryBounds.left - bounds.left + 12);
      const right = Math.min(bounds.width, name.getBoundingClientRect().right - bounds.left) - 12;
      const applyWidth = () => {
        composer.style.left = `${left}px`;
        composer.style.width = open ? `${Math.max(0, right - left)}px` : "max-content";
        composer.style.maxWidth = `${Math.max(0, bounds.width - left - 12)}px`;
      };
      if (open) applyWidth();
      const height = composer.offsetHeight;
      const headerBottom = categoryBounds.bottom - bounds.top;
      const rows = body?.querySelectorAll<HTMLElement>('tr[data-testid^="chart-order-row-"]');
      const first = rows?.[0];
      const last = rows?.[rows.length - 1];
      const lastBounds = last?.getBoundingClientRect();
      const rowHeight = first && lastBounds ? lastBounds.bottom - first.getBoundingClientRect().top : 0;
      const needed = height + 20;
      const overflowing = rowHeight > 0 && headerBottom + rowHeight + needed > viewportBottom;
      const nextClearance = overflowing ? needed : 0;
      dockTop = Math.max(headerBottom, viewportBottom - height - 12);
      naturalTop = lastBounds ? lastBounds.bottom - bounds.top + 8 : dockTop;
      const top = Math.max(headerBottom, Math.min(dockTop,
        open && session?.lockedTop != null ? session.lockedTop : naturalTop));
      if (!open) applyWidth();
      composer.style.top = `${top}px`;
      if (dock) {
        dock.hidden = !(open && overflowing);
        dock.style.top = `${Math.max(headerBottom, top - 8)}px`;
        dock.style.bottom = `${Math.max(0, bounds.height - viewportBottom)}px`;
      }
      if (nextClearance !== clearance) {
        if (resizeNotification) {
          // The browser callback must also commit the trailing row before paint.
          flushSync(() => setClearance(nextClearance));
        } else {
          setClearance(nextClearance);
        }
      }
    };
    // ResizeObserver supplies the idle position before paint without forcing
    // layout in the click handler. Opening still measures before revealing/focus.
    if (open) updatePosition();
    // Run after the conditional trailing row has acquired its measured height.
    if (open && revealPendingRef.current) {
      frame = requestAnimationFrame(() => {
        owner.scrollTop = owner.scrollHeight;
        updatePosition();
        if (session) session.lockedTop = Math.min(dockTop, naturalTop);
        revealPendingRef.current = false;
        updatePosition();
        composer.querySelector<HTMLInputElement>('[role="combobox"]')?.focus({ preventScroll: true });
      });
    }
    const observer = new ResizeObserver(() => updatePosition(true));
    [surface, composer, owner, category, name, body].forEach((node) => { if (node) observer.observe(node); });
    const updateAfterScroll = () => updatePosition();
    surface.addEventListener("scroll", updateAfterScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      surface.removeEventListener("scroll", updateAfterScroll, true);
    };
  }, [visible, open, sessionActive, orderIds, sorted, layoutKey, clearance]);

  return { surfaceRef, composerRef, dockRef, clearance };
}
