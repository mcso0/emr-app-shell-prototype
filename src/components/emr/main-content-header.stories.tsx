import { useState } from "react";
import { expect, userEvent } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";

import {
  EmrMainContentHeader,
  type EmrMainContentHeaderHeightMode,
} from "./main-content-header";

type EmrMainContentHeaderStoryArgs = {
  heightMode: EmrMainContentHeaderHeightMode;
  showContent: boolean;
};

function EmrMainContentHeaderExample({
  heightMode,
  showContent,
}: EmrMainContentHeaderStoryArgs) {
  const [receipt, setReceipt] = useState(false);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-[var(--emr-surface-workspace)]">
      <EmrMainContentHeader
        aria-hidden={showContent ? undefined : true}
        heightMode={heightMode}
        className="justify-center border-b border-[var(--emr-border-default)] px-4"
      >
        {showContent ? (
          <div className="flex items-center justify-between gap-3">
            <span className="emr-text-body font-medium">
              공통 본문 Header 예시
            </span>
            <Button size="sm" variant="outline" onClick={() => setReceipt(true)}>
              보조 작업
            </Button>
          </div>
        ) : null}
      </EmrMainContentHeader>
      <div className="p-4 emr-text-dense text-muted-foreground">
        {receipt ? <span role="status">보조 작업 선택됨</span> : "Header 아래의 메뉴 주요 콘텐츠 영역입니다."}
      </div>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrMainContentHeader",
  component: EmrMainContentHeaderExample,
  tags: ["autodocs"],
  play: async ({ canvas, args }) => {
    if (args.showContent) {
      await userEvent.click(canvas.getByRole("button", { name: "보조 작업" }));
      await expect(canvas.getByRole("status")).toHaveTextContent("보조 작업 선택됨");
    } else { await expect(canvas.queryByRole("button")).not.toBeInTheDocument(); }
  },
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrMainContentHeader for the shared frame between the workspace shell and a module's primary content. Default matches actual empty header spacers used by customer, auth and home modules. WithContent is a separate children API example with a local receipt, not a claimed current module toolbar. Fixed stays 56px. Adaptive becomes 44px only when the viewport is at least 1024px wide and below 1280px high.",
      },
    },
  },
  argTypes: {
    heightMode: {
      control: "inline-radio",
      options: ["fixed", "adaptive"],
    },
    showContent: {
      control: "boolean",
    },
  },
  args: {
    heightMode: "fixed",
    showContent: false,
  },
  render: (args) => <EmrMainContentHeaderExample {...args} />,
} satisfies Meta<EmrMainContentHeaderStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Fixed: Story = {};

export const Adaptive: Story = {
  args: {
    heightMode: "adaptive",
  },
};

export const WithContent: Story = {
  args: {
    showContent: true,
  },
};

export const Empty: Story = {
  args: {
    showContent: false,
  },
};
