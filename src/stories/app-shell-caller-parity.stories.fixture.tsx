import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { waitFor } from "storybook/test";
import { CheckIcon } from "@/components/icons";
import { CdsFilesFileTextIcon } from "@/components/cds-icons/files-and-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmrInstructionHistoryToggle } from "@/components/emr/instruction-header-stack";
import { AuthProfileMenu } from "@/shell/auth-profile-menu";
import { WorkspaceChromeTabs, type WorkspaceChromeTabItem } from "@/shell/workspace-chrome-tabs";
import {
  WorkspaceDocumentToolbar,
  WorkspaceDocumentWidthToggle,
  useWorkspaceDocumentLayout,
} from "@/shell/workspace-document-layout";
import { WorkspaceFrame } from "@/shell/workspace-frame";
import { NavRail } from "@/shell/nav-rail";
import { GlobalCommandPalette } from "@/shell/global-command-palette";
import { WorkspaceTabsBar } from "@/shell/workspace-tabs-bar";
import { AppShell } from "@/shell/app-shell";
import { ShellMain } from "@/shell/shell-main";
import { WorkspaceEntrySplashProvider } from "@/features/auth/workspace-entry-splash-provider";
import { useInpatientStore } from "@/features/inpatient/store";
import { useMockAuthStore } from "@/features/auth/session-store";
import { createMockAuthSession, MOCK_AUTH_STORAGE_KEY, persistMockAuthSession } from "@/features/auth/mock-session";
import { PERSONAL_PROFILE_STORAGE_KEY } from "@/features/auth/personal-profile-session";
import { SESSION_WORKSPACES_STORAGE_KEY } from "@/features/auth/workspace-session";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import type { CommandSearchFilter, CommandSearchResponse } from "@/features/command/command-search";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { useLayoutStore } from "@/stores/layout-store";
import { useWorkspaceTabsStore, type WorkspaceTab } from "@/stores/workspace-tabs-store";
import type { ModuleDefinition, ShellComponentProps } from "@/types/emr";

export type AppShellCallerArgs = {
  scenario: "profile-menu" | "workspace-tabs" | "document-panels" | "nav-rail" | "global-search" | "workspace-controls" | "shell-main" | "app-root";
  compact: boolean;
};

export const syntheticShellWorkspaceId = "synthetic-shell-workspace";
export const commandSearchRequests: Array<{ query: string; filter: string }> = [];
export const navClickObservations: Array<{ phase: string; label: string | null; button: number; defaultPrevented: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = [];
function observeNavClick(phase: string, event: MouseEvent<HTMLElement>) {
  const link = event.target instanceof Element ? event.target.closest("a") : null;
  if (!link) return;
  navClickObservations.push({ phase, label: link.getAttribute("aria-label"), button: event.button, defaultPrevented: event.defaultPrevented, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey });
}

/** Only synthetic application requests are answered. Storage keys and stores are restored. */
export function prepareShellClientStory() {
  if (getAuthRuntimeMode().authProvider !== "mock") throw new Error("Shell examples require the existing mock auth runtime.");
  const previousLayout = useLayoutStore.getState();
  const previousAuth = useMockAuthStore.getState();
  const previousPatient = usePatientProfileStore.getState();
  const previousRequests = commandSearchRequests.slice();
  const previousClicks = navClickObservations.slice();
  const storageKeys = [MOCK_AUTH_STORAGE_KEY, PERSONAL_PROFILE_STORAGE_KEY, SESSION_WORKSPACES_STORAGE_KEY];
  const snapshots = [window.sessionStorage, window.localStorage].map(storage => ({ storage, values: storageKeys.map(key => [key, storage.getItem(key)] as const) }));
  for (const { storage } of snapshots) for (const key of storageKeys) storage.removeItem(key);
  const session = { ...createMockAuthSession("hospital_admin", "session"), id: "synthetic-shell-session", issuedAt: "2026-10-11T00:00:00.000Z" };
  persistMockAuthSession(session, window.sessionStorage, window.localStorage);
  useMockAuthStore.setState({ hydrated: true, session });
  useLayoutStore.setState({ modulePanelOpen: false, activeDrawer: null });
  commandSearchRequests.splice(0);
  navClickObservations.splice(0);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (url.origin === window.location.origin && !url.pathname.startsWith("/api/")) return previousFetch(input, init);
    if (url.origin === window.location.origin && url.pathname === `/api/workspaces/${syntheticShellWorkspaceId}/command/search`) {
      const query = url.searchParams.get("query") ?? "";
      const filter = (url.searchParams.get("filter") ?? "all") as CommandSearchFilter;
      commandSearchRequests.push({ query, filter });
      if (query === "합성 오류") return Response.json({ ok: false, error: "db_read_failed" } satisfies CommandSearchResponse, { status: 503 });
      const partial = query === "합성 일부";
      const result: CommandSearchResponse = {
        ok: true, query, filter, enforcedBy: "command-search",
        sourceState: { patientGuardian: partial ? "permission_denied" : "ready", reception: "ready", staff: "ready" },
        results: query === "합성 수의사" || partial ? [1, 2].map(index => ({
          id: `synthetic-staff-${index}`, kind: "staff", title: `${query} ${index}`, subtitle: "합성 병원 구성원", badge: "합성 구성원",
          href: `/w/${syntheticShellWorkspaceId}/orders?syntheticStaff=${index}`,
        })) : [],
      };
      return Response.json(result);
    }
    return Response.json({ ok: false, reason: "unhandled-synthetic-request" }, { status: 503 });
  };
  return () => {
    globalThis.fetch = previousFetch;
    useLayoutStore.setState(previousLayout);
    useMockAuthStore.setState(previousAuth);
    usePatientProfileStore.setState(previousPatient);
    commandSearchRequests.splice(0, commandSearchRequests.length, ...previousRequests);
    navClickObservations.splice(0, navClickObservations.length, ...previousClicks);
    for (const { storage, values } of snapshots) for (const [key, value] of values) {
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
    }
  };
}

