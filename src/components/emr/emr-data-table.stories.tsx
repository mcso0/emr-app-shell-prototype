import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
import { useCallback, useMemo, useState } from "react";

import { CdsContentEdit2Icon } from "@/components/cds-icons/content-and-editor";
import { CdsMedicalFileSearchIcon } from "@/components/cds-icons/medical-and-domain";
import { EmrIconButton } from "@/components/emr/icon-button";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { Button } from "@/components/ui/button";
import { EmrRowActionMenu } from "./row-action-menu";
import { ActualCustomerTable, customerCallerParameters, prepareCustomerCaller, verifyCustomerHeader } from "./customer-caller.stories.fixture";
import {
  EmrDataTable,
  type EmrDataTableProps,
  type EmrDataTableRowState,
  type EmrDataTableViewportMode,
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

export type EmrDataTableStoryArgs = {
  activeDetailRow: boolean;
  density: "compact" | "standard" | "comfortable";
  loading: boolean;
  pinned: boolean;
  rowCount: "zero" | "one" | "many";
  resizable: boolean;
  rowOverlay: boolean;
  selectable: boolean;
  selectedRows: boolean;
  showContextualActions: boolean;
  sortable: boolean;
  viewportMode: EmrDataTableViewportMode;
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

export function useEmrDataTableStoryProps({
  activeDetailRow,
  density,
  loading,
  pinned,
  rowCount,
  resizable,
  rowOverlay,
  selectable,
  selectedRows,
  showContextualActions,
  sortable,
  viewportMode,
}: EmrDataTableStoryArgs, onStoryAction?: (message: string) => void): EmrDataTableProps<StoryRow> {
  const [lastAction, setLastAction] = useState("없음");
  const onAction = useCallback((message: string) => {
    if (onStoryAction) onStoryAction(message);
    else setLastAction(message);
  }, [onStoryAction]);
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
    () =>
      rowCount === "zero"
        ? []
        : rowCount === "one"
          ? storyRows.slice(0, 1)
          : [...storyRows, ...extraStoryRows],
    [rowCount],
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
              cell: ({ row }) => (
                <button
                  className="rounded-md border px-2 py-1 text-xs"
                  data-row-interactive="true"
                  disabled={row.original.rowState === "disabled"}
                  onClick={() => onAction(`${row.original.name}: 보기`)}
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
                  items={[{ key: "open", label: "상세 보기", disabled: row.original.rowState === "disabled", onSelect: () => onAction(`${row.original.name}: 상세 보기`) }]}
                />
              ),
            } satisfies ColumnDef<StoryRow, unknown>,
          ]
        : []),
    ],
    [onAction, resizable, rowOverlay, showContextualActions, sortable],
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

  return {
    "aria-label": "EmrDataTable 공통 Storybook 예시",
    density,
    initialLoading: loading,
    overscrollAxes: "both",
    renderAfterRows: ({ visibleColumnCount }) => (
      <tr data-emr-data-table-extra-row="true">
        <td
          colSpan={visibleColumnCount}
          className="h-10 px-3 text-xs text-muted-foreground"
        >
          추가 행 슬롯: {visibleColumnCount}개 컬럼
          {!onStoryAction ? <output className="ml-3" aria-label="테이블 작업 결과">{lastAction}</output> : null}
        </td>
      </tr>
    ),
    skeletonRowCount: 4,
    table,
    viewportMode,
    getRowState: (row) => row.original.rowState,
    getRowOverlayAriaLabel: (row) => `${row.original.name} 행 작업`,
    renderRowOverlay: rowOverlay
      ? ({ row }) => (
          <>
            <EmrIconButton
              aria-label={`${row.original.name} 상세`}
              className="size-7 border border-[var(--emr-border-default)] bg-[var(--emr-surface-floating)] shadow-[var(--clair-shadow-xs)]"
              data-testid={`story-row-detail-${row.id}`}
              disabled={row.original.rowState === "disabled"}
              onClick={() => onAction(`${row.original.name}: 상세`)}
            >
              <CdsMedicalFileSearchIcon aria-hidden="true" />
            </EmrIconButton>
            <EmrIconButton
              aria-label={`${row.original.name} 수정`}
              className="size-7 border border-[var(--emr-border-default)] bg-[var(--emr-surface-floating)] shadow-[var(--clair-shadow-xs)]"
              disabled={row.original.rowState === "disabled"}
              onClick={() => onAction(`${row.original.name}: 수정`)}
            >
              <CdsContentEdit2Icon aria-hidden="true" />
            </EmrIconButton>
            <EmrRowActionMenu
              ariaLabel={`${row.original.name} 더보기`}
              density="compact"
              items={[
                { key: "history", label: "이력 보기", disabled: row.original.rowState === "disabled", onSelect: () => onAction(`${row.original.name}: 이력 보기`) },
                { key: "remove", label: "삭제", variant: "destructive", disabled: row.original.rowState === "disabled", onSelect: () => onAction(`${row.original.name}: 삭제 요청`) },
              ]}
            />
          </>
        )
      : undefined,
    renderSelectionActionBar: ({
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
        <Button size="sm" variant="outline" onClick={() => onAction(`${selected.length}개 선택: 이력 보기`)}>
          이력 보기
        </Button>
        <Button size="sm" onClick={() => onAction(`${selected.length}개 선택: 선택 작업`)}>선택 작업</Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => selectedTable.toggleAllRowsSelected(false)}
        >
          선택 해제
        </Button>
      </>
    ),
    getRowProps: (row) => {
      const active = activeDetailRow && row.original.id === "sample-1";

      return {
        "aria-current": active ? "true" : undefined,
        "data-detail-active": active ? "true" : undefined,
        "data-state": active ? "selected" : undefined,
      };
    },
  };
}

