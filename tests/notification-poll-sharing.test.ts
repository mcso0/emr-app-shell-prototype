import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationPollSharing, type NotificationPollSharing, type NotificationSharingEnvironment } from "../src/features/notifications/notification-poll-sharing";
import { createNotificationSharingScope } from "../src/features/notifications/notification-sharing-scope";
import type { LiveNotificationSnapshotResult } from "../src/features/notifications/live-notifications-client";

function transport() {
  const channels = new Map<string, Set<{ receive?: (event: MessageEvent) => void }>>();
  const locks = new Set<string>();
  const messages: { kind: string; result?: LiveNotificationSnapshotResult }[] = [];
  const clients: { frozen: boolean; visible: boolean }[] = [];
  const environments = () => {
    const state = { frozen: false, visible: true };
    clients.push(state);
    const environment: NotificationSharingEnvironment = {
      now: () => Date.now(), visible: () => state.visible,
      everySecond: tick => { const timer = setInterval(() => { if (!state.frozen) tick(); }, 1000); return () => clearInterval(timer); },
      async claim(name, acquired) {
        await Promise.resolve();
        if (locks.has(name)) return;
        locks.add(name);
        try { await acquired(); } finally { locks.delete(name); }
      },
      channel(name) {
        const peer: { receive?: (event: MessageEvent) => void } = {};
        const peers = channels.get(name) ?? new Set();
        channels.set(name, peers); peers.add(peer);
        return {
          postMessage(message) { messages.push(message as { kind: string; result?: LiveNotificationSnapshotResult }); for (const other of peers) if (other !== peer) queueMicrotask(() => other.receive?.({ data: structuredClone(message) } as MessageEvent)); },
          addEventListener(_type, listener) { peer.receive = event => { if (!state.frozen) listener(event); }; },
          removeEventListener() { peer.receive = undefined; },
          close() { peers.delete(peer); },
        };
      },
    };
    return { environment, state };
  };
  return { environments, locks, messages };
}
const snapshot = (scope: string, badge = 1): LiveNotificationSnapshotResult => ({
  ok: true, sharingScope: scope, notifications: [], counts: { badge, unread: badge, important: badge, archived: 0 },
});
const failure = (status: number): LiveNotificationSnapshotResult => ({ ok: false, error: { status, code: "synthetic", message: "합성 오류", retryable: status >= 500 } });
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

