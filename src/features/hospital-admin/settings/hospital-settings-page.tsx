"use client";

import { useEffect, useState, type ReactNode } from "react";

import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type HospitalSettingsPageProps = {
  children: ReactNode;
  description: string;
  dirty?: boolean;
  isSaving?: boolean;
  onRevert?: () => void;
  onSave?: () => void | Promise<void>;
  testId: string;
  title: string;
};

export function HospitalSettingsPage({
  children,
  description,
  dirty = false,
  isSaving = false,
  onRevert,
  onSave,
  testId,
  title,
}: HospitalSettingsPageProps) {
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);

  useEffect(() => {
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]"
      data-testid={testId}
    >
      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-5 py-8 pb-32 md:px-8">
          <header>
            <h1 className="text-[24px] font-semibold leading-8">{title}</h1>
            <p className="mt-1 emr-text-dense text-muted-foreground">
              {description}
            </p>
          </header>
          {children}
        </main>
      </ScrollArea>

      {dirty && onRevert && onSave ? (
        <div
          className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-[808px] -translate-x-1/2 flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between"
          data-testid="hospital-settings-change-bar"
          role="status"
          aria-live="polite"
        >
          <div>
            <p className="text-sm font-medium">저장하지 않은 변경사항이 있습니다.</p>
            <p className="emr-text-dense text-muted-foreground">
              변경사항을 저장하거나 마지막으로 저장된 값으로 되돌릴 수 있습니다.
            </p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRevertDialogOpen(true)}
            >
              변경 전으로 되돌리기
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void onSave()}
            >
              {isSaving ? "저장 중..." : "변경사항 저장"}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <EmrConfirmDialogContent
          title="저장하지 않은 변경사항을 되돌리시겠습니까?"
          description="현재 편집한 내용은 사라지고 마지막으로 저장된 값으로 돌아갑니다."
          cancelLabel="계속 편집"
          confirmLabel="변경사항 되돌리기"
          onCancel={() => setRevertDialogOpen(false)}
          onConfirm={() => {
            onRevert?.();
            setRevertDialogOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}