function EmrDataTableStory(args: EmrDataTableStoryArgs) {
  const [receipt, setReceipt] = useState({ count: 0, message: "없음" });
  const onAction = useCallback((message: string) => setReceipt(previous => ({ count: previous.count + 1, message })), []);
  const props = useEmrDataTableStoryProps(args, onAction);

  return (
    <>
      <div className="flex h-[420px] min-w-0 flex-col rounded-xl border bg-white p-4">
        <EmrDataTable {...props} />
      </div>
      <output aria-label="테이블 작업 결과">{receipt.count}회 · {receipt.message}</output>
    </>
  );
}

const meta = {
  title: "Design System/EMR/EmrDataTable",
  component: EmrDataTableStory,
  excludeStories: ["useEmrDataTableStoryProps"],
  render: (args) => <EmrDataTableStory key={String(args.selectedRows)} {...args} />,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "520px" },
      description: {
        component:
          "CustomerCaller는 실제 CustomerDataTable과 고객 행/컬럼 factory를 렌더링합니다. 나머지 예제는 합성 행을 사용하는 공유 테이블 API/geometry 계약입니다. data, columns, 업무 상태는 호출자가 소유합니다. 작업 버튼은 로컬 결과를 기록하며 삭제·원격 업무를 실행하지 않습니다. viewportMode로 fill 또는 content 높이를 선언합니다.",
      },
    },
  },
  argTypes: {
    activeDetailRow: { control: "boolean" },
    density: {
      control: "radio",
      options: ["compact", "standard", "comfortable"],
    },
    loading: { control: "boolean" },
    pinned: { control: "boolean" },
    rowCount: {
      control: "radio",
      options: ["zero", "one", "many"],
    },
    resizable: { control: "boolean" },
    rowOverlay: { control: "boolean" },
    selectable: { control: "boolean" },
    selectedRows: { control: "boolean" },
    showContextualActions: { control: "boolean" },
    sortable: { control: "boolean" },
    viewportMode: {
      control: "radio",
      options: ["fill", "content"],
    },
  },
  args: {
    activeDetailRow: false,
    density: "standard",
    loading: false,
    pinned: false,
    rowCount: "many",
    resizable: false,
    rowOverlay: false,
    selectable: true,
    selectedRows: false,
    showContextualActions: false,
    sortable: true,
    viewportMode: "fill",
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

type ViewportContractCase = {
  loading?: boolean;
  pinned: boolean;
  rowCount: EmrDataTableStoryArgs["rowCount"];
  viewportMode: EmrDataTableViewportMode;
};

async function assertViewportContract(
  canvasElement: HTMLElement,
  contract: ViewportContractCase,
) {
  const storyFrame = canvasElement.firstElementChild as HTMLElement | null;
  const dataTableRoot = canvasElement.querySelector(
    '[data-emr-data-table="true"]',
  ) as HTMLElement | null;
  const tableContainer = dataTableRoot?.querySelector(
    '[data-slot="table-container"]',
  ) as HTMLElement | null;
  const pinnedViewport = dataTableRoot?.querySelector(
    '[data-emr-pinned-table-viewport="true"]',
  ) as HTMLElement | null;
  const scrollOwner = contract.pinned
    ? (pinnedViewport?.querySelector(
        '[data-emr-pinned-table-scroll-owner="true"]',
      ) as HTMLElement | null)
    : tableContainer;

  if (!storyFrame || !dataTableRoot || !tableContainer || !scrollOwner) {
    throw new Error("EmrDataTable viewport contract targets are missing.");
  }

  const originalFrameWidth = storyFrame.style.width;
  try {
    storyFrame.style.width = "720px";
    await new Promise((resolve) => requestAnimationFrame(resolve));

    await expect(dataTableRoot).toHaveAttribute(
      "data-emr-data-table-viewport-mode",
      contract.viewportMode,
    );
    await expect(
      dataTableRoot.querySelectorAll(
        'tbody tr[data-emr-data-table-row="true"]',
      ).length,
    ).toBe(
      contract.loading || contract.rowCount === "zero"
        ? 0
        : contract.rowCount === "one"
          ? 1
          : 11,
    );
    if (contract.loading) {
      await expect(
        dataTableRoot.querySelectorAll(
          'tbody tr[data-emr-data-table-skeleton-row="true"]',
        ).length,
      ).toBe(4);
    }

    for (const width of [1900, 1000, 720]) {
      storyFrame.style.width = `${width}px`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      for (const header of dataTableRoot.querySelectorAll<HTMLElement>(
        'thead th[data-column-id]',
      )) {
        const columnId = header.dataset.columnId;
        const declaredWidth = Number(header.dataset.emrColumnSize);
        const headerRect = header.getBoundingClientRect();
        if (columnId === "note") {
          await expect(headerRect.width).toBeGreaterThanOrEqual(declaredWidth);
        } else {
          await expect(Math.abs(headerRect.width - declaredWidth)).toBeLessThanOrEqual(1);
        }
        const bodyCell = dataTableRoot.querySelector<HTMLElement>(
          `tbody tr:first-child td[data-column-id="${columnId}"]`,
        );
        if (bodyCell) {
          const bodyRect = bodyCell.getBoundingClientRect();
          await expect(Math.abs(bodyRect.left - headerRect.left)).toBeLessThanOrEqual(1);
          await expect(Math.abs(bodyRect.width - headerRect.width)).toBeLessThanOrEqual(1);
        }
      }
      const identityHeaderText = dataTableRoot.querySelector<HTMLElement>(
        'th[data-column-id="name"] [data-emr-table-identity-text="true"]',
      );
      const identityBodyContent = dataTableRoot.querySelector<HTMLElement>(
        'tbody tr:first-child td[data-column-id="name"] .emr-data-table-cell-content',
      );
      if (identityHeaderText && identityBodyContent) {
        const headerRange = identityHeaderText.ownerDocument.createRange();
        headerRange.selectNodeContents(identityHeaderText);
        await expect(
          Math.abs(
            headerRange.getBoundingClientRect().left -
              identityBodyContent.getBoundingClientRect().left,
          ),
        ).toBeLessThanOrEqual(1);
      }
    }

    const horizontalOwners = Array.from(
      dataTableRoot.querySelectorAll<HTMLElement>("*"),
    ).filter((element) => {
      const overflowX = getComputedStyle(element).overflowX;
      return overflowX === "auto" || overflowX === "scroll";
    });
    await expect(horizontalOwners).toHaveLength(1);
    await expect(horizontalOwners[0]).toBe(scrollOwner);

    const frameRect = storyFrame.getBoundingClientRect();
    const frameStyles = getComputedStyle(storyFrame);
    const frameContentBottom =
      frameRect.bottom - Number.parseFloat(frameStyles.paddingBottom);
    const rootRect = dataTableRoot.getBoundingClientRect();
    const scrollOwnerRect = scrollOwner.getBoundingClientRect();

    if (contract.viewportMode === "fill") {
      await expect(Math.abs(rootRect.bottom - frameContentBottom)).toBeLessThanOrEqual(1);
      await expect(Math.abs(scrollOwnerRect.bottom - rootRect.bottom)).toBeLessThanOrEqual(1);
    } else {
      await expect(rootRect.height).toBeLessThan(scrollOwner.scrollHeight + 1);
      if (contract.rowCount !== "many") {
        await expect(rootRect.height).toBeLessThan(
          frameRect.height -
            Number.parseFloat(frameStyles.paddingTop) -
            Number.parseFloat(frameStyles.paddingBottom),
        );
      }
      await expect(scrollOwner.scrollHeight - scrollOwner.clientHeight).toBeLessThanOrEqual(1);
    }

    if (!contract.loading && contract.rowCount === "many" && contract.viewportMode === "fill") {
      await expect(scrollOwner.scrollHeight).toBeGreaterThan(scrollOwner.clientHeight);
      const stickyHeader = dataTableRoot.querySelector(
        '[data-slot="table-header"]',
      ) as HTMLElement | null;
      if (!stickyHeader) throw new Error("Sticky table header is missing.");
      await expect(getComputedStyle(stickyHeader).position).toBe("sticky");
    }

    if (contract.pinned) {
      const pinnedCell = dataTableRoot.querySelector(
        '[data-emr-column-pinned="left"]',
      ) as HTMLElement | null;
      if (!pinnedViewport || !pinnedCell) {
        throw new Error("Pinned viewport contract targets are missing.");
      }
      await expect(getComputedStyle(tableContainer).overflowX).toBe("visible");
      await expect(getComputedStyle(pinnedCell).position).toBe("sticky");

      await waitFor(() => {
        expect(pinnedViewport.querySelector('[data-emr-pinned-table-scrollbar="horizontal"]')).not.toBeNull();
      });
      const horizontalScrollbar = pinnedViewport.querySelector<HTMLElement>('[data-emr-pinned-table-scrollbar="horizontal"]');
      if (!horizontalScrollbar) {
        throw new Error("Pinned horizontal scrollbar is missing.");
      }
      if (contract.viewportMode === "fill") {
        await expect(
          Math.abs(
            horizontalScrollbar.getBoundingClientRect().bottom - rootRect.bottom,
          ),
        ).toBeLessThanOrEqual(1);
      }
    }
  } finally {
    storyFrame.style.width = originalFrameWidth;
  }
}

const viewportContractPlay: Story["play"] = async ({ canvasElement, args }) => {
  await assertViewportContract(canvasElement, args);
};
export const FillNonPinnedZeroRows: Story = {
  args: {
    pinned: false,
    rowCount: "zero",
    viewportMode: "fill",
  },
  play: viewportContractPlay,
};

export const FillNonPinnedOneRow: Story = {
  args: {
    pinned: false,
    rowCount: "one",
    viewportMode: "fill",
  },
  play: viewportContractPlay,
};

export const FillNonPinnedManyRows: Story = {
  args: {
    pinned: false,
    rowCount: "many",
    viewportMode: "fill",
  },
  play: viewportContractPlay,
};

export const FillPinnedZeroRows: Story = {
  args: {
    pinned: true,
    rowCount: "zero",
    viewportMode: "fill",
  },
  play: viewportContractPlay,
};

export const FillPinnedOneRow: Story = {
  args: {
    pinned: true,
    rowCount: "one",
    viewportMode: "fill",
  },
  play: viewportContractPlay,
};

export const FillPinnedManyRows: Story = {
  args: {
    pinned: true,
    rowCount: "many",
    viewportMode: "fill",
  },
  play: viewportContractPlay,
};

export const ContentNonPinnedZeroRows: Story = {
  args: {
    pinned: false,
    rowCount: "zero",
    viewportMode: "content",
  },
  play: viewportContractPlay,
};

export const ContentNonPinnedOneRow: Story = {
  args: {
    pinned: false,
    rowCount: "one",
    viewportMode: "content",
  },
  play: viewportContractPlay,
};

export const ContentNonPinnedManyRows: Story = {
  args: {
    pinned: false,
    rowCount: "many",
    viewportMode: "content",
  },
  play: viewportContractPlay,
};

export const ContentPinnedZeroRows: Story = {
  args: {
    pinned: true,
    rowCount: "zero",
    viewportMode: "content",
  },
  play: viewportContractPlay,
};

export const ContentPinnedOneRow: Story = {
  args: {
    pinned: true,
    rowCount: "one",
    viewportMode: "content",
  },
  play: viewportContractPlay,
};

export const ContentPinnedManyRows: Story = {
  args: {
    pinned: true,
    rowCount: "many",
    viewportMode: "content",
  },
  play: viewportContractPlay,
};

export const AllColumnsScroll: Story = {
  play: async ({ canvasElement }) => {
    assertRowDivider(
      canvasElement.querySelector(
        'tbody tr[data-emr-data-table-row="true"]:first-child td[data-column-id="owner"]',
      ),
      "Scrollable",
    );
    const canvas = within(canvasElement);
    canvas.getAllByRole("button", { name: "보기" })[0].focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("테이블 작업 결과")).toHaveTextContent("1회 · 요검사: 보기");
  },
};

