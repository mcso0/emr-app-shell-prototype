"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HistoryExtension } from "@blocknote/core/extensions";
import { useEditorState } from "@blocknote/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  CdsActionsCheckSquareIcon,
  CdsActionsRotateCcwIcon,
  CdsActionsRotateCwIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsCommunicationCameraIcon,
  CdsCommunicationVideoIcon,
} from "@/components/cds-icons/communication-and-media";
import {
  CdsContentAlignCenterIcon,
  CdsContentAlignLeftIcon,
  CdsContentBoldIcon,
  CdsContentItalicIcon,
  CdsContentLinkIcon,
  CdsContentListIcon,
  CdsContentTypeIcon,
} from "@/components/cds-icons/content-and-editor";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import {
  CdsMedicalClipboardPenIcon,
  CdsMedicalFileTextIcon,
  CdsMedicalMessageCircleIcon,
  CdsMedicalScanLineIcon,
} from "@/components/cds-icons/medical-and-domain";

import type { ChartSoapCommandItem } from "./chart-soap-block-commands";
import type { ChartSoapBlockEditorInstance } from "./chart-soap-block-schema";
import styles from "./chart-soap-live-block-editor.module.css";

export type ChartSoapRecordInsertionItem = {
  id: string;
  label: string;
  sourceLabel: string;
  text: string;
};

export type ChartSoapRecordSource = {
  id: string;
  label: string;
  sourceLabel: string;
  load: () => Promise<ChartSoapRecordInsertionItem[]>;
};

type Tool = {
  id: string;
  label: string;
  icon: ReactNode;
  priority: number;
  run: () => void;
  active?: boolean;
  disabled?: boolean;
};

const writingAids = [
  { label: "증상 경과", text: "증상 시작: [입력]\n빈도 및 지속 시간: [입력]\n이전 대비 변화: [입력]" },
  { label: "보호자 설명", text: "설명 내용: [입력]\n보호자 질문 및 답변: [입력]\n동의 또는 보류 사항: [입력]" },
  { label: "추적 계획", text: "재진 시점: [입력]\n관찰할 항목: [입력]\n변화 시 안내: [입력]" },
] as const;

const outlineTemplates = [
  { label: "초진 문진", text: "초진 문진\n주호소: [입력]\n과거력: [입력]\n복용약 및 알레르기: [입력]\n식욕·음수·배변·배뇨: [입력]" },
  { label: "피부 기록", text: "피부 기록\n부위 및 분포: [입력]\n발생 기간: [입력]\n병변 양상 및 소양감: [입력]\n검사 소견: [입력]" },
  { label: "안과 기록", text: "안과 기록\n좌/우: [입력]\n증상 및 경과: [입력]\n검사명 및 소견: [입력]\n평가 및 계획: [입력]" },
] as const;

function hasTextContent(editor: ChartSoapBlockEditorInstance) {
  return (editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]).some(
    (block) => block.content !== undefined,
  );
}

function insertPlainText(editor: ChartSoapBlockEditorInstance, text: string) {
  editor.focus();
  editor.insertInlineContent(text);
}

