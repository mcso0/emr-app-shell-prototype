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
  const resume = () => {
    if (document.visibilityState === "visible") onRefresh("resume");
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