export const LeftAndRightPinned: Story = {
  args: { pinned: true },
  play: async ({ canvasElement }) => {
    const storyFrame = canvasElement.firstElementChild as HTMLElement | null;
    if (!storyFrame) {
      throw new Error("Pinned EmrDataTable story frame is missing.");
    }
    const originalFrameWidth = storyFrame.style.width;
    try {
    storyFrame.style.width = "720px";
    const viewport = canvasElement.querySelector(
      '[data-emr-pinned-table-viewport="true"]',
    ) as HTMLElement | null;
    const scrollOwner = viewport?.querySelector(
      '[data-emr-pinned-table-scroll-owner="true"]',
    ) as HTMLElement | null;
    await waitFor(() => {
      expect(viewport?.querySelector('[data-emr-pinned-table-scrollbar="horizontal"]')).not.toBeNull();
    });
    const horizontalScrollbar = viewport?.querySelector<HTMLElement>('[data-emr-pinned-table-scrollbar="horizontal"]');
    const tableContainer = viewport?.querySelector(
      '[data-slot="table-container"]',
    ) as HTMLElement | null;
    const leftDimmer = viewport?.querySelector(
      '[data-emr-pinned-table-dimmer="true"][data-emr-pinned-side="left"]',
    ) as HTMLElement | null;
    const rightDimmer = viewport?.querySelector(
      '[data-emr-pinned-table-dimmer="true"][data-emr-pinned-side="right"]',
    ) as HTMLElement | null;

    if (
      !viewport ||
      !scrollOwner ||
      !horizontalScrollbar ||
      !tableContainer ||
      !leftDimmer ||
      !rightDimmer
    ) {
      throw new Error("Pinned EmrDataTable scroll targets are missing.");
    }

    await waitFor(() => {
      expect(viewport).not.toHaveAttribute("data-overflow-x-start");
      expect(viewport).toHaveAttribute("data-overflow-x-end");
      expect(getComputedStyle(leftDimmer).opacity).toBe("0");
      expect(getComputedStyle(rightDimmer).opacity).toBe("1");
    });

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

    const maximumScroll = scrollOwner.scrollWidth - scrollOwner.clientWidth;
    scrollOwner.scrollLeft = maximumScroll / 2;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await waitFor(() => {
      expect(viewport).toHaveAttribute("data-overflow-x-start");
      expect(viewport).toHaveAttribute("data-overflow-x-end");
      expect(getComputedStyle(leftDimmer).opacity).toBe("1");
      expect(getComputedStyle(rightDimmer).opacity).toBe("1");
    });

    scrollOwner.scrollLeft = maximumScroll;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await waitFor(() => {
      expect(scrollOwner.scrollLeft).toBeGreaterThan(0);
      expect(viewport).toHaveAttribute("data-overflow-x-start");
      expect(viewport).not.toHaveAttribute("data-overflow-x-end");
      expect(getComputedStyle(leftDimmer).opacity).toBe("1");
      expect(getComputedStyle(rightDimmer).opacity).toBe("0");
    });

    storyFrame.style.width = "1600px";
    scrollOwner.scrollLeft = 0;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await waitFor(() => {
      expect(viewport).not.toHaveAttribute("data-overflow-x-start");
      expect(viewport).not.toHaveAttribute("data-overflow-x-end");
      expect(getComputedStyle(leftDimmer).opacity).toBe("0");
      expect(getComputedStyle(rightDimmer).opacity).toBe("0");
    });
    } finally {
      storyFrame.style.width = originalFrameWidth;
    }
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    await assertViewportContract(canvasElement, {
      loading: true,
      pinned: false,
      rowCount: "many",
      viewportMode: "fill",
    });
  },
};

