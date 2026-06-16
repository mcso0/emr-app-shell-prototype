import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";

import {
  EmrContentHistoryGroup,
  EmrContentHistoryItem,
} from "./content-history-list";

type EmrContentHistoryListStoryArgs = {
  collapsed: boolean;
  selected: boolean;
};

function EmrContentHistoryListExample({
  collapsed,
  selected,
}: EmrContentHistoryListStoryArgs) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  return (
    <div className="w-[320px] rounded-lg border border-border bg-card p-4">
      <EmrContentHistoryGroup
        collapsed={isCollapsed}
        count={2}
        label="오늘"
        onToggle={() => setIsCollapsed((current) => !current)}
      >
        <EmrContentHistoryItem
          selected={selected}
          badge={<Badge variant="secondary">완료</Badge>}
          meta={<><span>샘플 담당</span><span>합성 기록</span></>}
          subtitle="10:30"
          title="샘플 히스토리 A"
        />
        <EmrContentHistoryItem subtitle="11:10" title="샘플 히스토리 B" />
      </EmrContentHistoryGroup>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrContentHistoryList",
  component: EmrContentHistoryListExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrContentHistoryList primitives for chronological content-aside history groups and selectable history cards. 사용할 때: supporting records need date grouping, timeline gutter, and compact metadata. 쓰지 말아야 할 때: primary editable tables, audit-compliance logs, or unbounded freeform feeds.",
      },
    },
  },
  argTypes: {
    collapsed: {
      control: "boolean",
      description: "Initial collapsed state for the history group.",
    },
    selected: {
      control: "boolean",
      description: "Whether the first history item is selected.",
    },
  },
  args: {
    collapsed: false,
    selected: true,
  },
  render: (args) => <EmrContentHistoryListExample {...args} />,
} satisfies Meta<EmrContentHistoryListStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: content aside 안에서 관련 기록을 날짜별로 보여줄 때. 쓰지 말아야 할 때: feature source of truth인 full audit table을 대체할 때.",
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
          "사용할 때: 오래된 history group을 접어 정보 밀도를 낮출 때. 쓰지 말아야 할 때: 가장 최근 중요 기록을 숨길 때.",
      },
    },
  },
};
