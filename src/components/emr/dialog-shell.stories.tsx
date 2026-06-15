import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

import { EmrDialogShell, type EmrDialogShellVariant } from "./dialog-shell";

type EmrDialogShellStoryArgs = {
  description: string;
  showCloseButton: boolean;
  title: string;
  triggerLabel: string;
  variant: EmrDialogShellVariant;
};

function EmrDialogShellExample({
  description,
  showCloseButton,
  title,
  triggerLabel,
  variant,
}: EmrDialogShellStoryArgs) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <EmrDialogShell
        description={description}
        footerMeta="합성 예시입니다. 실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다."
        primaryAction={<Button type="button">샘플 저장</Button>}
        secondaryAction={<Button type="button" variant="outline">취소</Button>}
        showCloseButton={showCloseButton}
        title={title}
        variant={variant}
      >
        <div className="grid gap-3 text-sm leading-5">
          <div className="rounded-md border border-border bg-card p-3">
            <div className="font-medium text-foreground">샘플 본문</div>
            <p className="mt-1 text-muted-foreground">
              기능별 form field, mutation state, validation copy는 각 feature call site가 소유합니다.
            </p>
          </div>
          {variant !== "confirm" ? (
            <div className="rounded-md border border-border p-3 text-muted-foreground">
              form/wide-form variant는 body scroll과 shell footer 구조를 확인하기 위한 예시입니다.
            </div>
          ) : null}
        </div>
      </EmrDialogShell>
    </Dialog>
  );
}

const meta = {
  title: "Design System/EMR/EmrDialogShell",
  component: EmrDialogShellExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrDialogShell for EMR product dialogs that need consistent header, body, footer, close affordance, action order, width, and scroll behavior. 사용할 때: confirmation, compact form, or wide form shells need the shared EMR dialog contract. 쓰지 말아야 할 때: lightweight popovers, one-off tooltip guidance, or feature logic that belongs at the call site.",
      },
    },
  },
  argTypes: {
    description: {
      control: "text",
      description: "Dialog description shown under the title.",
    },
    showCloseButton: {
      control: "boolean",
      description: "Whether to show the top-right close button.",
    },
    title: {
      control: "text",
      description: "Visible dialog title.",
    },
    triggerLabel: {
      control: "text",
      description: "Visible trigger button label.",
    },
    variant: {
      control: "radio",
      options: ["confirm", "form", "wide-form"],
      description: "Shared EMR dialog shell variant.",
    },
  },
  args: {
    description: "샘플 작업의 영향을 확인하는 합성 다이얼로그입니다.",
    showCloseButton: true,
    title: "샘플 다이얼로그",
    triggerLabel: "다이얼로그 열기",
    variant: "confirm",
  },
  render: (args) => <EmrDialogShellExample {...args} />,
} satisfies Meta<EmrDialogShellStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openDialogShell(canvasElement: HTMLElement, title: string) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === "다이얼로그 열기"
  );

  if (!button) {
    throw new Error("Expected an EMR dialog shell trigger button.");
  }

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.ownerDocument.body.textContent?.includes(title)) {
    throw new Error("Expected the EMR dialog shell title to appear after opening.");
  }
}

export const Confirm: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 확인, 상태 변경 CTA, compact decision. 쓰지 말아야 할 때: 긴 form이나 multi-section 입력.",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await openDialogShell(canvasElement, args.title);
  },
};

export const Form: Story = {
  args: {
    description: "작은 form shell 구조를 확인하는 합성 예시입니다.",
    title: "샘플 form shell",
    variant: "form",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: compact create/edit form에 shared header/body/footer가 필요할 때. 쓰지 말아야 할 때: feature validation이나 mutation logic을 shell에 넣을 때.",
      },
    },
  },
};

export const WideForm: Story = {
  args: {
    description: "넓은 form shell 구조를 확인하는 합성 예시입니다.",
    title: "샘플 wide form shell",
    variant: "wide-form",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: registration/profile-like multi-section form shell. 쓰지 말아야 할 때: 단순 confirm dialog에 과한 너비와 scroll 구조를 줄 때.",
      },
    },
  },
};
