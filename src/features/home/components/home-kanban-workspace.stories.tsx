import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { useHomeWorkspaceStore } from "../home-workspace-store";
import type { HomeDashboardData, HomeTask } from "../home.types";
import { HomeKanbanWorkspace } from "./home-kanban-workspace";

const today = "2026-10-11";
const emptyDashboard: HomeDashboardData = {
  role: "desk", roleLabel: "합성 접수 역할", userName: "예시 사용자", hospitalName: "합성 동물병원", todayLabel: "2026년 10월 11일",
  columns: [], tasks: [], hospitalTasks: [], notifications: [], quickStatus: [], emptyLaunchers: [], flowSummary: [], roleNextActions: [], updatedAt: "2026-10-11T09:00:00+09:00",
};

const fixedNow = Date.parse("2026-10-11T10:00:00+09:00");
const assignedTask: HomeTask = {
  id: "synthetic-chart-assigned", title: "합성 진료 확인", kanbanColumn: "chart", patientName: "예시 환자 가", clientName: "예시 보호자 가",
  sourceLabel: "합성 진료", requestedAt: "2026-10-11T09:00:00+09:00", stateEnteredAt: "2026-10-11T09:00:00+09:00", operatingDate: today,
  status: "in_progress", progressState: "in_progress", priority: "normal", domain: "chart", assignment: "assigned", assigneeName: "예시 담당자", requestedBy: "예시 요청자",
  isMyWork: true, isRequestedWork: false, recommendedAction: "합성 진료 확인", actionHref: "/storybook-synthetic/home/chart", actionLabel: "합성 업무 확인",
};
const requestedTask: HomeTask = {
  ...assignedTask, id: "synthetic-lab-requested", title: "합성 검사 요청", kanbanColumn: "lab", patientName: "예시 환자 나", clientName: "예시 보호자 나",
  sourceLabel: "합성 임상병리", domain: "lab", status: "waiting", progressState: "waiting", stateEnteredAt: "2026-10-11T09:30:00+09:00",
  isMyWork: false, isRequestedWork: true, actionHref: "/storybook-synthetic/home/lab",
};
const repeatedTask: HomeTask = {
  ...assignedTask, id: "synthetic-imaging-repeated", title: "합성 영상 재요청", kanbanColumn: "imaging", patientName: "예시 환자 다", clientName: "예시 보호자 다",
  sourceLabel: "합성 영상검사", domain: "imaging", status: "waiting", progressState: "waiting", attentionSignals: ["re_requested"],
  isMyWork: true, isRequestedWork: true, actionHref: "/storybook-synthetic/home/imaging",
};
const populatedTasks = [assignedTask, requestedTask, repeatedTask];
const populatedDashboard: HomeDashboardData = { ...emptyDashboard, tasks: populatedTasks, hospitalTasks: populatedTasks };

// Storybook runs the meta hook first. Its cleanup restores the original store snapshot.
function populatedBeforeEach(view: "hospital" | "mine", layout: "board" | "list" = "board") {
  return () => {
    const previousNow = Object.getOwnPropertyDescriptor(Date, "now");
    if (!previousNow) throw new Error("Date.now must have a restorable descriptor.");
    Object.defineProperty(Date, "now", { ...previousNow, value: () => fixedNow });
    const preferences = useHomeWorkspaceStore.getState().preferences;
    useHomeWorkspaceStore.setState({ view, personalTab: "assigned", preferences: { ...preferences, layout } });
    return () => {
      Object.defineProperty(Date, "now", previousNow);
    };
  };
}

async function waitForWorkspace(check: () => boolean, message: string) {
  await waitFor(() => { if (!check()) throw new Error(message); });
}

