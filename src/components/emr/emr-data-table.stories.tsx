import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnPinningState,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { CdsContentEdit2Icon } from "@/components/cds-icons/content-and-editor";
import { CdsMedicalFileSearchIcon } from "@/components/cds-icons/medical-and-domain";
import { EmrIconButton } from "@/components/emr/icon-button";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { Button } from "@/components/ui/button";
import { EmrRowActionMenu } from "./row-action-menu";
import {
  EmrDataTable,
  type EmrDataTableRowState,
} from "./emr-data-table";

type StoryRow = {
  id: string;
  name: string;
  owner: string;
  status: string;
  amount: number;
  note: string;
  rowState: EmrDataTableRowState;
};

type EmrDataTableStoryArgs = {
  activeDetailRow: boolean;
  density: "compact" | "standard" | "comfortable";
  extraRows: boolean;
  loading: boolean;
  pinned: boolean;
  resizable: boolean;
  rowOverlay: boolean;
  selectable: boolean;
  selectedRows: boolean;
  showContextualActions: boolean;
  sortable: boolean;
};

const storyRows: StoryRow[] = [
  {
    amount: 30000,
    id: "sample-1",
    name: "요검사",
    note: "긴 설명이 들어와도 공통 텍스트 정책에 따라 한 줄로 표시됩니다.",
    owner: "진료팀",
    rowState: "draft",
    status: "사용",
  },
  {
    amount: 45000,
    id: "sample-2",
    name: "CBC 검사",
    note: "추가 행과 pinned boundary를 함께 확인하는 합성 데이터입니다.",
    owner: "검사팀",
    rowState: "confirmed",
    status: "사용",
  },
  {
    amount: 12000,
    id: "sample-3",
    name: "처치 세트",
    note: "실제 환자나 보호자 정보는 포함하지 않습니다.",
    owner: "처치팀",
    rowState: "error",
    status: "중지",
  },
];

const extraStoryRows: StoryRow[] = Array.from({ length: 8 }, (_, index) => ({
  amount: 10000 + index * 1000,
  id: `sample-extra-${index}`,
  name: `추가 샘플 ${index + 1}`,
  note: "스크롤 영역 끝까지 divider가 이어지는지 확인합니다.",
  owner: "운영팀",
  rowState: index % 3 === 0 ? "disabled" : "normal",
  status: index % 2 ? "사용" : "중지",
}));

function StorySelectionControl({
  ariaLabel,
  checked,
  indeterminate,
  onCheckedChange,
}: {
  ariaLabel: string;
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <span
      data-row-interactive="true"
      className="inline-flex size-6 items-center justify-center"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <EmrTableCheckbox
        aria-label={ariaLabel}
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
      />
    </span>
  );
}

