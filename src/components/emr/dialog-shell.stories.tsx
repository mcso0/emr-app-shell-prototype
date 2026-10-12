import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogTrigger } from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <EmrDialogShell
        description={description}
        footerMeta="합성 예시입니다. 실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다."
        primaryAction={<Button type="button" onClick={() => { setSaved(true); setOpen(false); }}>샘플 저장</Button>}
        secondaryAction={<DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>}
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
    {saved ? <output role="status">합성 저장 확인됨</output> : null}
    </>
  );
}

const meta = {
  title: "Design System/EMR/EmrDialogShell",
  component: EmrDialogShellExample,
  tags: ["autodocs"],
  play: async ({ canvasElement, args }) => verifyShell(canvasElement, args),
  parameters: {
    docs: {
      description: {
        component:
          "All five accepted shell variants keep their exact initial body, width, footer and controls. Primary action is now a local save receipt; Cancel, Escape and native keyboard opening are tested. This API specimen does not represent a feature form or persistence. Use EmrDialogShell for EMR product dialogs that need consistent header, body, footer, close affordance, action order, width, and scroll behavior. 사용할 때: confirmation, compact form, or wide form shells need the shared EMR dialog contract. 쓰지 말아야 할 때: lightweight popovers, one-off tooltip guidance, or feature logic that belongs at the call site.",
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
      options: ["confirm", "form", "wide-form", "registration-form", "registration-confirm"],
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

async function verifyShell(canvasElement: HTMLElement, args: EmrDialogShellStoryArgs) {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole("button", { name: args.triggerLabel });
  trigger.focus(); await userEvent.keyboard("{Enter}");
  let dialog = await body.findByRole("dialog", { name: args.title });
  await waitFor(() => expect(dialog).toBeVisible());
  await expect(dialog).toHaveAttribute("data-variant", args.variant);
  await userEvent.click(within(dialog).getByRole("button", { name: "취소" }));
  await waitFor(() => expect(body.queryByRole("dialog", { name: args.title })).not.toBeInTheDocument());
  await userEvent.click(trigger); dialog = await body.findByRole("dialog", { name: args.title });
  await waitFor(() => expect(dialog).toBeVisible());
  await userEvent.click(within(dialog).getByRole("button", { name: "샘플 저장" }));
  await expect(canvas.getByRole("status")).toHaveTextContent("합성 저장 확인됨");
  await waitFor(() => expect(body.queryByRole("dialog", { name: args.title })).not.toBeInTheDocument());
  trigger.focus(); await userEvent.keyboard(" "); await body.findByRole("dialog", { name: args.title });
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("dialog", { name: args.title })).not.toBeInTheDocument());
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
  play: async ({ canvasElement, args }) => verifyShell(canvasElement, args),
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

export const RegistrationForm: Story = {
  args: { title: "합성 등록 form shell", variant: "registration-form" },
  parameters: { docs: { description: { story: "등록 화면용 440px shell과 64px footer입니다. 필드, 검증, 저장은 호출 기능이 소유하며 이 예시는 shell만 보여줍니다." } } },
};

export const RegistrationConfirm: Story = {
  args: { title: "합성 등록 확인 shell", variant: "registration-confirm" },
  parameters: { docs: { description: { story: "등록 확인용 고정 높이 shell입니다. 실제 등록이나 저장을 수행하지 않습니다." } } },
};
