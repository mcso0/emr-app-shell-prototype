import { useCallback, useId, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";

import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChartCollapsiblePanel, ChartPanelCollapseButton } from "./chart-collapsible-panel-group";
import { ChartPanelActionGroup, ChartPanelIconButton } from "./chart-figma-workspace";
import { ChartLineTabGroup } from "./chart-line-tab-group";

import { createDefaultSoapTemplateBlocks, createSystemSoapTemplateBlocks, type ChartSoapBlock, type ChartSoapPartialBlock } from "./chart-soap-block-schema";
import { ChartSoapLiveBlockEditor } from "./chart-soap-live-block-editor";
import type { uploadSoapAttachment } from "@/features/chart/soap-attachment-client";
import type { SoapAttachment } from "@/features/chart/soap-attachment-core";
import styles from "./chart-soap-live-block-editor.stories.module.css";

const emptyBlock: ChartSoapPartialBlock[] = [{ type: "paragraph" }];
const uploadedFixture = fn();
const toggleStorageBefore = new Map<string, string | null>();
function captureToggleStorage(blocks: readonly ChartSoapBlock[]) {
  for (const block of blocks) {
    const key = `toggle-${block.id}`;
    if (!toggleStorageBefore.has(key)) toggleStorageBefore.set(key, localStorage.getItem(key));
    captureToggleStorage(block.children);
  }
}
const selectionBlock: ChartSoapPartialBlock[] = [{ type: "paragraph", content: "보호자 진술과 진료 소견을 직접 기록합니다." }];
const nestedBlock: ChartSoapPartialBlock[] = [{
  type: "paragraph",
  content: "상위 기록",
  children: [{ type: "paragraph", content: "중첩 기록" }],
}];
const overflowingBlocks: ChartSoapPartialBlock[] = Array.from({ length: 16 }, (_, index) => ({
  type: "paragraph",
  content: `스크롤 페이드 확인용 기록 ${index + 1}`,
}));
const toggleHeadingBlock: ChartSoapPartialBlock[] = [{
  type: "heading",
  props: { level: 2, isToggleable: true },
  content: "접을 수 있는 기록",
  children: [{ type: "paragraph", content: "접었다 펼칠 상세 내용" }],
}];

type HarnessProps = {
  width: number;
  height?: number;
  initialContent?: ChartSoapPartialBlock[];
  disabled?: boolean;
  interactiveWidth?: boolean;
  allowSoapTemplateCommands?: boolean;
  withAttachmentScope?: boolean;
  withRecordSource?: boolean;
  uploadBehavior?: "success" | "fail-once" | "hang";
  toggleReadOnly?: boolean;
};

