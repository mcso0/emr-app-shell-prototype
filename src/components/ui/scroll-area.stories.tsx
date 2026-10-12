import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { EmrProfilePanelBody } from "@/components/emr/profile-panel";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { ScrollArea, ScrollBar } from "./scroll-area";

const meta = {
  title: "Design System/UI/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  args: { className: "h-40 w-64 rounded-md border border-border", "aria-label": "합성 세로 목록" },
  argTypes: {
    className: { control: "text", description: "The caller constrains the root size so overflow can occur." },
    viewportClassName: { control: "text", description: "Styles the inner scroll viewport, independently of the root." },
    viewportStyle: { control: "object", description: "Inline styles for the inner viewport." },
    viewportRef: { control: false, description: "Runtime ref to the scrollable viewport; not a fixture Control." },
  },
  parameters: {
    docs: {
      description: {
        component: "고정된 높이 안에서 보조 내용을 스크롤할 때 사용합니다. 화면 전체 스크롤이나 짧은 내용에는 사용하지 마세요. ScrollArea는 세로 ScrollBar를 포함합니다. 가로 스크롤바는 기존 Base UI Root·Viewport와 ScrollBar를 조합합니다. 넘치는 viewport는 키보드 초점을 받을 수 있습니다. 아래 내용은 합성 예시이며 네트워크 요청을 보내지 않습니다.",
      },
    },
  },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

async function assertScrollableGeometry(canvasElement: HTMLElement, orientation: "horizontal" | "vertical") {
  const viewport = canvasElement.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
  if (!viewport) throw new Error("The actual scroll viewport is missing.");
  let bar: HTMLElement | null = null;
  await waitFor(() => {
    bar = canvasElement.querySelector<HTMLElement>(`[data-slot="scroll-area-scrollbar"][data-orientation="${orientation}"]`);
    expect(bar).toBeInTheDocument();
    const rect = bar!.getBoundingClientRect();
    expect(orientation === "vertical" ? rect.width : rect.height).toBeCloseTo(10, 1);
    expect(orientation === "vertical" ? viewport.scrollHeight - viewport.clientHeight : viewport.scrollWidth - viewport.clientWidth).toBeGreaterThan(0);
    expect(viewport.tabIndex).toBe(0);
  });
  viewport.focus();
  await expect(viewport).toHaveFocus();
  // userEvent has no wheel method. The real ScrollBar handler owns this event.
  bar!.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: orientation === "horizontal" ? 64 : 0, deltaY: orientation === "vertical" ? 64 : 0 }));
  await waitFor(() => expect(orientation === "vertical" ? viewport.scrollTop : viewport.scrollLeft).toBeGreaterThan(0));
  viewport.scrollTo(0, 0);
}

export const Vertical: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 EmrProfilePanelBody의 세로 viewport·scroll-fade·pan-y·가로 차단 조합입니다. 부모 크기와 긴 합성 내용만 제공합니다." } } },
  render: () => (
    <section aria-label="합성 프로필 내용" className="flex h-40 w-64 flex-col rounded-md border border-border">
      <EmrProfilePanelBody>
        {Array.from({ length: 12 }, (_, index) => <div key={index} className="h-8 px-3 py-1 text-sm">합성 프로필 항목 {index + 1}</div>)}
      </EmrProfilePanelBody>
    </section>
  ),
  play: async ({ canvasElement }) => assertScrollableGeometry(canvasElement, "vertical"),
};

export const Horizontal: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "Base UI Root와 Viewport에 프로젝트 ScrollBar를 붙인 가로 조합입니다. ScrollArea 자체의 방향 prop 예시가 아닙니다." } } },
  render: () => (
    <ScrollAreaPrimitive.Root className="relative h-28 w-64 rounded-md border border-border" aria-label="합성 가로 목록">
      <ScrollAreaPrimitive.Viewport className="size-full" data-slot="scroll-area-viewport">
        <div className="flex h-20 w-[640px] items-center justify-around text-sm">
          {Array.from({ length: 8 }, (_, index) => <span key={index}>합성 열 {index + 1}</span>)}
        </div>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  ),
  play: async ({ canvasElement }) => assertScrollableGeometry(canvasElement, "horizontal"),
};
