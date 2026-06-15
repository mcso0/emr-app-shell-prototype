import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Skeleton } from "./skeleton";

type SkeletonStoryArgs = {
  lines: number;
  showAvatar: boolean;
  width: "full" | "compact";
};

function SkeletonExample({ lines, showAvatar, width }: SkeletonStoryArgs) {
  return (
    <div
      aria-label="샘플 로딩 상태"
      aria-busy="true"
      className={width === "compact" ? "max-w-sm" : "max-w-2xl"}
    >
      <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
        {showAvatar ? <Skeleton className="size-10 shrink-0 rounded-full" /> : null}
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-4 w-1/3" />
          <div className="grid gap-2">
            {Array.from({ length: lines }).map((_, index) => (
              <Skeleton
                key={index}
                className={index === lines - 1 ? "h-3 w-2/3" : "h-3 w-full"}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Design System/UI/Skeleton",
  component: SkeletonExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Skeleton for local loading placeholders that preserve layout while content is being fetched or prepared. 사용할 때: the user should see stable shape before real content appears. 쓰지 말아야 할 때: empty states, errors, permission blockers, or long-running jobs that need explanatory copy.",
      },
    },
  },
  argTypes: {
    lines: {
      control: { type: "number", min: 1, max: 5 },
      description: "Number of synthetic text placeholder rows.",
    },
    showAvatar: {
      control: "boolean",
      description: "Whether the placeholder includes a leading circular media slot.",
    },
    width: {
      control: "radio",
      options: ["full", "compact"],
      description: "Demo container width.",
    },
  },
  args: {
    lines: 3,
    showAvatar: true,
    width: "full",
  },
  render: (args) => <SkeletonExample {...args} />,
} satisfies Meta<SkeletonStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 데이터가 곧 들어올 화면의 구조를 유지할 때. 쓰지 말아야 할 때: 실제로 항목이 없는 empty state를 loading처럼 보이게 할 때.",
      },
    },
  },
};

export const Compact: Story = {
  args: {
    lines: 2,
    showAvatar: false,
    width: "compact",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: side panel이나 작은 list row의 짧은 loading placeholder. 쓰지 말아야 할 때: 사용자가 왜 기다리는지 알아야 하는 긴 처리 상태.",
      },
    },
  },
};

export const RowList: Story = {
  render: () => (
    <div className="grid max-w-xl gap-2" aria-busy="true" aria-label="샘플 목록 로딩 상태">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
        >
          <Skeleton className="size-8 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 반복 목록이 로딩 중이고 row 높이를 안정적으로 유지해야 할 때. 쓰지 말아야 할 때: 실패나 권한 차단처럼 복구 action이 필요한 상태.",
      },
    },
  },
};
