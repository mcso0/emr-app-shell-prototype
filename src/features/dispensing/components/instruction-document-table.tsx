"use client";

import { formatInstructionValue } from "../instruction-view-model";

import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import { EmrTableCellText, EmrTableColumnResizeHandle } from "@/components/emr/table-primitives";
import { Button } from "@/components/ui/button";
import { usePagePortalVisibility } from "@/components/emr/page-loading-boundary";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type {
  InstructionViewOrder as Order,
  InstructionViewItem as Item,
  InstructionViewEvent as FlowEvent,
  InstructionViewAction as Action,
} from "../instruction-view-model";
import "./instruction-document.css";
import icons from "./instruction-icons.json";
const Icon = ({ name }: { name: string }) => (
  <span
    aria-hidden="true"
    className="fd-icon"
    dangerouslySetInnerHTML={{ __html: icons[name as keyof typeof icons] }}
  />
);
export function InstructionRowDisclosure({ name, expanded, onToggle, controls }: {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  controls?: string;
}) {
  return (
    <Button
      variant="ghost"
      className="fd-row-arrow"
      aria-label={name + (expanded ? " 지시 접기" : " 지시 펼치기")}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      <span className={expanded ? "fd-row-glyph" : "fd-row-glyph fd-rotate"}>
        <Icon name="row-arrow" />
      </span>
    </Button>
  );
}

export function InstructionItemRow({ focused, ...props }: React.ComponentProps<typeof TableRow> & { focused: boolean }) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const { hidden } = usePagePortalVisibility();
  useEffect(() => {
    if (!focused || hidden) return;
    const frame = requestAnimationFrame(() => {
      const row = rowRef.current;
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "center", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, hidden]);

  return <TableRow {...props} ref={rowRef} tabIndex={focused ? -1 : undefined} data-instruction-target={focused || undefined} />;
}

export function InstructionRowNote({ children, modified = false }: {
  children: React.ReactNode;
  modified?: boolean;
}) {
  return (
    <div className={modified ? "fd-info fd-info-modified" : "fd-info"}>
      <Icon name={modified ? "info-modified" : "info"} />
      <div className="fd-detail-content">{children}</div>
    </div>
  );
}

const groups = [
  ["added", "추가된 오더"],
  ["modified", "수정된 오더"],
  ["existing", "기존 오더"],
  ["completed", "완료 오더"],
  ["cancelled", "취소된 오더"],
];
const group = (i: Item) =>
  i.status === "returned"
    ? "cancelled"
    : ["completed", "cancelled"].includes(i.status)
      ? i.status
      : i.change;

function getItemColumnWidth(handle: HTMLButtonElement) {
  return handle.closest("tr")?.querySelector(".fd-col-1")?.getBoundingClientRect().width;
}

function InstructionItemResizeHandle({ onResize }: {
  onResize: (width: number | undefined) => void;
}) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeTo = (width: number) => onResize(Math.min(520, Math.max(120, Math.round(width))));

  return (
    <EmrTableColumnResizeHandle
      aria-label="항목 컬럼 너비 조절"
      className="left-1/2 right-auto -translate-x-1/2 before:left-1/2 before:top-1.5 before:h-3 before:-translate-x-1/2"
      isResizing={isResizing}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        const width = getItemColumnWidth(event.currentTarget);
        if (width === undefined) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, width };
        setIsResizing(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start?.pointerId !== event.pointerId) return;
        resizeTo(start.width + event.clientX - start.x);
      }}
      onLostPointerCapture={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        setIsResizing(false);
      }}
      onDoubleClick={() => onResize(undefined)}
      onKeyDown={(event) => {
        if (event.key === "Home") {
          event.preventDefault();
          onResize(undefined);
          return;
        }
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const width = getItemColumnWidth(event.currentTarget);
        if (width === undefined) return;
        event.preventDefault();
        const step = event.shiftKey ? 24 : 8;
        resizeTo(width + (event.key === "ArrowRight" ? step : -step));
      }}
    />
  );
}