export function ChartSoapToolbar({
  allowSoapTemplateCommands,
  editor,
  onLocalMediaRequest,
  onNotice,
  recordInsertionItems = [],
  recordSources = [],
  suggestionItems,
}: {
  allowSoapTemplateCommands: boolean;
  editor: ChartSoapBlockEditorInstance;
  onLocalMediaRequest: (kind: "image" | "video") => void;
  onNotice: (message: string) => void;
  recordInsertionItems?: readonly ChartSoapRecordInsertionItem[];
  recordSources?: readonly ChartSoapRecordSource[];
  suggestionItems: readonly ChartSoapCommandItem[];
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [menu, setMenu] = useState<"more" | "style" | "phrases" | "templates" | "records" | "recordParts" | "link" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [recordParts, setRecordParts] = useState<ChartSoapRecordInsertionItem[]>([]);
  const [recordLoadState, setRecordLoadState] = useState<"idle" | "loading" | "error">("idle");
  const recordLoadIdRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const history = current.getExtension(HistoryExtension);
      const selected = current.getSelection()?.blocks ?? [current.getTextCursorPosition().block];
      const block = selected[0];
      return {
        styles: current.getActiveStyles(),
      blockType: block.type,
        headingLevel: block.type === "heading" ? block.props.level : undefined,
        alignment: "textAlignment" in block.props ? block.props.textAlignment : undefined,
        hasText: hasTextContent(current),
        canUndo: history?.undoCommand(current._tiptapEditor.state) ?? false,
        canRedo: history?.redoCommand(current._tiptapEditor.state) ?? false,
      };
    },
  });

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const observer = new ResizeObserver(() => setWidth(toolbar.clientWidth));
    observer.observe(toolbar);
    setWidth(toolbar.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"], button, input')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  useEffect(() => () => { recordLoadIdRef.current += 1; }, []);

  const openMenu = (next: typeof menu) => {
    setMenu(menu === next ? null : next);
  };

  const rememberTrigger = (target: HTMLElement) => {
    menuTriggerRef.current = menuRef.current?.contains(target)
      ? toolbarRef.current?.querySelector<HTMLElement>('[aria-label="도구 더보기"]') ?? target
      : target;
  };

  const loadRecordSource = async (source: ChartSoapRecordSource) => {
    const loadId = ++recordLoadIdRef.current;
    setRecordParts([]);
    setRecordLoadState("loading");
    setMenu("recordParts");
    try {
      const parts = await source.load();
      if (recordLoadIdRef.current !== loadId) return;
      setRecordParts(parts);
      setRecordLoadState("idle");
    } catch {
      if (recordLoadIdRef.current !== loadId) return;
      setRecordLoadState("error");
      onNotice("이전 SOAP 기록을 불러오지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const changeBlock = (type: "paragraph" | "heading" | "bulletListItem" | "numberedListItem" | "checkListItem", level?: 1 | 2 | 3) => {
    editor.focus();
    const blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
    for (const block of blocks) {
      if (!Array.isArray(block.content)) continue;
      editor.updateBlock(block, type === "heading" ? { type, props: { level } } : { type });
    }
    setMenu(null);
  };
  const toggleList = (type: "bulletListItem" | "numberedListItem" | "checkListItem") =>
    changeBlock(state.blockType === type ? "paragraph" : type);

  const toggleStyle = (style: "bold" | "italic" | "strike" | "underline" | "backgroundColor") => {
    editor.focus();
    if (style === "backgroundColor") {
      if (state.styles.backgroundColor === "yellow") editor.removeStyles({ backgroundColor: "yellow" });
      else editor.addStyles({ backgroundColor: "yellow" });
    } else editor.toggleStyles({ [style]: true });
  };

  const setAlignment = (alignment: "left" | "center") => {
    editor.focus();
    for (const block of editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]) {
      if (Array.isArray(block.content) && "textAlignment" in block.props) {
        editor.updateBlock(block, { props: { textAlignment: alignment } });
      }
    }
  };

  const runTemplate = (id: string) => {
    const command = suggestionItems.find((item) => item.id === id);
    command?.onItemClick();
    setMenu(null);
  };

  const tools: Tool[] = [
    { id: "undo", label: "실행 취소", icon: <CdsActionsRotateCcwIcon size={16} />, priority: 0, disabled: !state.canUndo, run: () => editor.undo() },
    { id: "redo", label: "다시 실행", icon: <CdsActionsRotateCwIcon size={16} />, priority: 7, disabled: !state.canRedo, run: () => editor.redo() },
    { id: "style", label: "문단 스타일", icon: <CdsContentTypeIcon size={16} />, priority: 1, run: () => openMenu("style") },
    { id: "bullet", label: "글머리 목록", icon: <CdsContentListIcon size={16} />, priority: 6, active: state.blockType === "bulletListItem", run: () => toggleList("bulletListItem") },
    { id: "numbered", label: "번호 목록", icon: <span aria-hidden="true">1.</span>, priority: 12, active: state.blockType === "numberedListItem", run: () => toggleList("numberedListItem") },
    { id: "bold", label: "굵게", icon: <CdsContentBoldIcon size={16} />, priority: 2, active: Boolean(state.styles.bold), run: () => toggleStyle("bold") },
    { id: "italic", label: "기울임", icon: <CdsContentItalicIcon size={16} />, priority: 11, active: Boolean(state.styles.italic), run: () => toggleStyle("italic") },
    { id: "strike", label: "취소선", icon: <span aria-hidden="true"><s>S</s></span>, priority: 16, active: Boolean(state.styles.strike), run: () => toggleStyle("strike") },
    { id: "underline", label: "밑줄", icon: <span aria-hidden="true"><u>U</u></span>, priority: 15, active: Boolean(state.styles.underline), run: () => toggleStyle("underline") },
    { id: "align-left", label: "왼쪽 정렬", icon: <CdsContentAlignLeftIcon size={16} />, priority: 17, active: state.alignment === "left", run: () => setAlignment("left") },
    { id: "align-center", label: "가운데 정렬", icon: <CdsContentAlignCenterIcon size={16} />, priority: 18, active: state.alignment === "center", run: () => setAlignment("center") },
    { id: "highlight", label: "강조 색상", icon: <span aria-hidden="true">▰</span>, priority: 19, active: state.styles.backgroundColor === "yellow", run: () => toggleStyle("backgroundColor") },
    { id: "link", label: "링크 삽입", icon: <CdsContentLinkIcon size={16} />, priority: 20, run: () => { setLinkUrl(editor.getSelectedLinkUrl() ?? ""); setMenu("link"); } },
    { id: "checklist", label: "체크리스트", icon: <CdsActionsCheckSquareIcon size={16} />, priority: 13, active: state.blockType === "checkListItem", run: () => toggleList("checkListItem") },
    { id: "divider", label: "구분선", icon: <span aria-hidden="true">—</span>, priority: 21, run: () => { const block = editor.getTextCursorPosition().block; editor.insertBlocks([{ type: "divider" }], block, "after"); } },
    { id: "table", label: "표 삽입", icon: <span aria-hidden="true">▦</span>, priority: 23, run: () => {
      const block = editor.getTextCursorPosition().block;
      editor.insertBlocks([{ type: "table", content: { type: "tableContent", rows: [
        { cells: ["", "", ""] },
        { cells: ["", "", ""] },
      ] } }], block, "after");
    } },
    { id: "clear", label: "서식 지우기", icon: <span aria-hidden="true">Tx</span>, priority: 22, run: () => { editor.focus(); editor.removeStyles({ bold: true, italic: true, underline: true, strike: true, code: true, backgroundColor: "yellow", textColor: "default" }); } },
    { id: "photo", label: "사진 첨부", icon: <CdsCommunicationCameraIcon size={16} />, priority: 3, run: () => onLocalMediaRequest("image") },
    { id: "video", label: "영상 첨부", icon: <CdsCommunicationVideoIcon size={16} />, priority: 10, run: () => onLocalMediaRequest("video") },
    { id: "phrases", label: "상용구", icon: <CdsMedicalMessageCircleIcon size={16} />, priority: 5, run: () => openMenu("phrases") },
    { id: "templates", label: "템플릿", icon: <CdsMedicalClipboardPenIcon size={16} />, priority: 8, run: () => openMenu("templates") },
    { id: "records", label: "기록 삽입", icon: <CdsMedicalFileTextIcon size={16} />, priority: 14, run: () => openMenu("records") },
    { id: "optical", label: "광학검사", icon: <CdsMedicalScanLineIcon size={16} />, priority: 9, run: () => onNotice("광학검사 패널은 아직 연결되지 않았습니다.") },
  ];
  // 24px horizontal padding, a 30px more button, and 4px gaps.
  const visibleCount = Math.max(0, Math.floor((width - 54) / 34));
  const visibleIds = new Set(
    [...tools].sort((a, b) => a.priority - b.priority).slice(0, visibleCount).map((tool) => tool.id),
  );
  const primaryTools = tools.filter((tool) => visibleIds.has(tool.id));
  const overflowTools = tools.filter((tool) => !visibleIds.has(tool.id));
  const activeMenu = menu === "more" && overflowTools.length === 0 ? null : menu;

  const toolButton = (tool: Tool, overflow = false) => {
    const unavailable = tool.disabled || (!state.hasText && ["bold", "italic", "strike", "underline", "highlight", "link"].includes(tool.id));
    const button = <button
      key={tool.id}
      type="button"
      className={overflow ? styles.menuItem : styles.toolButton}
      role={overflow ? tool.active === undefined ? "menuitem" : "menuitemcheckbox" : undefined}
      aria-label={tool.label}
      aria-pressed={!overflow && tool.active !== undefined ? tool.active : undefined}
      aria-checked={overflow && tool.active !== undefined ? tool.active : undefined}
      aria-expanded={menu === tool.id ? true : undefined}
      aria-disabled={unavailable}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => { rememberTrigger(event.currentTarget); if (unavailable) return; tool.run(); if (overflow && !["style", "phrases", "templates", "records", "link"].includes(tool.id)) setMenu(null); }}
    >
      {tool.icon}<span className={styles.menuLabel}>{tool.label}</span>
    </button>;
    return overflow ? button : <Tooltip key={tool.id}><TooltipTrigger render={button} /><TooltipContent side="bottom">{tool.label}</TooltipContent></Tooltip>;
  };

  return (
    <Popover open={activeMenu !== null} onOpenChange={(open) => { if (!open) setMenu(null); }}>
    <div className={styles.toolbarWrap}>
      <div className={styles.toolbar} ref={toolbarRef} role="toolbar" aria-label="SOAP 문서 편집 도구">
        {primaryTools.map((tool) => toolButton(tool))}
        {overflowTools.length > 0 ? <Tooltip><TooltipTrigger render={<PopoverTrigger render={<button type="button" className={styles.toolButton} aria-label="도구 더보기" aria-expanded={menu === "more"} onClick={(event) => { rememberTrigger(event.currentTarget); openMenu("more"); }} />} />}><CdsFilesMoreHorizontalIcon size={16} /></TooltipTrigger><TooltipContent side="bottom">도구 더보기</TooltipContent></Tooltip> : null}
      </div>
    </div>
      {activeMenu ? (
        <PopoverContent className={styles.toolMenu} align="end" side="bottom" sideOffset={4}>
        <div ref={menuRef} role="menu" aria-label={activeMenu === "more" ? "도구 더보기" : activeMenu} onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input'));
          const index = items.indexOf(document.activeElement as HTMLElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          event.preventDefault();
          items[next]?.focus();
        }}>
          {menu === "more" ? overflowTools.map((tool) => toolButton(tool, true)) : null}
          {menu === "style" ? (
            <>
              {([ ["본문", "paragraph"], ["제목 1", "heading", 1], ["제목 2", "heading", 2], ["제목 3", "heading", 3] ] as const).map(([label, type, level]) => (
                <button key={label} type="button" role="menuitemradio" aria-checked={state.blockType === type && (type !== "heading" || state.headingLevel === level)} onMouseDown={(event) => event.preventDefault()} onClick={() => changeBlock(type, level)}>{label}</button>
              ))}
            </>
          ) : null}
          {menu === "phrases" ? writingAids.map((item) => <button key={item.label} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { insertPlainText(editor, item.text); setMenu(null); }}>{item.label}</button>) : null}
          {menu === "templates" ? (
            <>
              {outlineTemplates.map((item) => <button key={item.label} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { insertPlainText(editor, item.text); setMenu(null); }}>{item.label}</button>)}
              {allowSoapTemplateCommands ? suggestionItems.filter((item) => item.id.startsWith("template-")).map((item) => <button key={item.id} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => runTemplate(item.id)}>{item.title}</button>) : null}
            </>
          ) : null}
          {menu === "records" ? <>
            {recordInsertionItems.map((item) => <button key={item.id} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { insertPlainText(editor, `${item.label} · ${item.sourceLabel}\n${item.text}`); setMenu(null); }}>{item.label}<small>{item.sourceLabel}</small></button>)}
            {recordSources.map((source) => <button key={source.id} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => void loadRecordSource(source)}>{source.label}<small>{source.sourceLabel}</small></button>)}
            {!recordInsertionItems.length && !recordSources.length ? <p className={styles.menuNote}>연결된 기록이 없습니다.</p> : null}
          </> : null}
          {menu === "recordParts" ? <>
            <button type="button" role="menuitem" onClick={() => { recordLoadIdRef.current += 1; setMenu("records"); }}>← 기록 목록</button>
            {recordLoadState === "loading" ? <p className={styles.menuNote} role="status">이전 SOAP를 불러오는 중입니다.</p> : null}
            {recordLoadState === "error" ? <p className={styles.menuNote} role="alert">기록을 불러오지 못했습니다.</p> : null}
            {recordLoadState === "idle" && !recordParts.length ? <p className={styles.menuNote}>작성된 SOAP 항목이 없습니다.</p> : null}
            {recordParts.map((item) => <button key={item.id} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { insertPlainText(editor, `${item.label} · ${item.sourceLabel}\n${item.text}`); setMenu(null); }}>{item.label}<small>{item.sourceLabel}</small></button>)}
          </> : null}
          {menu === "link" ? <form className={styles.linkForm} onSubmit={(event) => { event.preventDefault(); try { const url = new URL(linkUrl); if (!["https:", "http:"].includes(url.protocol)) throw new Error(); editor.focus(); editor.createLink(url.toString()); setMenu(null); } catch { onNotice("http 또는 https 링크를 입력해 주세요."); } }}><label htmlFor="soap-link-url">링크 주소</label><input id="soap-link-url" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://" autoFocus /><button type="submit">적용</button></form> : null}
        </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