export function NavRailCaller() {
  const [activeId, setActiveId] = useState("reception");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("초기 메뉴");
  return <div className="flex gap-4 p-4" onClickCapture={event => observeNavClick("capture", event)} onClick={event => observeNavClick("bubble", event)}>
    <div className="flex h-[720px]">
      <NavRail activeModuleId={activeId} workspaceId={syntheticShellWorkspaceId} navigationSearch="story=synthetic" previewEnabled previewModuleId={previewId}
        onNavigateModule={(href, moduleId) => { setActiveId(moduleId); setReceipt(`navigate:${href}`); }}
        onPreviewEnter={(id, _element, pointerType) => { setPreviewId(id); setReceipt(`preview:${id}:${pointerType}`); }}
        onPreviewLeave={() => setPreviewId(null)}
        onPreviewKeyboard={id => { setPreviewId(id); setReceipt(`keyboard:${id}`); }} />
    </div>
    <output aria-label="합성 메뉴 콜백">{receipt}</output>
  </div>;
}

export function GlobalSearchCaller() {
  return <div className="p-4"><GlobalCommandPalette workspaceId={syntheticShellWorkspaceId} /></div>;
}

const shellTab: WorkspaceTab = {
  id: "synthetic-shell-tab", title: "합성 업무", closable: true,
  history: [`/w/${syntheticShellWorkspaceId}/home`], historyIndex: 0, moduleId: "home", surfaceType: "module", surfaceId: "home",
  dedupeKey: "synthetic:home", lastRoute: `/w/${syntheticShellWorkspaceId}/home`, updatedAt: "2026-10-11T00:00:00.000Z",
};
export function WorkspaceControlsCaller() {
  const [back, setBack] = useState(false);
  const [forward, setForward] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [badge, setBadge] = useState(123);
  const [refreshing, setRefreshing] = useState(false);
  const [receipt, setReceipt] = useState("초기 상태");
  return <div className="grid gap-4 p-4">
    <div style={{ width: 1280 }}>
      <WorkspaceTabsBar activeTabId={shellTab.id} canGoBack={back} canGoForward={forward} tabs={[shellTab]} isRefreshing={refreshing} refreshLabel="합성 업무 새로고침" notificationBadgeCount={badge} notificationDrawerOpen={drawerOpen}
        onActivateTab={id => setReceipt(`activate:${id}`)} onCloseTab={id => setReceipt(`close:${id}`)} onNewTab={() => setReceipt("new-tab")}
        onBack={() => { setBack(false); setForward(true); setReceipt("back"); }}
        onForward={() => { setBack(true); setForward(false); setReceipt("forward"); }}
        onRefresh={() => { setRefreshing(true); setReceipt("refresh"); }}
        onOpenNotifications={() => { setDrawerOpen(value => !value); setBadge(0); setReceipt("notifications"); }} />
    </div>
    <output aria-label="합성 상단 바 콜백">{receipt}</output>
    <Button variant="outline" onClick={() => setRefreshing(false)}>합성 새로고침 완료</Button>
    <section id="global-notification-drawer" aria-label="합성 알림 대상" hidden={!drawerOpen}>합성 알림 표시 대상</section>
  </div>;
}

