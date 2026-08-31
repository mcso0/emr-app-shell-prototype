"use client";

import { useEffect, useMemo } from "react";
import { ko } from "@blocknote/core/locales";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { buildSoapSuggestionItems } from "./chart-soap-block-editor";
import {
  chartSoapBlockSchema,
  type ChartSoapBlock,
  type ChartSoapPartialBlock,
} from "./chart-soap-block-schema";
import styles from "./chart-soap-live-block-editor.module.css";

export function ChartSoapLiveBlockEditor({
  disabled = false,
  initialContent,
  onDocumentChange,
  onNotice,
  onReady,
}: {
  disabled?: boolean;
  initialContent: ChartSoapPartialBlock[];
  onDocumentChange: (blocks: readonly ChartSoapBlock[]) => void;
  onNotice: (message: string) => void;
  onReady: (blocks: readonly ChartSoapBlock[]) => void;
}) {
  const editor = useCreateBlockNote(
    {
      schema: chartSoapBlockSchema,
      initialContent,
      dictionary: {
        ...ko,
        placeholders: {
          ...ko.placeholders,
          default: "내용을 입력하거나 '/'를 눌러 블록을 추가하세요.",
          emptyDocument: "'/'를 눌러 SOAP 템플릿을 추가하세요.",
        },
      },
    },
    [],
  );
  const suggestionItems = useMemo(
    () => buildSoapSuggestionItems({ editor, onNotice }),
    [editor, onNotice],
  );

  useEffect(() => {
    onReady(editor.document);
  }, [editor, onReady]);

  return (
    <BlockNoteView
      className={styles.editor}
      editor={editor}
      editable={!disabled}
      slashMenu={false}
      theme="light"
      aria-label="SOAP 블록 문서"
      onChange={(currentEditor) => onDocumentChange(currentEditor.document)}
    >
      {!disabled ? (
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(suggestionItems, query)
          }
        />
      ) : null}
    </BlockNoteView>
  );
}