async function checkEmptyStateCenter(canvasElement: HTMLElement, areaTestId: string, scrollList = false) {
  await canvasElement.ownerDocument.fonts.ready;
  const frame = within(canvasElement).getByTestId("home-story-frame");
  const previousStyle = frame.getAttribute("style");
  try {
    for (const [width, height] of [[1440, 680], [720, 480]]) {
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      const area = within(canvasElement).getByTestId(areaTestId);
      const empty = canvasElement.querySelector<HTMLElement>('[data-surface="content"][data-kind]');
      if (!empty) throw new Error("The workspace must expose its shared empty state.");
      const assertCenter = async () => {
        await waitFor(() => {
          const target = area.getBoundingClientRect();
          const box = empty.getBoundingClientRect();
          const vertical = scrollList ? within(canvasElement).getByTestId("home-hospital-table-body").getBoundingClientRect() : target;
          expect(target.width).toBeGreaterThan(0);
          expect(vertical.height).toBeGreaterThan(box.height);
          expect(Math.abs(box.x + box.width / 2 - target.x - target.width / 2)).toBeLessThan(1);
          expect(Math.abs(box.y + box.height / 2 - vertical.y - vertical.height / 2)).toBeLessThan(1);
        });
      };
      await assertCenter();
      if (scrollList) {
        area.scrollLeft = area.scrollWidth;
        if (width === 720) await expect(area.scrollLeft).toBeGreaterThan(0);
        await assertCenter();
        area.scrollLeft = 0;
        await assertCenter();
        await expect(within(canvasElement).getByRole("columnheader", { name: "업무" })).toBeVisible();
      }
    }
  } finally {
    if (previousStyle === null) frame.removeAttribute("style");
    else frame.setAttribute("style", previousStyle);
  }
}

type WorkspaceExampleArgs = ComponentProps<typeof HomeKanbanWorkspace>;

function WorkspaceStateExample(args: WorkspaceExampleArgs) {
  const [retries, setRetries] = useState(0);
  const [recovered, setRecovered] = useState(false);
  return (
    <div className="flex h-[680px] min-w-0 flex-col" data-testid="home-story-frame">
      <HomeKanbanWorkspace {...args} sourceStatus={recovered ? (args.data.tasks.length || args.data.hospitalTasks.length ? "live" : "empty") : args.sourceStatus} loading={recovered ? false : args.loading} onRefresh={() => { setRetries((count) => count + 1); setRecovered(true); }} />
      <output className="p-2 text-sm" aria-label="합성 새로고침 결과">합성 새로고침 요청 {retries}회</output>
    </div>
  );
}

