import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ReactNode } from "react";
import { expect, userEvent } from "storybook/test";
import { EmrRegistrationFooter } from "@/components/emr/registration-dialog";

import {
  CdsActionsPlusIcon,
  CdsActionsTrashIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";

import { Button } from "./button";

function RegistrationFooterCaller() {
  const [result, setResult] = useState("실행 없음");
  return <div className="grid gap-3">
    <div className="flex items-center justify-between gap-3"><EmrRegistrationFooter showPrevious nextLabel="다음"
      onCancel={() => setResult("취소")} onPrevious={() => setResult("이전")} onNext={() => setResult("다음")} /></div>
    <output aria-label="합성 등록 단계 요청">{result}</output>
  </div>;
}
function LocalCommands({ children }: { children: ReactNode }) {
  const [result, setResult] = useState("실행 없음");
  return <div className="grid gap-3" onClick={(event) => {
    const button = (event.target as Element).closest("button");
    if (button && !button.disabled) setResult(button.getAttribute("aria-label") || button.textContent || "합성 명령");
  }}>{children}<output aria-label="합성 버튼 실행">{result}</output></div>;
}

const meta = {
  title: "Design System/UI/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Button for explicit commands. Prefer existing variants and sizes before custom classes. Use icon-only buttons only when the accessible label names the action.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive"],
      description:
        "Visual command priority. Use destructive only for high-risk actions such as delete or cancel.",
    },
    size: {
      control: "select",
      options: ["tiny", "xs", "sm", "default", "lg", "xl", "icon", "icon-xs", "icon-sm", "icon-lg", "icon-xl"],
      description: "Control height and icon scale. Match the surrounding EMR density.",
    },
    roundness: {
      control: "radio",
      options: ["default", "round"],
      description: "Use default for most EMR controls. Use round only for compact pill-like commands.",
    },
    disabled: {
      control: "boolean",
      description: "Disabled controls must not replace permission or server-side enforcement.",
    },
    children: {
      control: "text",
      description: "Visible command label. Keep labels action-oriented and specific.",
    },
  },
  args: {
    children: "저장",
    disabled: false,
    roundness: "default",
    size: "default",
    variant: "default",
  },
  render: (args) => <LocalCommands><Button {...args} /></LocalCommands>,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <RegistrationFooterCaller />,
  play: async ({ canvas }) => {
    for (const name of ["다음", "이전", "취소"]) {
      await userEvent.click(canvas.getByRole("button", { name }));
      await expect(canvas.getByLabelText("합성 등록 단계 요청")).toHaveTextContent(name);
    }
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story: "실제 등록 폼의 EmrRegistrationFooter입니다. 취소·이전·다음의 variant·크기·배치를 원본이 렌더하며 콜백 결과만 로컬에 기록합니다.",
      },
    },
  },
};

export const Variants: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Use variants to show command priority. Do not use destructive for ordinary warnings or passive status.",
      },
    },
  },
  render: () => (
    <LocalCommands><div className="flex flex-wrap items-center gap-3">
      <Button variant="default">저장</Button>
      <Button variant="outline">PDF</Button>
      <Button variant="secondary">임시 저장</Button>
      <Button variant="ghost">취소</Button>
      <Button variant="destructive">삭제</Button>
    </div></LocalCommands>
  ),
};

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story: "Use smaller sizes in dense tables and side panels. Reserve larger sizes for spacious dialogs.",
      },
    },
  },
  render: () => (
    <LocalCommands><div className="flex flex-wrap items-center gap-3">
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra large</Button>
    </div></LocalCommands>
  ),
};

export const IconUsage: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Use CDS icons inside buttons. Add data-icon so spacing follows the component contract; icon-only buttons require an aria-label.",
      },
    },
  },
  render: () => (
    <LocalCommands><div className="flex flex-wrap items-center gap-3">
      <Button>
        <CdsActionsPlusIcon data-icon="inline-start" aria-hidden="true" />
        신규 등록
      </Button>
      <Button variant="outline" size="sm">
        <CdsActionsTrashIcon data-icon="inline-start" aria-hidden="true" />
        삭제
      </Button>
      <Button size="icon" variant="ghost" aria-label="신규 등록">
        <CdsActionsPlusIcon aria-hidden="true" />
      </Button>
      <Button size="tiny" variant="ghost" aria-label="닫기">
        <CdsActionsXIcon aria-hidden="true" />
      </Button>
    </div></LocalCommands>
  ),
};

export const DisabledAndInvalid: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Disabled and invalid states are visual affordances only. They must not be treated as permission or validation enforcement.",
      },
    },
  },
  render: () => (
    <LocalCommands><div className="flex flex-wrap items-center gap-3">
      <Button disabled>저장 불가</Button>
      <Button variant="outline" disabled>
        선택 필요
      </Button>
      <Button aria-invalid="true">검증 필요</Button>
    </div></LocalCommands>
  ),
};
