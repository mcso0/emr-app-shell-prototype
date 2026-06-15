import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import { Separator } from "./separator";

type SeparatorStoryArgs = {
  orientation: "horizontal" | "vertical";
};

function SeparatorExample({ orientation }: SeparatorStoryArgs) {
  if (orientation === "vertical") {
    return (
      <div className="flex h-16 items-center gap-3 rounded-md border border-border bg-card p-4">
        <span className="text-sm font-medium">샘플 요약</span>
        <Separator orientation="vertical" />
        <span className="text-sm text-muted-foreground">보조 정보</span>
        <Separator orientation="vertical" />
        <Button type="button" variant="outline" size="sm">
          보기
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-md border border-border bg-card p-4">
      <div>
        <div className="text-sm font-medium">샘플 섹션</div>
        <p className="mt-1 text-sm text-muted-foreground">
          구분선은 관련 없는 내용을 나누되, 새 panel처럼 보이게 만들지 않습니다.
        </p>
      </div>
      <Separator className="my-4" />
      <div className="text-sm text-muted-foreground">
        실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다.
      </div>
    </div>
  );
}

const meta = {
  title: "Design System/UI/Separator",
  component: SeparatorExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Separator to divide related groups inside one surface without creating a new panel. 사용할 때: menu groups, metadata rows, or sections need a subtle boundary. 쓰지 말아야 할 때: spacing alone is enough, or content needs a semantic heading/table boundary instead.",
      },
    },
  },
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Separator orientation.",
    },
  },
  args: {
    orientation: "horizontal",
  },
  render: (args) => <SeparatorExample {...args} />,
} satisfies Meta<SeparatorStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 한 surface 안에서 섹션을 조용히 나눌 때. 쓰지 말아야 할 때: heading이나 card boundary가 필요한 큰 구조.",
      },
    },
  },
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: toolbar나 metadata row 안의 짧은 그룹을 나눌 때. 쓰지 말아야 할 때: 좁은 화면에서 content가 눌리거나 wrapping되는 경우.",
      },
    },
  },
};
