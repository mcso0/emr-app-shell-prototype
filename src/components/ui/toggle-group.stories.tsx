import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

type ToggleGroupArgs = Pick<
  ComponentProps<typeof ToggleGroup>,
  "disabled" | "multiple" | "orientation" | "size" | "variant"
>;

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

function ControlledToggleGroup({
  disabled = false,
  multiple = true,
  orientation = "horizontal",
  size = "sm",
  variant = "primary",
}: ToggleGroupArgs) {
  const [value, setValue] = useState<string[]>(
    multiple ? ["월", "화", "수", "목", "금"] : ["월"]
  );

  return (
    <ToggleGroup
      aria-label="운영 요일 예시"
      disabled={disabled}
      multiple={multiple}
      onValueChange={setValue}
      orientation={orientation}
      size={size}
      value={value}
      variant={variant}
    >
      {weekdays.map((day) => (
        <ToggleGroupItem key={day} aria-label={`${day}요일`} value={day}>
          {day}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

const meta = {
  title: "Design System/UI/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use ToggleGroup for related pressed controls that may allow one or multiple values. The primitive remains deselectable; use SegmentedControl when one value must always remain selected.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "ghost", "outline", "default"],
      description:
        "Group visual contract. primary owns its padded surface; outline connects item borders.",
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md", "default", "lg"],
      description: "Shared Toggle item size contract.",
    },
    multiple: {
      control: "boolean",
      description: "Allows more than one pressed value when true.",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Controls layout and Base UI arrow-key navigation.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the full group. Not a permission boundary.",
    },
  },
  args: {
    disabled: false,
    multiple: true,
    orientation: "horizontal",
    size: "sm",
    variant: "primary",
  },
  render: (args) => <ControlledToggleGroup {...args} />,
} satisfies Meta<ToggleGroupArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Multiple: Story = {
  play: async ({ canvasElement }) => {
    const monday = canvasElement.querySelector<HTMLButtonElement>(
      '[aria-label="월요일"]'
    );
    const sunday = canvasElement.querySelector<HTMLButtonElement>(
      '[aria-label="일요일"]'
    );

    if (
      !monday ||
      !sunday ||
      monday.getAttribute("aria-pressed") !== "true" ||
      sunday.getAttribute("aria-pressed") !== "false"
    ) {
      throw new Error("ToggleGroup should expose its initial multiple values.");
    }

    sunday.click();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    if (sunday.getAttribute("aria-pressed") !== "true") {
      throw new Error("ToggleGroup should add an independently pressed value.");
    }
  },
};

export const Single: Story = {
  args: {
    multiple: false,
    variant: "outline",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Single ToggleGroup permits deselection under the existing Base UI contract. Use SegmentedControl for a required single choice.",
      },
    },
  },
};

export const Variants: Story = {
  render: () => (
    <div className="grid gap-5">
      {(["primary", "ghost", "outline"] as const).map((variant) => (
        <div key={variant} className="grid gap-2">
          <span className="emr-text-metadata text-muted-foreground">
            {variant}
          </span>
          <ControlledToggleGroup variant={variant} />
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-4">
      <ControlledToggleGroup size="xs" />
      <ControlledToggleGroup size="sm" />
      <ControlledToggleGroup size="md" />
    </div>
  ),
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
    variant: "outline",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