export function ShellCompositionCaller() {
  const [receipt, setReceipt] = useState("초기 구성");
  return <div className="grid gap-3 p-4" onClickCapture={event => observeNavClick("capture", event)} onClick={event => observeNavClick("bubble", event)}>
    <div style={{ width: 1280, height: 670 }}>
      <ShellMain moduleDefinition={syntheticDocumentModule} workspaceId={syntheticShellWorkspaceId} navigationSearch="story=synthetic" userSessionId="synthetic-shell-session"
        topBar={<div className="h-8 rounded border p-1 text-sm">합성 상단 영역</div>}
        onNavigateModule={(href, id) => setReceipt(`navigate:${id}:${href}`)}
        onSelectWorkspace={workspace => setReceipt(`workspace:${workspace.id}`)} />
    </div>
    <output aria-label="합성 셸 구성 콜백">{receipt}</output>
  </div>;
}

export const appRootRequests: Array<{ method: string; path: string; payload?: string; saveGeneration?: number }> = [];
type AppRootFixtureLease = { generation: number; unmount?: () => void };
let appRootFixtureLease: AppRootFixtureLease | null = null;
export function getAppRootSaveGeneration() { return appRootFixtureLease?.generation ?? 0; }
export function unmountAppRootFixture() { appRootFixtureLease?.unmount?.(); }
export function prepareAppRootStory() {
  const restoreShell = prepareShellClientStory();
  const previousTabs = useWorkspaceTabsStore.getState();
  const previousInpatient = useInpatientStore.getState();
  const previousDirtyHook = window.__clairSetNotificationNavigationDirty;
  const previousToastIds = new Set(toast.getToasts().map(item => item.id));
  const storageKey = `clair-workspace-tabs:v1:${syntheticShellWorkspaceId}`;
  const previousStorage = window.sessionStorage.getItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
  useWorkspaceTabsStore.setState({ workspaceId: null, tabs: [], activeTabId: null, hydrated: false });
  useInpatientStore.setState({ filter: "all", searchField: "all", searchQuery: "" });
  const previousLease = appRootFixtureLease;
  const lease: AppRootFixtureLease = { generation: 0 };
  appRootFixtureLease = lease;
  // Every source persist operation in this story also sets a fresh tabs state, including reactivation of the active tab.
  const unsubscribe = useWorkspaceTabsStore.subscribe(() => { lease.generation += 1; });
  const previousRequests = appRootRequests.slice();
  appRootRequests.splice(0);
  const shellFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (url.origin === window.location.origin && url.pathname.startsWith(`/api/workspaces/${syntheticShellWorkspaceId}/`)) {
      appRootRequests.push({ method, path: url.pathname, payload: typeof init?.body === "string" ? init.body : undefined, saveGeneration: method === "PUT" && url.pathname.endsWith("/app-shell/workspace-tabs") ? lease.generation : undefined });
      if (url.pathname.endsWith("/app-shell/workspace-tabs")) return Response.json({ ok: true, payload: null });
      if (url.pathname.endsWith("/notifications") && method === "GET") return Response.json({ ok: true, status: 200, workspaceId: syntheticShellWorkspaceId, notifications: [], counts: { badge: 0, unread: 0, important: 0, archived: 0 }, nextCursor: null, enforcedBy: "live-notification-reader" });
    }
    return shellFetch(input, init);
  };
  return async () => {
    // Storybook runs this hook before teardownRender. Explicitly unmount AppShell and its effects first.
    lease.unmount?.();
    unsubscribe();
    // The private 500ms source timer survives unmount. A prior equal payload is not proof that this generation has settled.
    const state = useWorkspaceTabsStore.getState();
    if (state.workspaceId === syntheticShellWorkspaceId && state.activeTabId) {
      const expected = JSON.stringify({ tabs: state.tabs, activeTabId: state.activeTabId });
      await waitFor(() => {
        if (!appRootRequests.some(request => request.method === "PUT" && request.path.endsWith("/app-shell/workspace-tabs") && request.payload === expected && request.saveGeneration === lease.generation)) throw new Error("Latest synthetic workspace tabs save generation has not settled.");
      });
    }
    useWorkspaceTabsStore.setState(previousTabs);
    useInpatientStore.setState(previousInpatient);
    if (previousStorage === null) window.sessionStorage.removeItem(storageKey); else window.sessionStorage.setItem(storageKey, previousStorage);
    appRootRequests.splice(0, appRootRequests.length, ...previousRequests);
    appRootFixtureLease = previousLease;
    if (previousDirtyHook) window.__clairSetNotificationNavigationDirty = previousDirtyHook; else delete window.__clairSetNotificationNavigationDirty;
    for (const item of toast.getToasts()) if (!previousToastIds.has(item.id)) toast.dismiss(item.id);
    restoreShell();
  };
}
export function AppRootCaller() {
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const lease = appRootFixtureLease;
    if (!lease) return;
    const unmount = () => flushSync(() => setMounted(false));
    lease.unmount = unmount;
    return () => { if (lease.unmount === unmount) lease.unmount = undefined; };
  }, []);
  return mounted ? <WorkspaceEntrySplashProvider><AppShell workspaceId={syntheticShellWorkspaceId} moduleId="inpatient" /></WorkspaceEntrySplashProvider> : <output aria-label="합성 앱 해제 결과">앱이 해제되었습니다.</output>;
}

