import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type DropdownMenuStoryArgs = {
  align: "start" | "center" | "end";
  checked: boolean;
  radioValue: string;
  side: "top" | "right" | "bottom" | "left";
  triggerLabel: string;
};

function DropdownMenuExample({
  align,
  checked,
  radioValue,
  side,
  triggerLabel,
}: DropdownMenuStoryArgs) {
  return (
    <div className="flex min-h-56 items-start p-8">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
          {triggerLabel}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>샘플 작업</DropdownMenuLabel>
            <DropdownMenuItem>
              상세 보기
              <DropdownMenuShortcut>Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>목록에 고정</DropdownMenuItem>
            <DropdownMenuItem disabled>사용할 수 없음</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={checked}>
            보조 정보 표시
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={radioValue}>
            <DropdownMenuRadioItem value="compact">촘촘하게</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfortable">여유 있게</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>추가 옵션</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>샘플 복사</DropdownMenuItem>
              <DropdownMenuItem>샘플 내보내기</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">샘플 제거</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const meta = {
  title: "Design System/UI/DropdownMenu",
  component: DropdownMenuExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use DropdownMenu for compact contextual command sets attached to one trigger. 사용할 때: row actions, overflow actions, or small view options. 쓰지 말아야 할 때: primary navigation, long forms, or blocking confirmations.",
      },
    },
  },
  argTypes: {
    align: {
      control: "radio",
      options: ["start", "center", "end"],
      description: "Popup alignment relative to the trigger.",
    },
    checked: {
      control: "boolean",
      description: "Demo checked state for a checkbox menu item.",
    },
    radioValue: {
      control: "radio",
      options: ["compact", "comfortable"],
      description: "Demo selected value for a radio menu group.",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
      description: "Preferred popup side relative to the trigger.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger label for opening the menu.",
    },
  },
  args: {
    align: "start",
    checked: true,
    radioValue: "comfortable",
    side: "bottom",
    triggerLabel: "작업 메뉴",
  },
  render: (args) => <DropdownMenuExample {...args} />,
} satisfies Meta<DropdownMenuStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openMenu(canvasElement: HTMLElement, triggerLabel: string) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === triggerLabel
  );

  if (!button) {
    throw new Error("Expected a dropdown menu trigger button.");
  }

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.ownerDocument.body.textContent?.includes("샘플 작업")) {
    throw new Error("Expected the dropdown menu content to appear after opening.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 한 버튼 아래에 관련 command를 짧게 묶을 때. 쓰지 말아야 할 때: 화면의 핵심 CTA를 숨기는 용도.",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await openMenu(canvasElement, args.triggerLabel);
  },
};

export const RowActions: Story = {
  args: {
    checked: false,
    radioValue: "compact",
    triggerLabel: "행 작업",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table row나 queue item의 보조 작업을 모을 때. 쓰지 말아야 할 때: 사용자가 반드시 알아야 하는 위험 작업을 숨길 때.",
      },
    },
  },
};

export const RightAligned: Story = {
  args: {
    align: "end",
    triggerLabel: "우측 정렬 메뉴",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 우측 toolbar 끝에서 메뉴가 viewport 안쪽으로 열려야 할 때. 쓰지 말아야 할 때: 좁은 공간에서 submenu가 잘릴 수 있을 때.",
      },
    },
  },
};
