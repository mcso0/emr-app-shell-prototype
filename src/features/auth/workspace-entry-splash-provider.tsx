"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { WorkspaceEntryLoadingScreen } from "@/components/emr/workspace-entry-loading-screen";

type WorkspaceEntrySplashStatus = "idle" | "loading" | "ready";

type WorkspaceEntrySplashContextValue = {
  beginWorkspaceEntrySplash: () => void;
  completeWorkspaceEntrySplash: () => void;
};

const WorkspaceEntrySplashContext = createContext<WorkspaceEntrySplashContextValue | null>(null);

export function WorkspaceEntrySplashProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WorkspaceEntrySplashStatus>("idle");
  const active = status !== "idle";

  const beginWorkspaceEntrySplash = useCallback(() => {
    setStatus((current) => (current === "idle" ? "loading" : current));
  }, []);

  const completeWorkspaceEntrySplash = useCallback(() => {
    setStatus((current) => (current === "loading" ? "ready" : current));
  }, []);

  const contextValue = useMemo(
    () => ({ beginWorkspaceEntrySplash, completeWorkspaceEntrySplash }),
    [beginWorkspaceEntrySplash, completeWorkspaceEntrySplash]
  );

  return (
    <WorkspaceEntrySplashContext.Provider value={contextValue}>
      <div aria-hidden={active || undefined} className="contents" inert={active || undefined}>
        {children}
      </div>
      {active ? (
        <WorkspaceEntryLoadingScreen
          data-testid="login-workspace-entry-loading"
          ready={status === "ready"}
          onExitComplete={() => setStatus("idle")}
        />
      ) : null}
    </WorkspaceEntrySplashContext.Provider>
  );
}

export function useWorkspaceEntrySplash() {
  const context = useContext(WorkspaceEntrySplashContext);

  if (!context) {
    throw new Error("useWorkspaceEntrySplash must be used within WorkspaceEntrySplashProvider");
  }

  return context;
}
