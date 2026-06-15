import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  CdsActionsFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { Badge } from "@/components/ui/badge";

import {
  EmrDateNavigator,
  EmrListGroup,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "./subpanel";

type EmrSubpanelStoryArgs = {
  collapsed: boolean;
  title: string;
};

function EmrSubpanelExample({ collapsed, title }: EmrSubpanelStoryArgs) {
  const [groupCollapsed, setGroupCollapsed] = useState(collapsed);

  return (
    <div className="h-[420px]">
      <EmrSubpanel>
        <EmrSubpanelTitle title={title} />
        <EmrDateNavigator dateLabel="26.06.15 (월)" todayLabel="오늘" />
        <EmrListHeader
          count={3}
          headerActions={
            <>
              <EmrListHeaderIconButton ariaLabel="샘플 검색">
                <CdsActionsSearchIcon className="size-4" aria-hidden="true" />
              </EmrListHeaderIconButton>
              <EmrListHeaderIconButton ariaLabel="샘플 필터">
                <CdsActionsFilterIcon className="size-4" aria-hidden="true" />
              </EmrListHeaderIconButton>
            </>
          }
          label="샘플 목록"
        />
        <EmrSubpanelBody>
          <EmrListGroup
            collapsed={groupCollapsed}
            count={2}
            label="진행"
            onToggle={() => setGroupCollapsed((current) => !current)}
          >
            <EmrListItem
              selected
              itemBadge={<Badge variant="secondary">요청</Badge>}
              meta="합성 메타 · 10:30"
              subtitle="샘플 설명 A"
              title="샘플 항목 A"
              variant="outline"
            />
            <EmrListItem
              footer={<><span>요청자 샘플</span><span>담당 미정</span></>}
              subtitle="샘플 설명 B"
              title="샘플 항목 B"
              variant="outline"
            />
          </EmrListGroup>
        </EmrSubpanelBody>
      </EmrSubpanel>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrSubpanel",
  component: EmrSubpanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrSubpanel for fixed-width EMR side panels with shared title, date navigation, list header, list groups, and list items. 사용할 때: module queue/list navigation needs consistent panel chrome. 쓰지 말아야 할 때: freeform page sections, modal dialogs, or feature workflows without stable fixture data.",
      },
    },
  },
  argTypes: {
    collapsed: {
      control: "boolean",
      description: "Initial collapsed state for the sample group.",
    },
    title: {
      control: "text",
      description: "Subpanel title.",
    },
  },
  args: {
    collapsed: false,
    title: "샘플 패널",
  },
  render: (args) => <EmrSubpanelExample {...args} />,
} satisfies Meta<EmrSubpanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: queue/list module의 좌측 보조 패널. 쓰지 말아야 할 때: 본문 content card나 one-off spacing wrapper.",
      },
    },
  },
};

export const CollapsedGroup: Story = {
  args: {
    collapsed: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 상태 그룹을 접어 queue를 빠르게 훑게 할 때. 쓰지 말아야 할 때: 핵심 경고나 validation 메시지를 숨길 때.",
      },
    },
  },
};
