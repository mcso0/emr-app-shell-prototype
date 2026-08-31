"use client";

import { useMemo, useState } from "react";
import { ko } from "@blocknote/core/locales";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { Button } from "@/components/ui/button";
import {
  CdsActionsPlusSquareIcon,
  CdsActionsRotateCcwIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsContentCommandIcon } from "@/components/cds-icons/content-and-editor";

import {
  chartSoapBlockSchema,
  createDefaultSoapTemplateBlocks,
} from "./chart-soap-block-schema";
import { buildSoapCommandItems } from "./chart-soap-block-commands";
import styles from "./chart-soap-block-editor.module.css";

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
        default: "내용을 입력하거나, ‘/’를 입력하세요",
        emptyDocument: "내용을 입력하거나, ‘/’를 입력하세요",
      },
    },
  });
  const suggestionItems = useMemo(
    () => buildSoapCommandItems({ editor, onNotice: setNotice }),
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
