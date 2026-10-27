"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
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
const routeLabels: Record<string, string> = {
  PO: "경구",
  topical: "외용",
  ophthalmic: "점안",
  otic: "점이",
};
const storageLabels: Record<string, string> = {
  room_temp: "실온",
  room_temp_light_protected: "실온·차광",
  refrigerated: "냉장",
  refrigerated_light_protected: "냉장·차광",
};
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
type Props = {
  orders: Order[];
  events: FlowEvent[];
  names: Record<string, string>;
  eligibleAssignees: string[];
  busy?: boolean;
  openExecution?: (itemId: string) => void;
  editSetInstruction?: () => void;
  refresh?: () => void;
  act: (id: string, type: Action["type"], extra?: Partial<Action>) => void;
  history: (id: string, item?: string) => void;
  notify: (message: string) => void;
};
export function InstructionDocumentTable(p: Props) {
  return (
    <TooltipProvider delay={200}>
      <div className="figma-document">
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
                <OrderCard key={o.id} {...p} order={o} />
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
  openExecution,
  editSetInstruction,
  refresh,
}: Props & { order: Order }) {
  const [collapsed, setCollapsed] = useState(false),
    [density, setDensity] = useState(40),
    [sort, setSort] = useState(false),
    [pending, setPending] = useState(false),
    [hidden, setHidden] = useState<string[]>([]);

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
    const measure = () => {
      const fields = new Set<string>();
      element
        .querySelectorAll<HTMLElement>(".fd-change-measure")
        .forEach((n) => {
          const cell = n.closest("td");
          if (!cell) return;
          const c = getComputedStyle(cell);
          const available =
            cell.clientWidth -
            parseFloat(c.paddingLeft) -
            parseFloat(c.paddingRight) -
            (n.dataset.field === "frequency" ? 16 : 0);
          if (n.getBoundingClientRect().width > available)
            fields.add(n.dataset.field!);
        });
      const next = [...fields].sort();
      setCompact((old) => (old.join() === next.join() ? old : next));
    };
    const observer = new ResizeObserver(measure);
    element
      .querySelectorAll(".fd-change-measure,td[data-label]")
      .forEach((n) => observer.observe(n));
    measure();
    return () => observer.disconnect();
  }, [o.items, density, collapsed]);
  const fieldLabels: Record<string, string> = {
    dose: "1회 용량",
    doseUnit: "용량 단위",
    total: "총 용량",
    totalUnit: "총량 단위",
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
  const formatted = (k: string, v: unknown) =>
    k === "medicationGuide"
      ? {
          before_meal: "식전",
          after_meal: "식후",
          with_meal: "식사와 함께",
          any_time: "시간 무관",
        }[String(v)] || String(v)
      : k === "route"
        ? routeLabels[String(v)] || String(v)
        : k === "storage"
          ? storageLabels[String(v)] || String(v)
          : String(v ?? "없음");
  const value = (i: Item, k: keyof Item) => {
    const current = formatted(k, i[k]);
    if (!changedFields(i).includes(k)) return current;
    const before = formatted(k, i.previous?.[k]);
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
          {groups.map(([key, title]) => {
            let rows = o.items.filter(
              (i) =>
                group(i) === key &&
                (!pending || !["completed", "cancelled"].includes(i.status)),
            );
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
                        28, 280, 21, 0, 88, 88, 0, 88, 21, 72, 72, 21, 88, 88,
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
                          "총 용량",
                          "단위",
                          "",
                          "복약지도",
                          "보관",
                          "",
                          "담당자",
                          "작업 여부",
                          "",
                        ].map((text, n) => (
                          <TableHead key={n} className={`fd-col-${n}`}>
                            {[2, 8, 11].includes(n) ? (
                              <Icon name="cell-divider" />
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
                            <TableRow data-item={i.id}>
                              <TableCell>
                                {hasDetails && (
                                  <Button
                                    variant="ghost"
                                    className="fd-row-arrow"
                                    aria-label={`${i.name} 지시 ${expanded ? "접기" : "펼치기"}`}
                                    aria-expanded={expanded}
                                    onClick={() =>
                                      setHidden((s) =>
                                        expanded
                                          ? [...s, i.id]
                                          : s.filter((id) => id !== i.id),
                                      )
                                    }
                                  >
                                    <span
                                      className={`fd-row-glyph ${expanded ? "" : "fd-rotate"}`}
                                    >
                                      <Icon name="row-arrow" />
                                    </span>
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="fd-name">
                                {i.name}
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
                                {value(i, "doseUnit")}
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
                                data-label="총 용량"
                                className="fd-number"
                              >
                                {value(i, "total")}
                              </TableCell>
                              <TableCell data-label="단위">
                                {value(i, "totalUnit")}
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
                                          disabled={busy || !i.canAssign}
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
                                        onClick={() => history(o.id, i.id)}
                                      >
                                        이 오더 이력
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                              <TableCell className="fd-center">
                                {i.hasExecution && openExecution && <Button className="fd-execution" size="sm" variant="ghost" disabled={busy} aria-label={`${i.name} 수행기록·이력`} onClick={() => openExecution(i.id)}>수행기록·이력</Button>}
                                <Button
                                  variant="outline"
                                  className={`fd-complete ${i.status === "completed" ? "is-complete" : ""}`}
                                  aria-label={`${i.name} ${i.status === "completed" ? "완료 해제" : "완료"}`}
                                  aria-pressed={i.status === "completed"}
                                  disabled={
                                    busy ||
                                    (i.status === "completed"
                                      ? !i.canReopen
                                      : !i.canComplete)
                                  }
                                  onClick={() =>
                                    act(o.id, "toggle_complete", {
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
                            </TableRow>
                            {expanded && (
                              <TableRow className="fd-info-row">
                                <TableCell colSpan={15}>
                                  <div
                                    className={`fd-info ${changes.length ? "fd-info-modified" : ""}`}
                                  >
                                    <Icon
                                      name={
                                        changes.length
                                          ? "info-modified"
                                          : "info"
                                      }
                                    />
                                    <div className="fd-detail-content">
                                      {i.setInstruction && <p className="fd-current-instruction mb-1">{i.setInstruction}</p>}
                                      {changes.length > 0 && (
                                        <ul className="fd-change-details">
                                          {changes.map((k) => (
                                            <li key={k}>
                                              <span>{fieldLabels[k]}: </span>
                                              <span className="fd-before">
                                                {formatted(
                                                  k,
                                                  i.previous?.[k as keyof Item],
                                                )}{" "}
                                                →{" "}
                                              </span>
                                              {k === "note" ? (
                                                value(i, "note")
                                              ) : (
                                                <span className="fd-after">
                                                  {formatted(
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
                                    </div>
                                  </div>
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
