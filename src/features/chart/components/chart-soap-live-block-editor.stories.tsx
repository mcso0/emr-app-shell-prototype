import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationMaximize2Icon,
} from "@/components/cds-icons/navigation";

import {
  createDefaultSoapBasicBlockTemplateBlocks,
  type ChartSoapBlock,
  type ChartSoapPartialBlock,
} from "./chart-soap-block-schema";
import { ChartSoapLiveBlockEditor } from "./chart-soap-live-block-editor";
import styles from "./chart-soap-live-block-editor.stories.module.css";

const emptyBlock: ChartSoapPartialBlock[] = [{ type: "paragraph" }];
const indentedBlock: ChartSoapPartialBlock[] = [
  {
    type: "paragraph",
    content: "상위 관찰 내용을 입력하세요",
    children: [{ type: "paragraph" }],
  },
];
const selectionBlock: ChartSoapPartialBlock[] = [
  {
    type: "paragraph",
    content: "선택 툴바를 확인할 임상 메모입니다.",
  },
];
const toggleHeadingBlock: ChartSoapPartialBlock[] = [
  {
    type: "heading",
    props: { level: 2, isToggleable: true },
    content: "접을 수 있는 진료 메모",
    children: [{ type: "paragraph", content: "접었다 펼칠 상세 내용" }],
  },
];
const toggleHeadingAlignmentBlocks: ChartSoapPartialBlock[] = [1, 2, 3].map(
  (level) => ({
    type: "heading",
    props: { level, isToggleable: true },
    content: `접을 수 있는 제목 ${level}`,
    children: [{ type: "paragraph", content: `제목 ${level}의 상세 내용` }],
  }),
);
const emptyToggleHeadingBlock: ChartSoapPartialBlock[] = [
  {
    type: "heading",
    props: { level: 2, isToggleable: true },
    content: "내용이 없는 접을 수 있는 제목",
  },
];
const soapKeywordNote: ChartSoapPartialBlock[] = [
  {
    type: "paragraph",
    content: "보호자가 이전 기록에서 기본 SOAP라는 표현을 사용했습니다.",
  },
];
const nestedContentBlock: ChartSoapPartialBlock[] = [
  {
    type: "paragraph",
    content: "상위 관찰 내용",
    children: [{ type: "paragraph", content: "중첩 임상 메모" }],
  },
];
const mediaUploadBlocks: ChartSoapPartialBlock[] = [
  { type: "paragraph" },
  { type: "paragraph" },
];
const previewImageSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
    <rect width="480" height="320" rx="24" fill="#eef4ff" />
    <circle cx="158" cy="150" r="72" fill="#2f6fec" opacity="0.16" />
    <path d="M80 252l92-104 68 72 48-52 112 84H80z" fill="#2f6fec" />
    <text x="240" y="58" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#17233c">SOAP IMAGE PREVIEW</text>
  </svg>
