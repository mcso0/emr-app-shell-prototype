import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

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
  const [activeFilter, setActiveFilter] = useState(filterActive);
  const [activeMenu, setActiveMenu] = useState(menuActive);
  const [direction, setDirection] = useState(sortDirection);
  const [width, setWidth] = useState(240);
  const [drag, setDrag] = useState<{ x: number; width: number } | null>(null);
  useEffect(() => {
    if (!drag) return;
    const move = (event: MouseEvent | TouchEvent) => {
      const x = "touches" in event ? event.touches[0]?.clientX : event.clientX;
      if (x === undefined) return;
      if (event.cancelable) event.preventDefault();
      setWidth(Math.max(120, drag.width + x - drag.x));
    };
    const stop = () => setDrag(null);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", stop);
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", stop);
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", stop); document.removeEventListener("touchmove", move); document.removeEventListener("touchend", stop); };
  }, [drag]);
  const rows = [
    { id: "a", text: "긴 합성 텍스트가 들어오는 테이블 셀 예시입니다. 실제 환자, 보호자, 병원, 결제, 신원 정보는 포함하지 않습니다.", value: "샘플 값" },
    { id: "b", text: "추가 합성 텍스트", value: "추가 값" },
  ].filter(row => !activeFilter || row.id === "a").sort((a, b) => direction === "desc" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
  return (
    <div><Table density="standard" layout="fill">
      <TableHeader>
        <TableRow>
          <EmrTableHeaderCell
            data-testid="sortable-header"
            interaction="sortable-filterable"
            sortDirection={direction}
            filterActive={activeFilter}
            onSort={() => setDirection(value => value === "asc" ? "desc" : "asc")}
            onFilter={() => setActiveFilter(value => !value)}
          >
            샘플 컬럼
          </EmrTableHeaderCell>
          <EmrTableHeaderCell
            interaction="menu"
            menuActive={activeMenu}
            onMenu={() => setActiveMenu(value => !value)}
          >
            메뉴 컬럼
          </EmrTableHeaderCell>
          <EmrTableHeaderCell
            data-testid="plain-resizable-header"
            resize="data-column"
            style={{ width }}
            onResizeMouseDown={event => { event.preventDefault(); setDrag({ x: event.clientX, width }); }}
            onResizeTouchStart={event => { const touch = event.touches[0]; if (touch) setDrag({ x: touch.clientX, width }); }}
            onResizeDoubleClick={() => setWidth(240)}
            onResizeKeyDown={event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); setWidth(value => Math.max(120, value + (event.key === "ArrowRight" ? 8 : -8))); }}
          >
            기본 텍스트 컬럼
          </EmrTableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => <TableRow key={row.id}>
          <TableCell>
            <EmrTableCellText mode={textMode}>
              {row.text}
            </EmrTableCellText>
          </TableCell>
          <TableCell>
            <EmrTableCellText mode="one-line">{row.value}</EmrTableCellText>
          </TableCell>
          <TableCell>
            <EmrTableCellText mode="one-line">샘플 기본 값</EmrTableCellText>
          </TableCell>
        </TableRow>)}
      </TableBody>
    </Table><output aria-label="컬럼 상태">표시 {rows.length}건 · 메뉴 {activeMenu ? "열림" : "닫힘"} · 너비 {width}px</output></div>
  );
}

const meta = {
  title: "Design System/EMR/EmrTablePrimitives",
  component: TablePrimitivesExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "420px" },
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
  render: (args) => <TablePrimitivesExample key={`${args.filterActive}:${args.menuActive}:${args.sortDirection}`} {...args} />,
} satisfies Meta<TablePrimitivesArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

async function verifyInteractions(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const header = canvas.getByTestId("sortable-header");
  const beforeSort = header.getAttribute("aria-sort");
  const sort = canvas.getByRole("button", { name: "샘플 컬럼 정렬" });
  sort.focus(); await userEvent.keyboard("{Enter}");
  await expect(header).toHaveAttribute("aria-sort", beforeSort === "ascending" ? "descending" : "ascending");
  const filter = canvas.getByRole("button", { name: "샘플 컬럼 필터" });
  const beforeFilter = filter.getAttribute("aria-pressed");
  await userEvent.click(filter);
  await expect(filter).toHaveAttribute("aria-pressed", beforeFilter === "true" ? "false" : "true");
  await expect(canvasElement.querySelectorAll("tbody tr")).toHaveLength(beforeFilter === "true" ? 2 : 1);
  const menu = canvas.getByRole("button", { name: "메뉴 컬럼 컬럼 메뉴" });
  const beforeMenu = menu.getAttribute("aria-pressed");
  await userEvent.click(menu);
  await expect(canvas.getByLabelText("컬럼 상태")).toHaveTextContent(beforeMenu === "true" ? "메뉴 닫힘" : "메뉴 열림");
  const grip = canvas.getByRole("button", { name: "기본 텍스트 컬럼 컬럼 너비 조절" });
  grip.focus(); await userEvent.keyboard("{ArrowRight}");
  await waitFor(() => expect(canvas.getByLabelText("컬럼 상태")).toHaveTextContent("너비 248px"));
  await expect(canvas.getByTestId("plain-resizable-header")).toHaveStyle({ width: "248px" });
}

export const HeaderAndCellText: Story = {
  play: async ({ canvasElement }) => {
    const headerCells = canvasElement.querySelectorAll("thead th");
    const bodyRows = canvasElement.querySelectorAll("tbody tr");
    if (
      headerCells.length !== 3 ||
      bodyRows.length !== 1 ||
      Array.from(bodyRows).some(
        (row) => row.querySelectorAll("td").length !== headerCells.length,
      )
    ) {
      throw new Error("Table primitive example must align all three header and body columns.");
    }
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

    const resizeHeader = resizeHandle.closest("th");
    if (!resizeHeader) {
      throw new Error("Column resize handle must remain inside its table header.");
    }

    const headerRect = resizeHeader.getBoundingClientRect();
    const resizeRect = resizeHandle.getBoundingClientRect();
    const headerCenterY = headerRect.top + headerRect.height / 2;
    const resizeCenterY = resizeRect.top + resizeRect.height / 2;

    if (Math.abs(headerCenterY - resizeCenterY) > 0.5) {
      throw new Error(
        "Column resize handle must stay vertically centered in the table header.",
      );
    }
    await verifyInteractions(canvasElement);
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
  play: async ({ canvasElement }) => verifyInteractions(canvasElement),
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
