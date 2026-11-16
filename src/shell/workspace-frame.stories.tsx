import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { modules } from "@/modules/registry";
import { usePageReadiness } from "@/components/emr/page-loading-boundary";
import { useLayoutStore } from "@/stores/layout-store";
import { prepareShellClientStory, syntheticShellWorkspaceId } from "@/stories/app-shell-caller-parity.stories.fixture";
import { WorkspaceFrame } from "./workspace-frame";

function PendingContent() {
  usePageReadiness(true, "synthetic-frame");
  return <button>준비 전 업무</button>;
}
function ReadyContent() { return <button>준비된 업무</button>; }
function PanelContent() { return <button>보조 작업</button>; }
function AllModuleFrames() {
  const [pending, setPending] = useState(true);
  return <div className="space-y-4 p-4">
    <button onClick={() => setPending(value => !value)}>로딩 전환</button>
    {modules.map(definition => <div key={definition.id} data-testid={`frame-${definition.id}`} className="h-[350px] [&>main]:h-full">
      <WorkspaceFrame workspaceId={syntheticShellWorkspaceId} moduleDefinition={{
        ...definition,
        content: pending ? PendingContent : ReadyContent,
        contentHeader: undefined,
        contentAside: undefined,
        slotAvailabilityProvider: undefined,
        rightPanel: definition.rightPanel ? PanelContent : undefined,
        drawer: undefined,
      }} />
    </div>)}
  </div>;
}
const meta = {
  title: "Shell/WorkspaceFrame",
  component: AllModuleFrames,
  parameters: { layout: "fullscreen" },
  beforeEach: () => {
    const restore = prepareShellClientStory();
    useLayoutStore.setState({ contentAsideOpen: false, rightPanelOpen: true });
    return restore;
  },
} satisfies Meta<typeof AllModuleFrames>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LoadingFrames: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frames = modules.map(definition => canvas.getByTestId(`frame-${definition.id}`));
    const geometry = () => frames.map(frame => [frame.querySelector("main")!, frame.querySelector('[data-testid="workspace-main-content"]')!].map(node => node.getBoundingClientRect().toJSON()));
    const bounds = geometry();
    for (const frame of frames) {
      const main = frame.querySelector("main")!;
      const section = frame.querySelector('[data-testid="workspace-main-content"]')!;
      await expect(main).toBeVisible();
      const shell = getComputedStyle(main).borderTopWidth === "1px" ? main : section;
      expect(getComputedStyle(shell).borderTopWidth).toBe("1px");
      expect(parseFloat(getComputedStyle(shell).borderTopLeftRadius)).toBeGreaterThan(0);
      await expect(within(frame).getByText("준비 전 업무")).not.toBeVisible();
    }
    await userEvent.click(canvas.getByRole("button", { name: "로딩 전환" }));
    for (const frame of frames) await expect(within(frame).getByText("준비된 업무")).toBeVisible();
    expect(geometry()).toEqual(bounds);
  },
};
