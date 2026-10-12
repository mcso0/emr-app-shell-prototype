import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import type { LabResultAttachment } from "../use-lab-result-phase2";
import LabAttachmentViewer from "./lab-attachment-viewer";
import { syntheticImage, syntheticPdf } from "./lab-attachment-viewer.fixtures";

type ExampleArgs = {
  initialFile: "image" | "pdf" | "csv" | "txt" | "corrupt";
  canDelete: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onRevalidate: () => void;
};
const files: LabResultAttachment[] = [
  { id: "image", rowId: "sample-row", name: "밝은 이미지.png", mimeType: "image/png", size: 96_000, uploadedAt: "2026-10-04T00:00:00Z", uploadedByUserId: "synthetic" },
  { id: "pdf", rowId: "sample-row", name: "두 페이지 문서.pdf", mimeType: "application/pdf", size: 3173, uploadedAt: "2026-10-04T00:00:00Z", uploadedByUserId: "synthetic" },
  { id: "csv", rowId: "sample-row", name: "원문 데이터.csv", mimeType: "text/csv", size: 100, uploadedAt: "2026-10-04T00:00:00Z", uploadedByUserId: "synthetic" },
  { id: "txt", rowId: "sample-row", name: "텍스트 원문.txt", mimeType: "text/plain", size: 100, uploadedAt: "2026-10-04T00:00:00Z", uploadedByUserId: "synthetic" },
];
const urls: Record<string, string> = {
  image: syntheticImage,
  pdf: syntheticPdf,
  csv: `data:text/csv;charset=utf-8,${encodeURIComponent('항목,원본 값,단위\n001,3.5,mg/dL\n002,=1+1,"쉼표, 따옴표 ""원문"""\n003,<script>,원문 표시')}`,
  txt: `data:text/plain;charset=utf-8,${encodeURIComponent('합성 텍스트 원문\n\n<태그>도 실행하지 않고 그대로 보여 줍니다.\n선행 0: 001\n단위: 3.5 mg/dL\n\n찾기와 줄바꿈을 확인해 주세요.')}`,
  corrupt: "data:application/pdf;base64,JVBERi1jb3JydXB0",
};

function ViewerExample(args: ExampleArgs) {
  const [open, setOpen] = useState(true);
  const [item, setItem] = useState(() => files.find(file => file.id === args.initialFile) ?? files[1]);
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className="min-h-screen bg-[var(--emr-surface-workspace)] p-8">
    <p className="mb-4 text-sm">합성 첨부 자료 · 실제 뷰어 컴포넌트</p>
    <Button ref={trigger} onClick={() => setOpen(true)}>첨부 미리보기 열기</Button>
    {open ? <LabAttachmentViewer item={item} items={files} url={args.initialFile === "corrupt" ? urls.corrupt : urls[item.id]}
      scopeLabel="합성 항목" canDelete={args.canDelete} onSelect={setItem} onClose={() => setOpen(false)}
      onDownload={args.onDownload} onDelete={args.onDelete} onRevalidate={args.onRevalidate} returnFocus={() => trigger.current} /> : null}
  </div>;
}

const meta = {
  title: "Features/Lab/Attachment Viewer",
  component: ViewerExample,
  parameters: { layout: "fullscreen", docs: { story: { inline: false, height: "820px" }, description: { component: "검사결과에 첨부한 이미지, PDF, CSV, 텍스트의 읽기 전용 미리보기를 확인합니다. ViewerExample과 initialFile은 예제 설정입니다. 실제 LabAttachmentViewer는 item, items, url, scopeLabel과 이동, 닫기, 다운로드 등의 콜백을 받습니다. 이 예제는 로컬 합성 파일과 콜백을 사용합니다. 실제 파일 접근 권한과 삭제 확인은 결과지 기능에서 검증해 주세요." } } },
  args: { initialFile: "image", canDelete: true, onDownload: fn(), onDelete: fn(), onRevalidate: fn() },
  render: args => <ViewerExample key={`${args.initialFile}:${args.canDelete}`} {...args} />,
} satisfies Meta<typeof ViewerExample>;
export default meta;
type Story = StoryObj<typeof meta>;

