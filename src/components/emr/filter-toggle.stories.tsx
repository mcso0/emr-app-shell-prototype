import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrFilterToggle } from "./filter-toggle";

type FilterToggleArgs = ComponentProps<typeof EmrFilterToggle>;

function ControlledFilterToggle(args: FilterToggleArgs) {
  const [pressed, setPressed] = useState(Boolean(args.pressed));

  return (
    <EmrFilterToggle
      {...args}
      pressed={pressed}
      onPressedChange={setPressed}
    />
  );
}

const meta = {
  title: "Design System/EMR/EmrFilterToggle",
  component: EmrFilterToggle,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrFilterToggle for independent boolean filters such as 완료 포함. It reuses the shared Toggle primitive and the Button size scale; consumers own state, persistence, and permission behavior.",
      },
    },
  },
  argTypes: {
    pressed: {
      control: "boolean",
      description: "Whether the filter is currently active.",
    },
    size: {
      control: "inline-radio",
      options: ["xs", "sm", "default", "lg", "xl"],
      description: "Button-compatible control size.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the filter control. Not a permission boundary.",
    },
    onPressedChange: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    children: "완료 포함",
    pressed: false,
    size: "default",
  },
  render: (args) => <ControlledFilterToggle {...args} />,
} satisfies Meta<typeof EmrFilterToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = {
  args: {
    pressed: true,
  },
};

export const ButtonSizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {(["xs", "sm", "default", "lg", "xl"] as const).map((size) => (
        <ControlledFilterToggle key={size} {...args} pressed size={size} />
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
