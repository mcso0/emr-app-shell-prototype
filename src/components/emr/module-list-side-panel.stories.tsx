import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  CdsFilesDocumentAltFillIcon,
  CdsFilesGridIcon,
} from "@/components/cds-icons/files-and-layout";

import {
  EmrModuleListSidePanel,
  EmrModuleListSidePanelBadge,
  type EmrModuleListSidePanelItem,
} from "./module-list-side-panel";

type EmrModuleListSidePanelStoryArgs = {
  title: string;
};

const moduleItems: EmrModuleListSidePanelItem[] = [
  {
    id: "overview",
    type: "button",
    active: true,
    count: <EmrModuleListSidePanelBadge>4</EmrModuleListSidePanelBadge>,
    icon: <CdsFilesGridIcon className="size-4" aria-hidden="true" />,
    label: "전체 보기",
  },
  {
    id: "templates",
    type: "section",
    icon: <CdsFilesDocumentAltFillIcon className="size-4" aria-hidden="true" />,
    label: "샘플 묶음",
    children: [
      { id: "default", type: "groupLabel", label: "기본" },
      { id: "draft", type: "leaf", label: "임시 항목", count: <EmrModuleListSidePanelBadge variant="outline">2</EmrModuleListSidePanelBadge> },
      { id: "disabled", type: "leaf", disabled: true, label: "비활성 항목" },
    ],
  },
];

function EmrModuleListSidePanelExample({ title }: EmrModuleListSidePanelStoryArgs) {
  const [openSectionIds, setOpenSectionIds] = useState<Set<string>>(() => new Set(["templates"]));

  return (
    <div className="h-[420px]">
      <EmrModuleListSidePanel
        items={moduleItems}
        openSectionIds={openSectionIds}
        title={title}
        onToggleSection={(sectionId) => {
          setOpenSectionIds((current) => {
            const next = new Set(current);
            if (next.has(sectionId)) next.delete(sectionId);
            else next.add(sectionId);
            return next;
          });
        }}
      />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrModuleListSidePanel",
  component: EmrModuleListSidePanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrModuleListSidePanel for module-local text navigation with buttons, expandable sections, leaf rows, and compact badges. 사용할 때: a feature needs a stable left module list. 쓰지 말아야 할 때: task/order queues with workflow status grouping or content-aside history.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "Side panel title.",
    },
  },
  args: {
    title: "모듈 목록",
  },
  render: (args) => <EmrModuleListSidePanelExample {...args} />,
} satisfies Meta<EmrModuleListSidePanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: feature 안의 module list/navigation을 반복 구성할 때. 쓰지 말아야 할 때: patient/order/task metadata가 필요한 queue card 패턴.",
      },
    },
  },
};
