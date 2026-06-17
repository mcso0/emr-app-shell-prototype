import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Badge } from "./badge";

type CardStoryArgs = {
  description: string;
  footer: string;
  size: "default" | "sm";
  status: string;
  title: string;
};

function CardExample({
  description,
  footer,
  size,
  status,
  title,
}: CardStoryArgs) {
  return (
    <Card size={size} className="max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Badge variant="secondary">{status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">샘플 단계</span>
            <span className="font-medium">검토</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">샘플 범위</span>
            <span className="font-medium">현재 화면</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{footer}</span>
          <Button type="button" size="sm" variant="outline">
            샘플 보기
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

const meta = {
  title: "Design System/UI/Card",
  component: CardExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Card for a bounded, repeated content item such as a compact summary, task tile, or grouped metadata surface. 사용할 때: one item needs a header, body, and optional action. 쓰지 말아야 할 때: page sections, nested cards, or decorative layout wrappers.",
      },
    },
  },
  argTypes: {
    description: {
      control: "text",
      description: "Short supporting copy under the card title.",
    },
    footer: {
      control: "text",
      description: "Small footer note for the example card.",
    },
    size: {
      control: "radio",
      options: ["default", "sm"],
      description: "Card density. Use sm for compact repeated lists.",
    },
    status: {
      control: "text",
      description: "Synthetic badge text shown in the card action slot.",
    },
    title: {
      control: "text",
      description: "Card title. Keep it scoped to one item.",
    },
  },
  args: {
    description: "한 항목의 상태와 보조 정보를 묶는 합성 예시입니다.",
    footer: "실제 환자, 보호자, 병원, 결제, 신원 정보는 사용하지 않습니다.",
    size: "default",
    status: "샘플",
    title: "샘플 업무 카드",
  },
  render: (args) => <CardExample {...args} />,
} satisfies Meta<CardStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 반복되는 item summary를 한 덩어리로 스캔해야 할 때. 쓰지 말아야 할 때: 페이지 전체 section을 떠 있는 카드처럼 감쌀 때.",
      },
    },
  },
};

export const Small: Story = {
  args: {
    description: "밀도 높은 목록에서 쓰는 작은 합성 카드입니다.",
    footer: "좁은 패널 안의 반복 항목 예시입니다.",
    size: "sm",
    status: "작게",
    title: "작은 샘플 카드",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: side panel이나 dense list에서 item 간 간격을 줄여야 할 때. 쓰지 말아야 할 때: 주요 decision surface를 지나치게 작게 만들 때.",
      },
    },
  },
};

export const ContentOnly: Story = {
  args: {
    description: "",
    footer: "footer 없이 content 중심으로 볼 수 있습니다.",
    status: "요약",
    title: "요약 카드",
  },
  render: (args) => (
    <Card size={args.size} className="max-w-sm">
      <CardContent>
        <div className="text-[15px] font-semibold leading-5">{args.title}</div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {args.footer}
        </p>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 summary만 필요한 반복 항목. 쓰지 말아야 할 때: 제목, 설명, action hierarchy가 필요한 복잡한 항목.",
      },
    },
  },
};