function EmrDataTableStory({
  activeDetailRow,
  density,
  extraRows,
  loading,
  pinned,
  resizable,
  rowOverlay,
  selectable,
  selectedRows,
  showContextualActions,
  sortable,
}: EmrDataTableStoryArgs) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() => {
    const initialSelection: RowSelectionState = {};
    if (selectedRows) {
      initialSelection["sample-1"] = true;
      initialSelection["sample-2"] = true;
    }
    return initialSelection;
  });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const data = useMemo(
    () => (extraRows ? [...storyRows, ...extraStoryRows] : storyRows),
    [extraRows],
  );
  const columnPinning = useMemo<ColumnPinningState>(
    () => ({
      left: pinned ? ["select", "name"] : [],
      right: pinned && !rowOverlay ? ["actions"] : [],
    }),
    [pinned, rowOverlay],
  );
  const columns = useMemo<Array<ColumnDef<StoryRow, unknown>>>(
    () => [
      {
        id: "select",
        enableHiding: false,
        enableSorting: false,
        meta: { label: "샘플 전체 선택", role: "selection" },
        size: 44,
        header: ({ table }) => (
          <StorySelectionControl
            ariaLabel="샘플 전체 선택"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
          />
        ),
        cell: ({ row }) => (
          <StorySelectionControl
            ariaLabel={`${row.original.name} 선택`}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked)}
          />
        ),
      },
      {
        accessorKey: "name",
        id: "name",
        enableSorting: sortable,
        meta: {
          identity: true,
          label: "이름",
          resize: resizable ? "data-column" : "none",
          role: "data",
          textMode: "one-line",
        },
        size: 180,
      },
      {
        accessorKey: "owner",
        id: "owner",
        enableSorting: sortable,
        meta: {
          label: "담당",
          resize: resizable ? "data-column" : "none",
          role: "data",
          textMode: "one-line",
        },
        size: 160,
      },
      {
        accessorKey: "status",
        id: "status",
        enableSorting: false,
        meta: {
          label: "상태",
          resize: resizable ? "data-column" : "none",
          role: "data",
          textMode: "one-line",
        },
        size: 110,
      },
      {
        accessorKey: "amount",
        id: "amount",
        enableSorting: sortable,
        meta: {
          align: "right",
          label: "금액",
          resize: resizable ? "data-column" : "none",
          role: "data",
          textMode: "one-line",
        },
        size: 120,
      },
      {
        accessorKey: "note",
        id: "note",
        enableSorting: false,
        meta: {
          grow: true,
          label: "메모",
          resize: resizable ? "data-column" : "none",
          role: "data",
          textMode: "one-line",
        },
        size: 260,
      },
      ...(!rowOverlay
        ? [
            {
              id: "actions",
              enableHiding: false,
              enableSorting: false,
              meta: {
                align: "right" as const,
                label: "작업",
                role: "actions" as const,
              },
              size: 72,
              cell: () => (
                <button
                  className="rounded-md border px-2 py-1 text-xs"
                  data-row-interactive="true"
                  type="button"
                >
                  보기
                </button>
              ),
            } satisfies ColumnDef<StoryRow, unknown>,
          ]
        : []),
      ...(showContextualActions && !rowOverlay
        ? [
            {
              id: "contextual-actions",
              enableHiding: false,
              enableSorting: false,
              meta: {
                actionVisibility: "contextual" as const,
                align: "right" as const,
                label: "보조 작업",
                role: "actions" as const,
              },
              size: 52,
              cell: ({ row }) => (
                <EmrRowActionMenu
                  ariaLabel={`${row.original.name} 보조 작업`}
                  items={[{ key: "open", label: "상세 보기" }]}
                />
              ),
            } satisfies ColumnDef<StoryRow, unknown>,
          ]
        : []),
    ],
    [resizable, rowOverlay, showContextualActions, sortable],
  );
  // TanStack Table is intentionally used as the headless controller in this
  // Storybook contract test.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    columnResizeMode: "onChange",
    data,
    enableColumnPinning: pinned,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    getSortedRowModel: getSortedRowModel(),
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnPinning,
      columnSizing,
      rowSelection,
      sorting,
    },
  });

  return (
    <div className="h-[420px] min-w-0 rounded-xl border bg-white p-4">
      <EmrDataTable
        aria-label="EmrDataTable 공통 Storybook 예시"
        density={density}
        initialLoading={loading}
        overscrollAxes="both"
        renderAfterRows={({ visibleColumnCount }) => (
          <tr data-emr-data-table-extra-row="true">
            <td
              colSpan={visibleColumnCount}
              className="h-10 px-3 text-xs text-muted-foreground"
            >
              추가 행 슬롯: {visibleColumnCount}개 컬럼
            </td>
          </tr>
        )}
        skeletonRowCount={4}
        table={table}
        getRowState={(row) => row.original.rowState}
        getRowOverlayAriaLabel={(row) => `${row.original.name} 행 작업`}
        renderRowOverlay={rowOverlay
          ? ({ row }) => (
              <>
                <EmrIconButton
                  aria-label={`${row.original.name} 상세`}
                  className="size-7 border border-[var(--emr-border-default)] bg-[var(--emr-surface-floating)] shadow-[var(--clair-shadow-xs)]"
                  data-testid={`story-row-detail-${row.id}`}
                  disabled={row.original.rowState === "disabled"}
                >
                  <CdsMedicalFileSearchIcon aria-hidden="true" />
                </EmrIconButton>
                <EmrIconButton
                  aria-label={`${row.original.name} 수정`}
                  className="size-7 border border-[var(--emr-border-default)] bg-[var(--emr-surface-floating)] shadow-[var(--clair-shadow-xs)]"
                  disabled={row.original.rowState === "disabled"}
                >
                  <CdsContentEdit2Icon aria-hidden="true" />
                </EmrIconButton>
                <EmrRowActionMenu
                  ariaLabel={`${row.original.name} 더보기`}
                  density="compact"
                  items={[
                    { key: "history", label: "이력 보기" },
                    { key: "remove", label: "삭제", variant: "destructive" },
                  ]}
                />
              </>
            )
          : undefined}
        renderSelectionActionBar={({
          selectedRows: selected,
          table: selectedTable,
        }) => (
          <>
            <span className="grid min-w-[104px] border-r border-[var(--emr-border-default)] pr-3">
              <strong className="text-xs">{selected.length}개 선택</strong>
              <span className="text-[10px] text-[var(--emr-text-secondary)]">
                같은 상태 cohort
              </span>
            </span>
            <Button size="sm" variant="outline">
              이력 보기
            </Button>
            <Button size="sm">선택 작업</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => selectedTable.toggleAllRowsSelected(false)}
            >
              선택 해제
            </Button>
          </>
        )}
        getRowProps={(row) => {
          const active = activeDetailRow && row.original.id === "sample-1";

          return {
            "aria-current": active ? "true" : undefined,
            "data-detail-active": active ? "true" : undefined,
            "data-state": active ? "selected" : undefined,
          };
        }}
      />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrDataTable",
  component: EmrDataTableStory,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "TanStack Table v8 instance를 받아 고객관리 스타일로 렌더링하는 공통 데이터 테이블입니다. data, columns, 업무 상태는 feature controller가 소유합니다.",
      },
    },
  },
  argTypes: {
    activeDetailRow: { control: "boolean" },
    density: {
      control: "radio",
      options: ["compact", "standard", "comfortable"],
    },
    extraRows: { control: "boolean" },
    loading: { control: "boolean" },
    pinned: { control: "boolean" },
    resizable: { control: "boolean" },
    rowOverlay: { control: "boolean" },
    selectable: { control: "boolean" },
    selectedRows: { control: "boolean" },
    showContextualActions: { control: "boolean" },
    sortable: { control: "boolean" },
  },
  args: {
    activeDetailRow: false,
    density: "standard",
    extraRows: false,
    loading: false,
    pinned: false,
    resizable: false,
    rowOverlay: false,
    selectable: true,
    selectedRows: false,
    showContextualActions: false,
    sortable: true,
  },
} satisfies Meta<EmrDataTableStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

