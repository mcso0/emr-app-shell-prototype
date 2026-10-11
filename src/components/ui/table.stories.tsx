import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChartAssessmentTable, type ChartAssessmentDiagnosis } from "@/features/chart/components/chart-assessment-table";
import { EmrEmptyState } from "@/components/emr/empty-state";

import {
  EmrPinnedTableViewport,
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

const syntheticDiagnoses: ChartAssessmentDiagnosis[] = [
  { id: "synthetic-b", encounterId: "synthetic-encounter", diagnosisText: "나 합성 진단", diagnosisType: "suspected", catalogMatched: true, isPrimary: false, systemLabel: "합성 계통", createdByUserId: "synthetic-user", createdAt: "2026-10-11T00:00:00Z", sortOrder: 0 },
  { id: "synthetic-a", encounterId: "synthetic-encounter", diagnosisText: "가 합성 진단", diagnosisType: "confirmed", catalogMatched: false, isPrimary: true, systemLabel: "미분류", createdByUserId: "synthetic-user", createdAt: "2026-10-11T00:00:00Z", sortOrder: 1 },
];
function AssessmentTableCaller() {
  const [rows, setRows] = useState(syntheticDiagnoses);
  const [receipt, setReceipt] = useState("변경 없음");
  const update = (id: string, patch: Partial<ChartAssessmentDiagnosis>, action: string) => { setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)); setReceipt(`${action}:${id}`); };
  return <div className="grid w-full max-w-5xl gap-3"><div className="h-[300px] min-w-[680px]">
    <ChartAssessmentTable diagnoses={rows} loading={false} writeDisabled={false} getVeterinarianName={() => "합성 수의사"}
      onPrimaryChange={(id, checked) => update(id, { isPrimary: checked }, "primary")}
      onConfirmedChange={(id, checked) => { const row = rows.find((value) => value.id === id); update(id, { diagnosisType: checked ? "confirmed" : row?.diagnosisType === "confirmed" ? "suspected" : row?.diagnosisType }, "confirmed"); }}
      onClosedChange={(id, checked) => { const row = rows.find((value) => value.id === id); update(id, { closedAt: checked ? row?.closedAt ?? "2026-10-11T00:00:00Z" : undefined, closedByUserId: checked ? row?.closedByUserId ?? row?.createdByUserId : undefined }, "closed"); }}
      onRemove={(id) => { setRows((current) => current.filter((row) => row.id !== id)); setReceipt(`remove:${id}`); }}
      loadingState={<p role="status">합성 진단 불러오는 중</p>}
      emptyState={<EmrEmptyState kind="no-data" priority="supporting" surface="table" title="선택된 진단이 없습니다." />} />
  </div><output aria-label="합성 진단 변경">{receipt}</output></div>;
}

