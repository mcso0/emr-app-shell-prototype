import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { EmrTableDensity } from "./table-density";
import { EmrTableDensitySelector } from "./table-density-selector";

type DensitySelectorArgs = {
  initialValue: EmrTableDensity;
  label: string;
};

function DensitySelectorExample({ initialValue, label }: DensitySelectorArgs) {
  const [value, setValue] = useState<EmrTableDensity>(initialValue);

  return (
    <div className="grid gap-3">
      <EmrTableDensitySelector
        value={value}
        label={label}
        onValueChange={setValue}
      />
      <div className="text-sm text-muted-foreground">현재 선택: {value}</div>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrTableDensitySelector",
  component: DensitySelectorExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrTableDensitySelector for compact table density switching in EMR worklists. 사용할 때: a data grid supports compact, standard, and comfortable row density. 쓰지 말아야 할 때: non-table layouts, security/permission controls, or one-off visual preferences.",
      },
    },
  },
  argTypes: {
    initialValue: {
      control: "radio",
      options: ["compact", "standard", "comfortable"],
      description: "Initial density value for the stateful story example.",
    },
    label: {
      control: "text",
      description: "Accessible group label.",
    },
  },
  args: {
    initialValue: "standard",
    label: "샘플 테이블 보기 밀도",
  },
  render: (args) => <DensitySelectorExample {...args} />,
} satisfies Meta<DensitySelectorArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function selectCompact(canvasElement: HTMLElement) {
  const trigger = canvasElement.querySelector(
    "button[aria-label='샘플 테이블 보기 밀도: 기본']",
  );
  if (!(trigger instanceof HTMLElement)) {
    throw new Error("Expected table density dropdown trigger.");
  }
  trigger.click();

  await new Promise((resolve) => window.setTimeout(resolve, 0));

  const compactOption = Array.from(
    canvasElement.ownerDocument.querySelectorAll("[role='menuitemradio']"),
  ).find((option) => option.textContent?.trim() === "좁게");
  if (!(compactOption instanceof HTMLElement)) {
    throw new Error("Expected compact density menu option.");
  }
  compactOption.click();

  await new Promise((resolve) => window.setTimeout(resolve, 0));
  if (!canvasElement.textContent?.includes("현재 선택: compact")) {
    throw new Error("Expected density selector to update to compact.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table row density를 즉시 전환해야 할 때. 쓰지 말아야 할 때: table이 아닌 카드/list spacing 설정.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    await selectCompact(canvasElement);
  },
};
