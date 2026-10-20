import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "../src/features/auth/auth-client";
import { subscribePersonalProfile } from "../src/features/auth/personal-profile-resource";
import { subscribeBillingAssignment } from "../src/features/billing/billing-assignment-resource";
import { createSharedVisibleResource } from "../src/lib/visible-refresh";

const stores = vi.hoisted(() => ({ assignInvoice: vi.fn(), clearInvoiceAssignee: vi.fn() }));
vi.mock("@/features/billing/store", () => ({ useBillingStore: { getState: () => stores } }));
const live: AuthSession = { provider: "supabase", id: "supabase-session-synthetic-a", userId: "synthetic-a", email: null, role: "supabase", roleLabel: "합성", storageMode: "cookie", issuedAt: "2026-10-20" };
const profile = { sessionId: "synthetic-a", displayName: "합성 A", initials: "A" };
const assignment = { revision: 1, canManage: true, assignedToUserId: "synthetic-a", assignedToDisplayName: "합성 A", assignees: [] };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const json = (value: unknown, ok = true) => ({ ok, json: async () => value }) as Response;
let browser: EventTarget;
let doc: EventTarget & { visibilityState: string };
let fetcher: ReturnType<typeof vi.fn>;
const cleanups: Array<() => void> = [];
const settle = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  browser = Object.assign(new EventTarget(), { setInterval, clearInterval });
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", doc);
  fetcher = vi.fn().mockImplementation(async (url: string) => json(url.includes("profile") ? { ok: true, profile } : { ok: true, assignment }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(async () => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  await settle();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers(); vi.unstubAllGlobals();
});
function profiles(count: number) { const listeners = Array.from({ length: count }, () => vi.fn()); listeners.forEach(listener => cleanups.push(subscribePersonalProfile(live, listener))); return listeners; }
function billing(count: number, invoiceId = "synthetic-invoice", actorScope = "actor-a") {
  const listeners = Array.from({ length: count }, () => vi.fn());
  return listeners.map(listener => {
    const subscription = subscribeBillingAssignment({ workspaceId: "synthetic-workspace", invoiceId, session: live, actorScope, listener });
    cleanups.push(subscription.unsubscribe); return { ...subscription, listener };
  });
}

describe("shared profile requests", () => {
  it.each([1, 3])("uses three GETs over eight visible minutes with %i consumers", async count => {
    const listeners = profiles(count); await settle();
    await vi.advanceTimersByTimeAsync(8 * 60_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    listeners.forEach(listener => expect(listener).toHaveBeenLastCalledWith(profile));
  });
  it("shares staggered mounts, skips hidden ticks, and immediately resumes once", async () => {
    profiles(1); await settle(); await vi.advanceTimersByTimeAsync(1000); profiles(2); await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    doc.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(8 * 60_000); expect(fetcher).toHaveBeenCalledTimes(1);
    doc.visibilityState = "visible"; browser.dispatchEvent(new Event("focus")); await settle();
    doc.dispatchEvent(new Event("visibilitychange")); await settle(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("invalidates a pending profile read after edits and retains fallback on failure", async () => {
    const old = deferred<Response>(); fetcher.mockReturnValueOnce(old.promise);
    const [listener] = profiles(3); await settle();
    const { PERSONAL_PROFILE_STORAGE_EVENT } = await import("../src/features/auth/personal-profile-session");
    browser.dispatchEvent(new Event(PERSONAL_PROFILE_STORAGE_EVENT)); await settle();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(listener).toHaveBeenLastCalledWith(profile);
    old.resolve(json({ ok: true, profile: { ...profile, displayName: "stale" } })); await settle();
    expect(listener).toHaveBeenLastCalledWith(profile);
    fetcher.mockRejectedValueOnce(new Error("synthetic failure"));
    await vi.advanceTimersByTimeAsync(4 * 60_000); expect(listener).toHaveBeenLastCalledWith(profile);
    await vi.advanceTimersByTimeAsync(4 * 60_000); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("does not request on hidden startup and never reuses a disposed login", async () => {
    doc.visibilityState = "hidden"; profiles(3); await settle(); expect(fetcher).not.toHaveBeenCalled();
    browser.dispatchEvent(new Event("clair:session-ended"));
    doc.visibilityState = "visible"; profiles(1); await settle(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("shared billing requests", () => {
  it.each([1, 3])("uses four GETs over thirty visible seconds with %i consumers", async count => {
    const subscriptions = billing(count); await settle(); await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(4);
    subscriptions.forEach(({ listener }) => expect(listener).toHaveBeenLastCalledWith(assignment));
    expect(stores.assignInvoice).toHaveBeenCalledTimes(4);
  });
  it("preserves the one scheduler through staggered mounts and partial unmount", async () => {
    const [first] = billing(1); await settle(); await vi.advanceTimersByTimeAsync(1000); billing(2); await settle();
    first.unsubscribe(); await vi.advanceTimersByTimeAsync(9000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    doc.visibilityState = "hidden"; await vi.advanceTimersByTimeAsync(30_000); expect(fetcher).toHaveBeenCalledTimes(2);
    doc.visibilityState = "visible"; browser.dispatchEvent(new Event("focus")); await settle();
    doc.dispatchEvent(new Event("visibilitychange")); await settle(); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("reads after mutation instead of sharing an older GET; the assignment event shares the newer read", async () => {
    const old = deferred<Response>(); fetcher.mockReturnValueOnce(old.promise);
    const subs = billing(3); await settle();
    const refreshed = subs[0].resource.refresh(true);
    browser.dispatchEvent(new Event("clair-billing-assignment")); await refreshed;
    expect(fetcher).toHaveBeenCalledTimes(2);
    old.resolve(json({ ok: true, assignment: { ...assignment, revision: 0, canManage: false } })); await settle();
    subs.forEach(({ listener }) => expect(listener).toHaveBeenLastCalledWith(assignment));
    fetcher.mockResolvedValueOnce(json({ ok: true, assignment: { ...assignment, revision: 2 } }));
    await subs[0].resource.refresh(true);
    expect(subs[2].listener).toHaveBeenLastCalledWith({ ...assignment, revision: 2 });
  });
  it("does not merge actor, invoice or workspace scopes and clears denied authority before retry", async () => {
    const [a] = billing(1); const [b] = billing(1, "synthetic-invoice", "actor-b"); billing(1, "another-invoice");
    const foreign = subscribeBillingAssignment({ workspaceId: "other-workspace", invoiceId: "synthetic-invoice", session: live, actorScope: "actor-a", listener: vi.fn() }); cleanups.push(foreign.unsubscribe);
    await settle(); expect(fetcher).toHaveBeenCalledTimes(4);
    fetcher.mockResolvedValueOnce(json({ ok: false }, false)); await a.resource.refresh(true);
    expect(a.listener).toHaveBeenLastCalledWith(null); expect(b.listener).toHaveBeenLastCalledWith(assignment);
    expect(stores.clearInvoiceAssignee).toHaveBeenCalled();
    fetcher.mockRejectedValueOnce(new Error("synthetic failure")); await a.resource.refresh(); expect(a.listener).toHaveBeenLastCalledWith(null);
    await a.resource.refresh(); expect(a.listener).toHaveBeenLastCalledWith(assignment);
  });
  it("suppresses old replies and store writes after logout, then starts a fresh same-actor resource", async () => {
    const old = deferred<Response>(); fetcher.mockReturnValueOnce(old.promise);
    const [a] = billing(1); await settle();
    browser.dispatchEvent(new Event("clair:session-ended"));
    expect(a.listener).toHaveBeenLastCalledWith(null); expect(vi.getTimerCount()).toBe(0);
    const [next] = billing(1); await settle(); expect(next.listener).toHaveBeenLastCalledWith(assignment);
    stores.assignInvoice.mockClear(); old.resolve(json({ ok: true, assignment: { ...assignment, revision: 99 } })); await settle();
    expect(stores.assignInvoice).not.toHaveBeenCalled(); expect(next.listener).toHaveBeenLastCalledWith(assignment);
  });
});

it("does not let an older read clear a newer pending slot", async () => {
  const old = deferred<string>(), newer = deferred<string>();
  const load = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
  const resource = createSharedVisibleResource({ initialValue: "", intervalMs: 10_000, load });
  cleanups.push(resource.subscribe(vi.fn())); await settle();
  const forced = resource.refresh(true); await settle();
  old.resolve("old"); await settle(); expect(resource.refresh()).toBe(forced);
  newer.resolve("new"); await forced;
});


it("groups a synchronous realtime burst but a later broadcast supersedes its pending GET", async () => {
  const first = deferred<Response>(), second = deferred<Response>();
  const [subscription] = billing(1); await settle();
  fetcher.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const initialInvalidation = subscription.resource.invalidate();
  expect(subscription.resource.invalidate()).toBe(initialInvalidation);
  await settle(); expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(25);
  const laterInvalidation = subscription.resource.invalidate();
  await settle(); expect(fetcher).toHaveBeenCalledTimes(3);
  second.resolve(json({ ok: true, assignment: { ...assignment, revision: 3 } })); await laterInvalidation;
  first.resolve(json({ ok: true, assignment: { ...assignment, revision: 2 } })); await initialInvalidation;
  expect(subscription.listener).toHaveBeenLastCalledWith({ ...assignment, revision: 3 });
});
