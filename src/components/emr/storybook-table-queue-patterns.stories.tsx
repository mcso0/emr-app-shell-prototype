import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { EmrConfirmDialogContent } from "./confirm-dialog-content";
import { EmrEmptyState } from "./empty-state";
import { EmrRowActionMenu } from "./row-action-menu";
import { EmrStatusBadge } from "./status-badge";
import { EmrTableCheckbox } from "./table-checkbox";
import { EmrTableCellText, EmrTableHeaderCell, EmrTableSelectionCell, EmrTableSelectionHeaderCell } from "./table-primitives";
import { EmrTableFilterBuilder } from "./table-filter-builder";
import { createInitialEmrTableFilterBuilderModel, filterRowsByEmrTableFilterBuilder } from "./table-filter-builder-model";
import { sampleFilterFields } from "./table-filter.stories.fixture";

import { StorybookTableQueuePatterns, type StorybookTableQueuePatternsProps } from "./storybook-table-queue-patterns";


const patternRows = [
  { id: "sample-order-1", request: "샘플 혈액검사", status: "요청", assignee: "담당 미정", time: "09:10" },
  { id: "sample-order-2", request: "샘플 영상 판독", status: "진행중", assignee: "샘플 스태프", time: "09:25" },
  { id: "sample-order-3", request: "샘플 처치 확인", status: "완료", assignee: "샘플 스태프", time: "09:40" },
];
function PatternShell({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl rounded-[var(--clair-radius-md)] border border-border bg-card p-4">{children}</div>;
}
function ActionPattern() {
  const [receipt, setReceipt] = useState("없음"), [detail, setDetail] = useState(false), [cancel, setCancel] = useState(false), [visible, setVisible] = useState(true);
  return <PatternShell><Table density="standard" layout="fill" minWidth={560}>
    <TableHeader><TableRow><EmrTableHeaderCell>업무</EmrTableHeaderCell><EmrTableHeaderCell>상태</EmrTableHeaderCell><EmrTableHeaderCell align="right">작업</EmrTableHeaderCell></TableRow></TableHeader>
    <TableBody>{visible ? <TableRow><TableCell><EmrTableCellText>샘플 재확인 요청</EmrTableCellText></TableCell><TableCell><EmrStatusBadge label="재요청" /></TableCell><TableCell className="text-right"><EmrRowActionMenu ariaLabel="샘플 재확인 요청 작업" items={[
      { key: "open", label: "상세 보기", description: "현재 행의 합성 상세 화면을 엽니다.", onSelect: () => { setDetail(true); setReceipt("상세 보기"); } },
      { key: "assign", label: "담당 지정", description: "담당자를 지정해야 할 때 사용합니다.", onSelect: () => setReceipt("담당: 합성 스태프") },
      { key: "cancel", label: "요청 취소", description: "되돌리기 어려운 작업에는 확인 단계를 둡니다.", variant: "destructive", onSelect: () => setCancel(true) },
    ]} /></TableCell></TableRow> : <TableRow><TableCell colSpan={3}>합성 요청이 취소되었습니다.</TableCell></TableRow>}</TableBody>
  </Table>
  {detail ? <section aria-label="합성 상세" className="mt-3 rounded border p-3">샘플 재확인 요청 · 재요청<Button size="sm" variant="ghost" onClick={() => setDetail(false)}>합성 상세 닫기</Button></section> : null}
  <output aria-label="행 작업 결과">{receipt}</output>
  <Dialog open={cancel} onOpenChange={setCancel}><EmrConfirmDialogContent title="합성 요청을 취소할까요?" description="Storybook 합성 행만 숨깁니다." cancelLabel="계속 보기" confirmLabel="합성 요청 취소" onCancel={() => setCancel(false)} onConfirm={() => { setVisible(false); setDetail(false); setCancel(false); setReceipt("요청 취소"); }} /></Dialog>
  </PatternShell>;
}
function ToolbarPattern() {
  const [value, setValue] = useState("all"), [query, setQuery] = useState(""), [search, setSearch] = useState(false), [open, setOpen] = useState(false);
  const [model, setModel] = useState(() => createInitialEmrTableFilterBuilderModel("pattern-filter"));
  const records = Array.from({ length: 12 }, (_, index) => ({ id: `pattern-${index}`, label: `샘플 업무 ${index + 1}`, owner: "샘플 스태프", status: index < 5 ? "waiting" : index < 9 ? "active" : "done" }));
  const filtered = filterRowsByEmrTableFilterBuilder(records, model, sampleFilterFields).filter(row => (value === "all" || row.status === value) && row.label.includes(query));
  const reset = () => { setValue("all"); setQuery(""); setModel(createInitialEmrTableFilterBuilderModel("pattern-filter")); };
  return <PatternShell><div className="flex flex-wrap items-center justify-between gap-3">
    <SegmentedControl aria-label="샘플 업무 상태 필터" items={[{ value: "all", label: "전체", count: 12 }, { value: "waiting", label: "대기", count: 5 }, { value: "active", label: "진행", count: 4 }, { value: "done", label: "완료", count: 3 }]} value={value} variant="pill" onValueChange={setValue} />
    <div className="flex items-center gap-2"><Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={<Button type="button" variant="outline" size="sm">필터</Button>} /><PopoverContent align="end" className="w-[min(640px,calc(100vw-32px))] gap-0 p-0" initialFocus={false}><EmrTableFilterBuilder fields={sampleFilterFields} model={model} onModelChange={setModel} onClose={() => setOpen(false)} /></PopoverContent></Popover><Button type="button" variant="outline" size="icon-sm" aria-label="샘플 업무 검색" onClick={() => setSearch(true)}><CdsActionsSearchIcon aria-hidden="true" /></Button></div>
  </div>
  {search ? <div className="mt-3 flex gap-2"><Input type="search" aria-label="샘플 업무 검색어" value={query} onValueChange={setQuery} /><Button onClick={() => { setSearch(false); setQuery(""); }}>검색 닫기</Button></div> : null}
  <output aria-label="샘플 업무 결과" className="mt-3 block">결과 {filtered.length}건</output>
  {filtered.length ? <ul>{filtered.map(row => <li key={row.id}>{row.label}</li>)}</ul> : <EmrEmptyState title="조건에 맞는 샘플 업무가 없습니다" kind="no-filter-results" priority="local-recovery" surface="table" size="md" primaryAction={<Button size="sm" variant="outline" onClick={reset}>조건 초기화</Button>} />}
  </PatternShell>;
}
function HeaderPattern() {
  const [sort, setSort] = useState<"asc" | "desc">("asc"), [filter, setFilter] = useState(true), [menu, setMenu] = useState(true);
  const rows = patternRows.filter(row => !filter || row.status !== "완료").sort((a,b) => sort === "asc" ? a.time.localeCompare(b.time) : b.time.localeCompare(a.time));
  return <PatternShell><Table density="standard" layout="fill" minWidth={560}>
    <TableHeader><TableRow><EmrTableHeaderCell interaction="sortable-filterable" sortDirection={sort} filterActive={filter} onSort={() => setSort(value => value === "asc" ? "desc" : "asc")} onFilter={() => setFilter(value => !value)}>요청 시간</EmrTableHeaderCell><EmrTableHeaderCell interaction="menu" menuActive={menu} onMenu={() => setMenu(value => !value)}>담당</EmrTableHeaderCell><EmrTableHeaderCell>상태</EmrTableHeaderCell></TableRow></TableHeader>
    <TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><EmrTableCellText>{row.time}</EmrTableCellText></TableCell><TableCell><EmrTableCellText>{row.assignee}</EmrTableCellText></TableCell><TableCell><EmrStatusBadge label={row.status} /></TableCell></TableRow>)}</TableBody>
  </Table><output aria-label="헤더 결과">표시 {rows.length}건 · 메뉴 {menu ? "활성" : "비활성"}</output></PatternShell>;
}
function SelectionPattern() {
  const [ids, setIds] = useState<Set<string>>(() => new Set(["sample-order-2"]));
  const all = ids.size === patternRows.length;
  return <PatternShell><Table density="standard" layout="fill" minWidth={560}>
    <TableHeader><TableRow><EmrTableSelectionHeaderCell><EmrTableCheckbox aria-label="샘플 행 전체 선택" checked={all} indeterminate={ids.size > 0 && !all} onCheckedChange={checked => setIds(checked ? new Set(patternRows.map(row => row.id)) : new Set())} /></EmrTableSelectionHeaderCell><EmrTableHeaderCell>업무</EmrTableHeaderCell><EmrTableHeaderCell>상태</EmrTableHeaderCell></TableRow></TableHeader>
    <TableBody>{patternRows.map(row => <TableRow key={row.id} data-state={ids.has(row.id) ? "selected" : undefined}><EmrTableSelectionCell><EmrTableCheckbox aria-label={`${row.request} 선택`} checked={ids.has(row.id)} onCheckedChange={checked => setIds(current => { const next = new Set(current); if (checked) next.add(row.id); else next.delete(row.id); return next; })} /></EmrTableSelectionCell><TableCell><EmrTableCellText>{row.request}</EmrTableCellText></TableCell><TableCell><EmrStatusBadge label={row.status} /></TableCell></TableRow>)}</TableBody>
  </Table><output aria-label="선택 업무 수">{ids.size}개 선택</output></PatternShell>;
}
function PatternFixture(args: StorybookTableQueuePatternsProps) {
  if (args.pattern === "action-cell") return <ActionPattern />;
  if (args.pattern === "filter-toolbar") return <ToolbarPattern />;
  if (args.pattern === "sortable-filterable-header") return <HeaderPattern />;
  if (args.pattern === "row-selection") return <SelectionPattern />;
  return <StorybookTableQueuePatterns {...args} />;
}
async function verifyPattern(canvasElement: HTMLElement, pattern: StorybookTableQueuePatternsProps["pattern"]) {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
  if (pattern === "action-cell") {
    const openAction = async (name: RegExp) => { await userEvent.click(canvas.getByRole("button", { name: "샘플 재확인 요청 작업" })); const item = await body.findByRole("menuitem", { name }); await waitFor(() => expect(item).toBeVisible()); await userEvent.click(item); };
    await openAction(/상세 보기/); await expect(canvas.getByRole("region", { name: "합성 상세" })).toBeVisible();
    await openAction(/담당 지정/); await expect(canvas.getByLabelText("행 작업 결과")).toHaveTextContent("담당: 합성 스태프");
    await openAction(/요청 취소/); let dialog = await body.findByRole("dialog", { name: "합성 요청을 취소할까요?" }); await waitFor(() => expect(dialog).toBeVisible()); await userEvent.click(within(dialog).getByRole("button", { name: "계속 보기" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); await expect(canvas.getByText("샘플 재확인 요청", { exact: true })).toBeVisible();
    await openAction(/요청 취소/); dialog = await body.findByRole("dialog", { name: "합성 요청을 취소할까요?" }); await waitFor(() => expect(dialog).toBeVisible()); await userEvent.click(within(dialog).getByRole("button", { name: "합성 요청 취소" }));
    await expect(canvas.getByText("합성 요청이 취소되었습니다.")).toBeVisible();
  } else if (pattern === "filter-toolbar") {
    await userEvent.click(canvas.getByRole("button", { name: /대기/ })); await expect(canvas.getByLabelText("샘플 업무 결과")).toHaveTextContent("결과 5건");
    await userEvent.click(canvas.getByRole("button", { name: "샘플 업무 검색" })); await userEvent.type(canvas.getByRole("searchbox", { name: "샘플 업무 검색어" }), "5"); await expect(canvas.getByLabelText("샘플 업무 결과")).toHaveTextContent("결과 1건"); await userEvent.click(canvas.getByRole("button", { name: "검색 닫기" }));
    await userEvent.click(canvas.getByRole("button", { name: "필터" })); const field = await body.findByRole("combobox", { name: "그룹 1 조건 1 필터 필드" }); await waitFor(() => expect(field).toBeVisible()); await userEvent.click(field); await userEvent.click(await body.findByRole("option", { name: "상태" }));
    await userEvent.click(body.getByRole("combobox", { name: "그룹 1 조건 1 필터 값" })); await userEvent.click(await body.findByRole("option", { name: "완료" })); await userEvent.click(body.getByRole("button", { name: "필터 닫기" }));
    await waitFor(() => expect(canvas.getByLabelText("샘플 업무 결과")).toHaveTextContent("결과 0건")); await userEvent.click(canvas.getByRole("button", { name: "조건 초기화" })); await expect(canvas.getByLabelText("샘플 업무 결과")).toHaveTextContent("결과 12건");
  } else if (pattern === "sortable-filterable-header") {
    const sort = canvas.getByRole("button", { name: "요청 시간 정렬" }); sort.focus(); await userEvent.keyboard("{Enter}"); await expect(canvasElement.querySelector("tbody tr:first-child")).toHaveTextContent("09:25");
    await userEvent.click(canvas.getByRole("button", { name: "요청 시간 필터" })); await expect(canvasElement.querySelector("tbody tr:first-child")).toHaveTextContent("09:40"); await userEvent.click(canvas.getByRole("button", { name: "담당 컬럼 메뉴" })); await expect(canvas.getByLabelText("헤더 결과")).toHaveTextContent("메뉴 비활성");
  } else if (pattern === "row-selection") {
    const all = canvas.getByRole("checkbox", { name: "샘플 행 전체 선택" }); await expect(all).toHaveAttribute("aria-checked", "mixed"); all.focus(); await userEvent.keyboard(" "); await expect(all).toHaveAttribute("aria-checked", "true"); await expect(canvas.getByLabelText("선택 업무 수")).toHaveTextContent("3개 선택"); await userEvent.click(canvas.getByRole("checkbox", { name: "샘플 혈액검사 선택" })); await expect(all).toHaveAttribute("aria-checked", "mixed"); await expect(canvas.getByLabelText("선택 업무 수")).toHaveTextContent("2개 선택");
  } else if (pattern === "density-selector") {
    await userEvent.click(canvas.getByRole("button", { name: /^테이블 보기 밀도:/ })); await userEvent.click(await body.findByRole("menuitemradio", { name: "좁은 간격" })); await expect(canvas.getByRole("table")).toHaveAttribute("data-emr-density", "compact");
  }
}

const meta = {
  title: "Design System/EMR/Table Queue Patterns",
  component: StorybookTableQueuePatterns,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "880px" },
      description: {
        component:
          "Storybook-only EMR table/queue pattern entry for repeated status cells, action cells, filter toolbars, empty table states, sortable/filterable headers, row selection, density selectors, and long text cells. Use these patterns when documenting stable table/queue compositions. The four interaction-heavy branches use bounded local controllers and actual shared primitives; status/empty/density/text render the unchanged exported helper. Counters, filtering, selection, row actions and synthetic confirmation are local outcomes. This is not an app feature screen.",
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
  render: args => <PatternFixture key={args.pattern} {...args} />,
  play: async ({ canvasElement, args }) => verifyPattern(canvasElement, args.pattern),
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
