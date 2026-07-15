import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrRequiredIndicator } from "./required-indicator";

const meta = {
  title: "Design System/EMR/EmrRequiredIndicator",
  component: EmrRequiredIndicator,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrRequiredIndicator for the shared visual marker of required fields. Keep required semantics on the associated form control; the marker is decorative and hidden from assistive technology.",
      },
    },
  },
} satisfies Meta<typeof EmrRequiredIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid w-fit gap-3 emr-text-body font-medium text-foreground">
      <label className="inline-flex items-baseline gap-0.5">
        보호자명
        <EmrRequiredIndicator />
      </label>
      <label className="inline-flex items-baseline gap-0.5">
        대표 전화
        <EmrRequiredIndicator />
      </label>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The Neutral 900 marker is shared across registration, reception, popover, profile, and hospital-admin field wrappers.",
      },
    },
  },
};
