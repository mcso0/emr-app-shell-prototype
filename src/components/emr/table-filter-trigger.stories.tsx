import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrTableFilterTrigger } from "./table-filter-trigger";

const meta = {
  title: "Design System/EMR/EmrTableFilterTrigger",
  component: EmrTableFilterTrigger,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrTableFilterTrigger as the shared table-toolbar entry point for EmrTableFilterBuilder. The count represents completed active rules, not groups or result rows.",
      },
    },
  },
  args: {
    activeCount: 0,
  },
} satisfies Meta<typeof EmrTableFilterTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Active: Story = {
  args: { activeCount: 8 },
};

export const Disabled: Story = {
  args: { activeCount: 8, disabled: true },
};