function PinnedTableExample({
  density,
  roundedHeader = false,
}: Pick<TableStoryArgs, "density"> & { roundedHeader?: boolean }) {
  const [selected, setSelected] = useState<string[]>(["B"]);
  const [headerCount, setHeaderCount] = useState(0);
  const setRowSelected = (id: string, checked: boolean) => setSelected((current) => checked ? [...current.filter((value) => value !== id), id] : current.filter((value) => value !== id));
  return (
    <EmrPinnedTableWorkspace
      className="w-[520px] overflow-hidden"
      data-testid="pinned-table-workspace"
      identityTextInset={48}
      selectionColumnWidth={44}
    >
      <EmrPinnedTableViewport pinnedColumnWidth={224}>
      <Table
        containerStyle={{ overflow: "visible" }}
        data-testid="pinned-table"
        density={density}
        layout="scroll"
        minWidth={840}
        overscrollAxes="none"
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
              <EmrTableCheckbox aria-label="전체 선택" checked={selected.length === 2} indeterminate={selected.length > 0 && selected.length < 2} onCheckedChange={(checked) => setSelected(checked ? ["A", "B"] : [])} />
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
              {roundedHeader ? (
                <button
                  type="button"
                  data-testid="pinned-scroll-header-surface"
                  onClick={() => setHeaderCount((value) => value + 1)}
                  className="inline-flex min-h-6 items-center rounded-lg bg-[var(--emr-state-hover)] px-2.5 py-1 text-xs"
                >
                  상태
                </button>
              ) : (
                <span data-testid="pinned-scroll-header-surface">상태</span>
              )}
            </EmrTableHeaderCell>
            <TableHead>담당</TableHead>
            <TableHead pinned="right" pinnedOffset={0} pinnedEdge>
              작업
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state={selected.includes("A") ? "selected" : undefined}>
            <EmrTableSelectionCell
              className="w-11 min-w-11 max-w-11"
              controlVisibility="contextual"
              pinned="left"
              pinnedOffset={0}
            >
              <EmrTableCheckbox aria-label="합성 환자 A 선택" checked={selected.includes("A")} onCheckedChange={(checked) => setRowSelected("A", Boolean(checked))} />
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
          <TableRow data-state={selected.includes("B") ? "selected" : undefined}>
            <EmrTableSelectionCell
              className="w-11 min-w-11 max-w-11"
              controlVisibility="contextual"
              pinned="left"
              pinnedOffset={0}
            >
              <EmrTableCheckbox aria-label="합성 환자 B 선택" checked={selected.includes("B")} onCheckedChange={(checked) => setRowSelected("B", Boolean(checked))} />
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
      </EmrPinnedTableViewport>
      <output aria-label="합성 테이블 선택">{selected.length ? selected.join(" · ") : "선택 없음"}</output>
      {roundedHeader ? <output aria-label="합성 헤더 작업">실행 {headerCount}회</output> : null}
    </EmrPinnedTableWorkspace>
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
  render: () => <AssessmentTableCaller />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 ChartAssessmentTable의 Table·헤더·체크박스·행·삭제 구성을 사용합니다. chart/module의 행별 주진단·확진·종결 변경을 로컬 합성 행에 반영합니다. 정렬은 원본이 처리합니다. 임상 판단·저장·서버 권한은 검증하지 않습니다. 기존 고객 실제 목록과 차트 finance 예제는 그대로 유지합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "진단명 정렬" }));
    await waitFor(() => expect(canvasElement.querySelector('[data-slot="chart-assessment-table-row"]')).toHaveTextContent("가 합성 진단"));
    await userEvent.click(canvas.getByRole("button", { name: "진단명 정렬" }));
    await waitFor(() => expect(canvasElement.querySelector('[data-slot="chart-assessment-table-row"]')).toHaveTextContent("나 합성 진단"));
    for (const [name, action] of [["주진단", "primary"], ["확진", "confirmed"], ["종결", "closed"]]) {
      const control = canvas.getByRole("checkbox", { name: `나 합성 진단 ${name}` });
      await userEvent.click(control); await waitFor(() => { expect(control).toHaveAttribute("aria-checked", "true"); expect(canvas.getByLabelText("합성 진단 변경")).toHaveTextContent(`${action}:synthetic-b`); });
    }
    for (const label of ["나 합성 진단", "가 합성 진단"]) {
      const button = canvas.getByRole("button", { name: `${label} 삭제` });
      if (label === "나 합성 진단") {
        await userEvent.hover(button.closest("tr")!); await userEvent.click(button);
      } else {
        button.focus(); await expect(button).toHaveFocus();
        await waitFor(() => expect(getComputedStyle(button.closest('[data-slot="chart-assessment-delete-overlay"]')!).pointerEvents).toBe("auto"));
        await userEvent.keyboard("{Enter}");
      }
      await waitFor(() => expect(canvas.queryByRole("checkbox", { name: `${label} 주진단` })).not.toBeInTheDocument());
    }
    // The source empty state enters with a 150ms fade. Wait for its visible
    // outcome after the last row is removed; DOM presence alone is earlier.
    await waitFor(() => {
      expect(canvas.getByText("선택된 진단이 없습니다.")).toBeVisible();
      expect(canvas.getByRole("table", { name: "진단명 목록" })).toBeVisible();
    });
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
      styles.overscrollBehaviorY !== "none"
    ) {
      throw new Error(
        "The current app-wide CSS blocks overscroll on both axes; the story must reflect that source behavior.",
      );
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: column 수가 많아 최소 너비를 유지해야 할 때. 쓰지 말아야 할 때: 작은 표를 불필요하게 가로 스크롤로 숨길 때. 현재 globals.css의 스크롤 뷰포트 대상 overscroll-behavior: none !important가 Table의 horizontal 기본값보다 우선하여 양축의 스크롤 연결을 막습니다. 이 예제는 현재 main 동작을 검증하며 세로 스크롤 연결 개선을 증명하지 않습니다.",
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
    controls: { disable: true },
    docs: {
      description: {
        story:
          "세로·가로 스크롤을 모두 테이블이 소유하는 경우에만 두 축을 차단하는 재사용 API 예시.",
      },
    },
  },
};

