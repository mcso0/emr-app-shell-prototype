import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { subscribeQueueRealtimeRefresh } from "../src/features/work-queue/queue-realtime-refresh";

const mock = vi.hoisted(() => ({
  broadcast: undefined as (() => void) | undefined,
  subscribe: vi.fn(), remove: vi.fn(), setAuth: vi.fn(),
  session: () => Promise.resolve({ data: { session: null } }),
}));
vi.mock("@/lib/supabase/client", () => ({ getBrowserSupabaseClient: () => ({
  auth: { getSession: () => mock.session() }, realtime: { setAuth: mock.setAuth },
  channel: () => ({ on(_event: string, _filter: unknown, callback: () => void) { mock.broadcast = callback; return { subscribe: mock.subscribe }; } }),
  removeChannel: mock.remove,
}) }));
const cleanups: Array<() => void> = [];
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mock.broadcast = undefined; mock.session = () => Promise.resolve({ data: { session: null } }); });
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.clearAllTimers(); vi.useRealTimers(); });
const settle = () => vi.advanceTimersByTimeAsync(0);
it("debounces bursts and queues a later refresh after an in-flight change", async () => {
  let finish!: () => void;
  const read = new Promise<void>(resolve => { finish = resolve; });
  const refresh = vi.fn().mockReturnValueOnce(read).mockResolvedValue(undefined);
  cleanups.push(subscribeQueueRealtimeRefresh({ workspaceId: "synthetic-alpha", onQueueChange: refresh })!);
  await settle(); expect(mock.subscribe).toHaveBeenCalledTimes(1);
  mock.broadcast!(); await vi.advanceTimersByTimeAsync(200); mock.broadcast!();
  await vi.advanceTimersByTimeAsync(399); expect(refresh).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(refresh).toHaveBeenCalledTimes(1);
  mock.broadcast!(); await vi.advanceTimersByTimeAsync(400); expect(refresh).toHaveBeenCalledTimes(1);
  finish(); await settle(); await vi.advanceTimersByTimeAsync(400); expect(refresh).toHaveBeenCalledTimes(2);
});
it("cleanup removes a channel and cancels pending timers without a later refresh", async () => {
  const refresh = vi.fn();
  const stop = subscribeQueueRealtimeRefresh({ workspaceId: "synthetic-alpha", onQueueChange: refresh })!;
  await settle(); mock.broadcast!(); stop(); await vi.advanceTimersByTimeAsync(400);
  expect(refresh).not.toHaveBeenCalled(); expect(mock.remove).toHaveBeenCalledTimes(1);
});
it("cleanup during auth initialization prevents a late subscription", async () => {
  let finish!: (value: { data: { session: null } }) => void;
  mock.session = () => new Promise(resolve => { finish = resolve; });
  const stop = subscribeQueueRealtimeRefresh({ workspaceId: "synthetic-alpha", onQueueChange: vi.fn() })!;
  stop(); finish({ data: { session: null } }); await settle();
  expect(mock.subscribe).not.toHaveBeenCalled(); expect(mock.remove).toHaveBeenCalledTimes(1);
});
