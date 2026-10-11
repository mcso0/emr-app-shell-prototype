import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useMockAuthStore } from "@/features/auth/session-store";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { useLayoutStore } from "@/stores/layout-store";
import { useHomeWorkspaceStore } from "./home-workspace-store";
import type { HomeOperationsSummary, HomeOperationsWorkItem, HomeOperationsWorkItemsResponse } from "./home.types";
import { HomeContent, HomeSidePanel } from "./module";

type Scenario = "live" | "empty" | "read-error" | "permission-denied" | "partial";
const id = (index: number) => `99100000-0000-4000-8000-${String(index).padStart(12, "0")}`;

function summarize(items: HomeOperationsWorkItem[]): HomeOperationsSummary {
  const summary: HomeOperationsSummary = {
    byAssignmentState: { assignmentMissing: 0, personal: 0, teamQueue: 0 },
    byAttentionSignal: { urgent: 0, re_requested: 0, assignment_missing: 0, team_queue: 0, long_stay: 0 },
    byProgressState: { waiting: 0, in_progress: 0, completed: 0, cancelled: 0 },
    bySourceType: { reception: 0, appointment: 0, consultation: 0, lab: 0, imaging: 0, dispensing: 0, treatment: 0, billing: 0, inpatient: 0 },
    cancelledCount: 0, completedCount: 0, mineCount: 0, totalVisible: items.length,
  };
  for (const item of items) {
    summary.byProgressState[item.progressState]++;
    summary.bySourceType[item.sourceType]++;
    for (const signal of item.attentionSignals) summary.byAttentionSignal[signal]++;
    summary.byAssignmentState[item.attentionSignals.includes("assignment_missing") ? "assignmentMissing" : item.assigneeUserId ? "personal" : "teamQueue"]++;
    if (item.isMyWork) summary.mineCount++;
    if (item.progressState === "completed") summary.completedCount++;
    if (item.progressState === "cancelled") summary.cancelledCount++;
  }
  return summary;
}

