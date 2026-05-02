"use client";

import {
  type MockAuthRole,
  type MockAuthSession,
  type MockSessionStorageMode,
} from "@/features/auth/mock-session";
import { useMockAuthStore } from "@/features/auth/session-store";

export type AuthSession = MockAuthSession;

export type SignInWithMockRoleOptions = {
  forceProviderError?: boolean;
};

export type AuthClient = {
  hydrated: boolean;
  session: AuthSession | null;
  hydrate: () => void;
  signInWithMockRole: (
    role: MockAuthRole,
    storageMode: MockSessionStorageMode,
    options?: SignInWithMockRoleOptions
  ) => Promise<AuthSession>;
  signOut: () => void;
};

const providerErrorPreviewDelayMs = 150;

function waitForProviderErrorPreview() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, providerErrorPreviewDelayMs);
  });
}

export function useAuthClient(): AuthClient {
  const hydrated = useMockAuthStore((state) => state.hydrated);
  const session = useMockAuthStore((state) => state.session);
  const hydrate = useMockAuthStore((state) => state.hydrate);
  const login = useMockAuthStore((state) => state.login);
  const logout = useMockAuthStore((state) => state.logout);

  return {
    hydrated,
    session,
    hydrate,
    signInWithMockRole: async (role, storageMode, options) => {
      if (options?.forceProviderError && process.env.NODE_ENV !== "production") {
        await waitForProviderErrorPreview();
        throw new Error("mock-provider-error");
      }

      return login(role, storageMode);
    },
    signOut: logout,
  };
}