type Props = {
  orders: Order[];
  events: FlowEvent[];
  names: Record<string, string>;
  eligibleAssignees: string[];
  busy?: boolean;
  focusedItemId?: string;
  openExecutionHistory?: () => void;
  editSetInstruction?: () => void;
  refresh?: () => void;
  act: (id: string, type: Action["type"], extra?: Partial<Action>) => void;
  history: (id: string, item?: string) => void;
  notify: (message: string) => void;
};
export function InstructionDocumentTable(p: Props) {
  const documentRef = useRef<HTMLDivElement>(null);
  function resizeItemColumn(width: number | undefined) {
    const style = documentRef.current?.style;
    if (width === undefined) {
      style?.removeProperty("--fd-item-column-resized-width");
    } else {
      style?.setProperty("--fd-item-column-resized-width", `${width}px`);
    }
  }

  return (
    <TooltipProvider delay={200}>
      <div className="figma-document" ref={documentRef}>
        {[
          ["PO", "경구제 오더 그룹"],
          ["other", "기타 오더 그룹"],
          ["treatment", "처치 오더 그룹"],
        ].map(([route, title]) => {
          const orders = p.orders
            .filter((o) =>
              route === "treatment" ? o.kind === "처치" : o.kind === "조제",
            )
            .map((o) => ({
              ...o,
              items: o.items.filter(
                (i) =>
                  route === "treatment" ||
                  (route === "PO" ? i.route === "PO" : i.route !== "PO"),
              ),
            }))
            .filter((o) => o.items.length);
          return orders.length ? (
            <React.Fragment key={route}>
              <div className="fd-group-label">{title}</div>
              {orders.map((o) => (
                <OrderCard key={o.id} {...p} order={o} onItemColumnResize={resizeItemColumn} />
              ))}
            </React.Fragment>
          ) : null;
        })}
      </div>
    </TooltipProvider>
  );
}
function OrderCard({
  order: o,
  act,
  history,
  notify,
  events,
  names,
  eligibleAssignees,
  busy,
  focusedItemId,
  openExecutionHistory,
  editSetInstruction,
  refresh,
  onItemColumnResize,
}: Props & { order: Order; onItemColumnResize: (width: number | undefined) => void }) {
  const readOnly = o.status === "completed";
  const [collapsed, setCollapsed] = useState(false),
    [density, setDensity] = useState(40),
    [sort, setSort] = useState(false),
    [pending, setPending] = useState(false),
    [hidden, setHidden] = useState<string[]>([]);
  const visibleItems = pending ? o.items.filter(item => !["completed", "cancelled"].includes(item.status)) : o.items;

  async function copy(link: boolean) {
    try {
      await navigator.clipboard.writeText(
        link
          ? `${location.origin}${location.pathname}#instruction-${encodeURIComponent(o.id)}`
          : [
              o.name,
              ...o.items.map(
                (i) =>
                  `${i.name}\t${i.dose} ${i.doseUnit}\t${i.frequency}\t${i.total} ${i.totalUnit}\t${i.note}`,
              ),
            ].join("\n"),
      );
      notify(link ? "오더 링크를 복사했어요." : "오더 내용을 복사했어요.");
    } catch {
      notify("복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  }
  const root = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState<string[]>([]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const unitLabels = element.querySelectorAll<HTMLElement>("[data-fd-unit]");
    const measure = () => {
      const unitWidths = { dose: 0, total: 0 };
      unitLabels.forEach((label) => {
        const column = label.dataset.fdUnit === "dose" ? "dose" : "total";
        const cell = getComputedStyle(label.parentElement!);
        const width = label.getBoundingClientRect().width
          + parseFloat(cell.paddingLeft) + parseFloat(cell.paddingRight);
        unitWidths[column] = Math.max(unitWidths[column], Math.ceil(width));
      });
      element.style.setProperty("--fd-dose-unit-width", `${unitWidths.dose}px`);
      element.style.setProperty("--fd-total-unit-width", `${unitWidths.total}px`);

      const fields = new Set<string>();
      element
        .querySelectorAll<HTMLElement>(".fd-change-measure")
        .forEach((n) => {
          const cell = n.closest("td");
          if (!cell) return;
          const c = getComputedStyle(cell);
          const badgePadding = n.dataset.field === "frequency"
            ? 2 * parseFloat(c.getPropertyValue("--fd-frequency-change-padding-inline"))
            : 0;
          const available =
            cell.clientWidth -
            parseFloat(c.paddingLeft) -
            parseFloat(c.paddingRight) -
            badgePadding;
          if (n.getBoundingClientRect().width > available)
            fields.add(n.dataset.field!);
        });
      const next = [...fields].sort();
      setCompact((old) => (old.join() === next.join() ? old : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    unitLabels.forEach((label) => observer.observe(label));
    element
      .querySelectorAll(".fd-change-measure,td[data-label]")
      .forEach((n) => observer.observe(n));
    measure();
    return () => observer.disconnect();
  }, [o.items, density, collapsed, pending]);
  const totalLabel = o.kind === "조제" ? "요청 조제량" : "총 용량";
  const fieldLabels: Record<string, string> = {
    dose: "1회 용량",
    doseUnit: "용량 단위",
    total: totalLabel,
    totalUnit: o.kind === "조제" ? "요청 조제량 단위" : "총량 단위",
    frequency: o.kind === "처치" ? "수행 주기" : "복용 주기",
    days: "일수",
    route: "투여 경로",
    medicationGuide: "복약지도",
    storage: "보관",
    note: "지시사항",
  };
  const changedFields = (i: Item) =>
    Object.keys(fieldLabels).filter(
      (k) =>
        i.previous?.[k as keyof Item] !== undefined &&
        String(i.previous[k as keyof Item]) !== String(i[k as keyof Item]),
    );
  const value = (i: Item, k: keyof Item) => {
    const current = formatInstructionValue(k, i[k]);
    if (!changedFields(i).includes(k)) return current;
    const before = formatInstructionValue(k, i.previous?.[k]);
    const recent = [...events]
      .reverse()
      .find(
        (e) =>
          e.orderId === o.id &&
          e.changes?.some((c) => c.itemId === i.id && c.field === k),
      );
    const inline = ["dose", "total", "frequency"].includes(k);
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className={`fd-change-value ${inline ? "fd-change-numeric" : ""}`}
              aria-label={`${fieldLabels[k]} ${current}, 변경 내용 보기`}
              onClick={() => setHidden((s) => s.filter((id) => id !== i.id))}
            />
          }
        >
          {inline && (
            <span
              className="fd-change-measure"
              aria-hidden="true"
              data-field={k}
            >
              {before} → {current}
            </span>
          )}
          {inline && !compact.includes(k) && (
            <span className="fd-before">{before} → </span>
          )}
          <span className="fd-after">{current}</span>
        </TooltipTrigger>
        <TooltipContent className="fd-change-tooltip">
          <div>
            <div>
              {fieldLabels[k]}: {before} → {current}
            </div>
            {recent ? (
              <small>
                {names[recent.actor] || recent.actor} ·{" "}
                {new Date(recent.at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </small>
            ) : (
              <small>변경 시각 기록 없음</small>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };
  return (
    <section
      ref={root}
      id={`instruction-${o.id}`}
      className={`fd-card ${o.set ? "fd-card-set" : "fd-card-single"}`}
      data-dispensing={o.kind === "조제" || undefined}
      style={{ "--fd-row-height": `${density}px` } as React.CSSProperties}
    >
      <header className="fd-toolbar">
        <Button
          variant="ghost"
          className="fd-collapse"
          aria-label={`${o.name} ${collapsed ? "펼치기" : "접기"}`}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className={`fd-collapse-glyph ${collapsed ? "fd-rotate" : ""}`}>
            <Icon name="section-arrow" />
          </span>
        </Button>
        <div className="fd-title">
          <strong>{o.set ? o.name : o.items[0].name}</strong>
          <span className="fd-count">{o.items.length}</span>
        </div>
        <span className="fd-progress">
          {o.items.filter((i) => i.status === "completed").length}/
          {o.items.length} 작업완료
        </span>
        <div className="grow" />
        <Button
          variant="outline"
          className="fd-tool"
          aria-pressed={pending}
          onClick={() => setPending((v) => !v)}
        >
          <Icon name="filter" />
          <span className="fd-button-label">{pending ? "미완료" : "필터"}</span>
        </Button>
        <Button
          variant="outline"
          className="fd-tool"
          aria-pressed={sort}
          onClick={() => setSort((v) => !v)}
        >
          <Icon name="sort" />
          <span className="fd-button-label">{sort ? "이름순" : "정렬"}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className="fd-tool fd-density" />}
          >
            <span className="fd-button-label">
              {density === 40
                ? "기본 간격"
                : density === 36
                  ? "좁은 간격"
                  : "넓은 간격"}
            </span>
            <Icon name="density" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {[
              [36, "좁은 간격"],
              [40, "기본 간격"],
              [52, "넓은 간격"],
            ].map(([n, l]) => (
              <DropdownMenuCheckboxItem
                key={n}
                checked={density === n}
                onCheckedChange={() => setDensity(Number(n))}
              >
                {l}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="fd-toolbar-divider">
          <Icon name="toolbar-divider" />
        </span>
        <Button
          variant="outline"
          className="fd-tool fd-history"
          onClick={() => history(o.id)}
        >
          <Icon name="history" />
          <span className="fd-button-label">수정이력</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="fd-more"
                aria-label={`${o.name} 더 보기`}
              />
            }
          >
            <Icon name="more" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {openExecutionHistory && <DropdownMenuItem disabled={busy || !o.items.some((item) => item.hasResult)} onClick={openExecutionHistory}>수행기록</DropdownMenuItem>}
            {editSetInstruction && <DropdownMenuItem disabled={busy} onClick={editSetInstruction}>{o.set ? "세트 공통 지시 수정" : "오더 지시 수정"}</DropdownMenuItem>}
            {refresh && <DropdownMenuItem onClick={refresh}>지시서 새로고침</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => copy(false)}>
              내용 복사
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copy(true)}>
              링크 복사
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {!collapsed && (
        <div className="fd-sections">
          {pending && !visibleItems.length && <p className="p-3 text-sm text-muted-foreground" role="status">미완료 오더가 없어요.</p>}
          {groups.map(([key, title]) => {
            let rows = visibleItems.filter(item => group(item) === key);
            if (sort)
              rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
            if (!rows.length) return null;
            return (
              <section key={key} className={`fd-section fd-${key}`}>
                <div className="fd-section-heading">
                  <span className="fd-status">
                    <i />
                  </span>
                  <span>{title}</span>
                  <span className="fd-count">{rows.length}</span>
                </div>
                <div className="fd-table-surface">
                  <Table
                    className="fd-table"
                    containerClassName="fd-table-container"
                  >
                    <colgroup>
                      {[
                        28, 280, 21, 0, 0, 88, 0, 0, 21, 72, 72, 21, 88, 88,
                        28,
                      ].map((w, n) => (
                        <col key={n} style={w ? { width: w } : undefined} />
                      ))}
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        {[
                          "",
                          "항목",
                          "",
                          "1회 용량",
                          "단위",
                          o.kind === "처치" ? "수행 주기" : "복용 주기",
                          totalLabel,
                          "단위",
                          "",
                          "복약지도",
                          "보관",
                          "",
                          "담당자",
                          "작업 여부",
                          "",
                        ].map((text, n) => (
                          <TableHead key={n} className={`fd-col-${n}${n === 2 && o.kind === "조제" ? " relative" : ""}`}>
                            {n === 2 && o.kind === "조제" ? (
                              <InstructionItemResizeHandle onResize={onItemColumnResize} />
                            ) : [2, 8, 11].includes(n) ? (
                              <Icon name="cell-divider" />
                            ) : n === 4 || n === 7 ? (
                              <span data-fd-unit={n === 4 ? "dose" : "total"}>{text}</span>
                            ) : (
                              text
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((i) => {
                        const locked =
                          ["cancelled", "returned"].includes(i.status) ||
                          o.status === "cancelled";
                        const changes = changedFields(i);
                        const hasDetails =
                          Boolean(i.note || i.setInstruction) || changes.length > 0;
                        const expanded = hasDetails && !hidden.includes(i.id);
                        return (
                          <React.Fragment key={i.id}>
                            <InstructionItemRow data-item={i.id} focused={i.id === focusedItemId}>
                              <TableCell>
                                {hasDetails && (
                                  <InstructionRowDisclosure
                                    name={i.name}
                                    expanded={expanded}
                                    onToggle={() => setHidden((items) =>
                                      expanded ? [...items, i.id] : items.filter((id) => id !== i.id),
                                    )}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="fd-name">
                                <EmrTableCellText tooltipOnOverflow>
                                  {i.name}
                                </EmrTableCellText>
                              </TableCell>
                              <TableCell>
                                <Icon name="cell-divider" />
                              </TableCell>
                              <TableCell
                                data-label="1회 용량"
                                className="fd-number"
                              >
                                {value(i, "dose")}
                              </TableCell>
                              <TableCell data-label="단위">
                                <span data-fd-unit="dose">{value(i, "doseUnit")}</span>
                              </TableCell>
                              <TableCell
                                data-label={
                                  o.kind === "처치" ? "수행 주기" : "복용 주기"
                                }
                                className="fd-center fd-frequency-cell"
                              >
                                <span
                                  className={`fd-frequency ${changedFields(i).includes("frequency") && !compact.includes("frequency") ? "fd-frequency-changed" : ""}`}
                                >
                                  {value(i, "frequency")}
                                </span>
                              </TableCell>
                              <TableCell
                                data-label={totalLabel}
                                className="fd-number"
                              >
                                {value(i, "total")}
                              </TableCell>
                              <TableCell data-label="단위">
                                <span data-fd-unit="total">{value(i, "totalUnit")}</span>
                              </TableCell>
                              <TableCell>
                                <Icon name="cell-divider" />
                              </TableCell>
                              <TableCell
                                data-label="복약지도"
                                className="fd-center"
                              >
                                {value(i, "medicationGuide")}
                              </TableCell>
                              <TableCell
                                data-label="보관"
                                className="fd-center"
                              >
                                {value(i, "storage")}
                              </TableCell>
                              <TableCell>
                                <Icon name="cell-divider" />
                              </TableCell>
                              <TableCell
                                data-label="담당자"
                                className="fd-center"
                              >
                                {locked ? (
                                  <div
                                    className="fd-assignee fd-assignee-readonly"
                                    aria-label={`${i.id} 담당자 (취소된 오더)`}
                                  >
                                    {i.assignees.length
                                      ? i.assignees.slice(0, 1).map((id) => (
                                          <Avatar size="sm" key={id}>
                                            <AvatarFallback>
                                              {(names[id] || "미지정")[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                        ))
                                      : "—"}
                                  </div>
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          className="fd-assignee"
                                          aria-label={`${i.name} 담당 선택`}
                                          disabled={busy || readOnly || !i.canAssign}
                                        />
                                      }
                                    >
                                      {i.assignees.length
                                        ? i.assignees.slice(0, 1).map((id) => (
                                            <Avatar size="sm" key={id}>
                                              <AvatarFallback>
                                                {(names[id] || "미지정")[0]}
                                              </AvatarFallback>
                                            </Avatar>
                                          ))
                                        : "—"}
                                      <Icon name="assignee-arrow" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {eligibleAssignees.map((id) => (
                                        <DropdownMenuCheckboxItem
                                          key={id}
                                          checked={i.assignees.includes(id)}
                                          disabled={
                                            busy ||
                                            readOnly ||
                                            !i.canAssign ||
                                            i.assignees.includes(id)
                                          }
                                          closeOnClick={true}
                                          onCheckedChange={() =>
                                            act(o.id, "assign", {
                                              itemId: i.id,
                                              assignees: [id],
                                            })
                                          }
                                        >
                                          {names[id]}
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                      <DropdownMenuItem
                                        disabled={busy || !events.some((event) => event.changes.some((change) => change.itemId === i.id))}
                                        onClick={() => history(o.id, i.id)}
                                      >
                                        이 오더 이력
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                              <TableCell className="fd-center">
                                <Button
                                  variant="outline"
                                  className={`fd-complete ${i.status === "completed" ? "is-complete" : ""}`}
                                  aria-label={`${i.name} 완료`}
                                  aria-pressed={i.status === "completed"}
                                  disabled={busy || readOnly || i.status === "completed" || !i.canComplete}
                                  onClick={() =>
                                    act(o.id, "complete", {
                                      itemId: i.id,
                                    })
                                  }
                                >
                                  <Icon
                                    name={
                                      i.status === "completed"
                                        ? "check-completed"
                                        : i.status === "cancelled"
                                          ? "check-cancelled"
                                          : "check"
                                    }
                                  />
                                  <span className="fd-button-label">완료</span>
                                </Button>
                              </TableCell>
                              <TableCell />
                            </InstructionItemRow>
                            {expanded && (
                              <TableRow className="fd-info-row">
                                <TableCell colSpan={15}>
                                  <InstructionRowNote modified={changes.length > 0}>
                                    {i.setInstruction && <p className="fd-current-instruction mb-1">{i.setInstruction}</p>}
                                    {changes.length > 0 && (
                                      <ul className="fd-change-details">
                                        {changes.map((k) => (
                                          <li key={k}>
                                            <span>{fieldLabels[k]}: </span>
                                            <span className="fd-before">
                                              {formatInstructionValue(
                                                k,
                                                i.previous?.[k as keyof Item],
                                              )}{" "}
                                              →{" "}
                                            </span>
                                            {k === "note" ? (
                                              value(i, "note")
                                            ) : (
                                              <span className="fd-after">
                                                {formatInstructionValue(
                                                  k,
                                                  i[k as keyof Item],
                                                )}
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    {i.note && !changes.includes("note") && (
                                      <div className="fd-current-instruction">
                                        {value(i, "note")}
                                      </div>
                                    )}
                                  </InstructionRowNote>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
