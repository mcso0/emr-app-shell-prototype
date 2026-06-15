import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrRowActionMenu, type EmrRowActionMenuItem } from "./row-action-menu";

type EmrRowActionMenuStoryArgs = {
  ariaLabel: string;
  includeDisabled: boolean;
  includeDestructive: boolean;
};

function createItems({
  includeDestructive,
  includeDisabled,
}: Pick<EmrRowActionMenuStoryArgs, "includeDestructive" | "includeDisabled">): EmrRowActionMenuItem[] {
  const items: EmrRowActionMenuItem[] = [
    {
      key: "open",
      label: "상세 보기",
      description: "샘플 행의 상세 패널을 엽니다.",
    },
    {
      key: "copy",
      label: "샘플 복사",
    },
  ];

  if (includeDisabled) {
    items.push({
      key: "unavailable",
      label: "현재 사용할 수 없음",
      description: "합성 예시에서 비활성 상태를 보여줍니다.",
      disabled: true,
    });
  }

  if (includeDestructive) {
    items.push({
      key: "remove",
      label: "샘플 제거",
      description: "실제 삭제가 아닌 시각 예시입니다.",
      variant: "destructive",
    });
  }

  return items;
}

function EmrRowActionMenuExample({
  ariaLabel,
  includeDestructive,
  includeDisabled,
}: EmrRowActionMenuStoryArgs) {
  return (
    <div className="max-w-xl rounded-md border border-border bg-card">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-3 py-2 text-sm">
        <div className="min-w-0">
          <div className="font-medium text-foreground">샘플 행</div>
          <div className="truncate text-muted-foreground">
            실제 환자, 보호자, 병원, 결제, 신원 정보 없는 synthetic row입니다.
          </div>
        </div>
        <EmrRowActionMenu
          ariaLabel={ariaLabel}
          items={createItems({ includeDestructive, includeDisabled })}
        />
      </div>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrRowActionMenu",
  component: EmrRowActionMenuExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrRowActionMenu for dense table row or side-panel card overflow actions scoped to one item. 사용할 때: secondary row/card actions need a compact more-menu with clear copy. 쓰지 말아야 할 때: global navigation, complex filters, primary actions, or destructive commits without confirmation.",
      },
    },
  },
  argTypes: {
    ariaLabel: {
      control: "text",
      description: "Explicit Korean aria label naming the row or card object.",
    },
    includeDisabled: {
      control: "boolean",
      description: "Whether to include a disabled unavailable item.",
    },
    includeDestructive: {
      control: "boolean",
      description: "Whether to include a destructive-looking item.",
    },
  },
  args: {
    ariaLabel: "샘플 행 작업 메뉴",
    includeDisabled: true,
    includeDestructive: true,
  },
  render: (args) => <EmrRowActionMenuExample {...args} />,
} satisfies Meta<EmrRowActionMenuStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openRowActionMenu(canvasElement: HTMLElement) {
  const button = canvasElement.querySelector("button[aria-label='샘플 행 작업 메뉴']");

  if (!(button instanceof HTMLElement)) {
    throw new Error("Expected row action menu trigger.");
  }

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.ownerDocument.body.textContent?.includes("상세 보기")) {
    throw new Error("Expected row action menu content to appear after opening.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: dense row에서 보조 action을 overflow menu로 모을 때. 쓰지 말아야 할 때: 사용자의 주요 next action을 숨길 때.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    await openRowActionMenu(canvasElement);
  },
};

export const NonDestructiveOnly: Story = {
  args: {
    includeDestructive: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 보기, 복사, 열기처럼 안전한 보조 action만 있을 때. 쓰지 말아야 할 때: 삭제/취소류 action을 확인 없이 바로 실행할 때.",
      },
    },
  },
};