function assertRowDivider(cell: Element | null, label: string) {
  if (!(cell instanceof HTMLTableCellElement)) {
    throw new Error(`${label} row-divider cell is missing.`);
  }

  const styles = getComputedStyle(cell);
  if (
    styles.borderBottomWidth !== "1px" ||
    styles.borderBottomStyle !== "solid" ||
    styles.borderBottomColor !== "rgb(229, 229, 229)"
  ) {
    throw new Error(`${label} row divider does not match neutral/200.`);
  }
}

export const AllColumnsScroll: Story = {
  play: async ({ canvasElement }) => {
    assertRowDivider(
      canvasElement.querySelector(
        'tbody tr[data-emr-data-table-row="true"]:first-child td[data-column-id="owner"]',
      ),
      "Scrollable",
    );
  },
};

export const LeftAndRightPinned: Story = {
  args: { pinned: true },
  play: async ({ canvasElement }) => {
    const storyFrame = canvasElement.firstElementChild as HTMLElement | null;
    if (!storyFrame) {
      throw new Error("Pinned EmrDataTable story frame is missing.");
    }
    storyFrame.style.width = "720px";
    const viewport = canvasElement.querySelector(
      '[data-emr-pinned-table-viewport="true"]',
    ) as HTMLElement | null;
    const scrollOwner = viewport?.querySelector(
      '[data-emr-pinned-table-scroll-owner="true"]',
    ) as HTMLElement | null;
    let horizontalScrollbar: HTMLElement | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      horizontalScrollbar = viewport?.querySelector(
        '[data-emr-pinned-table-scrollbar="horizontal"]',
      ) as HTMLElement | null;
      if (horizontalScrollbar) break;
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    const tableContainer = viewport?.querySelector(
      '[data-slot="table-container"]',
    ) as HTMLElement | null;

    if (!viewport || !scrollOwner || !horizontalScrollbar || !tableContainer) {
      throw new Error("Pinned EmrDataTable scroll targets are missing.");
    }

    assertRowDivider(
      canvasElement.querySelector(
        'tbody tr[data-emr-data-table-row="true"]:first-child td[data-column-id="name"]',
      ),
      "Pinned identity",
    );
    assertRowDivider(
      canvasElement.querySelector(
        'tbody tr[data-emr-data-table-row="true"]:first-child td[data-column-id="owner"]',
      ),
      "Pinned scrolling",
    );

    const viewportRect = viewport.getBoundingClientRect();
    const scrollbarRect = horizontalScrollbar.getBoundingClientRect();
    const viewportStyles = getComputedStyle(viewport);
    const leftPinnedWidth = Number.parseFloat(
      viewportStyles.getPropertyValue(
        "--emr-table-left-pinned-column-width",
      ),
    );
    const rightPinnedWidth = Number.parseFloat(
      viewportStyles.getPropertyValue(
        "--emr-table-right-pinned-column-width",
      ),
    );

    if (
      getComputedStyle(scrollOwner).overflowX !== "scroll" ||
      getComputedStyle(tableContainer).overflowX !== "visible" ||
      Math.abs(scrollbarRect.left - viewportRect.left - leftPinnedWidth) > 1 ||
      Math.abs(viewportRect.right - scrollbarRect.right - rightPinnedWidth) > 1
    ) {
      throw new Error(
        "Pinned EmrDataTable must keep one viewport owner and center the horizontal scrollbar between fixed columns.",
      );
    }

    scrollOwner.scrollLeft = scrollOwner.scrollWidth;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (scrollOwner.scrollLeft <= 0) {
      throw new Error("Pinned EmrDataTable viewport did not scroll.");
    }
  },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Selection: Story = {
  args: { selectable: true },
};

export const ContextualActions: Story = {
  args: { showContextualActions: true },
};

export const DetailActiveRow: Story = {
  args: { activeDetailRow: true, showContextualActions: true },
};

export const Sorting: Story = {
  args: { sortable: true },
};

export const Resizing: Story = {
  args: { pinned: true, resizable: true },
};

export const AdditionalRows: Story = {
  args: { extraRows: true, pinned: true },
};

export const ViewportRightRowOverlay: Story = {
  args: { extraRows: true, pinned: true, rowOverlay: true },
  play: async ({ canvasElement }) => {
    const storyFrame = canvasElement.firstElementChild as HTMLElement | null;
    if (!storyFrame) {
      throw new Error("Row overlay EmrDataTable story frame is missing.");
    }
    storyFrame.style.width = "720px";

    const viewport = canvasElement.querySelector(
      '[data-emr-pinned-table-viewport="true"]',
    ) as HTMLElement | null;
    const scrollOwner = viewport?.querySelector(
      '[data-emr-pinned-table-scroll-owner="true"]',
    ) as HTMLElement | null;
    const overlay = canvasElement.querySelector(
      '.emr-data-table-row-overlay[data-emr-data-table-row-overlay="true"]',
    ) as HTMLElement | null;
    const detailAction = canvasElement.querySelector(
      '[data-testid="story-row-detail-sample-1"]',
    ) as HTMLButtonElement | null;

    if (!viewport || !scrollOwner || !overlay || !detailAction) {
      throw new Error("Row overlay geometry targets are missing.");
    }

    detailAction.focus();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await expect(detailAction).toHaveFocus();
    await waitFor(() => expect(getComputedStyle(overlay).opacity).toBe("1"));

    const maximumScroll = scrollOwner.scrollWidth - scrollOwner.clientWidth;
    const positions = [0, maximumScroll / 2, maximumScroll];
    for (const position of positions) {
      scrollOwner.scrollLeft = position;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const viewportRect = viewport.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      await expect(
        Math.abs(viewportRect.right - overlayRect.right),
      ).toBeLessThanOrEqual(2);
    }

  },
};

export const SelectionActionBarViewportPlacement: Story = {
  args: { pinned: true, rowOverlay: true, selectedRows: true },
  play: async ({ canvasElement }) => {
    let actionBar: HTMLElement | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      actionBar = canvasElement.querySelector(
        '[data-emr-data-table-selection-action-bar="true"]',
      ) as HTMLElement | null;
      if (actionBar) break;
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    const tableRoot = canvasElement.querySelector(
      '[data-emr-data-table="true"]',
    ) as HTMLElement | null;
    if (!actionBar || !tableRoot) {
      throw new Error("Selection action bar geometry targets are missing.");
    }

    const tableRect = tableRoot.getBoundingClientRect();
    const barRect = actionBar.getBoundingClientRect();
    const visibleLeft = Math.max(0, tableRect.left);
    const visibleRight = Math.min(window.innerWidth, tableRect.right);
    const visibleBottom = Math.min(window.innerHeight, tableRect.bottom);
    const expectedCenter = (visibleLeft + visibleRight) / 2;
    await expect(
      Math.abs(expectedCenter - (barRect.left + barRect.right) / 2),
    ).toBeLessThanOrEqual(2);
    await expect(
      Math.abs(visibleBottom - barRect.bottom - 14),
    ).toBeLessThanOrEqual(2);
  },
};

export const RowStateGradients: Story = {
  args: { extraRows: true, rowOverlay: true },
};

export const TouchRowOverlayFallback: Story = {
  args: { rowOverlay: true },
};