function LiveEditorHarness({
  width,
  height = 452,
  initialContent = emptyBlock,
  disabled = false,
  interactiveWidth = false,
  allowSoapTemplateCommands = false,
  withAttachmentScope = false,
  withRecordSource = false,
  uploadBehavior,
  toggleReadOnly = false,
}: HarnessProps) {
  const [activeWidth, setActiveWidth] = useState(width);
  const [activeTab, setActiveTab] = useState("기본 S/O");
  const [documentBlocks, setDocumentBlocks] = useState<readonly ChartSoapBlock[]>([]);
  const [notice, setNotice] = useState("로컬 Storybook 상태 · 서버 저장 안 함");
  const [readOnly, setReadOnly] = useState(disabled);
  const [collapsed, setCollapsed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const contentId = useId();
  const [documents, setDocuments] = useState<Record<string, ChartSoapPartialBlock[]>>({});
  const [stableContent, setStableContent] = useState(initialContent);
  const uploadAttemptsRef = useRef(0);
  const recordDocument = useCallback((blocks: readonly ChartSoapBlock[]) => {
    captureToggleStorage(blocks);
    setDocuments(current => ({ ...current, [activeTab]: [...blocks] }));
    setDocumentBlocks(blocks);
  }, [activeTab]);
  const selectTab = (tab: string) => {
    setStableContent(documents[tab] ?? (tab === "기본 S/O" ? initialContent : createSystemSoapTemplateBlocks()));
    setActiveTab(tab);
  };
  const mockUpload = useCallback(async ({ file, onProgress, signal }: Parameters<typeof uploadSoapAttachment>[0]) => {
    uploadedFixture(file.name);
    uploadAttemptsRef.current += 1;
    onProgress?.(42);
    await new Promise<void>((resolve, reject) => {
      const timer = uploadBehavior === "hang" ? null : window.setTimeout(resolve, 40);
      signal?.addEventListener("abort", () => {
        if (timer !== null) window.clearTimeout(timer);
        reject(new DOMException("Upload cancelled", "AbortError"));
      }, { once: true });
    });
    if (uploadBehavior === "fail-once" && uploadAttemptsRef.current === 1) throw new Error("attachment_upload_failed");
    return {
      id: "storybook-attachment",
      url: "/api/workspaces/workspace-example/chart/soap-attachments/storybook-attachment?encounterId=encounter-example",
      mimeType: file.type as SoapAttachment["mimeType"],
      name: file.name,
      size: file.size,
    };
  }, [uploadBehavior]);

  return <main className={styles.stage}>
    {interactiveWidth ? <div className={styles.widthControls} aria-label="SOAP 패널 너비 선택">
      {[320, 420, 566.5, 720].map((option) => <button key={option} type="button" aria-pressed={activeWidth === option} onClick={() => setActiveWidth(option)}>{option}px</button>)}
    </div> : null}
    {toggleReadOnly ? <button type="button" onClick={() => setReadOnly((current) => !current)}>읽기 전용 전환</button> : null}
    <div style={{ width: `${activeWidth}px`, height: `${height}px`, maxWidth: "100%" }} aria-label={`${activeWidth}px SOAP 에디터 검토 프레임`} data-testid="soap-story-frame">
    <ChartCollapsiblePanel collapsed={collapsed} contentId={contentId} label="S/O" panelId="soap" onCollapsedChange={setCollapsed}>
    <section className={`${styles.frame} group/chart-panel`} style={{ width: "100%", height: "100%" }}>
      <header className={styles.header}>
        <h1>Subject/Object</h1>
        <ChartPanelActionGroup>
          <ChartPanelCollapseButton contentId={contentId} label="S/O" panelId="soap" onCollapse={() => setCollapsed(true)} />
          <ChartPanelIconButton label="패널 확대 준비 중" disabled />
          <Button size="icon-xs" variant="ghost" aria-label="S/O 추가" title="진단계통 카탈로그 조회 전" disabled><CdsActionsPlusIcon /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-xs" variant="ghost" aria-label="SOAP 작업"><CdsFilesMoreHorizontalIcon /></Button>} />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem disabled={readOnly} onClick={() => setResetOpen(true)}>내용 초기화</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>이미지 · 동영상 연동 준비 중</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ChartPanelActionGroup>
      </header>
      <div className="relative flex h-[45px] min-h-[45px] shrink-0 items-stretch border-b px-3">
        <ChartLineTabGroup aria-label="진단계통 탭" items={["기본 S/O", "진단계통명A", "진단계통명B"].map(tab => ({ value: tab, label: tab }))} value={activeTab} onValueChange={selectTab} />
      </div>
      <div className={styles.editorSlot} id="chart-soap-editor-panel" role="tabpanel" aria-label={activeTab}>
        <ChartSoapLiveBlockEditor
          key={`${activeTab}:${resetVersion}`}
          allowSoapTemplateCommands={allowSoapTemplateCommands}
          disabled={readOnly}
          encounterId={withAttachmentScope ? "encounter-example" : undefined}
          initialContent={stableContent}
          onDocumentChange={recordDocument}
          onNotice={setNotice}
          onReady={recordDocument}
          uploadAttachment={mockUpload}
          recordInsertionItems={[{ id: "example-prior-assessment", label: "이전 진료 평가", sourceLabel: "예시 · 이전 SOAP Assessment", text: "평가: [원본 확인 후 입력]" }]}
          recordSources={withRecordSource ? [{ id: "example-prior-soap", label: "이전 진료 SOAP", sourceLabel: "예시 날짜 · 이전 SOAP", load: async () => [
            { id: "example-subjective", label: "S · 주관적", sourceLabel: "예시 날짜 · 이전 SOAP", text: "보호자 진술: [원본 확인 후 입력]" },
            { id: "example-plan", label: "P · 계획", sourceLabel: "예시 날짜 · 이전 SOAP", text: "추적 계획: [원본 확인 후 입력]" },
          ] }] : []}
          workspaceId={withAttachmentScope ? "workspace-example" : undefined}
        />
      </div>
    </section>
    </ChartCollapsiblePanel>
    </div>
    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
      <DialogContent><DialogHeader><DialogTitle>S/O 내용 초기화</DialogTitle><DialogDescription>현재 합성 탭의 문서를 비웁니다. 서버 저장은 실행하지 않습니다.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setResetOpen(false)}>취소</Button><Button disabled={readOnly} onClick={() => { setDocuments(current => ({ ...current, [activeTab]: emptyBlock })); setStableContent(emptyBlock); setResetVersion(version => version + 1); setResetOpen(false); }}>초기화</Button></DialogFooter></DialogContent>
    </Dialog>
    <div className={styles.localState} role="status" aria-live="polite"><span>{notice}</span><span>{documentBlocks.length}개 최상위 블록</span></div>
    <output data-testid="soap-document-json" className="sr-only">{JSON.stringify(documentBlocks)}</output>
  </main>;
}

