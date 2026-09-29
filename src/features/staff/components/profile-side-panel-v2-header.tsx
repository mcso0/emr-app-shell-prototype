"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  CdsActionsTrashIcon,
  CdsActionsUploadIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsContentEditIcon } from "@/components/cds-icons/content-and-editor";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
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
    label: "온라인",
    badgeClassName:
      "border-[var(--clair-color-atomic-green-200)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
    dotClassName: "bg-[var(--clair-color-atomic-green-500)]",
  },
  offline: {
    label: "오프라인",
    badgeClassName:
      "border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] text-[var(--emr-text-secondary)]",
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
      className={cn("gap-1 border pl-1.5 pr-2", rule.badgeClassName, className)}
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

  function constrain(valueToConstrain: string) {
    return Array.from(valueToConstrain).slice(0, maxLength).join("");
  }

  async function save(candidate: string) {
    if (saveInFlightRef.current) return;
    const normalized = constrain(candidate.trim());
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
    queueMicrotask(() => {
      skipBlurRef.current = false;
    });
  }

  return (
    <div className="relative flex min-w-0 flex-col">
      {editing ? (
        <div className="relative w-[var(--emr-profile-status-control-max-width)] max-w-full">
          <Input
            autoFocus
            aria-label="상태 메시지"
            className="h-[var(--emr-profile-status-control-height)] pr-11 text-sm"
            value={draft}
            onBlur={() => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false;
                return;
              }
              void save(draft);
            }}
            onChange={(event) => setDraft(constrain(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void save(draft);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancel();
              }
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-[var(--emr-text-placeholder)]"
          >
            {Array.from(draft).length}/{maxLength}
          </span>
        </div>
      ) : editable ? (
        <button
          type="button"
          aria-label="상태 메시지 수정"
          className="flex h-[var(--emr-profile-status-control-height)] w-[173px] max-w-full items-center rounded-[var(--clair-radius-atomic-6)] px-1.5 text-left text-sm text-[var(--emr-text-secondary)] outline-none hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={isSaving}
          onClick={() => {
            setDraft(displayedValue);
            setEditing(true);
            setError(null);
          }}
        >
          <span className="min-w-0 truncate">
            {displayedValue || "상태메세지 추가하기..."}
          </span>
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
        <div
          className="absolute left-0 top-full z-10 mt-1.5 flex w-[var(--emr-profile-status-control-max-width)] max-w-full items-center gap-2 bg-[var(--emr-surface-rightpanel)] text-xs text-[var(--emr-status-danger-text)]"
          role="alert"
        >
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
export type ProfileAvatarUploadPhase =
  | "preparing"
  | "uploading"
  | "processing";

function ProfileImageUploadDialogContent({
  onOpenChange,
  onUpload,
}: {
  onOpenChange: (open: boolean) => void;
  onUpload: (
    file: File,
    phase: (phase: ProfileAvatarUploadPhase) => void,
  ) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] =
    useState<ProfileAvatarUploadPhase | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const uploading = uploadPhase !== null;

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function replacePreview(nextFile: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = nextFile ? URL.createObjectURL(nextFile) : null;
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
  }

  function clearFile() {
    replacePreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectFile(nextFile: File | undefined) {
    setError(null);
    if (!nextFile) {
      replacePreview(null);
      return;
    }
    if (!acceptedAvatarTypes.has(nextFile.type)) {
      replacePreview(null);
      if (inputRef.current) inputRef.current.value = "";
      setError("JPG, PNG 또는 정적 WebP 파일을 선택해 주세요.");
      return;
    }
    if (nextFile.size > maxAvatarBytes) {
      replacePreview(null);
      if (inputRef.current) inputRef.current.value = "";
      setError("파일 크기는 5MB 이하여야 해요.");
      return;
    }
    replacePreview(nextFile);
  }

  async function upload() {
    if (!file || uploading) return;
    setUploadPhase("preparing");
    setError(null);
    try {
      await onUpload(file, setUploadPhase);
      onOpenChange(false);
    } catch {
      setError("프로필 사진을 업로드하지 못했어요.");
    } finally {
      setUploadPhase(null);
    }
  }

  return (
    <DialogContent
      className="w-[var(--emr-profile-upload-dialog-width)] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-4"
      showCloseButton={false}
    >
      <DialogClose
        render={
          <Button
            type="button"
            aria-label="프로필 이미지 업로드 닫기"
            className="absolute right-3 top-3 z-10"
            disabled={uploading}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <CdsActionsXIcon aria-hidden="true" size={16} />
      </DialogClose>
      <DialogHeader className="pb-4 pr-8">
        <DialogTitle>프로필 이미지 업로드</DialogTitle>
        <DialogDescription>
          512×512px 이상 정사각형 이미지를 권장해요. JPG, PNG, 정적 WebP · 최대 5MB
        </DialogDescription>
      </DialogHeader>

      <div className="relative flex aspect-square w-full max-w-[var(--emr-profile-upload-content-size)] items-center justify-center overflow-hidden rounded-[var(--clair-radius-atomic-10)] border border-dashed border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] text-center">
        <input
          ref={inputRef}
          id="profile-avatar-file"
          aria-label="프로필 이미지 선택"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        {file && previewUrl ? (
          <>
            {/* Browser preview only. The server still decodes and normalizes the source. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="선택한 프로필 이미지 미리보기"
              className="size-full object-cover"
              src={previewUrl}
            />
            <Button
              type="button"
              aria-label="선택한 이미지 제거"
              className="absolute right-2 top-2 bg-[var(--emr-surface-panel)]/90"
              disabled={uploading}
              size="icon-sm"
              variant="outline"
              onClick={clearFile}
            >
              <CdsActionsXIcon aria-hidden="true" size={16} />
            </Button>
          </>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-3 p-6 text-sm" htmlFor="profile-avatar-file">
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

      <span className="sr-only" aria-live="polite">
        {uploadPhase === "preparing"
          ? "업로드 준비 중"
          : uploadPhase === "uploading"
            ? "파일 업로드 중"
            : uploadPhase === "processing"
              ? "이미지 처리 중"
              : ""}
      </span>

      <DialogFooter className="mt-4 min-h-[var(--emr-profile-upload-footer-height)] items-center">
        <Button type="button" disabled={!file || uploading} onClick={() => void upload()}>
          {uploadPhase === "preparing"
            ? "업로드 준비 중"
            : uploadPhase === "uploading"
              ? "파일 업로드 중"
              : uploadPhase === "processing"
                ? "이미지 처리 중"
                : "업로드"}
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
  onUpload: (
    file: File,
    phase: (phase: ProfileAvatarUploadPhase) => void,
  ) => Promise<void>;
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
  removing,
  onOpenUpload,
  onRemove,
  triggerRef,
}: {
  hasAvatar: boolean;
  removing: boolean;
  onOpenUpload: () => void;
  onRemove: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            ref={triggerRef}
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
          <DropdownMenuItem disabled={!hasAvatar || removing} variant="destructive" onClick={onRemove}>
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
  onUpload?: (
    file: File,
    phase: (phase: ProfileAvatarUploadPhase) => void,
  ) => Promise<void>;
  src?: string | null;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  async function remove() {
    if (removing) return;
    setMutationError(null);
    setRemoving(true);
    try {
      await onRemove?.();
    } catch {
      setMutationError("프로필 사진을 삭제하지 못했어요.");
    } finally {
      setRemoving(false);
    }
  }

  function setUploadDialogOpen(open: boolean) {
    setUploadOpen(open);
    if (!open) {
      queueMicrotask(() => menuTriggerRef.current?.focus());
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
            removing={removing}
            triggerRef={menuTriggerRef}
            onOpenUpload={() => setUploadDialogOpen(true)}
            onRemove={() => void remove()}
          />
        ) : null}
      </div>
      <div aria-live="polite">
        {removing ? <span className="sr-only">프로필 사진 삭제 중</span> : null}
        {mutationError ? (
          <p className="max-w-52 text-xs text-[var(--emr-status-danger-text)]" role="alert">
            {mutationError}
          </p>
        ) : null}
      </div>
      {editable && onUpload ? (
        <ProfileImageUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadDialogOpen}
          onUpload={onUpload}
        />
      ) : null}
    </div>
  );
}

export function ProfileHeaderActionMenu({
  canManageMember,
  canViewSchedule = true,
  hasContact,
  onCopyContact,
  onManageMember,
  onOpenSchedule,
}: {
  canManageMember: boolean;
  canViewSchedule?: boolean;
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
          <DropdownMenuItem disabled={!canViewSchedule} onClick={onOpenSchedule}>
            전체 근무표 보기
          </DropdownMenuItem>
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
