import { useRef, useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChartAssessmentTable, type ChartAssessmentDiagnosis } from "./chart-assessment-table";

const diagnoses: ChartAssessmentDiagnosis[] = [
  { id: "synthetic-b", encounterId: "synthetic-encounter", diagnosisText: "나 합성 진단", diagnosisType: "suspected", catalogMatched: true, isPrimary: false, systemLabel: "합성 계통", createdByUserId: "synthetic-user", createdAt: "2026-10-11T00:00:00Z", sortOrder: 0 },
  { id: "synthetic-a", encounterId: "synthetic-encounter", diagnosisText: "가 합성 진단", diagnosisType: "confirmed", catalogMatched: false, isPrimary: true, systemLabel: "미분류", createdByUserId: "synthetic-user", createdAt: "2026-10-11T00:00:00Z", sortOrder: 1 },
];
function Example({ height = 340, ...args }: ComponentProps<typeof ChartAssessmentTable> & { height?: number }) {
  const [rows, setRows] = useState(args.diagnoses);
  const [action, setAction] = useState("없음");
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const update = (id: string, patch: Partial<ChartAssessmentDiagnosis>, name: string) => { setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)); setAction(`${name}:${id}`); };
  return <div style={{ height }} className="flex min-w-0 w-full flex-col bg-[var(--emr-surface-panel)]"><Popover open={searchOpen} onOpenChange={setSearchOpen}><PopoverTrigger nativeButton={false} render={<div className="relative min-w-0 w-full" />}><Input ref={search} className="mb-2" aria-label="합성 진단명 검색" placeholder="진단명 검색" disabled={args.writeDisabled} value={query} onFocus={() => setSearchOpen(true)} onValueChange={(value) => { setQuery(value);setSearchOpen(true); }} /></PopoverTrigger><PopoverContent align="start" initialFocus={false}><div role="listbox" aria-label="합성 진단명 검색 결과">{query.trim() && !rows.some((row) => row.diagnosisText === query.trim()) ? <button type="button" role="option" aria-selected="false" disabled={args.writeDisabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { setRows((current) => [...current, { ...diagnoses[0], id: crypto.randomUUID(), diagnosisText: query.trim(), isPrimary: current.length === 0, catalogMatched: false, systemLabel: "미분류", sortOrder: current.length }]);setAction("add-free-text");setQuery("");setSearchOpen(false); }}>‘{query.trim()}’ 직접 추가</button> : <p>표시할 추천 진단명이 없습니다.</p>}</div></PopoverContent></Popover><ChartAssessmentTable {...args} diagnoses={rows}
    loadingState={<div role="status" aria-live="polite" data-slot="chart-panel-skeleton" data-loading-label="진단명 정보를 불러오는 중" className="grid min-w-0 flex-1 gap-2"><span className="sr-only">진단명 정보를 불러오는 중. 진단 목록과 확정 상태를 확인하고 있습니다.</span><div aria-hidden="true" className="flex min-w-0 items-center gap-2"><Skeleton className="h-3 w-20 shrink-0 motion-reduce:animate-none" /><Skeleton className="h-3 min-w-16 max-w-72 flex-1 motion-reduce:animate-none" /></div></div>}
    emptyState={<EmrEmptyState kind="no-data" priority="supporting" surface="table" title="선택된 진단이 없습니다." primaryAction={<Button type="button" variant="outline" size="xs" disabled={args.writeDisabled} onClick={() => search.current?.focus()}><CdsActionsPlusIcon aria-hidden="true" />진단명 추가</Button>} testId="chart-assessment-empty-state" />}
    onPrimaryChange={(id, checked) => update(id, { isPrimary: checked }, "primary")}
    onConfirmedChange={(id, checked) => update(id, { diagnosisType: checked ? "confirmed" : "suspected" }, "confirmed")}
    onClosedChange={(id, checked) => update(id, { closedAt: checked ? (rows.find((row) => row.id === id)?.closedAt ?? "2026-10-11T00:00:00Z") : undefined, closedByUserId: checked ? (rows.find((row) => row.id === id)?.closedByUserId ?? rows.find((row) => row.id === id)?.createdByUserId) : undefined }, "closed")}
    onRemove={(id) => { setRows((current) => current.filter((row) => row.id !== id)); setAction(`remove:${id}`); }} /><output aria-label="합성 진단 변경">{action}</output></div>;
}
const meta = {
  title: "Features/Chart/Assessment Table", component: ChartAssessmentTable, tags: ["autodocs"],
  args: { diagnoses, loading: false, writeDisabled: false, emptyState: null, loadingState: null, getVeterinarianName: () => "합성 수의사", onClosedChange: () => undefined, onConfirmedChange: () => undefined, onPrimaryChange: () => undefined, onRemove: () => undefined },
  argTypes: { loading: { control: "boolean" }, writeDisabled: { control: "boolean" }, emptyState: { control: false }, loadingState: { control: false }, onClosedChange: { control: false }, onConfirmedChange: { control: false }, onPrimaryChange: { control: false }, onRemove: { control: false } },
  render: (args) => <Example key={JSON.stringify(args.diagnoses)} {...args} />,
  parameters: { docs: { description: { component: "실제 ChartAssessmentTable과 차트 caller의 skeleton·EmrEmptyState 구성을 사용합니다. private ChartPanelPendingState의 작은 skeleton만 같은 요소로 조립하며 제품 테이블은 복사하지 않습니다. 로컬 진단 변경은 caller와 같이 주진단·확진을 반영하고 종결 시각과 담당자도 함께 바꿉니다. 진단명 추가는 caller와 같이 검색 입력으로 포커스를 이동합니다. 검색 입력과 자유 텍스트 추가는 이 표의 제한된 로컬 조합입니다. 원격 카탈로그 조회와 임상 판단·저장은 연결하지 않습니다." } } },
} satisfies Meta<typeof ChartAssessmentTable>;
export default meta;
type Story = StoryObj<typeof meta>;
async function until(condition: () => boolean, message: string) { await waitFor(() => { if (!condition()) throw new Error(message); }); }
export const SortAndEdit: Story = {
  parameters: { docs: { description: { story: "진단명 오름차순 정렬, 주진단·확진·종결 변경과 삭제 콜백을 로컬 행으로 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "진단명 정렬" }));
    await until(() => canvasElement.querySelector('[data-slot="chart-assessment-table-row"]')?.textContent?.includes("가 합성 진단") === true, "진단명 정렬이 반영되지 않았습니다.");
    await userEvent.click(canvas.getByRole("button", { name: "진단명 정렬" }));
    await until(() => canvasElement.querySelector('[data-slot="chart-assessment-table-row"]')?.textContent?.includes("나 합성 진단") === true, "진단명 내림차순 정렬이 반영되지 않았습니다.");
    for (const [label, action] of [["주진단", "primary"], ["확진", "confirmed"], ["종결", "closed"]]) {
      const control = canvasElement.querySelector<HTMLElement>(`[aria-label="나 합성 진단 ${label}"]`);
      if (!control) throw new Error(`${label} 선택이 없습니다.`);
      await userEvent.click(control);
      await until(() => canvasElement.querySelector("output")?.textContent === `${action}:synthetic-b`, `${label} 콜백이 없습니다.`);
      if (control.getAttribute("aria-checked") !== "true" && !(control instanceof HTMLInputElement && control.checked)) throw new Error(`${label} 선택 상태가 반영되지 않았습니다.`);
    }
    await userEvent.click(canvas.getByRole("button", { name: "나 합성 진단 삭제" }));
    await until(() => canvasElement.querySelectorAll('[data-slot="chart-assessment-table-row"]').length === 1 && canvasElement.querySelector("output")?.textContent === "remove:synthetic-b", "삭제 콜백이 반영되지 않았습니다.");
  },
};
export const ReadOnly: Story = { args: { writeDisabled: true }, parameters: { docs: { description: { story: "수정 불가 상태의 체크박스와 삭제 버튼을 확인합니다. 서버 권한 증거는 아닙니다." } } }, play: async ({ canvasElement }) => { const controls = canvasElement.querySelectorAll<HTMLElement>('[data-slot="chart-assessment-table-row"] [aria-label]'); if (!controls.length || Array.from(controls).some((node) => !(node as HTMLButtonElement).disabled && node.getAttribute("aria-disabled") !== "true")) throw new Error("읽기 전용 진단 변경 컨트롤이 활성화되어 있습니다."); } };
export const Loading: Story = { args: { loading: true }, parameters: { docs: { description: { story: "실제 차트 caller의 skeleton 슬롯을 표시하며 기존 진단 행은 숨깁니다." } } }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('[data-slot="chart-panel-skeleton"]')!).toHaveTextContent("진단명 정보를 불러오는 중");await expect(canvasElement.querySelector('[data-slot="chart-assessment-table-row"]')).toBeNull(); } };
export const Empty: Story = { args: { diagnoses: [] }, parameters: { docs: { description: { story: "실제 caller의 빈 상태와 진단명 추가 시 검색 포커스 이동을 확인합니다. 검색 추천은 로컬 빈 목록이며 직접 추가는 로컬 행으로 반영합니다." } } }, play: async ({ canvas, canvasElement }) => { await waitFor(() => expect(canvas.getByText("선택된 진단이 없습니다.")).toBeVisible());await userEvent.click(canvas.getByRole("button", { name: "진단명 추가" }));const input = canvas.getByRole("textbox", { name: "합성 진단명 검색" });await expect(input).toHaveFocus();await userEvent.type(input, "합성 직접 입력");await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("option", { name: "‘합성 직접 입력’ 직접 추가" }));await expect(canvas.getByText("합성 직접 입력")).toBeVisible(); } };

export const ShortEmptyBody: Story = {
  args: { diagnoses: [] },
  render: (args) => <Example {...args} height={180} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvasElement.querySelector('[data-slot="icon-wrapper"]')).toHaveStyle({ display: "none" });
    await userEvent.click(canvas.getByRole("button", { name: "진단명 추가" }));
    await expect(canvas.getByRole("textbox", { name: "합성 진단명 검색" })).toHaveFocus();
  },
};