describe("notification shared polling protocol", () => {
  const disposals: NotificationPollSharing[] = [];
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { disposals.splice(0).forEach(group => group.close()); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  function client(network: ReturnType<typeof transport>, scope = "alpha", publish = true) {
    const { environment, state } = network.environments();
    const received = vi.fn(); const invalidated = vi.fn(); const ended = vi.fn();
    const refresh = vi.fn(() => { if (publish) { const fence = group.readStarted(); group.publish(snapshot(scope), fence); } });
    const group: NotificationPollSharing = createNotificationPollSharing({ scope, environment, onRefresh: refresh, onSnapshot: received, onInvalidate: invalidated, onEnd: () => { ended(); group.close(); } })!;
    const polling = setInterval(() => { if (!state.frozen && state.visible) group.poll(); }, 30_000);
    const close = group.close.bind(group);
    group.close = options => { clearInterval(polling); close(options); };
    disposals.push(group);
    return { group, refresh, received, invalidated, ended, state };
  }
  it("uses one healthy owner and shares bounded rows/counts across two windows", async () => {
    const network = transport(); const first = client(network); const second = client(network);
    await flush();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(first.refresh).toHaveBeenCalledTimes(3);
    expect(second.refresh).not.toHaveBeenCalled();
    expect(second.received).toHaveBeenCalledTimes(3);
    expect(second.received).toHaveBeenLastCalledWith(snapshot("alpha"));
  });
  it("keeps different users, workspaces and login generations isolated", async () => {
    const network = transport(); const first = client(network, "user-a:workspace-a:login-1");
    const foreign = [client(network, "user-b:workspace-a:login-1"), client(network, "user-a:workspace-b:login-1"), client(network, "user-a:workspace-a:login-2")];
    await flush(); first.group.publish(snapshot("user-a:workspace-a:login-1", 9), first.group.readStarted()); await flush();
    for (const other of foreign) expect(other.received).not.toHaveBeenCalled();
  });
  it("never broadcasts a new login generation payload into an old session channel", async () => {
    const network = transport(); const first = client(network, "alpha"); client(network, "alpha");
    await flush();
    first.group.publish(snapshot("beta", 99), first.group.readStarted()); await flush();
    expect(network.messages.filter(message => message.kind === "snapshot")).toEqual([]);
  });
  it("releases and suspends on pagehide even while visibility remains visible", async () => {
    const network = transport(); const first = client(network); const second = client(network);
    await flush(); first.group.suspend(); await flush();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(first.refresh).not.toHaveBeenCalled(); expect(second.refresh).toHaveBeenCalled();
    first.group.visibilityChanged(); second.group.close(); await flush();
    await vi.advanceTimersByTimeAsync(30_000); expect(first.refresh).toHaveBeenCalled();
  });
  it("releases hidden/closed leaders and lets a visible window take over", async () => {
    const network = transport(); const first = client(network); const second = client(network);
    await flush(); first.state.visible = false; first.group.visibilityChanged(); await flush();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(first.refresh).not.toHaveBeenCalled(); expect(second.refresh).toHaveBeenCalledTimes(1);
    first.state.visible = true; first.group.visibilityChanged(); second.group.close(); await flush();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(first.refresh).toHaveBeenCalled();
  });
  it("falls back while a frozen visible leader holds its lock, then recovers", async () => {
    const network = transport(); const first = client(network); const second = client(network);
    await flush(); first.state.frozen = true;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(second.refresh).toHaveBeenCalledTimes(1);
    expect(network.locks.size).toBe(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(second.refresh).toHaveBeenCalledTimes(2);
    first.state.frozen = false; first.group.close(); await flush();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(second.refresh).toHaveBeenCalledTimes(3);
  });
  it("does not let heartbeat traffic hide a stalled leader read beyond 30 seconds", async () => {
    const network = transport(); const first = client(network, "alpha", false); const second = client(network);
    await flush(); await vi.advanceTimersByTimeAsync(30_000);
    expect(first.refresh).toHaveBeenCalledTimes(1); expect(second.refresh).toHaveBeenCalledTimes(1);
  });
  it("invalidates older reads, requires the mutation ticket and forces a new leader read", async () => {
    const network = transport(); const first = client(network, "alpha", false); const second = client(network, "alpha", false);
    await flush(); const older = first.group.readStarted();
    second.group.invalidate(); await flush();
    expect(first.invalidated).toHaveBeenCalledOnce(); expect(first.refresh).toHaveBeenCalledWith("invalidate");
    expect(first.group.accepts(older)).toBe(false);
    first.group.publish(snapshot("alpha", 99), older); await flush(); expect(second.received).not.toHaveBeenCalled();
    first.group.publish(snapshot("alpha", 0), first.group.readStarted()); await flush();
    expect(second.received).toHaveBeenLastCalledWith(snapshot("alpha", 0));
  });
  it("falls back when an invalidation cannot reach a frozen leader", async () => {
    const network = transport(); const first = client(network, "alpha", false); const second = client(network);
    await flush(); first.state.frozen = true; second.group.invalidate(); await flush();
    await vi.advanceTimersByTimeAsync(5_000); expect(second.refresh).toHaveBeenCalled();
  });
  it("rejects an older shared result after a newer direct focus/retry read started", async () => {
    const network = transport(); const first = client(network); const second = client(network);
    await flush(); const older = first.group.readStarted();
    vi.setSystemTime(100); second.group.readStarted();
    first.group.publish(snapshot("alpha", 99), older); await flush();
    expect(second.received).not.toHaveBeenCalled();
  });
  it("shares failures and denials without using an aborted response", async () => {
    const network = transport(); const first = client(network); const second = client(network);
    await flush(); first.group.publish(failure(503), first.group.readStarted()); await flush();
    expect(second.received).toHaveBeenLastCalledWith(failure(503));
    first.group.publish(failure(403), first.group.readStarted()); await flush();
    expect(second.received).toHaveBeenLastCalledWith(failure(403));
    second.received.mockClear(); first.group.publish({ ...failure(0), aborted: true } as LiveNotificationSnapshotResult, first.group.readStarted()); await flush();
    expect(second.received).not.toHaveBeenCalled();
  });
  it("ends only matching sessions, closes listeners and rejects every late fence", async () => {
    const network = transport(); const first = client(network); const second = client(network); const foreign = client(network, "beta");
    await flush(); const late = first.group.readStarted();
    first.group.close({ sessionEnded: true }); await flush();
    expect(second.ended).toHaveBeenCalledOnce(); expect(foreign.ended).not.toHaveBeenCalled();
    expect(first.group.accepts(late)).toBe(false); first.group.publish(snapshot("alpha"), late); await flush();
    expect(second.received).not.toHaveBeenCalled();
  });
  it("returns the existing polling path when browser APIs or channel construction are unavailable", () => {
    vi.stubGlobal("navigator", {});
    expect(createNotificationPollSharing({ scope: "alpha", onRefresh: vi.fn(), onSnapshot: vi.fn(), onInvalidate: vi.fn(), onEnd: vi.fn() })).toBeUndefined();
    const { environment } = transport().environments();
    environment.channel = () => { throw new Error("unsupported"); };
    expect(createNotificationPollSharing({ scope: "alpha", environment, onRefresh: vi.fn(), onSnapshot: vi.fn(), onInvalidate: vi.fn(), onEnd: vi.fn() })).toBeUndefined();
  });
  it("builds opaque server keys from verified user/session/workspace and never shares without a session ID", () => {
    const input = { actorUserId: "synthetic-user", workspaceId: "alpha", sessionId: "login-1" };
    const key = createNotificationSharingScope(input);
    expect(createNotificationSharingScope(input)).toBe(key);
    expect(key).toMatch(/^[a-f0-9]{64}$/); expect(key).not.toContain("synthetic-user");
    expect(createNotificationSharingScope({ ...input, sessionId: "login-2" })).not.toBe(key);
    expect(createNotificationSharingScope({ ...input, actorUserId: "other" })).not.toBe(key);
    expect(createNotificationSharingScope({ ...input, workspaceId: "beta" })).not.toBe(key);
    expect(createNotificationSharingScope({ ...input, sessionId: null })).toBeUndefined();
  });
});
