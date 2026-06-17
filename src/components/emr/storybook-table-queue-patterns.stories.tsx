import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StorybookTableQueuePatterns } from "./storybook-table-queue-patterns";

const meta = {
  title: "Design System/EMR/Table Queue Patterns",
  component: StorybookTableQueuePatterns,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Storybook-only EMR table/queue pattern entry for repeated status cells, action cells, filter toolbars, empty table states, sortable/filterable headers, row selection, density selectors, and long text cells. Use these patterns when documenting stable table/queue compositions. Do not treat this helper as a production component API or feature workflow surface.",
      },
    },
  },
  argTypes: {
    pattern: {
      control: "radio",
      options: [
        "status-cell",
        "action-cell",
        "filter-toolbar",
        "empty-table",
        "sortable-filterable-header",
        "row-selection",
        "density-selector",
        "long-text-cell",
      ],
      description: "Synthetic EMR table/queue pattern to preview.",
    },
  },
  args: {
    pattern: "status-cell",
  },
} satisfies Meta<typeof StorybookTableQueuePatterns>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StatusCell: Story = {
  args: {
    pattern: "status-cell",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when a dense table cell needs a supported EMR workflow status badge. Do not use custom colors or free-form status tones for feature-specific taxonomies.",
      },
    },
  },
};

export const ActionCell: Story = {
  args: {
    pattern: "action-cell",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when row actions need a compact menu with clear labels and destructive intent separated. Do not hide primary row work inside the overflow menu.",
      },
    },
  },
};

export const FilterToolbar: Story = {
  args: {
    pattern: "filter-toolbar",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when a queue or table needs a small status filter plus secondary filter/search commands. Do not use this as page navigation or for unbounded taxonomies.",
      },
    },
  },
};

export const EmptyTable: Story = {
  args: {
    pattern: "empty-table",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when filters or current scope leave a table with no visible rows. Do not use vague empty copy when the user needs a next action.",
      },
    },
  },
};

export const SortableFilterableHeader: Story = {
  args: {
    pattern: "sortable-filterable-header",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when a table header needs visible sort and filter affordances. Do not hide active sort/filter state in a separate toolbar only.",
      },
    },
  },
};

export const RowSelection: Story = {
  args: {
    pattern: "row-selection",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when rows can be selected for batch operations. Do not use row selection as a substitute for server-side permission checks.",
      },
    },
  },
};

export const DensitySelector: Story = {
  args: {
    pattern: "density-selector",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when a dense operational table benefits from compact, standard, and comfortable row heights. Do not add density controls to small one-off lists.",
      },
    },
  },
};

export const LongTextCell: Story = {
  args: {
    pattern: "long-text-cell",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Use when table cells need explicit truncation or two-line wrapping. Do not let long free text resize the whole grid unpredictably.",
      },
    },
  },
};
