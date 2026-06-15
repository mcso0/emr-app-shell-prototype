import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

type PopoverStoryArgs = {
  description: string;
  side: "top" | "right" | "bottom" | "left";
  sideOffset: number;
  title: string;
  triggerLabel: string;
};

function PopoverExample({
  description,
  side,
  sideOffset,
  title,
  triggerLabel,
}: PopoverStoryArgs) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" />}>
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent align="start" side={side} sideOffset={sideOffset}>
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-2 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span>샘플 조건</span>
            <span className="text-muted-foreground">전체</span>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>샘플 상태</span>
            <span className="text-muted-foreground">진행</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const meta = {
  title: "Design System/UI/Popover",
  component: PopoverExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Popover for anchored non-modal controls such as small filters, pickers, and contextual details. 사용할 때: the user can keep working outside the surface. 쓰지 말아야 할 때: blocking confirmation, destructive decisions, or long forms that need modal focus.",
      },
    },
  },
  argTypes: {
    description: {
      control: "text",
      description: "Short supporting copy for the popover header.",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
      description: "Preferred popover side relative to the trigger.",
    },
    sideOffset: {
      control: { type: "number", min: 0, max: 16 },
      description: "Spacing between trigger and popover.",
    },
    title: {
      control: "text",
      description: "Popover title. Keep it scoped to the anchored task.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger label for opening the popover.",
    },
  },
  args: {
    description: "작은 조건을 빠르게 조정하는 합성 예시입니다.",
    side: "bottom",
    sideOffset: 6,
    title: "샘플 필터",
    triggerLabel: "팝오버 열기",
  },
  render: (args) => <PopoverExample {...args} />,
} satisfies Meta<PopoverStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openPopover(canvasElement: HTMLElement, title: string) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === "팝오버 열기"
  );

  if (!button) {
    throw new Error("Expected a popover trigger button.");
  }

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.ownerDocument.body.textContent?.includes(title)) {
    throw new Error("Expected the popover title to appear after opening.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 버튼에 붙은 작은 필터나 contextual controls. 쓰지 말아야 할 때: modal confirmation이 필요한 위험 action.",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await openPopover(canvasElement, args.title);
  },
};

export const FilterSummary: Story = {
  args: {
    description: "현재 화면에만 적용되는 합성 필터입니다.",
    title: "표 필터",
    triggerLabel: "필터 열기",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table 또는 queue 가까이에서 빠르게 조건을 바꿀 때. 쓰지 말아야 할 때: URL 상태나 저장된 view 관리가 필요한 복잡한 필터.",
      },
    },
  },
};

export const RightPlacement: Story = {
  args: {
    description: "오른쪽 공간을 사용하는 합성 popover입니다.",
    side: "right",
    title: "오른쪽 패널",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 왼쪽 rail이나 compact toolbar 옆에 anchored details를 보여줄 때. 쓰지 말아야 할 때: viewport 밖으로 잘리는 좁은 화면.",
      },
    },
  },
};
