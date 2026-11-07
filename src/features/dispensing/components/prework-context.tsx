"use client";

import { Fragment, useEffect, useId, useState } from "react";
import { CdsFilesClockIcon } from "@/components/cds-icons/files-and-layout";
import { CdsMedicalClipboardCheckIcon, CdsMedicalNotebookTextIcon } from "@/components/cds-icons/medical-and-domain";
import { EmrWorkEntrySection as Section, EmrWorkEntrySummary } from "@/components/emr/work-entry-page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { instructionScopeLabels } from "@/features/chart/overall-instructions-contract";
import { PatientOrderPrework, type PatientOrderPreworkItem } from "@/features/fulfillment/components/patient-order-prework";
import { TaskInstructionReview } from "@/features/fulfillment/components/task-instruction-review";
import type { InstructionDocument } from "@/features/fulfillment/instruction-contract";
import type { EffectiveInstructions } from "@/features/fulfillment/task-instruction-review-contract";
import { createInstructionView, formatInstructionValue } from "../instruction-view-model";
import type { FulfillmentInstructionController } from "../use-fulfillment-instruction";
import { InstructionRowDisclosure, InstructionRowNote } from "./instruction-document-table";
import { InstructionActions } from "./instruction-workspace";

const requestTimeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const summaryIconClass = "size-3.5 shrink-0 text-[var(--emr-text-tertiary)]";

function RequestTime({ value }: { value?: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const requestedAt = Date.parse(value ?? "");
  if (!Number.isFinite(requestedAt)) return "—";
  const minutes = Math.floor((now - requestedAt) / 60_000);
  const elapsed = minutes >= 1440 ? Math.floor(minutes / 1440) + "일 경과"
    : minutes >= 60 ? Math.floor(minutes / 60) + "시간 경과"
    : minutes > 0 ? minutes + "분 경과"
    : minutes === 0 ? "방금" : null;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <CdsFilesClockIcon className={summaryIconClass} aria-hidden="true" />
      <span>
        <time dateTime={value} className="tabular-nums">{requestTimeFormat.format(requestedAt)}</time>
        {elapsed && <span className="ml-1 text-xs text-muted-foreground">{elapsed}</span>}
      </span>
    </span>
  );
}

function StaffValue({ name }: { name: string | null | undefined }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar className="size-5" roundness="roundrect" aria-hidden="true">
        <AvatarFallback className="text-[10px]">{name ? name.slice(0, 1) : "—"}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 break-words">{name ?? "미지정"}</span>
    </span>
  );
}

