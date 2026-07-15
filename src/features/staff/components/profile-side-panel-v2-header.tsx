"use client";

import { useRef, useState } from "react";
import { CdsActionsTrashIcon, CdsActionsUploadIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsContentEditIcon } from "@/components/cds-icons/content-and-editor";
import { CdsFilesImageIcon, CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PresenceState = "online" | "offline" | "unknown";

const presenceRules: Record<
  PresenceState,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  online: {
    label: "접속 중",
    badgeClassName:
      "bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
    dotClassName: "bg-[var(--clair-color-atomic-green-500)]",
  },
  offline: {
    label: "오프라인",
    badgeClassName:
      "bg-[var(--emr-surface-muted)] text-[var(--emr-text-secondary)]",
    dotClassName: "bg-[var(--clair-color-atomic-neutral-400)]",
  },
  unknown: {
    label: "상태 확인 중",
    badgeClassName:
      "bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
    dotClassName: "bg-[var(--clair-color-atomic-orange-400)]",
  },
};

export function PresenceBadge({
  className,
  state,
}: {
  className?: string;
  state: PresenceState;
}) {
  const rule = presenceRules[state];

  return (
    <Badge
      className={cn("border-0 px-2", rule.badgeClassName, className)}
      data-presence-state={state}
      size="sm"
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", rule.dotClassName)} />
      {rule.label}
    </Badge>
  );
}

export function StatusMessageEditor({
  editable,
  maxLength = 60,
  onSave,
  value,
}: {
  editable: boolean;
  maxLength?: number;
  onSave?: (value: string) => Promise<void>;
  value: string;
}) {
  const [draft, setDraft] = useState(value.trim());
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryValue, setRetryValue] = useState<string | null>(null);
  const skipBlurRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const confirmedValue = value.trim();
  const displayedValue = optimisticValue ?? confirmedValue;

  async function save(candidate: string) {
    if (saveInFlightRef.current) return;
    const normalized = candidate.trim().slice(0, maxLength);
    setEditing(false);
    setError(null);
    setRetryValue(normalized);

    if (normalized === confirmedValue) {
      setOptimisticValue(null);
      return;
    }

    saveInFlightRef.current = true;
    setOptimisticValue(normalized);
    setIsSaving(true);
    try {
      await onSave?.(normalized);
      setDraft(normalized);
      setOptimisticValue(null);
      setRetryValue(null);
    } catch {
      setOptimisticValue(null);
      setDraft(confirmedValue);
      setError("상태 메시지를 저장하지 못했어요.");
    } finally {
      setIsSaving(false);
      saveInFlightRef.current = false;
    }
  }

  function cancel() {
    skipBlurRef.current = true;
    setDraft(confirmedValue);
    setOptimisticValue(null);
    setEditing(false);
    setError(null);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {editing ? (
        <div className="relative w-[var(--emr-profile-status-control-max-width)] max-w-full">
          <Input
            autoFocus
            aria-label="상태 메시지"
            className="h-[var(--emr-profile-status-control-height)] pr-11 text-sm"
            maxLength={maxLength}
            value={draft}
            onBlur={() => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false;
                return;
              }
              void save(draft);
            }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void save(draft);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-[var(--emr-text-placeholder)]"
          >
            {draft.length}/{maxLength}
          </span>
        </div>
      ) : editable ? (
        <button
          type="button"
          aria-label="상태 메시지 수정"
          className="group flex h-[var(--emr-profile-status-control-height)] w-fit max-w-[var(--emr-profile-status-control-max-width)] items-center gap-1 rounded-[var(--clair-radius-atomic-6)] px-1.5 text-left text-sm text-[var(--emr-text-secondary)] outline-none hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={isSaving}
          onClick={() => {
            setDraft(displayedValue);
            setEditing(true);
            setError(null);
          }}
        >
          <span className="min-w-0 truncate">
            {displayedValue || "상태 메시지 입력"}
          </span>
          <CdsContentEditIcon aria-hidden="true" className="size-4 shrink-0" />
        </button>
      ) : (
        <p className="h-[var(--emr-profile-status-control-height)] max-w-[var(--emr-profile-status-control-max-width)] truncate px-1.5 py-1 text-sm text-[var(--emr-text-secondary)]">
          {displayedValue || "상태 메시지 없음"}
        </p>
      )}

      <span className="sr-only" aria-live="polite">
        {isSaving ? "상태 메시지 저장 중" : retryValue === null && !error ? "" : undefined}
      </span>
      {error ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--emr-status-danger-text)]" role="alert">
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void save(retryValue ?? confirmedValue)}
          >
            다시 시도
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const acceptedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarBytes = 5 * 1024 * 1024;

