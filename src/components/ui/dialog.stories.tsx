import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

type DialogStoryArgs = {
  description: string;
  showCloseButton: boolean;
  title: string;
  triggerLabel: string;
};

function DialogExample({
  description,
  showCloseButton,
  title,
  triggerLabel,
}: DialogStoryArgs) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="text-sm leading-5 text-foreground">
          합성 예시만 사용합니다. 실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다.
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            취소
          </DialogClose>
          <Button type="button">확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const meta = {
  title: "Design System/UI/Dialog",
  component: DialogExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Dialog for modal decisions, form flows, and focused content that blocks the current workflow until resolved. 사용할 때: the user must review or complete a bounded task. 쓰지 말아야 할 때: lightweight inline hints, transient feedback, or non-blocking filters.",
      },
    },
  },
  argTypes: {
    description: {
      control: "text",
      description: "Accessible supporting copy for the dialog title.",
    },
    showCloseButton: {
      control: "boolean",
      description: "Whether to show the top-right close button.",
    },
    title: {
      control: "text",
      description: "Dialog title. Keep it specific to the modal task.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger label for opening the dialog.",
    },
  },
  args: {
    description: "샘플 작업을 계속할지 확인합니다.",
    showCloseButton: true,
    title: "샘플 확인",
    triggerLabel: "다이얼로그 열기",
  },
  render: (args) => <DialogExample {...args} />,
} satisfies Meta<DialogStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openDialog(canvasElement: HTMLElement, title: string) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === "다이얼로그 열기"
  );

  if (!button) {
    throw new Error("Expected a dialog trigger button.");
  }

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.ownerDocument.body.textContent?.includes(title)) {
    throw new Error("Expected the dialog title to appear after opening.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 workflow를 잠시 멈추고 확인 또는 입력이 필요할 때. 쓰지 말아야 할 때: tooltip이나 inline alert로 충분한 가벼운 안내.",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await openDialog(canvasElement, args.title);
  },
};

export const ConfirmAction: Story = {
  args: {
    description: "샘플 요청을 처리하기 전에 한 번 더 확인합니다.",
    title: "샘플 요청 처리",
    triggerLabel: "확인 다이얼로그 열기",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 되돌리기 어렵거나 의미 있는 상태 변경 전 확인. 쓰지 말아야 할 때: 모든 사소한 버튼 클릭에 반복적으로 확인을 요구할 때.",
      },
    },
  },
};

export const WithoutCloseButton: Story = {
  args: {
    description: "명시적 footer action으로 닫히는 합성 예시입니다.",
    showCloseButton: false,
    title: "명시적 선택 필요",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 사용자가 footer action 중 하나를 명확히 선택해야 할 때. 쓰지 말아야 할 때: Esc/close affordance를 막아 사용자를 가두는 흐름.",
      },
    },
  },
};
