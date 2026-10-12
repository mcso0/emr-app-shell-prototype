import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { act } from "react";
import type { CommandSearchResponse } from "@/features/command/command-search";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AppShellCallerExample,
  appRootRequests,
  getAppRootSaveGeneration,
  navClickObservations,
  commandSearchRequests,
  prepareDocumentFrameStory,
  prepareAppRootStory,
  prepareShellClientStory,
  syntheticShellWorkspaceId,
  unmountAppRootFixture,
} from "./app-shell-caller-parity.stories.fixture";

const meta = {
  title: "Features/App Shell/Caller Parity",
  component: AppShellCallerExample,
  tags: ["autodocs"],
  args: { scenario: "document-panels", compact: false },
  argTypes: {
    scenario: { control: false, description: "합성 조합 예제 선택입니다. 제품 컴포넌트의 prop이 아닙니다." },
    compact: { control: false, description: "문서 패널 예제의 고정 공간 크기입니다. profile-menu와 workspace-tabs 예제에는 적용되지 않습니다." },
  },
  parameters: {
    layout: "fullscreen", controls: { disable: true }, nextjs: { appDirectory: true },
    docs: { story: { inline: false, height: "740px" }, description: { component: "AppShellCallerExample은 scenario와 compact로 실제 공개 컴포넌트를 선택하는 Storybook 전용 wrapper입니다. 두 prop은 합성 예제 설정이며 제품 API가 아닙니다. 각 예제 설명에서 원본과 확인하는 분기를 구분합니다. 업무 탭과 프로필 메뉴 콜백은 로컬 상태를 바꿉니다. 문서 본문·이력·보조 내용은 합성 슬롯이며 실제 임상 화면을 대신하지 않습니다. 원본 WorkspaceFrame과 WorkspaceDocumentLayout이 배치·포털·폭·패널·포커스를 담당합니다. 변경한 공유 상태는 예제 종료 시 복원합니다. 실제 로그인·서버 권한·저장·알림 전송은 실행하지 않습니다." } },
  },
  decorators: [(Story) => <TooltipProvider><Story /></TooltipProvider>],
  render: args => <AppShellCallerExample key={`${args.scenario}:${args.compact}`} {...args} />,
} satisfies Meta<typeof AppShellCallerExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileMenu: Story = {
  args: { scenario: "profile-menu" },
  parameters: { docs: { description: { story: "실제 AuthProfileMenu입니다. 합성 사용자 표시, 개인 설정 링크와 로그아웃 콜백을 확인합니다. 로그아웃은 로컬 요청 횟수만 바꿉니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "합성 사용자 프로필 메뉴" }));
    const menu = await page.findByRole("menu");
    await waitFor(() => expect(menu).toBeVisible());
    await expect(within(menu).getByRole("menuitem", { name: "개인 설정" })).toHaveAttribute("href", "#synthetic-profile-target");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "로그아웃" }));
    await waitFor(() => { expect(canvas.getByLabelText("합성 로그아웃 요청")).toHaveTextContent("1회"); expect(menu).not.toBeVisible(); });
  },
};
export const WorkspaceTabs: Story = {
  args: { scenario: "workspace-tabs" },
  parameters: { docs: { description: { story: "실제 WorkspaceChromeTabs입니다. 하나의 탭에는 닫기 버튼이 없고, 새 탭을 추가하면 활성화·닫기를 사용할 수 있습니다. 탭 데이터와 콜백은 로컬 상태입니다. 좁은 viewport에서 탭바를 숨기는 CSS는 별도 브라우저 확인 대상입니다." } } },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: "합성 업무 1 탭 닫기" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "새 업무 탭" }));
    await waitFor(() => expect(canvas.getByRole("tab", { name: "합성 업무 2" })).toHaveAttribute("aria-selected", "true"));
    await userEvent.click(canvas.getByRole("tab", { name: "합성 업무 1" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 업무 탭 변경")).toHaveTextContent("activate:synthetic-tab-1"));
    const close = canvas.getByRole("button", { name: "합성 업무 2 탭 닫기" });
    close.focus();
    await expect(close).toHaveFocus();
    await waitFor(() => expect(getComputedStyle(close).pointerEvents).toBe("auto"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => { expect(canvas.queryByRole("tab", { name: "합성 업무 2" })).not.toBeInTheDocument(); expect(canvas.queryByRole("button", { name: "합성 업무 1 탭 닫기" })).not.toBeInTheDocument(); });
  },
};
export const DocumentPanelsWide: Story = {
  beforeEach: () => prepareDocumentFrameStory(),
  args: { scenario: "document-panels", compact: false },
  parameters: { docs: { description: { story: "실제 WorkspaceFrame이 WorkspaceDocumentLayout을 렌더합니다. 합성 문서 슬롯이 원본 toolbar 포털·폭 토글·이력 패널을 사용합니다. 닫았다 다시 여는 이력 입력은 원본 keepMounted 동작으로 유지됩니다. 합성 슬롯은 임상 화면이 아닙니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await canvas.findByTestId("workspace-document");
    await waitFor(() => expect(canvas.getByTestId("workspace-document-area").clientWidth).toBeGreaterThan(1100));
    const toolbar = canvas.getByTestId("workspace-document-toolbar");
    const width = await canvas.findByRole("button", { name: "좁게 보기" });
    await waitFor(() => { expect(width).toBeEnabled(); expect(toolbar).toContainElement(width); });
    await userEvent.click(width);
    await waitFor(() => {
      expect(canvas.getByTestId("workspace-document")).toHaveAttribute("data-width-mode", "narrow");
      expect(canvas.getByRole("button", { name: "넓게 보기" })).toBeVisible();
    });
    await userEvent.click(canvas.getByRole("button", { name: "합성 이력 패널 열기" }));
    const history = await page.findByRole("complementary", { name: "합성 이력" });
    await waitFor(() => expect(history).toBeVisible());
    await userEvent.type(within(history).getByRole("textbox", { name: "합성 이력 메모" }), "합성 메모");
    await userEvent.click(within(history).getByRole("button", { name: "합성 이력 닫기" }));
    await waitFor(() => expect(history).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "합성 이력 패널 열기" }));
    await waitFor(() => { expect(history).toBeVisible(); expect(within(history).getByRole("textbox", { name: "합성 이력 메모" })).toHaveValue("합성 메모"); });
    within(history).getByRole("textbox", { name: "합성 이력 메모" }).focus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(history).not.toBeVisible());
  },
};
export const DocumentPanelsCompact: Story = {
  beforeEach: () => prepareDocumentFrameStory(true),
  args: { scenario: "document-panels", compact: true },
  parameters: { docs: { description: { story: "420px 문서 공간에서 실제 WorkspaceDocumentLayout이 작업 영역 선택을 표시합니다. 이력·보조·본문 전환과 입력 유지, 보조 작업 콜백을 확인합니다. viewport 크기를 흉내 내지 않고 원본의 공간 측정 분기를 사용합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const switcher = await canvas.findByRole("group", { name: "작업 영역 선택" });
    await waitFor(() => {
      expect(canvas.getByTestId("workspace-document-area").clientWidth).toBeGreaterThan(400);
      expect(canvas.getByTestId("workspace-document-area").clientWidth).toBeLessThanOrEqual(420);
    });
    await waitFor(() => expect(switcher).toBeVisible());
    await userEvent.click(within(switcher).getByRole("button", { name: "본문 보기" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "합성 본문 메모" }), "합성 본문");
    await userEvent.click(within(switcher).getByRole("button", { name: "이력 보기" }));
    const history = await page.findByRole("complementary", { name: "합성 이력" });
    await waitFor(() => expect(history).toBeVisible());
    await userEvent.type(within(history).getByRole("textbox", { name: "합성 이력 메모" }), "유지할 합성 이력");
    await userEvent.click(within(switcher).getByRole("button", { name: "종합소견 보기" }));
    const receipt = await page.findByRole("complementary", { name: "합성 보조" });
    await waitFor(() => { expect(receipt).toBeVisible(); expect(history).not.toBeVisible(); });
    await userEvent.click(within(receipt).getByRole("button", { name: "합성 보조 작업" }));
    await waitFor(() => expect(within(receipt).getByLabelText("합성 보조 작업 횟수")).toHaveTextContent("1회"));
    await userEvent.click(within(switcher).getByRole("button", { name: "이력 보기" }));
    await waitFor(() => { expect(history).toBeVisible(); expect(within(history).getByRole("textbox", { name: "합성 이력 메모" })).toHaveValue("유지할 합성 이력"); });
    await userEvent.click(within(switcher).getByRole("button", { name: "본문 보기" }));
    await waitFor(() => expect(canvas.getByRole("textbox", { name: "합성 본문 메모" })).toHaveValue("합성 본문"));
  },
};

export const NavigationRail: Story = {
  args: { scenario: "nav-rail" },
  beforeEach: prepareShellClientStory,
  parameters: { docs: { story: { height: "790px" }, description: { story: "실제 NavRail입니다. 활성 메뉴, 이동 주소, 패널 펼치기, 미리보기 키보드 콜백과 입원 작업 중 표시를 확인합니다. 이동·미리보기 콜백은 로컬 표시만 바꿉니다. 실제 모듈 패널은 이 예제에서 렌더하지 않습니다. 고객센터는 준비 중 상태로 비활성화됩니다." } } },
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }));
    const reception = nav.getByRole("link", { name: "접수/예약" });
    await expect(reception).toHaveAttribute("aria-current", "page");
    reception.focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => { expect(canvas.getByLabelText("합성 메뉴 콜백")).toHaveTextContent("keyboard:reception"); expect(reception).toHaveAttribute("aria-expanded", "true"); });
    await userEvent.click(nav.getByRole("button", { name: "사이드 패널 펼치기" }));
    await waitFor(() => expect(nav.queryByRole("button", { name: "사이드 패널 펼치기" })).not.toBeInTheDocument());
    const lab = nav.getByRole("link", { name: "임상병리검사" });
    await expect(lab).toHaveAttribute("href", `/w/${syntheticShellWorkspaceId}/lab?story=synthetic`);
    await userEvent.hover(lab);
    await userEvent.click(nav.getByRole("link", { name: "임상병리검사" }), { skipHover: true });
    await waitFor(() => {
      if (nav.getByRole("link", { name: "임상병리검사" }).getAttribute("aria-current") !== "page") throw new Error(`Actual lab link did not become current. Observed native clicks: ${JSON.stringify(navClickObservations)}. Router calls: ${JSON.stringify(getRouter().push.mock.calls)}`);
      expect(canvas.getByLabelText("합성 메뉴 콜백")).toHaveTextContent(`navigate:/w/${syntheticShellWorkspaceId}/lab?story=synthetic`);
    });
    await expect(nav.getByRole("button", { name: "입원(작업 중)" })).toHaveAttribute("aria-disabled", "true");
    await expect(nav.getByRole("button", { name: "고객센터 (준비 중)" })).toBeDisabled();
  },
};

