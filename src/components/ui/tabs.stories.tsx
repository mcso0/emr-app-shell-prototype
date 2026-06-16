import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "./badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

type TabsStoryArgs = {
  defaultValue: string;
  orientation: "horizontal" | "vertical";
  variant: "default" | "line";
};

function TabsExample({ defaultValue, orientation, variant }: TabsStoryArgs) {
  return (
    <Tabs
      defaultValue={defaultValue}
      orientation={orientation}
      className={orientation === "vertical" ? "max-w-2xl flex-row" : "max-w-2xl"}
    >
      <TabsList variant={variant} aria-label="샘플 탭">
        <TabsTrigger value="summary">요약</TabsTrigger>
        <TabsTrigger value="details">상세</TabsTrigger>
        <TabsTrigger value="history">
          이력
          <Badge variant="secondary" className="ml-1">
            2
          </Badge>
        </TabsTrigger>
      </TabsList>
      <div className="min-w-0 rounded-md border border-border bg-card p-4">
        <TabsContent value="summary">
          <div className="font-medium">샘플 요약</div>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 화면에서 먼저 스캔할 합성 요약 정보입니다.
          </p>
        </TabsContent>
        <TabsContent value="details">
          <div className="font-medium">샘플 상세</div>
          <p className="mt-1 text-sm text-muted-foreground">
            사용자가 탭을 전환했을 때만 필요한 보조 설명입니다.
          </p>
        </TabsContent>
        <TabsContent value="history">
          <div className="font-medium">샘플 이력</div>
          <p className="mt-1 text-sm text-muted-foreground">
            실제 환자, 보호자, 병원, 결제, 신원 정보 없이 만든 이력 예시입니다.
          </p>
        </TabsContent>
      </div>
    </Tabs>
  );
}

const meta = {
  title: "Design System/UI/Tabs",
  component: TabsExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Tabs to switch between related panels at the same hierarchy level. 사용할 때: content groups are peers and the user can choose one without leaving context. 쓰지 말아야 할 때: primary app navigation, binary filters, or steps that must be completed in order.",
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: "radio",
      options: ["summary", "details", "history"],
      description: "Initially active tab value for the uncontrolled example.",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Tab layout direction.",
    },
    variant: {
      control: "radio",
      options: ["default", "line"],
      description: "Tab list visual style.",
    },
  },
  args: {
    defaultValue: "summary",
    orientation: "horizontal",
    variant: "default",
  },
  render: (args) => <TabsExample {...args} />,
} satisfies Meta<TabsStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function activateDetailsTab(canvasElement: HTMLElement) {
  const button = Array.from(canvasElement.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.includes("상세")
  );

  if (!button) {
    throw new Error("Expected the details tab trigger.");
  }

  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  if (!canvasElement.textContent?.includes("샘플 상세")) {
    throw new Error("Expected the details tab panel to appear.");
  }
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 같은 화면 안에서 관련 패널을 빠르게 전환할 때. 쓰지 말아야 할 때: segmented filter처럼 결과 목록을 좁히는 목적.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    await activateDetailsTab(canvasElement);
  },
};

export const LineVariant: Story = {
  args: {
    variant: "line",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: panel chrome보다 content hierarchy를 가볍게 유지해야 할 때. 쓰지 말아야 할 때: 활성 상태가 충분히 눈에 띄어야 하는 dense toolbar.",
      },
    },
  },
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 왼쪽 목록과 오른쪽 내용처럼 공간이 충분한 layout. 쓰지 말아야 할 때: 좁은 mobile width에서 탭 label이 눌리는 경우.",
      },
    },
  },
};
