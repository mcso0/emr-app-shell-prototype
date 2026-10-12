import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId } from "react";
import { expect, userEvent, waitFor } from "storybook/test";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

type ResizableExampleArgs = { orientation: "horizontal" | "vertical"; withHandle: boolean };
function ResizableExample({ orientation, withHandle }: ResizableExampleArgs) {
  const id = useId();
  return (
    <ResizablePanelGroup orientation={orientation} className="rounded-md border border-border" style={{ height: 240, width: 480 }}>
      <ResizablePanel id={`${id}-summary`} defaultSize="50%" minSize="20%" maxSize="80%">
        <div className="flex h-full items-center justify-center text-sm">합성 요약</div>
      </ResizablePanel>
      <ResizableHandle withHandle={withHandle} />
      <ResizablePanel id={`${id}-details`} defaultSize="50%" minSize="20%" maxSize="80%">
        <div className="flex h-full items-center justify-center text-sm">합성 상세</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

const meta = {
  title: "Design System/UI/Resizable",
  component: ResizableExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "두 패널 사이의 공간을 사용자가 조정하는 기존 API 예시입니다. 현재 제품의 직접 호출은 확인되지 않았으며 이 예제는 독립 갤러리입니다. Group orientation과 Separator aria-orientation은 축이 반대입니다. 손잡이의 화살표 키로 크기를 바꿀 수 있습니다. 패널 내용과 최소·최대 크기는 호출자가 소유합니다.",
      },
    },
  },
  args: { orientation: "horizontal", withHandle: true },
  argTypes: {
    orientation: { control: "radio", options: ["horizontal", "vertical"], description: "PanelGroup에 적용하는 방향입니다." },
    withHandle: { control: "boolean", description: "Separator의 시각적 손잡이를 표시합니다." },
  },
  render: (args) => <ResizableExample {...args} />,
} satisfies Meta<ResizableExampleArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

async function resizeWithKeyboard(canvasElement: HTMLElement, orientation: "horizontal" | "vertical") {
  const handle = canvasElement.querySelector<HTMLElement>('[role="separator"]');
  const panel = canvasElement.querySelector<HTMLElement>('[data-slot="resizable-panel"]');
  if (!handle || !panel || handle.getAttribute("aria-orientation") !== (orientation === "horizontal" ? "vertical" : "horizontal") || handle.getAttribute("aria-valuenow") === null) throw new Error("The resize handle must expose its axis and current value.");
  const size = () => orientation === "horizontal" ? panel.getBoundingClientRect().width : panel.getBoundingClientRect().height;
  const initialSize = size();
  handle.focus();
  await userEvent.keyboard(orientation === "horizontal" ? "{ArrowRight}" : "{ArrowDown}");
  await waitFor(() => expect(size()).toBeGreaterThan(initialSize + 1));
  await userEvent.keyboard(orientation === "horizontal" ? "{ArrowLeft}" : "{ArrowUp}");
  await waitFor(() => expect(Math.abs(size() - initialSize)).toBeLessThan(1));
}

export const Horizontal: Story = {
  parameters: { docs: { description: { story: "좌우 패널을 키보드로 조정합니다. separator의 ARIA 방향은 vertical입니다." } } }, play: async ({ canvasElement }) => resizeWithKeyboard(canvasElement, "horizontal") };
export const Vertical: Story = {
  parameters: { docs: { description: { story: "상하 패널을 키보드로 조정합니다. separator의 ARIA 방향은 horizontal입니다." } } }, args: { orientation: "vertical" }, play: async ({ canvasElement }) => resizeWithKeyboard(canvasElement, "vertical") };
export const WithoutGrip: Story = {
  parameters: { docs: { description: { story: "시각적 grip이 없어도 separator의 크기 조정 계약을 유지합니다." } } }, args: { withHandle: false },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="resizable-handle"] > div')).not.toBeInTheDocument();
    await resizeWithKeyboard(canvasElement, "horizontal");
  },
};