const meta = {
  title: "Features/Home/Home Kanban Workspace",
  component: HomeKanbanWorkspace,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    docs: { story: { inline: false, height: "760px" }, description: { component: "현재 HomeContent가 사용하는 실제 HomeKanbanWorkspace의 상태 예제입니다. HomeContent의 조회 hook은 마운트하지 않습니다. data는 합성 목록이고 새로고침은 로컬 카운트만 바꿉니다. 예제 시작 시 singleton store를 초기화하고 종료 시 이전 값을 복원합니다. scopeKey=null로 브라우저 저장을 막습니다. 업무가 있는 예제는 Date.now를 2026-10-11 10:00 KST로 고정하고 종료 시 원래 속성으로 복원합니다. 화면 이동은 Next Storybook 라우터의 모의 push에 기록되어 실제 페이지를 열지 않습니다. 권한·오류는 서버 검증 결과가 아닌 prop 표시 예시입니다." } },
  },
  args: { data: emptyDashboard, today, loading: false, sourceStatus: "empty", patientSummary: { present: 0, waiting: 0, inProgress: 0 } },
  argTypes: {
    data: { control: false, description: "빈 목록 또는 합성 업무 3건을 전달합니다. 실제 환자·보호자·조회 데이터는 사용하지 않습니다." },
    today: { control: false, description: "예제 기준일 2026-10-11입니다." },
    loading: { control: "boolean", description: "실제 로딩 표시 prop입니다." },
    sourceStatus: { control: "radio", options: ["empty", "live", "error", "permission_denied", "partial"], description: "조회 결과의 표시 상태입니다. live도 합성 prop이며 실제 조회는 하지 않습니다." },
    errorMessage: { control: "text", description: "호출자가 제공하는 합성 오류 설명입니다." },
    onRefresh: { control: false, description: "예제 render가 요청 횟수를 기록하고 합성 목록 유무에 따라 empty 또는 live 상태로 복구합니다. 네트워크 요청은 없습니다." },
    patientSummary: { control: false, description: "빈 예제는 0건, 업무가 있는 원내 현황은 합성 재원 3건·대기 2건·진행 중 1건 요약입니다." },
  },
  beforeEach: () => {
    const previous = useHomeWorkspaceStore.getState();
    const initial = useHomeWorkspaceStore.getInitialState();
    const query = { date: today, search: "", owners: null, includeCompleted: false, includeCancelled: false };
    useHomeWorkspaceStore.setState({
      ...initial,
      scopeKey: null,
      queries: { hospital: { ...query }, mine: { ...query } },
      preferences: { layout: "board", hidden: [], collapsed: [], hiddenStatuses: [], collapsedStatuses: [] },
      scroll: {},
    }, true);
    return () => useHomeWorkspaceStore.setState(previous, true);
  },
  render: (args) => <WorkspaceStateExample key={`${args.sourceStatus}:${args.loading}`} {...args} />,
} satisfies Meta<typeof HomeKanbanWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyBoard: Story = {
  parameters: { docs: { description: { story: "업무가 없는 실제 상태별 보드입니다. 상태 열과 각 열의 빈 안내는 유지합니다. 저장소·라우터·조회 통합 검증은 아닙니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('[data-testid="home-kanban-board"]') || !canvasElement.textContent?.includes("표시할 업무가 없습니다.")) {
      throw new Error("The empty workspace must retain its board and empty column guidance.");
    }
    if (useHomeWorkspaceStore.getState().scopeKey !== null) {
      throw new Error("The workspace fixture must not activate a persistent store scope.");
    }
  },
};

export const Loading: Story = {
  args: { loading: true },
  parameters: { docs: { description: { story: "조회 대기 표시만 전달합니다. 이전 업무나 타이머를 만들지 않습니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('[data-testid="home-loading-state"]') || canvasElement.querySelector('[data-testid="home-kanban-board"]')) {
      throw new Error("Loading must replace the empty board with its dedicated loading surface.");
    }
  },
};

export const ReadError: Story = {
  args: { sourceStatus: "error", errorMessage: "합성 조회 실패입니다. 다시 시도하면 합성 빈 목록으로 복구합니다." },
  parameters: { docs: { description: { story: "오류 안내의 기존 1440px·720px 중앙 배치를 먼저 검증합니다. 다시 시도하면 요청 횟수를 기록하고 합성 빈 보드로 복구합니다. 실제 조회는 수행하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.textContent?.includes("업무를 불러오지 못했습니다")) throw new Error("The workspace must expose its read-error state.");
    const retry = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "다시 시도");
    if (!retry) throw new Error("The read-error state must offer the supplied retry callback.");
    await checkEmptyStateCenter(canvasElement, "home-blocked-state");
    await userEvent.click(retry);
    await waitForWorkspace(() => canvasElement.querySelector('output[aria-label="합성 새로고침 결과"]')?.textContent === "합성 새로고침 요청 1회", "Retry must invoke the fixture callback once.");
    await waitFor(() => expect(canvasElement.querySelector('[data-testid="home-kanban-board"]')).toBeVisible());
  },
};

export const PermissionDenied: Story = {
  args: { sourceStatus: "permission_denied", errorMessage: "합성 권한 안내입니다." },
  parameters: { docs: { description: { story: "권한 없음 표시를 확인합니다. 실제 역할 정책이나 서버 접근 제어를 검증하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.textContent?.includes("업무를 볼 권한이 없습니다") || canvasElement.querySelector('[data-testid="home-workspace-body"]')) {
      throw new Error("Permission denied must replace the workspace body with permission guidance.");
    }
    await checkEmptyStateCenter(canvasElement, "home-blocked-state");
  },
};

export const AllStatusesHidden: Story = {
  parameters: { docs: { description: { story: "실제 열 숨기기 버튼으로 모든 상태 열을 숨깁니다. 숨김 상태 패널을 제외한 업무 영역의 중앙 정렬을 넓은/좁은 크기에서 확인하고 전체 표시 복구도 검증합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ["대기", "진행 중", "재요청", "완료", "취소"]) {
      await userEvent.click(canvas.getByRole("button", { name: `${label} 열 숨기기` }));
    }
    await waitFor(() => expect(canvas.getByRole("heading", { name: "표시할 상태를 선택해 주세요" })).toBeVisible());
    await checkEmptyStateCenter(canvasElement, "home-workspace-scroll");
    await userEvent.click(canvas.getByRole("button", { name: "전체 표시" }));
    await expect(canvas.getByTestId("home-kanban-column-waiting")).toBeVisible();
    await expect(canvas.queryByRole("heading", { name: "표시할 상태를 선택해 주세요" })).not.toBeInTheDocument();
    // Leave the reviewed empty state on screen after also proving recovery.
    for (const label of ["대기", "진행 중", "재요청", "완료", "취소"]) {
      await userEvent.click(canvas.getByRole("button", { name: `${label} 열 숨기기` }));
    }
  },
};

export const EmptyList: Story = {
  parameters: { docs: { description: { story: "빈 원내 업무 목록의 표 머리글을 유지합니다. 1440px·720px 크기와 가로 스크롤 양끝에서 빈 안내가 현재 보이는 목록 영역의 중앙에 유지되는지 확인합니다." } } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "리스트" }));
    await checkEmptyStateCenter(canvasElement, "home-workspace-scroll", true);
  },
};

export const FilteredEmptyList: Story = {
  args: { data: populatedDashboard, sourceStatus: "live" },
  beforeEach: populatedBeforeEach("hospital", "list"),
  parameters: { docs: { description: { story: "업무가 있는 목록에서 접수 탭을 선택해 결과 없음을 재현합니다. 빈 안내 중앙 정렬과 조건 초기화 뒤 기존 업무 복구를 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "접수 0" }));
    await checkEmptyStateCenter(canvasElement, "home-workspace-scroll", true);
    await userEvent.click(canvas.getByRole("button", { name: "검색·업무 탭·필터 초기화" }));
    for (const task of populatedTasks) await expect(canvas.getByTestId(`home-hospital-row-${task.id}`)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "접수 0" }));
  },
};

export const PopulatedBoard: Story = {
  args: { data: populatedDashboard, sourceStatus: "live", patientSummary: { present: 3, waiting: 2, inProgress: 1 } },
  beforeEach: populatedBeforeEach("hospital"),
  parameters: { docs: { description: { story: "합성 업무 3건을 실제 대기·진행 중·재요청 열에 표시합니다. 진료 탭으로 업무 종류를 좁히고 전체 목록으로 돌아온 뒤 리스트 보기로 전환합니다. 시간은 이 예제에만 고정합니다." } } },
  play: async ({ canvasElement }) => {
    for (const [state, task] of [["in_progress", assignedTask], ["waiting", requestedTask], ["re_requested", repeatedTask]] as const) {
      if (!canvasElement.querySelector(`[data-testid="home-kanban-column-${state}"] [data-testid="home-status-task-${task.id}"]`)) {
        throw new Error(`The populated board must place ${task.id} in ${state}.`);
      }
    }
    if (!canvasElement.querySelector(`[data-testid="home-status-task-${assignedTask.id}"]`)?.getAttribute("title")?.includes("1시간 0분 경과")) {
      throw new Error("Elapsed time must use the fixed story clock.");
    }
    const chartTab = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="업무 종류"] button')).find((button) => button.textContent?.trim().startsWith("진료"));
    if (!chartTab) throw new Error("The actual work-type toolbar must expose 진료.");
    await userEvent.click(chartTab);
    await waitForWorkspace(() => chartTab.getAttribute("aria-pressed") === "true" && !!canvasElement.querySelector(`[data-testid="home-status-task-${assignedTask.id}"]`) && !canvasElement.querySelector(`[data-testid="home-status-task-${requestedTask.id}"]`) && !canvasElement.querySelector(`[data-testid="home-status-task-${repeatedTask.id}"]`), "Selecting 진료 must retain only the chart task.");
    const allTab = canvasElement.querySelector<HTMLButtonElement>('[data-testid="home-all-work-tab"]');
    if (!allTab) throw new Error("The actual work-type toolbar must expose 전체.");
    await userEvent.click(allTab);
    await waitForWorkspace(() => !!canvasElement.querySelector(`[data-testid="home-status-task-${requestedTask.id}"]`), "전체 must restore the other task types.");
    const listToggle = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="리스트"]');
    if (!listToggle) throw new Error("The actual workspace must expose its list layout control.");
    await userEvent.click(listToggle);
    await waitForWorkspace(() => !canvasElement.querySelector('[data-testid="home-kanban-board"]') && populatedTasks.every((task) => !!canvasElement.querySelector(`[data-testid="home-hospital-row-${task.id}"]`)), "The list control must replace the board with all three populated rows.");
  },
};

