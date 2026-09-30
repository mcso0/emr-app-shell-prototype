"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { HistoryExtension } from "@blocknote/core/extensions";
import { useEditorState } from "@blocknote/react";
import { IconEraser, IconMarkerAlt, IconOrderedList, IconStrikethrough, IconTable, IconUnderline } from "obra-icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  CdsActionsCheckSquareIcon,
  CdsActionsMinusIcon,
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
import { CdsFilesMoreVerticalIcon } from "@/components/cds-icons/files-and-layout";
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
  run: () => void;
  active?: boolean;
  disabled?: boolean;
};

const toolGroups = [
  ["undo", "redo"],
  ["style", "bullet", "bold"],
  ["photo", "video"],
  ["phrases", "templates", "optical"],
  ["numbered", "italic", "strike", "underline", "align-left", "align-center", "highlight", "link", "checklist", "divider", "table", "clear", "records"],
] as const;

type ToolbarEdges = { overflow: boolean; left: boolean; right: boolean; hiddenIds: string[] };
const initialEdges: ToolbarEdges = { overflow: false, left: false, right: false, hiddenIds: [] };

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
  requestAnimationFrame(() => editor.focus());
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
  const toolbarViewportRef = useRef<HTMLDivElement>(null);
  const toolbarWrapRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreFinalFocusRef = useRef<HTMLElement | null>(null);
  const toolButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [edges, setEdges] = useState<ToolbarEdges>(initialEdges);
  const [rovingId, setRovingId] = useState("style");
  const [moreSnapshotIds, setMoreSnapshotIds] = useState<string[]>([]);
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

  useLayoutEffect(() => {
    const wrap = toolbarWrapRef.current;
    const viewport = toolbarViewportRef.current;
    const track = toolbarRef.current;
    if (!wrap || !viewport || !track) return;

    const measure = () => {
      const availableWidth = wrap.clientWidth - 24;
      const overflow = track.getBoundingClientRect().width + 10 > availableWidth + 0.5;
      const viewportBounds = viewport.getBoundingClientRect();
      const visibleLeft = viewportBounds.left;
      const visibleRight = viewportBounds.right;
      const hiddenIds = [...toolButtonRefs.current.entries()]
        .filter(([, button]) => {
          const bounds = button.getBoundingClientRect();
          return bounds.left < visibleLeft - 0.5 || bounds.right > visibleRight + 0.5;
        })
        .map(([id]) => id);
      const next = {
        overflow,
        left: viewport.scrollLeft > 1,
        right: viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft > 1,
        hiddenIds,
      };
      setEdges((current) => current.overflow === next.overflow && current.left === next.left && current.right === next.right &&
        current.hiddenIds.length === next.hiddenIds.length && current.hiddenIds.every((id, index) => id === next.hiddenIds[index])
        ? current
        : next);
    };
    let measureFrame = 0;
    const scheduleMeasure = () => {
      if (measureFrame) return;
      measureFrame = requestAnimationFrame(() => {
        measureFrame = 0;
        measure();
      });
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(wrap);
    observer.observe(viewport);
    observer.observe(track);
    viewport.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(measureFrame);
      observer.disconnect();
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  useEffect(() => {
    if (!menu || menu === "more") return;
    // Move focus after the trigger's keyup, so Enter activation cannot also
    // activate the first menu item as focus enters the newly mounted popup.
    const focusFrame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"], button, input')?.focus();
    });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  useEffect(() => () => { recordLoadIdRef.current += 1; }, []);

  const openMenu = (next: typeof menu) => {
    setMenu(menu === next ? null : next);
  };

  const revealTool = (id: string) => {
    const viewport = toolbarViewportRef.current;
    const button = toolButtonRefs.current.get(id);
    if (!viewport || !button) return;
    const view = viewport.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    const visibleLeft = view.left;
    const visibleRight = view.right;
    const inset = 4;
    let delta = 0;
    if (buttonBounds.left < visibleLeft + inset) delta = buttonBounds.left - visibleLeft - inset;
    else if (buttonBounds.right > visibleRight - inset) delta = buttonBounds.right - visibleRight + inset;
    if (delta) viewport.scrollBy({ left: delta, behavior: "instant" });
  };

  const onToolbarKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " " || event.code === "Space") {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-toolbar-control]');
      if (!button || button.getAttribute("aria-disabled") === "true") return;
      event.preventDefault();
      button.click();
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-toolbar-control]"))
      .filter((button) => !button.disabled);
    const index = controls.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || controls.length === 0) return;
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 : Math.max(0, Math.min(controls.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
    event.preventDefault();
    controls[nextIndex]?.focus({ preventScroll: true });
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
    requestAnimationFrame(() => editor.focus());
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
    { id: "undo", label: "실행 취소", icon: <CdsActionsRotateCcwIcon size={16} />, disabled: !state.canUndo, run: () => editor.undo() },
    { id: "redo", label: "다시 실행", icon: <CdsActionsRotateCwIcon size={16} />, disabled: !state.canRedo, run: () => editor.redo() },
    { id: "style", label: "문단 스타일", icon: <CdsContentTypeIcon size={16} />, run: () => openMenu("style") },
    { id: "bullet", label: "글머리 목록", icon: <CdsContentListIcon size={16} />, active: state.blockType === "bulletListItem", run: () => toggleList("bulletListItem") },
    { id: "bold", label: "굵게", icon: <CdsContentBoldIcon size={16} />, active: Boolean(state.styles.bold), run: () => toggleStyle("bold") },
    { id: "photo", label: "사진 첨부", icon: <CdsCommunicationCameraIcon size={16} />, run: () => onLocalMediaRequest("image") },
    { id: "video", label: "영상 첨부", icon: <CdsCommunicationVideoIcon size={16} />, run: () => onLocalMediaRequest("video") },
    { id: "phrases", label: "상용구", icon: <CdsMedicalMessageCircleIcon size={16} />, run: () => openMenu("phrases") },
    { id: "templates", label: "템플릿", icon: <CdsMedicalClipboardPenIcon size={16} />, run: () => openMenu("templates") },
    { id: "optical", label: "광학검사", icon: <CdsMedicalScanLineIcon size={16} />, run: () => onNotice("광학검사 패널은 아직 연결되지 않았습니다.") },
    { id: "numbered", label: "번호 목록", icon: <IconOrderedList size={16} strokeWidth={1.5} />, active: state.blockType === "numberedListItem", run: () => toggleList("numberedListItem") },
    { id: "italic", label: "기울임", icon: <CdsContentItalicIcon size={16} />, active: Boolean(state.styles.italic), run: () => toggleStyle("italic") },
    { id: "strike", label: "취소선", icon: <IconStrikethrough size={16} strokeWidth={1.5} />, active: Boolean(state.styles.strike), run: () => toggleStyle("strike") },
    { id: "underline", label: "밑줄", icon: <IconUnderline size={16} strokeWidth={1.5} />, active: Boolean(state.styles.underline), run: () => toggleStyle("underline") },
    { id: "align-left", label: "왼쪽 정렬", icon: <CdsContentAlignLeftIcon size={16} />, active: state.alignment === "left", run: () => setAlignment("left") },
    { id: "align-center", label: "가운데 정렬", icon: <CdsContentAlignCenterIcon size={16} />, active: state.alignment === "center", run: () => setAlignment("center") },
    { id: "highlight", label: "강조 색상", icon: <IconMarkerAlt size={16} strokeWidth={1.5} />, active: state.styles.backgroundColor === "yellow", run: () => toggleStyle("backgroundColor") },
    { id: "link", label: "링크 삽입", icon: <CdsContentLinkIcon size={16} />, run: () => { setLinkUrl(editor.getSelectedLinkUrl() ?? ""); setMenu("link"); } },
    { id: "checklist", label: "체크리스트", icon: <CdsActionsCheckSquareIcon size={16} />, active: state.blockType === "checkListItem", run: () => toggleList("checkListItem") },
    { id: "divider", label: "구분선", icon: <CdsActionsMinusIcon size={16} />, run: () => { const block = editor.getTextCursorPosition().block; editor.insertBlocks([{ type: "divider" }], block, "after"); } },
    { id: "table", label: "표 삽입", icon: <IconTable size={16} strokeWidth={1.5} />, run: () => {
      const block = editor.getTextCursorPosition().block;
      editor.insertBlocks([{ type: "table", content: { type: "tableContent", rows: [
        { cells: ["", "", ""] },
        { cells: ["", "", ""] },
      ] } }], block, "after");
    } },
    { id: "clear", label: "서식 지우기", icon: <IconEraser size={16} strokeWidth={1.5} />, run: () => { editor.focus(); editor.removeStyles({ bold: true, italic: true, underline: true, strike: true, code: true, backgroundColor: "yellow", textColor: "default" }); } },
    { id: "records", label: "기록 삽입", icon: <CdsMedicalFileTextIcon size={16} />, run: () => openMenu("records") },
  ];
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  const moreToolIds = menu === "more" ? moreSnapshotIds : edges.hiddenIds;
  const moreTools = moreToolIds.flatMap((id) => toolsById.has(id) ? [toolsById.get(id)!] : []);
  const activeMenu = menu;
  const toolsThatRestoreEditorFocus = new Set([
    "undo", "redo", "bullet", "bold", "numbered", "italic", "strike", "underline",
    "align-left", "align-center", "highlight", "checklist", "divider", "table", "clear",
  ]);
  const toolsThatOpenMenus = new Set(["style", "phrases", "templates", "records", "link"]);

  const rememberTrigger = (target: HTMLElement) => {
    menuTriggerRef.current = menuRef.current?.contains(target)
      ? moreButtonRef.current ?? target
      : target;
  };

  const toolButton = (tool: Tool, overflow = false) => {
    const unavailable = tool.disabled || (!state.hasText && ["bold", "italic", "strike", "underline", "highlight", "link"].includes(tool.id));
    const run = (target: HTMLElement) => {
      rememberTrigger(target);
      if (unavailable) return;
      if (overflow) moreFinalFocusRef.current = toolsThatRestoreEditorFocus.has(tool.id) ? editor.domElement ?? null : null;
      tool.run();
      revealTool(tool.id);
      if (toolsThatRestoreEditorFocus.has(tool.id)) editor.focus();
      if (overflow && !toolsThatOpenMenus.has(tool.id)) {
        setMenu(null);
        // The menu's focus manager must release the popup before editor focus returns.
        if (toolsThatRestoreEditorFocus.has(tool.id)) requestAnimationFrame(() => editor.focus());
      }
    };
    if (overflow) {
      const props = {
        className: "h-8 justify-start emr-text-dense",
        "aria-label": tool.label,
        "data-overflow-tool-id": tool.id,
        disabled: unavailable,
        closeOnClick: false,
        onMouseDown: (event: React.MouseEvent<HTMLElement>) => event.preventDefault(),
        onClick: (event: React.MouseEvent<HTMLElement>) => run(event.currentTarget),
      };
      const content = <>
        <span aria-hidden="true" data-toolbar-menu-icon className="inline-flex size-4 shrink-0 items-center justify-center">{tool.icon}</span>
        <span data-toolbar-menu-label className="min-w-0 flex-1 text-left">{tool.label}</span>
      </>;
      return tool.active === undefined
        ? <DropdownMenuItem key={tool.id} {...props}>{content}</DropdownMenuItem>
        : <DropdownMenuCheckboxItem key={tool.id} checked={tool.active} {...props}>{content}</DropdownMenuCheckboxItem>;
    }
    const button = <Button
      key={tool.id}
      type="button"
      variant="ghost"
      size="icon"
      className={styles.toolButton}
      aria-label={tool.label}
      aria-pressed={tool.active}
      aria-haspopup={toolsThatOpenMenus.has(tool.id) ? "menu" : undefined}
      aria-expanded={menu === tool.id ? true : undefined}
      aria-disabled={unavailable}
      tabIndex={effectiveRovingId === tool.id ? 0 : -1}
      data-toolbar-control={tool.id}
      ref={(node) => { if (node) toolButtonRefs.current.set(tool.id, node); else toolButtonRefs.current.delete(tool.id); }}
      onFocus={() => { setRovingId(tool.id); revealTool(tool.id); }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => run(event.currentTarget)}
    >
      {tool.icon}<span className={styles.menuLabel}>{tool.label}</span>
    </Button>;
    const menuTrigger = toolsThatOpenMenus.has(tool.id)
      ? <PopoverTrigger render={button} />
      : button;
    return <Tooltip key={tool.id}><TooltipTrigger render={menuTrigger} /><TooltipContent side="bottom">{tool.label}</TooltipContent></Tooltip>;
  };

  const effectiveRovingId = rovingId === "more" && !edges.overflow && menu !== "more" ? "style" : rovingId;
  const showMore = edges.overflow || menu === "more";

  return (
    <DropdownMenu open={menu === "more"} modal={false} onOpenChange={(open) => {
      if (open) {
        moreFinalFocusRef.current = moreButtonRef.current;
        setMoreSnapshotIds([...edges.hiddenIds]);
        setMenu("more");
      } else if (menu === "more") setMenu(null);
    }}>
    <Popover open={activeMenu !== null && menu !== "more"} onOpenChange={(open) => { if (!open && menu !== "more") setMenu(null); }}>
    <div className={styles.toolbarWrap} ref={toolbarWrapRef} role="toolbar" aria-orientation="horizontal" aria-label="SOAP 문서 편집 도구" onKeyDown={onToolbarKeyDown} data-toolbar-wrap>
      <div className={styles.toolbarShell} data-overflow={edges.overflow ? "true" : "false"} data-toolbar-shell>
        <div className={styles.toolbarViewport} ref={toolbarViewportRef} data-toolbar-viewport role="group" aria-label="서식 도구 가로 스크롤">
          <div className={styles.toolbar} ref={toolbarRef} data-toolbar-track>
            {toolGroups.map((group, groupIndex) => <div className={styles.toolGroup} key={groupIndex}>
              {groupIndex > 0 ? <span className={styles.toolSeparator} aria-hidden="true" /> : null}
              {group.map((id) => {
                const tool = toolsById.get(id);
                return tool ? toolButton(tool) : null;
              })}
            </div>)}
          </div>
        </div>
        {edges.left ? <span className={`${styles.toolbarFade} ${styles.toolbarFadeLeft}`} data-toolbar-fade="left" aria-hidden="true" /> : null}
        {edges.right ? <span className={`${styles.toolbarFade} ${styles.toolbarFadeRight}`} data-toolbar-fade="right" aria-hidden="true" /> : null}
        {showMore ? <Tooltip><TooltipTrigger render={<PopoverTrigger render={<DropdownMenuTrigger render={<Button
        ref={moreButtonRef}
        type="button"
        variant="ghost"
        size="icon"
        className={styles.toolbarMore}
        aria-label="서식 도구 더보기"
        aria-haspopup="menu"
        aria-expanded={menu === "more"}
        tabIndex={effectiveRovingId === "more" ? 0 : -1}
        data-toolbar-control="more"
        onFocus={() => setRovingId("more")}
        onClick={(event) => rememberTrigger(event.currentTarget)}
        />} />} />}><CdsFilesMoreVerticalIcon size={16} /></TooltipTrigger><TooltipContent side="bottom">서식 도구 더보기</TooltipContent></Tooltip> : null}
      </div>
    </div>
      {menu === "more" ? (
        <DropdownMenuContent ref={menuRef} align="end" sideOffset={4}
          className="w-40 max-h-[280px]" aria-label="서식 도구 더보기"
          finalFocus={() => moreFinalFocusRef.current ?? false}>
          {moreTools.map((tool) => toolButton(tool, true))}
        </DropdownMenuContent>
      ) : null}
      {activeMenu && menu !== "more" ? (
        <PopoverContent className={styles.toolMenu} align="end" side="bottom" sideOffset={4}>
        <div ref={menuRef} role="menu" aria-label={activeMenu} onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input'));
          const index = items.indexOf(document.activeElement as HTMLElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          event.preventDefault();
          items[next]?.focus();
        }}>
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
    </DropdownMenu>
  );
}
