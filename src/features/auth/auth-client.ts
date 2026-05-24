"use client";

import { useCallback, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  type MockAuthRole,
  type MockAuthSession,
  type MockSessionStorageMode,
} from "@/features/auth/mock-session";
import { useMockAuthStore } from "@/features/auth/session-store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  getAuthRuntimeMode,
  type AuthMode,
} from "@/lib/supabase/config";

export type SupabaseAuthSession = {
  provider: "supabase";
  id: string;
  userId: string;
  email: string | null;
  role: "supabase";
  roleLabel: string;
  storageMode: "cookie";
  issuedAt: string;
};

export type AuthSession = MockAuthSession | SupabaseAuthSession;

export type SignInWithMockRoleOptions = {
  forceProviderError?: boolean;
};

export type SignInWithPasswordCredentials = {
  email: string;
  password: string;
};

export type SignInWithEmailOtpCredentials = {
  email: string;
  redirectTo: string;
};

export type VerifyEmailOtpCredentials = {
  email: string;
  token: string;
};

export type AuthClient = {
  authMode: AuthMode;
  authProvider: "mock" | "supabase";
  supabaseConfigured: boolean;
  hydrated: boolean;
  session: AuthSession | null;
  hydrate: () => void;
  signInWithMockRole: (
    role: MockAuthRole,
    storageMode: MockSessionStorageMode,
    options?: SignInWithMockRoleOptions
  ) => Promise<AuthSession>;
  signInWithPassword: (credentials: SignInWithPasswordCredentials) => Promise<AuthSession>;
  signInWithEmailOtp: (credentials: SignInWithEmailOtpCredentials) => Promise<void>;
  verifyEmailOtp: (credentials: VerifyEmailOtpCredentials) => Promise<AuthSession>;
  signOut: () => Promise<void>;
};

const providerErrorPreviewDelayMs = 150;

function waitForProviderErrorPreview() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, providerErrorPreviewDelayMs);
  });
}

function createSupabaseAuthSession(user: User): SupabaseAuthSession {
  return {
    provider: "supabase",
    id: `supabase-session-${user.id}`,
    userId: user.id,
    email: user.email ?? null,
    role: "supabase",
    roleLabel: user.email ?? "Supabase 사용자",
    storageMode: "cookie",
    issuedAt: new Date().toISOString(),
  };
}

export function useAuthClient(): AuthClient {
  const mockHydrated = useMockAuthStore((state) => state.hydrated);
  const mockSession = useMockAuthStore((state) => state.session);
  const mockHydrate = useMockAuthStore((state) => state.hydrate);
  const login = useMockAuthStore((state) => state.login);
  const mockLogout = useMockAuthStore((state) => state.logout);
  const [supabaseHydrated, setSupabaseHydrated] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState<SupabaseAuthSession | null>(null);
  const runtimeMode = getAuthRuntimeMode();
  const useSupabase = runtimeMode.authProvider === "supabase";

  const hydrate = useCallback(() => {
    if (!useSupabase) {
      mockHydrate();
      return;
    }

    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setSupabaseHydrated(true);
      setSupabaseSession(null);
      return;
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      setSupabaseHydrated(true);
      setSupabaseSession(error || !data.user ? null : createSupabaseAuthSession(data.user));
    });
  }, [mockHydrate, useSupabase]);

  return {
    authMode: runtimeMode.authMode,
    authProvider: runtimeMode.authProvider,
    supabaseConfigured: runtimeMode.supabaseConfigured,
    hydrated: useSupabase ? supabaseHydrated : mockHydrated,
    session: useSupabase ? supabaseSession : mockSession,
    hydrate,
    signInWithMockRole: async (role, storageMode, options) => {
      if (options?.forceProviderError && process.env.NODE_ENV !== "production") {
        await waitForProviderErrorPreview();
        throw new Error("mock-provider-error");
      }

      return login(role, storageMode);
    },
    signInWithPassword: async ({ email, password }) => {
      const supabase = getBrowserSupabaseClient();

      if (!supabase) {
        throw new Error("supabase-not-configured");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        throw error ?? new Error("supabase-login-failed");
      }

      const session = createSupabaseAuthSession(data.user);
      setSupabaseHydrated(true);
      setSupabaseSession(session);

      return session;
    },
    signInWithEmailOtp: async ({ email, redirectTo }) => {
      const supabase = getBrowserSupabaseClient();

      if (!supabase) {
        throw new Error("supabase-not-configured");
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }
    },
    verifyEmailOtp: async ({ email, token }) => {
      const supabase = getBrowserSupabaseClient();

      if (!supabase) {
        throw new Error("supabase-not-configured");
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });

      if (error || !data.user) {
        throw error ?? new Error("supabase-otp-verify-failed");
      }

      const session = createSupabaseAuthSession(data.user);
      setSupabaseHydrated(true);
      setSupabaseSession(session);

      return session;
    },
    signOut: async () => {
      mockLogout();

      if (useSupabase) {
        const supabase = getBrowserSupabaseClient();
        await supabase?.auth.signOut({ scope: "local" });
        setSupabaseHydrated(true);
        setSupabaseSession(null);
      }
    },
  };
}
