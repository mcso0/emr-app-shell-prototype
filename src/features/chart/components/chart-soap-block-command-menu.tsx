"use client";

import type { CSSProperties, MouseEventHandler } from "react";
import type { SuggestionMenuProps } from "@blocknote/react";
import { useBlockNoteEditor } from "@blocknote/react";

import {
  soapDisabledCommandItems,
  type ChartSoapCommandItem,
} from "./chart-soap-block-commands";
import type { ChartSoapBlockEditorInstance } from "./chart-soap-block-schema";
import styles from "./chart-soap-block-command-menu.module.css";

type ChartSoapCommandMenuProps = {
  items: ChartSoapCommandItem[];
  selectedIndex?: number;
  loading?: boolean;
  onItemClick: (item: ChartSoapCommandItem) => void;
  onClose?: () => void;
  availableHeight?: number;
  width?: number;
};

export function ChartSoapCommandMenu({
  items,
  selectedIndex,
  loading = false,
  onItemClick,
  onClose,
  availableHeight,
  width,
}: ChartSoapCommandMenuProps) {
  const menuStyle = {
    ...(availableHeight
      ? { "--soap-command-menu-available-height": `${availableHeight}px` }
      : {}),
    ...(width ? { "--soap-command-menu-width": `${width}px` } : {}),
  } as CSSProperties;
  const preserveEditorFocus: MouseEventHandler = (event) => {
    event.preventDefault();
  };

  return (
    <div
      id="bn-suggestion-menu"
      className={styles.menu}
      style={menuStyle}
      role="listbox"
      aria-label="SOAP 블록 명령"
      onMouseDown={preserveEditorFocus}
    >
      <div className={styles.scrollArea}>
        <div className={styles.list}>
          {items.map((item, index) => {
            const previousGroup = items[index - 1]?.group;
            const showGroup = item.group !== previousGroup;
            const showDivider = showGroup && previousGroup !== undefined;

            return (
              <div key={item.id} className={styles.itemGroup}>
                {showDivider ? <div className={styles.sectionDivider} /> : null}
                {showGroup ? (
                  <div className={styles.groupLabel}>{item.group}</div>
                ) : null}
                <button
                  id={`bn-suggestion-menu-item-${index}`}
                  className={styles.item}
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === index}
                  data-selected={selectedIndex === index ? "true" : "false"}
                  onClick={() => onItemClick(item)}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.shortcut ? (
                    <kbd className={styles.shortcut}>{item.shortcut}</kbd>
                  ) : null}
                </button>
              </div>
            );
          })}

          {loading ? <div className={styles.empty}>명령을 불러오는 중입니다.</div> : null}
          {!loading && items.length === 0 ? (
            <div className={styles.empty}>일치하는 명령이 없습니다.</div>
          ) : null}

          {items.at(-1)?.group === "미디어" ? null : (
            <>
              <div className={styles.sectionDivider} />
              <div className={styles.groupLabel}>미디어</div>
            </>
          )}
          {soapDisabledCommandItems.map((item) => (
            <div
              key={item.id}
              className={styles.disabledItem}
              aria-disabled="true"
              title={item.reason}
            >
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.badge}>{item.badge}</span>
              <span className={styles.srOnly}>{item.reason}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footerDivider} />
      <button
        type="button"
        className={styles.footer}
        onClick={onClose}
        aria-label="명령 메뉴 닫기"
      >
        <span>메뉴 닫기</span>
        <kbd>esc</kbd>
      </button>
    </div>
  );
}

export function ChartSoapSlashCommandMenu(
  props: SuggestionMenuProps<ChartSoapCommandItem>,
) {
  const editor = useBlockNoteEditor() as ChartSoapBlockEditorInstance;
  const boundary = editor.domElement?.closest<HTMLElement>(
    "[data-soap-editor-boundary]",
  );
  const boundaryWidth = boundary?.getBoundingClientRect().width;

  return (
    <ChartSoapCommandMenu
      items={props.items}
      selectedIndex={props.selectedIndex}
      loading={
        props.loadingState === "loading" ||
        props.loadingState === "loading-initial"
      }
      onItemClick={(item) => props.onItemClick?.(item)}
      width={boundaryWidth ? Math.min(346, boundaryWidth - 16) : undefined}
    />
  );
}
