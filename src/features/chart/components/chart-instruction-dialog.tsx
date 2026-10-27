"use client";

import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import {
  InstructionActions,
  InstructionBody,
} from "@/features/dispensing/components/instruction-workspace";
import { useFulfillmentInstruction } from "@/features/dispensing/use-fulfillment-instruction";

export function ChartInstructionDialog({
  workspaceId,
  workItemId,
  onClose,
  onChanged,
}: {
  workspaceId: string;
  workItemId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const controller = useFulfillmentInstruction(workspaceId, workItemId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !controller.busy) onClose();
      }}
    >
      <EmrDialogShell
        variant="wide-form"
        className="sm:max-w-[min(1200px,95vw)]"
        title={controller.document?.name ?? "조제·처치 지시서"}
        description="작업 상태와 지시사항을 확인하고 오더를 완료할 수 있어요."
        footer={
          <InstructionActions controller={controller} onChanged={onChanged} />
        }
      >
        <InstructionBody
          controller={controller}
          workspaceId={workspaceId}
          onChanged={onChanged}
        />
      </EmrDialogShell>
    </Dialog>
  );
}
