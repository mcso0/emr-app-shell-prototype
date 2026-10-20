import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coalescePendingRefresh, subscribeVisibleRefresh } from "../src/lib/visible-refresh";

function deferred<Result>() {
  let resolve!: (value: Result) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Result>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("visible automatic refresh", () => {
  let browser: EventTarget;
  let doc: EventTarget & { visibilityState: string };
  beforeEach(() => {
    vi.useFakeTimers();
    browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
    doc = Object.assign(new EventTarget(), { visibilityState: "hidden" });
    vi.stubGlobal("window", browser);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); }));
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("skips hidden staff intervals/focus and resumes immediately on visible return", () => {
    const refresh = vi.fn();
    const cleanup = subscribeVisibleRefresh({ intervalMs: 60_000, onRefresh: refresh });
    vi.advanceTimersByTime(180_000);
    browser.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledWith("resume");
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenLastCalledWith("interval");
    cleanup();
  });

  it("collapses paired resume events after a fast read without delaying later focus or interval", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const refresh = coalescePendingRefresh(load);
    const cleanup = subscribeVisibleRefresh({ intervalMs: 30_000, onRefresh: () => { void refresh(); } });
    doc.visibilityState = "visible";
    browser.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(25);
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    browser.dispatchEvent(new Event("focus"));
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(29_725);
    expect(load).toHaveBeenCalledTimes(3);
    cleanup();
  });

  it("shares a slow notification read across focus, visibility and several 30-second ticks", async () => {
    const read = deferred<void>();
    const load = vi.fn(() => read.promise);
    const refresh = coalescePendingRefresh(load);
    const cleanup = subscribeVisibleRefresh({ intervalMs: 30_000, onRefresh: () => { void refresh(); } });
    doc.visibilityState = "visible";
    browser.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(90_000);
    expect(load).toHaveBeenCalledTimes(1);
    read.resolve();
    await refresh();
    browser.dispatchEvent(new Event("focus"));
    expect(load).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("shares chart startup/focus reads without retaining a completed result", async () => {
    const first = deferred<boolean>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const refresh = coalescePendingRefresh(load);
    const startup = refresh();
    const cleanup = subscribeVisibleRefresh({ onRefresh: () => { void refresh(); } });
    doc.visibilityState = "visible";
    browser.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(load).toHaveBeenCalledTimes(1);
    expect(refresh()).toBe(startup);
    first.resolve(true);
    await startup;
    expect(await refresh()).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it("cleans up every listener/timer while an old read is pending", async () => {
    const read = deferred<void>();
    const load = vi.fn(() => read.promise);
    const refresh = coalescePendingRefresh(load);
    const cleanup = subscribeVisibleRefresh({ intervalMs: 30_000, onRefresh: () => { void refresh(); } });
    doc.visibilityState = "visible";
    browser.dispatchEvent(new Event("focus"));
    cleanup();
    browser.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(90_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    read.resolve();
    await refresh();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("releases a failed read for retry and isolates new user/workspace scope", async () => {
    const read = deferred<void>();
    const load = vi.fn().mockReturnValueOnce(read.promise).mockResolvedValue(undefined);
    const oldScope = coalescePendingRefresh(load);
    const failed = oldScope();
    const otherLoad = vi.fn().mockResolvedValue(undefined);
    const newScope = coalescePendingRefresh(otherLoad);
    await newScope();
    expect(otherLoad).toHaveBeenCalledTimes(1);
    read.reject(new Error("read failed"));
    await expect(failed).rejects.toThrow("read failed");
    await oldScope();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not coalesce a required post-mutation read with an older automatic read", async () => {
    const old = deferred<string>();
    let sequence = 0;
    let accepted = "";
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue("after-mutation");
    const authoritativeRead = async () => {
      const version = ++sequence;
      const result = await load();
      if (version === sequence) accepted = result;
    };
    const automatic = coalescePendingRefresh(authoritativeRead);
    const pending = automatic();
    await authoritativeRead();
    expect(load).toHaveBeenCalledTimes(2);
    old.resolve("before-mutation");
    await pending;
    expect(accepted).toBe("after-mutation");
  });
});
