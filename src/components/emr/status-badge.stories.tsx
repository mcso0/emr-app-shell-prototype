import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrStatusBadge } from "./status-badge";

const statusLabels = ["요청", "대기중", "진행중", "조제중", "재요청", "완료", "취소"] as const;

const meta = {
  title: "Design System/EMR/EmrStatusBadge",
  component: EmrStatusBadge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrStatusBadge for the limited shared EMR workflow labels supported by the component. Do not invent new domain statuses here; keep feature-specific status mapping local until a shared tone resolver is defined.",
      },
    },
  },
  argTypes: {
    label: {
      control: "select",
      options: statusLabels,
      description:
        "Supported EMR status label. Unknown labels intentionally fall back to a neutral tone.",
    },
    marker: {
      control: "radio",
      options: ["icon", "none"],
      description: "Use icon when it improves scanning. Use none in very dense tables or repeated cells.",
    },
    testId: {
      control: "text",
      description: "Optional test hook for feature-level regression tests.",
    },
  },
  args: {
    label: "진행중",
    marker: "icon",
  },
} satisfies Meta<typeof EmrStatusBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Default EMR status badge for a supported workflow status. Use supported Korean labels to keep tone and icon mapping stable.",
      },
    },
  },
};

export const SupportedStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {statusLabels.map((label) => (
        <EmrStatusBadge
          key={label}
          label={label}
        />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "These are the shared labels currently encoded by EmrStatusBadge. Add broader domain status behavior only with a separate component contract.",
      },
    },
  },
};

export const WithoutMarker: Story = {
  args: {
    marker: "none",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Remove the marker only when repeated badges need a tighter table footprint and the surrounding column already explains the status role.",
      },
    },
  },
};

export const UnknownLabelFallback: Story = {
  args: {
    label: "검토필요",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Unknown labels fall back to a neutral tone. Treat this as a compatibility fallback, not permission to create ad hoc domain statuses.",
      },
    },
  },
};

