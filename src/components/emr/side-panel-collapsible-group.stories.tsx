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

  return (
    <div className="w-[288px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
      <EmrSidePanelCollapsibleGroup
        collapsed={isCollapsed}
        count={count}
        countVariant="badge"
        indicatorVisible={false}
        label={label}
        onToggle={() => setIsCollapsed((current) => !current)}
        stateIconState="in-progress"
      >
        <EmrTaskQueueCard
          item={{
            actionAriaLabel: "샘플 항목 더보기",
            assigneeName: "샘플 담당",
            eventActorName: "샘플 요청자",
            eventTime: "10:30",
            guardianName: "샘플 보호자",
            patientName: "샘플 환자",
            receptionType: "접수",
            secondLineBadgeLabel: "처치",
            secondLineText: "합성 작업 항목",
          }}
          selected
          onSelect={() => undefined}
        />
      </EmrSidePanelCollapsibleGroup>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSidePanelCollapsibleGroup",
  component: EmrSidePanelCollapsibleGroupExample,
  tags: ["autodocs"],
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
  render: (args) => <EmrSidePanelCollapsibleGroupExample {...args} />,
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
