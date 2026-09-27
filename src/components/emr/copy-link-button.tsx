"use client";

import { toast } from "sonner";
import { CdsContentLink2Icon } from "@/components/cds-icons/content-and-editor";
import { Button } from "@/components/ui/button";
import { buildWorkspaceSurfaceRoute } from "@/shell/workspace-surface-route";

type EmrCopyLinkButtonProps = {
  ariaLabel: string;
  date?: string;
  moduleId: string;
  params: Record<string, string | undefined>;
  workspaceId: string;
};

export function EmrCopyLinkButton({
  ariaLabel,
  date,
  moduleId,
  params,
  workspaceId,
}: EmrCopyLinkButtonProps) {
  const copyLink = async () => {
    const route = buildWorkspaceSurfaceRoute({
      moduleId,
      params: { ...params, date },
      removeParams: [
        "scenario",
        "patientId",
        "encounterId",
        "queueItemId",
        "workItemId",
        "labResultId",
        "imagingStudyId",
        "invoiceId",
        "orderId",
        "taskId",
        "historyEncounterId",
        "drawer",
        "context",
      ],
      search: window.location.search,
      workspaceId,
    });

    try {
      await navigator.clipboard.writeText(new URL(route, window.location.origin).href);
      toast.success("링크를 복사했어요.");
    } catch {
      toast.error("링크를 복사하지 못했어요.");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
      aria-label={ariaLabel}
      onClick={() => void copyLink()}
    >
      <CdsContentLink2Icon className="size-3.5" aria-hidden="true" />
      링크 복사
    </Button>
  );
}
