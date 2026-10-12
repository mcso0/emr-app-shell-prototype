import { expect, userEvent, waitFor, within } from "storybook/test";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrTaskQueueCard } from "./task-queue-card";
import { EmrSidePanelCollapsibleGroup } from "./side-panel-collapsible-group";

type EmrSidePanelCollapsibleGroupStoryArgs = {
  collapsed: boolean;
  count: number;
  label: string;
};

function EmrSidePanelCollapsibleGroupExample({
  collapsed,
  count,
  label,
}: EmrSidePanelCollapsibleGroupStoryArgs) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState("");
  const rowCount = Math.max(0, Math.floor(count));

  return (
    <div className="w-[288px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
      <EmrSidePanelCollapsibleGroup
        collapsed={isCollapsed}
        count={rowCount}
        countVariant="badge"
        indicatorVisible={false}
        label={label}
        onToggle={() => setIsCollapsed((current) => !current)}
        stateIconState="in-progress"
      >
        {Array.from({ length: rowCount }, (_, index) => <EmrTaskQueueCard key={index}
          item={{
            actionAriaLabel: "샘플 항목 더보기",
            actionItems: [{ key: "open", label: "업무 상세 확인", onSelect: () => setLastAction(`합성 업무 ${index + 1} 열림`) }],
            assigneeName: "샘플 담당",
            eventActorName: "샘플 요청자",
            eventTime: "10:30",
            guardianName: "샘플 보호자",
            patientName: `샘플 환자 ${index + 1}`,
            testId: `group-card-${index}`,
            receptionType: "접수",
            secondLineBadgeLabel: "처치",
            secondLineText: "합성 작업 항목",
          }}
          selected={selected === index}
          onSelect={() => setSelected(index)}
        />)}
      </EmrSidePanelCollapsibleGroup>
      {lastAction ? <output role="status">{lastAction}</output> : null}
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSidePanelCollapsibleGroup",
  component: EmrSidePanelCollapsibleGroupExample,
  tags: ["autodocs"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    if (args.collapsed) await userEvent.click(canvas.getByRole("button", { name: `${args.label} 펼치기` }));
    if (args.count < 1) {
      await expect(canvas.queryByTestId("group-card-0")).not.toBeInTheDocument(); return;
    }
    const card = await canvas.findByTestId("group-card-0");
    card.focus(); await userEvent.keyboard(" "); await expect(card).toHaveAttribute("aria-pressed", "true");
    await userEvent.hover(card);
    await userEvent.click(within(card).getByRole("button", { name: "샘플 항목 더보기" }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "업무 상세 확인" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("합성 업무 1 열림");
    await userEvent.click(canvas.getByRole("button", { name: `${args.label} 접기` }));
    await waitFor(async () => { await expect(canvas.queryByTestId("group-card-0")).not.toBeInTheDocument(); });
    await userEvent.click(canvas.getByRole("button", { name: `${args.label} 펼치기` }));
    await expect(await canvas.findByTestId("group-card-0")).toHaveAttribute("aria-pressed", "true");
  },
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrSidePanelCollapsibleGroup for grouped side-panel queues with shared disclosure, count, indicator, and optional state icon. 사용할 때: queue items are grouped by status or stage. 쓰지 말아야 할 때: unrelated page sections or content that must always remain visible.",
      },
    },
  },
  argTypes: {
    collapsed: {
      control: "boolean",
      description: "Initial collapsed state.",
    },
    count: {
      control: { type: "number", min: 0, max: 20 },
      description: "Visible group count.",
    },
    label: {
      control: "text",
      description: "Visible group label.",
    },
  },
  args: {
    collapsed: false,
    count: 1,
    label: "진행",
  },
  render: (args) => <EmrSidePanelCollapsibleGroupExample key={`${args.collapsed}-${args.count}`} {...args} />,
} satisfies Meta<EmrSidePanelCollapsibleGroupStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 상태별 queue card 묶음을 접고 펼칠 때. 쓰지 말아야 할 때: validation error나 blocking alert를 숨길 때.",
      },
    },
  },
};

export const InitiallyCollapsed: Story = {
  args: {
    collapsed: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 사용자가 덜 중요한 상태 그룹을 접어둘 수 있게 할 때. 쓰지 말아야 할 때: 첫 화면 핵심 작업을 기본 숨김 처리할 때.",
      },
    },
  },
};