export const Selection: Story = {
  args: { selectable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const all = canvas.getByRole("checkbox", { name: "샘플 전체 선택" });
    const first = canvas.getByRole("checkbox", { name: "요검사 선택" });
    first.focus(); await userEvent.keyboard(" ");
    await waitFor(() => expect(all).toHaveAttribute("aria-checked", "mixed"));
    const bar = await canvas.findByRole("toolbar", { name: "선택 행 작업" });
    await waitFor(() => { expect(bar).toBeVisible(); expect(bar).toHaveTextContent("1개 선택"); });
    await userEvent.click(within(bar).getByRole("button", { name: "선택 작업" }));
    await expect(canvas.getByLabelText("테이블 작업 결과")).toHaveTextContent("1개 선택: 선택 작업");
    await userEvent.click(all);
    await expect(all).toBeChecked();
    await waitFor(() => expect(bar).toHaveTextContent("11개 선택"));
    await userEvent.click(within(bar).getByRole("button", { name: "선택 해제" }));
    await waitFor(() => expect(canvas.queryByRole("toolbar", { name: "선택 행 작업" })).not.toBeInTheDocument());
    await expect(first).not.toBeChecked();
  },
};

export const ContextualActions: Story = {
  args: { showContextualActions: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    canvas.getByRole("button", { name: "요검사 보조 작업" }).focus();
    await userEvent.keyboard("{Enter}");
    const item = await body.findByRole("menuitem", { name: "상세 보기" });
    await waitFor(() => expect(item).toBeVisible());
    await userEvent.click(item);
    await expect(canvas.getByLabelText("테이블 작업 결과")).toHaveTextContent("요검사: 상세 보기");
  },
};