`;
const previewVideoBase64 = [
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAALAEU2bdLpNu4tTq4QVSalmU6yBoU27i1Or",
  "hBZUrmtTrIHYTbuMU6uEElTDZ1OsggElTbuMU6uEHFO7a1OsggKq7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZm",
  "NjIuMTIuMTAxV0GNTGF2ZjYyLjEyLjEwMUSJiEBpAAAAAAAAFlSua8iuAQAAAAAAAD/XgQFzxYjWD7xS5zjud5yBACK1nIN1",
  "bmSIgQCGhVZfVlA4g4EBI+ODhAJiWgDgkLCBQLqBMJqBAlW5gQESVMNn/HNzoGPAgGfImkWjh0VOQ09ERVJEh41MYXZmNjIu",
  "MTIuMTAxc3PWY8CLY8WI1g+8Uuc47ndnyKFFo4dFTkNPREVSRIeUTGF2YzYyLjI4LjEwMSBsaWJ2cHhnyKFFo4hEVVJBVElP",
  "TkSHkzAwOjAwOjAwLjIwMDAwMDAwMAAfQ7Z1QP7ngQCjwYEAAICQAwCdASpAADAAAEcIhYWImYSIAgICdaoD+AP6Agc7hh0x",
  "s8WZAP71WL//eeZQqqOf956P/jmTcwxP+NXAo6qBACgAEQIABhDQABgAGk/0DAAU+qqogP7cUf/wPwg/CEFaV9d42zDbcKCj",
  "rIEAUAARAgAGEKQAGAAaT/QMABT6qqiA/uHDf/jdUm6NN328/xpjz8D0AzQAo62BAHgAEQIABhCEABgAGk/0DAAU+qqogP7l",
  "+j/5xE1wTFwZ6H/99R/h4/xrdACjrYEAoABRAgAGEGgAGAc/+B0G8s1AF4X//YD+6ez//UGfIM+QZ+ql/8guWF1xGBxTu2uR",
  "u4+zgQC3iveBAfGCAabwgQM=",
].join("");

function createPreviewImageFile() {
  return new File([previewImageSvg], "soap-preview.svg", {
    type: "image/svg+xml",
  });
}

function createPreviewVideoFile() {
  const bytes = Uint8Array.from(atob(previewVideoBase64), (character) =>
    character.charCodeAt(0),
  );
  return new File([bytes], "soap-preview.webm", { type: "video/webm" });
}

function placeCaretAtEnd(element: HTMLElement) {
  const selection = element.ownerDocument.getSelection();
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
  element.closest<HTMLElement>('[contenteditable="true"]')?.focus();
  element.ownerDocument.dispatchEvent(
    new Event("selectionchange", { bubbles: true }),
  );
}

async function expectSideMenuAlignedWithBlock({
  block,
  canvasElement,
}: {
  block: HTMLElement;
  canvasElement: HTMLElement;
}) {
  const documentBody = within(canvasElement.ownerDocument.body);
  const blockRect = block.getBoundingClientRect();
  fireEvent.mouseMove(block, {
    clientX: blockRect.left + Math.min(80, blockRect.width / 2),
    clientY: blockRect.top + blockRect.height / 2,
  });

  const addButton = await documentBody.findByRole("button", {
    name: "블록 추가",
  });
  const sideMenu = addButton.closest<HTMLElement>(".bn-side-menu");
  if (!sideMenu) throw new Error("SOAP 블록 사이드 메뉴를 찾지 못했습니다.");

  await waitFor(() => {
    expect(addButton).toBeVisible();
    const alignmentTarget = block.matches(
      '[data-content-type="heading"]',
    )
      ? block.querySelector<HTMLElement>(".bn-toggle-wrapper") ?? block
      : block;
    const currentBlockRect = alignmentTarget.getBoundingClientRect();
    const sideMenuRect = sideMenu.getBoundingClientRect();
    const blockCenter = currentBlockRect.top + currentBlockRect.height / 2;
    const sideMenuCenter = sideMenuRect.top + sideMenuRect.height / 2;
    expect(Math.abs(blockCenter - sideMenuCenter)).toBeLessThanOrEqual(1);
  });
}

async function selectFormattingToolbarText(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const editor = canvas.getByRole("textbox");
  await userEvent.click(editor);
  const inlineContent = editor.querySelector<HTMLElement>(".bn-inline-content");
  const textNode = inlineContent?.firstChild;
  if (!inlineContent || !textNode?.textContent) {
    throw new Error("선택 툴바 검증용 텍스트를 찾지 못했습니다.");
  }

  const range = canvasElement.ownerDocument.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, textNode.textContent.length);
  const selection = canvasElement.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  canvasElement.ownerDocument.dispatchEvent(
    new Event("selectionchange", { bubbles: true }),
  );
  fireEvent.mouseUp(inlineContent);

  await waitFor(() => {
    expect(
      canvasElement.ownerDocument.querySelector(".bn-formatting-toolbar"),
    ).toBeVisible();
  });

  const toolbar = canvasElement.ownerDocument.querySelector<HTMLElement>(
    ".bn-formatting-toolbar",
  );
  if (!toolbar) throw new Error("선택 툴바를 찾지 못했습니다.");

  return { editor, toolbar };
}

async function selectSlashBlock({
  canvasElement,
  optionName,
}: {
  canvasElement: HTMLElement;
  optionName: string;
}) {
  const documentBody = within(canvasElement.ownerDocument.body);

  await userEvent.keyboard("/");
  await userEvent.click(
    await documentBody.findByRole("option", { name: optionName }),
  );
  await waitFor(() =>
    expect(
      documentBody.queryByRole("listbox", { name: "SOAP 블록 명령" }),
    ).not.toBeInTheDocument(),
  );
}

type LiveEditorHarnessProps = {
  width: number;
  initialContent?: ChartSoapPartialBlock[];
  disabled?: boolean;
  interactiveWidth?: boolean;
};

function LiveEditorHarness({
  width,
  initialContent = emptyBlock,
  disabled = false,
  interactiveWidth = false,
}: LiveEditorHarnessProps) {
  const [activeWidth, setActiveWidth] = useState(width);
  const [activeTab, setActiveTab] = useState("기본 S/O");
  const [documentBlocks, setDocumentBlocks] = useState<readonly ChartSoapBlock[]>([]);
  const [notice, setNotice] = useState("로컬 Storybook 상태 · 서버 저장 안 함");
  const stableInitialContent = useMemo(() => initialContent, [initialContent]);

  return (
    <main className={styles.stage}>
      {interactiveWidth ? (
        <div className={styles.widthControls} aria-label="SOAP 패널 너비 선택">
          {[320, 420, 566.5, 720].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={activeWidth === option}
              onClick={() => setActiveWidth(option)}
            >
              {option}px
            </button>
          ))}
        </div>
      ) : null}

      <section
        className={styles.frame}
        style={{ width: `${activeWidth}px` }}
        aria-label={`${activeWidth}px SOAP 에디터 검토 프레임`}
        data-testid="soap-story-frame"
      >
        <header className={styles.header}>
          <h1>Subject/Object</h1>
          <div className={styles.headerActions} aria-label="패널 작업">
            <button type="button" aria-label="패널 접기">
              <CdsNavigationChevronLeftIcon size={14} />
            </button>
            <button type="button" aria-label="패널 확대">
              <CdsNavigationMaximize2Icon size={14} />
            </button>
            <button type="button" aria-label="SOAP 탭 추가">
              <CdsActionsPlusIcon size={16} />
            </button>
            <button type="button" aria-label="패널 더보기">
              <CdsFilesMoreHorizontalIcon size={16} />
            </button>
          </div>
        </header>

        <nav className={styles.tabs} aria-label="SOAP 진단계통 탭">
          <div>
            {["기본 S/O", "진단계통명A", "진단계통명B"].map((tab) => (
              <button
                key={tab}
                type="button"
                aria-current={activeTab === tab ? "page" : undefined}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </nav>

        <div className={styles.editorSlot}>
          <ChartSoapLiveBlockEditor
            disabled={disabled}
            initialContent={stableInitialContent}
            onDocumentChange={setDocumentBlocks}
            onNotice={setNotice}
            onReady={setDocumentBlocks}
            templateStructure="basic"
          />
        </div>
      </section>

      <div className={styles.localState} role="status" aria-live="polite">
        <span>{notice}</span>
        <span>{documentBlocks.length}개 최상위 블록</span>
      </div>
    </main>
  );
}

const meta = {
  title: "Features/Chart/SOAP/Live BlockNote Figma prototype",
  component: LiveEditorHarness,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "운영 ChartSoapLiveBlockEditor와 BlockNote 0.54.x를 그대로 마운트하고 저장 콜백만 로컬 상태로 대체한 Figma UI 검토 시안입니다.",
      },
    },
  },
  args: {
    width: 566.5,
    initialContent: emptyBlock,
    disabled: false,
    interactiveWidth: false,
  },
} satisfies Meta<typeof LiveEditorHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyBlock: Story = {};

export const IndentedBlock: Story = {
  args: { initialContent: indentedBlock },
};

export const PlusMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await userEvent.type(editor, "필터");
    const block = canvasElement.querySelector<HTMLElement>(
      '[data-node-type="blockContainer"]',
    );
    if (!block) throw new Error("SOAP 편집 블록을 찾지 못했습니다.");

    const blockRect = block.getBoundingClientRect();
    block.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: blockRect.left + Math.min(80, blockRect.width / 2),
        clientY: blockRect.top + 12,
      }),
    );

    const addButton = await documentBody.findByRole("button", {
      name: "블록 추가",
    });
    const grabButton = await documentBody.findByRole("button", {
      name: "블록 메뉴 열기",
    });
    await waitFor(() => expect(addButton).toBeVisible());
    await waitFor(() => expect(grabButton).toBeVisible());
    await expect(addButton.getBoundingClientRect().width).toBe(24);
    await expect(addButton.getBoundingClientRect().height).toBe(24);
    await expect(grabButton.getBoundingClientRect().width).toBe(16);
    await expect(grabButton.getBoundingClientRect().height).toBe(24);
    const grabIcon = grabButton.querySelector<SVGSVGElement>(
      '[data-test="soap-block-grab"]',
    );
    await expect(grabIcon).toBeInTheDocument();
    await expect(grabIcon?.getBoundingClientRect().width).toBe(14);
    await expect(grabIcon?.getBoundingClientRect().height).toBe(14);
    fireEvent.pointerDown(addButton);
    fireEvent.click(addButton);
    await expect(
      await documentBody.findByRole("listbox", { name: "SOAP 블록 명령" }),
    ).toBeVisible();
    for (const optionName of [
      "접을 수 있는 제목1",
      "접을 수 있는 제목2",
      "접을 수 있는 제목3",
      "이미지 추가",
      "동영상 추가",
    ]) {
      await expect(
        documentBody.getByRole("option", { name: optionName }),
      ).toBeInTheDocument();
    }
    const filterInput = await documentBody.findByRole("combobox", {
      name: "블록 명령 필터",
    });
    await expect(filterInput).toHaveAttribute(
      "placeholder",
      "필터 기준을 입력하세요",
    );
    await expect(filterInput).toBeVisible();
    const filterStyle = getComputedStyle(filterInput);
    await expect(filterStyle.backgroundColor).not.toBe("rgb(255, 255, 255)");
    await expect(filterStyle.borderRadius).toBe("4px");
    const topLevelBlocks = canvasElement.querySelectorAll<HTMLElement>(
      '[data-node-type="blockContainer"]',
    );
    await expect(topLevelBlocks).toHaveLength(2);
    await expect(topLevelBlocks[0]).toHaveTextContent("필터");
    await expect(filterInput.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      topLevelBlocks[0].getBoundingClientRect().bottom,
    );
    const activeEmptyBlock = canvasElement.querySelector<HTMLElement>(
      '.bn-block-content[data-is-empty-and-focused="true"]',
    );
    await expect(activeEmptyBlock).toBeInTheDocument();
    await expect(
      getComputedStyle(activeEmptyBlock!, "::after").content,
    ).toBe("none");
  },
};

export const SlashMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await userEvent.type(editor, "/");
    const menu = await documentBody.findByRole("listbox", {
      name: "SOAP 블록 명령",
    });
    await waitFor(() => expect(menu).toBeVisible());
    const frameRect = canvas.getByTestId("soap-story-frame").getBoundingClientRect();
    await expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(
      frameRect.width - 16 + 1,
    );
    for (const optionName of [
      "접을 수 있는 제목1",
      "접을 수 있는 제목2",
      "접을 수 있는 제목3",
      "이미지 추가",
      "동영상 추가",
    ]) {
      await expect(
        documentBody.getByRole("option", { name: optionName }),
      ).toBeInTheDocument();
    }
    const slashSurface = editor.querySelector<HTMLElement>(
      '[data-soap-slash-query="true"]',
    );
    await expect(slashSurface).toBeInTheDocument();
    await expect(slashSurface).toHaveAttribute(
      "data-soap-slash-query-empty",
      "true",
    );
    await expect(slashSurface).toHaveAttribute(
      "data-soap-slash-placeholder",
      "검색어를 입력하세요",
    );
    const slashStyle = getComputedStyle(slashSurface!);
    await expect(slashStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(slashStyle.borderRadius).toBe("4px");
  },
};

export const SlashMenuOpenNarrow320: Story = {
  args: { width: 320 },
  play: SlashMenuOpen.play,
};

export const HeadingBlockTypography: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await selectSlashBlock({ canvasElement, optionName: "제목 1" });

    const heading = editor.querySelector<HTMLElement>(
      '.bn-block-content[data-content-type="heading"]',
    );
    const inlineContent = heading?.querySelector<HTMLElement>(
      ".bn-inline-content",
    );
    if (!heading || !inlineContent) {
      throw new Error("제목 블록을 찾지 못했습니다.");
    }

    const headingStyle = getComputedStyle(heading);
    const inlineStyle = getComputedStyle(inlineContent);
    const placeholderStyle = getComputedStyle(heading, "::after");
    await expect(headingStyle.fontSize).toBe("20px");
    await expect(headingStyle.lineHeight).toBe("28px");
    await expect(inlineStyle.fontSize).toBe("20px");
    await expect(inlineStyle.lineHeight).toBe("28px");
    await expect(placeholderStyle.fontSize).toBe("20px");
    await expect(placeholderStyle.lineHeight).toBe("28px");
    await expect(placeholderStyle.fontStyle).toBe("normal");
    await expect(heading.getBoundingClientRect().height).toBeLessThanOrEqual(32);
    await expectSideMenuAlignedWithBlock({ block: heading, canvasElement });

    await userEvent.keyboard("제목 입력 확인{Enter}");
    await expect(heading).toHaveTextContent("제목 입력 확인");
    await expect(
      editor.querySelectorAll(
        '.bn-block-content[data-content-type="paragraph"]',
      ),
    ).toHaveLength(1);
  },
};

export const SlashToggleHeadingCommandInsertion: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);

    for (const [index, blockCase] of ([
      {
        optionName: "접을 수 있는 제목1",
        level: null,
        text: "접는 제목 1 입력 확인",
      },
      {
        optionName: "접을 수 있는 제목2",
        level: "2",
        text: "접는 제목 2 입력 확인",
      },
      {
        optionName: "접을 수 있는 제목3",
        level: "3",
        text: "접는 제목 3 입력 확인",
      },
    ] as const).entries()) {
      await selectSlashBlock({
        canvasElement,
        optionName: blockCase.optionName,
      });
      await userEvent.keyboard(blockCase.text);

      const matchingBlock = Array.from(
        editor.querySelectorAll<HTMLElement>(
          '.bn-block-content[data-content-type="heading"]',
        ),
      ).find((block) => block.textContent?.includes(blockCase.text));
      if (!matchingBlock) {
        throw new Error(`${blockCase.optionName} 삽입 결과를 찾지 못했습니다.`);
      }

      await expect(matchingBlock.getAttribute("data-level")).toBe(
        blockCase.level,
      );
      await expect(
        matchingBlock.querySelector(".bn-toggle-wrapper"),
      ).toBeInTheDocument();
      await expect(
        Number.parseFloat(
          getComputedStyle(
            matchingBlock.querySelector<HTMLElement>(".bn-inline-content")!,
          ).fontSize,
        ),
      ).toBe([20, 18, 16][index]);

      await userEvent.keyboard("{Enter}");
    }
  },
};

export const LocalMediaUploadAndInlinePreview: Story = {
  args: { initialContent: mediaUploadBlocks },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);

    await selectSlashBlock({ canvasElement, optionName: "이미지 추가" });
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector(
          'input[type="file"][accept="image/*"]',
        ),
      ).toBeInTheDocument(),
    );
    const imageInput = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      'input[type="file"][accept="image/*"]',
    );
    if (!imageInput) throw new Error("이미지 업로드 입력을 찾지 못했습니다.");
    await userEvent.upload(imageInput, createPreviewImageFile());

    const image = await waitFor(() => {
      const preview = editor.querySelector<HTMLImageElement>(
        '.bn-block-content[data-content-type="image"] img.bn-visual-media',
      );
      expect(preview).toBeVisible();
      expect(preview?.naturalWidth).toBeGreaterThan(0);
      return preview;
    });
    if (!image) throw new Error("업로드된 이미지 미리보기를 찾지 못했습니다.");
    await expect(image.src).toMatch(/^blob:/);
    await expect(image.alt).toBe("soap-preview.svg");

    const imageRect = image.getBoundingClientRect();
    fireEvent.mouseDown(image, {
      button: 0,
      clientX: imageRect.left + imageRect.width / 2,
      clientY: imageRect.top + imageRect.height / 2,
    });
    fireEvent.mouseUp(image, {
      button: 0,
      clientX: imageRect.left + imageRect.width / 2,
      clientY: imageRect.top + imageRect.height / 2,
    });
    fireEvent.click(image);
    const imageToolbar = await waitFor(() => {
      const toolbar = canvasElement.ownerDocument.querySelector<HTMLElement>(
        ".bn-formatting-toolbar",
      );
      expect(toolbar).toBeVisible();
      return toolbar;
    });
    if (!imageToolbar) throw new Error("이미지 도구 모음을 찾지 못했습니다.");
    const previewToggle = within(imageToolbar).getByRole("button", {
      name: "Toggle preview",
    });
    await expect(previewToggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(previewToggle);
    await waitFor(() => expect(image).not.toBeInTheDocument());
    await expect(editor).toHaveTextContent("soap-preview.svg");

    const imageFileName = within(editor).getByText("soap-preview.svg");
    const fileNameRect = imageFileName.getBoundingClientRect();
    fireEvent.mouseDown(imageFileName, {
      button: 0,
      clientX: fileNameRect.left + fileNameRect.width / 2,
      clientY: fileNameRect.top + fileNameRect.height / 2,
    });
    fireEvent.mouseUp(imageFileName, {
      button: 0,
      clientX: fileNameRect.left + fileNameRect.width / 2,
      clientY: fileNameRect.top + fileNameRect.height / 2,
    });
    fireEvent.click(imageFileName);
    const hiddenPreviewToolbar = await waitFor(() => {
      const toolbar = canvasElement.ownerDocument.querySelector<HTMLElement>(
        ".bn-formatting-toolbar",
      );
      expect(toolbar).toBeVisible();
      return toolbar;
    });
    if (!hiddenPreviewToolbar) {
      throw new Error("숨긴 이미지의 도구 모음을 찾지 못했습니다.");
    }
    await userEvent.click(
      within(hiddenPreviewToolbar).getByRole("button", {
        name: "Toggle preview",
      }),
    );
    await waitFor(() =>
      expect(
        editor.querySelector(
          '.bn-block-content[data-content-type="image"] img.bn-visual-media',
        ),
      ).toBeVisible(),
    );

    await userEvent.keyboard("{Escape}");
    const paragraph = Array.from(
      editor.querySelectorAll<HTMLElement>(
        '.bn-block-content[data-content-type="paragraph"] .bn-inline-content',
      ),
    ).at(-1);
    if (!paragraph) throw new Error("동영상 삽입 위치를 찾지 못했습니다.");
    placeCaretAtEnd(paragraph);
    await selectSlashBlock({ canvasElement, optionName: "동영상 추가" });
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector(
          'input[type="file"][accept="video/*"]',
        ),
      ).toBeInTheDocument(),
    );
    const videoInput = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      'input[type="file"][accept="video/*"]',
    );
    if (!videoInput) throw new Error("동영상 업로드 입력을 찾지 못했습니다.");
    await userEvent.upload(videoInput, createPreviewVideoFile());

    const video = await waitFor(() => {
      const preview = editor.querySelector<HTMLVideoElement>(
        '.bn-block-content[data-content-type="video"] video.bn-visual-media',
      );
      expect(preview).toBeVisible();
      expect(preview?.readyState).toBeGreaterThanOrEqual(1);
      return preview;
    });
    if (!video) throw new Error("업로드된 동영상 미리보기를 찾지 못했습니다.");
    await expect(video.src).toMatch(/^blob:/);
    await expect(video.controls).toBe(true);
    await expect(video.getBoundingClientRect().width).toBeGreaterThan(100);
    video.muted = true;
    await Reflect.apply(HTMLMediaElement.prototype.play, video, []);
    await waitFor(() => expect(video.currentTime).toBeGreaterThan(0));
    video.pause();

    await expect(documentBody.getByRole("status")).toHaveTextContent(
      "서버에는 저장되지 않습니다.",
    );
    const editorRect = editor.getBoundingClientRect();
    await expect(editor.scrollWidth).toBeLessThanOrEqual(
      Math.ceil(editorRect.width),
    );
  },
};

export const LocalMediaUploadAndInlinePreviewNarrow320: Story = {
  args: { initialContent: mediaUploadBlocks, width: 320 },
  play: LocalMediaUploadAndInlinePreview.play,
};

export const UnsupportedMediaUploadError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await selectSlashBlock({ canvasElement, optionName: "이미지 추가" });
    await waitFor(() =>
      expect(
        canvasElement.ownerDocument.querySelector(
          'input[type="file"][accept="image/*"]',
        ),
      ).toBeInTheDocument(),
    );
    const imageInput = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      'input[type="file"][accept="image/*"]',
    );
    if (!imageInput) throw new Error("이미지 업로드 입력을 찾지 못했습니다.");

    await userEvent.upload(
      imageInput,
      new File(["not media"], "soap-note.txt", { type: "text/plain" }),
      { applyAccept: false },
    );
    await expect(documentBody.getByRole("status")).toHaveTextContent(
      "이미지 또는 동영상 파일만 추가할 수 있습니다.",
    );
    await expect(
      editor.querySelector(
        '.bn-block-content[data-content-type="image"] img.bn-visual-media',
      ),
    ).not.toBeInTheDocument();
    await expect(
      editor.querySelector(
        '.bn-block-content[data-content-type="image"] .bn-add-file-button',
      ),
    ).toBeInTheDocument();
  },
};

export const BasicBlockWritingMatrix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);

    const textCases = [
      { optionName: "텍스트", type: "paragraph", text: "텍스트 입력 확인" },
      { optionName: "제목 1", type: "heading", level: "1", text: "제목 1 입력 확인" },
      { optionName: "제목 2", type: "heading", level: "2", text: "제목 2 입력 확인" },
      { optionName: "제목 3", type: "heading", level: "3", text: "제목 3 입력 확인" },
      { optionName: "글머리 목록", type: "bulletListItem", text: "글머리 입력 확인", exitWithEmptyEnter: true },
      { optionName: "번호 목록", type: "numberedListItem", text: "번호 입력 확인", exitWithEmptyEnter: true },
      { optionName: "체크 목록", type: "checkListItem", text: "체크 입력 확인", exitWithEmptyEnter: true },
      { optionName: "인용", type: "quote", text: "인용 입력 확인", exitWithEmptyEnter: true },
    ] as const;

    for (const blockCase of textCases) {
      await selectSlashBlock({
        canvasElement,
        optionName: blockCase.optionName,
      });
      await userEvent.keyboard(blockCase.text);

      const selector =
        blockCase.type === "heading"
          ? `.bn-block-content[data-content-type="heading"]${
              blockCase.level === "1"
                ? ':not([data-level])'
                : `[data-level="${blockCase.level}"]`
            }`
          : `.bn-block-content[data-content-type="${blockCase.type}"]`;
      const matchingBlock = Array.from(
        editor.querySelectorAll<HTMLElement>(selector),
      ).find((block) => block.textContent?.includes(blockCase.text));
      await expect(matchingBlock).toBeInTheDocument();

      await userEvent.keyboard("{Enter}");
      if ("exitWithEmptyEnter" in blockCase && blockCase.exitWithEmptyEnter) {
        await userEvent.keyboard("{Enter}");
      }
    }

    for (const headingCase of [
      { selector: ':not([data-level])', fontSize: 20, lineHeight: 28 },
      { selector: '[data-level="2"]', fontSize: 18, lineHeight: 26 },
      { selector: '[data-level="3"]', fontSize: 16, lineHeight: 24 },
    ]) {
      const heading = editor.querySelector<HTMLElement>(
        `.bn-block-content[data-content-type="heading"]${headingCase.selector}`,
      );
      if (!heading) throw new Error("제목 단계별 타이포 검증 대상을 찾지 못했습니다.");
      const headingStyle = getComputedStyle(heading);
      await expect(Number.parseFloat(headingStyle.fontSize)).toBeCloseTo(
        headingCase.fontSize,
        1,
      );
      await expect(Number.parseFloat(headingStyle.lineHeight)).toBeCloseTo(
        headingCase.lineHeight,
        1,
      );
    }

    await selectSlashBlock({ canvasElement, optionName: "구분선" });

    const documentBlocks = Array.from(
      editor.querySelectorAll<HTMLElement>(".bn-block-content"),
    );
    const dividerIndex = documentBlocks.findIndex(
      (block) => block.dataset.contentType === "divider",
    );
    await expect(dividerIndex).toBeGreaterThanOrEqual(0);
    await expect(documentBlocks[dividerIndex]?.querySelector("hr")).toBeInTheDocument();
    await expect(documentBlocks[dividerIndex + 1]?.dataset.contentType).toBe(
      "paragraph",
    );
    await expect(
      editor.querySelector(
        '.bn-block-content[data-content-type="checkListItem"] input[type="checkbox"]',
      ),
    ).toBeInTheDocument();
    await expect(
      editor.querySelector('[data-soap-slash-query="true"]'),
    ).not.toBeInTheDocument();

    const editorRect = editor.getBoundingClientRect();
    await expect(editor.scrollWidth).toBeLessThanOrEqual(
      Math.ceil(editorRect.width),
    );
  },
};

export const BasicBlockWritingMatrixNarrow320: Story = {
  args: { width: 320 },
  play: BasicBlockWritingMatrix.play,
};

export const SlashQueryLifecycle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await userEvent.type(editor, "/기본");

    await expect(
      await documentBody.findByRole("listbox", { name: "SOAP 블록 명령" }),
    ).toBeVisible();
    const slashSurface = editor.querySelector<HTMLElement>(
      '[data-soap-slash-query="true"]',
    );
    await expect(slashSurface).toBeInTheDocument();
    await expect(slashSurface).toHaveAttribute(
      "data-soap-slash-query-empty",
      "false",
    );
    await expect(getComputedStyle(slashSurface!, "::after").content).toBe(
      "none",
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        documentBody.queryByRole("listbox", { name: "SOAP 블록 명령" }),
      ).not.toBeInTheDocument(),
    );
    await expect(
      editor.querySelector('[data-soap-slash-query="true"]'),
    ).not.toBeInTheDocument();
  },
};

export const FilteredSlashMenuFitsContent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await userEvent.type(editor, "/동");

    const menu = await documentBody.findByRole("listbox", {
      name: "SOAP 블록 명령",
    });
    await waitFor(() => expect(menu).toBeVisible());
    await expect(
      documentBody.getByRole("option", { name: "동영상 추가" }),
    ).toBeVisible();

    const lastDisabledItem = documentBody
      .getByText("광학검사 불러오기")
      .closest<HTMLElement>('[aria-disabled="true"]');
    const footer = documentBody.getByRole("button", {
      name: "명령 메뉴 닫기",
    });
    if (!lastDisabledItem) {
      throw new Error("비활성 광학검사 명령을 찾지 못했습니다.");
    }

    const menuRect = menu.getBoundingClientRect();
    const lastItemRect = lastDisabledItem.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    await expect(menuRect.height).toBeLessThan(260);
    await expect(footerRect.top - lastItemRect.bottom).toBeLessThanOrEqual(16);
  },
};

export const SlashTemplatePreservesParagraph: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await userEvent.type(editor, "기존 임상 메모/");

    const templateItem = await documentBody.findByRole("option", {
      name: "기본 SOAP 템플릿",
    });
    await userEvent.click(templateItem);

    const topLevelBlocks = canvasElement.querySelectorAll(
      '.bn-editor > .bn-block-group > .bn-block-outer',
    );
    await expect(topLevelBlocks).toHaveLength(9);
    await expect(topLevelBlocks[0]).toHaveTextContent("기존 임상 메모");
  },
};

export const SlashTemplatePreservesNestedParagraph: Story = {
  args: { initialContent: nestedContentBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    const nestedParagraph = canvasElement.querySelector<HTMLElement>(
      ".bn-block-group .bn-block-group .bn-inline-content",
    );
    if (!nestedParagraph) {
      throw new Error("중첩 문단을 찾지 못했습니다.");
    }

    placeCaretAtEnd(nestedParagraph);
    await userEvent.keyboard("/");
    const templateItem = await documentBody.findByRole("option", {
      name: "기본 SOAP 템플릿",
    });
    await userEvent.click(templateItem);

    const topLevelBlocks = canvasElement.querySelectorAll(
      '.bn-editor > .bn-block-group > .bn-block-outer',
    );
    await expect(topLevelBlocks).toHaveLength(9);
    await expect(editor).toHaveTextContent("중첩 임상 메모");
  },
};

export const TemplateKeywordIsNotDuplicate: Story = {
  args: { initialContent: soapKeywordNote },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    const paragraph = editor.querySelector<HTMLElement>(".bn-inline-content");
    if (!paragraph) throw new Error("기본 문단을 찾지 못했습니다.");
    placeCaretAtEnd(paragraph);
    await userEvent.keyboard("/");
    const templateItem = await documentBody.findByRole("option", {
      name: "기본 SOAP 템플릿",
    });
    await userEvent.click(templateItem);

    const topLevelBlocks = canvasElement.querySelectorAll(
      '.bn-editor > .bn-block-group > .bn-block-outer',
    );
    await expect(topLevelBlocks).toHaveLength(9);
    await expect(topLevelBlocks[0]).toHaveTextContent("기본 SOAP라는 표현");
  },
};

export const DuplicateTemplateIsBlocked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    await userEvent.type(editor, "/");
    await userEvent.click(
      await documentBody.findByRole("option", {
        name: "기본 SOAP 템플릿",
      }),
    );

    const lastParagraph = Array.from(
      editor.querySelectorAll<HTMLElement>(".bn-inline-content"),
    ).at(-1);
    if (!lastParagraph) throw new Error("마지막 SOAP 문단을 찾지 못했습니다.");
    placeCaretAtEnd(lastParagraph);
    await userEvent.keyboard("/");
    await userEvent.click(
      await documentBody.findByRole("option", {
        name: "기본 SOAP 템플릿",
      }),
    );

    await expect(
      canvasElement.querySelectorAll(
        '.bn-editor > .bn-block-group > .bn-block-outer',
      ),
    ).toHaveLength(8);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "기본 SOAP 템플릿이 이미 문서에 있습니다.",
    );
  },
};

export const PlusMenuIgnoresImeEnter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    const block = canvasElement.querySelector<HTMLElement>(
      '[data-node-type="blockContainer"]',
    );
    if (!block) throw new Error("SOAP 편집 블록을 찾지 못했습니다.");

    const blockRect = block.getBoundingClientRect();
    block.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: blockRect.left + Math.min(80, blockRect.width / 2),
        clientY: blockRect.top + 12,
      }),
    );
    const addButton = await documentBody.findByRole("button", {
      name: "블록 추가",
    });
    fireEvent.pointerDown(addButton);
    fireEvent.click(addButton);

    const filterInput = await documentBody.findByRole("combobox", {
      name: "블록 명령 필터",
    });
    fireEvent.keyDown(filterInput, {
      key: "Enter",
      code: "Enter",
      isComposing: true,
    });

    await expect(
      documentBody.getByRole("listbox", { name: "SOAP 블록 명령" }),
    ).toBeVisible();
    await expect(
      canvasElement.querySelectorAll(
        '.bn-editor > .bn-block-group > .bn-block-outer',
      ),
    ).toHaveLength(1);
  },
};

export const SideMenuControlsRemainInteractive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    await userEvent.click(editor);
    const block = canvasElement.querySelector<HTMLElement>(
      '[data-node-type="blockContainer"]',
    );
    if (!block) throw new Error("SOAP 편집 블록을 찾지 못했습니다.");

    const blockRect = block.getBoundingClientRect();
    block.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: blockRect.left + Math.min(80, blockRect.width / 2),
        clientY: blockRect.top + 12,
      }),
    );
    const grabButton = await documentBody.findByRole("button", {
      name: "블록 메뉴 열기",
    });
    await waitFor(() => expect(grabButton).toBeVisible());
    await userEvent.click(grabButton);
    const blockMenu = await documentBody.findByRole("menu");
    await waitFor(() => expect(blockMenu).toBeVisible());
    await expect(grabButton).toHaveAttribute("aria-expanded", "true");
  },
};

export const SelectionToolbar: Story = {
  args: { initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    await selectFormattingToolbarText(canvasElement);
  },
};

export const FormattingToolbarBlockTypeOptions: Story = {
  args: { initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const documentBody = within(canvasElement.ownerDocument.body);
    const { toolbar } = await selectFormattingToolbarText(canvasElement);
    await userEvent.click(within(toolbar).getByRole("combobox"));

    const options = await documentBody.findAllByRole("option");
    await expect(options.map((option) => option.textContent?.trim())).toEqual([
      "본문",
      "제목1",
      "제목2",
      "제목3",
      "접을 수 있는 제목1",
      "접을 수 있는 제목2",
      "접을 수 있는 제목3",
      "인용",
      "글머리 기호 목록",
      "번호 매기기 목록",
      "체크리스트",
    ]);

    const listbox = documentBody.getByRole("listbox");
    const editorBoundary = canvasElement.querySelector<HTMLElement>(
      "[data-soap-editor-boundary]",
    );
    if (!editorBoundary) throw new Error("SOAP 에디터 경계를 찾지 못했습니다.");
    const listboxRect = listbox.getBoundingClientRect();
    const boundaryRect = editorBoundary.getBoundingClientRect();
    await expect(listboxRect.left).toBeGreaterThanOrEqual(boundaryRect.left);
    await expect(listboxRect.right).toBeLessThanOrEqual(boundaryRect.right);
  },
};

export const FormattingToolbarBlockTypeTransforms: Story = {
  args: { initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const documentBody = within(canvasElement.ownerDocument.body);
    const cases = [
      { optionName: "제목1", type: "heading", level: null, toggleable: false },
      { optionName: "제목2", type: "heading", level: "2", toggleable: false },
      { optionName: "제목3", type: "heading", level: "3", toggleable: false },
      {
        optionName: "접을 수 있는 제목1",
        type: "heading",
        level: null,
        toggleable: true,
      },
      {
        optionName: "접을 수 있는 제목2",
        type: "heading",
        level: "2",
        toggleable: true,
      },
      {
        optionName: "접을 수 있는 제목3",
        type: "heading",
        level: "3",
        toggleable: true,
      },
      { optionName: "인용", type: "quote", level: null, toggleable: false },
      {
        optionName: "글머리 기호 목록",
        type: "bulletListItem",
        level: null,
        toggleable: false,
      },
      {
        optionName: "번호 매기기 목록",
        type: "numberedListItem",
        level: null,
        toggleable: false,
      },
      {
        optionName: "체크리스트",
        type: "checkListItem",
        level: null,
        toggleable: false,
      },
      { optionName: "본문", type: "paragraph", level: null, toggleable: false },
    ] as const;

    for (const blockCase of cases) {
      const { editor, toolbar } =
        await selectFormattingToolbarText(canvasElement);
      await userEvent.click(within(toolbar).getByRole("combobox"));
      await userEvent.click(
        await documentBody.findByRole("option", {
          name: blockCase.optionName,
        }),
      );

      await waitFor(() => {
        const block = editor.querySelector<HTMLElement>(".bn-block-content");
        expect(block?.dataset.contentType).toBe(blockCase.type);
        expect(block?.getAttribute("data-level")).toBe(blockCase.level);
        expect(block).toHaveTextContent("선택 툴바를 확인할 임상 메모입니다.");
        expect(Boolean(block?.querySelector(".bn-toggle-wrapper"))).toBe(
          blockCase.toggleable,
        );
      });
    }
  },
};

export const ToggleHeadingCollapseBehavior: Story = {
  args: { initialContent: toggleHeadingBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    const toggleWrapper = editor.querySelector<HTMLElement>(
      ".bn-toggle-wrapper",
    );
    const toggleButton = toggleWrapper?.querySelector<HTMLButtonElement>(
      ".bn-toggle-button",
    );
    const headingBlock = toggleWrapper?.closest<HTMLElement>(".bn-block");
    const childGroup = headingBlock?.querySelector<HTMLElement>(
      ":scope > .bn-block-group",
    );
    if (!toggleWrapper || !toggleButton || !childGroup) {
      throw new Error("접을 수 있는 제목의 제어 요소를 찾지 못했습니다.");
    }

    const toggleIcon = toggleButton.querySelector("svg");
    if (!toggleIcon) {
      throw new Error("접을 수 있는 제목 아이콘을 찾지 못했습니다.");
    }

    await expect(toggleButton.getBoundingClientRect().width).toBe(24);
    await expect(toggleButton.getBoundingClientRect().height).toBe(24);
    await expect(toggleIcon.getBoundingClientRect().width).toBe(14);
    await expect(toggleIcon.getBoundingClientRect().height).toBe(14);

    await expect(toggleWrapper).toHaveAttribute("data-show-children", "false");
    await expect(childGroup).not.toBeVisible();

    await userEvent.click(toggleButton);
    await waitFor(() => {
      expect(toggleWrapper).toHaveAttribute("data-show-children", "true");
      expect(childGroup).toBeVisible();
      expect(childGroup).toHaveTextContent("접었다 펼칠 상세 내용");
    });

    await userEvent.click(toggleButton);
    await waitFor(() => {
      expect(toggleWrapper).toHaveAttribute("data-show-children", "false");
      expect(childGroup).not.toBeVisible();
    });
  },
};

export const ToggleHeadingSideMenuAlignment: Story = {
  args: { initialContent: toggleHeadingAlignmentBlocks },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    const headingBlocks = Array.from(
      editor.querySelectorAll<HTMLElement>(
        '.bn-block-content[data-content-type="heading"]',
      ),
    );
    await expect(headingBlocks).toHaveLength(3);

    for (const [index, headingBlock] of headingBlocks.entries()) {
      const inlineContent = headingBlock.querySelector<HTMLElement>(
        ".bn-inline-content",
      );
      if (!inlineContent) {
        throw new Error("토글 제목 텍스트를 찾지 못했습니다.");
      }
      const inlineStyle = getComputedStyle(inlineContent);
      await expect(Number.parseFloat(inlineStyle.fontSize)).toBe(
        [20, 18, 16][index],
      );
      await expect(Number.parseFloat(inlineStyle.lineHeight)).toBeCloseTo(
        [28, 26, 24][index],
        0,
      );
      await expectSideMenuAlignedWithBlock({
        block: headingBlock,
        canvasElement,
      });
    }

    for (const parentHeading of headingBlocks) {
      const parentContainer = parentHeading.closest<HTMLElement>(".bn-block");
      const toggleButton = parentHeading.querySelector<HTMLButtonElement>(
        ".bn-toggle-button",
      );
      const childParagraph = parentContainer?.querySelector<HTMLElement>(
        ':scope > .bn-block-group .bn-block-content[data-content-type="paragraph"]',
      );
      if (!toggleButton || !childParagraph) {
        throw new Error("중첩 토글 제목 검증 대상을 찾지 못했습니다.");
      }

      await userEvent.click(toggleButton);
      await waitFor(() => expect(childParagraph).toBeVisible());
      await expectSideMenuAlignedWithBlock({
        block: parentHeading,
        canvasElement,
      });
      await expectSideMenuAlignedWithBlock({
        block: childParagraph,
        canvasElement,
      });
      await expectSideMenuAlignedWithBlock({
        block: parentHeading,
        canvasElement,
      });
      await userEvent.click(toggleButton);
      await waitFor(() => expect(childParagraph).not.toBeVisible());
    }
  },
};

export const EmptyToggleHeading: Story = {
  args: { initialContent: emptyToggleHeadingBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox");
    const headingBlock = editor.querySelector<HTMLElement>(
      '.bn-block-content[data-content-type="heading"]',
    );
    const toggleButton = headingBlock?.querySelector<HTMLButtonElement>(
      ".bn-toggle-button",
    );
    const inlineContent = headingBlock?.querySelector<HTMLElement>(
      ".bn-inline-content",
    );
    if (!headingBlock || !toggleButton || !inlineContent) {
      throw new Error("빈 토글 제목 검증 대상을 찾지 못했습니다.");
    }

    await userEvent.click(toggleButton);
    await waitFor(() =>
      expect(
        headingBlock.querySelector<HTMLElement>(
          ".bn-toggle-add-block-button",
        ),
      ).toBeVisible(),
    );
    const addChildButton = headingBlock.querySelector<HTMLElement>(
      ".bn-toggle-add-block-button",
    );
    if (!addChildButton) {
      throw new Error("빈 토글 제목의 자식 추가 버튼을 찾지 못했습니다.");
    }
    await expect(
      Math.abs(
        addChildButton.getBoundingClientRect().left -
          inlineContent.getBoundingClientRect().left,
      ),
    ).toBeLessThanOrEqual(1);
    await expectSideMenuAlignedWithBlock({
      block: headingBlock,
      canvasElement,
    });
    await userEvent.click(addChildButton);
    await waitFor(() => {
      const childParagraph = headingBlock
        .closest<HTMLElement>(".bn-block")
        ?.querySelector<HTMLElement>(
          ':scope > .bn-block-group .bn-block-content[data-content-type="paragraph"]',
        );
      expect(childParagraph).toBeVisible();
    });
  },
};

export const ToggleHeadingSideMenuAlignmentNarrow320: Story = {
  args: { initialContent: toggleHeadingAlignmentBlocks, width: 320 },
  play: ToggleHeadingSideMenuAlignment.play,
};

export const FormattingToolbarBlockTypeOptionsNarrow320: Story = {
  args: { initialContent: selectionBlock, width: 320 },
  play: FormattingToolbarBlockTypeOptions.play,
};

export const SelectionToggleHeadingKeepsSideMenuAligned: Story = {
  args: { initialContent: selectionBlock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    const paragraphBlock = editor.querySelector<HTMLElement>(
      '.bn-block-content[data-content-type="paragraph"]',
    );
    if (!paragraphBlock) {
      throw new Error("접는 제목 변환 전 문단을 찾지 못했습니다.");
    }

    await expectSideMenuAlignedWithBlock({
      block: paragraphBlock,
      canvasElement,
    });
    const { toolbar } = await selectFormattingToolbarText(canvasElement);
    await userEvent.click(within(toolbar).getByRole("combobox"));
    await userEvent.click(
      await documentBody.findByRole("option", {
        name: "접을 수 있는 제목3",
      }),
    );

    const toggleHeading = await waitFor(() => {
      const block = editor.querySelector<HTMLElement>(
        '.bn-block-content[data-content-type="heading"][data-level="3"]',
      );
      expect(block?.querySelector(".bn-toggle-wrapper")).toBeInTheDocument();
      return block;
    });
    if (!toggleHeading) {
      throw new Error("접는 제목3 변환 결과를 찾지 못했습니다.");
    }
    const toggleButton = toggleHeading.querySelector<HTMLButtonElement>(
      ".bn-toggle-button",
    );
    if (!toggleButton) {
      throw new Error("변환된 접는 제목3의 토글 버튼을 찾지 못했습니다.");
    }
    await userEvent.click(toggleButton);
    await waitFor(() =>
      expect(
        toggleHeading.querySelector(".bn-toggle-add-block-button"),
      ).toBeVisible(),
    );
    await expectSideMenuAlignedWithBlock({
      block: toggleHeading,
      canvasElement,
    });
  },
};

export const ReadOnly: Story = {
  args: { initialContent: selectionBlock, disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox");
    const before = editor.textContent;
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await userEvent.click(editor);
    await userEvent.keyboard("수정 시도/");
    await expect(editor.textContent).toBe(before);
    await expect(documentBody.queryByRole("button", { name: "블록 추가" })).not.toBeInTheDocument();
    await expect(
      documentBody.queryByRole("listbox", { name: "SOAP 블록 명령" }),
    ).not.toBeInTheDocument();
  },
};

export const ResponsiveNarrow320: Story = { args: { width: 320 } };
export const ResponsivePanel420: Story = { args: { width: 420 } };
export const FigmaReference566: Story = { args: { width: 566.5 } };
export const ResponsiveWide720: Story = { args: { width: 720 } };

export const RepresentativeReview: Story = {
  args: {
    width: 566.5,
    initialContent: createDefaultSoapBasicBlockTemplateBlocks(true),
    interactiveWidth: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByTestId("soap-story-frame")).toBeVisible();
    await expect(canvas.getByRole("textbox")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "320px" })).toBeVisible();

    const firstParagraph = canvasElement.querySelector<HTMLElement>(
      '.bn-block-content[data-content-type="paragraph"]',
    );
    if (!firstParagraph) {
      throw new Error("SOAP 기본 문단 정렬 검증 대상을 찾지 못했습니다.");
    }

    const paragraphRect = firstParagraph.getBoundingClientRect();
    firstParagraph.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: paragraphRect.left + Math.min(80, paragraphRect.width / 2),
        clientY: paragraphRect.top + 12,
      }),
    );

    const addButton = await documentBody.findByRole("button", {
      name: "블록 추가",
    });
    const grabButton = await documentBody.findByRole("button", {
      name: "블록 메뉴 열기",
    });
    const sideMenu = addButton.closest<HTMLElement>(".bn-side-menu");
    if (!sideMenu) throw new Error("SOAP 블록 사이드 메뉴를 찾지 못했습니다.");

    const sideMenuRect = sideMenu.getBoundingClientRect();
    const paragraphCenter = paragraphRect.top + paragraphRect.height / 2;
    const sideMenuCenter = sideMenuRect.top + sideMenuRect.height / 2;
    await expect(Math.abs(paragraphCenter - sideMenuCenter)).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(paragraphRect.left - sideMenuRect.right - 8),
    ).toBeLessThanOrEqual(1);
    await expect(addButton.getBoundingClientRect().width).toBe(24);
    await expect(grabButton.getBoundingClientRect().width).toBe(16);
    await expect(
      canvasElement.querySelector(
        '.bn-block-content[data-content-type="soapSection"]',
      ),
    ).not.toBeInTheDocument();
    await expect(
      canvasElement.querySelectorAll(
        '.bn-editor > .bn-block-group > .bn-block-outer',
      ),
    ).toHaveLength(8);
  },
};
