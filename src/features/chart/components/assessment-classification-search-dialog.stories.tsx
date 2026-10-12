import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { AssessmentClassificationSearchDialog, type AssessmentClassificationCatalogItem, type AssessmentClassificationSelection } from "./assessment-classification-search-dialog";

const catalog: AssessmentClassificationCatalogItem[] = [
  { id: "synthetic-diagnosis-a", code: "SYN-A", name: "합성 진단 A", systemId: "synthetic-system-a", systemLabel: "합성 계통 A", categoryId: "synthetic-group-a", categoryLabel: "합성 구분 A", synonyms: ["합성 별칭 A"], defaultType: "confirmed" },
  { id: "synthetic-diagnosis-b", code: "SYN-B", name: "합성 진단 B", systemId: "synthetic-system-b", systemLabel: "합성 계통 B", categoryId: "synthetic-group-b", categoryLabel: "합성 구분 B", synonyms: [], defaultType: "suspected" },
  { id: "synthetic-diagnosis-c", code: "SYN-C", name: "합성 진단 C", systemId: "synthetic-system-a", systemLabel: "합성 계통 A", categoryId: "synthetic-group-a", categoryLabel: "합성 구분 A", synonyms: [], defaultType: "differential" },
];
const initial: AssessmentClassificationSelection[] = catalog.slice(0, 2).map((item, index) => ({ ...item, diagnosisType: item.defaultType, isPrimary: index === 0 }));
type Scenario = "ready" | "reorder" | "readonly";
function Example({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AssessmentClassificationSelection[] | null>(null);
  return <div className="p-6">
    <Button onClick={() => setOpen(true)}>분류검색 열기</Button>
    <output aria-label="합성 분류 선택 결과">{result ? JSON.stringify(result.map(item => ({ id: item.id, name: item.name, diagnosisType: item.diagnosisType, isPrimary: item.isPrimary }))) : "아직 선택하지 않음"}</output>
    <AssessmentClassificationSearchDialog catalog={catalog} catalogStatus="ready" initialSelection={scenario === "ready" ? [] : initial} nextCursor={null} open={open} writeDisabled={scenario === "readonly"} onComplete={setResult} onOpenChange={setOpen} />
  </div>;
}
const meta = {
  title: "Features/Chart/Assessment Classification Search", component: Example, tags: ["autodocs"], args: { scenario: "ready" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { docs: { story: { inline: false, height: "880px" }, description: { component: "ChartContent가 사용하는 실제 AssessmentClassificationSearchDialog와 ClassificationExplorer UI를 함께 렌더합니다. 합성 카탈로그의 계통·구분·진단·동의어·진단 유형을 실제 props 계약에 제공합니다. 로컬 전체 조회 상태(nextCursor=null)의 검색·선택·순서 변경과 읽기 전용 상태를 확인합니다. 완료 결과는 화면에 표시합니다. 원격 진단 마스터 조회·채택과 차트 저장, 페이지 추가 조회는 이 예시의 범위에 포함되지 않습니다." } } },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function open(canvas: ReturnType<typeof within>, element: HTMLElement) {
  await userEvent.click(canvas.getByRole("button", { name: "분류검색 열기" }));
  const body = within(element.ownerDocument.body);
  const dialog = await body.findByRole("dialog", { name: "분류검색" });
  await waitFor(() => expect(dialog).toBeVisible());
  return { body, dialog: within(dialog) };
}
export const FilterSearchAndComplete: Story = { play: async ({ canvas, canvasElement }) => {
  const { body, dialog } = await open(canvas, canvasElement);
  await userEvent.click(within(dialog.getByRole("listbox", { name: "진단 계통 목록" })).getByRole("option", { name: /^합성 계통 A/ }));
  const diagnoses = within(dialog.getByRole("listbox", { name: "진단명 목록" }));
  await expect(diagnoses.queryByRole("option", { name: "합성 진단 B" })).not.toBeInTheDocument();
  await expect(diagnoses.getByRole("option", { name: "합성 진단 C" })).toBeVisible();
  await userEvent.click(dialog.getByRole("button", { name: "진단명 검색" }));
  await userEvent.type(dialog.getByRole("searchbox", { name: "진단명 검색" }), "합성 별칭 A");
  await waitFor(() => expect(diagnoses.queryByRole("option", { name: "합성 진단 C" })).not.toBeInTheDocument());
  await userEvent.click(diagnoses.getByRole("option", { name: "합성 진단 A" }));
  await expect(diagnoses.getByRole("option", { name: "합성 진단 A" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(dialog.getByRole("button", { name: "선택 완료" }));
  await waitFor(() => expect(body.queryByRole("dialog", { name: "분류검색" })).not.toBeInTheDocument());
  await expect(JSON.parse(canvas.getByLabelText("합성 분류 선택 결과").textContent!)).toEqual([{ id: catalog[0].id, name: catalog[0].name, diagnosisType: "confirmed", isPrimary: true }]);
} };
export const KeyboardReorderAndType: Story = { args: { scenario: "reorder" }, play: async ({ canvas, canvasElement }) => {
  const { body, dialog } = await open(canvas, canvasElement);
  const list = dialog.getByRole("list", { name: "선택 진단 순서" });
  const handle = dialog.getByRole("button", { name: "합성 진단 A 순서 변경" });
  handle.focus(); await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
  await waitFor(() => expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("합성 진단 B"));
  await expect(dialog.getByText("합성 진단 A 항목을 2번째로 이동했습니다.")).toBeInTheDocument();
  await userEvent.click(dialog.getByRole("combobox", { name: "합성 진단 A 진단 유형" }));
  await userEvent.click(await body.findByRole("option", { name: "감별" }));
  await userEvent.click(dialog.getByRole("button", { name: "선택 완료" }));
  await waitFor(() => expect(body.queryByRole("dialog", { name: "분류검색" })).not.toBeInTheDocument());
  const result = JSON.parse(canvas.getByLabelText("합성 분류 선택 결과").textContent!) as AssessmentClassificationSelection[];
  await expect(result.map(item => item.id)).toEqual([catalog[1].id, catalog[0].id]);
  await expect(result[1]).toMatchObject({ diagnosisType: "differential", isPrimary: true });
} };
export const ReadOnly: Story = { args: { scenario: "readonly" }, play: async ({ canvas, canvasElement }) => {
  const { body, dialog } = await open(canvas, canvasElement);
  await expect(dialog.getByText("읽기 전용 · 변경 권한이 없습니다")).toBeVisible();
  await expect(dialog.getByRole("option", { name: "합성 진단 C" })).toBeDisabled();
  for (const name of ["진단명 검색", "전체 삭제", "선택 완료", "합성 진단 A 삭제", "합성 진단 A 순서 변경"]) await expect(dialog.getByRole("button", { name })).toBeDisabled();
  await expect(dialog.getByRole("combobox", { name: "합성 진단 A 진단 유형" })).toBeDisabled();
  await expect(body.getByRole("dialog", { name: "분류검색" })).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("dialog", { name: "분류검색" })).not.toBeInTheDocument());
  await expect(canvas.getByLabelText("합성 분류 선택 결과")).toHaveTextContent("아직 선택하지 않음");
} };
export const EmptySearchAndCancel: Story = { play: async ({ canvas, canvasElement }) => {
  const { body, dialog } = await open(canvas, canvasElement);
  await userEvent.click(dialog.getByRole("button", { name: "진단명 검색" }));
  const search = dialog.getByRole("searchbox", { name: "진단명 검색" });
  await userEvent.type(search, "synthetic-no-match");
  await waitFor(() => expect(dialog.getByText("검색 결과가 없습니다")).toBeVisible());
  await userEvent.clear(search);
  await waitFor(() => expect(dialog.getByRole("option", { name: "합성 진단 A" })).toBeVisible());
  await userEvent.click(dialog.getByRole("button", { name: "취소" }));
  await waitFor(() => expect(body.queryByRole("dialog", { name: "분류검색" })).not.toBeInTheDocument());
  await expect(canvas.getByRole("button", { name: "분류검색 열기" })).toHaveFocus();
} };
