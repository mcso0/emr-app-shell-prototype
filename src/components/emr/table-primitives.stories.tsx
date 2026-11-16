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

const syntheticOrderName = "합성 테스트 오더 · 매우 긴 오더명과 추가 설명 전체 표시 확인";

export const OverflowTooltip: Story = {
  render: () => (
    <div>
      <div data-testid="order-name-row" className="flex w-[180px] items-center gap-1.5">
        <EmrTableCellText mode="one-line" fullText={syntheticOrderName} tooltipOnOverflow className="font-medium">
          {syntheticOrderName}
        </EmrTableCellText>
      </div>
      <div className="w-[180px]">
        <EmrTableCellText tooltipOnOverflow>짧은 이름</EmrTableCellText>
        <EmrTableCellText>기존 기본 이름</EmrTableCellText>
      </div>
    </div>
  ),
  parameters: { docs: { description: { story: "Plan/Order 오더명과 같은 한 줄 셀에서 실제로 잘린 이름만 호버 또는 키보드 포커스로 펼칩니다. 기본 셀은 기존 title 동작을 유지합니다. 합성 데이터만 사용합니다." } } },
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector('[data-testid="order-name-row"]') as HTMLElement;
    const label = row.querySelector('[data-emr-cell-text-mode]') as HTMLElement;
    const labels = canvasElement.querySelectorAll<HTMLElement>('[data-emr-cell-text-mode]');
    const waitFor = async (condition: () => boolean, message: string) => {
      for (let i = 0; i < 100; i++) {
        if (condition()) return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error(message);
    };
    await waitFor(() => label.tabIndex === 0, "Clipped name must be keyboard focusable");
    if (label.hasAttribute('title') || labels[1].hasAttribute('title')) throw new Error('Opt-in cells must not have duplicate native tooltips');
    if (labels[1].tabIndex !== -1 || labels[2].title !== '기존 기본 이름') throw new Error('Short and default cells must preserve their intended behavior');
    label.focus();
    const popup = () => document.querySelector('[data-slot="tooltip-content"]');
    await waitFor(() => popup()?.textContent === syntheticOrderName, "Focus must show full order name");
    let clicks = 0;
    const onClick = () => { clicks++; };
    row.addEventListener('click', onClick);
    label.click();
    row.removeEventListener('click', onClick);
    if (clicks !== 1) throw new Error('Text click must still reach the row');
    label.blur();
    row.style.width = '1000px';
    await waitFor(() => label.tabIndex === -1 && !popup(), "Expanding column must remove tooltip and extra tab stop");
    row.style.width = '180px';
    await waitFor(() => label.tabIndex === 0, "Shrinking column must restore full-name access");
    label.focus();
    await waitFor(() => popup()?.textContent === syntheticOrderName, "Resized cell must still show full text");
    label.blur();
  },
};
