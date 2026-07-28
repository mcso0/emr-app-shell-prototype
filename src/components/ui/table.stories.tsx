import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  EmrPinnedTableWorkspace,
  EmrTableHeaderCell,
  EmrTableIdentityCellContent,
} from "@/components/emr/table-primitives";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

type TableStoryArgs = {
  density: "compact" | "standard" | "comfortable";
  layout: "fill" | "scroll";
  minWidth: number;
  pinning: "none" | "columns";
  showCaption: boolean;
};

const sampleRows = [
  { area: "접수", owner: "샘플 팀", status: "대기", time: "09:10" },
  { area: "진료", owner: "샘플 담당", status: "진행", time: "09:40" },
  { area: "수납", owner: "샘플 데스크", status: "준비", time: "10:05" },
];

function TableExample({ density, layout, minWidth, pinning, showCaption }: TableStoryArgs) {
  return (
    <Table
      density={density}
      layout={layout}
      minWidth={layout === "scroll" ? minWidth : undefined}
      pinning={pinning}
    >
      {showCaption ? (
        <TableCaption>합성 업무 흐름만 보여주는 샘플 테이블입니다.</TableCaption>
      ) : null}
      <TableHeader>
        <TableRow>
          <TableHead>영역</TableHead>
          <TableHead>담당</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">예정</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sampleRows.map((row) => (
          <TableRow key={row.area}>
            <TableCell className="font-medium">{row.area}</TableCell>
            <TableCell>{row.owner}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell className="text-right">{row.time}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>샘플 합계</TableCell>
          <TableCell className="text-right">{sampleRows.length}건</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

const meta = {
  title: "Design System/UI/Table",
  component: TableExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Table for structured row and column data that must support scanning, comparison, density, and horizontal overflow. 사용할 때: each row shares the same column contract. 쓰지 말아야 할 때: freeform cards, forms, or queue items whose layout differs per item.",
      },
    },
  },
  argTypes: {
    density: {
      control: "radio",
      options: ["compact", "standard", "comfortable"],
      description: "EMR table density token.",
    },
    layout: {
      control: "radio",
      options: ["fill", "scroll"],
      description: "Whether the table fills the container or keeps a scroll min-width.",
    },
    minWidth: {
      control: { type: "number", min: 480, max: 1200 },
      description: "Minimum table width used when layout is scroll.",
    },
    pinning: {
      control: "radio",
      options: ["none", "columns"],
      description: "Whether shared cells may use fixed-column presentation.",
    },
    showCaption: {
      control: "boolean",
      description: "Whether to render a table caption.",
    },
  },
  args: {
    density: "standard",
    layout: "fill",
    minWidth: 720,
    pinning: "none",
    showCaption: true,
  },
  render: (args) => <TableExample {...args} />,
} satisfies Meta<TableStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 같은 column 구조를 가진 업무 목록을 비교할 때. 쓰지 말아야 할 때: 각 항목이 서로 다른 상세 UI를 가져야 하는 카드 목록.",
      },
    },
  },
};

export const Compact: Story = {
  args: {
    density: "compact",
    showCaption: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: dense operational queue에서 더 많은 행을 보여줄 때. 쓰지 말아야 할 때: 행 안의 텍스트가 줄바꿈 없이 잘려 의미를 잃을 때.",
      },
    },
  },
};

export const ScrollLayout: Story = {
  args: {
    layout: "scroll",
    minWidth: 840,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: column 수가 많아 최소 너비를 유지해야 할 때. 쓰지 말아야 할 때: 작은 표를 불필요하게 가로 스크롤로 숨길 때.",
      },
    },
  },
};

