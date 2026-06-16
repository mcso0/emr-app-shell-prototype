import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  CdsFilesDocumentAltFillIcon,
  CdsFilesGridIcon,
} from "@/components/cds-icons/files-and-layout";
import { Badge } from "@/components/ui/badge";

import {
  EmrTextSideNavButton,
  EmrTextSideNavSection,
} from "./text-side-panel";

type EmrTextSidePanelStoryArgs = {
  open: boolean;
};

function EmrTextSidePanelExample({ open }: EmrTextSidePanelStoryArgs) {
  const [isOpen, setIsOpen] = useState(open);

  return (
    <div className="w-[280px] rounded-lg bg-[var(--emr-surface-sidepanel)] p-3">
      <EmrTextSideNavSection
        icon={<CdsFilesGridIcon className="size-4" aria-hidden="true" />}
        open={isOpen}
        title="샘플 섹션"
        onToggle={() => setIsOpen((current) => !current)}
      >
        <div className="grid gap-1 border-l py-1 pl-3">
          <EmrTextSideNavButton
            active
            count={<Badge variant="secondary">3</Badge>}
            icon={<CdsFilesDocumentAltFillIcon className="size-4" aria-hidden="true" />}
          >
            샘플 항목
          </EmrTextSideNavButton>
          <EmrTextSideNavButton disabled>비활성 항목</EmrTextSideNavButton>
        </div>
      </EmrTextSideNavSection>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrTextSidePanel",
  component: EmrTextSidePanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrTextSidePanel primitives for text-heavy module navigation inside fixed EMR side panels. 사용할 때: module lists need expandable sections, active rows, counts, and disabled rows. 쓰지 말아야 할 때: primary top navigation, tab content switching, or task queue cards with patient/order metadata.",
      },
    },
  },
  argTypes: {
    open: {
      control: "boolean",
      description: "Initial open state for the section.",
    },
  },
  args: {
    open: true,
  },
  render: (args) => <EmrTextSidePanelExample {...args} />,
} satisfies Meta<EmrTextSidePanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OpenSection: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: section children을 펼쳐 module list를 탐색할 때. 쓰지 말아야 할 때: 상태별 task queue grouping.",
      },
    },
  },
};

export const ClosedSection: Story = {
  args: {
    open: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: secondary module group을 접어 navigation 밀도를 조절할 때. 쓰지 말아야 할 때: 사용자가 반드시 봐야 하는 active context를 숨길 때.",
      },
    },
  },
};
