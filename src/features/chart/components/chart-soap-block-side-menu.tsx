"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { filterSuggestionItems, SideMenuExtension } from "@blocknote/core/extensions";
import {
  DragHandleMenu,
  useBlockNoteEditor,
  useComponentsContext,
  useExtension,
  useExtensionState,
} from "@blocknote/react";

import { CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsContentGripVerticalIcon } from "@/components/cds-icons/content-and-editor";
import { EmrIconButton } from "@/components/emr/icon-button";

import { ChartSoapCommandMenu } from "./chart-soap-block-command-menu";
import type { ChartSoapCommandItem } from "./chart-soap-block-commands";
import type { ChartSoapBlockEditorInstance } from "./chart-soap-block-schema";
import styles from "./chart-soap-live-block-editor.module.css";

export type ChartSoapPlusMenuRequest = {
  blockId: string;
  releaseSideMenu: () => void;
};

export function ChartSoapSideMenu({
  onOpenPlus,
}: {
  onOpenPlus: (request: ChartSoapPlusMenuRequest) => void;
}) {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor() as ChartSoapBlockEditorInstance;
  const sideMenu = useExtension(SideMenuExtension);
  const pointerInsideRef = useRef(false);
  const focusInsideRef = useRef(false);
  const interactionActiveRef = useRef(false);
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  if (!block) return null;

  const syncMenuFreeze = () => {
    if (
      pointerInsideRef.current ||
      focusInsideRef.current ||
      interactionActiveRef.current
    ) {
      sideMenu.freezeMenu();
      return;
    }

    sideMenu.unfreezeMenu();
  };

  const setInteractionActive = (active: boolean) => {
    interactionActiveRef.current = active;
    syncMenuFreeze();
  };

  const openPlusMenu = () => {
    const currentBlock = editor.getBlock(block.id);
    if (!currentBlock) return;

    const hasContent =
      currentBlock.content === undefined ||
      (Array.isArray(currentBlock.content) && currentBlock.content.length > 0);
    const targetBlock = hasContent
      ? editor.insertBlocks([{ type: "paragraph" }], currentBlock, "after")[0]
      : currentBlock;

    setInteractionActive(true);
    onOpenPlus({
      blockId: targetBlock.id,
      releaseSideMenu: () => setInteractionActive(false),
    });
    editor.setTextCursorPosition(targetBlock);
  };

  return (
    <Components.SideMenu.Root
      className={`${styles.sideMenu} ${
        block.type === "soapSection" ? styles.soapSectionSideMenu : ""
      } bn-side-menu`}
    >
      <div
        className={styles.sideMenuControls}
        onPointerEnter={() => {
          pointerInsideRef.current = true;
          syncMenuFreeze();
        }}
        onPointerLeave={() => {
          pointerInsideRef.current = false;
          syncMenuFreeze();
        }}
        onFocusCapture={() => {
          focusInsideRef.current = true;
          syncMenuFreeze();
        }}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          focusInsideRef.current = false;
          syncMenuFreeze();
        }}
      >
        <EmrIconButton
          className={`${styles.sideMenuButton} ${styles.addButton}`}
          type="button"
          aria-label="블록 추가"
          onPointerDownCapture={(event) => {
            event.preventDefault();
          }}
          onClick={openPlusMenu}
        >
          <CdsActionsPlusIcon aria-hidden="true" data-test="soap-block-add" />
        </EmrIconButton>
        <Components.Generic.Menu.Root
          onOpenChange={setInteractionActive}
          position="left"
        >
          <Components.Generic.Menu.Trigger>
            <EmrIconButton
              className={`${styles.sideMenuButton} ${styles.grabButton}`}
              type="button"
              aria-label="블록 메뉴 열기"
              data-test="dragHandle"
              draggable
              onDragStart={(event) => {
                setInteractionActive(true);
                sideMenu.blockDragStart(event, block);
              }}
              onDragEnd={() => {
                sideMenu.blockDragEnd();
                setInteractionActive(false);
              }}
            >
              <CdsContentGripVerticalIcon
                className={styles.grabIcon}
                size={14}
                aria-hidden="true"
                data-test="soap-block-grab"
              />
            </EmrIconButton>
          </Components.Generic.Menu.Trigger>
          <DragHandleMenu />
        </Components.Generic.Menu.Root>
      </div>
    </Components.SideMenu.Root>
  );
}

type PositionedMenu = {
  left: number;
  top: number;
  placement: "top" | "bottom";
  width: number;
  height: number;
  inputLeft: number;
  inputTop: number;
  inputWidth: number;
};

