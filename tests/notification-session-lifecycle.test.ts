import { afterEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ callback: undefined as ((event: string, session: { access_token: string } | null) => void) | undefined, unsubscribe: vi.fn() }));
vi.mock("../src/lib/supabase/client", () => ({ getBrowserSupabaseClient: () => ({ auth: { onAuthStateChange: (callback: typeof sdk.callback) => { sdk.callback = callback; return { data: { subscription: { unsubscribe: sdk.unsubscribe } } }; } } }) }));
import { subscribeNotificationSessionLifecycle } from "../src/features/notifications/notification-session-lifecycle";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("notification auth lifecycle", () => {
  it("restarts an unchanged mounted user after local logout then same-user relogin", () => {
    const browser = new EventTarget(); vi.stubGlobal("window", browser);
    const onEnd = vi.fn(); const onChange = vi.fn();
    const dispose = subscribeNotificationSessionLifecycle({ onEnd, onChange });
    sdk.callback!("INITIAL_SESSION", { access_token: "synthetic-login-a" });
    browser.dispatchEvent(new Event("clair:session-ended"));
    sdk.callback!("SIGNED_OUT", null);
    sdk.callback!("SIGNED_IN", { access_token: "synthetic-login-b" });
    expect(onEnd).toHaveBeenCalledTimes(2); expect(onChange).toHaveBeenCalledOnce();
    sdk.callback!("SIGNED_IN", { access_token: "synthetic-login-b" });
    expect(onChange).toHaveBeenCalledOnce();
    dispose(); browser.dispatchEvent(new Event("clair:session-ended"));
    expect(onEnd).toHaveBeenCalledTimes(2); expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });
  it("keeps token refresh/focus intact but immediately disposes recovery and missing sessions", () => {
    vi.stubGlobal("window", new EventTarget());
    const onEnd = vi.fn(); const onChange = vi.fn();
    const dispose = subscribeNotificationSessionLifecycle({ onEnd, onChange });
    sdk.callback!("INITIAL_SESSION", { access_token: "synthetic-login-a" });
    sdk.callback!("TOKEN_REFRESHED", { access_token: "synthetic-refreshed-a" });
    sdk.callback!("SIGNED_IN", { access_token: "synthetic-refreshed-a" });
    expect(onEnd).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled();
    sdk.callback!("PASSWORD_RECOVERY", { access_token: "synthetic-recovery" });
    expect(onEnd).toHaveBeenCalledOnce();
    sdk.callback!("INITIAL_SESSION", null); expect(onEnd).toHaveBeenCalledTimes(2);
    dispose();
  });
});