export function ProfileMenuCaller() {
  const [logoutCount, setLogoutCount] = useState(0);
  return <div className="grid justify-items-start gap-3 p-4">
    <AuthProfileMenu activityLabel="합성 활동" roleLabel="합성 역할" userInitial="S" userName="합성 사용자" profileHref="#synthetic-profile-target" onLogout={() => setLogoutCount(count => count + 1)} />
    <output aria-label="합성 로그아웃 요청">{logoutCount}회</output>
    <section id="synthetic-profile-target" aria-label="합성 개인 설정 대상" className="rounded border p-3">합성 개인 설정 대상</section>
  </div>;
}

const firstTab: WorkspaceChromeTabItem = {
  id: "synthetic-tab-1", title: "합성 업무 1", icon: CdsFilesFileTextIcon,
  tooltipTitle: "합성 업무 1", tooltipDescription: "합성 업무 설명",
};
export function ChromeTabsCaller() {
  const [tabs, setTabs] = useState([firstTab]);
  const [activeId, setActiveId] = useState<string | null>(firstTab.id);
  const [nextId, setNextId] = useState(2);
  const [receipt, setReceipt] = useState("초기 탭");
  return <div className="grid gap-3 p-4">
    <WorkspaceChromeTabs activeTabId={activeId} tabs={tabs}
      onActivateTab={id => { setActiveId(id); setReceipt(`activate:${id}`); }}
      onCloseTab={id => {
        const remaining = tabs.filter(tab => tab.id !== id);
        setTabs(remaining);
        if (activeId === id) setActiveId(remaining[0]?.id ?? null);
        setReceipt(`close:${id}`);
      }}
      onNewTab={() => {
        const tab = { ...firstTab, id: `synthetic-tab-${nextId}`, title: `합성 업무 ${nextId}`, tooltipTitle: `합성 업무 ${nextId}` };
        setTabs(current => [...current, tab]); setActiveId(tab.id); setNextId(value => value + 1); setReceipt(`new:${tab.id}`);
      }} />
    <output aria-label="합성 업무 탭 변경">{receipt}</output>
  </div>;
}

