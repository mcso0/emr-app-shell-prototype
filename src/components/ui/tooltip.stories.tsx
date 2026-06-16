import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type TooltipStoryArgs = {
  content: string;
  disabled: boolean;
  side: "top" | "right" | "bottom" | "left";
  sideOffset: number;
};

function TooltipExample({
  content,
  disabled,
  side,
  sideOffset,
}: TooltipStoryArgs) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
            >
              샘플 작업
            </Button>
          }
        />
        <TooltipContent side={side} sideOffset={sideOffset}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const meta = {
  title: "Design System/UI/Tooltip",
  component: TooltipExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Tooltip for short helper text on icon-only controls, dense controls, and abbreviated UI. 사용할 때: the UI is already usable and the tooltip adds clarification. 쓰지 말아야 할 때: required instructions, errors, confirmations, or content the user must read to complete a workflow.",
      },
    },
  },
  argTypes: {
    content: {
      control: "text",
      description: "Short helper copy. Keep it synthetic and concise.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the trigger in this example. Disabled controls may not expose hover/focus tooltips reliably.",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
      description: "Preferred tooltip placement relative to the trigger.",
    },
    sideOffset: {
      control: { type: "number", min: 0, max: 16 },
      description: "Spacing between trigger and tooltip content.",
    },
  },
  args: {
    content: "짧은 보조 설명만 표시합니다.",
    disabled: false,
    side: "top",
    sideOffset: 6,
  },
  render: (args) => <TooltipExample {...args} />,
} satisfies Meta<TooltipStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 버튼이나 compact control의 의미를 짧게 보충할 때. 쓰지 말아야 할 때: workflow 완료에 꼭 필요한 설명.",
      },
    },
  },
};

export const IconButtonHint: Story = {
  args: {
    content: "검색",
  },
  render: (args) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="샘플 검색"
            >
              ?
            </Button>
          }
        />
        <TooltipContent side={args.side} sideOffset={args.sideOffset}>
          {args.content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: icon-only control에 이미 aria-label이 있고 visual hint만 보강할 때. 쓰지 말아야 할 때: accessible label을 tooltip에만 의존할 때.",
      },
    },
  },
};

export const BottomPlacement: Story = {
  args: {
    content: "아래쪽에 표시되는 합성 안내입니다.",
    side: "bottom",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 상단 공간이 부족해 아래 배치가 더 안정적인 control. 쓰지 말아야 할 때: tooltip이 다음 UI를 가리는 경우.",
      },
    },
  },
};

export const DisabledTrigger: Story = {
  args: {
    content: "비활성 상태에서는 별도 설명 UI를 고려하세요.",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: disabled trigger의 시각 상태를 확인할 때. 쓰지 말아야 할 때: 비활성 이유를 tooltip에만 숨겨 둘 때.",
      },
    },
  },
};
