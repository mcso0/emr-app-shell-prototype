import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | undefined>, ref: { current: null as unknown },
  state: { key: "", data: null as unknown }, callback: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  unsubscribe: vi.fn(), assignInvoice: vi.fn(), clearInvoiceAssignee: vi.fn(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => (() => void) | undefined) => { mocks.effects.push(effect); },
  useRef: () => mocks.ref,
  useState: () => [mocks.state, (next: typeof mocks.state) => { mocks.state = next; }],
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock("@/features/auth/auth-client", () => ({ useAuthClient: () => ({ session: null }) }));
vi.mock("@/features/work-queue/queue-realtime-refresh", () => ({ useQueueRealtimeRefresh: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getAuthRuntimeMode: () => ({ authProvider: "supabase" }) }));
vi.mock("@/lib/supabase/client", () => ({ getBrowserSupabaseClient: () => ({ auth: {
  onAuthStateChange: (callback: typeof mocks.callback) => { mocks.callback = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; },
} }) }));
vi.mock("@/features/billing/store", () => ({ useBillingStore: { getState: () => mocks } }));
import { useCurrentPersonalProfile } from "../src/features/auth/use-current-personal-profile";
import { useBillingAssignment } from "../src/features/billing/use-billing-assignment";
import { getSharedReadActorScope, subscribeSharedReadActorScope } from "../src/features/auth/shared-read-actor-scope";
const assignment = { revision: 1, canManage: true, assignedToUserId: "synthetic-a", assignedToDisplayName: "합성 A", assignees: [] };
const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
let browser: EventTarget, fetcher: ReturnType<typeof vi.fn>;
const cleanups: Array<() => void> = [];
const settle = () => vi.advanceTimersByTimeAsync(0);
function auth(userId: string | null, event = "SIGNED_IN") { mocks.callback!(event, userId ? { user: { id: userId } } : null); }
function AssignmentHook() { return useBillingAssignment("synthetic-workspace", "synthetic-invoice"); }
function mount() { const hook = AssignmentHook(); mocks.effects.splice(0).forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }); return hook; }
beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.effects.length = 0; mocks.ref.current = null; mocks.state = { key: "", data: null };
  browser = Object.assign(new EventTarget(), { setInterval, clearInterval, sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null } });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  fetcher = vi.fn().mockImplementation(async (_url: string, options: RequestInit) => json(options.method === "PATCH" ? { ok: true } : { ok: true, assignment }));
  vi.stubGlobal("fetch", fetcher);
  cleanups.push(subscribeSharedReadActorScope(() => {})); auth("synthetic-a", "INITIAL_SESSION"); await settle();
});
afterEach(async () => { cleanups.splice(0).reverse().forEach(fn => fn()); await settle(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("actual hook uses one post-PATCH GET while an older GET is pending and shares its assignment event", async () => {
  mount(); await settle();
  const hook = AssignmentHook();
  const old = deferred<Response>(); fetcher.mockReturnValueOnce(old.promise);
  const automatic = hook.refresh(); await settle();
  expect(await hook.transition("assign", "synthetic-b")).toBe(true);
  expect(fetcher.mock.calls.filter(([, options]) => options.method !== "PATCH")).toHaveLength(3); // startup, old, post-PATCH
  expect(fetcher.mock.calls.find(([, options]) => options.method === "PATCH")![1].body).toContain('"expectedRevision":1');
  old.resolve(json({ ok: true, assignment: { ...assignment, revision: 0, canManage: false } })); await automatic;
  expect(mocks.state.data).toEqual(assignment);
});

it("each successive PATCH completion starts a newer GET and the oldest response cannot overwrite it", async () => {
  mount(); await settle(); const hook = AssignmentHook();
  const firstRead = deferred<Response>();
  fetcher.mockImplementation(async (_url: string, options: RequestInit) => options.method === "PATCH" ? json({ ok: true }) : firstRead.promise);
  const first = hook.transition("assign", "synthetic-b"); await settle();
  fetcher.mockImplementation(async (_url: string, options: RequestInit) => json(options.method === "PATCH" ? { ok: true } : { ok: true, assignment: { ...assignment, revision: 3 } }));
  expect(await hook.transition("assign", "synthetic-c")).toBe(true);
  expect(mocks.state.data).toEqual({ ...assignment, revision: 3 });
  firstRead.resolve(json({ ok: true, assignment: { ...assignment, revision: 2 } })); await first;
  expect(mocks.state.data).toEqual({ ...assignment, revision: 3 });
  expect(fetcher.mock.calls.filter(([, options]) => options.method === "PATCH")).toHaveLength(2);
});

it.each(["switch", "logout"])("rejects late PATCH completion immediately after %s, before React cleanup", async mode => {
  mount(); await settle(); const hook = AssignmentHook(); const patch = deferred<Response>(); fetcher.mockReturnValueOnce(patch.promise);
  const pending = hook.transition("assign", "synthetic-b"); await settle();
  if (mode === "switch") auth("synthetic-b"); else browser.dispatchEvent(new Event("clair:session-ended"));
  expect(mocks.state.data).toBeNull();
  expect(mocks.clearInvoiceAssignee).toHaveBeenCalledWith("synthetic-invoice");
  const calls = fetcher.mock.calls.length;
  patch.resolve(json({ ok: true })); expect(await pending).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(calls);
  expect(await hook.transition("claim")).toBe(false);
});

it("discards an old user's pending GET and a same-user logout creates a new auth epoch", async () => {
  const old = deferred<Response>(); fetcher.mockReturnValueOnce(old.promise); mount(); await settle();
  const originalScope = getSharedReadActorScope(); auth("synthetic-a", "TOKEN_REFRESHED"); expect(getSharedReadActorScope()).toBe(originalScope);
  auth(null, "SIGNED_OUT"); expect(mocks.state.data).toBeNull();
  auth("synthetic-a"); expect(getSharedReadActorScope()).not.toBe(originalScope);
  mocks.effects.length = 0; mount(); await settle(); expect(mocks.state.data).toEqual(assignment);
  mocks.assignInvoice.mockClear(); old.resolve(json({ ok: true, assignment: { ...assignment, revision: 99 } })); await settle();
  expect(mocks.assignInvoice).not.toHaveBeenCalled(); expect(mocks.state.data).toEqual(assignment);
});

it("failed PATCH or failed post-PATCH GET clears authority and the next refresh retries", async () => {
  mount(); await settle(); const hook = AssignmentHook();
  fetcher.mockResolvedValueOnce(json({ ok: false }, false)).mockRejectedValueOnce(new Error("synthetic read failure"));
  expect(await hook.transition("claim")).toBe(false); expect(mocks.state.data).toBeNull();
  await hook.refresh(); expect(mocks.state.data).toEqual(assignment);
});


it("waits for a live actor before reading and a switch isolates actual profile-hook replies", async () => {
  auth(null, "SIGNED_OUT"); mount(); await settle(); expect(fetcher).not.toHaveBeenCalled();
  auth("synthetic-a");
  const old = deferred<Response>(); fetcher.mockReturnValueOnce(old.promise);
  const session = { provider: "supabase" as const, role: "supabase" as const, id: "supabase-session-synthetic-a", userId: "synthetic-a", email: null, roleLabel: "합성", storageMode: "cookie" as const, issuedAt: "2026-10-20" };
  mocks.effects.length = 0;
  useCurrentPersonalProfile({ hydrated: true, session });
  mocks.effects.splice(0).forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  await settle(); expect(fetcher).toHaveBeenCalledTimes(1);
  auth("synthetic-b");
  expect(useCurrentPersonalProfile({ hydrated: true, session })).toBeNull();
  old.resolve(json({ ok: true, profile: { sessionId: "synthetic-a", displayName: "stale", initials: "A" } })); await settle();
  expect((mocks.state as unknown as { profile: unknown }).profile).toBeNull();
});


it("ignores a disposed auth subscription callback after a newer subscription has started", async () => {
  const oldCallback = mocks.callback!;
  cleanups.splice(0).forEach(cleanup => cleanup()); await settle();
  cleanups.push(subscribeSharedReadActorScope(() => {})); auth("synthetic-b", "INITIAL_SESSION");
  const current = getSharedReadActorScope();
  oldCallback("SIGNED_IN", { user: { id: "synthetic-a" } });
  expect(getSharedReadActorScope()).toBe(current);
});
