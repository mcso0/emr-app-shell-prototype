import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";
import { CustomerHeaderCallerExample } from "./caller-parity.stories.fixture";

import { CdsActionsCheckCircleIcon } from "@/components/cds-icons/actions-and-controls";

import { Badge } from "./badge";

const meta = {
  title: "Design System/UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Badge for compact labels, chips, and lightweight categorization. Do not use the generic Badge to encode EMR workflow status; use EMR-specific status components for domain states.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
      description: "Visual style for generic labels. Domain status tone belongs in EMR components.",
    },
    size: {
      control: "select",
      options: ["count", "sm", "md"],
      description: "Badge density. count is a 16px circular tab counter, sm is 20px tall, and md matches the CDS V2 22px badge.",
    },
    children: {
      control: "text",
      description: "Short visible label. Keep badges concise enough for dense tables and panels.",
    },
  },
  args: {
    children: "필터 적용",
    size: "sm",
    variant: "secondary",
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <CustomerHeaderCallerExample />,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="badge"]')).toHaveTextContent("3");
    await userEvent.type(canvas.getByRole("textbox", { name: "고객관리 검색" }), "합성 검색");
    await expect(canvas.getByLabelText("합성 고객 검색어")).toHaveTextContent("합성 검색");
    await userEvent.click(canvas.getByRole("button", { name: "고객관리 검색어 초기화" }));
    await expect(canvas.getByLabelText("합성 고객 검색어")).toHaveTextContent("검색어 없음");
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story: "고객관리의 실제 CustomerListHeader 카운터 Badge입니다. 크기·색·제목과 검색/초기화 버튼을 원본 컴포넌트가 렌더합니다. 숫자와 검색 콜백만 합성입니다.",
      },
    },
  },
};

export const Variants: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Variants provide generic emphasis. Use them sparingly so badges do not overpower dense EMR tables.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">기본</Badge>
      <Badge variant="secondary">필터 적용</Badge>
      <Badge variant="outline">수동 입력</Badge>
      <Badge variant="ghost">보조</Badge>
      <Badge variant="destructive">위험</Badge>
      <Badge variant="link">링크</Badge>
    </div>
  ),
};

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Badge supports a fixed 16px count plus the CDS V2 sm and md densities. Use count only for compact numeric counters.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge size="count" variant="secondary">
        4
      </Badge>
      <Badge size="sm" variant="secondary">
        Small
      </Badge>
      <Badge size="md" variant="secondary">
        Medium
      </Badge>
      <Badge size="sm" variant="outline">
        20px
      </Badge>
      <Badge size="md" variant="outline">
        22px
      </Badge>
    </div>
  ),
};

export const WithIcon: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story: "Use a CDS icon only when it adds scan value. Decorative icons should remain aria-hidden.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="outline">
        <CdsActionsCheckCircleIcon data-icon="inline-start" aria-hidden="true" />
        검토됨
      </Badge>
      <Badge variant="secondary">
        <CdsActionsCheckCircleIcon data-icon="inline-start" aria-hidden="true" />
        선택됨
      </Badge>
    </div>
  ),
};

export const DoNotUseForDomainStatus: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "This story documents the boundary: Badge is generic. Do not encode clinical, billing, fulfillment, or queue lifecycle status with ad hoc Badge colors.",
      },
    },
  },
  render: () => (
    <div className="max-w-xl space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">수동 분류</Badge>
        <Badge variant="secondary">목록 필터</Badge>
      </div>
      <p className="emr-text-dense text-muted-foreground">
        EMR workflow statuses such as 요청, 진행중, 완료, 취소 should use an EMR status component so
        tone, icon, and Korean labels remain consistent across modules.
      </p>
    </div>
  ),
};
