"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ko } from "@blocknote/core/locales";
import {
  filterSuggestionItems,
  SuggestionMenu as SuggestionMenuExtension,
} from "@blocknote/core/extensions";
import {
  blockTypeSelectItems,
  FormattingToolbar,
  FormattingToolbarController,
  SideMenuController,
  SuggestionMenuController,
  useBlockNoteEditor,
  useCreateBlockNote,
  useExtensionState,
  type BlockTypeSelectItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { ChartSoapSlashCommandMenu } from "./chart-soap-block-command-menu";
import {
  buildSoapCommandItems,
  type ChartSoapTemplateStructure,
} from "./chart-soap-block-commands";
import {
  ChartSoapPlusCommandMenu,
  ChartSoapSideMenu,
  type ChartSoapPlusMenuRequest,
} from "./chart-soap-block-side-menu";
import {
  chartSoapBlockSchema,
  type ChartSoapBlock,
  type ChartSoapBlockEditorInstance,
  type ChartSoapPartialBlock,
} from "./chart-soap-block-schema";
import styles from "./chart-soap-live-block-editor.module.css";

const soapFormattingBlockTypes = new Set([
  "paragraph",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
]);

const localMediaPreviewWidth = 480;

function isSoapFormattingBlockTypeItem(item: BlockTypeSelectItem) {
  if (soapFormattingBlockTypes.has(item.type)) return true;

  return (
    item.type === "heading" &&
    [1, 2, 3].includes(Number(item.props?.level))
  );
}

function ChartSoapFormattingToolbar() {
  const editor = useBlockNoteEditor();
  const items = useMemo(
    () =>
      blockTypeSelectItems(editor.dictionary).filter(
        isSoapFormattingBlockTypeItem,
      ),
    [editor],
  );

  return <FormattingToolbar blockTypeSelectItems={items} />;
}

function ChartSoapSlashQuerySurface({
  editor,
}: {
  editor: ChartSoapBlockEditorInstance;
}) {
  const slashMenuState = useExtensionState(SuggestionMenuExtension, {
    editor,
    selector: (state) =>
      state
        ? {
            query: state.query,
            show: state.show,
            triggerCharacter: state.triggerCharacter,
          }
        : undefined,
  });

  useLayoutEffect(() => {
    const editorElement = editor.domElement;
    const previousSurface = editorElement?.querySelector<HTMLElement>(
      '[data-soap-slash-query="true"]',
    );
    previousSurface?.removeAttribute("data-soap-slash-query");
    previousSurface?.removeAttribute("data-soap-slash-query-empty");
    previousSurface?.removeAttribute("data-soap-slash-placeholder");

    if (
      !slashMenuState?.show ||
      slashMenuState.triggerCharacter !== "/" ||
      !editorElement
    ) {
      return;
    }

    const decorators = editorElement.querySelectorAll<HTMLElement>(
      ".bn-suggestion-decorator",
    );
    const activeDecorator = decorators.item(decorators.length - 1);
    const inlineContent = activeDecorator?.closest<HTMLElement>(
      ".bn-inline-content",
    );
    if (!inlineContent) return;

    inlineContent.dataset.soapSlashQuery = "true";
    inlineContent.dataset.soapSlashQueryEmpty =
      slashMenuState.query.length === 0 ? "true" : "false";
    inlineContent.dataset.soapSlashPlaceholder = "검색어를 입력하세요";

    return () => {
      inlineContent.removeAttribute("data-soap-slash-query");
      inlineContent.removeAttribute("data-soap-slash-query-empty");
      inlineContent.removeAttribute("data-soap-slash-placeholder");
    };
  }, [editor, slashMenuState]);

  return null;
}

export function ChartSoapLiveBlockEditor({
  allowSoapTemplateCommands = true,
  disabled = false,
  initialContent,
  onDocumentChange,
  onNotice,
  onReady,
  templateStructure = "sectioned",
}: {
  allowSoapTemplateCommands?: boolean;
  disabled?: boolean;
  initialContent: ChartSoapPartialBlock[];
  onDocumentChange: (blocks: readonly ChartSoapBlock[]) => void;
  onNotice: (message: string) => void;
  onReady: (blocks: readonly ChartSoapBlock[]) => void;
  templateStructure?: ChartSoapTemplateStructure;
}) {
  const [plusMenuRequest, setPlusMenuRequest] =
    useState<ChartSoapPlusMenuRequest | null>(null);
  const localMediaUrlsRef = useRef(new Set<string>());
  const onNoticeRef = useRef(onNotice);
  const uploadLocalMediaFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      onNoticeRef.current("이미지 또는 동영상 파일만 추가할 수 있습니다.");
      return {
        props: {
          name: file.name,
          showPreview: true,
          url: "",
        },
      };
    }

    try {
      const url = URL.createObjectURL(file);
      localMediaUrlsRef.current.add(url);
      onNoticeRef.current(
        `${file.name}을 로컬 미리보기로 추가했습니다. 서버에는 저장되지 않습니다.`,
      );
      return {
        props: {
          name: file.name,
          previewWidth: localMediaPreviewWidth,
          showPreview: true,
          url,
        },
      };
    } catch {
      onNoticeRef.current("미디어 미리보기를 만들지 못했습니다. 다시 시도해 주세요.");
      return {
        props: {
          name: file.name,
          showPreview: true,
          url: "",
        },
      };
    }
  }, []);
  const editor = useCreateBlockNote(
    {
      schema: chartSoapBlockSchema,
      initialContent,
      uploadFile: uploadLocalMediaFile,
      dictionary: {
        ...ko,
        placeholders: {
          ...ko.placeholders,
          default: "내용을 입력하거나, ‘/’를 입력하세요",
          emptyDocument: "내용을 입력하거나, ‘/’를 입력하세요",
        },
      },
    },
    [uploadLocalMediaFile],
  );
  const suggestionItems = useMemo(
    () =>
      buildSoapCommandItems({
        editor,
        includeSoapTemplates: allowSoapTemplateCommands,
        onNotice,
        templateStructure,
      }),
    [allowSoapTemplateCommands, editor, onNotice, templateStructure],
  );
  const openPlusMenu = useCallback((request: ChartSoapPlusMenuRequest) => {
    setPlusMenuRequest((current) => {
      current?.releaseSideMenu();
      return request;
    });
  }, []);
  const sideMenu = useCallback(
    () => <ChartSoapSideMenu onOpenPlus={openPlusMenu} />,
    [openPlusMenu],
  );
  const getSuggestionItems = useCallback(
    async (query: string) => filterSuggestionItems(suggestionItems, query),
    [suggestionItems],
  );

  const initializedSelectionRef = useRef<ChartSoapBlockEditorInstance | null>(null);
  useLayoutEffect(() => {
    if (initializedSelectionRef.current === editor) return;
    initializedSelectionRef.current = editor;
    const firstBlock = editor.document[0];
    const firstParagraph = firstBlock?.children[0];
    if (firstBlock?.type === "soapSection" && firstParagraph?.type === "paragraph") {
      // Move the initial node selection without focusing the editor or changing content.
      editor.setTextCursorPosition(firstParagraph, "start");
    }
  }, [editor]);

  useEffect(() => {
    onReady(editor.document);
  }, [editor, onReady]);

  useEffect(() => {
    onNoticeRef.current = onNotice;
  }, [onNotice]);

  useEffect(
    () => () => {
      for (const url of localMediaUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      localMediaUrlsRef.current.clear();
    },
    [],
  );

  const portalElement = typeof document === "undefined" ? null : document.body;

  return (
    <div
      className={styles.editorBoundary}
      data-soap-editor-boundary
      data-read-only={disabled ? "true" : "false"}
      data-plus-menu-open={plusMenuRequest ? "true" : "false"}
    >
      <BlockNoteView
        className={styles.editor}
        editor={editor}
        editable={!disabled}
        formattingToolbar={false}
        sideMenu={false}
        slashMenu={false}
        theme="light"
        aria-label="SOAP 블록 문서"
        onChange={(currentEditor) => onDocumentChange(currentEditor.document)}
      >
        {!disabled ? (
          <>
            <FormattingToolbarController
              formattingToolbar={ChartSoapFormattingToolbar}
              floatingUIOptions={{
                useFloatingOptions: {
                  middleware: [
                    {
                      name: "soap-toolbar-offset",
                      fn({ x, y, placement }) {
                        return {
                          x,
                          y: y + (placement.startsWith("top") ? -10 : 10),
                        };
                      },
                    },
                    {
                      name: "soap-toolbar-panel-shift",
                      fn({ x, y, elements }) {
                        const contextElement = (
                          elements.reference as { contextElement?: Element }
                        ).contextElement;
                        const panel = contextElement?.closest<HTMLElement>(
                          "[data-soap-editor-boundary]",
                        );
                        if (!panel) return { x, y };

                        const panelRect = panel.getBoundingClientRect();
                        const safeInset = 8;
                        const minimumX = panelRect.left + safeInset;
                        const maximumX = Math.max(
                          minimumX,
                          panelRect.right -
                            elements.floating.getBoundingClientRect().width -
                            safeInset,
                        );
                        return {
                          x: Math.max(minimumX, Math.min(x, maximumX)),
                          y,
                        };
                      },
                    },
                  ],
                },
              }}
            />
            <SideMenuController
              sideMenu={sideMenu}
              floatingUIOptions={{
                useFloatingOptions: {
                  middleware: [
                    {
                      name: "soap-compact-heading-center",
                      fn({ x, y, elements }) {
                        const referenceElement =
                          elements.reference instanceof HTMLElement
                            ? elements.reference
                            : (
                                elements.reference as {
                                  contextElement?: Element;
                                }
                              ).contextElement;
                        const headingElement = referenceElement?.matches(
                          '[data-content-type="heading"]',
                        )
                          ? referenceElement
                          : referenceElement?.querySelector<HTMLElement>(
                              '[data-content-type="heading"]',
                            );
                        if (!(headingElement instanceof HTMLElement)) {
                          return { x, y };
                        }

                        const headingRect =
                          headingElement.getBoundingClientRect();
                        const firstLineElement =
                          headingElement.querySelector<HTMLElement>(
                            ".bn-toggle-wrapper",
                          ) ?? headingElement;
                        const firstLineRect =
                          firstLineElement.getBoundingClientRect();
                        const sideMenuHeight =
                          elements.floating.getBoundingClientRect().height;
                        return {
                          x,
                          y:
                            y +
                            (firstLineRect.top - headingRect.top) +
                            Math.max(
                              0,
                              (firstLineRect.height - sideMenuHeight) / 2,
                            ),
                        };
                      },
                    },
                  ],
                },
              }}
            />
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={getSuggestionItems}
              suggestionMenuComponent={ChartSoapSlashCommandMenu}
              portalElement={portalElement}
              floatingUIOptions={{
                useFloatingOptions: {
                  middleware: [
                    {
                      name: "soap-slash-menu-boundary",
                      fn({ x, y, elements, rects }) {
                        const contextElement = (
                          elements.reference as { contextElement?: Element }
                        ).contextElement;
                        const panel = contextElement?.closest<HTMLElement>(
                          "[data-soap-editor-boundary]",
                        );
                        if (!panel) return { x, y: y + 10 };

                        const panelRect = panel.getBoundingClientRect();
                        const floatingRect =
                          elements.floating.getBoundingClientRect();
                        const safeInset = 8;
                        const minimumX = Math.max(
                          safeInset,
                          panelRect.left + safeInset,
                        );
                        const maximumX = Math.max(
                          minimumX,
                          Math.min(
                            window.innerWidth - floatingRect.width - safeInset,
                            panelRect.right - floatingRect.width - safeInset,
                          ),
                        );
                        const below = y + 10;
                        const opensAbove =
                          below + floatingRect.height >
                            window.innerHeight - safeInset &&
                          rects.reference.y - floatingRect.height - 10 >=
                            safeInset;

                        return {
                          x: Math.max(minimumX, Math.min(x, maximumX)),
                          y: opensAbove
                            ? rects.reference.y - floatingRect.height - 10
                            : below,
                        };
                      },
                    },
                  ],
                },
              }}
            />
            <ChartSoapSlashQuerySurface editor={editor} />
          </>
        ) : null}
      </BlockNoteView>
      {!disabled ? (
        <ChartSoapPlusCommandMenu
          editor={editor}
          items={suggestionItems}
          request={plusMenuRequest}
          onClose={() => setPlusMenuRequest(null)}
        />
      ) : null}
    </div>
  );
}
