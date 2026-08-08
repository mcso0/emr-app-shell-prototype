import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";

import {
  EmrPinnedTableWorkspace,
  EmrTableHeaderCell,
  EmrTableIdentityCellContent,
  EmrTableSelectionCell,
  EmrTableSelectionHeaderCell,
} from "@/components/emr/table-primitives";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
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

function TableExample({
  density,
  layout,
  minWidth,
  pinning,
  showCaption,
}: TableStoryArgs) {
  return (
    <Table
      density={density}
      layout={layout}
      minWidth={layout === "scroll" ? minWidth : undefined}
      pinning={pinning}
    >
      {showCaption ? (
        <TableCaption>
          합성 업무 흐름만 보여주는 샘플 테이블입니다.
        </TableCaption>
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
      description:
        "Whether the table fills the container or keeps a scroll min-width.",
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
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector("table");
    const container = table?.parentElement;
    if (!container) {
      throw new Error(
        "Scroll layout story did not render its scroll container.",
      );
    }

    const styles = getComputedStyle(container);
    if (
      styles.overscrollBehaviorX !== "none" ||
      styles.overscrollBehaviorY !== "auto"
    ) {
      throw new Error(
        "The default scroll table must block horizontal overscroll without trapping vertical page scroll.",
      );
    }
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

export const BothAxisOverscroll: Story = {
  render: () => (
    <Table
      containerClassName="max-h-32 overflow-auto"
      data-testid="both-axis-overscroll-table"
      layout="scroll"
      minWidth={840}
      overscrollAxes="both"
    >
      <TableHeader>
        <TableRow>
          <TableHead>영역</TableHead>
          <TableHead>담당</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>예정</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }, (_, index) => (
          <TableRow key={index}>
            <TableCell>샘플 영역 {index + 1}</TableCell>
            <TableCell>샘플 담당</TableCell>
            <TableCell>대기</TableCell>
            <TableCell>09:{String(index).padStart(2, "0")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector(
      '[data-testid="both-axis-overscroll-table"]',
    );
    const container = table?.parentElement;
    if (!container) {
      throw new Error("Both-axis story did not render its scroll container.");
    }

    const styles = getComputedStyle(container);
    if (
      styles.overscrollBehaviorX !== "none" ||
      styles.overscrollBehaviorY !== "none"
    ) {
      throw new Error(
        "Both-axis table overscroll must be blocked on both axes.",
      );
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "세로·가로 스크롤을 모두 테이블이 소유하는 경우에만 두 축을 차단하는 재사용 API 예시.",
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
      selectionColumnWidth={44}
    >
      <Table
        data-testid="pinned-table"
        density={args.density}
        layout="scroll"
        minWidth={840}
        pinning="columns"
      >
        <colgroup>
          <col style={{ width: 44 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 120 }} />
          <col />
          <col style={{ width: 80 }} />
        </colgroup>
        <TableHeader>
          <TableRow>
            <EmrTableSelectionHeaderCell
              className="w-11 min-w-11 max-w-11"
              pinned="left"
              pinnedOffset={0}
            >
              <EmrTableCheckbox aria-label="전체 선택" />
            </EmrTableSelectionHeaderCell>
            <EmrTableHeaderCell
              className="!p-0 overflow-hidden"
              identity
              pinned="left"
              pinnedOffset={44}
              pinnedEdge
            >
              대상
            </EmrTableHeaderCell>
            <EmrTableHeaderCell
              className="!p-0"
              data-testid="pinned-scroll-header"
            >
              <button
                type="button"
                data-testid="pinned-scroll-header-surface"
                className="inline-flex min-h-6 items-center rounded-lg bg-[var(--emr-state-hover)] px-2.5 py-1 text-xs"
              >
                상태
              </button>
            </EmrTableHeaderCell>
            <TableHead>담당</TableHead>
            <TableHead pinned="right" pinnedOffset={0} pinnedEdge>
              작업
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <EmrTableSelectionCell
              className="w-11 min-w-11 max-w-11"
              controlVisibility="contextual"
              pinned="left"
              pinnedOffset={0}
            >
              <EmrTableCheckbox aria-label="합성 환자 A 선택" />
            </EmrTableSelectionCell>
            <TableCell
              className="!p-0 overflow-hidden"
              pinned="left"
              pinnedOffset={44}
              pinnedEdge
            >
              <EmrTableIdentityCellContent>
                합성 환자 A
              </EmrTableIdentityCellContent>
            </TableCell>
            <TableCell>
              <div
                data-emr-table-content="true"
                className="emr-table-cell-content flex items-center px-2"
              >
                <span
                  data-testid="pinned-scroll-body-surface"
                  className="inline-flex rounded-md bg-[var(--emr-surface-muted)] px-2 py-1"
                >
                  대기
                </span>
              </div>
            </TableCell>
            <TableCell>샘플 담당</TableCell>
            <TableCell pinned="right" pinnedOffset={0} pinnedEdge>
              보기
            </TableCell>
          </TableRow>
          <TableRow data-state="selected">
            <EmrTableSelectionCell
              className="w-11 min-w-11 max-w-11"
              controlVisibility="contextual"
              pinned="left"
              pinnedOffset={0}
            >
              <EmrTableCheckbox aria-label="합성 환자 B 선택" checked />
            </EmrTableSelectionCell>
            <TableCell pinned="left" pinnedOffset={44} pinnedEdge>
              합성 환자 B
            </TableCell>
            <TableCell>
              <div
                data-emr-table-content="true"
                className="emr-table-cell-content flex items-center px-2"
              >
                <span
                  data-testid="selected-pinned-scroll-body-surface"
                  className="inline-flex rounded-md bg-[var(--emr-surface-muted)] px-2 py-1"
                >
                  진행
                </span>
              </div>
            </TableCell>
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
    const leftCells = Array.from(
      table?.querySelectorAll<HTMLTableCellElement>(
        'tbody tr:first-child [data-emr-column-pinned="left"]',
      ) ?? [],
    );
    const rightCell = table?.querySelector(
      'tbody [data-emr-column-pinned="right"]',
    ) as HTMLTableCellElement | null;
    const selectedCell = table?.querySelector(
      'tbody tr[data-state="selected"] [data-emr-column-pinned="left"]',
    ) as HTMLTableCellElement | null;
    const headerPinnedEdge = table?.querySelector(
      'thead [data-emr-column-pinned="left"][data-emr-pinned-edge="true"]',
    ) as HTMLTableCellElement | null;
    const bodyPinnedEdge = table?.querySelector(
      'tbody tr:first-child [data-emr-column-pinned="left"][data-emr-pinned-edge="true"]',
    ) as HTMLTableCellElement | null;
    const firstScrollHeader = table?.querySelector(
      'thead [data-slot="table-head"]:not([data-emr-column-pinned])',
    ) as HTMLTableCellElement | null;
    const firstScrollBodyCell = table?.querySelector(
      'tbody tr:first-child [data-slot="table-cell"]:not([data-emr-column-pinned])',
    ) as HTMLTableCellElement | null;
    const selectedScrollBodyCell = table?.querySelector(
      'tbody tr[data-state="selected"] [data-slot="table-cell"]:not([data-emr-column-pinned])',
    ) as HTMLTableCellElement | null;
    const firstScrollHeaderSurface = table?.querySelector(
      '[data-testid="pinned-scroll-header-surface"]',
    ) as HTMLElement | null;
    const firstScrollBodySurface = table?.querySelector(
      '[data-testid="pinned-scroll-body-surface"]',
    ) as HTMLElement | null;
    const selectedScrollBodySurface = table?.querySelector(
      '[data-testid="selected-pinned-scroll-body-surface"]',
    ) as HTMLElement | null;
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
      leftCells.length !== 2 ||
      !rightCell ||
      !selectedCell ||
      !headerPinnedEdge ||
      !bodyPinnedEdge ||
      !firstScrollHeader ||
      !firstScrollBodyCell ||
      !selectedScrollBodyCell ||
      !firstScrollHeaderSurface ||
      !firstScrollBodySurface ||
      !selectedScrollBodySurface ||
      !workspace ||
      !headerIdentity ||
      !rowIdentity
    ) {
      throw new Error("Pinned table story did not render the required cells.");
    }

    const initialLeftPositions = leftCells.map(
      (cell) => cell.getBoundingClientRect().left,
    );
    container.scrollLeft = 240;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    if (table.dataset.emrPinning !== "columns") {
      throw new Error("Table did not expose the shared pinning mode.");
    }
    if (
      leftCells.some((cell) => getComputedStyle(cell).position !== "sticky")
    ) {
      throw new Error("A left pinned cell is not sticky.");
    }
    if (getComputedStyle(rightCell).position !== "sticky") {
      throw new Error("Right pinned cell is not sticky.");
    }
    if (
      leftCells.some(
        (cell, index) =>
          Math.abs(
            cell.getBoundingClientRect().left - initialLeftPositions[index],
          ) > 1,
      )
    ) {
      throw new Error("A left pinned cell moved during horizontal scroll.");
    }
    if (
      Math.abs(
        leftCells[1].getBoundingClientRect().left -
          leftCells[0].getBoundingClientRect().left -
          44,
      ) > 1
    ) {
      throw new Error("Pinned identity cell does not start after selection.");
    }
    if (getComputedStyle(selectedCell).backgroundColor === "rgba(0, 0, 0, 0)") {
      throw new Error("Selected pinned cell has a transparent surface.");
    }

    container.scrollLeft = 0;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    for (const [label, cell] of [
      ["header", firstScrollHeader],
      ["first body", firstScrollBodyCell],
      ["subsequent body", selectedScrollBodyCell],
    ] as const) {
      const styles = getComputedStyle(cell);
      if (
        styles
          .getPropertyValue("--emr-table-pinned-scroll-content-inset")
          .trim() !== "10px" ||
        styles.paddingInlineStart !== "0px"
      ) {
        throw new Error(
          `Pinned ${label} cell did not receive the automatic shared inset contract.`,
        );
      }
    }

    const contentHooks = [
      ["header", firstScrollHeader],
      ["first body", firstScrollBodyCell],
      ["subsequent body", selectedScrollBodyCell],
    ] as const;
    for (const [label, cell] of contentHooks) {
      const contentHook = cell.firstElementChild;
      if (
        !(contentHook instanceof HTMLElement) ||
        contentHook.dataset.emrTableContent !== "true"
      ) {
        throw new Error(`Pinned ${label} cell is missing its content hook.`);
      }
      const hookStyles = getComputedStyle(contentHook);
      if (
        hookStyles.marginInlineStart !== "10px" ||
        hookStyles.paddingInlineStart !== "0px"
      ) {
        throw new Error(
          `Pinned ${label} content hook does not own the 10px inset normalization.`,
        );
      }
    }

    for (const [label, cell, surface] of [
      ["header", firstScrollHeader, firstScrollHeaderSurface],
      ["first body", firstScrollBodyCell, firstScrollBodySurface],
      ["subsequent body", selectedScrollBodyCell, selectedScrollBodySurface],
    ] as const) {
      const cellRect = cell.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      if (
        surfaceRect.left < cellRect.left - 1 ||
        surfaceRect.right > cellRect.right + 1 ||
        getComputedStyle(surface).borderRadius === "0px"
      ) {
        throw new Error(
          `Pinned ${label} rounded content surface is clipped by its cell.`,
        );
      }
    }

    for (const [label, edgeCell, surface] of [
      ["header", headerPinnedEdge, firstScrollHeaderSurface],
      ["body", bodyPinnedEdge, firstScrollBodySurface],
    ] as const) {
      const inset =
        surface.getBoundingClientRect().left -
        edgeCell.getBoundingClientRect().right;
      if (inset < 9 || inset > 11) {
        throw new Error(
          `Pinned ${label} scroll content inset is ${inset}px, expected about 10px.`,
        );
      }
    }

    for (const [label, edgeCell] of [
      ["header", headerPinnedEdge],
      ["body", bodyPinnedEdge],
    ] as const) {
      const edgeStyles = getComputedStyle(edgeCell);
      const shadowLayers = Array.from(
        edgeStyles.boxShadow.matchAll(
          /(-?\d+(?:\.\d+)?)px 0px (-?\d+(?:\.\d+)?)px (-?\d+(?:\.\d+)?)px/g,
        ),
        (match) => ({
          offset: Number.parseFloat(match[1]),
          blur: Number.parseFloat(match[2]),
          spread: Number.parseFloat(match[3]),
        }),
      );
      const dividerLayer = shadowLayers[0];
      const gradientLayer = shadowLayers.find(
        (layer) => layer.blur > 0 && layer.spread < 0,
      );
      const solidLayers = shadowLayers.filter(
        (layer) => layer.blur === 0 && layer.spread === 0,
      );

      if (
        !dividerLayer ||
        dividerLayer.offset !== 1 ||
        dividerLayer.blur !== 0 ||
        dividerLayer.spread !== 0 ||
        solidLayers.length !== 1 ||
        !gradientLayer ||
        gradientLayer.offset < dividerLayer.offset
      ) {
        throw new Error(
          `Pinned ${label} edge must keep only its 1px divider and subtle gradient.`,
        );
      }
    }

    const firstBodyRow = table.querySelector(
      "tbody tr:first-child",
    ) as HTMLTableRowElement;
    await userEvent.hover(firstBodyRow);
    const hoverCellBackground =
      getComputedStyle(firstScrollBodyCell).backgroundColor;
    if (hoverCellBackground !== "rgba(0, 0, 0, 0)") {
      throw new Error(
        "Hover surface is not continuous through the first scroll cell.",
      );
    }

    const selectedRow = selectedScrollBodyCell.closest("tr");
    if (!(selectedRow instanceof HTMLTableRowElement)) {
      throw new Error("Selected pinned table row is missing.");
    }
    const selectedRowBackground = getComputedStyle(selectedRow).backgroundColor;
    const selectedCellBackground = getComputedStyle(
      selectedScrollBodyCell,
    ).backgroundColor;
    if (
      selectedRowBackground === "rgba(0, 0, 0, 0)" ||
      selectedCellBackground !== "rgba(0, 0, 0, 0)"
    ) {
      throw new Error(
        "Selected surface is not continuous through the first scroll cell.",
      );
    }
    if (
      Math.abs(
        headerIdentity.getBoundingClientRect().left -
          rowIdentity.getBoundingClientRect().left,
      ) > 1
    ) {
      throw new Error(
        "Pinned identity header and row text do not share one axis.",
      );
    }
    const horizontalOwners = Array.from(
      workspace.querySelectorAll<HTMLElement>("*"),
    ).filter((element) => {
      const overflowX = getComputedStyle(element).overflowX;
      return overflowX === "auto" || overflowX === "scroll";
    });
    if (horizontalOwners.length !== 1 || horizontalOwners[0] !== container) {
      throw new Error(
        "Pinned table has more than one horizontal overflow owner.",
      );
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
          <TableCell
            colSpan={2}
            className="h-24 text-center text-muted-foreground"
          >
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
