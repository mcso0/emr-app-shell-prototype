"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmrContentLoadingState } from "./empty-state";

const ReadinessContext = createContext<((id: string, pending: boolean) => void) | null>(null);
const LoadingContext = createContext(false);
const IndicatorContext = createContext(true);

/** Share readiness across surfaces without hiding their structural frames. */
export function EmrPageLoadingProvider({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  const [readers, setReaders] = useState<ReadonlySet<string>>(() => new Set());
  const report = useCallback((id: string, pending: boolean) => {
    setReaders(previous => {
      if (previous.has(id) === pending) return previous;
      const next = new Set(previous);
      if (pending) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const pending = loading || readers.size > 0;
  const parentPending = useContext(LoadingContext);
  const masked = parentPending || pending;
  return <ReadinessContext.Provider value={report}>
    <LoadingContext.Provider value={masked}>
      <IndicatorContext.Provider value={!parentPending}>{children}</IndicatorContext.Provider>
    </LoadingContext.Provider>
  </ReadinessContext.Provider>;
}

/** Mask only the contents inside a persistent frame. */
export function EmrPageLoadingSurface({ children, className, contentClassName, showIndicator = true }: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  showIndicator?: boolean;
}) {
  const pending = useContext(LoadingContext);
  const showOwnIndicator = useContext(IndicatorContext);
  return <div className={cn("relative h-full min-h-0 min-w-0", className)} data-page-loading={pending ? "true" : "false"} aria-busy={pending}>
    <div className={cn("h-full min-h-0 min-w-0 [&>main]:h-full", contentClassName)} style={pending ? { visibility: "hidden" } : undefined} inert={pending || undefined} aria-hidden={pending || undefined} data-page-content="">
      {children}
    </div>
    {pending && <div className="absolute inset-0 z-40 bg-[var(--emr-surface-workspace)]" data-testid="page-loading-surface">
      {showIndicator && showOwnIndicator && <EmrContentLoadingState testId="page-loading-state" title="화면을 불러오는 중입니다" />}
    </div>}
  </div>;
}

/** Keep readers and drafts mounted. Only presentation and interaction are suspended. */
export function EmrPageLoadingBoundary({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return <EmrPageLoadingProvider loading={loading}><EmrPageLoadingSurface>{children}</EmrPageLoadingSurface></EmrPageLoadingProvider>;
}

/** Report required reads before paint; cleanup cannot clear another reader's state. */
export function usePageLoading(pending: boolean) {
  const report = useContext(ReadinessContext);
  const id = useId();
  useLayoutEffect(() => {
    report?.(id, pending);
    return () => report?.(id, false);
  }, [id, pending, report]);
}

/** Block once per identity/phase. Later same-page refreshes preserve the visible editor. */
export function usePageReadiness(pending: boolean, scope: string) {
  const [state, setState] = useState({ scope, settled: !pending });
  if (state.scope !== scope || (!pending && !state.settled)) {
    setState({ scope, settled: !pending });
  }
  usePageLoading(pending && (state.scope !== scope || !state.settled));
}

/** Portals must share the page's visibility and focus boundary. */
export function usePagePortalVisibility() {
  const hidden = useContext(LoadingContext);
  return useMemo(() => hidden ? { hidden: true, inert: true, "aria-hidden": true as const, style: { display: "none" } } : {}, [hidden]);
}