export const DetailActiveRow: Story = {
  args: { activeDetailRow: true, showContextualActions: true },
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector('tr[data-detail-active="true"]');
    await expect(row).toHaveAttribute("aria-current", "true");
    await expect(row).toHaveTextContent("요검사");
  },
};

export const Sorting: Story = {
  args: { sortable: true },
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>('th[data-column-id="name"]');
    if (!header) throw new Error("Name sort header is missing.");
    const sort = within(header).getByRole("button");
    const names = () => Array.from(canvasElement.querySelectorAll('tbody tr[data-emr-data-table-row="true"] td[data-column-id="name"]')).map(cell => cell.textContent);
    sort.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "ascending"));
    const ascending = names();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(header).toHaveAttribute("aria-sort", "descending"));
    await expect(names()).toEqual([...ascending].reverse());
  },
};

export const Resizing: Story = {
  args: { pinned: true, resizable: true },
  play: async ({ canvasElement }) => {
    const storyFrame = canvasElement.firstElementChild as HTMLElement;
    const originalFrameWidth = storyFrame.style.width;
    try {
      await assertViewportContract(canvasElement, {
        pinned: true,
        rowCount: "many",
        viewportMode: "fill",
      });
      const pinnedBoundaryHeader = canvasElement.querySelector(
        'th[data-column-id="name"][data-emr-column-pinned="left"][data-emr-pinned-edge="true"]',
      );
      const pinnedBoundaryGrip = pinnedBoundaryHeader?.querySelector(
        'button[aria-label="이름 컬럼 너비 조절"]',
      ) as HTMLButtonElement | null;
      const scrollingGrip = canvasElement.querySelector(
        'th[data-column-id="owner"] button[aria-label="담당 컬럼 너비 조절"]',
      ) as HTMLButtonElement | null;

      if (!pinnedBoundaryGrip || !scrollingGrip) {
        throw new Error("Resizable EmrDataTable story grips are missing.");
      }

      await waitFor(() => {
        expect(getComputedStyle(pinnedBoundaryGrip).width).toBe("8px");
        expect(getComputedStyle(pinnedBoundaryGrip).cursor).toBe("col-resize");
        expect(getComputedStyle(pinnedBoundaryGrip, "::before").opacity).toBe(
          "0",
        );
        expect(getComputedStyle(scrollingGrip, "::before").opacity).toBe("1");
      });

      storyFrame.style.width = "1900px";
      for (const [key, expectedWidth] of [["ArrowRight", 188], ["ArrowLeft", 180]] as const) {
        pinnedBoundaryGrip.focus();
        await userEvent.keyboard(`{${key}}`);
        await waitFor(() => {
          expect(Math.abs(pinnedBoundaryHeader!.getBoundingClientRect().width - expectedWidth)).toBeLessThanOrEqual(1);
          const bodyCell = canvasElement.querySelector(
            'tbody tr:first-child td[data-column-id="name"]',
          );
          expect(Math.abs(bodyCell!.getBoundingClientRect().width - expectedWidth)).toBeLessThanOrEqual(1);
        });
      }
    } finally {
      storyFrame.style.width = originalFrameWidth;
    }
  },
};