const meta = {
  title: "Features/Chart/SOAP/Live BlockNote Figma prototype",
  component: LiveEditorHarness,
  beforeEach: () => {
    uploadedFixture.mockClear(); toggleStorageBefore.clear();
    return () => { for (const [key, value] of toggleStorageBefore) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } toggleStorageBefore.clear(); };
  },
  render: (args) => <LiveEditorHarness key={JSON.stringify(args)} {...args} />,
  args: { width: 566.5, initialContent: emptyBlock },
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "650px" }, description: { component: "운영 ChartSoapLiveBlockEditor와 실제 ChartCollapsiblePanel·ChartPanelActionGroup·ChartLineTabGroup을 합성 문서로 연결합니다. 탭별 로컬 문서, 패널 접기·펼치기와 초기화·취소가 동작합니다. 확대는 실제 main의 준비 중 상태이며 S/O 추가는 진단계통 카탈로그 조회 전 상태로 비활성입니다. 합성 진단계통 탭은 기존 scope 비교용입니다. LiveEditorHarness의 width, height, interactiveWidth, withAttachmentScope, withRecordSource, uploadBehavior, toggleReadOnly는 예제 설정입니다. 서버 저장·카탈로그·완료 차트 정정과 권한은 전체 SoapPanel 호출 기능의 책임입니다. 기록은 서버에 저장되지 않습니다." } },
  },
} satisfies Meta<typeof LiveEditorHarness>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RepresentativeReview: Story = {
  parameters: { docs: { description: { story: "합성 SOAP 문서와 너비 전환 버튼으로 대표 편집 화면을 확인합니다." } } },
  args: { width: 566.5, initialContent: createDefaultSoapTemplateBlocks(), interactiveWidth: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("toolbar", { name: "SOAP 문서 편집 도구" })).toBeVisible();
    await expect(canvas.getByRole("textbox")).not.toHaveFocus();
    await expect(canvasElement.querySelector(".ProseMirror-selectednode")).toBeNull();
    await expect(canvas.getByText("주관적 · 보호자 진술")).toBeVisible();
    for (const paragraph of canvasElement.querySelectorAll('.bn-block-content[data-content-type="paragraph"]')) {
      await expect(paragraph.textContent?.trim()).toBe("");
    }
    await expect(canvasElement.querySelector(".bn-side-menu")).toBeNull();
    await expect(canvasElement.querySelector(".bn-formatting-toolbar")).toBeNull();
    const paragraph = canvasElement.querySelector<HTMLElement>('.bn-block-content[data-content-type="paragraph"] .bn-inline-content')!;
    await userEvent.click(paragraph); await userEvent.type(paragraph, "합성 탭 보존");
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent("합성 탭 보존"));
    await userEvent.click(canvas.getByRole("tab", { name: "진단계통명A" }));
    await expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent("합성 탭 보존");
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(canvas.getByRole("tab", { name: "기본 S/O" })).toHaveFocus());
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent("합성 탭 보존");
    await userEvent.hover(canvas.getByTestId("soap-story-frame"));
    await userEvent.click(canvas.getByRole("button", { name: "S/O 패널 접기" }));
    await waitFor(() => expect(canvas.queryByRole("textbox")).not.toBeInTheDocument());
    const expand = canvas.getByRole("button", { name: "S/O 패널 펼치기" });
    expand.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByRole("textbox")).toBeVisible());
    await expect(canvas.getByRole("button", { name: "S/O 추가" })).toBeDisabled();
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "SOAP 작업" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "내용 초기화" }));
    await userEvent.click(within(await body.findByRole("dialog")).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent("합성 탭 보존");
    await userEvent.click(canvas.getByRole("button", { name: "SOAP 작업" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "내용 초기화" }));
    await userEvent.click(within(await body.findByRole("dialog")).getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent("합성 탭 보존"));
  },
};

export const ReferencePanelGeometry476: Story = {
  parameters: { docs: { description: { story: "476.5px 너비와 373px 높이의 기준 패널에서 편집 영역 배치를 확인합니다." } } },
  args: { width: 476.5, height: 373, initialContent: emptyBlock },
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement).getByTestId("soap-story-frame");
    const wrap = canvasElement.querySelector<HTMLElement>("[data-toolbar-wrap]");
    const shell = canvasElement.querySelector<HTMLElement>("[data-toolbar-shell]");
    const button = canvasElement.querySelector<HTMLElement>('[data-toolbar-control="style"]');
    const editor = canvasElement.querySelector<HTMLElement>(".bn-editor");
    const outerBlock = canvasElement.querySelector<HTMLElement>(".bn-block-outer");
    const blockContent = canvasElement.querySelector<HTMLElement>('.bn-block-content[data-content-type="paragraph"]');
    const inlineContent = canvasElement.querySelector<HTMLElement>(".bn-inline-content");
    if (!wrap || !shell || !button || !editor || !outerBlock || !blockContent || !inlineContent) {
      throw new Error("S/O 도구 또는 편집기 geometry 요소를 찾지 못했습니다.");
    }
    await expect(frame.getBoundingClientRect().width).toBe(476.5);
    await expect(frame.getBoundingClientRect().height).toBe(373);
    await expect(wrap.getBoundingClientRect().height).toBe(58);
    await expect(shell.getBoundingClientRect().height).toBe(42);
    await expect(button.getBoundingClientRect().width).toBe(32);
    await expect(button.getBoundingClientRect().height).toBe(32);
    await expect(getComputedStyle(editor).paddingTop).toBe("4px");
    await expect(getComputedStyle(editor).paddingLeft).toBe("16px");
    await expect(getComputedStyle(outerBlock).lineHeight).toBe("22px");
    await expect(getComputedStyle(blockContent).paddingTop).toBe("0px");
    await expect(getComputedStyle(inlineContent).paddingLeft).toBe("0px");
    await expect(getComputedStyle(blockContent, "::after").content).toContain("S/O 내용을 입력해주세요");
    await expect(getComputedStyle(blockContent, "::after").fontStyle).toBe("normal");
  },
};

