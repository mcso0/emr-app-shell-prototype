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
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table header action과 cell text policy를 함께 확인할 때. 쓰지 말아야 할 때: feature-specific action이나 route logic을 primitive에 넣을 때.",
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
