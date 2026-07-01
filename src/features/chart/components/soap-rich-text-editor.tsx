"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CdsContentBoldIcon,
  CdsContentItalicIcon,
  CdsContentListIcon,
  CdsContentLink2Icon,
} from "@/components/cds-icons/content-and-editor";

const editorToolbarButtonClassName =
  "text-muted-foreground hover:bg-[var(--emr-state-hover)] aria-pressed:bg-[var(--emr-state-selected)] aria-pressed:text-foreground";

function normalizeEditorLinkHref(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";
  if (/^(https?:|mailto:|tel:)/i.test(trimmedValue)) return trimmedValue;

  return `https://${trimmedValue}`;
}

function EditorToolbarButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      className={editorToolbarButtonClassName}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function SoapRichTextEditor({
  disabled = false,
  initialContent,
  label,
  onContentChange,
}: {
  disabled?: boolean;
  initialContent: string;
  label: string;
  onContentChange: (content: string) => void;
}) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const disabledRef = useRef(disabled);
  const editorAriaLabel = label === "기본 SOAP" ? "기본 SOAP 기록" : `${label} SOAP 기록`;
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[var(--emr-text-link)] underline underline-offset-2",
        },
      }),
      Placeholder.configure({
        placeholder: "SOAP 내용을 자유롭게 입력하세요.",
      }),
    ],
    content: initialContent,
    editable: !disabled,
    editorProps: {
      attributes: {
        "aria-label": editorAriaLabel,
        class:
          "min-h-[180px] px-4 py-3 emr-text-dense leading-5 outline-none [&_ol]:my-1.5 [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-[var(--emr-text-placeholder)]",
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      setActiveEditor(currentEditor);
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (disabledRef.current) return;
      onContentChange(currentEditor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    disabledRef.current = disabled;
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (disabled) {
      const timeoutId = window.setTimeout(() => setLinkOpen(false), 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [disabled]);

  const runEditorCommand = (command: (editor: Editor) => void) => {
    if (!activeEditor || disabled) return;

    command(activeEditor);
  };
  const openLinkEditor = () => {
    if (!activeEditor || disabled) return;

    setLinkValue((activeEditor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  };
  const applyLink = () => {
    if (!activeEditor || disabled) return;

    const href = normalizeEditorLinkHref(linkValue);

    if (!href) {
      runEditorCommand((currentEditor) => currentEditor.chain().focus().unsetLink().run());
    } else {
      runEditorCommand((currentEditor) =>
        currentEditor.chain().focus().extendMarkRange("link").setLink({ href }).run()
      );
    }

    setLinkOpen(false);
  };
  const removeLink = () => {
    if (disabled) return;

    runEditorCommand((currentEditor) => currentEditor.chain().focus().unsetLink().run());
    setLinkValue("");
    setLinkOpen(false);
  };
  return (
    <>
      {editor ? (
        <BubbleMenu
          editor={editor}
          updateDelay={0}
          appendTo={() => document.body}
          options={{
            placement: "top",
            offset: 10,
            shift: { padding: 8 },
          }}
          shouldShow={({ editor: currentEditor, state }) =>
            !disabled &&
            (linkOpen || (currentEditor.isEditable && !state.selection.empty))
          }
          role="toolbar"
          aria-label={`${label} 선택 서식 도구`}
          className="z-50 flex items-center gap-1 rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-2 py-1.5 shadow-lg"
        >
          <EditorToolbarButton
            active={activeEditor?.isActive("bold") ?? false}
            disabled={!activeEditor || disabled}
            label={`${label} 굵게`}
            onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleBold().run())}
          >
            <CdsContentBoldIcon className="size-4" />
          </EditorToolbarButton>
          <EditorToolbarButton
            active={activeEditor?.isActive("italic") ?? false}
            disabled={!activeEditor || disabled}
            label={`${label} 기울임`}
            onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleItalic().run())}
          >
            <CdsContentItalicIcon className="size-4" />
          </EditorToolbarButton>
          <EditorToolbarButton
            active={activeEditor?.isActive("underline") ?? false}
            disabled={!activeEditor || disabled}
            label={`${label} 밑줄`}
            onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleUnderline().run())}
          >
            U
          </EditorToolbarButton>
          <EditorToolbarButton
            active={activeEditor?.isActive("bulletList") ?? false}
            disabled={!activeEditor || disabled}
            label={`${label} 글머리 목록`}
            onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleBulletList().run())}
          >
            <CdsContentListIcon className="size-4" />
          </EditorToolbarButton>
          <EditorToolbarButton
            active={activeEditor?.isActive("orderedList") ?? false}
            disabled={!activeEditor || disabled}
            label={`${label} 번호 목록`}
            onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleOrderedList().run())}
          >
            1.
          </EditorToolbarButton>
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${label} 링크`}
                  aria-pressed={activeEditor?.isActive("link") ?? false}
                  className={editorToolbarButtonClassName}
                  disabled={!activeEditor || disabled}
                  onClick={openLinkEditor}
                >
                  <CdsContentLink2Icon className="size-4" />
                </Button>
              }
            />
            <PopoverContent align="start" className="w-72 gap-2 p-3" initialFocus={false}>
              <div className="grid gap-1.5">
                <div className="emr-text-metadata font-semibold text-foreground">링크 추가</div>
                <Input
                  aria-label="링크 URL"
                  disabled={disabled}
                  value={linkValue}
                  placeholder="https://example.com"
                  onChange={(event) => setLinkValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyLink();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={disabled}
                  onClick={removeLink}
                >
                  해제
                </Button>
                <Button
                  type="button"
                  size="xs"
                  disabled={disabled}
                  onClick={applyLink}
                >
                  적용
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto bg-[var(--emr-surface-panel)]" />
    </>
  );
}