export const PlaceholderAfterClearing: Story = {
  parameters: { docs: { description: { story: "기존 내용을 모두 지운 뒤 빈 문서 안내가 다시 표시되는지 확인합니다." } } },
  args: { width: 476.5, height: 373, initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector<HTMLElement>('.bn-block-content[data-content-type="paragraph"] .bn-inline-content');
    const editor = canvasElement.querySelector<HTMLElement>(".bn-editor");
    const blockContent = canvasElement.querySelector<HTMLElement>('.bn-block-content[data-content-type="paragraph"]');
    if (!text || !editor || !blockContent) throw new Error("입력 placeholder 대상 편집기를 찾지 못했습니다.");
    await userEvent.click(text);
    const selection = canvasElement.ownerDocument.getSelection();
    const range = canvasElement.ownerDocument.createRange();
    range.selectNodeContents(text);
    selection?.removeAllRanges();
    selection?.addRange(range);
    await userEvent.keyboard("{Backspace}");
    await waitFor(() => expect(text.textContent).toBe(""));
    await expect(getComputedStyle(blockContent, "::after").content).toContain("S/O 내용을 입력해주세요");
    await expect(getComputedStyle(blockContent, "::after").fontStyle).toBe("normal");
  },
};

export const OverflowingDocumentScrollFade: Story = {
  parameters: { docs: { description: { story: "긴 합성 문서의 스크롤과 가장자리 페이드를 확인합니다." } } },
  args: { width: 566.5, initialContent: overflowingBlocks },
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(".bn-container");
    if (!viewport) throw new Error("SOAP 에디터 스크롤 viewport를 찾지 못했습니다.");
    await waitFor(() => expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight));
    await expect(viewport).toHaveClass("scroll-fade-y");
    await expect(viewport).toHaveClass("scroll-fade-8");
    await expect(getComputedStyle(viewport).maskImage).not.toBe("none");
    await expect(Number.parseFloat(getComputedStyle(viewport).getPropertyValue("--scroll-fade-b"))).toBeGreaterThan(0);
    viewport.scrollTop = viewport.scrollHeight;
    await waitFor(() => expect(viewport.scrollTop + viewport.clientHeight).toBeGreaterThanOrEqual(viewport.scrollHeight - 1));
    await waitFor(() => expect(Number.parseFloat(getComputedStyle(viewport).getPropertyValue("--scroll-fade-b"))).toBe(0));
  },
};

export const ResponsiveNarrow320: Story = {
  parameters: { docs: { description: { story: "320px 너비에서 도구가 넘칠 때 더보기와 편집 영역을 확인합니다." } } },
  args: { width: 320, initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const toolbar = canvas.getByRole("toolbar", { name: "SOAP 문서 편집 도구" });
    await expect(toolbar.getBoundingClientRect().width).toBeLessThanOrEqual(320);
    await userEvent.click(canvas.getByRole("button", { name: "서식 도구 더보기" }));
    const menu = documentBody.getByRole("menu", { name: "서식 도구 더보기" });
    await waitFor(() => expect(menu).toBeVisible());
    await expect(documentBody.queryByRole("heading", { name: "가려진 서식 도구" })).toBeNull();
    await expect(menu).toHaveAttribute("data-slot", "dropdown-menu-content");
    await waitFor(() => expect(menu.getBoundingClientRect().width).toBe(160));
    let labelStart: number | undefined;
    for (const item of menu.querySelectorAll<HTMLElement>("[data-overflow-tool-id]")) {
      const icon = item.querySelector<HTMLElement>("[data-toolbar-menu-icon]");
      const label = item.querySelector<HTMLElement>("[data-toolbar-menu-label]");
      if (!icon || !label) throw new Error("SOAP 메뉴의 아이콘/텍스트 영역을 찾지 못했습니다.");
      await expect(getComputedStyle(item).justifyContent).toBe("flex-start");
      await expect(icon.getBoundingClientRect().left - item.getBoundingClientRect().left).toBeLessThanOrEqual(8);
      await expect(icon.getBoundingClientRect().width).toBe(16);
      await expect(icon.getBoundingClientRect().height).toBe(16);
      await expect(icon.querySelector("svg")).not.toBeNull();
      await expect(getComputedStyle(label).textAlign).toBe("left");
      labelStart ??= label.getBoundingClientRect().left;
      await expect(Math.abs(label.getBoundingClientRect().left - labelStart)).toBeLessThan(0.5);
    }
    await userEvent.keyboard("{ArrowDown}{End}");
    await expect(within(menu).getByRole("menuitem", { name: "기록 삽입" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(menu.querySelector("[data-overflow-tool-id]")).toHaveFocus();
    await expect(within(menu).getByRole("menuitem", { name: "구분선" })).toBeVisible();
    const snapshot = Array.from(menu.querySelectorAll<HTMLElement>("[data-overflow-tool-id]"), (item) => item.dataset.overflowToolId);
    const viewport = canvasElement.querySelector<HTMLElement>("[data-toolbar-viewport]");
    if (!viewport) throw new Error("SOAP 도구 scroll viewport를 찾지 못했습니다.");
    const initialFade = canvasElement.querySelector<HTMLElement>('[data-toolbar-fade="right"]');
    if (!initialFade) throw new Error("SOAP 도구의 오른쪽 페이드를 찾지 못했습니다.");
    const initialFadeRight = initialFade.getBoundingClientRect().right;
    await expect(getComputedStyle(initialFade).pointerEvents).toBe("none");
    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    fireEvent.scroll(viewport);
    await waitFor(() => expect(Array.from(menu.querySelectorAll<HTMLElement>("[data-overflow-tool-id]"), (item) => item.dataset.overflowToolId)).toEqual(snapshot));
    const leftFade = canvasElement.querySelector<HTMLElement>('[data-toolbar-fade="left"]');
    if (!leftFade) throw new Error("SOAP 도구의 왼쪽 페이드를 찾지 못했습니다.");
    await expect(Math.abs(leftFade.getBoundingClientRect().left - viewport.getBoundingClientRect().left)).toBeLessThanOrEqual(2);
    await expect(Math.abs(initialFade.getBoundingClientRect().right - initialFadeRight)).toBeLessThanOrEqual(0.5);
    viewport.scrollLeft = viewport.scrollWidth;
    fireEvent.scroll(viewport);
    await waitFor(() => expect(canvasElement.querySelector('[data-toolbar-fade="right"]')).toBeNull());
    await expect(Math.abs(leftFade.getBoundingClientRect().left - viewport.getBoundingClientRect().left)).toBeLessThanOrEqual(2);
    await userEvent.keyboard("{Escape}");
    await expect(menu).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "서식 도구 더보기" })).toHaveFocus();
  },
};

