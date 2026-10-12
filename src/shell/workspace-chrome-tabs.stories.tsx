import { useRef, useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { WorkspaceChromeTabs, type WorkspaceChromeTabItem } from "./workspace-chrome-tabs";
import { workspaceTabIconById } from "./module-nav-icons";

const sampleTabs: WorkspaceChromeTabItem[] = [
  { id: "chart", title: "진료/차트", ...workspaceTabIconById.treatment },
  { id: "home", title: "원내 현황", ...workspaceTabIconById.home },
  { id: "reception", title: "접수", ...workspaceTabIconById.reception },
];

const manyTabs: WorkspaceChromeTabItem[] = [
  ...sampleTabs,
  { id: "lab", title: "임상병리검사 결과 재확인", ...workspaceTabIconById.lab },
  { id: "imaging", title: "영상검사", ...workspaceTabIconById.imaging },
  { id: "dispensing", title: "조제/처치", ...workspaceTabIconById.dispensing },
  { id: "billing", title: "수납", ...workspaceTabIconById.billing },
  { id: "inpatient", title: "입원", ...workspaceTabIconById.inpatient },
  { id: "customer", title: "고객관리", ...workspaceTabIconById.customer },
  { id: "orders", title: "병원관리", ...workspaceTabIconById.orders },
  { id: "sample-followup", title: "합성 경과 기록", ...workspaceTabIconById.treatment },
  { id: "sample-review", title: "합성 검사 기록 확인", ...workspaceTabIconById.lab },
];

function WorkspaceTabsExample(args: ComponentProps<typeof WorkspaceChromeTabs>) {
  const [tabs, setTabs] = useState(args.tabs);
  const [activeTabId, setActiveTabId] = useState(args.activeTabId);
  const [memo, setMemo] = useState("");
  const nextTabNumber = useRef(1);

  return (
    <div className="mx-auto max-w-[960px] space-y-5 p-6">
      <div className="flex min-w-0 items-center gap-3 border-b border-border bg-background py-3">
        <WorkspaceChromeTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onActivateTab={(tabId) => {
            args.onActivateTab(tabId);
            setActiveTabId(tabId);
          }}
          onCloseTab={(tabId) => {
            args.onCloseTab(tabId);
            if (tabs.length <= 1) return;
            const index = tabs.findIndex((tab) => tab.id === tabId);
            const nextTabs = tabs.filter((tab) => tab.id !== tabId);
            setTabs(nextTabs);
            if (activeTabId === tabId) setActiveTabId(nextTabs[Math.max(0, index - 1)].id);
          }}
          onNewTab={() => {
            args.onNewTab();
            const number = nextTabNumber.current++;
            const newTab = { id: `sample-new-${number}`, title: `새 합성 탭 ${number}`, ...workspaceTabIconById.home };
            setTabs((current) => [...current, newTab]);
            setActiveTabId(newTab.id);
          }}
          onReorderTabs={(orderedIds) => {
            args.onReorderTabs(orderedIds);
            setTabs((current) => orderedIds.map((id) => current.find((tab) => tab.id === id)!));
          }}
        />
        <span className="shrink-0 text-sm text-muted-foreground">알림</span>
      </div>
      <p className="text-sm">현재 탭: {tabs.find((tab) => tab.id === activeTabId)?.title}</p>
      <label className="grid max-w-sm gap-1.5 text-sm">
        작업 메모
        <input
          className="rounded-md border border-input bg-background px-3 py-2"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">합성 데이터입니다. 탭 순서를 바꿔도 현재 탭과 메모를 유지합니다.</p>
    </div>
  );
}

const meta = {
  title: "Shell/Workspace Chrome Tabs",
  component: WorkspaceChromeTabs,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Synthetic workspace tabs demonstrate mouse drag sorting. Reordering preserves the selected tab and editor focus. Arrow keys move tab focus, and Enter or Space selects a tab. Keyboard and touch reordering are outside the current scope.",
      },
    },
  },
  args: {
    activeTabId: "home",
    tabs: sampleTabs,
    onActivateTab: fn(),
    onCloseTab: fn(),
    onNewTab: fn(),
    onReorderTabs: fn(),
  },
  render: (args) => <WorkspaceTabsExample {...args} />,
} satisfies Meta<typeof WorkspaceChromeTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const order = () => canvas.getAllByRole("tab").map((tab) => tab.textContent?.trim());
    const memo = canvas.getByRole("textbox", { name: "작업 메모" });
    await userEvent.type(memo, "합성 작업 메모");
    await expect(canvas.queryByRole("button", { name: "탭 정리" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "순서 되돌리기" })).not.toBeInTheDocument();
    const chartTab = canvas.getByRole("tab", { name: "진료/차트" });
    const homeTab = canvas.getByRole("tab", { name: "원내 현황" });
    const source = chartTab.getBoundingClientRect();
    const target = homeTab.getBoundingClientRect();
    const y = source.top + source.height / 2;
    await userEvent.pointer([
      { target: chartTab, keys: "[MouseLeft>]", coords: { clientX: source.left + 20, clientY: y } },
      { target: chartTab, coords: { clientX: source.left + 28, clientY: y } },
      { target: homeTab, coords: { clientX: target.left + 20, clientY: y } },
      { target: homeTab, keys: "[/MouseLeft]", coords: { clientX: target.left + 20, clientY: y } },
    ]);
    await waitFor(() => expect(order()).toEqual(["원내 현황", "진료/차트", "접수"]));
    await expect(args.onReorderTabs).toHaveBeenCalledTimes(1);
    await expect(args.onReorderTabs).toHaveBeenCalledWith(["home", "chart", "reception"]);
    await expect(args.onActivateTab).not.toHaveBeenCalled();
    await expect(canvas.getByRole("tab", { name: "원내 현황" })).toHaveAttribute("aria-selected", "true");
    await expect(memo).toHaveValue("합성 작업 메모");
    await expect(memo).toHaveFocus();
    await expect(canvas.getByText("진료/차트 탭이 3개 중 2번째로 이동되었습니다.", {
      selector: '[role="status"]',
    })).toHaveAttribute("aria-live", "polite");

    await expect(args.onCloseTab).not.toHaveBeenCalled();
    await expect(args.onNewTab).not.toHaveBeenCalled();
  },
};