async function waitForPdfPage(element: HTMLElement, page: number) {
  const dialog = within(element);
  // Document's worker load and Page's canvas render finish separately.
  await waitFor(() => {
    expect(dialog.queryByText("PDF를 표시할 수 없습니다.", { exact: true })).not.toBeInTheDocument();
    expect(dialog.getByLabelText("현재 PDF 페이지")).toHaveTextContent(`${page} / 2`);
    expect(element.querySelector(`[data-page-number="${page}"] canvas`)).toBeVisible();
  }, { timeout: 10000 });
}

export const Image: Story = {
  parameters: { docs: { description: { story: "이미지 배율을 바꾸고 파일 사이를 이동한 뒤 배율이 유지되는지 확인합니다." } } },
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole("dialog", { name: "밝은 이미지.png" });
    await within(dialog).findByRole("img");
    await userEvent.click(within(dialog).getByRole("button", { name: "1:1" }));
    await waitFor(() => expect(within(dialog).getByLabelText("이미지 배율")).toHaveTextContent("100%"));
    await userEvent.click(within(dialog).getByRole("button", { name: "다음 파일" }));
    await waitForPdfPage(dialog, 1);
    await userEvent.click(within(dialog).getByRole("button", { name: "이전 파일" }));
    await waitFor(() => expect(within(dialog).getByLabelText("이미지 배율")).toHaveTextContent("100%"));
  },
};
export const Pdf: Story = {
  parameters: { docs: { description: { story: "합성 두 페이지 PDF가 준비되면 다음 페이지로 이동하는지 확인합니다." } } },
  args: { initialFile: "pdf" },
  play: async () => {
    const body = within(document.body);
    const element = await body.findByRole("dialog", { name: "두 페이지 문서.pdf" });
    const dialog = within(element);
    await waitForPdfPage(element, 1);
    await userEvent.click(dialog.getByRole("button", { name: "다음" }));
    await waitForPdfPage(element, 2);
  },
};
export const Csv: Story = {
  parameters: { docs: { description: { story: "CSV의 선행 0, 수식처럼 보이는 값, 태그 문자열을 실행하지 않고 원문으로 표시하는지 확인합니다." } } },
  args: { initialFile: "csv" },
  play: async () => {
    const body = within(document.body);
    const dialog = within(await body.findByRole("dialog", { name: "원문 데이터.csv" }));
    await waitFor(() => expect(dialog.getByRole("cell", { name: "001" })).toBeVisible());
    await expect(dialog.getByRole("cell", { name: "=1+1" })).toBeVisible();
    await expect(dialog.getByRole("cell", { name: "<script>" })).toBeVisible();
  },
};
export const Text: Story = {
  parameters: { docs: { description: { story: "텍스트 원문을 표시하고 찾기 결과 수를 확인합니다." } } },
  args: { initialFile: "txt" },
  play: async () => {
    const body = within(document.body);
    const dialog = within(await body.findByRole("dialog", { name: "텍스트 원문.txt" }));
    await dialog.findByRole("region", { name: "텍스트 미리보기" });
    await userEvent.type(dialog.getByRole("searchbox", { name: "텍스트에서 찾기" }), "원문");
    await expect(dialog.getByLabelText("검색 결과 수")).toHaveTextContent("1개");
  },
};
export const ReadOnly: Story = {
  parameters: { docs: { description: { story: "삭제 권한이 없는 예제에서 삭제 버튼을 숨기는지 확인합니다." } } },
  args: { canDelete: false },
  play: async () => {
    const body = within(document.body);
    const dialog = within(await body.findByRole("dialog", { name: "밝은 이미지.png" }));
    await expect(dialog.queryByRole("button", { name: "삭제" })).toBeNull();
  },
};
export const CorruptPdf: Story = {
  parameters: { docs: { description: { story: "손상된 합성 PDF를 읽을 수 없을 때 오류 안내와 다시 읽기 버튼을 표시하는지 확인합니다." } } },
  args: { initialFile: "corrupt" },
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText("PDF를 표시할 수 없습니다.", { exact: true }, { timeout: 5000 })).toBeVisible();
    await expect(await body.findByRole("button", { name: "다시 읽기" })).toBeVisible();
  },
};