export const ResponsivePanel420: Story = {
  parameters: { docs: { description: { story: "420px 너비의 편집 화면 배치를 확인합니다." } } }, args: { width: 420, initialContent: selectionBlock } };
export const ResponsiveWide720: Story = {
  parameters: { docs: { description: { story: "720px 너비의 편집 화면 배치를 확인합니다." } } }, args: { width: 720, initialContent: selectionBlock } };
export const ResponsiveAllTools1000: Story = {
  parameters: { docs: { description: { story: "1000px 너비에서 도구 표시와 배치를 확인합니다." } } },
  args: { width: 1000, initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.queryByRole("button", { name: "서식 도구 더보기" })).toBeNull());
    await expect(canvas.getByRole("button", { name: "표 삽입" })).toBeVisible();
    const toolbar = canvas.getByRole("toolbar", { name: "SOAP 문서 편집 도구" });
    await expect(toolbar.getBoundingClientRect().height).toBe(58);
  },
};

export const OverflowThresholdDoesNotReserveMore: Story = {
  parameters: { docs: { description: { story: "도구가 충분히 들어가는 너비에서는 더보기 공간을 불필요하게 남기지 않는지 확인합니다." } } },
  args: { width: 1000, initialContent: emptyBlock },
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement).getByTestId("soap-story-frame");
    const wrap = canvasElement.querySelector<HTMLElement>("[data-toolbar-wrap]");
    const track = canvasElement.querySelector<HTMLElement>("[data-toolbar-track]");
    const shell = canvasElement.querySelector<HTMLElement>("[data-toolbar-shell]");
    if (!wrap || !track || !shell) throw new Error("SOAP 도구의 overflow geometry 요소를 찾지 못했습니다.");
    const thresholdWidth = Math.ceil(track.getBoundingClientRect().width + 36);
    frame.style.width = `${thresholdWidth}px`;
    await waitFor(() => expect(shell).toHaveAttribute("data-overflow", "false"));
    await expect(within(canvasElement).queryByRole("button", { name: "서식 도구 더보기" })).toBeNull();
    frame.style.width = `${thresholdWidth - 1}px`;
    await waitFor(() => expect(shell).toHaveAttribute("data-overflow", "true"));
    await expect(within(canvasElement).getByRole("button", { name: "서식 도구 더보기" })).toBeVisible();
  },
};

export const PartialOverflowToolActivation: Story = {
  parameters: { docs: { description: { story: "일부 도구가 더보기로 이동한 상태에서도 해당 명령을 실행하는지 확인합니다." } } },
  args: { width: 320, initialContent: emptyBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>("[data-toolbar-viewport]");
    const target = canvas.getByRole("button", { name: "번호 목록" });
    if (!viewport) throw new Error("SOAP 도구 scroll viewport를 찾지 못했습니다.");
    const initialTarget = target.getBoundingClientRect();
    const initialViewport = viewport.getBoundingClientRect();
    const visibleRight = initialViewport.right;
    const targetContentRight = initialTarget.right + viewport.scrollLeft;
    const partialScrollLeft = Math.max(0, targetContentRight - (visibleRight + 16));
    viewport.scrollLeft = partialScrollLeft;
    fireEvent.scroll(viewport);
    await waitFor(() => {
      const targetBounds = target.getBoundingClientRect();
      expect(targetBounds.left).toBeLessThan(visibleRight);
      expect(targetBounds.right).toBeGreaterThan(visibleRight);
    });
    const before = canvas.getByTestId("soap-document-json").textContent;
    const partialBounds = target.getBoundingClientRect();
    fireEvent.mouseDown(target, { button: 0, clientX: visibleRight - 8, clientY: partialBounds.top + partialBounds.height / 2 });
    fireEvent.mouseUp(target, { button: 0, clientX: visibleRight - 8, clientY: partialBounds.top + partialBounds.height / 2 });
    fireEvent.click(target, { button: 0, clientX: visibleRight - 8, clientY: partialBounds.top + partialBounds.height / 2 });
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"numberedListItem"'));
    await expect(canvas.getByTestId("soap-document-json").textContent).not.toBe(before);
    await waitFor(() => expect(target.getBoundingClientRect().right).toBeLessThanOrEqual(viewport.getBoundingClientRect().right + 1));
  },
};

