"use client";

import { useMemo, useState } from "react";
import { ko } from "@blocknote/core/locales";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { Button } from "@/components/ui/button";
import {
  CdsActionsPlusSquareIcon,
  CdsActionsRotateCcwIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsCommunicationCameraIcon,
  CdsCommunicationVideoIcon,
} from "@/components/cds-icons/communication-and-media";
import { CdsContentCommandIcon } from "@/components/cds-icons/content-and-editor";
import {
  CdsMedicalClipboardPenIcon,
  CdsMedicalScanLineIcon,
} from "@/components/cds-icons/medical-and-domain";

import {
  chartSoapBlockSchema,
  createDefaultSoapTemplateBlocks,
  createMusculoskeletalSoapTemplateBlocks,
  type ChartSoapBlock,
  type ChartSoapBlockEditorInstance,
  type ChartSoapPartialBlock,
} from "./chart-soap-block-schema";
import styles from "./chart-soap-block-editor.module.css";

const mediaMenuTitles = new Set([
  ko.slash_menu.image.title,
  ko.slash_menu.video.title,
  ko.slash_menu.audio.title,
  ko.slash_menu.file.title,
]);

function hasSoapSystem(
  editor: ChartSoapBlockEditorInstance,
  systemLabel: string,
): boolean {
  let found = false;
  editor.forEachBlock((block) => {
    if (
      block.type === "soapSection" &&
      block.props.systemLabel === systemLabel
    ) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function insertSoapTemplate(
  editor: ChartSoapBlockEditorInstance,
  blocks: ChartSoapPartialBlock[],
) {
  if (!blocks.length) return;

  const cursorBlock = editor.getTextCursorPosition().block;
  let rootBlock: ChartSoapBlock = cursorBlock;
  let parentBlock = editor.getParentBlock(rootBlock);
  while (parentBlock) {
    rootBlock = parentBlock;
    parentBlock = editor.getParentBlock(rootBlock);
  }

  const insertedBlocks =
    rootBlock.id === cursorBlock.id
      ? editor.replaceBlocks([cursorBlock], blocks).insertedBlocks
      : (() => {
          editor.removeBlocks([cursorBlock]);
          return editor.insertBlocks(blocks, rootBlock, "after");
        })();
  const lastInsertedBlock = insertedBlocks.at(-1);
  if (!lastInsertedBlock) return;
  const editableChild = lastInsertedBlock.children.at(0);

  if (editableChild) {
    editor.setTextCursorPosition(editableChild, "end");
  }
}

export function buildSoapSuggestionItems({
  editor,
  onNotice,
}: {
  editor: ChartSoapBlockEditorInstance;
  onNotice: (message: string) => void;
}): DefaultReactSuggestionItem[] {
  const insertTemplate = ({
    blocks,
    systemLabel,
  }: {
    blocks: ChartSoapPartialBlock[];
    systemLabel: string;
  }) => {
    if (hasSoapSystem(editor, systemLabel)) {
      onNotice(`${systemLabel} 템플릿이 이미 문서에 있습니다.`);
      return;
    }

    insertSoapTemplate(editor, blocks);
    onNotice(`${systemLabel} 템플릿을 추가했습니다.`);
  };

  const templateItems: DefaultReactSuggestionItem[] = [
    {
      title: "기본 SOAP 템플릿",
      subtext: "주관적·객관적·평가·계획 블록을 한 번에 추가합니다.",
      aliases: ["soap", "so", "기본", "주관적", "객관적", "평가", "계획"],
      group: "SOAP 템플릿",
      icon: <CdsMedicalClipboardPenIcon size={18} />,
      onItemClick: () =>
        insertTemplate({
          blocks: createDefaultSoapTemplateBlocks(),
          systemLabel: "기본 SOAP",
        }),
    },
    {
      title: "근골격계 SOAP 템플릿",
      subtext: "파행 문진·근골격 검사·감별 진단·처치 블록을 추가합니다.",
      aliases: ["근골격", "파행", "관절", "musculoskeletal"],
      group: "SOAP 템플릿",
      icon: <CdsMedicalScanLineIcon size={18} />,
      onItemClick: () =>
        insertTemplate({
          blocks: createMusculoskeletalSoapTemplateBlocks(),
          systemLabel: "근골격계",
        }),
    },
  ];

  const defaultItems = getDefaultReactSlashMenuItems(editor).filter(
    (item) => !mediaMenuTitles.has(item.title),
  );

  const integrationItems: DefaultReactSuggestionItem[] = [
    {
      title: "이미지 추가 · 준비 중",
      subtext: "임상 첨부 저장소와 권한 계약이 연결되면 활성화됩니다.",
      aliases: ["image", "사진", "첨부"],
      badge: "미연동",
      group: "외부 연동",
      icon: <CdsCommunicationCameraIcon size={18} />,
      onItemClick: () =>
        onNotice("이미지 추가는 임상 첨부 저장소 연동 후 활성화됩니다."),
    },
    {
      title: "동영상 추가 · 준비 중",
      subtext: "임상 미디어 저장·조회 계약이 연결되면 활성화됩니다.",
      aliases: ["video", "동영상", "영상"],
      badge: "미연동",
      group: "외부 연동",
      icon: <CdsCommunicationVideoIcon size={18} />,
      onItemClick: () =>
        onNotice("동영상 추가는 임상 미디어 저장소 연동 후 활성화됩니다."),
    },
    {
      title: "광학검사 불러오기 · 미연동",
      subtext: "권한이 있는 연결 장치와 검사 결과가 있을 때만 활성화됩니다.",
      aliases: ["광학", "검사", "device", "optical"],
      badge: "장치 필요",
      group: "외부 연동",
      icon: <CdsMedicalScanLineIcon size={18} />,
      onItemClick: () =>
        onNotice("연결된 광학검사 장치와 검사 결과가 없어 사용할 수 없습니다."),
    },
  ];

  return [...templateItems, ...defaultItems, ...integrationItems];
}

export function ChartSoapBlockEditor() {
  const [documentJson, setDocumentJson] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [notice, setNotice] = useState(
    "블록 왼쪽의 + 또는 / 명령으로 내용을 추가해 보세요.",
  );
  const editor = useCreateBlockNote({
    schema: chartSoapBlockSchema,
    initialContent: createDefaultSoapTemplateBlocks(true),
    dictionary: {
      ...ko,
      placeholders: {
        ...ko.placeholders,
        default: "내용을 입력하거나 '/'를 눌러 블록을 추가하세요.",
        emptyDocument: "'/'를 눌러 SOAP 템플릿을 추가하세요.",
      },
    },
  });
  const suggestionItems = useMemo(
    () => buildSoapSuggestionItems({ editor, onNotice: setNotice }),
    [editor],
  );

  const updateDocumentJson = () => {
    setDocumentJson(JSON.stringify(editor.document, null, 2));
  };

  const resetToSample = () => {
    editor.replaceBlocks(editor.document, createDefaultSoapTemplateBlocks(true));
    setNotice("기본 SOAP 샘플을 복원했습니다.");
    updateDocumentJson();
  };

  const resetToBlank = () => {
    editor.replaceBlocks(editor.document, [{ type: "paragraph" }]);
    setNotice("빈 문서로 초기화했습니다. / 또는 왼쪽 +로 템플릿을 추가해 보세요.");
    updateDocumentJson();
  };

  const toggleInspector = () => {
    updateDocumentJson();
    setInspectorOpen((current) => !current);
  };

  return (
    <section className={styles.prototype} aria-label="BlockNote SOAP 편집기 시안">
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>실제 BlockNote · 저장되지 않는 시안</div>
          <h1 className={styles.title}>SOAP 블록 문서</h1>
          <p className={styles.description}>
            블록 위에 마우스를 올려 왼쪽 +와 드래그 핸들을 사용하거나, / 명령과 텍스트 선택 툴바를 시험해 보세요.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button type="button" variant="outline" size="sm" onClick={resetToBlank}>
            <CdsActionsPlusSquareIcon data-icon="inline-start" />
            빈 문서
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetToSample}>
            <CdsActionsRotateCcwIcon data-icon="inline-start" />
            샘플 복원
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-expanded={inspectorOpen}
            onClick={toggleInspector}
          >
            <CdsContentCommandIcon data-icon="inline-start" />
            문서 JSON {inspectorOpen ? "닫기" : "보기"}
          </Button>
        </div>
      </header>

      <div className={styles.status} role="status" aria-live="polite">
        {notice}
      </div>

      <div className={styles.workspace}>
        <div className={styles.editorFrame}>
          <BlockNoteView
            className={styles.editor}
            editor={editor}
            editable
            slashMenu={false}
            theme="light"
            onChange={updateDocumentJson}
          >
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                filterSuggestionItems(suggestionItems, query)
              }
            />
          </BlockNoteView>
        </div>

        {inspectorOpen ? (
          <aside className={styles.inspector} aria-label="SOAP 문서 JSON">
            <div className={styles.inspectorHeader}>
              <div>
                <strong>BlockNote JSON</strong>
                <span>향후 SOAP 저장 정본 후보</span>
              </div>
              <span>{editor.document.length}개 최상위 블록</span>
            </div>
            <pre>{documentJson}</pre>
          </aside>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <span>선택 툴바: 굵게 · 기울임 · 밑줄 · 링크 · 정렬</span>
        <span>미디어와 광학검사는 실제 연동 전까지 문서에 삽입되지 않습니다.</span>
      </footer>
    </section>
  );
}
