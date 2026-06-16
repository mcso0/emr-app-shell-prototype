import type { Meta, StoryObj } from "@storybook/nextjs-vite";

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
    children: {
      control: "text",
      description: "Short visible label. Keep badges concise enough for dense tables and panels.",
    },
  },
  args: {
    children: "필터 적용",
    variant: "secondary",
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Default Badge shows a short generic label. Use it when the label is not a domain status.",
      },
    },
  },
};

export const Variants: Story = {
  parameters: {
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

export const WithIcon: Story = {
  parameters: {
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
