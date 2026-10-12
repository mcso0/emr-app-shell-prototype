import { AuthGate } from "@/features/auth/auth-gate";
import { WorkspaceOnboarding } from "@/features/auth/workspace-onboarding";
import { WorkspaceEntrySplashProvider } from "@/features/auth/workspace-entry-splash-provider";
import { TenantApprovalSurface } from "@/features/ops/tenant-approval-surface";
import { InviteAcceptanceScreen } from "@/features/auth/invite-acceptance-screen";
import type { InviteAcceptanceRecord } from "@/features/auth/invite-acceptance-model";
import { useMockAuthStore } from "@/features/auth/session-store";
import { createMockAuthSession, MOCK_AUTH_STORAGE_KEY, persistMockAuthSession, type MockAuthRole } from "@/features/auth/mock-session";
import {
  createEmptySessionWorkspacesState, createSessionWorkspace, createSessionWorkspaceInvitation, persistSessionWorkspacesState, SESSION_WORKSPACES_STORAGE_KEY,
  validateWorkspaceCreationInput, readSessionWorkspacesState, type WorkspaceCreationInput, type SessionWorkspaceMembership,
} from "@/features/auth/workspace-session";
import { PERSONAL_PROFILE_STORAGE_KEY } from "@/features/auth/personal-profile-session";
import { getAuthRuntimeMode } from "@/lib/supabase/config";

export type AuthCallerArgs = { scenario: "gate" | "onboarding" | "tenant" | "invite-new" | "invite-existing" | "invite-expired" | "invite-accepted" | "invite-missing" };
export const syntheticAuthSessionId = "synthetic-auth-session";
export const syntheticAuthCreatedAt = "2026-10-11T00:00:00.000Z";
const creator = { sessionId: syntheticAuthSessionId, storageMode: "session" as const };
export const syntheticAuthCreation = createSessionWorkspace({
  hospitalName: "Synthetic Auth Hospital", adminDisplayName: "합성 관리자", contactEmail: "synthetic-admin@example.test", contactPhone: "", subscriptionStatus: "trialing",
}, creator, syntheticAuthCreatedAt);
export const syntheticAuthWorkspaceId = syntheticAuthCreation.workspace.id;
export const syntheticInvitationId = "synthetic-invitation";
export const syntheticInviteEmail = "synthetic-invite@example.test";
export function syntheticInviteRecord(scenario: AuthCallerArgs["scenario"]): InviteAcceptanceRecord {
  if (scenario === "invite-missing") return { status: "missing", accountState: "unknown", workspace: null, invitation: null };
  const status = scenario === "invite-expired" ? "expired" : scenario === "invite-accepted" ? "accepted" : "pending";
  return {
    status, accountState: scenario === "invite-existing" ? "existing" : "new", workspace: syntheticAuthCreation.workspace,
    invitation: {
      ...createSessionWorkspaceInvitation({ email: syntheticInviteEmail, roles: ["vet"], title: "합성 수의사", department: "합성 부서" }, syntheticAuthWorkspaceId, creator, syntheticAuthCreatedAt),
      id: syntheticInvitationId, status, expiresAt: status === "expired" ? "2020-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z",
      acceptedAt: status === "accepted" ? syntheticAuthCreatedAt : null,
    },
  };
}
export const authApiRequests: Array<{ path: string; method: string; body: unknown }> = [];
// The actual mock acceptance workflow writes this receipt before its terminal event.
export const INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY = "clair.inviteAcceptance.v1";
type AuthFixtureOptions = {
  anonymous?: boolean;
  role?: MockAuthRole;
  access?: "active" | "inactive" | "unknown";
  workspaceReadError?: boolean;
  acceptRetry?: boolean;
  reinviteRetry?: boolean;
  deferWorkspaceCreate?: boolean;
};
type AuthRequestTicket = { parsed: boolean; ok: boolean; expectedWorkspaceId?: string; expectedRoute?: string; routeCallsBefore: number; eventsBefore: number };
type AuthCleanupReceipt = { unmounted: boolean; drainedRequests: number; workspaceEvents: number; terminalRoutes: string[]; storageRestored: boolean };
type AuthFixtureLease = { unmount?: () => void; release: Array<() => void>; tickets: AuthRequestTicket[]; workspaceEvents: number; cleanup?: () => Promise<AuthCleanupReceipt> };
let authFixtureLease: AuthFixtureLease | null = null;
export async function completeAuthCallerFixture() {
  if (!authFixtureLease?.cleanup) throw new Error("No current synthetic auth fixture.");
  return authFixtureLease.cleanup();
}

