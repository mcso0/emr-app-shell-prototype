"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { useAuthClient } from "@/features/auth/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupDivider,
  ButtonGroupIconButton,
  ButtonGroupPrimaryButton,
} from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FulfillmentEligibleAssignee } from "@/features/fulfillment/server-fulfillment-assignee-core";
import type {
  FulfillmentWorkItemAction,
  FulfillmentWorkItemStatus,
} from "@/features/fulfillment/server-fulfillment-work-item-core";

type LifecycleDialogMode = "assign" | "handoff" | "return";
export type FulfillmentTransitionOptions = {
  assignedToUserId?: string | null;
  detailedPhase?: string | null;
  reason?: string | null;
};

export function FulfillmentWorkLifecycleAction({
  completeRequiresRecord = false,
  assignmentOnly = false,
  activityLabel,
  assignedToUserId,
  assignedToDisplayName,
  canManage,
  busy = false,
  completeLabel,
  loadEligibleAssignees,
  onTransition,
  size = "sm",
  startPhase,
  status,
}: {
  completeRequiresRecord?: boolean;
  assignmentOnly?: boolean;
  activityLabel: string;
  assignedToUserId?: string | null;
  assignedToDisplayName?: string | null;
  canManage?: boolean;
  busy?: boolean;
  completeLabel: string;
  loadEligibleAssignees: () => Promise<FulfillmentEligibleAssignee[]>;
  onTransition: (
    action: FulfillmentWorkItemAction,
    options?: FulfillmentTransitionOptions,
  ) => Promise<boolean | "review_required">;
  size?: "xs" | "sm";
  startPhase?: string;
  status: FulfillmentWorkItemStatus;
}) {
  const { session } = useAuthClient();
  const actorId = session && "userId" in session ? session.userId : "user-tech";
  const ownsWork = canManage ?? (Boolean(assignedToUserId) && assignedToUserId === actorId);
  const [dialogMode, setDialogMode] = useState<LifecycleDialogMode | null>(null);
  const [assignees, setAssignees] = useState<FulfillmentEligibleAssignee[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const disabled = ["completed", "returned", "cancelled"].includes(status) || busy || submitting || (assignedToUserId ? !ownsWork : canManage === false);
  useEffect(() => {
    queueMicrotask(() => { setDialogMode(null); setAssignees([]); });
  }, [assignedToUserId]);

  const runTransition = async (
    action: FulfillmentWorkItemAction,
    options?: FulfillmentTransitionOptions,
  ) => {
    if (disabled) return false;
    setSubmitting(true);
    try {
      const succeeded = await onTransition(action, options);
      if (succeeded === "review_required") return false;
      if (succeeded && !(action === "complete" && completeRequiresRecord)) toast.success(action === "claim" ? "담당자로 지정됐어요." : action === "unassign" ? "담당을 취소했어요." : ["assign", "handoff"].includes(action) ? "담당자를 변경했어요." : "업무 상태를 변경했어요.");
      else if (!succeeded) toast.error("업무 상태를 변경하지 못했어요. 최신 상태를 확인해 주세요.");
      return succeeded;
    } catch {
      toast.error("연결을 확인하고 다시 시도해 주세요.");
      return false;
    } finally { setSubmitting(false); }
  };
  const openAssigneeDialog = async (mode: "assign" | "handoff") => {
    setDialogMode(mode);
    setSelectedAssigneeId("");
    setReason("");
    setAssigneesLoading(true);
    try {
      const loaded = await loadEligibleAssignees();
      setAssignees(
        loaded.filter((assignee) => assignee.userId !== assignedToUserId),
      );
    } catch {
      setAssignees([]);
      toast.error("담당자 목록을 불러오지 못했어요.");
    } finally {
      setAssigneesLoading(false);
    }
  };
  const closeDialog = () => {
    if (submitting) return;
    setDialogMode(null);
    setReason("");
    setSelectedAssigneeId("");
  };
  const submitDialog = async () => {
    if (!dialogMode) return;
    const action = dialogMode === "return" ? "return" : dialogMode;
    const succeeded = await runTransition(action, {
      ...(dialogMode === "return"
        ? {}
        : { assignedToUserId: selectedAssigneeId }),
      ...(dialogMode === "handoff" || dialogMode === "return"
        ? { reason: reason.trim() }
        : {}),
    });
    if (succeeded) closeDialog();
  };

  const menu = (items: ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ButtonGroupIconButton
            aria-label={`${activityLabel} 상태 액션 열기`}
            disabled={disabled}
            size={size}
            variant={status === "requested" ? "default" : "outline"}
          />
        }
      >
        <ChevronDownIcon className={size === "sm" ? "size-3" : undefined} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  let trigger: ReactNode = null;
  if (status === "completed") {
    trigger = (
      <Button disabled size={size} type="button" variant="outline">
        <CheckIcon data-icon="inline-start" />
        {completeLabel}
      </Button>
    );
  } else if (status === "returned") {
    trigger = (
      <Button disabled size={size} type="button" variant="outline">
        반려됨
      </Button>
    );
  } else if (status === "cancelled") {
    trigger = (
      <Button disabled size={size} type="button" variant="outline">
        취소됨
      </Button>
    );
  } else if (status === "requested" && !assignedToUserId) {
    trigger = (
      <Button
        disabled={disabled}
        onClick={() => void runTransition("claim")}
        size={size}
        type="button"
      >
        담당하기
      </Button>
    );
  } else if (assignmentOnly) {
    trigger = <Button type="button" variant="outline" size={size} disabled={disabled} onClick={() => void runTransition("unassign")}>담당 취소</Button>;
  } else if (status === "requested") {
    trigger = (
      <ButtonGroup aria-label={`${activityLabel} 요청 상태 액션`}>
        <ButtonGroupPrimaryButton
          disabled={disabled}
          onClick={() =>
            void runTransition("start", {
              ...(startPhase ? { detailedPhase: startPhase } : {}),
            })
          }
          size={size}
          type="button"
        >
          {activityLabel} 시작
        </ButtonGroupPrimaryButton>
        <ButtonGroupDivider />
        {menu(
          <>
            <DropdownMenuItem onClick={() => void openAssigneeDialog("assign")}>
              담당 변경
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void runTransition("unassign")}>
              담당 취소
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDialogMode("return")}>
              반려
            </DropdownMenuItem>
          </>,
        )}
      </ButtonGroup>
    );
  } else {
    const paused = status === "paused";
    trigger = (
      <ButtonGroup aria-label={`${activityLabel} 상태 액션`}>
        <ButtonGroupPrimaryButton disabled size={size} type="button" variant="outline">
          {paused ? "일시중지" : `${activityLabel} 중`}
        </ButtonGroupPrimaryButton>
        <ButtonGroupDivider />
        {menu(
          <>
            {paused ? (
              <DropdownMenuItem onClick={() => void runTransition("resume")}>
                재개
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => void runTransition("complete")}>
                  <CheckIcon className="size-3" />
                  {completeLabel}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void runTransition("pause")}>
                  일시중지
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void openAssigneeDialog("handoff")}>
              담당 인계
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialogMode("return")}>
              반려
            </DropdownMenuItem>
          </>,
        )}
      </ButtonGroup>
    );
  }

  const assigneeMode = dialogMode === "assign" || dialogMode === "handoff";
  const reasonRequired = dialogMode === "handoff" || dialogMode === "return";
  const submitDisabled =
    disabled ||
    submitting ||
    (assigneeMode && !selectedAssigneeId) ||
    (reasonRequired && !reason.trim());

  return (
    <>
      {assignedToUserId ? <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={`담당자 ${assignedToDisplayName ?? "지정됨"} 변경`} />} onClick={() => {
          setAssignees([]);
          setAssigneesLoading(true);
          void loadEligibleAssignees().then(setAssignees).catch(() => toast.error("담당자 목록을 불러오지 못했어요.")).finally(() => setAssigneesLoading(false));
        }}>
          <Avatar size="sm" title={assignedToDisplayName ?? "담당자"}><AvatarFallback>{(assignedToDisplayName ?? "담당").slice(0, 2)}</AvatarFallback></Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {assigneesLoading ? <DropdownMenuItem disabled>담당자 불러오는 중</DropdownMenuItem> : assignees.map(person => <DropdownMenuItem key={person.userId} disabled={person.userId === assignedToUserId} onClick={() => {
            if (status === "requested") void runTransition("assign", { assignedToUserId: person.userId });
            else { setSelectedAssigneeId(person.userId); setReason(""); setDialogMode("handoff"); }
          }}>{person.displayName}{person.userId === assignedToUserId ? " · 현재 담당" : ""}</DropdownMenuItem>)}
          {!assigneesLoading && !assignees.length ? <DropdownMenuItem disabled>변경 가능한 담당자가 없습니다.</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu> : null}
      {trigger}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "return"
                ? `${activityLabel} 업무 반려`
                : dialogMode === "handoff"
                  ? `${activityLabel} 담당 인계`
                  : `${activityLabel} 담당 변경`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "return"
                ? "반려 사유는 오더 이력에 남고, 수의사가 수정하거나 재요청하기 전까지 청구가 보류됩니다."
                : "이 업무를 수행할 권한이 있는 활성 직원만 선택할 수 있습니다."}
            </DialogDescription>
          </DialogHeader>
          {assigneeMode ? (
            <Select
              disabled={disabled || assigneesLoading || submitting}
              value={selectedAssigneeId}
              onValueChange={(value) => setSelectedAssigneeId(value ?? "")}
            >
              <SelectTrigger aria-label="인계할 담당자">
                <SelectValue
                  placeholder={assigneesLoading ? "담당자 불러오는 중" : "담당자 선택"}
                >{selectedAssigneeId ? assignees.find(person => person.userId === selectedAssigneeId)?.displayName ?? "담당자 정보 확인 중" : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {assignees.filter(assignee => assignee.userId !== assignedToUserId).map((assignee) => (
                  <SelectItem key={assignee.userId} value={assignee.userId}>
                    {assignee.displayName}
                    {assignee.title ? ` · ${assignee.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {reasonRequired ? (
            <Textarea
              aria-label={dialogMode === "return" ? "반려 사유" : "인계 사유"}
              disabled={disabled}
              maxLength={500}
              placeholder={
                dialogMode === "return"
                  ? "수정하거나 다시 확인해야 할 내용을 입력해 주세요."
                  : "담당자를 변경하는 이유를 입력해 주세요."
              }
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : null}
          <DialogFooter>
            <Button disabled={submitting} onClick={closeDialog} type="button" variant="outline">
              취소
            </Button>
            <Button disabled={submitDisabled} onClick={() => void submitDialog()} type="button">
              {dialogMode === "return" ? "반려" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
