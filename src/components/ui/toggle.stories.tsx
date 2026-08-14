import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CdsActionsPinIcon } from "@/components/cds-icons/actions-and-controls";

import { Toggle } from "./toggle";

type ToggleArgs = ComponentProps<typeof Toggle>;

function ControlledToggle(args: ToggleArgs) {
  const [pressed, setPressed] = useState(Boolean(args.defaultPressed));

  return (
    <Toggle
      {...args}
      defaultPressed={undefined}
      pressed={pressed}
      onPressedChange={setPressed}
    />
  );
}

const meta = {
  title: "Design System/UI/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Toggle for one independently pressed button state. Use ToggleGroup for a related set and Switch for an immediate setting. Icon-only toggles require an accessible name.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "ghost", "outline", "default"],
      description:
        "CDS.V2 visual treatment. default remains a compatibility alias for ghost.",
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md", "default", "lg"],
      description:
        "xs preserves the legacy 28px control; sm/md are the CDS.V2 32px/36px controls. default/lg remain compatibility aliases.",
    },
    defaultPressed: {
      control: "boolean",
      description: "Initial pressed state for an uncontrolled Toggle.",
    },
    disabled: {
      control: "boolean",
      description: "Unavailable visual and interaction state.",
    },
    onPressedChange: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    children: "고정",
    defaultPressed: false,
    disabled: false,
    size: "sm",
    variant: "primary",
  },
  render: (args) => <ControlledToggle {...args} />,
} satisfies Meta<typeof Toggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector<HTMLButtonElement>(
      '[data-slot="toggle"]'
    );

    if (!toggle || toggle.getAttribute("aria-pressed") !== "false") {
      throw new Error("Toggle should start unpressed.");
    }

    toggle.click();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    if (toggle.getAttribute("aria-pressed") !== "true") {
      throw new Error("Toggle should expose the pressed state after activation.");
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "Controlled CDS.V2 primary Toggle. Activating it updates aria-pressed without changing button semantics.",
      },
    },
  },
};

export const Variants: Story = {
  render: () => (
    <div className="grid gap-4">
      {(["primary", "ghost", "outline"] as const).map((variant) => (
        <div key={variant} className="flex items-center gap-3">
          <span className="w-16 emr-text-metadata text-muted-foreground">
            {variant}
          </span>
          <Toggle variant={variant} size="sm">
            기본
          </Toggle>
          <Toggle variant={variant} size="sm" defaultPressed>
            선택
          </Toggle>
          <Toggle variant={variant} size="sm" disabled>
            비활성
          </Toggle>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Toggle size="xs" variant="primary" defaultPressed>
        xs · 28
      </Toggle>
      <Toggle size="sm" variant="primary" defaultPressed>
        sm · 32
      </Toggle>
      <Toggle size="md" variant="primary" defaultPressed>
        md · 36
      </Toggle>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Toggle variant="outline" size="sm">
        <CdsActionsPinIcon aria-hidden="true" />
        라벨
      </Toggle>
      <Toggle
        aria-label="고정 표시"
        variant="outline"
        size="sm"
      >
        <CdsActionsPinIcon aria-hidden="true" />
      </Toggle>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Icons stay 16px in CDS.V2 sizes. The icon-only example supplies aria-label because the icon is decorative.",
      },
    },
  },
};