export const ManyTabs: Story = {
  args: { tabs: manyTabs },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="workspace-tab-viewport"]');
    if (!viewport) throw new Error("Expected a tab scroll viewport.");
    await expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    const tabWidths = Array.from(viewport.querySelectorAll<HTMLElement>('[data-slot="workspace-tab"]'))
      .map((tab) => tab.getBoundingClientRect().width);
    await expect(tabWidths).toHaveLength(manyTabs.length);
    for (const width of tabWidths) {
      await expect(width).toBeGreaterThanOrEqual(79);
      await expect(width).toBeLessThanOrEqual(81);
    }
    await expect(canvas.getByRole("button", { name: "새 업무 탭" })).toBeVisible();
    const plusRect = canvas.getByRole("button", { name: "새 업무 탭" }).getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    await expect(plusRect.left).toBeGreaterThanOrEqual(viewportRect.right);
    await expect(plusRect.right).toBeLessThanOrEqual(canvasElement.getBoundingClientRect().right);
    await expect(canvas.getByText("알림")).toBeVisible();

    canvas.getByRole("tab", { name: "원내 현황" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: "접수" })).toHaveFocus();
    await expect(args.onActivateTab).not.toHaveBeenCalled();
    await expect(canvas.getByRole("tab", { name: "원내 현황" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}");
    await expect(args.onActivateTab).toHaveBeenCalledTimes(1);
    await expect(args.onActivateTab).toHaveBeenCalledWith("reception");
    await expect(canvas.getByText("현재 탭: 접수")).toBeVisible();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "접수 탭 닫기" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onCloseTab).toHaveBeenCalledTimes(1);
    await expect(args.onCloseTab).toHaveBeenCalledWith("reception");
    await expect(canvas.getByRole("tab", { name: "원내 현황" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(canvas.getByRole("button", { name: "새 업무 탭" }));
    await expect(args.onNewTab).toHaveBeenCalledOnce();
    await waitFor(() => {
      const activeTab = canvas.getByRole("tab", { name: "새 합성 탭 1" })
        .closest<HTMLElement>('[data-slot="workspace-tab"]');
      const tabRect = activeTab!.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      expect(tabRect.left).toBeGreaterThanOrEqual(viewportRect.left - 1);
      expect(tabRect.right).toBeLessThanOrEqual(viewportRect.right + 1);
    });
    await expect(canvas.getAllByRole("tab").at(-1)).toHaveTextContent("새 합성 탭 1");
    await expect(args.onReorderTabs).not.toHaveBeenCalled();
  },
};

export const ModerateTabs: Story = {
  args: { tabs: manyTabs.slice(0, 6) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="workspace-tab-viewport"]');
    if (!viewport) throw new Error("Expected a tab scroll viewport.");
    const tabWidths = Array.from(viewport.querySelectorAll<HTMLElement>('[data-slot="workspace-tab"]'))
      .map((tab) => tab.getBoundingClientRect().width);
    await expect(tabWidths).toHaveLength(6);
    for (const width of tabWidths) {
      await expect(width).toBeGreaterThanOrEqual(80);
      await expect(width).toBeLessThan(148);
      await expect(Math.abs(width - tabWidths[0])).toBeLessThan(1);
    }
    await expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
    await expect(canvas.getByRole("button", { name: "새 업무 탭" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "원내 현황" })).toHaveAttribute("aria-selected", "true");
    await expect(args.onReorderTabs).not.toHaveBeenCalled();
  },
};

export const SingleTab: Story = {
  args: { tabs: [sampleTabs[1]] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /탭 닫기/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "원내 현황" }));
    await expect(args.onActivateTab).toHaveBeenCalledTimes(1);
    await expect(args.onActivateTab).toHaveBeenCalledWith("home");
    await expect(args.onReorderTabs).not.toHaveBeenCalled();
    await expect(args.onCloseTab).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "새 업무 탭" }));
    await expect(args.onNewTab).toHaveBeenCalledOnce();
    await expect(canvas.getAllByRole("button", { name: /탭 닫기/ })).toHaveLength(2);
  },
};
