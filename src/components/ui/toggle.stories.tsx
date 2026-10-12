import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { EmrFilterToggle } from "@/components/emr/filter-toggle";
import homeStyles from "@/features/home/components/home-workspace-layout.module.css";

import { CdsActionsPinIcon } from "@/components/cds-icons/actions-and-controls";

import { Toggle } from "./toggle";

type ToggleArgs = ComponentProps<typeof Toggle>;

function ControlledToggle(args: ToggleArgs) {
  const [pressed, setPressed] = useState(Boolean(args.pressed ?? args.defaultPressed));

  return (
    <Toggle
      {...args}
      defaultPressed={undefined}
      pressed={pressed}
      onPressedChange={setPressed}
    />
  );
}

function HomeCompletedToggleCaller() {
  const [pressed, setPressed] = useState(false);
  return <div className="grid justify-items-start gap-3">
    <EmrFilterToggle className={`${homeStyles.compactAction} ${homeStyles.actionButton}`} aria-label="완료 포함" title={`완료 포함 · ${pressed ? "켜짐" : "꺼짐"}`}
      pressed={pressed} onPressedChange={setPressed}>완료 포함</EmrFilterToggle>
    <output aria-label="합성 완료 포함 설정">{pressed ? "완료 포함" : "완료 제외"}</output>
  </div>;
}

const meta = {
  title: "Design System/UI/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Toggle for one independently pressed button state. Use ToggleGroup for a related set and Switch for an immediate setting. Icon-only toggles require an accessible name.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "ghost", "outline", "default"],
      description:
        "CDS.V2 visual treatment. default remains a compatibility alias for ghost.",
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md", "default", "lg"],
      description:
        "xs preserves the legacy 28px control; sm/md are the CDS.V2 32px/36px controls. default/lg remain compatibility aliases.",
    },
    defaultPressed: {
      control: "boolean",
      description: "Initial pressed state for an uncontrolled Toggle.",
    },
    disabled: {
      control: "boolean",
      description: "Unavailable visual and interaction state.",
    },
    onPressedChange: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    children: "고정",
    defaultPressed: false,
    disabled: false,
    size: "sm",
    variant: "primary",
  },
  render: (args) => <ControlledToggle key={`${args.pressed}:${args.defaultPressed}`} {...args} />,
} satisfies Meta<typeof Toggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <HomeCompletedToggleCaller />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 Home의 완료 포함 EmrFilterToggle 구성입니다. class·기본 크기·title·이름·pressed를 그대로 제공합니다. query 변경은 로컬 설정 결과로 바꾸며 실제 Home 데이터 읽기·필터 결과는 이 범위에서 주장하지 않습니다." } } },
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "완료 포함" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle); await waitFor(() => { expect(toggle).toHaveAttribute("aria-pressed", "true"); expect(toggle).toHaveAttribute("title", "완료 포함 · 켜짐"); expect(canvas.getByLabelText("합성 완료 포함 설정")).toHaveTextContent("완료 포함"); });
    await userEvent.keyboard(" "); await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  },
};

export const Variants: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "순수 Toggle primary·ghost·outline API의 선택/기본/비활성 상태입니다. enabled 버튼은 자체 pressed 상태를 바꿉니다." } } },
  play: async ({ canvas }) => { const defaults = canvas.getAllByRole("button", { name: "기본" }); for (const button of defaults) { await userEvent.click(button); await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true")); } for (const button of canvas.getAllByRole("button", { name: "비활성" })) await expect(button).toBeDisabled(); },
  render: () => (
    <div className="grid gap-4">
      {(["primary", "ghost", "outline"] as const).map((variant) => (
        <div key={variant} className="flex items-center gap-3">
          <span className="w-16 emr-text-metadata text-muted-foreground">
            {variant}
          </span>
          <Toggle variant={variant} size="sm">
            기본
          </Toggle>
          <Toggle variant={variant} size="sm" defaultPressed>
            선택
          </Toggle>
          <Toggle variant={variant} size="sm" disabled>
            비활성
          </Toggle>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  play: async ({ canvas }) => { for (const button of canvas.getAllByRole("button")) { await userEvent.click(button); await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false")); } },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Toggle size="xs" variant="primary" defaultPressed>
        xs · 28
      </Toggle>
      <Toggle size="sm" variant="primary" defaultPressed>
        sm · 32
      </Toggle>
      <Toggle size="md" variant="primary" defaultPressed>
        md · 36
      </Toggle>
    </div>
  ),
};

export const WithIcon: Story = {
  play: async ({ canvas }) => { for (const name of ["라벨", "고정 표시"]) { const button = canvas.getByRole("button", { name }); await userEvent.click(button); await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true")); } },
  render: () => (
    <div className="flex items-center gap-3">
      <Toggle variant="outline" size="sm">
        <CdsActionsPinIcon aria-hidden="true" />
        라벨
      </Toggle>
      <Toggle
        aria-label="고정 표시"
        variant="outline"
        size="sm"
      >
        <CdsActionsPinIcon aria-hidden="true" />
      </Toggle>
    </div>
  ),
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Icons stay 16px in CDS.V2 sizes. The icon-only example supplies aria-label because the icon is decorative.",
      },
    },
  },
};