function SyntheticBody() {
  const layout = useWorkspaceDocumentLayout();
  const [memo, setMemo] = useState("");
  return <div className="flex h-full min-h-0 flex-col gap-4 p-4">
    {layout ? <WorkspaceDocumentToolbar>
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b p-2">
        <span className="mr-auto font-medium">합성 문서</span>
        <EmrInstructionHistoryToggle ariaLabelPrefix="합성 이력" controls={layout.historyControlsId} expanded={layout.historyVisible} onClick={layout.toggleHistory} tooltipLabel="합성 이력 패널" />
        <Button variant="outline" size="sm" aria-controls={layout.rightControlsId} aria-expanded={layout.rightVisible} onClick={layout.toggleRight}>합성 보조 패널 {layout.rightVisible ? "접기" : "열기"}</Button>
        <WorkspaceDocumentWidthToggle showWhenUnavailable />
      </div>
    </WorkspaceDocumentToolbar> : null}
    <label htmlFor="synthetic-body-memo">합성 본문 메모</label>
    <Input id="synthetic-body-memo" value={memo} onChange={event => setMemo(event.target.value)} />
    <output aria-label="합성 본문 입력">{memo || "입력 없음"}</output>
  </div>;
}
function SyntheticHistory() {
  const layout = useWorkspaceDocumentLayout();
  const [memo, setMemo] = useState("");
  return <section className="grid gap-3 p-4">
    <h2 className="font-medium">합성 이력 내용</h2>
    <label htmlFor="synthetic-history-memo">합성 이력 메모</label>
    <Input id="synthetic-history-memo" value={memo} onChange={event => setMemo(event.target.value)} />
    <Button variant="outline" size="sm" onClick={() => layout?.toggleHistory()}>합성 이력 닫기</Button>
  </section>;
}
function SyntheticReceipt() {
  const layout = useWorkspaceDocumentLayout();
  const [count, setCount] = useState(0);
  return <section className="grid gap-3 p-4">
    <h2 className="font-medium">합성 보조 내용</h2>
    <Button variant="outline" size="sm" onClick={() => setCount(value => value + 1)}>합성 보조 작업</Button>
    <output aria-label="합성 보조 작업 횟수">{count}회</output>
    <Button variant="outline" size="sm" onClick={() => layout?.toggleRight()}>합성 보조 닫기</Button>
  </section>;
}
function SyntheticHeader({ moduleLabel }: ShellComponentProps) {
  return <div className="border-b p-3 font-medium">{moduleLabel}</div>;
}
export const syntheticDocumentModule: ModuleDefinition = {
  id: "synthetic-layout", label: "합성 레이아웃", icon: CheckIcon,
  contentHeader: SyntheticHeader, content: SyntheticBody,
  contentAside: SyntheticHistory, rightPanel: SyntheticReceipt,
  documentLayout: { narrowWidth: 1040, historyPanelId: "synthetic-history", historyLabel: "합성 이력", rightPanelId: "synthetic-receipt", rightLabel: "합성 보조" },
};

export function prepareDocumentFrameStory(compact = false) {
  const previous = useLayoutStore.getState();
  useLayoutStore.setState({
    activeDrawer: null, contentAsideOpen: compact, rightPanelOpen: compact,
    lastContentPanelOpened: "right", documentWidthModes: {},
  });
  return () => useLayoutStore.setState(previous);
}
export function DocumentFrameCaller({ compact = false }: { compact?: boolean }) {
  const [navigation, setNavigation] = useState("");
  return <div className="grid justify-items-start gap-3 p-4">
    <div className="grid min-h-0 border border-border" style={{ width: compact ? 420 : 1280, height: 580 }}>
      <WorkspaceFrame moduleDefinition={syntheticDocumentModule} workspaceId="synthetic-shell-workspace" onNavigateWorkspaceSurface={href => setNavigation(href)} />
    </div>
    {navigation ? <output aria-label="합성 화면 이동">{navigation}</output> : null}
  </div>;
}

/** These are synthetic example settings, not a product component API. */
export function AppShellCallerExample({ scenario, compact }: AppShellCallerArgs) {
  if (scenario === "profile-menu") return <ProfileMenuCaller />;
  if (scenario === "workspace-tabs") return <ChromeTabsCaller />;
  if (scenario === "nav-rail") return <NavRailCaller />;
  if (scenario === "global-search") return <GlobalSearchCaller />;
  if (scenario === "workspace-controls") return <WorkspaceControlsCaller />;
  if (scenario === "shell-main") return <ShellCompositionCaller />;
  if (scenario === "app-root") return <AppRootCaller />;
  return <DocumentFrameCaller compact={compact} />;
}