function createFixture(scenario: Scenario) {
  const workspaceId = `storybook-home-${crypto.randomUUID()}`;
  const today = getWorkspaceOperatingDate(workspaceId);
  const scopeKey = `front_desk:${workspaceId}`;
  const storageKey = `clair.home.v2:${scopeKey}`;
  const base = { attentionSignals: [], operatingDate: today, permissionMode: "full", requestedAt: `${today}T00:00:00Z`, requesterName: "합성 요청자", assigneeName: "합성 담당자", assigneeUserId: id(10), patientId: id(11), guardianId: id(12), guardianName: "합성 홈 보호자", encounterId: id(13), workspaceId } satisfies Partial<HomeOperationsWorkItem>;
  const items: HomeOperationsWorkItem[] = [
    { ...base, id: id(1), sourceId: id(1), sourceType: "consultation", progressState: "in_progress", sourceStatus: "in_consultation", title: "합성 진료 확인", patientName: "합성 홈 환자 가", isMyWork: true, isRequestedWork: false, sourceHref: `/w/${workspaceId}/treatment?encounterId=${id(13)}` },
    { ...base, id: id(2), sourceId: id(2), sourceType: "lab", progressState: "waiting", sourceStatus: "requested", title: "합성 검사 요청", patientName: "합성 홈 환자 나", isMyWork: false, isRequestedWork: true, sourceHref: `/w/${workspaceId}/lab` },
    { ...base, id: id(3), sourceId: id(3), sourceType: "treatment", progressState: "completed", sourceStatus: "completed", title: "합성 완료 처치", patientName: "합성 홈 환자 다", isMyWork: false, isRequestedWork: false, sourceHref: `/w/${workspaceId}/fulfillment` },
  ];
  const requests: Array<{ method: string; query: Record<string, string> }> = [];
  let healthy = scenario !== "read-error", partial = scenario === "partial", pending = 0;
  let unmount: (() => void) | undefined;
  const install = () => {
    const previousFetch = globalThis.fetch;
    const previousAuth = useMockAuthStore.getState();
    const previousHome = useHomeWorkspaceStore.getState();
    const previousLayout = useLayoutStore.getState();
    const savedLocal = localStorage.getItem(storageKey), savedSession = sessionStorage.getItem(storageKey);
    const query = { date: today, search: "", owners: null, includeCompleted: false, includeCancelled: false };
    localStorage.setItem(storageKey, JSON.stringify({ layout: "board", hidden: [], collapsed: [], hiddenStatuses: [], collapsedStatuses: [] }));
    sessionStorage.setItem(storageKey, JSON.stringify({ view: "hospital", personalTab: "assigned", hospitalWorkType: "all", hospitalSort: "priority", queries: { hospital: query, mine: { ...query } }, scroll: {} }));
    useHomeWorkspaceStore.setState({ ...useHomeWorkspaceStore.getInitialState(), scopeKey: null }, true);
    useLayoutStore.setState({ modulePanelOpen: true });
    useMockAuthStore.setState({ hydrated: true, session: { id: "synthetic-home-desk", role: "front_desk", roleLabel: "합성 접수", storageMode: "session", issuedAt: `${today}T00:00:00Z` }, hydrate: () => {} });
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return previousFetch(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.pathname !== `/api/workspaces/${workspaceId}/operations/work-items` || method !== "GET" || url.searchParams.get("scope") !== "all") throw new Error("Unexpected synthetic Home request");
      pending++;
      try {
        requests.push({ method, query: Object.fromEntries(url.searchParams) });
        const operatingDate = url.searchParams.get("date") ?? today;
        const selected = scenario === "empty" ? [] : items.filter(item => item.operatingDate === operatingDate && (item.progressState !== "completed" || url.searchParams.get("includeCompleted") === "true") && (item.progressState !== "cancelled" || url.searchParams.get("includeCancelled") === "true"));
        let body: HomeOperationsWorkItemsResponse;
        if (!healthy || scenario === "permission-denied") body = { ok: false, workspaceId, operatingDate, sourceStatus: scenario === "permission-denied" ? "permission_denied" : "error", error: { code: scenario === "permission-denied" ? "permission_denied" : "synthetic_read_error", message: scenario === "permission-denied" ? "합성 업무 조회 권한이 없습니다." : "합성 홈 조회 실패입니다.", retryable: scenario !== "permission-denied" } };
        else body = { ok: true, workspaceId, operatingDate, generatedAt: `${today}T00:00:00Z`, items: selected, sourceStatus: partial ? "partial" : selected.length ? "live" : "empty", summary: summarize(selected), currentPatients: { present: selected.length, waiting: selected.filter(item => item.progressState === "waiting").length, inProgress: selected.filter(item => item.progressState === "in_progress").length }, ...(partial ? { accessIssues: [{ code: "synthetic_source_unavailable", message: "합성 영상 업무만 조회하지 못했습니다.", sourceType: "imaging" as const }] } : {}) };
        const response = Response.json(body, { status: body.ok ? 200 : scenario === "permission-denied" ? 403 : 503 });
        const json = response.json.bind(response);
        response.json = async () => { pending++; try { return await json(); } finally { pending--; } };
        return response;
      } finally { pending--; }
    };
    globalThis.fetch = intercept;
    return async () => {
      try { unmount?.(); await waitFor(() => { if (pending) throw new Error("Home transport is still settling"); }); }
      finally {
        if (globalThis.fetch === intercept) globalThis.fetch = previousFetch;
        useMockAuthStore.setState(previousAuth, true); useHomeWorkspaceStore.setState(previousHome, true); useLayoutStore.setState(previousLayout, true);
        if (savedLocal === null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, savedLocal);
        if (savedSession === null) sessionStorage.removeItem(storageKey); else sessionStorage.setItem(storageKey, savedSession);
      }
    };
  };
  return { workspaceId, today, scopeKey, storageKey, items, requests, install, recover: () => { healthy = true; partial = false; }, setUnmount: (fn: () => void) => { unmount = fn; } };
}
let fixture: ReturnType<typeof createFixture>;
function Example(args: { scenario: Scenario }) {
  void args;
  const instance = fixture;
  const [mounted, setMounted] = useState(true);
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  return <div className="flex h-[800px] min-w-0" data-testid="home-actual-frame">{mounted ? <><aside className="w-[240px] shrink-0 border-r"><HomeSidePanel /></aside><main className="min-w-0 flex-1"><HomeContent workspaceId={instance.workspaceId} moduleId="home" moduleLabel="홈" /></main></> : null}</div>;
}
const meta = {
  title: "Features/Home/Actual Workspace", component: Example, tags: ["autodocs"], args: { scenario: "live" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true }, docs: { story: { inline: false, height: "800px" }, description: { component: "현재 HomeContent와 HomeSidePanel을 함께 사용합니다. 실제 운영 업무 조회 hook과 adapter, 보드/목록/내 업무 store 동작을 유지합니다. 조회는 고유 합성 workspace의 정확한 GET 경로만 로컬 응답으로 처리합니다. 실제 activate가 예제 전용 localStorage/sessionStorage 키를 읽고 UI 변경을 저장하며, 종료 시 해당 키와 store/auth/fetch를 복원합니다. 합성 조회 권한 표시이며 서버 권한·실제 업무·전체 AppShell 검증은 포함하지 않습니다. 링크는 Next Storybook 라우터에 기록됩니다." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); },
  render: args => <Example {...args} />,
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function ready(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByTestId("home-status-task-" + fixture.items[0].id)).toBeVisible());
  await expect(useHomeWorkspaceStore.getState().scopeKey).toBe(fixture.scopeKey);
  await expect(fixture.requests[0].query).toEqual({ date: fixture.today, includeCancelled: "false", includeCompleted: "false", scope: "all" });
  return canvas;
}
export const BoardListAndPersonalNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByTestId("home-status-task-" + fixture.items[1].id)).toBeVisible();
    await expect(canvas.queryByTestId("home-status-task-" + fixture.items[2].id)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "리스트" }));
    const first = await canvas.findByTestId("home-hospital-row-" + fixture.items[0].id);
    await waitFor(() => expect(first).toBeVisible());
    await expect(canvas.getAllByRole("columnheader")).toHaveLength(9);
    await expect(JSON.parse(localStorage.getItem(fixture.storageKey) ?? "null").layout).toBe("list");
    const router = getRouter(), count = router.push.mock.calls.length, previousUrl = window.location.href;
    first.focus(); await userEvent.keyboard("{Enter}");
    await expect(router.push.mock.calls[count]?.[0]).toBe(fixture.items[0].sourceHref);
    await expect(window.location.href).toBe(previousUrl);
    const lab = canvas.getByRole("button", { name: "임상병리 1" });
    lab.focus(); await userEvent.keyboard("{Enter}");
    await expect(canvas.queryByTestId("home-hospital-row-" + fixture.items[0].id)).not.toBeInTheDocument();
    await expect(canvas.getByTestId("home-hospital-row-" + fixture.items[1].id)).toBeVisible();
    await userEvent.click(canvas.getByTestId("home-all-work-tab"));
    await userEvent.click(canvas.getByRole("button", { name: "완료 포함" }));
    await waitFor(() => expect(canvas.getByTestId("home-hospital-row-" + fixture.items[2].id)).toBeVisible());
    await expect(fixture.requests.at(-1)?.query.includeCompleted).toBe("true");
    const side = within(canvas.getByTestId("home-navigation-side-panel"));
    await userEvent.click(side.getByRole("button", { name: "내 업무" }));
    await waitFor(() => expect(canvas.getByRole("row", { name: "합성 홈 환자 가 합성 진료 확인" })).toBeVisible());
    await expect(canvas.queryByRole("row", { name: "합성 홈 환자 나 합성 검사 요청" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "내가 요청한 업무" }));
    await waitFor(() => expect(canvas.getByRole("row", { name: "합성 홈 환자 나 합성 검사 요청" })).toBeVisible());
    await expect(JSON.parse(sessionStorage.getItem(fixture.storageKey) ?? "null").personalTab).toBe("requested");
    await expect(fixture.requests.every(request => request.method === "GET")).toBe(true);
  },
};
export const EmptyLiveResponse: Story = {
  args: { scenario: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId("home-kanban-board")).toBeVisible());
    for (const status of ["waiting", "in_progress", "re_requested"]) await expect(canvas.getByTestId("home-kanban-column-" + status)).toHaveTextContent("표시할 업무가 없습니다.");
    await expect(canvas.getAllByText("표시할 업무가 없습니다.")).toHaveLength(3);
    await expect(canvas.getByTestId("home-kanban-column-completed")).toHaveTextContent("완료 포함을 켜면 표시됩니다.");
    await expect(canvas.getByTestId("home-kanban-column-cancelled")).toHaveTextContent("필터에서 취소 포함을 켜면 표시됩니다.");
    await expect(canvas.queryByTestId("home-status-task-" + fixture.items[0].id)).not.toBeInTheDocument();
    await expect(fixture.requests).toHaveLength(1);
  },
};
export const ReadErrorAndRetry: Story = {
  args: { scenario: "read-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("heading", { name: "업무를 불러오지 못했습니다" })).toBeVisible());
    fixture.recover();
    const retry = canvas.getByRole("button", { name: "다시 시도" });
    retry.focus(); await userEvent.keyboard("{Enter}");
    await ready(canvasElement);
    await expect(fixture.requests).toHaveLength(2);
    await expect(canvas.queryByRole("heading", { name: "업무를 불러오지 못했습니다" })).not.toBeInTheDocument();
  },
};
export const PermissionDeniedResponse: Story = {
  args: { scenario: "permission-denied" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("heading", { name: "업무를 볼 권한이 없습니다" })).toBeVisible());
    await expect(canvas.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
    await expect(canvas.queryByTestId("home-workspace-body")).not.toBeInTheDocument();
    await expect(fixture.requests).toHaveLength(1);
  },
};
export const PartialResponseAndRetry: Story = {
  args: { scenario: "partial" },
  play: async ({ canvasElement }) => {
    const canvas = await ready(canvasElement);
    await expect(canvas.getByText("일부 업무를 불러오지 못했습니다. 표시된 업무만 확인할 수 있습니다.")).toBeVisible();
    fixture.recover(); await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(canvas.queryByText("일부 업무를 불러오지 못했습니다. 표시된 업무만 확인할 수 있습니다.")).not.toBeInTheDocument());
    await ready(canvasElement); await expect(fixture.requests).toHaveLength(2);
  },
};
