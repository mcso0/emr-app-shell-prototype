import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "./input";

const meta = {
  title: "Design System/UI/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Input for compact text entry in EMR forms, filters, and dialogs. Preserve labels at the call site with Field components when the input appears in a form.",
      },
    },
  },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "search", "email", "tel", "number", "file"],
      description: "Native input type. Use the narrowest type that matches the field.",
    },
    placeholder: {
      control: "text",
      description: "Short input hint. Do not use placeholders as the only accessible label.",
    },
    disabled: {
      control: "boolean",
      description: "Disabled inputs are read-only affordances, not security boundaries.",
    },
    "aria-invalid": {
      control: "boolean",
      description: "Use with visible error/help text at the call site when validation fails.",
    },
  },
  args: {
    disabled: false,
    placeholder: "보호자명 또는 환자명",
    type: "text",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Default compact text input for dense EMR form and filter surfaces.",
      },
    },
  },
};

export const Placeholder: Story = {
  args: {
    placeholder: "예: 홍길동",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Placeholder text should help with format or example content. It should not replace a visible label.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "청담동물병원",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use disabled for unavailable fields or locked context. Do not rely on disabled inputs as security enforcement.",
      },
    },
  },
};

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
    defaultValue: "010-000",
    placeholder: "010-0000-0000",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Invalid styling must be paired with field-level error copy in the consuming form or dialog.",
      },
    },
  },
};

export const FileInput: Story = {
  args: {
    type: "file",
  },
  parameters: {
    docs: {
      description: {
        story:
          "File inputs use the same control sizing. Real upload behavior and provider side effects stay outside Storybook stories.",
      },
    },
  },
};
