import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  CdsActionsPlusIcon,
  CdsActionsTrashIcon,
} from "@/components/cds-icons/actions-and-controls";

import { Button } from "./button";

const meta = {
  title: "Design System/UI/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Button for explicit commands. Prefer existing variants and sizes before custom classes. Use icon-only buttons only when the accessible label names the action.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive"],
      description:
        "Visual command priority. Use destructive only for high-risk actions such as delete or cancel.",
    },
    size: {
      control: "select",
      options: ["xs", "sm", "default", "lg", "xl", "icon", "icon-xs", "icon-sm", "icon-lg", "icon-xl"],
      description: "Control height and icon scale. Match the surrounding EMR density.",
    },
    roundness: {
      control: "radio",
      options: ["default", "round"],
      description: "Use default for most EMR controls. Use round only for compact pill-like commands.",
    },
    disabled: {
      control: "boolean",
      description: "Disabled controls must not replace permission or server-side enforcement.",
    },
    children: {
      control: "text",
      description: "Visible command label. Keep labels action-oriented and specific.",
    },
  },
  args: {
    children: "저장",
    disabled: false,
    roundness: "default",
    size: "default",
    variant: "default",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Default command button for the primary action in a compact workspace control group.",
      },
    },
  },
};

export const Variants: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Use variants to show command priority. Do not use destructive for ordinary warnings or passive status.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">저장</Button>
      <Button variant="outline">PDF</Button>
      <Button variant="secondary">임시 저장</Button>
      <Button variant="ghost">취소</Button>
      <Button variant="destructive">삭제</Button>
    </div>
  ),
};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story: "Use smaller sizes in dense tables and side panels. Reserve larger sizes for spacious dialogs.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra large</Button>
    </div>
  ),
};

export const IconUsage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Use CDS icons inside buttons. Add data-icon so spacing follows the component contract; icon-only buttons require an aria-label.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <CdsActionsPlusIcon data-icon="inline-start" aria-hidden="true" />
        신규 등록
      </Button>
      <Button variant="outline" size="sm">
        <CdsActionsTrashIcon data-icon="inline-start" aria-hidden="true" />
        삭제
      </Button>
      <Button size="icon" variant="ghost" aria-label="신규 등록">
        <CdsActionsPlusIcon aria-hidden="true" />
      </Button>
    </div>
  ),
};

export const DisabledAndInvalid: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Disabled and invalid states are visual affordances only. They must not be treated as permission or validation enforcement.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>저장 불가</Button>
      <Button variant="outline" disabled>
        선택 필요
      </Button>
      <Button aria-invalid="true">검증 필요</Button>
    </div>
  ),
};