export const PinnedColumns: Story = {
  render: (args) => (
    <EmrPinnedTableWorkspace
      className="w-[520px] overflow-hidden"
      data-testid="pinned-table-workspace"
      identityTextInset={48}
    >
      <Table
        data-testid="pinned-table"
        density={args.density}
        layout="scroll"
        minWidth={840}
        pinning="columns"
      >
        <TableHeader>
          <TableRow>
            <EmrTableHeaderCell
              className="!p-0"
              identity
              pinned="left"
              pinnedOffset={0}
              pinnedEdge
            >
              대상
            </EmrTableHeaderCell>
            <TableHead>상태</TableHead>
            <TableHead>담당</TableHead>
            <TableHead pinned="right" pinnedOffset={0} pinnedEdge>
              작업
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell
              className="!p-0"
              pinned="left"
              pinnedOffset={0}
              pinnedEdge
            >
              <EmrTableIdentityCellContent
                leading={
                  <span className="inline-block size-7 rounded-full bg-muted" />
                }
                leadingGap={8}
                leadingWidth={28}
              >
                합성 환자 A
              </EmrTableIdentityCellContent>
            </TableCell>
            <TableCell>대기</TableCell>
            <TableCell>샘플 담당</TableCell>
            <TableCell pinned="right" pinnedOffset={0} pinnedEdge>
              보기
            </TableCell>
          </TableRow>
          <TableRow data-state="selected">
            <TableCell pinned="left" pinnedOffset={0} pinnedEdge>
              합성 환자 B
            </TableCell>
            <TableCell>진행</TableCell>
            <TableCell>샘플 담당</TableCell>
            <TableCell pinned="right" pinnedOffset={0} pinnedEdge>
              보기
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </EmrPinnedTableWorkspace>
  ),
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector(
      '[data-testid="pinned-table"]',
    ) as HTMLTableElement | null;
    const container = table?.parentElement;
    const leftCell = table?.querySelector(
      'tbody [data-emr-column-pinned="left"]',
    ) as HTMLTableCellElement | null;
    const rightCell = table?.querySelector(
      'tbody [data-emr-column-pinned="right"]',
    ) as HTMLTableCellElement | null;
    const selectedCell = table?.querySelector(
      'tbody tr[data-state="selected"] [data-emr-column-pinned="left"]',
    ) as HTMLTableCellElement | null;
    const workspace = canvasElement.querySelector(
      '[data-testid="pinned-table-workspace"]',
    ) as HTMLDivElement | null;
    const headerIdentity = table?.querySelector(
      'thead [data-emr-table-identity-text="true"]',
    ) as HTMLSpanElement | null;
    const rowIdentity = table?.querySelector(
      'tbody [data-emr-table-identity-text="true"]',
    ) as HTMLSpanElement | null;

    if (
      !table ||
      !container ||
      !leftCell ||
      !rightCell ||
      !selectedCell ||
      !workspace ||
      !headerIdentity ||
      !rowIdentity
    ) {
      throw new Error("Pinned table story did not render the required cells.");
    }

    const initialLeft = leftCell.getBoundingClientRect().left;
    container.scrollLeft = 240;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    if (table.dataset.emrPinning !== "columns") {
      throw new Error("Table did not expose the shared pinning mode.");
    }
    if (getComputedStyle(leftCell).position !== "sticky") {
      throw new Error("Left pinned cell is not sticky.");
    }
    if (getComputedStyle(rightCell).position !== "sticky") {
      throw new Error("Right pinned cell is not sticky.");
    }
    if (Math.abs(leftCell.getBoundingClientRect().left - initialLeft) > 1) {
      throw new Error("Left pinned cell moved during horizontal scroll.");
    }
    if (getComputedStyle(selectedCell).backgroundColor === "rgba(0, 0, 0, 0)") {
      throw new Error("Selected pinned cell has a transparent surface.");
    }
    if (
      Math.abs(
        headerIdentity.getBoundingClientRect().left -
          rowIdentity.getBoundingClientRect().left,
      ) > 1
    ) {
      throw new Error("Pinned identity header and row text do not share one axis.");
    }
    const horizontalOwners = Array.from(
      workspace.querySelectorAll<HTMLElement>("*"),
    ).filter((element) => {
      const overflowX = getComputedStyle(element).overflowX;
      return overflowX === "auto" || overflowX === "scroll";
    });
    if (
      horizontalOwners.length !== 1 ||
      horizontalOwners[0] !== container
    ) {
      throw new Error("Pinned table has more than one horizontal overflow owner.");
    }
  },
};

export const EmptyRows: Story = {
  render: (args) => (
    <Table density={args.density} layout={args.layout}>
      <TableHeader>
        <TableRow>
          <TableHead>영역</TableHead>
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
            조건에 맞는 샘플 행이 없습니다.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table 구조는 유지하면서 현재 조건의 행이 없음을 보여줄 때. 쓰지 말아야 할 때: read failure나 permission blocker를 단순 빈 행처럼 표현할 때.",
      },
    },
  },
};
