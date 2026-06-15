import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

type SheetStoryArgs = {
  description: string;
  showCloseButton: boolean;
  side: "top" | "right" | "bottom" | "left";
  title: string;
  triggerLabel: string;
};

function SheetExample({
  description,
  showCloseButton,
  side,
  title,
  triggerLabel,
}: SheetStoryArgs) {
  return (
    <div className="flex min-h-64 items-start p-8">
      <Sheet>
        <SheetTrigger render={<Button type="button" variant="outline" />}>
          {triggerLabel}
        </SheetTrigger>
        <SheetContent side={side} showCloseButton={showCloseButton}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 text-sm">
            <div className="rounded-md border border-border p-3">
              <div className="font-medium text-foreground">샘플 요약</div>
              <div className="mt-1 text-muted-foreground">
                합성 demo text만 사용하며 실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다.
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="font-medium text-foreground">보조 작업</div>
              <div className="mt-1 text-muted-foreground">
                현재 화면을 유지한 채 부가 정보를 확인하는 예시입니다.
              </div>
            </div>
          </div>
          <SheetFooter>
            <SheetClose render={<Button type="button" variant="outline" />}>
              닫기
            </SheetClose>
            <Button type="button">샘플 적용</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

const meta = {
  title: "Design System/UI/Sheet",
  component: SheetExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Sheet for side-attached supporting workflows that need more room than a popover but less interruption than a full dialog. 사용할 때: contextual details, secondary editing, or review panels. 쓰지 말아야 할 때: destructive confirmation, global navigation, or complex forms that need full-page focus.",
      },
    },
  },
  argTypes: {
    description: {
      control: "text",
      description: "Accessible supporting copy for the sheet title.",
    },
    showCloseButton: {
      control: "boolean",
      description: "Whether to show the top-right close affordance.",
    },
    side: {
      control: "radio",
      options: ["top", "right", "bottom", "left"],
      description: "Viewport side where the sheet enters.",
    },
    title: {
      control: "text",
      description: "Sheet title. Keep it scoped to the side-panel task.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger label for opening the sheet.",
    },
  },
  args: {
    description: "현재 화면 옆에서 보조 정보를 확인하는 합성 예시입니다.",
    showCloseButton: true,
    side: "right",
    title: "샘플 사이드 패널",
    triggerLabel: "시트 열기",
  },
  render: (args) => <SheetExample {...args} />,
} satisfies Meta<SheetStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openSheet(canvasElement: HTMLElement, triggerLabel: string, title: string) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === triggerLabel
  );

  if (!button) {
    throw new Error("Expected a sheet trigger button.");
  }

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.ownerDocument.body.textContent?.includes(title)) {
    throw new Error("Expected the sheet title to appear after opening.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 화면 context를 유지하면서 오른쪽 보조 패널을 열 때. 쓰지 말아야 할 때: 짧은 helper text나 단일 선택만 필요한 경우.",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await openSheet(canvasElement, args.triggerLabel, args.title);
  },
};

export const LeftSide: Story = {
  args: {
    description: "왼쪽 rail 옆에서 열리는 합성 보조 패널입니다.",
    side: "left",
    title: "왼쪽 샘플 패널",
    triggerLabel: "왼쪽 시트 열기",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 왼쪽 navigation이나 queue context에서 보조 정보를 열 때. 쓰지 말아야 할 때: 패널이 주 화면의 필수 action을 가릴 때.",
      },
    },
  },
};

export const BottomSheet: Story = {
  args: {
    description: "좁은 화면에서 하단에 붙는 합성 패널입니다.",
    side: "bottom",
    title: "하단 샘플 패널",
    triggerLabel: "하단 시트 열기",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: mobile-like viewport에서 짧은 보조 흐름을 보여줄 때. 쓰지 말아야 할 때: 긴 스크롤 편집이나 복잡한 multi-step task.",
      },
    },
  },
};