function ProfileImageUploadDialogContent({
  onOpenChange,
  onUpload,
}: {
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFile(nextFile: File | undefined) {
    setError(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!acceptedAvatarTypes.has(nextFile.type)) {
      setFile(null);
      setError("JPG, PNG 또는 정적 WebP 파일을 선택해 주세요.");
      return;
    }
    if (nextFile.size > maxAvatarBytes) {
      setFile(null);
      setError("파일 크기는 5MB 이하여야 해요.");
      return;
    }
    setFile(nextFile);
  }

  async function upload() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(file);
      onOpenChange(false);
    } catch {
      setError("프로필 사진을 업로드하지 못했어요.");
    } finally {
      setUploading(false);
    }
  }

  return (
      <DialogContent
        className="w-[var(--emr-profile-upload-dialog-width)] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-4"
        showCloseButton={false}
      >
        <DialogHeader className="pb-4 pr-8">
          <DialogTitle>프로필 이미지 업로드</DialogTitle>
          <DialogDescription>
            512×512px 이상 정사각형 이미지를 권장해요. JPG, PNG, 정적 WebP · 최대 5MB
          </DialogDescription>
        </DialogHeader>

        <div className="flex aspect-square w-full max-w-[var(--emr-profile-upload-content-size)] items-center justify-center rounded-[var(--clair-radius-atomic-10)] border border-dashed border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] p-6 text-center">
          <input
            ref={inputRef}
            id="profile-avatar-file"
            aria-label="프로필 이미지 선택"
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          {file ? (
            <div className="flex min-w-0 flex-col items-center gap-3">
              <CdsFilesImageIcon aria-hidden="true" className="size-10 text-[var(--emr-text-secondary)]" />
              <p className="max-w-[260px] truncate text-sm font-medium">{file.name}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                선택한 이미지 제거
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3 text-sm" htmlFor="profile-avatar-file">
              <CdsActionsUploadIcon aria-hidden="true" className="size-10 text-[var(--emr-text-secondary)]" />
              <span className="font-medium">사진 선택</span>
              <span className="text-xs text-[var(--emr-text-placeholder)]">최소 한 변 256px</span>
            </label>
          )}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-[var(--emr-status-danger-text)]" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="mt-4 min-h-[var(--emr-profile-upload-footer-height)] items-center">
          <DialogClose render={<Button type="button" variant="outline" />}>취소</DialogClose>
          <Button type="button" disabled={!file || uploading} onClick={() => void upload()}>
            {uploading ? "업로드 중" : "업로드"}
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}

export function ProfileImageUploadDialog({
  onOpenChange,
  onUpload,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ProfileImageUploadDialogContent onOpenChange={onOpenChange} onUpload={onUpload} />
      ) : null}
    </Dialog>
  );
}

export function ProfileImageActionMenu({
  hasAvatar,
  onOpenUpload,
  onRemove,
}: {
  hasAvatar: boolean;
  onOpenUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            aria-label="프로필 이미지 메뉴 열기"
            className="absolute inset-0 size-full rounded-[var(--clair-radius-atomic-6)] bg-transparent text-transparent opacity-0 hover:bg-black/30 hover:text-white hover:opacity-100 focus-visible:bg-black/30 focus-visible:text-white focus-visible:opacity-100"
            size="icon"
            variant="ghost"
          />
        }
      >
        <CdsContentEditIcon aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--emr-profile-avatar-menu-width)]">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onOpenUpload}>
            <CdsActionsUploadIcon aria-hidden="true" />
            프로필 이미지 업로드
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={!hasAvatar} variant="destructive" onClick={onRemove}>
            <CdsActionsTrashIcon aria-hidden="true" />
            프로필 이미지 제거
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EditableProfileAvatar({
  alt,
  editable,
  initials,
  onRemove,
  onUpload,
  src,
}: {
  alt: string;
  editable: boolean;
  initials: string;
  onRemove?: () => Promise<void>;
  onUpload?: (file: File) => Promise<void>;
  src?: string | null;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function remove() {
    setMutationError(null);
    try {
      await onRemove?.();
    } catch {
      setMutationError("프로필 사진을 삭제하지 못했어요.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative size-[var(--emr-profile-avatar-size)] shrink-0">
        <Avatar className="size-full" roundness="roundrect">
          {src ? <AvatarImage alt={alt} src={src} /> : null}
          <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
        </Avatar>
        {editable ? (
          <ProfileImageActionMenu
            hasAvatar={Boolean(src)}
            onOpenUpload={() => setUploadOpen(true)}
            onRemove={() => void remove()}
          />
        ) : null}
      </div>
      {mutationError ? (
        <p className="max-w-52 text-xs text-[var(--emr-status-danger-text)]" role="alert">
          {mutationError}
        </p>
      ) : null}
      {editable && onUpload ? (
        <ProfileImageUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUpload={onUpload} />
      ) : null}
    </div>
  );
}

export function ProfileHeaderActionMenu({
  canManageMember,
  hasContact,
  onCopyContact,
  onManageMember,
  onOpenSchedule,
}: {
  canManageMember: boolean;
  hasContact: boolean;
  onCopyContact: () => void;
  onManageMember: () => void;
  onOpenSchedule: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" aria-label="프로필 작업 더보기" size="icon-sm" variant="ghost" />
        }
      >
        <CdsFilesMoreHorizontalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[var(--emr-profile-header-menu-width)]">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onOpenSchedule}>전체 근무표 보기</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={!hasContact} onClick={onCopyContact}>
            연락처 복사
          </DropdownMenuItem>
          {canManageMember ? (
            <DropdownMenuItem onClick={onManageMember}>멤버 관리에서 보기</DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
