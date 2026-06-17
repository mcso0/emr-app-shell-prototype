import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";

import { EmrContentAsidePanel } from "./content-aside-panel";
import {
  EmrContentHistoryGroup,
  EmrContentHistoryItem,
} from "./content-history-list";

type EmrContentAsidePanelStoryArgs = {
  title: string;
};

function EmrContentAsidePanelExample({ title }: EmrContentAsidePanelStoryArgs) {
  return (
    <div className="h-[420px] max-w-[360px] overflow-hidden rounded-lg border border-border">
      <EmrContentAsidePanel>
        <div>
          <h3 className="emr-text-panel-title font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">합성 히스토리와 보조 정보를 담는 예시입니다.</p>
        </div>
        <EmrContentHistoryGroup count={2} label="오늘">
          <EmrContentHistoryItem
            selected
            badge={<Badge variant="secondary">완료</Badge>}
            meta={<><span>샘플 담당</span><span>합성 기록</span></>}
            subtitle="10:30"
            title="샘플 기록 A"
          />
          <EmrContentHistoryItem subtitle="11:10" title="샘플 기록 B" />
        </EmrContentHistoryGroup>
      </EmrContentAsidePanel>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrContentAsidePanel",
  component: EmrContentAsidePanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrContentAsidePanel for fixed-width content-adjacent panels that hold supporting history, summaries, or secondary context. 사용할 때: the main content needs a stable aside with related information. 쓰지 말아야 할 때: global navigation, modal content, or unrelated side-panel queues.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "Aside panel title for the synthetic example.",
    },
  },
  args: {
    title: "보조 정보",
  },
  render: (args) => <EmrContentAsidePanelExample {...args} />,
} satisfies Meta<EmrContentAsidePanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 본문 옆에 history나 secondary context를 고정 배치할 때. 쓰지 말아야 할 때: primary workflow를 aside 안으로 밀어 넣을 때.",
      },
    },
  },
};
