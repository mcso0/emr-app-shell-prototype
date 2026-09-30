import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ effects: [] as Array<() => (() => void) | undefined>, client: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => (() => void) | undefined) => { mocks.effects.push(effect); },
}));
vi.mock("@/lib/supabase/client", () => ({ getBrowserSupabaseClient: mocks.client }));
import { WorkspaceStaffPresenceReporter } from "../src/features/staff/workspace-staff-presence";

beforeEach(() => { vi.useFakeTimers(); mocks.effects.length = 0; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function mount() {
  let status!: (value: string) => void;
  let consumed = 0;
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((callback: typeof status) => { status = callback; }),
    track: vi.fn(), untrack: vi.fn(), presenceState: () => ({}),
  };
  const client = {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "mock", user: { id: "synthetic-user" } } } }) },
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
    channel: vi.fn(() => channel), removeChannel: vi.fn(),
    rpc: vi.fn(() => ({ then: (resolve: (value: unknown) => unknown) => { consumed++; return Promise.resolve({ error: null }).then(resolve); } })),
  };
  mocks.client.mockReturnValue(client);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); }));
  WorkspaceStaffPresenceReporter({ workspaceId: "synthetic-workspace" });
  const cleanup = mocks.effects[0]()!;
  await vi.advanceTimersByTimeAsync(0);
  return { status: (value: string) => status(value), cleanup, client, channel, consumed: () => consumed };
}

it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])("stops actual reporter RPCs on %s and restarts one timer on reconnect", async (failure) => {
  const reporter = await mount();
  reporter.status("SUBSCRIBED");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(reporter.client.rpc).toHaveBeenCalledTimes(2);
  expect(reporter.consumed()).toBe(2);
  reporter.status(failure);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(180_000);
  expect(reporter.client.rpc).toHaveBeenCalledTimes(2);
  reporter.status("SUBSCRIBED");
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(reporter.client.rpc).toHaveBeenCalledTimes(4);
  expect(reporter.channel.track).toHaveBeenCalledTimes(2);
  reporter.cleanup();
  reporter.status("SUBSCRIBED");
  await vi.advanceTimersByTimeAsync(120_000);
  expect(reporter.client.rpc).toHaveBeenCalledTimes(4);
  expect(reporter.channel.untrack).toHaveBeenCalledTimes(1);
  expect(reporter.client.removeChannel).toHaveBeenCalledWith(reporter.channel);
});

it("a repeated subscribed callback replaces the interval, preserving immediate activity and track", async () => {
  const reporter = await mount();
  reporter.status("SUBSCRIBED");
  reporter.status("SUBSCRIBED");
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(reporter.client.rpc).toHaveBeenCalledTimes(3);
  reporter.cleanup();
  expect(vi.getTimerCount()).toBe(0);
});

it("unmount before session lookup completes never creates a channel or heartbeat", async () => {
  let resolve!: (value: unknown) => void;
  const session = new Promise((yes) => { resolve = yes; });
  const client = { auth: { getSession: () => session }, channel: vi.fn(), rpc: vi.fn() };
  mocks.client.mockReturnValue(client);
  WorkspaceStaffPresenceReporter({ workspaceId: "synthetic-workspace" });
  mocks.effects[0]()!();
  resolve({ data: { session: { access_token: "mock", user: { id: "synthetic-user" } } } });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(client.channel).not.toHaveBeenCalled();
  expect(client.rpc).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
