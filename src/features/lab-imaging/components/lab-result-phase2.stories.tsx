import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { LabOverallFinding, LabResultHistoryDialog, LabResultRowDetail } from "./lab-result-phase2";
import { useLabResultPhase2 } from "../use-lab-result-phase2";
import { createPhase2Fixture, type Phase2Scenario } from "./lab-result-phase2.stories.fixture";

let fixture = createPhase2Fixture("ready");
type Args = { scenario: Phase2Scenario };
type Fixture = ReturnType<typeof createPhase2Fixture>;
async function settleOverall(root: HTMLElement) {
  const status = () => root.querySelector("[data-testid='lab-overall-save-status']")?.textContent ?? "";
  if (status().includes("저장 대기 중")) {
    const input = root.querySelector<HTMLTextAreaElement>("textarea[aria-label='검사결과 종합소견']");
    if (input) await userEvent.click(input);
    await userEvent.click(within(root).getByRole("button", { name: "결과 자료 다시 불러오기" }));
  }
  await waitFor(() => { if (status().includes("저장 중")) throw new Error("Actual overall save is still pending"); }, { timeout: 5000 });
  const retry = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.trim() === "재시도");
  if (retry) { await userEvent.click(retry); await waitFor(() => expect(status()).toBe("저장됨"), { timeout: 5000 }); }
  if (status() && status() !== "저장됨") throw new Error(`Actual autosave queue requires recovery before restoration: ${status()}`);
}
function ReopenedOverall({ instance }: { instance: Fixture }) {
  const phase2 = useLabResultPhase2(instance.result.workspaceId, instance.result.id, true);
  return <><Button onClick={phase2.refresh}>결과 자료 다시 불러오기</Button><output aria-label="정리용 자료 상태">{phase2.status}</output><LabOverallFinding result={instance.result} phase2={phase2.data} readStatus={phase2.status} refresh={phase2.refresh} /></>;
}
async function settleDetachedOverall(instance: Fixture) {
  // Native Storybook may unmount the canvas before running beforeEach cleanup.
  // Reopening the exported component restores its real retained autosave queue.
  const host = document.createElement("div");
  host.setAttribute("aria-label", "합성 검사 결과 정리");
  document.body.append(host);
  const reopened = createRoot(host);
  try {
    flushSync(() => reopened.render(<ReopenedOverall instance={instance} />));
    await waitFor(() => expect(within(host).getByLabelText("정리용 자료 상태")).toHaveTextContent("ready"), { timeout: 5000 });
    await settleOverall(host);
  } finally {
    flushSync(() => reopened.unmount());
    host.remove();
  }
}
function Example() {
  const [instance] = useState(() => fixture);
  const [mounted, setMounted] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const result = instance.result;
  const phase2 = useLabResultPhase2(result.workspaceId, result.id, mounted);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [finding, setFinding] = useState(result.rows[0].note ?? "");
  useEffect(() => {
    instance.setTeardown(async () => {
      if (!root.current) { await settleDetachedOverall(instance); return; }
      flushSync(() => setHistoryOpen(false));
      await settleOverall(root.current);
      flushSync(() => setMounted(false));
    });
  }, [instance]);
  return <div ref={root} className="grid w-[900px] max-w-full gap-4 p-4">{mounted ? <>

    <div className="flex items-center gap-2"><Button variant="outline" onClick={() => setHistoryOpen(true)}>수정 이력</Button><Button variant="outline" onClick={phase2.refresh}>결과 자료 다시 불러오기</Button><output aria-label="합성 결과 자료 상태">{phase2.status}</output></div>
    <LabResultRowDetail result={result} row={result.rows[0]} finding={finding} onFindingChange={setFinding} staffInstruction="합성 직원 전달 사항" phase2={phase2.data} readStatus={phase2.status} refresh={phase2.refresh} />
    <output aria-label="합성 항목 소견 변경">{finding}</output>
    <LabOverallFinding key={result.id} result={result} phase2={phase2.data} readStatus={phase2.status} refresh={phase2.refresh} />
    <LabResultHistoryDialog result={result} events={phase2.data?.events ?? []} open={historyOpen} onOpenChange={setHistoryOpen} />
    </> : null}</div>;
}
const meta = {
  title: "Features/Lab/Result Phase 2", component: Example, tags: ["autodocs"], args: { scenario: "ready" as Args["scenario"] }, argTypes: { scenario: { control: false } },
  parameters: { nextjs: { appDirectory: true }, docs: { story: { inline: false, height: "980px" }, description: { component: "실제 항목 상세, 종합소견, 첨부 영역과 수정 이력 컴포넌트를 useLabResultPhase2로 연결합니다. 종합소견 저장·재시도·응답 유실 확인, 첨부 prepare/finalize/discard/삭제와 XMLHttpRequest PUT·진행률·취소는 모두 합성 상태에 반영합니다. 다운로드는 URL 요청만 기록합니다. 항목별 소견 콜백은 로컬 행 변경 비교용이며 전체 검사 테이블의 저장 계약은 별도입니다. TXT·CSV 바이트만 사용하며 실제 환자·검사·스토리지에 접근하지 않습니다." } } },
  beforeEach: ({ args }) => { fixture = createPhase2Fixture(args.scenario); return fixture.install(); },
  render: () => <Example key={fixture.result.id} />,
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;
type Canvas = ReturnType<typeof within>;
async function ready(canvas: Canvas) { await waitFor(() => expect(canvas.getByLabelText("합성 결과 자료 상태")).toHaveTextContent("ready")); }
function overall(canvas: Canvas) { return within(canvas.getByTestId("lab-overall-finding")); }
async function upload(canvas: Canvas, name = "synthetic-upload.txt") {
  await ready(canvas);
  const area = canvas.getByTestId("lab-overall-finding");
  const input = area.querySelector('input[type="file"]') as HTMLInputElement | null; if (!input) throw new Error("Actual attachment input missing");
  await userEvent.upload(input, new File(["합성 업로드 문서\n"], name, { type: "text/plain" }));
}
async function saveFinding(canvas: Canvas, value: string) {
  await ready(canvas); const input = canvas.getByRole("textbox", { name: "검사결과 종합소견" });
  await userEvent.click(input); await userEvent.clear(input); await userEvent.type(input, value); await userEvent.tab();
}
export const RowAndOverallFinding: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas); await expect(canvas.getByText("합성 직원 전달 사항")).toBeVisible();
  await userEvent.clear(canvas.getByRole("textbox", { name: "검사 소견" })); await userEvent.type(canvas.getByRole("textbox", { name: "검사 소견" }), "합성 항목 변경");
  await expect(canvas.getByLabelText("합성 항목 소견 변경")).toHaveTextContent("합성 항목 변경");
  await saveFinding(canvas, "합성 종합 변경"); await waitFor(() => expect(canvas.getByTestId("lab-overall-save-status")).toHaveTextContent("저장됨"));
  await expect(fixture.state.overallRevision).toBe(4);
  await expect(fixture.commands.find(command => command.method === "PUT")?.body).toMatchObject({ resultId: fixture.result.id, finding: "합성 종합 변경", expectedRevision: 3 });
  await saveFinding(canvas, "합성 종합 변경"); await waitFor(() => expect(fixture.commands.filter(command => command.method === "PUT")).toHaveLength(2));
  await waitFor(() => expect(canvas.getByTestId("lab-overall-save-status")).toHaveTextContent("저장됨")); await expect(fixture.state.overallRevision).toBe(4); await expect(fixture.state.events).toHaveLength(1);
  await userEvent.click(canvas.getByRole("button", { name: "수정 이력" }));
  const body = within(canvasElement.ownerDocument.body); const dialog = within(await body.findByRole("dialog"));
  await waitFor(() => expect(dialog.getByText("종합소견 수정")).toBeVisible()); await expect(dialog.getByText(/finding: 합성 종합 변경/)).toBeVisible(); await expect(dialog.getByText(/finding: 합성 종합소견/)).toHaveTextContent("revision: 3"); await expect(dialog.getByText(/finding: 합성 종합 변경/)).toHaveTextContent("revision: 4");
  await userEvent.keyboard("{Escape}"); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
} };
export const SaveFailureAndRetry: Story = { args: { scenario: "save-error" }, play: async ({ canvas }) => {
  await saveFinding(canvas, "합성 재시도 소견"); await waitFor(() => { expect(fixture.errors).toEqual([]); expect(fixture.commands.find(command => command.method === "PUT")?.body).toMatchObject({ resultId: fixture.result.id, expectedRevision: 3 }); expect(canvas.getByTestId("lab-overall-save-status")).toHaveTextContent("종합소견을 저장하지 못했습니다."); });
  await expect(canvas.getByRole("textbox", { name: "검사결과 종합소견" })).toHaveValue("합성 재시도 소견");
  await userEvent.click(canvas.getByRole("button", { name: "재시도" })); await waitFor(() => expect(canvas.getByTestId("lab-overall-save-status")).toHaveTextContent("저장됨"));
  const writes = fixture.commands.filter(command => command.method === "PUT"); await expect(writes).toHaveLength(2); await expect(writes[1].body).toEqual(writes[0].body);
} };
export const LostResponseReadback: Story = { args: { scenario: "lost-response" }, play: async ({ canvas }) => {
  await saveFinding(canvas, "합성 응답 유실 확인");
  await waitFor(() => expect(canvas.getByTestId("lab-overall-save-status")).toHaveTextContent("네트워크 오류로 저장하지 못했습니다."));
  await expect(fixture.state.overallRevision).toBe(4); await expect(canvas.getByRole("textbox", { name: "검사결과 종합소견" })).toHaveValue("합성 응답 유실 확인");
  await userEvent.click(canvas.getByRole("button", { name: "재시도" }));
  await waitFor(() => expect(canvas.getByTestId("lab-overall-save-status")).toHaveTextContent("저장됨"));
  const writes = fixture.commands.filter(command => command.method === "PUT"); await expect(writes).toHaveLength(2); await expect(writes[1].body).toEqual(writes[0].body); await expect(writes[0].body).toMatchObject({ expectedRevision: 3 }); await expect(fixture.state.overallRevision).toBe(4); await expect(fixture.state.events).toHaveLength(1);
} };
export const AttachmentCardListAndPreview: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas); const area = overall(canvas); const body = within(canvasElement.ownerDocument.body);
  await userEvent.hover(canvas.getByTestId("lab-overall-finding")); await userEvent.click(area.getByRole("button", { name: "목록 보기" }));
  await expect(area.getByRole("button", { name: "목록 보기" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(area.getByRole("button", { name: "첨부 파일 synthetic-note.txt" }));
  const viewerElement = await body.findByTestId("lab-attachment-viewer", {}, { timeout: 10000 });
  await waitFor(() => expect(viewerElement).toBeVisible());
  const viewer = within(viewerElement);
  await waitFor(() => expect(viewer.getByRole("region", { name: "텍스트 미리보기" })).toHaveTextContent("합성 첨부 문서"));
  await userEvent.type(viewer.getByRole("searchbox", { name: "텍스트에서 찾기" }), "합성"); await expect(viewer.getByLabelText("검색 결과 수")).toHaveTextContent("2개");
  await userEvent.click(viewer.getByRole("button", { name: "다운로드" })); await expect(fixture.downloads[0]).toContain("download=1");
  await userEvent.click(viewer.getByRole("button", { name: "다음 파일" })); await waitFor(() => expect(viewer.getByRole("region", { name: "CSV 표 미리보기" })).toHaveTextContent("synthetic A"));
  await userEvent.keyboard("{Escape}"); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  await userEvent.click(area.getByRole("button", { name: "카드 보기" })); await expect(area.getByRole("button", { name: "synthetic-table.csv 미리보기" })).toBeVisible();
  await expect(area.getByRole("button", { name: "첨부자료 일괄 다운로드 미지원" })).toBeDisabled();
} };
export const UploadSuccess: Story = { play: async ({ canvas }) => { await upload(canvas); await waitFor(() => expect(overall(canvas).getByRole("button", { name: "synthetic-upload.txt 미리보기" })).toBeVisible()); await expect(fixture.byteUploads).toHaveLength(1); await expect(fixture.byteUploads[0]).toMatchObject({ headers: { "x-upsert": "false" }, credentials: false }); await expect(fixture.commands.filter(command => command.body?.action === "finalize")).toHaveLength(1); } };
export const UploadFailureAndRetry: Story = { args: { scenario: "upload-error" }, play: async ({ canvas }) => { await upload(canvas); const area = overall(canvas); await userEvent.click(await area.findByRole("button", { name: "synthetic-upload.txt 업로드 재시도" })); await waitFor(() => expect(area.getByRole("button", { name: "synthetic-upload.txt 미리보기" })).toBeVisible()); await expect(fixture.commands.filter(command => command.body?.action === "discard")).toHaveLength(1); await expect(fixture.byteUploads).toHaveLength(2); } };
export const UploadProgressAndCancel: Story = { args: { scenario: "upload-hold" }, play: async ({ canvas }) => { await upload(canvas); const area = overall(canvas); await waitFor(() => expect(area.getByText("50%")).toBeVisible()); await userEvent.click(area.getByRole("button", { name: "synthetic-upload.txt 업로드 취소" })); await waitFor(() => expect(fixture.commands.filter(command => command.body?.action === "discard")).toHaveLength(1)); await expect(area.queryByRole("button", { name: "synthetic-upload.txt 미리보기" })).not.toBeInTheDocument(); await expect(fixture.state.attachments).toHaveLength(3); } };
export const CancelDuringFinalize: Story = { args: { scenario: "finalize-hold" }, play: async ({ canvas }) => { await upload(canvas); const area = overall(canvas); await waitFor(() => expect(fixture.commands.some(command => command.body?.action === "finalize")).toBe(true)); await userEvent.click(area.getByRole("button", { name: "synthetic-upload.txt 업로드 취소" })); fixture.releaseFinalize(); await waitFor(() => expect(fixture.commands.some(command => command.method === "DELETE")).toBe(true)); await waitFor(() => expect(fixture.state.attachments).toHaveLength(3)); await expect(area.queryByRole("button", { name: "synthetic-upload.txt 미리보기" })).not.toBeInTheDocument(); } };
export const DeleteCancelAndConfirm: Story = { play: async ({ canvas, canvasElement }) => {
  await ready(canvas); const area = overall(canvas); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(area.getByRole("button", { name: "synthetic-note.txt 작업 메뉴" })); await userEvent.click(await body.findByRole("menuitem", { name: "삭제" }));
  let dialog = within(await body.findByRole("dialog", { name: "첨부 파일 삭제" })); await userEvent.click(dialog.getByRole("button", { name: "취소" })); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  await expect(fixture.commands.some(command => command.method === "DELETE")).toBe(false);
  await userEvent.click(area.getByRole("button", { name: "synthetic-note.txt 작업 메뉴" })); await userEvent.click(await body.findByRole("menuitem", { name: "삭제" })); dialog = within(await body.findByRole("dialog", { name: "첨부 파일 삭제" })); await userEvent.click(dialog.getByRole("button", { name: "삭제" }));
  await waitFor(() => expect(area.queryByRole("button", { name: "synthetic-note.txt 미리보기" })).not.toBeInTheDocument()); await expect(fixture.state.attachments).toHaveLength(2);
} };
export const DeleteFailureAndRetry: Story = { args: { scenario: "delete-error" }, play: async ({ canvas, canvasElement }) => { await ready(canvas); const area = overall(canvas); const body = within(canvasElement.ownerDocument.body); await userEvent.click(area.getByRole("button", { name: "synthetic-note.txt 작업 메뉴" })); await userEvent.click(await body.findByRole("menuitem", { name: "삭제" })); const dialog = within(await body.findByRole("dialog", { name: "첨부 파일 삭제" })); await userEvent.click(dialog.getByRole("button", { name: "삭제" })); await expect(await dialog.findByRole("alert")).toHaveTextContent("삭제 결과를 확인하지 못했습니다."); await userEvent.click(dialog.getByRole("button", { name: "삭제" })); await waitFor(() => expect(area.queryByRole("button", { name: "synthetic-note.txt 미리보기" })).not.toBeInTheDocument()); } };
export const ReadErrorAndReload: Story = { args: { scenario: "read-error" }, play: async ({ canvas }) => { await waitFor(() => expect(canvas.getByLabelText("합성 결과 자료 상태")).toHaveTextContent("error")); await expect(canvas.getByRole("textbox", { name: "검사결과 종합소견" })).toBeDisabled(); await userEvent.click(canvas.getByRole("button", { name: "결과 자료 다시 불러오기" })); await ready(canvas); await expect(overall(canvas).getByRole("button", { name: "synthetic-note.txt 미리보기" })).toBeVisible(); } };
export const ReadOnly: Story = { args: { scenario: "readonly" }, play: async ({ canvas, canvasElement }) => { await ready(canvas); await expect(canvas.getByRole("textbox", { name: "검사 소견" })).toBeDisabled(); await expect(canvas.getByRole("textbox", { name: "검사결과 종합소견" })).toBeDisabled(); const area = overall(canvas); await expect(area.queryByRole("button", { name: "첨부 자료 추가" })).not.toBeInTheDocument(); await userEvent.click(area.getByRole("button", { name: "synthetic-note.txt 작업 메뉴" })); const body = within(canvasElement.ownerDocument.body); await body.findByRole("menuitem", { name: "미리보기" }); await expect(body.queryByRole("menuitem", { name: "삭제" })).not.toBeInTheDocument(); await userEvent.keyboard("{Escape}"); } };
export const EmptyAttachmentsAndHistory: Story = { args: { scenario: "empty" }, play: async ({ canvas, canvasElement }) => { await ready(canvas); await expect(overall(canvas).getByRole("button", { name: "첨부자료 업로드" })).toBeVisible(); await userEvent.click(canvas.getByRole("button", { name: "수정 이력" })); const body = within(canvasElement.ownerDocument.body); await waitFor(() => expect(body.getByText("기록된 수정 이력이 없습니다.")).toBeVisible()); await userEvent.keyboard("{Escape}"); } };
