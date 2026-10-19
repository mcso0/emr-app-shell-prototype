// Share only a pending client read, never a resolved result or server authority.
export function coalescePendingRefresh<Result>(refresh: () => Promise<Result>) {
  let pending: Promise<Result> | undefined;
  return () => {
    if (pending) return pending;
    try {
      pending = refresh().finally(() => {
        pending = undefined;
      });
    } catch (error) {
      return Promise.reject(error);
    }
    return pending;
  };
}

export function subscribeVisibleRefresh({
  onRefresh,
  intervalMs,
}: {
  onRefresh: (reason: "interval" | "resume") => void;
  intervalMs?: number;
}) {
  let previousResume: { type: string; at: number } | undefined;
  const resume = (event: Event) => {
    if (document.visibilityState !== "visible") {
      previousResume = undefined;
      return;
    }
    const now = Date.now();
    // Browsers commonly emit both events for one return to the tab. Keep the
    // first refresh immediate, even when its network request finishes quickly.
    if (previousResume && previousResume.type !== event.type && now - previousResume.at < 250) return;
    previousResume = { type: event.type, at: now };
    onRefresh("resume");
  };
  const timer = intervalMs === undefined ? undefined : window.setInterval(() => {
    if (document.visibilityState === "visible") onRefresh("interval");
  }, intervalMs);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", resume);
  return () => {
    if (timer !== undefined) window.clearInterval(timer);
    window.removeEventListener("focus", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}


// A mounted browser resource owns one scheduler and shares its accepted snapshot.
// It is discarded on last unsubscribe; this is not a persistent authority cache.
export function createSharedVisibleResource<Value>({
  initialValue, intervalMs, load, onValue, onStart, onDispose,
}: {
  initialValue: Value;
  intervalMs?: number;
  load: (signal: AbortSignal) => Promise<Value | undefined>;
  onValue?: (value: Value) => void;
  onStart?: (resource: { refresh: (force?: boolean) => Promise<void>; publish: (value: Value) => void; dispose: () => void }) => (() => void);
  onDispose?: () => void;
}) {
  const listeners = new Set<(value: Value) => void>();
  let value = initialValue;
  let sequence = 0;
  let disposed = false;
  let pending: Promise<void> | undefined;
  let queuedInvalidation: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let stop: (() => void) | undefined;
  function publish(next: Value) {
    if (disposed) return;
    value = next;
    onValue?.(next);
    listeners.forEach(listener => listener(value));
  }
  function refresh(force = false): Promise<void> {
    if (disposed) return Promise.resolve();
    if (!force && pending) return pending;
    const version = ++sequence;
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    const request = Promise.resolve().then(() => {
      if (disposed || version !== sequence) return undefined;
      return load(requestController.signal);
    }).then(next => {
      if (!disposed && version === sequence && next !== undefined) publish(next);
    }).catch(() => {
      // Unexpected reader failures must release the pending slot for retry.
      // Feature readers own their existing fallback/error-state policy.
    }).finally(() => {
      if (pending === request) pending = undefined;
    });
    pending = request;
    return request;
  }
  function invalidate(): Promise<void> {
    if (queuedInvalidation) return queuedInvalidation;
    // Group synchronous consumers of one broadcast, not later broadcasts that
    // arrive while its request is pending. Each later invalidation supersedes it.
    const queued = Promise.resolve().then(() => {
      if (queuedInvalidation === queued) queuedInvalidation = undefined;
      return refresh(true);
    });
    queuedInvalidation = queued;
    return queued;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    sequence++;
    controller?.abort();
    stop?.();
    value = initialValue;
    listeners.forEach(listener => listener(value));
    listeners.clear();
    onDispose?.();
  }
  return {
    refresh, publish, dispose, isDisposed: () => disposed,
    invalidate,
    subscribe(listener: (value: Value) => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      listener(value);
      if (listeners.size === 1) {
        const removeEvents = onStart?.({ refresh, publish, dispose });
        if (disposed) { removeEvents?.(); return () => {}; }
        const removeRefresh = intervalMs === undefined ? undefined : subscribeVisibleRefresh({ intervalMs, onRefresh: () => { void refresh(); } });
        window.addEventListener("clair:session-ended", dispose);
        stop = () => {
          removeEvents?.();
          removeRefresh?.();
          window.removeEventListener("clair:session-ended", dispose);
        };
        if (document.visibilityState === "visible") void refresh();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) dispose();
      };
    },
  };
}