/** Preserve the existing mock provider and restore only keys and state touched by these examples. */
export function prepareAuthCallerStory(options: AuthFixtureOptions = {}) {
  if (getAuthRuntimeMode().authProvider !== "mock") throw new Error("Auth examples require the existing mock auth runtime.");
  const previousAuth = useMockAuthStore.getState();
  const previousLease = authFixtureLease;
  const lease: AuthFixtureLease = { release: [], tickets: [], workspaceEvents: 0 };
  authFixtureLease = lease;
  const recordWorkspaceEvent = () => { lease.workspaceEvents += 1; };
  window.addEventListener(SESSION_WORKSPACES_STORAGE_KEY, recordWorkspaceEvent);
  const keys = [MOCK_AUTH_STORAGE_KEY, SESSION_WORKSPACES_STORAGE_KEY, PERSONAL_PROFILE_STORAGE_KEY, INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY];
  const snapshots = [window.sessionStorage, window.localStorage].map(storage => ({ storage, values: keys.map(key => [key, storage.getItem(key)] as const) }));
  for (const { storage } of snapshots) for (const key of keys) storage.removeItem(key);
  const session = options.anonymous ? null : { ...createMockAuthSession(options.role ?? "hospital_admin", "session"), id: syntheticAuthSessionId, issuedAt: syntheticAuthCreatedAt };
  if (session) persistMockAuthSession(session, window.sessionStorage, window.localStorage);
  useMockAuthStore.setState({ hydrated: true, session });
  const workspaceState = createEmptySessionWorkspacesState(syntheticAuthCreatedAt);
  if (options.access && options.access !== "unknown") {
    workspaceState.workspaces = [syntheticAuthCreation.workspace];
    workspaceState.memberships = [{ ...syntheticAuthCreation.membership, status: options.access === "active" ? "active" : "inactive" }];
    workspaceState.currentWorkspaceId = syntheticAuthWorkspaceId;
  }
  if (options.access !== "unknown") persistSessionWorkspacesState(workspaceState, "session", window.sessionStorage, window.localStorage);
  const previousRequests = authApiRequests.slice();
  authApiRequests.splice(0);
  const previousFetch = globalThis.fetch;
  let acceptAttempts = 0;
  let reinviteAttempts = 0;
  function trackResponse(response: Response, terminal?: { workspaceId: string; route: string }) {
    const ticket: AuthRequestTicket = { parsed: false, ok: false, expectedWorkspaceId: terminal?.workspaceId, expectedRoute: terminal?.route, routeCallsBefore: getRouter().replace.mock.calls.length, eventsBefore: lease.workspaceEvents };
    lease.tickets.push(ticket);
    const readJson = response.json.bind(response);
    response.json = async () => {
      const value: unknown = await readJson();
      ticket.parsed = true;
      ticket.ok = response.ok && typeof value === "object" && value !== null && "ok" in value && value.ok === true;
      return value;
    };
    return response;
  }
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.origin === window.location.origin && !url.pathname.startsWith("/api/")) return previousFetch(input, init);
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    authApiRequests.push({ path: url.pathname, method, body });
    if (url.origin === window.location.origin && method === "POST" && url.pathname === `/api/workspaces/${syntheticAuthWorkspaceId}/invitations/${syntheticInvitationId}/accept`) {
      acceptAttempts += 1;
      if (options.acceptRetry && acceptAttempts === 1) return trackResponse(Response.json({ ok: false, denialReason: "synthetic-retry" }, { status: 503 }));
      const actor = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get("x-clair-demo-session-user-id") ?? "synthetic-invitee";
      const membership: SessionWorkspaceMembership = { ...syntheticAuthCreation.membership, id: "synthetic-invite-membership", userSessionId: actor, roles: ["vet"], permissionRoleKey: "standard", title: "합성 수의사", department: "합성 부서" };
      return trackResponse(Response.json({ ok: true, membership, sessionStatus: "active" }), { workspaceId: syntheticAuthWorkspaceId, route: `/w/${syntheticAuthWorkspaceId}/reception?modulePanel=open&aside=closed` });
    }
    if (url.origin === window.location.origin && method === "POST" && url.pathname === `/api/workspaces/${syntheticAuthWorkspaceId}/invitations/${syntheticInvitationId}/reinvite-request`) {
      reinviteAttempts += 1;
      return trackResponse(options.reinviteRetry && reinviteAttempts === 1
        ? Response.json({ ok: false, denialReason: "synthetic-retry" }, { status: 503 })
        : Response.json({ ok: true }));
    }
    if (url.origin === window.location.origin && url.pathname === "/api/workspaces") {
      if (method === "GET") return trackResponse(options.workspaceReadError
        ? Response.json({ ok: false }, { status: 503 })
        : Response.json({ ok: true, workspaces: [{ id: syntheticAuthWorkspaceId, status: "active" }] }));
      if (method === "POST") {
        const creationInput = body as WorkspaceCreationInput;
        const validation = validateWorkspaceCreationInput(creationInput);
        if (!validation.valid) return trackResponse(Response.json({ ok: false, error: "invalid_input", fieldErrors: validation.fieldErrors }, { status: 400 }));
        const created = createSessionWorkspace(creationInput, creator, syntheticAuthCreatedAt);
        const response = trackResponse(Response.json({ ok: true, ...created }), { workspaceId: created.workspace.id, route: `/w/${created.workspace.id}/home?modulePanel=open&aside=closed` });
        if (options.deferWorkspaceCreate) await new Promise<void>(resolve => lease.release.push(resolve));
        return response;
      }
    }
    return trackResponse(Response.json({ ok: false, reason: "unhandled-synthetic-request" }, { status: 503 }));
  };
  let completed: AuthCleanupReceipt | null = null;
  const cleanup = async (): Promise<AuthCleanupReceipt> => {
    if (completed) return completed;
    // Storybook runs this before teardownRender. Stop component effects first, then let already-started source commands finish.
    const unmounted = Boolean(lease.unmount);
    lease.unmount?.();
    for (const release of lease.release.splice(0)) release();
    await waitFor(() => {
      for (const ticket of lease.tickets) {
        // AuthGate skips JSON on non-2xx and ignores read continuations after unmount.
        // Failed/reinvite responses only update component state. Only create/accept
        // success can still write shared storage, dispatch an event and navigate.
        if (!ticket.expectedRoute) continue;
        if (!ticket.parsed) throw new Error("Synthetic auth response is still being consumed.");
        if (!ticket.ok) continue;
        const state = readSessionWorkspacesState(window.sessionStorage, window.localStorage);
        const hasRoute = getRouter().replace.mock.calls.slice(ticket.routeCallsBefore).some(([href]) => href === ticket.expectedRoute);
        if (state?.currentWorkspaceId !== ticket.expectedWorkspaceId || lease.workspaceEvents <= ticket.eventsBefore || !hasRoute) throw new Error("Source auth workflow has not completed its storage, workspace event and router acknowledgement.");
      }
    });
    window.removeEventListener(SESSION_WORKSPACES_STORAGE_KEY, recordWorkspaceEvent);
    globalThis.fetch = previousFetch;
    useMockAuthStore.setState(previousAuth);
    authApiRequests.splice(0, authApiRequests.length, ...previousRequests);
    for (const { storage, values } of snapshots) for (const [key, value] of values) {
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
    }
    completed = { unmounted, drainedRequests: lease.tickets.filter(ticket => ticket.expectedRoute).length, workspaceEvents: lease.workspaceEvents, terminalRoutes: lease.tickets.filter(ticket => ticket.ok && ticket.expectedRoute).map(ticket => ticket.expectedRoute!), storageRestored: snapshots.every(({ storage, values }) => values.every(([key, value]) => storage.getItem(key) === value)) };
    authFixtureLease = previousLease;
    return completed;
  };
  lease.cleanup = cleanup;
  return async () => { await cleanup(); };
}

/** Story-only composition selector; scenario is not an AuthGate or onboarding product prop. */
export function AuthCallerExample({ scenario }: AuthCallerArgs) {
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const lease = authFixtureLease;
    if (!lease) return;
    const unmount = () => flushSync(() => setMounted(false));
    lease.unmount = unmount;
    return () => { if (lease.unmount === unmount) lease.unmount = undefined; };
  }, []);
  let content: ReactNode;
  if (scenario === "onboarding") content = <WorkspaceOnboarding />;
  else if (scenario === "tenant") content = <TenantApprovalSurface />;
  else if (scenario.startsWith("invite-")) content = <InviteAcceptanceScreen invitationId={syntheticInvitationId} workspaceId={syntheticAuthWorkspaceId} email={syntheticInviteEmail} initialRecord={syntheticInviteRecord(scenario)} />;
  else content = <WorkspaceEntrySplashProvider><AuthGate workspaceId={syntheticAuthWorkspaceId}><main className="p-6"><h1>합성 접근 허용 콘텐츠</h1></main></AuthGate></WorkspaceEntrySplashProvider>;
  return mounted ? content : <output aria-label="합성 인증 화면 해제 결과">인증 화면이 해제되었습니다.</output>;
}
import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { waitFor } from "storybook/test";