export const AdditionalRows: Story = {
  args: { pinned: true, rowCount: "many" },
  play: async ({ canvasElement }) => {
    const extraRow = canvasElement.querySelector('tr[data-emr-data-table-extra-row="true"]');
    await expect(extraRow).toHaveTextContent(" 추가 행 슬롯: 7개 컬럼".trim());
    await expect(extraRow?.querySelector("td")).toHaveAttribute("colspan", "7");
  },
};

export const ViewportRightRowOverlay: Story = {
  args: { pinned: true, rowCount: "many", rowOverlay: true },
  play: async ({ canvasElement }) => {
    const storyFrame = canvasElement.firstElementChild as HTMLElement | null;
    if (!storyFrame) {
      throw new Error("Row overlay EmrDataTable story frame is missing.");
    }
    const originalFrameWidth = storyFrame.style.width;
    try {
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
    await userEvent.keyboard("{Enter}");
    await expect(within(canvasElement).getByLabelText("테이블 작업 결과")).toHaveTextContent("요검사: 상세");

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

    } finally {
      storyFrame.style.width = originalFrameWidth;
    }
  },
};

export const SelectionActionBarViewportPlacement: Story = {
  args: { pinned: true, rowOverlay: true, selectedRows: true },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-emr-data-table-selection-action-bar="true"]')).not.toBeNull();
    });
    const actionBar = canvasElement.querySelector<HTMLElement>('[data-emr-data-table-selection-action-bar="true"]');
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
  args: { rowCount: "many", rowOverlay: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    const disabled = canvas.getByRole("button", { name: "추가 샘플 1 상세" });
    await expect(disabled).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "추가 샘플 1 수정" })).toBeDisabled();
    const edit = canvas.getByRole("button", { name: "요검사 수정" });
    edit.focus();
    await waitFor(() => expect(getComputedStyle(edit.closest('[data-emr-data-table-row-overlay="true"]')!).opacity).toBe("1"));
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByLabelText("테이블 작업 결과")).toHaveTextContent("요검사: 수정");
    const disabledRowMenu = canvas.getByRole("button", { name: "추가 샘플 1 더보기" });
    disabledRowMenu.focus();
    await waitFor(() => expect(getComputedStyle(disabledRowMenu.closest('[data-emr-data-table-row-overlay="true"]')!).opacity).toBe("1"));
    await userEvent.keyboard("{Enter}");
    const history = await body.findByRole("menuitem", { name: "이력 보기" });
    await waitFor(() => expect(history).toBeVisible());
    await expect(history).toHaveAttribute("aria-disabled", "true");
    await expect(body.getByRole("menuitem", { name: "삭제" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");
  },
};

export const TouchRowOverlayFallback: Story = {
  args: { rowOverlay: true },
  parameters: { docs: { description: { story: "실제 공유 테이블의 overlay CSS를 사용합니다. 실제 coarse pointer 브라우저에서는 focus/hover 전에 overlay 상시 표시를 확인하고 터치 펼치기 버튼을 실행합니다. 기존 키보드 메뉴 결과도 함께 검증합니다. media 조건을 합성하거나 제품 CSS를 변경하지 않습니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      const overlay = canvasElement.querySelector<HTMLElement>('[data-emr-data-table-row-overlay="true"]');
      if (!overlay) throw new Error("Touch row overlay is missing.");
      await waitFor(() => {
        expect(getComputedStyle(overlay).opacity).toBe("1");
        expect(getComputedStyle(overlay).pointerEvents).toBe("auto");
      });
      const trigger = canvas.getByRole("button", { name: "요검사 행 작업 펼치기" });
      await expect(trigger).toBeVisible();
      await userEvent.click(trigger);
      await waitFor(() => expect(overlay).toHaveAttribute("data-touch-open", "true"));
    }
    canvas.getByRole("button", { name: "요검사 더보기" }).focus();
    await userEvent.keyboard("{Enter}");
    const history = await body.findByRole("menuitem", { name: "이력 보기" });
    await waitFor(() => expect(history).toBeVisible());
    await userEvent.click(history);
    await expect(canvas.getByLabelText("테이블 작업 결과")).toHaveTextContent("요검사: 이력 보기");
    if (coarse) {
      await userEvent.click(canvas.getByRole("button", { name: "요검사 행 작업 접기" }));
      await waitFor(() => expect(canvasElement.querySelector('[data-emr-data-table-row-overlay="true"]')).not.toHaveAttribute("data-touch-open"));
    }
  },
};

export const CustomerCaller: Story = {
  beforeEach: prepareCustomerCaller,
  parameters: { ...customerCallerParameters, controls: { disable: true }, docs: { story: { inline: false, height: "740px" }, description: { story: "Actual CustomerDataTable with actual domain row/column factories. This caller owns filtering, selection and row actions. Other children remain shared API viewport/geometry contracts." } } },
  render: () => <ActualCustomerTable />,
  play: async ({ canvasElement }) => {
    await verifyCustomerHeader(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("header-customer-row-header-patient-a"));
    await expect(canvas.getByLabelText("고객 행 열기")).toHaveTextContent("합성 동물 A");
  },
};
