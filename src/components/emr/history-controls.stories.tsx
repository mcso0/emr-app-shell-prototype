import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { CdsActionsListFilterIcon, CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { EmrContentAsideHeader, EmrContentAsidePanel } from "./content-aside-panel";
import { EmrListHeaderIconButton } from "./subpanel";
import { EmrHistoryFilterPopover, EmrHistorySearch, EmrHistorySortButton, useHistorySearch } from "./history-controls";
import { compareHistoryDates, emptyHistoryDateRange, matchesHistoryDate, matchesHistoryQuery, type HistorySortDirection } from "@/lib/history-controls";

const records = [
  { id: "earlier", date: "2026-04-29T14:59:59Z", label: "이수지 · 재진" },
  { id: "later", date: "2026-05-01T00:00:00Z", label: "김도윤 · 초진" },
];

function HistoryControlsExample() {
  const search = useHistorySearch();
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [direction, setDirection] = useState<HistorySortDirection>("newest");
  const [dates, setDates] = useState(emptyHistoryDateRange);
  const [draftDates, setDraftDates] = useState(emptyHistoryDateRange);
  const [open, setOpen] = useState(false);
  const rows = records.filter((record) => matchesHistoryDate(record.date, dates) && matchesHistoryQuery(search.searchQuery, [record.label])).sort((a, b) => compareHistoryDates(a.date, b.date, direction));
  return <div className="h-[560px] w-[320px] max-w-full">
    <EmrContentAsidePanel>
      <EmrContentAsideHeader label="진료 이력" count={rows.length} onCollapse={() => {}} search={search.open ? <EmrHistorySearch search={search} label="진료 이력 검색" onClose={() => { search.clear(); search.setOpen(false); requestAnimationFrame(() => searchTrigger.current?.focus()); }} /> : null} actions={<>
        <EmrHistorySortButton direction={direction} onChange={setDirection} dateLabel="진료일" />
        <EmrHistoryFilterPopover open={open} trigger={<EmrListHeaderIconButton ariaLabel="필터" aria-pressed={Boolean(dates.start)} className="relative [&>span]:overflow-visible"><CdsActionsListFilterIcon />{dates.start ? <span data-slot="history-filter-indicator" aria-hidden="true" className="pointer-events-none absolute right-[var(--clair-spacing-1)] top-[var(--clair-spacing-1)] size-[var(--clair-spacing-6)] rounded-full bg-[var(--clair-color-atomic-sky-500)]" /> : null}</EmrListHeaderIconButton>} tooltip={`필터 · ${dates.start ? `${dates.start}–${dates.end}` : "적용한 조건 없음"}`} title="진료 이력 필터" dateLabel="진료일" dates={draftDates} onDatesChange={setDraftDates} onOpen={() => { setDraftDates(dates); setOpen(true); }} onCancel={() => setOpen(false)} onReset={() => setDraftDates(emptyHistoryDateRange)} onApply={() => { setDates(draftDates); setOpen(false); }} />
        {!search.open ? <EmrListHeaderIconButton ref={searchTrigger} ariaLabel="검색" onClick={() => search.setOpen(true)}><CdsActionsSearchIcon /></EmrListHeaderIconButton> : null}
      </>} />
      <p role="status" className="sr-only">결과 {rows.length}건</p>
      <ul>{rows.map((row) => <li key={row.id} data-testid={row.id}>{row.label}</li>)}</ul>
    </EmrContentAsidePanel>
  </div>;
}

const meta = { title: "Design System/EMR/History Controls", component: HistoryControlsExample, parameters: { layout: "centered" } } satisfies Meta<typeof HistoryControlsExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Controls: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "정렬: 최신순" }));
    await expect(await body.findByText("진료일 정렬")).toHaveClass("sr-only");
    await expect(canvasElement.ownerDocument.querySelector('[data-slot="dropdown-menu-separator"]')).toBeNull();
    await userEvent.click(body.getByRole("menuitemradio", { name: "오래된순" }));
    await expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent("이수지");
    const frame = canvasElement.querySelector('[data-slot="content-aside-search-header"]')!;
    const height = frame.getBoundingClientRect().height;
    expect(height).toBe(48);
    const listTop = canvas.getByRole("list").getBoundingClientRect().top;
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    await expect(canvas.getAllByRole("button", { name: "검색 닫기" })).toHaveLength(1);
    await expect(canvas.getByRole("searchbox")).toHaveAttribute("placeholder", "키워드 입력");
    await expect(canvas.getByRole("searchbox")).toHaveStyle({ height: "28px" });
    expect(frame.getBoundingClientRect().height).toBe(height);
    expect(canvas.getByRole("list").getBoundingClientRect().top).toBe(listTop);
    await expect(canvas.queryByRole("button", { name: "정렬: 오래된순" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "필터" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "검색" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "검색어 지우기" })).not.toBeInTheDocument();
    await userEvent.type(canvas.getByRole("searchbox"), "이수지 재진");
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("결과 1건"));
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("searchbox")).not.toBeInTheDocument();
    await waitFor(() => expect(canvas.getByRole("button", { name: "검색" })).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "필터" }));
    const form = within(await body.findByRole("dialog", { name: "진료 이력 필터" }));
    await expect(form.getByText("진료 이력 필터", { exact: true })).toHaveClass("sr-only");
    fireEvent.change(form.getByLabelText("시작일"), { target: { value: "2026-05-02" } });
    fireEvent.change(form.getByLabelText("종료일"), { target: { value: "2026-04-29" } });
    await expect(form.getByRole("button", { name: "적용" })).toBeDisabled();
    fireEvent.change(form.getByLabelText("시작일"), { target: { value: "2026-04-29" } });
    await userEvent.click(form.getByRole("button", { name: "적용" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 1건");
    await waitFor(() => expect(body.queryByRole("dialog", { name: "진료 이력 필터" })).not.toBeInTheDocument());
    const filterButton = canvas.getByRole("button", { name: "필터" });
    expect(filterButton.querySelector('[data-slot="history-filter-indicator"]')).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "정렬: 오래된순" }));
    await userEvent.click(await body.findByRole("menuitemradio", { name: "최신순" }));
    expect(canvas.getByRole("button", { name: "정렬: 최신순" }).querySelector('[data-slot="history-filter-indicator"]')).toBeNull();
    expect(filterButton.querySelector('[data-slot="history-filter-indicator"]')).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "필터" }));
    await userEvent.click(body.getByRole("button", { name: "초기화" }));
    await userEvent.click(body.getByRole("button", { name: "취소" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 1건");
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    await userEvent.click(canvas.getByRole("button", { name: "검색 닫기" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 1건");
    await waitFor(() => expect(canvas.getByRole("button", { name: "검색" })).toHaveFocus());
  },
};

export const ComposingSearch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    const input = canvas.getByRole("searchbox");
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "이수지" } });
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(input).toBeInTheDocument();
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 2건");
    fireEvent.compositionEnd(input);
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("결과 1건"));
    await userEvent.click(canvas.getByRole("button", { name: "검색어 초기화" }));
    await expect(input).toHaveValue("");
    await expect(input).toHaveFocus();
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 2건");
    await userEvent.click(canvas.getByRole("button", { name: "검색 닫기" }));
    await expect(canvas.queryByRole("searchbox")).not.toBeInTheDocument();
  },
};

