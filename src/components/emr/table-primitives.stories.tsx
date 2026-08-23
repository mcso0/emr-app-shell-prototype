import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { EmrTableCellText, EmrTableHeaderCell } from "./table-primitives";

type TablePrimitivesArgs = {
  filterActive: boolean;
  menuActive: boolean;
  sortDirection?: "asc" | "desc";
  textMode: "one-line" | "two-line-if-long" | "always-multiline" | "badge-wrap" | "full-on-demand";
};

function TablePrimitivesExample({
  filterActive,
  menuActive,
  sortDirection,
  textMode,
}: TablePrimitivesArgs) {
  return (
    <Table density="standard" layout="fill">
      <TableHeader>
        <TableRow>
          <EmrTableHeaderCell
            data-testid="sortable-header"
            interaction="sortable-filterable"
            sortDirection={sortDirection}
            filterActive={filterActive}
            onSort={() => undefined}
            onFilter={() => undefined}
          >
            샘플 컬럼
          </EmrTableHeaderCell>
          <EmrTableHeaderCell
            interaction="menu"
            menuActive={menuActive}
            onMenu={() => undefined}
          >
            메뉴 컬럼
          </EmrTableHeaderCell>
          <EmrTableHeaderCell
            data-testid="plain-resizable-header"
            resize="data-column"
            onResizeMouseDown={() => undefined}
          >
            기본 텍스트 컬럼
          </EmrTableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <EmrTableCellText mode={textMode}>
              긴 합성 텍스트가 들어오는 테이블 셀 예시입니다. 실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다.
            </EmrTableCellText>
          </TableCell>
          <TableCell>
            <EmrTableCellText mode="one-line">샘플 값</EmrTableCellText>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

const meta = {
  title: "Design System/EMR/EmrTablePrimitives",
  component: TablePrimitivesExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EMR table primitives for shared header interaction affordances and controlled cell text wrapping/truncation. 사용할 때: a data grid needs consistent sort, filter, menu, resize, or text-mode behavior. 쓰지 말아야 할 때: non-table layouts or feature-specific cell logic that belongs in the table owner.",
      },
    },
  },
  argTypes: {
    filterActive: {
      control: "boolean",
      description: "Shows active filter affordance on the sample header.",
    },
    menuActive: {
      control: "boolean",
      description: "Shows active menu affordance on the sample header.",
    },
    sortDirection: {
      control: "radio",
      options: [undefined, "asc", "desc"],
      description: "Sort direction for the sample sortable header.",
    },
    textMode: {
      control: "radio",
      options: ["one-line", "two-line-if-long", "always-multiline", "badge-wrap", "full-on-demand"],
      description: "Cell text wrapping/truncation mode.",
    },
  },
  args: {
    filterActive: true,
    menuActive: false,
    sortDirection: "asc",
    textMode: "two-line-if-long",
  },
  render: (args) => <TablePrimitivesExample {...args} />,
} satisfies Meta<TablePrimitivesArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HeaderAndCellText: Story = {
  play: async ({ canvasElement }) => {
    const sortableLabel = canvasElement.querySelector(
      '[data-testid="sortable-header"] [data-emr-table-content="true"] > button',
    ) as HTMLButtonElement | null;
    const plainLabel = canvasElement.querySelector(
      '[data-testid="plain-resizable-header"] [data-emr-table-content="true"] > span',
    ) as HTMLSpanElement | null;
    const resizeHandle = canvasElement.querySelector(
      '[data-testid="plain-resizable-header"] button[aria-label$="컬럼 너비 조절"]',
    ) as HTMLButtonElement | null;

    if (!sortableLabel || !plainLabel || !resizeHandle) {
      throw new Error(
        "Table primitive story did not render the required header labels and resize handle.",
      );
    }

    const sortableStyles = getComputedStyle(sortableLabel);
    const plainStyles = getComputedStyle(plainLabel);
    const sharedLabelProperties = [
      "minHeight",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "fontSize",
      "lineHeight",
      "letterSpacing",
    ] as const;

    for (const property of sharedLabelProperties) {
      if (plainStyles[property] !== sortableStyles[property]) {
        throw new Error(
          `Plain header ${property} must match the sortable header label geometry.`,
        );
      }
    }

    const resizeStyles = getComputedStyle(resizeHandle);
    const resizeIndicatorStyles = getComputedStyle(resizeHandle, "::before");
    if (resizeStyles.width !== "8px" || resizeIndicatorStyles.width !== "1px") {
      throw new Error(
        "Plain header spacing must preserve the shared column resize handle.",
      );
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 정렬 버튼과 기본 텍스트 header가 같은 label spacing을 사용하고 resize handle을 유지하는지 cell text policy와 함께 확인할 때. 쓰지 말아야 할 때: feature-specific action이나 route logic을 primitive에 넣을 때.",
      },
    },
  },
};

export const Multiline: Story = {
  args: {
    filterActive: false,
    menuActive: true,
    sortDirection: undefined,
    textMode: "always-multiline",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 메모나 설명처럼 줄바꿈이 의미 있는 table cell. 쓰지 말아야 할 때: 짧은 status/value column.",
      },
    },
  },
};