export const ToolbarRovingKeyboard: Story = {
  parameters: { docs: { description: { story: "키보드로 도구 모음의 포커스를 이동하고 명령을 실행하는지 확인합니다." } } },
  args: { width: 1000, initialContent: emptyBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = canvas.getByRole("toolbar", { name: "SOAP 문서 편집 도구" });
    const styleButton = canvas.getByRole("button", { name: "문단 스타일" });
    const bulletButton = canvas.getByRole("button", { name: "글머리 목록" });
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"paragraph"'));
    const initialDocument = canvas.getByTestId("soap-document-json").textContent;
    const tabStops = toolbar.querySelectorAll('button[data-toolbar-control][tabindex="0"]');
    await expect(tabStops).toHaveLength(1);
    styleButton.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(bulletButton).toHaveFocus();
    await expect(canvas.getByTestId("soap-document-json").textContent).toBe(initialDocument);
    await userEvent.keyboard(" ");
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"bulletListItem"'));
    await expect(canvas.getByRole("textbox")).toHaveFocus();
    styleButton.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByRole("menu", { name: "style" })).toBeVisible());
  },
};

export const FormattingAndHistory: Story = {
  parameters: { docs: { description: { story: "선택한 텍스트의 서식과 실행 취소, 다시 실행 동작을 확인합니다." } } },
  args: { initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent("보호자 진술과 진료 소견을 직접 기록합니다."));
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await waitFor(() => expect(editor).toHaveFocus());
    const text = canvasElement.querySelector<HTMLElement>('.bn-block-content[data-content-type="paragraph"] .bn-inline-content');
    if (!text?.firstChild) throw new Error("서식 선택 대상을 찾지 못했습니다.");
    const selection = canvasElement.ownerDocument.getSelection();
    const range = canvasElement.ownerDocument.createRange();
    range.selectNodeContents(text);
    selection?.removeAllRanges();
    selection?.addRange(range);
    canvasElement.ownerDocument.dispatchEvent(new Event("selectionchange"));
    await waitFor(() => expect(selection?.toString()).toBe("보호자 진술과 진료 소견을 직접 기록합니다."));
    await userEvent.click(canvas.getByRole("button", { name: "굵게" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "굵게" })).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"bold":true'));
    await waitFor(() => expect(canvas.getByRole("textbox")).toHaveFocus());
    await expect(selection?.toString()).toBe("보호자 진술과 진료 소견을 직접 기록합니다.");
    await userEvent.click(canvas.getByRole("button", { name: "실행 취소" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent('"bold":true'));
    await userEvent.click(canvas.getByRole("button", { name: "다시 실행" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"bold":true'));
    await waitFor(() => expect(canvas.getByRole("textbox")).toHaveFocus());
  },
};

export const OverflowFormattingAndLink: Story = {
  parameters: { docs: { description: { story: "좁은 화면에서 더보기 서식 도구와 링크 입력을 확인합니다." } } },
  args: { width: 320, initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const text = canvasElement.querySelector<HTMLElement>('.bn-block-content[data-content-type="paragraph"] .bn-inline-content');
    if (!text) throw new Error("서식 선택 대상을 찾지 못했습니다.");
    const selection = canvasElement.ownerDocument.getSelection();
    const range = canvasElement.ownerDocument.createRange();
    range.selectNodeContents(text);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const more = canvas.getByRole("button", { name: "서식 도구 더보기" });
    await userEvent.click(more);
    await userEvent.click(await body.findByRole("menuitemcheckbox", { name: "기울임" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"italic":true'));
    await waitFor(() => expect(canvas.getByRole("textbox")).toHaveFocus());
    await expect(selection?.toString()).toBe("보호자 진술과 진료 소견을 직접 기록합니다.");
    const viewport = canvasElement.querySelector<HTMLElement>("[data-toolbar-viewport]");
    if (!viewport) throw new Error("SOAP 도구 scroll viewport를 찾지 못했습니다.");
    viewport.scrollLeft = 0;
    fireEvent.scroll(viewport);
    await waitFor(() => expect(canvasElement.querySelector('[data-toolbar-fade="left"]')).toBeNull());
    await userEvent.click(more);
    await expect(await body.findByRole("menuitemcheckbox", { name: "기울임" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(body.getByRole("menuitem", { name: "링크 삽입" }));
    const url = await body.findByLabelText("링크 주소");
    await waitFor(() => expect(url).toHaveFocus());
    const popup = url.closest('[data-slot="popover-content"]');
    if (!popup) throw new Error("링크 입력 패널을 찾지 못했습니다.");
    await waitFor(() => expect(Math.abs(popup.getBoundingClientRect().right - more.getBoundingClientRect().right)).toBeLessThanOrEqual(1));
    await userEvent.keyboard("{Escape}");
    await expect(more).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(body.getByRole("menu", { name: "서식 도구 더보기" })).toBeVisible());
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"italic":true');
    await userEvent.keyboard("{Escape}");
    await expect(more).toHaveFocus();
  },
};

export const BlockStylesAndPlainAids: Story = {
  parameters: { docs: { description: { story: "블록 스타일과 일반 텍스트 작성 도움말을 문서에 적용하는지 확인합니다." } } },
  args: { initialContent: emptyBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "문단 스타일" }));
    await userEvent.click(documentBody.getByRole("menuitemradio", { name: "제목 2" }));
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"heading"');
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"level":2');
    await userEvent.click(canvas.getByRole("button", { name: "상용구" }));
    await userEvent.click(documentBody.getByRole("menuitem", { name: "증상 경과" }));
    await expect(canvas.getByRole("textbox")).toHaveTextContent("증상 시작: [입력]");
    await expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent('"type":"soapSection"');
  },
};

export const BoundedTableInsertion: Story = {
  parameters: { docs: { description: { story: "표 삽입 선택 영역과 문서 삽입 동작을 확인합니다." } } },
  args: { initialContent: emptyBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "서식 도구 더보기" }));
    await userEvent.click(await documentBody.findByRole("menuitem", { name: "표 삽입" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"table"'));
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"tableContent"');
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"tableCell"');
    await expect(canvasElement.querySelectorAll(".bn-block-content[data-content-type='table'] tr")).toHaveLength(2);
    const firstCell = canvasElement.querySelector<HTMLElement>(".bn-block-content[data-content-type='table'] td");
    if (!firstCell) throw new Error("삽입한 표의 첫 셀을 찾지 못했습니다.");
    await userEvent.click(firstCell);
    await userEvent.type(firstCell, "표 셀 내용");
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"text":"표 셀 내용"');
    await userEvent.click(canvas.getByRole("button", { name: "문단 스타일" }));
    await userEvent.click(documentBody.getByRole("menuitemradio", { name: "제목 2" }));
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"table"');
  },
};

export const PriorRecordInsertion: Story = {
  parameters: { docs: { description: { story: "합성 이전 진료 기록을 현재 문서에 넣는 동작을 확인합니다." } } },
  args: { initialContent: emptyBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const recordButton = canvas.queryByRole("button", { name: "기록 삽입" });
    if (recordButton) await userEvent.click(recordButton);
    else {
      await userEvent.click(canvas.getByRole("button", { name: "서식 도구 더보기" }));
      await userEvent.click(documentBody.getByRole("menuitem", { name: "기록 삽입" }));
    }
    await userEvent.click(documentBody.getByRole("menuitem", { name: /이전 진료 평가/ }));
    await expect(canvas.getByRole("textbox")).toHaveTextContent("예시 · 이전 SOAP Assessment");
    await expect(canvas.getByRole("textbox")).toHaveTextContent("평가: [원본 확인 후 입력]");
  },
};

export const PriorSoapFieldSelection: Story = {
  parameters: { docs: { description: { story: "합성 이전 SOAP의 항목을 골라 문서에 넣는 동작을 확인합니다." } } },
  args: { initialContent: emptyBlock, withRecordSource: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "기록 삽입" }));
    await userEvent.click(documentBody.getByRole("menuitem", { name: /이전 진료 SOAP/ }));
    await userEvent.click(await documentBody.findByRole("menuitem", { name: /S · 주관적/ }));
    await expect(canvas.getByRole("textbox")).toHaveTextContent("보호자 진술: [원본 확인 후 입력]");
    await expect(canvas.getByRole("textbox")).not.toHaveTextContent("추적 계획: [원본 확인 후 입력]");
  },
};

export const AttachmentSelection: Story = {
  parameters: { docs: { description: { story: "합성 범위에서 첨부 파일 선택 화면을 확인합니다. 실제 파일 저장은 수행하지 않습니다." } } },
  args: { initialContent: emptyBlock, withAttachmentScope: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("사진 첨부 파일 선택");
    await userEvent.upload(input, new File(["sample"], "example.png", { type: "image/png" }));
    await expect(canvas.getByText("example.png")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "첨부 저장" })).toBeVisible();
    await expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent('"type":"image"');
    await userEvent.type(canvas.getByLabelText("설명"), "예시 사진");
    await fireEvent.change(canvas.getByLabelText("촬영/기록 날짜"), { target: { value: "2026-09-22" } });
    await expect(canvas.getByLabelText("설명")).toHaveValue("예시 사진");
    await userEvent.click(canvas.getByRole("button", { name: "첨부 저장" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"image"'));
    await expect(uploadedFixture).toHaveBeenCalledWith("example.png");
  },
};

export const AttachmentUploadSuccess: Story = {
  parameters: { docs: { description: { story: "합성 업로드 콜백의 진행과 성공 후 첨부 표시를 확인합니다." } } },
  args: { initialContent: emptyBlock, withAttachmentScope: true, uploadBehavior: "success" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText("사진 첨부 파일 선택"), new File(["image"], "example.png", { type: "image/png" }));
    await userEvent.type(canvas.getByLabelText("설명"), "예시 사진");
    await fireEvent.change(canvas.getByLabelText("촬영/기록 날짜"), { target: { value: "2026-09-22" } });
    await userEvent.click(canvas.getByRole("button", { name: "첨부 저장" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"image"'));
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent("soap-attachments/storybook-attachment?encounterId=encounter-example");
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent("촬영/기록: 2026-09-22 · 설명: 예시 사진");
    await expect(canvas.getByText(/차트 저장 상태를 확인해 주세요/)).toBeVisible();
  },
};

export const AttachmentFailureRetry: Story = {
  parameters: { docs: { description: { story: "합성 업로드가 한 번 실패한 뒤 다시 시도하는 동작을 확인합니다." } } },
  args: { initialContent: emptyBlock, withAttachmentScope: true, uploadBehavior: "fail-once" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText("영상 첨부 파일 선택"), new File(["video"], "example.webm", { type: "video/webm" }));
    await userEvent.click(canvas.getByRole("button", { name: "첨부 저장" }));
    await expect(await canvas.findByRole("button", { name: "재시도" })).toBeVisible();
    await expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent('"type":"video"');
    await userEvent.click(canvas.getByRole("button", { name: "재시도" }));
    await waitFor(() => expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"type":"video"'));
  },
};

export const AttachmentCancelAndReadOnly: Story = {
  parameters: { docs: { description: { story: "진행 중인 합성 업로드를 취소하고 읽기 전용으로 전환하는 동작을 확인합니다." } } },
  args: { initialContent: emptyBlock, withAttachmentScope: true, uploadBehavior: "hang", toggleReadOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText("사진 첨부 파일 선택"), new File(["image"], "example.png", { type: "image/png" }));
    await userEvent.click(canvas.getByRole("button", { name: "첨부 저장" }));
    await userEvent.click(canvas.getByRole("button", { name: "취소" }));
    await expect(canvas.getByRole("button", { name: "첨부 저장" })).toBeVisible();
    await expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent('"type":"image"');
    await userEvent.click(canvas.getByRole("button", { name: "첨부 저장" }));
    await userEvent.click(canvas.getByRole("button", { name: "읽기 전용 전환" }));
    await expect(canvas.queryByRole("toolbar", { name: "SOAP 문서 편집 도구" })).toBeNull();
    await expect(canvas.getByTestId("soap-document-json")).not.toHaveTextContent('"type":"image"');
  },
};

export const NestedBlockAndToggleHeading: Story = {
  parameters: { docs: { description: { story: "중첩 블록과 접을 수 있는 제목의 표시를 확인합니다." } } },
  args: { initialContent: nestedBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox")).toHaveTextContent("중첩 기록");
    await expect(canvas.getByTestId("soap-document-json")).toHaveTextContent('"children"');
  },
};

export const ToggleHeadingCollapseBehavior: Story = {
  parameters: { docs: { description: { story: "실제 제목 토글의 클릭·Enter·Space가 하위 기록의 표시만 바꾸고 문서 JSON과 포커스를 보존하는지 확인합니다. 합성 toggle 저장 키는 종료 시 복원합니다." } } },
  args: { initialContent: toggleHeadingBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox")).toHaveTextContent("접을 수 있는 기록");
    await expect(canvas.getByRole("textbox")).toHaveTextContent("접었다 펼칠 상세 내용");
    const toggle = () => canvasElement.querySelector<HTMLButtonElement>(".bn-toggle-button");
    const child = () => canvas.getByText("접었다 펼칠 상세 내용", { exact: true });
    const wrapper = () => toggle()?.closest(".bn-toggle-wrapper");
    if (!toggle()) throw new Error("Actual BlockNote toggle button missing");
    await expect(wrapper()).toHaveAttribute("data-show-children", "false");
    await expect(child()).not.toBeVisible();
    await userEvent.click(toggle()!);
    await waitFor(() => { expect(wrapper()).toHaveAttribute("data-show-children", "true"); expect(child()).toBeVisible(); });
    await userEvent.click(toggle()!);
    await waitFor(() => { expect(wrapper()).toHaveAttribute("data-show-children", "false"); expect(child()).not.toBeVisible(); });
    const documentBefore = JSON.parse(canvas.getByTestId("soap-document-json").textContent!);
    const focusedToggle = toggle()!;
    focusedToggle.focus(); await expect(focusedToggle).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => { expect(wrapper()).toHaveAttribute("data-show-children", "true"); expect(child()).toBeVisible(); });
    await expect(JSON.parse(canvas.getByTestId("soap-document-json").textContent!)).toEqual(documentBefore);
    await expect(focusedToggle).toHaveFocus();
    await userEvent.keyboard(" ");
    await waitFor(() => { expect(wrapper()).toHaveAttribute("data-show-children", "false"); expect(child()).not.toBeVisible(); });
    await expect(JSON.parse(canvas.getByTestId("soap-document-json").textContent!)).toEqual(documentBefore);
    await expect(focusedToggle).toHaveFocus();
  },
};

export const ReadOnly: Story = {
  parameters: { docs: { description: { story: "읽기 전용 문서에서 편집 도구와 입력이 제한되는지 확인합니다." } } },
  args: { initialContent: selectionBlock, disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("toolbar", { name: "SOAP 문서 편집 도구" })).toBeNull();
    await expect(canvas.getByRole("textbox")).toHaveAttribute("contenteditable", "false");
    await expect(canvas.getByRole("textbox")).toHaveTextContent("보호자 진술과 진료 소견");
  },
};