export const PendingSearchCancellation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    const cancel = canvas.getByRole("button", { name: "검색 닫기" });
    await expect(cancel).toBeEnabled();
    fireEvent.change(canvas.getByRole("searchbox"), { target: { value: "없는 기록" } });
    await userEvent.click(canvas.getByRole("button", { name: "검색어 초기화" }));
    await expect(canvas.getByRole("searchbox")).toHaveValue("");
    await expect(canvas.getByRole("searchbox")).toHaveFocus();
    await userEvent.click(cancel);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 2건");
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    await expect(canvas.getByRole("searchbox")).toHaveValue("");
    await expect(canvas.getByRole("button", { name: "검색 닫기" })).toBeEnabled();
  },
};

export const DismissFilterDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "필터" });
    for (const dismissal of ["outside", "escape"]) {
      await userEvent.click(trigger);
      const form = within(await body.findByRole("dialog", { name: "진료 이력 필터" }));
      fireEvent.change(form.getByLabelText("시작일"), { target: { value: "2026-04-29" } });
      fireEvent.change(form.getByLabelText("종료일"), { target: { value: "2026-04-29" } });
      if (dismissal === "outside") await userEvent.click(canvas.getByText("김도윤 · 초진"));
      else await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog", { name: "진료 이력 필터" })).not.toBeInTheDocument());
      await expect(canvas.getByRole("status")).toHaveTextContent("결과 2건");
      await userEvent.click(trigger);
      await expect(body.getByLabelText("시작일")).toHaveValue("");
      await userEvent.click(body.getByRole("button", { name: "취소" }));
    }
  },
};
