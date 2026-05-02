"use client";

import { create } from "zustand";
import {
  createMockAuthSession,
  logoutMockAuthSession,
  persistMockAuthSession,
  readMockAuthSessionFromStorage,
  type MockAuthRole,
  type MockAuthSession,
  type MockSessionStorageMode,
} from "@/features/auth/mock-session";

type MockAuthStore = {
  hydrated: boolean;
  session: MockAuthSession | null;
  hydrate: () => void;
  login: (role: MockAuthRole, storageMode: MockSessionStorageMode) => MockAuthSession;
  logout: () => void;
};

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return {
      sessionStorageLike: undefined,
      localStorageLike: undefined,
    };
  }

  return {
    sessionStorageLike: window.sessionStorage,
    localStorageLike: window.localStorage,
  };
}

export const useMockAuthStore = create<MockAuthStore>()((set) => ({
  hydrated: false,
  session: null,
  hydrate: () => {
    const { sessionStorageLike, localStorageLike } = getBrowserStorage();
    const session = readMockAuthSessionFromStorage(sessionStorageLike, localStorageLike);
    set({ hydrated: true, session });
  },
  login: (role, storageMode) => {
    const { sessionStorageLike, localStorageLike } = getBrowserStorage();
    const session = createMockAuthSession(role, storageMode);
    persistMockAuthSession(session, sessionStorageLike, localStorageLike);
    set({ hydrated: true, session });
    return session;
  },
  logout: () => {
    const { sessionStorageLike, localStorageLike } = getBrowserStorage();
    logoutMockAuthSession(sessionStorageLike, localStorageLike);
    set({ hydrated: true, session: null });
  },
}));