function pinnedColumnsPlay(roundedHeader: boolean): NonNullable<Story["play"]> {
  return async ({ canvasElement }) => {
    const table = canvasElement.querySelector(
      '[data-testid="pinned-table"]',
    ) as HTMLTableElement | null;
    const container = table?.closest<HTMLElement>(
      '[data-emr-pinned-table-scroll-owner="true"]',
    );
    const viewport = table?.closest(
      '[data-emr-pinned-table-viewport="true"]',
    ) as HTMLDivElement | null;
    const dimmer = viewport?.querySelector(
      '[data-emr-pinned-table-dimmer="true"]',
    ) as HTMLDivElement | null;
    const divider = viewport?.querySelector(
      '[data-emr-pinned-table-divider="true"]',
    ) as HTMLDivElement | null;
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
      !viewport ||
      !dimmer ||
      !divider ||
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

    if (roundedHeader) {
      if (!(firstScrollHeaderSurface instanceof HTMLButtonElement)) {
        throw new Error("Rounded-header fixture must contain its test button.");
      }
    } else if (
      firstScrollHeader.querySelector("button") ||
      firstScrollHeaderSurface.tagName !== "SPAN" ||
      getComputedStyle(firstScrollHeaderSurface).borderRadius !== "0px" ||
      getComputedStyle(firstScrollHeaderSurface).backgroundColor !== "rgba(0, 0, 0, 0)"
    ) {
      throw new Error("Default pinned status header must remain plain text.");
    }

    const initialLeftPositions = leftCells.map(
      (cell) => cell.getBoundingClientRect().left,
    );
    const initialDimmerLeft = dimmer.getBoundingClientRect().left;
    const initialDividerLeft = divider.getBoundingClientRect().left;
    container.scrollLeft = 240;
    await waitFor(() => { expect(container.scrollLeft).toBeGreaterThan(0); expect(viewport).toHaveAttribute("data-overflow-x-start"); });

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
      Math.abs(dimmer.getBoundingClientRect().left - initialDimmerLeft) > 1 ||
      Math.abs(divider.getBoundingClientRect().left - initialDividerLeft) > 1
    ) {
      throw new Error("Pinned boundary layers moved during horizontal scroll.");
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
    await waitFor(() => { expect(container.scrollLeft).toBe(0); expect(viewport).not.toHaveAttribute("data-overflow-x-start"); });
    if (
      container.scrollLeft !== 0 ||
      viewport.hasAttribute("data-overflow-x-start")
    ) {
      throw new Error("Pinned inset check did not reach the scroll origin.");
    }

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
        ((label !== "header" || roundedHeader) &&
          getComputedStyle(surface).borderRadius === "0px")
      ) {
        throw new Error(
          `Pinned ${label} rounded content surface is clipped by its cell.`,
        );
      }
    }

    for (const surface of [
      firstScrollBodySurface,
      selectedScrollBodySurface,
    ]) {
      const styles = getComputedStyle(surface);
      if (
        styles.paddingInlineStart !== "8px" ||
        styles.paddingInlineEnd !== "8px"
      ) {
        throw new Error(
          "Pinned boundary normalization changed the badge's inner padding.",
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
      if (edgeStyles.boxShadow !== "none" || edgeStyles.overflow !== "hidden") {
        throw new Error(
          `Pinned ${label} edge still owns a cell shadow or clips incorrectly.`,
        );
      }
    }

    if (getComputedStyle(dimmer).opacity !== "0") {
      throw new Error("Pinned left dimmer must be hidden at the scroll origin.");
    }
    try {
      container.scrollLeft = 120;
      await waitFor(() => { expect(container.scrollLeft).toBeGreaterThan(0); expect(viewport).toHaveAttribute("data-overflow-x-start"); expect(getComputedStyle(dimmer).opacity).toBe("1"); });
      if (
        container.scrollLeft <= 0 ||
        !viewport.hasAttribute("data-overflow-x-start")
      ) {
        throw new Error("Pinned dimmer check did not reach a scrolled viewport.");
      }

      const viewportRect = viewport.getBoundingClientRect();
      const dimmerRect = dimmer.getBoundingClientRect();
      const dividerRect = divider.getBoundingClientRect();
      const dimmerStyles = getComputedStyle(dimmer);
      const dividerStyles = getComputedStyle(divider);
      if (
        dimmerStyles.position !== "absolute" ||
        dimmerStyles.width !== "6px" ||
        dimmerStyles.backgroundColor !== "rgba(0, 0, 0, 0.04)" ||
        dimmerStyles.opacity !== "1" ||
        dimmerStyles.pointerEvents !== "none" ||
        Math.abs(dimmerRect.left - viewportRect.left - 224) > 1 ||
        Math.abs(dimmerRect.height - viewportRect.height) > 1 ||
        Number.parseInt(dimmerStyles.zIndex, 10) <= 12
      ) {
        throw new Error(
          "Pinned dimmer does not match the fixed 6px black-alpha-4 Figma layer.",
        );
      }
      if (
        dividerStyles.position !== "absolute" ||
        dividerStyles.width !== "1px" ||
        dividerStyles.backgroundColor === "rgba(0, 0, 0, 0)" ||
        dividerStyles.pointerEvents !== "none" ||
        Math.abs(dividerRect.left - viewportRect.left - 223) > 1 ||
        Math.abs(dividerRect.height - viewportRect.height) > 1 ||
        Number.parseInt(dividerStyles.zIndex, 10) <=
          Number.parseInt(dimmerStyles.zIndex, 10)
      ) {
        throw new Error("Pinned divider is not fixed above the dimmer layer.");
      }
    } finally {
      container.scrollLeft = 0;
      await waitFor(() => { expect(container.scrollLeft).toBe(0); expect(viewport).not.toHaveAttribute("data-overflow-x-start"); });
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
    const canvas = within(canvasElement);
    const all = canvas.getByRole("checkbox", { name: "전체 선택" });
    await expect(all).toHaveAttribute("aria-checked", "mixed");
    await userEvent.click(all);
    await waitFor(() => { expect(all).toHaveAttribute("aria-checked", "true"); expect(table.querySelectorAll('tbody tr[data-state="selected"]')).toHaveLength(2); });
    await userEvent.click(canvas.getByRole("checkbox", { name: "합성 환자 A 선택" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 테이블 선택")).toHaveTextContent("B"));
    await userEvent.click(canvas.getByRole("checkbox", { name: "합성 환자 B 선택" }));
    await waitFor(() => { expect(canvas.getByLabelText("합성 테이블 선택")).toHaveTextContent("선택 없음"); expect(table.querySelectorAll('tbody tr[data-state="selected"]')).toHaveLength(0); });
    if (roundedHeader) { await userEvent.click(firstScrollHeaderSurface); await expect(canvas.getByLabelText("합성 헤더 작업")).toHaveTextContent("실행 1회"); }
  };
}

export const PinnedColumns: Story = {
  argTypes: { layout: { control: false, table: { disable: true } }, minWidth: { control: false, table: { disable: true } }, pinning: { control: false, table: { disable: true } }, showCaption: { control: false, table: { disable: true } } },
  render: (args) => <PinnedTableExample density={args.density} />,
  play: pinnedColumnsPlay(false),
  parameters: {
    docs: {
      description: {
        story: "일반 텍스트 헤더와 좌우 고정 열, 10px 경계 여백, 단일 스크롤 영역을 검증합니다.",
      },
    },
  },
};

export const PinnedColumnsRoundedContent: Story = {
  argTypes: { layout: { control: false, table: { disable: true } }, minWidth: { control: false, table: { disable: true } }, pinning: { control: false, table: { disable: true } }, showCaption: { control: false, table: { disable: true } } },
  render: (args) => <PinnedTableExample density={args.density} roundedHeader />,
  play: pinnedColumnsPlay(true),
  parameters: {
    docs: {
      description: {
        story: "둥근 헤더 버튼과 본문 배지의 경계 잘림 및 내부 여백을 검사하는 전용 예시입니다. 일반 헤더 표현은 Pinned Columns를 참고하세요.",
      },
    },
  },
};

export const EmptyRows: Story = {
  argTypes: { minWidth: { control: false, table: { disable: true } }, pinning: { control: false, table: { disable: true } }, showCaption: { control: false, table: { disable: true } } },
  play: async ({ canvas }) => { await expect(canvas.getByRole("cell", { name: "조건에 맞는 샘플 행이 없습니다." })).toHaveAttribute("colspan", "2"); await expect(canvas.getAllByRole("columnheader")).toHaveLength(2); },
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
