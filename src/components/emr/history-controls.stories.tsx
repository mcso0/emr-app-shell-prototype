import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { EmrContentAsideHeader, EmrContentAsidePanel } from "./content-aside-panel";
import { EmrHistoryFilterDialog, EmrHistorySearch, EmrHistorySortButton, useHistorySearch } from "./history-controls";
import { Button } from "@/components/ui/button";
import { compareHistoryDates, emptyHistoryDateRange, matchesHistoryDate, matchesHistoryQuery, type HistorySortDirection } from "@/lib/history-controls";

const records = [
  { id: "earlier", date: "2026-04-29T14:59:59Z", label: "이수지 · 재진" },
  { id: "later", date: "2026-05-01T00:00:00Z", label: "김도윤 · 초진" },
];

function HistoryControlsExample() {
  const search = useHistorySearch();
  const [direction, setDirection] = useState<HistorySortDirection>("newest");
  const [dates, setDates] = useState(emptyHistoryDateRange);
  const [draftDates, setDraftDates] = useState(emptyHistoryDateRange);
  const [open, setOpen] = useState(false);
  const rows = records.filter((record) => matchesHistoryDate(record.date, dates) && matchesHistoryQuery(search.searchQuery, [record.label])).sort((a, b) => compareHistoryDates(a.date, b.date, direction));
  return <div className="h-[560px] w-[320px] max-w-full">
    <EmrContentAsidePanel>
      <EmrContentAsideHeader label="진료 이력" count={rows.length} onCollapse={() => {}} actions={<EmrHistorySortButton direction={direction} onChange={setDirection} dateLabel="진료일" />} />
      <Button variant="outline" onClick={() => search.setOpen(true)}>검색 열기</Button>
      {search.open ? <EmrHistorySearch search={search} label="진료 이력 검색" placeholder="내원·수의사 검색" onClose={() => { search.clear(); search.setOpen(false); }} /> : null}
      <Button variant="outline" onClick={() => { setDraftDates(dates); setOpen(true); }}>필터 열기</Button>
      <p role="status">결과 {rows.length}건</p>
      <ul>{rows.map((row) => <li key={row.id} data-testid={row.id}>{row.label}</li>)}</ul>
      <EmrHistoryFilterDialog open={open} title="진료 이력 필터" dateLabel="진료일" dates={draftDates} onDatesChange={setDraftDates} onCancel={() => setOpen(false)} onReset={() => setDraftDates(emptyHistoryDateRange)} onApply={() => { setDates(draftDates); setOpen(false); }} />
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
    await userEvent.click(body.getByRole("radio", { name: "오래된순" }));
    await expect(canvas.getAllByRole("listitem")[0]).toHaveTextContent("이수지");
    await userEvent.click(canvas.getByRole("button", { name: "검색 열기" }));
    await userEvent.type(canvas.getByRole("searchbox"), "이수지 재진");
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("결과 1건"));
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 2건");
    await userEvent.click(canvas.getByRole("button", { name: "필터 열기" }));
    const dialog = body.getByRole("dialog");
    const form = within(dialog);
    fireEvent.change(form.getByLabelText("시작일"), { target: { value: "2026-05-02" } });
    fireEvent.change(form.getByLabelText("종료일"), { target: { value: "2026-04-29" } });
    await expect(form.getByRole("button", { name: "적용" })).toBeDisabled();
    fireEvent.change(form.getByLabelText("시작일"), { target: { value: "2026-04-29" } });
    await userEvent.click(form.getByRole("button", { name: "적용" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 1건");
    await userEvent.click(canvas.getByRole("button", { name: "필터 열기" }));
    await userEvent.click(body.getByRole("button", { name: "조건 초기화" }));
    await userEvent.click(body.getByRole("button", { name: /^취소$/ }));
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 1건");
  },
};

export const ComposingSearch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "검색 열기" }));
    const input = canvas.getByRole("searchbox");
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "이수지" } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(canvas.getByRole("status")).toHaveTextContent("결과 2건");
    fireEvent.compositionEnd(input);
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("결과 1건"));
  },
};
