import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CdsGnbHospitalGnbIcon } from "@/components/cds-icons/gnb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { EmrPageHeader } from "./page-header";

type EmrPageHeaderStoryArgs = {
  showActions: boolean;
  showBadge: boolean;
  showIcon: boolean;
  title: string;
};

function EmrPageHeaderExample({
  showActions,
  showBadge,
  showIcon,
  title,
}: EmrPageHeaderStoryArgs) {
  return (
    <div className="max-w-3xl rounded-md border border-border bg-background p-4">
      <EmrPageHeader
        actions={
          showActions ? (
            <>
              <Button type="button" variant="outline" size="sm">
                보조 작업
              </Button>
              <Button type="button" size="sm">
                주요 작업
              </Button>
            </>
          ) : null
        }
        badge={showBadge ? <Badge variant="secondary">샘플</Badge> : null}
        icon={
          showIcon ? (
            <CdsGnbHospitalGnbIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : null
        }
        title={title}
      />
      <div className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        페이지 본문 영역 예시입니다. 실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다.
      </div>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrPageHeader",
  component: EmrPageHeaderExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrPageHeader for EMR workspace page titles with optional icon, badge, and right-aligned page actions. 사용할 때: a screen needs consistent title/action chrome above its main content. 쓰지 말아야 할 때: card titles, modal titles, table section headers, or nested panel labels.",
      },
    },
  },
  argTypes: {
    showActions: {
      control: "boolean",
      description: "Whether to show right-aligned page actions.",
    },
    showBadge: {
      control: "boolean",
      description: "Whether to show a small status/context badge beside the title.",
    },
    showIcon: {
      control: "boolean",
      description: "Whether to show a leading icon.",
    },
    title: {
      control: "text",
      description: "Page title text.",
    },
  },
  args: {
    showActions: true,
    showBadge: true,
    showIcon: true,
    title: "샘플 업무 화면",
  },
  render: (args) => <EmrPageHeaderExample {...args} />,
} satisfies Meta<EmrPageHeaderStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 화면 최상단에서 title, badge, action을 일관되게 배치할 때. 쓰지 말아야 할 때: panel/card 내부 heading.",
      },
    },
  },
};

export const TitleOnly: Story = {
  args: {
    showActions: false,
    showBadge: false,
    showIcon: false,
    title: "간단한 샘플 화면",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: page title만 필요한 단순 화면. 쓰지 말아야 할 때: 사용자가 바로 실행해야 하는 page-level action이 있는 경우.",
      },
    },
  },
};

export const LongTitle: Story = {
  args: {
    title: "긴 제목을 가진 샘플 업무 화면의 헤더 표시 확인",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: title truncation과 action 영역 보존을 확인할 때. 쓰지 말아야 할 때: 설명 copy를 title에 모두 밀어 넣을 때.",
      },
    },
  },
};