function PreworkOrderTable({ document, items, label }: {
  document: InstructionDocument;
  items: ReturnType<typeof createInstructionView>["orders"][number]["items"];
  label: string;
}) {
  const tableId = useId();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const dispensing = document.queueType === "dispensing";
  const showItemAssignee = document.isSet && document.items.some(item => item.assigneeId !== document.mainAssigneeId);
  const assigneeById = new Map(document.items.map(item => [item.id, item.assigneeName]));
  const headings = dispensing
    ? ["항목", "1회 용량", "단위", "복용 주기", "총량", "단위", "투여 경로"]
    : ["항목", "처치 계획"];
  if (showItemAssignee) headings.push("항목 담당");

  return (
    <div className="overflow-x-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label={"요청된 " + label + " 오더"}>
      <Table
        className={dispensing ? "fd-table fd-prework-table" : "fd-table fd-prework-table fd-prework-treatment"}
        containerClassName="overflow-visible"
        minWidth={dispensing ? 590 : undefined}
      >
        <colgroup>
          <col className="w-7" />
          <col className={dispensing ? "w-[28%]" : "w-[41%]"} />
          {headings.slice(1).map((heading, index) => <col key={heading + index} />)}
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead aria-label="지시 펼침" />
            {headings.map((heading, index) => <TableHead key={heading + index} scope="col">{heading}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => {
            const note = item.note.replace(/^오더별 지시: /, "");
            const expanded = Boolean(note) && !hidden.has(item.id);
            const noteId = tableId + "-" + item.id;
            const values = dispensing
              ? [item.dose, item.doseUnit, item.frequency, item.total, item.totalUnit, formatInstructionValue("route", item.route)]
              : [item.planSummary || "—"];
            return (
              <Fragment key={item.id}>
                <TableRow>
                  <TableCell>
                    {note && (
                      <InstructionRowDisclosure
                        name={item.name}
                        expanded={expanded}
                        controls={noteId}
                        onToggle={() => setHidden(current => {
                          const next = new Set(current);
                          if (!next.delete(item.id)) next.add(item.id);
                          return next;
                        })}
                      />
                    )}
                  </TableCell>
                  <th scope="row" className="fd-prework-item-name">{item.name}</th>
                  {values.map((value, index) => <TableCell key={index}>{value}</TableCell>)}
                  {showItemAssignee && <TableCell>{assigneeById.get(item.id) ?? "미지정"}</TableCell>}
                </TableRow>
                {note && (
                  <TableRow id={noteId} hidden={!expanded} className="fd-info-row">
                    <TableCell colSpan={headings.length + 1}>
                      <InstructionRowNote>
                        <p className="fd-current-instruction">{note}</p>
                      </InstructionRowNote>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function RequestInstructions({ document, label, instructions }: {
  document: InstructionDocument;
  label: string;
  instructions: EffectiveInstructions[];
}) {
  const entries = new Map<string, { label: string; text: string }>();
  for (const group of instructions) {
    for (const entry of group.entries) {
      const key = JSON.stringify([group.chartId, entry.scope, entry.orderId, entry.kind, entry.legacy, entry.revision]);
      entries.set(key, {
        label: entry.kind === "clinical_edit" ? "업무 변경" : entry.legacy ? "경구 지시"
          : entry.scope === "overall" ? "전체 지시" : instructionScopeLabels[entry.scope],
        text: entry.deleted ? "지시 삭제됨" : entry.instruction,
      });
    }
  }
  if (document.isSet && document.instruction.trim()) {
    entries.set("set", { label: "세트 지시", text: document.instruction });
  }
  if (!entries.size) return null;
  return (
    <>
      <Separator />
      <Section title={label + " 요청 사항"} icon={<CdsMedicalClipboardCheckIcon aria-hidden="true" />}>
        <div className="grid min-h-[52px] gap-2 rounded-lg border border-[var(--emr-border-subtle)] bg-[var(--clair-color-atomic-neutral-50)] px-4 py-3 sm:px-6 sm:py-4">
          {[...entries].map(([key, entry]) => (
            <div key={key} className="flex min-w-0 items-start gap-2">
              <span className="shrink-0 whitespace-nowrap rounded bg-[var(--emr-surface-muted)] px-1.5 text-xs font-medium leading-5 text-[var(--emr-text-secondary)]">{entry.label}</span>
              <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-5">{entry.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

export function DispensingPreworkContext({ controller, workItem, onChanged, onEntered, onCompletionOpenChange }: {
  controller: FulfillmentInstructionController;
  workItem: PatientOrderPreworkItem;
  onChanged: () => void;
  onEntered: () => void;
  onCompletionOpenChange?: (open: boolean) => void;
}) {
  const document = controller.document;
  if (!document) return null;
  const workspaceId = workItem.workspaceId;
  const label = document.queueType === "dispensing" ? "조제" : "처치";
  const items = createInstructionView(document).orders[0].items;
  const representativeName = items[0]?.name ?? document.name;
  const renderInstructions = (instructions: EffectiveInstructions[]) => (
    <RequestInstructions document={document} label={label} instructions={instructions} />
  );
  return (
    <PatientOrderPrework
      workItem={workItem}
      encounterNo={document.encounterNo}
      label={label}
      testId="fulfillment-prework"
      excludeWorkItemIds={document.items.map(item => item.id)}
      actions={<InstructionActions prework controller={controller} workspaceId={workspaceId} onChanged={onChanged} onEntered={onEntered} onCompletionOpenChange={onCompletionOpenChange} />}
    >
      {controller.error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          {controller.error}
          <Button size="sm" variant="outline" onClick={controller.refresh}>다시 조회</Button>
        </div>
      )}
      <Section title="오더 정보" icon={<CdsMedicalNotebookTextIcon aria-hidden="true" />}>
        <EmrWorkEntrySummary
          className="grid-cols-2 sm:grid-cols-4 [&>div:nth-child(2)>span]:hidden sm:[&>div:nth-child(2)>span]:block max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:nth-child(n+3)]:border-border"
          items={[
            ["오더명", <span key="order-name" className="flex min-w-0 items-center gap-1.5">
              <CdsMedicalClipboardCheckIcon className={summaryIconClass} aria-hidden="true" />
              <span className="min-w-0 break-words">{representativeName}{items.length > 1 ? " 외 " + (items.length - 1) + "건" : ""}</span>
            </span>],
            ["요청 시각", <RequestTime key="requested-at" value={workItem.createdAt} />],
            ["요청자", <StaffValue key="requester" name={workItem.requesterName} />],
            ["담당자", <StaffValue key="assignee" name={document.mainAssigneeName} />],
          ]}
        />
        {items.length ? (
          <PreworkOrderTable key={document.rootTaskId} document={document} items={items} label={label} />
        ) : <p className="text-sm text-muted-foreground">요청된 오더가 없어요.</p>}
      </Section>
      {controller.instructionReview
        ? <TaskInstructionReview controller={controller.instructionReview} renderInstructions={renderInstructions} />
        : renderInstructions([])}
    </PatientOrderPrework>
  );
}