export const GlobalSearchKeyboard: Story = {
  args: { scenario: "global-search" },
  beforeEach: prepareShellClientStory,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/w/${syntheticShellWorkspaceId}/home` } }, docs: { description: { story: "실제 GlobalCommandPalette입니다. Ctrl+K, 검색·필터 요청, 결과 키보드 이동·실행과 닫기를 확인합니다. 검색 API는 타입에 맞춘 로컬 합성 응답입니다. 역할 필터의 합성 서버 결과가 표시되며 키보드로 실행되는지 확인합니다. Next router는 Storybook의 기록 전용 mock이며 URL을 이동하지 않습니다. 실제 서버 검색이나 권한 검증 결과를 뜻하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const router = getRouter();
    const callsBefore = router.push.mock.calls.length;
    const urlBefore = window.location.href;
    await userEvent.keyboard("{Control>}k{/Control}");
    const dialog = await page.findByRole("dialog", { name: "통합 검색과 빠른 실행" });
    await waitFor(() => expect(dialog).toBeVisible());
    const input = within(dialog).getByRole("textbox", { name: "통합 검색" });
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, "합성 수의사");
    await within(dialog).findByText("합성 수의사 1");
    await userEvent.click(within(dialog).getByRole("button", { name: "수의사" }));
    await waitFor(() => expect(commandSearchRequests).toContainEqual({ query: "합성 수의사", filter: "vet" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: /합성 수의사 1/ })).toBeVisible());
    for (const [label, filter] of [["데스크", "desk"], ["테크니션", "technician"]]) {
      await userEvent.click(within(dialog).getByRole("button", { name: label }));
      await waitFor(() => expect(commandSearchRequests).toContainEqual({ query: "합성 수의사", filter }));
      await waitFor(() => expect(within(dialog).getByRole("button", { name: /합성 수의사 1/ })).toBeVisible());
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "테크니션" }));
    await expect(within(dialog).getByRole("button", { name: /합성 수의사 1/ })).toBeVisible();
    input.focus();
    await userEvent.keyboard("{ArrowDown}");
    const second = within(dialog).getByRole("button", { name: /합성 수의사 2/ });
    await waitFor(() => expect(second).toHaveAttribute("data-active", "true"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(router.push.mock.calls.length).toBe(callsBefore + 1);
      expect(router.push.mock.calls[callsBefore]?.[0]).toBe(`/w/${syntheticShellWorkspaceId}/orders?syntheticStaff=2`);
      expect(dialog).not.toBeVisible();
    });
    await expect(window.location.href).toBe(urlBefore);
  },
};

let delayedSearchFixture: { cleanup?: () => Promise<void> };
export const GlobalSearchResponseOrderingAndClose: Story = {
  args: { scenario: "global-search" },
  beforeEach: () => {
    const restoreShell = prepareShellClientStory();
    const fixture: typeof delayedSearchFixture = {};
    delayedSearchFixture = fixture;
    return async () => { try { await fixture.cleanup?.(); } finally { restoreShell(); } };
  },
  parameters: { nextjs: { appDirectory: true }, docs: { description: { story: "합성 검색 응답을 지연시켜 검색어·필터 변경 전 응답과 닫기 후 응답을 실제 검색창이 무시하는지 확인합니다. AbortSignal을 무시하는 합성 전송으로 응답 순서 보호까지 검사합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const previousFetch = globalThis.fetch;
    const fixture = delayedSearchFixture;
    const pending: { query: string; filter: string; signal: AbortSignal | null | undefined; release: () => void; consumed: Promise<void> }[] = [];
    let cleanupPromise: Promise<void> | undefined;
    const cleanup = () => cleanupPromise ??= (async () => {
      try {
        await act(async () => { for (const request of pending) request.release(); await Promise.all(pending.map(request => request.consumed)); });
      } finally {
        globalThis.fetch = previousFetch;
      }
    })();
    fixture.cleanup = cleanup;
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== `/api/workspaces/${syntheticShellWorkspaceId}/command/search`) return previousFetch(input, init);
      const response = await previousFetch(input, init);
      const result = await response.json() as CommandSearchResponse;
      const filter = url.searchParams.get("filter") ?? "all";
      if (result.ok) result.results = result.results.map(item => ({ ...item, title: `${item.title} (${filter})` }));
      let release!: () => void;
      let markConsumed!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const consumed = new Promise<void>(resolve => { markConsumed = resolve; });
      const delayed = Response.json(result, { status: response.status });
      const readJson = delayed.json.bind(delayed);
      delayed.json = async () => { try { return await readJson(); } finally { markConsumed(); } };
      pending.push({ query: url.searchParams.get("query") ?? "", filter, signal: init?.signal, release, consumed });
      await gate;
      return delayed;
    };
    const findRequest = async (query: string, filter: string) => {
      await waitFor(() => expect(pending.some(item => item.query === query && item.filter === filter)).toBe(true));
      return pending.find(item => item.query === query && item.filter === filter)!;
    };
    const complete = async (request: typeof pending[number]) => {
      await act(async () => { request.release(); await request.consumed; });
    };
    try {
      await userEvent.click(canvas.getByRole("button", { name: "전역 통합 검색 열기" }));
      const dialog = await page.findByRole("dialog", { name: "통합 검색과 빠른 실행" });
      const input = within(dialog).getByRole("textbox", { name: "통합 검색" });
      await userEvent.type(input, "합성 수의사");
      const oldQuery = await findRequest("합성 수의사", "all");
      await userEvent.clear(input);
      await userEvent.type(input, "합성 일부");
      const oldFilter = await findRequest("합성 일부", "all");
      await userEvent.click(within(dialog).getByRole("button", { name: "수의사" }));
      const latest = await findRequest("합성 일부", "vet");
      await complete(latest);
      await within(dialog).findByText("합성 일부 1 (vet)");
      await expect(oldQuery.signal?.aborted).toBe(true);
      await expect(oldFilter.signal?.aborted).toBe(true);
      await complete(oldFilter);
      await complete(oldQuery);
      await expect(within(dialog).getByText("합성 일부 1 (vet)")).toBeVisible();
      await expect(within(dialog).queryByText("합성 일부 1 (all)")).not.toBeInTheDocument();
      await expect(within(dialog).queryByText("합성 수의사 1 (all)")).not.toBeInTheDocument();
      await userEvent.clear(input);
      await userEvent.type(input, "합성 수의사");
      const afterClose = await findRequest("합성 수의사", "vet");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(dialog).not.toBeVisible());
      await expect(afterClose.signal?.aborted).toBe(true);
      await complete(afterClose);
      await userEvent.click(canvas.getByRole("button", { name: "전역 통합 검색 열기" }));
      const reopened = await page.findByRole("dialog", { name: "통합 검색과 빠른 실행" });
      await expect(within(reopened).getByRole("textbox", { name: "통합 검색" })).toHaveValue("");
      await expect(within(reopened).queryByText("합성 수의사 1 (vet)")).not.toBeInTheDocument();
      await waitFor(() => expect(within(reopened).getByRole("button", { name: /신규 진료 접수/ })).toBeVisible());
      await userEvent.keyboard("{Escape}");
    } finally {
      await cleanup();
    }
  },
};

export const GlobalSearchFeedback: Story = {
  args: { scenario: "global-search" },
  beforeEach: prepareShellClientStory,
  parameters: { nextjs: { appDirectory: true }, docs: { description: { story: "실제 검색창에서 로컬 합성 응답의 빈 결과·실패·일부 결과 경고를 확인합니다. 오류 후에도 검색 입력을 유지하고 다시 검색할 수 있습니다. 닫은 뒤 새로 열면 검색어와 필터를 초기화하는 원본 동작을 확인합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "전역 통합 검색 열기" }));
    const dialog = await page.findByRole("dialog", { name: "통합 검색과 빠른 실행" });
    const input = within(dialog).getByRole("textbox", { name: "통합 검색" });
    await userEvent.type(input, "합성 빈 결과");
    await waitFor(() => { expect(commandSearchRequests).toContainEqual({ query: "합성 빈 결과", filter: "all" }); expect(within(dialog).getByText("검색 결과가 없습니다.")).toBeVisible(); });
    await userEvent.clear(input);
    await userEvent.type(input, "합성 오류");
    await within(dialog).findByText("검색 결과를 불러오지 못했습니다.");
    await expect(input).toHaveValue("합성 오류");
    await userEvent.clear(input);
    await userEvent.type(input, "합성 일부");
    await within(dialog).findByText("일부 결과를 불러오지 못했습니다.");
    await expect(within(dialog).getByRole("button", { name: /합성 일부 1/ })).toBeVisible();
    input.focus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "전역 통합 검색 열기" }));
    const reopened = await page.findByRole("dialog", { name: "통합 검색과 빠른 실행" });
    await waitFor(() => expect(within(reopened).getByRole("textbox", { name: "통합 검색" })).toHaveValue(""));
    await waitFor(() => expect(within(reopened).getByRole("button", { name: /신규 진료 접수/ })).toBeVisible());
    await userEvent.keyboard("{Escape}");
  },
};

export const WorkspaceControls: Story = {
  args: { scenario: "workspace-controls" },
  beforeEach: prepareShellClientStory,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/w/${syntheticShellWorkspaceId}/home` } }, docs: { description: { story: "실제 WorkspaceTabsBar입니다. 로컬 콜백으로 뒤로·앞으로 가능 상태, 새로고침 중 비활성화, 알림 99+ 표시와 열림·닫힘을 확인합니다. 프로필은 합성 mock 세션입니다. 알림 대상은 합성 슬롯이며 실제 NotificationDrawer나 서버 저장을 실행하지 않습니다. 도움말은 준비 중 상태로 비활성화됩니다." } } },
  play: async ({ canvas }) => {
    const bar = within(canvas.getByTestId("workspace-tabs-bar"));
    await expect(bar.getByRole("button", { name: "탭 뒤로가기" })).toBeDisabled();
    await userEvent.click(bar.getByRole("button", { name: "탭 앞으로가기" }));
    await waitFor(() => { expect(bar.getByRole("button", { name: "탭 앞으로가기" })).toBeDisabled(); expect(bar.getByRole("button", { name: "탭 뒤로가기" })).toBeEnabled(); });
    await userEvent.click(bar.getByRole("button", { name: "탭 뒤로가기" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 상단 바 콜백")).toHaveTextContent("back"));
    const refresh = bar.getByRole("button", { name: "합성 업무 새로고침" });
    await userEvent.click(refresh);
    await waitFor(() => expect(refresh).toBeDisabled());
    await userEvent.click(canvas.getByRole("button", { name: "합성 새로고침 완료" }));
    await waitFor(() => expect(refresh).toBeEnabled());
    await expect(bar.getByTestId("global-notification-badge")).toHaveTextContent("99+");
    await userEvent.click(bar.getByRole("button", { name: "알림 센터 열기, 중요 알림 123개" }));
    const notifications = bar.getByRole("button", { name: "알림 센터 열기" });
    await waitFor(() => { expect(notifications).toHaveAttribute("aria-expanded", "true"); expect(canvas.getByRole("region", { name: "합성 알림 대상" })).toBeVisible(); expect(bar.queryByTestId("global-notification-badge")).not.toBeInTheDocument(); });
    await userEvent.click(notifications);
    await waitFor(() => expect(notifications).toHaveAttribute("aria-expanded", "false"));
    await expect(bar.getByRole("button", { name: "도움말 (준비 중)" })).toBeDisabled();
  },
};

export const ShellComposition: Story = {
  args: { scenario: "shell-main" },
  beforeEach: () => {
    const restoreFrame = prepareDocumentFrameStory();
    const restoreClient = prepareShellClientStory();
    return () => { restoreClient(); restoreFrame(); };
  },
  parameters: { docs: { story: { height: "750px" }, description: { story: "실제 ShellMain이 WorkspaceSwitcher·NavRail·WorkspaceFrame을 배치합니다. 상단 영역과 문서 본문·이력·보조 내용은 합성 슬롯입니다. 메뉴 이동 콜백에는 원본이 현재 패널 상태인 modulePanel=closed를 추가합니다. synthetic-layout은 registry 모듈이 아니므로 실제 모듈 사이드 패널을 이 예제의 커버리지로 세지 않습니다." } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByTestId("workspace-switcher")).toBeVisible();
    await expect(canvas.getByRole("navigation", { name: "워크스페이스 주요 메뉴" })).toBeVisible();
    await expect(canvas.getByTestId("shell-workspace-area")).toContainElement(canvas.getByTestId("workspace-document"));
    const nav = within(canvas.getByRole("navigation", { name: "워크스페이스 주요 메뉴" }));
    await expect(nav.getByRole("link", { name: "고객관리" })).toHaveAttribute("href", `/w/${syntheticShellWorkspaceId}/customer?story=synthetic`);
    nav.getByRole("link", { name: "고객관리" }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      const receipt = canvas.getByLabelText("합성 셸 구성 콜백");
      const expected = `navigate:customer:/w/${syntheticShellWorkspaceId}/customer?story=synthetic&modulePanel=closed`;
      if (receipt.textContent !== expected) throw new Error(`Actual customer callback receipt: ${receipt.textContent}. Expected: ${expected}. Observed native clicks: ${JSON.stringify(navClickObservations)}. Router calls: ${JSON.stringify(getRouter().push.mock.calls)}`);
      expect(receipt).toHaveTextContent(expected);
    });
  },
};

export const AppRootComposition: Story = {
  args: { scenario: "app-root" },
  beforeEach: prepareAppRootStory,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/w/${syntheticShellWorkspaceId}/inpatient` } }, docs: { story: { height: "820px" }, description: { story: "실제 AppShell과 WorkspaceEntrySplashProvider를 렌더합니다. 입원 모듈은 원본에 있는 로컬 합성 데이터를 사용하며 메뉴의 작업 중 상태도 유지합니다. 알림 목록은 로컬 빈 응답입니다. 실제 알림 Drawer·탭 생성·Next router 호출을 확인합니다. 탭 저장 요청은 로컬에서 받으며 원본 지연 저장이 끝난 뒤 fetch와 저장소를 복원합니다. 이 예제는 배포 경로 접근·권한·실제 서버 저장의 검증이 아닙니다. 중복 업무·워크스페이스 전환 확인 Dialog는 이 분기에서 열리지 않습니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const router = getRouter();
    const callsBefore = router.push.mock.calls.length;
    const urlBefore = window.location.href;
    await canvas.findByTestId("workspace-tabs-bar");
    await waitFor(() => expect(within(canvas.getByTestId("workspace-tabs-bar")).getAllByRole("tab")).toHaveLength(1));
    await expect(canvas.getByRole("button", { name: "입원(작업 중)" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(appRootRequests.some(request => request.method === "GET" && request.path.endsWith("/notifications"))).toBe(true));
    await userEvent.click(canvas.getByRole("button", { name: "알림 센터 열기" }));
    const notifications = await page.findByRole("dialog", { name: "알림" });
    await waitFor(() => expect(within(notifications).getByText("표시할 알림이 없습니다.")).toBeVisible());
    await userEvent.click(within(notifications).getByRole("button", { name: "알림 닫기" }));
    await waitFor(() => expect(notifications).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "새 업무 탭" }));
    await waitFor(() => {
      expect(within(canvas.getByTestId("workspace-tabs-bar")).getAllByRole("tab")).toHaveLength(2);
      expect(router.push.mock.calls.length).toBe(callsBefore + 1);
      expect(router.push.mock.calls[callsBefore]?.[0]).toBe(`/w/${syntheticShellWorkspaceId}/home?modulePanel=open`);
    });
    await expect(window.location.href).toBe(urlBefore);
    await waitFor(() => expect(appRootRequests.some(request => request.method === "PUT" && request.path.endsWith("/app-shell/workspace-tabs"))).toBe(true));
  },
};

export const AppRootSaveDrain: Story = {
  args: { scenario: "app-root" },
  beforeEach: prepareAppRootStory,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/w/${syntheticShellWorkspaceId}/inpatient` } }, docs: { story: { height: "820px" }, description: { story: "Storybook 정리 검사입니다. 현재 활성 탭을 다시 선택하면 상태가 바뀌지 않는지 확인합니다. 새 탭을 만들고 닫아 원래 payload로 돌아온 뒤 앱을 해제합니다. 이전의 같은 payload를 새 저장 완료로 세지 않고 마지막 저장 세대를 기다립니다. 실행 후 해제 상태는 제품 화면 상태를 뜻하지 않습니다." } } },
  play: async ({ canvas }) => {
    await canvas.findByTestId("workspace-tabs-bar");
    await waitFor(() => expect(appRootRequests.some(request => request.saveGeneration === getAppRootSaveGeneration() && request.method === "PUT")).toBe(true));
    const savedGeneration = getAppRootSaveGeneration();
    const savedPayload = appRootRequests.findLast(request => request.method === "PUT")?.payload;
    await userEvent.click(within(canvas.getByTestId("workspace-tabs-bar")).getByRole("tab", { name: "입원" }));
    await expect(getAppRootSaveGeneration()).toBe(savedGeneration);
    await userEvent.click(canvas.getByRole("button", { name: "새 업무 탭" }));
    await waitFor(() => expect(within(canvas.getByTestId("workspace-tabs-bar")).getAllByRole("tab")).toHaveLength(2));
    const close = canvas.getByRole("button", { name: "원내 현황 탭 닫기" });
    close.focus();
    await expect(close).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(within(canvas.getByTestId("workspace-tabs-bar")).getAllByRole("tab")).toHaveLength(1));
    await waitFor(() => expect(getAppRootSaveGeneration()).toBeGreaterThan(savedGeneration));
    const pendingGeneration = getAppRootSaveGeneration();
    unmountAppRootFixture();
    await expect(canvas.queryByTestId("workspace-tabs-bar")).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("합성 앱 해제 결과")).toBeVisible();
    await waitFor(() => {
      const latest = appRootRequests.findLast(request => request.method === "PUT");
      expect(latest?.saveGeneration).toBe(pendingGeneration);
      expect(latest?.payload).toBe(savedPayload);
    });
  },
};