export const PopulatedList: Story = {
  args: { data: populatedDashboard, sourceStatus: "live", patientSummary: { present: 3, waiting: 2, inProgress: 1 } },
  beforeEach: populatedBeforeEach("hospital", "list"),
  parameters: { docs: { description: { story: "실제 원내 업무 목록에 합성 업무 3건을 표시합니다. 행 클릭은 Next Storybook 모의 라우터에 합성 경로를 기록합니다. 실제 라우트·인증·업무 저장 검증은 포함하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('[data-testid="home-hospital-table"]') || !populatedTasks.every((task) => !!canvasElement.querySelector(`[data-testid="home-hospital-row-${task.id}"]`))) {
      throw new Error("The populated list must contain each synthetic task.");
    }
    const row = canvasElement.querySelector<HTMLElement>(`[data-testid="home-hospital-row-${assignedTask.id}"]`);
    if (!row) throw new Error("The synthetic chart task must expose its actual clickable row.");
    const router = getRouter();
    const previousCalls = router.push.mock.calls.length;
    const previousUrl = window.location.href;
    await userEvent.click(row);
    await waitForWorkspace(() => router.push.mock.calls.length === previousCalls + 1, "The row must call the inert Next router exactly once.");
    if (router.push.mock.calls[previousCalls]?.[0] !== assignedTask.actionHref || window.location.href !== previousUrl) {
      throw new Error("Row navigation must record the synthetic href without changing the browser URL.");
    }
  },
};

export const MineWork: Story = {
  args: { data: populatedDashboard, sourceStatus: "live" },
  beforeEach: populatedBeforeEach("mine"),
  parameters: { docs: { description: { story: "내 업무 진입은 실제 store의 view=mine으로 초기화합니다. 별도의 view prop이나 홈 사이드패널을 만들지 않습니다. 실제 내가 해야 할 업무/내가 요청한 업무 탭이 isMyWork/isRequestedWork에 따라 합성 업무를 나누는지 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const hasTask = (task: HomeTask) => !!canvasElement.querySelector(`[role="row"][aria-label="${task.patientName} ${task.title}"]`);
    if (!hasTask(assignedTask) || !hasTask(repeatedTask) || hasTask(requestedTask)) {
      throw new Error("Assigned work must contain only tasks marked isMyWork.");
    }
    const requestedTab = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === "내가 요청한 업무");
    if (!requestedTab) throw new Error("Mine work must expose the actual requested-work tab.");
    await userEvent.click(requestedTab);
    await waitForWorkspace(() => requestedTab.getAttribute("aria-pressed") === "true" && hasTask(requestedTask) && hasTask(repeatedTask) && !hasTask(assignedTask), "Requested work must contain only tasks marked isRequestedWork.");
    const assignedTab = Array.from(canvasElement.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === "내가 해야 할 업무");
    if (!assignedTab) throw new Error("Mine work must retain the assigned-work tab.");
    await userEvent.click(assignedTab);
    await waitForWorkspace(() => assignedTab.getAttribute("aria-pressed") === "true" && hasTask(assignedTask) && hasTask(repeatedTask) && !hasTask(requestedTask), "Returning to assigned work must restore its original partition.");
  },
};
