import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { waitFor } from "storybook/test";
import { LoginForm } from "@/features/auth/login-form";
import { useMockAuthStore } from "@/features/auth/session-store";
import { WorkspaceEntrySplashProvider } from "@/features/auth/workspace-entry-splash-provider";
import { prepareAuthCallerStory } from "./auth-caller-parity.stories.fixture";

export const syntheticLoginNext = "/w/synthetic-login-workspace/reception?modulePanel=open";
export const syntheticLoginEmail = "synthetic-login@example.test";
export const syntheticOtpNext = "/invite/synthetic-login-invitation?workspaceId=synthetic-login-workspace&email=synthetic-login%40example.test";
export const loginRequests: Array<{ path: string; method: string; body: unknown }> = [];
type LoginFixtureLease = { unmount?: () => void };
let loginFixtureLease: LoginFixtureLease | null = null;

/** Reuse the exact mock-auth restoration boundary; no provider call is made. */
export function prepareLoginCallerStory({ otpRetry = false }: { otpRetry?: boolean } = {}) {
  const restoreAuth = prepareAuthCallerStory({ anonymous: true });
  const previousLease = loginFixtureLease;
  const lease: LoginFixtureLease = {};
  loginFixtureLease = lease;
  const previousRequests = loginRequests.slice();
  loginRequests.splice(0);
  const router = getRouter();
  const routeCallsBefore = router.replace.mock.calls.length;
  let sourceLoggedIn = false;
  const unsubscribe = useMockAuthStore.subscribe((state, previous) => {
    if (state.session && state.session !== previous.session) sourceLoggedIn = true;
  });
  const authFetch = globalThis.fetch;
  let otpAttempts = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.origin === window.location.origin && url.pathname === "/api/auth/invite-otp/request" && method === "POST") {
      loginRequests.push({ path: url.pathname, method, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      otpAttempts += 1;
      return Response.json({ ok: !otpRetry || otpAttempts > 1 }, { status: otpRetry && otpAttempts === 1 ? 503 : 200 });
    }
    // Existing auth fixture permits same-origin static assets and rejects other APIs/external requests.
    return authFetch(input, init);
  };
  let cleanupPromise: Promise<void> | undefined;
  return () => cleanupPromise ??= (async () => {
    // Unmount actual LoginForm/provider before shared stores/storage/fetch are restored.
    lease.unmount?.();
    unsubscribe();
    if (sourceLoggedIn) {
      // Mock sign-in persists synchronously; its source await continuation must also acknowledge navigation.
      await waitFor(() => {
        if (router.replace.mock.calls.length <= routeCallsBefore) throw new Error("Source mock login has not acknowledged navigation.");
      });
    }
    globalThis.fetch = authFetch;
    await restoreAuth();
    loginRequests.splice(0, loginRequests.length, ...previousRequests);
    loginFixtureLease = previousLease;
  })();
}

export function LoginCallerExample() {
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const lease = loginFixtureLease;
    if (!lease) return;
    const unmount = () => flushSync(() => setMounted(false));
    lease.unmount = unmount;
    return () => { if (lease.unmount === unmount) lease.unmount = undefined; };
  }, []);
  return mounted ? <WorkspaceEntrySplashProvider><LoginForm /></WorkspaceEntrySplashProvider> : <output>합성 로그인 화면이 해제되었습니다.</output>;
}