function getPosition(
  editor: ChartSoapBlockEditorInstance,
  blockId: string,
): PositionedMenu | null {
  const editorElement = editor.domElement;
  const blockElement = editorElement?.querySelector<HTMLElement>(
    `.bn-block-outer[data-id="${blockId}"]`,
  );
  const panelElement = editorElement?.closest<HTMLElement>(
    "[data-soap-editor-boundary]",
  );
  if (!editorElement || !blockElement) return null;

  const blockRect = blockElement.getBoundingClientRect();
  const panelRect = (panelElement ?? editorElement).getBoundingClientRect();
  const viewportPadding = 8;
  const panelPadding = 8;
  const maxPanelWidth = Math.max(0, panelRect.width - panelPadding * 2);
  const width = Math.min(346, maxPanelWidth, window.innerWidth - viewportPadding * 2);
  const minimumLeft = Math.max(viewportPadding, panelRect.left + panelPadding);
  const maximumLeft = Math.min(
    window.innerWidth - width - viewportPadding,
    panelRect.right - width - panelPadding,
  );
  const desiredLeft = Math.max(panelRect.left + 54, blockRect.left);
  const left = Math.max(minimumLeft, Math.min(desiredLeft, maximumLeft));
  const availableBelow = window.innerHeight - blockRect.bottom - 10;
  const availableAbove = blockRect.top - 10;
  const openAbove = availableBelow < 260 && availableAbove > availableBelow;
  const height = Math.min(
    520,
    Math.max(0, openAbove ? availableAbove : availableBelow),
  );
  const top = openAbove
    ? Math.max(viewportPadding, blockRect.top - 8)
    : Math.min(blockRect.bottom + 8, window.innerHeight - height - viewportPadding);
  const inputLeft = Math.min(
    Math.max(panelRect.left + 54, blockRect.left),
    panelRect.right - 120,
  );
  const inputWidth = Math.max(96, panelRect.right - inputLeft - panelPadding);

  return {
    left,
    top,
    placement: openAbove ? "top" : "bottom",
    width,
    height,
    inputLeft,
    inputTop: blockRect.top,
    inputWidth,
  };
}

export function ChartSoapPlusCommandMenu({
  editor,
  items,
  request,
  onClose,
}: {
  editor: ChartSoapBlockEditorInstance;
  items: ChartSoapCommandItem[];
  request: ChartSoapPlusMenuRequest | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<PositionedMenu | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(
    () => filterSuggestionItems(items, query),
    [items, query],
  );

  const close = useCallback(
    (restoreTarget = true) => {
      if (request && restoreTarget) {
        const targetBlock = editor.getBlock(request.blockId);
        if (targetBlock) {
          editor.setTextCursorPosition(targetBlock);
          editor.focus();
        }
      }
      request?.releaseSideMenu();
      setQuery("");
      setSelectedIndex(0);
      onClose();
    },
    [editor, onClose, request],
  );

  const updatePosition = useCallback(() => {
    if (!request) return;
    setPosition(getPosition(editor, request.blockId));
  }, [editor, request]);

  useLayoutEffect(() => {
    if (!request) return;

    const frame = window.requestAnimationFrame(() => {
      updatePosition();
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [request, updatePosition]);

  useEffect(() => {
    if (!request) return;
    const update = () => updatePosition();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [request, updatePosition]);

  useEffect(() => {
    if (!request) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!overlayRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [close, request]);

  useEffect(
    () => () => {
      request?.releaseSideMenu();
    },
    [request],
  );

  if (!request || !position) return null;

  return createPortal(
    <div ref={overlayRef} className={styles.plusOverlay}>
      <input
        ref={inputRef}
        role="combobox"
        className={styles.plusFilterInput}
        style={{
          left: position.inputLeft,
          top: position.inputTop,
          minWidth: Math.min(180, position.inputWidth),
          maxWidth: position.inputWidth,
        }}
        value={query}
        placeholder="필터 기준을 입력하세요"
        aria-label="블록 명령 필터"
        aria-autocomplete="list"
        aria-controls="bn-suggestion-menu"
        aria-expanded="true"
        aria-activedescendant={
          filteredItems[selectedIndex]
            ? `bn-suggestion-menu-item-${selectedIndex}`
            : undefined
        }
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) =>
              filteredItems.length ? (current + 1) % filteredItems.length : 0,
            );
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) =>
              filteredItems.length
                ? (current - 1 + filteredItems.length) % filteredItems.length
                : 0,
            );
            return;
          }
          if (event.key === "Enter" && filteredItems[selectedIndex]) {
            event.preventDefault();
            filteredItems[selectedIndex].onItemClick();
            editor.focus();
            close(false);
          }
        }}
      />
      <div
        className={styles.plusMenuPosition}
        style={{
          left: position.left,
          top: position.top,
          transform:
            position.placement === "top" ? "translateY(-100%)" : undefined,
        }}
      >
        <ChartSoapCommandMenu
          items={filteredItems}
          selectedIndex={selectedIndex}
          availableHeight={position.height}
          width={position.width}
          onItemClick={(item) => {
            item.onItemClick();
            editor.focus();
            close(false);
          }}
          onClose={() => close()}
        />
      </div>
    </div>,
    document.body,
  );
}
