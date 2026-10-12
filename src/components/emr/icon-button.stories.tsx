import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { EmrOrderGroupSection } from "./order-group-section";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  CdsActionsFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";

import { EmrIconButton } from "./icon-button";

type EmrIconButtonStoryArgs = {
  disabled: boolean;
  iconSize: "sm" | "md";
  label: string;
};

function EmrIconButtonExample({ disabled, iconSize, label }: EmrIconButtonStoryArgs) {
  const [receipt, setReceipt] = useState("아직 실행하지 않음");
  return (
    <div className="flex items-center gap-2">
      <EmrIconButton aria-label={label} disabled={disabled} iconSize={iconSize} onClick={() => setReceipt(label)}>
        <CdsActionsSearchIcon aria-hidden="true" />
      </EmrIconButton>
      <EmrIconButton aria-label="샘플 필터" disabled={disabled} iconSize={iconSize} onClick={() => setReceipt("샘플 필터")}>
        <CdsActionsFilterIcon aria-hidden="true" />
      </EmrIconButton>
      <EmrIconButton aria-label="샘플 추가" disabled={disabled} iconSize={iconSize} onClick={() => setReceipt("샘플 추가")}>
        <CdsActionsPlusIcon aria-hidden="true" />
      </EmrIconButton>
      <output role="status">{receipt}</output>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrIconButton",
  component: EmrIconButtonExample,
  tags: ["autodocs"],
  play: async ({ canvas, args }) => {
    const labels = [args.label, "샘플 필터", "샘플 추가"];
    for (const label of labels) {
      const button = canvas.getByRole("button", { name: label });
      if (args.disabled) {
        await expect(button).toBeDisabled(); await expect(getComputedStyle(button).pointerEvents).toBe("none");
        button.focus(); await expect(button).not.toHaveFocus(); await userEvent.keyboard("{Enter}");
      }
      else { button.focus(); await userEvent.keyboard("{Enter}"); await expect(canvas.getByRole("status")).toHaveTextContent(label); }
    }
    if (args.disabled) await expect(canvas.getByRole("status")).toHaveTextContent("아직 실행하지 않음");
  },
  parameters: {
    docs: {
      description: {
        component:
          "Default, MediumIcon and Disabled are explicit API specimens with local command receipts. OrderGroupCaller renders the actual exported ancestor and source-owned icon disclosure. Use EmrIconButton for dense EMR panel, table, and toolbar icon-only actions that need the shared hover/focus treatment. 사용할 때: compact search, filter, close, and overflow controls with a clear accessible label. 쓰지 말아야 할 때: visible text commands, navigation links, or high-risk actions that need explicit copy.",
      },
    },
  },
  argTypes: {
    disabled: {
      control: "boolean",
      description: "Whether the icon buttons are disabled.",
    },
    iconSize: {
      control: "radio",
      options: ["sm", "md"],
      description: "Icon slot size for dense or slightly larger controls.",
    },
    label: {
      control: "text",
      description: "Accessible label for the first icon button.",
    },
  },
  args: {
    disabled: false,
    iconSize: "sm",
    label: "샘플 검색",
  },
  render: (args) => <EmrIconButtonExample {...args} />,
} satisfies Meta<EmrIconButtonStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: side panel header나 dense toolbar의 icon-only command. 쓰지 말아야 할 때: 사용자가 action 의미를 텍스트로 확인해야 하는 primary command.",
      },
    },
  },
};

export const MediumIcon: Story = {
  args: {
    iconSize: "md",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 24px control 안에서 아이콘 판독성이 더 필요할 때. 쓰지 말아야 할 때: row마다 반복되는 아주 촘촘한 action cell.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 권한이나 현재 상태상 command가 일시적으로 불가함을 보여줄 때. 쓰지 말아야 할 때: 서버 권한 검증을 대체할 때.",
      },
    },
  },
};

function OrderCaller() {
  const [collapsed, setCollapsed] = useState(false);
  return <EmrOrderGroupSection title="합성 처치 Order" count={1} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)}>
    <p>합성 처치 항목</p>
  </EmrOrderGroupSection>;
}
export const OrderGroupCaller: Story = {
  render: () => <OrderCaller />, parameters: { controls: { disable: true } },
  play: async ({ canvas }) => {
    const close = canvas.getByRole("button", { name: "합성 처치 Order 접기" }); close.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(async () => { await expect(canvas.queryByText("합성 처치 항목")).not.toBeInTheDocument(); });
    await userEvent.click(canvas.getByRole("button", { name: "합성 처치 Order 펼치기" }));
    await waitFor(async () => { await expect(canvas.getByText("합성 처치 항목")).toBeVisible(); });
  },
};
