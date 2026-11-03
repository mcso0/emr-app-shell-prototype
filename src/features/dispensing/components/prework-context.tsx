"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmrWorkEntrySection as Section, EmrWorkEntrySummary } from "@/components/emr/work-entry-page";
import { PatientOrderPrework, type PatientOrderPreworkItem } from "@/features/fulfillment/components/patient-order-prework";
import { TaskInstructionReview } from "@/features/fulfillment/components/task-instruction-review";
import { createInstructionView, formatInstructionValue } from "../instruction-view-model";
import type { FulfillmentInstructionController } from "../use-fulfillment-instruction";
import { InstructionActions } from "./instruction-workspace";

function date(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
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
 return <PatientOrderPrework workItem={workItem} encounterNo={document.encounterNo} label={label} testId="fulfillment-prework" excludeWorkItemIds={document.items.map(item => item.id)}
   actions={<InstructionActions prework controller={controller} workspaceId={workspaceId} onChanged={onChanged} onEntered={onEntered} onCompletionOpenChange={onCompletionOpenChange} />}>
          {controller.error && (
            <div
              role="alert"
              className="flex items-center gap-3 text-sm text-destructive"
            >
              {controller.error}
              <Button size="sm" variant="outline" onClick={controller.refresh}>
                다시 조회
              </Button>
            </div>
          )}
          {controller.instructionReview && (
            <TaskInstructionReview controller={controller.instructionReview} />
          )}
          <Section title="요청 정보">
            <EmrWorkEntrySummary items={[
              ["요청 일시", date(workItem.createdAt)], ["요청 수의사", workItem.requesterName ?? "—"],
              ["요청 항목", `${label} ${items.length}개`], [`${label} 담당`, document.mainAssigneeName ?? "미지정"], [`${label} 시작`, "미시작"],
            ]} />
          </Section>
          <Separator />
          <Section title={`요청된 ${label} 오더 · ${items.length}`}>
            <div
              className="overflow-x-auto rounded-lg border border-border"
              tabIndex={0}
              role="region"
              aria-label={`요청된 ${label} 오더`}
            >
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    {(document.queueType === "dispensing"
                      ? [
                          "오더명",
                          "1회 용량",
                          "단위",
                          "복용 주기",
                          "총량",
                          "단위",
                          "투여 경로",
                          "보관 방법",
                          "담당자",
                        ]
                      : ["오더명", "처치 지시", "담당자"]
                    ).map((name, index) => (
                      <th
                        scope="col"
                        className="whitespace-nowrap px-3 py-3 font-medium"
                        key={`${name}-${index}`}
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                {items.map((item) => (
                  <tbody
                    key={item.id}
                    aria-label={item.name}
                    className="border-t border-border"
                  >
                    <tr>
                      <th
                        scope="row"
                        className="min-w-36 px-3 py-4 font-medium"
                      >
                        {item.name}
                      </th>
                      {(document.queueType === "dispensing"
                        ? [
                            item.dose,
                            item.doseUnit,
                            item.frequency,
                            item.total,
                            item.totalUnit,
                            formatInstructionValue("route", item.route),
                            formatInstructionValue("storage", item.storage),
                          ]
                        : [item.note || "—"]
                      ).map((value, index) => (
                        <td
                          className="px-3 py-4 whitespace-pre-wrap"
                          key={index}
                        >
                          {value}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-4">
                        {document.items.find((row) => row.id === item.id)
                          ?.assigneeName ?? "미지정"}
                      </td>
                    </tr>
                    {document.queueType === "dispensing" && item.note && (
                      <tr>
                        <td colSpan={9} className="bg-muted/20 px-3 pb-3">
                          <div className="flex gap-3 whitespace-pre-wrap text-sm">
                            <span className="shrink-0 text-muted-foreground">
                              조제 지시
                            </span>
                            <span>{item.note}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}
              </table>
            </div>
            {!items.length && (
              <p className="text-sm text-muted-foreground">
                요청된 오더가 없어요.
              </p>
            )}
          </Section>
          {document.isSet && document.instruction.trim() && (
            <Section title={`${label} 공통 지시`}>
              <p className="rounded-lg border border-border bg-muted/30 px-5 py-4 whitespace-pre-wrap text-sm">
                {document.instruction}
              </p>
            </Section>
          )}

 </PatientOrderPrework>;
}
