"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CdsContentEditIcon } from "@/components/cds-icons/content-and-editor";
import { WorkspaceLogoMarkIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

const maxLogoBytes = 5 * 1024 * 1024;
const acceptedLogoTypes = new Set(["image/jpeg", "image/png"]);

type HospitalLogoEditorProps = {
  value: string | null;
  onChange: (value: string | null, file: File | null) => void;
};

export function HospitalLogoEditor({ value, onChange }: HospitalLogoEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value);
  const [previewFileName, setPreviewFileName] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  useEffect(
    () => () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const replacePreview = (nextUrl: string | null) => {
    setPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return nextUrl;
    });
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!acceptedLogoTypes.has(file.type)) {
      setFileError("PNG 또는 JPG 파일만 선택해 주세요.");
      toast.error("지원하지 않는 로고 파일 형식입니다.");
      return;
    }
    if (file.size > maxLogoBytes) {
      setFileError("파일 크기는 5MB 이하여야 합니다.");
      toast.error("로고 파일 크기가 5MB를 초과했습니다.");
      return;
    }

    replacePreview(URL.createObjectURL(file));
    setPreviewFileName(file.name);
    setPreviewFile(file);
    setFileError("");
    toast.success("로고 파일을 불러왔습니다.");
  };

  return (
    <>
      <div className="relative size-11 shrink-0" data-testid="hospital-logo-trigger">
        <Avatar className="size-11" roundness="roundrect">
          {value ? <AvatarImage alt="병원 로고" src={value} /> : null}
          <AvatarFallback className="!rounded-[var(--clair-radius-atomic-10)] bg-[var(--emr-workspace-button-logo-bg)] text-[var(--emr-workspace-button-logo-fg)]">
            <WorkspaceLogoMarkIcon className="size-7" size={28} />
          </AvatarFallback>
        </Avatar>
        <Button
          ref={triggerRef}
          type="button"
          size="icon"
          variant="ghost"
          className="absolute inset-0 size-11 rounded-[var(--clair-radius-atomic-10)] bg-foreground/0 text-background opacity-0 transition-opacity hover:bg-foreground/60 hover:opacity-100 focus-visible:bg-foreground/60 focus-visible:opacity-100"
          aria-label="병원 로고 편집"
          onClick={() => {
            replacePreview(value);
            setPreviewFileName("");
            setPreviewFile(null);
            setFileError("");
            setOpen(true);
          }}
        >
          <CdsContentEditIcon aria-hidden="true" />
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) window.requestAnimationFrame(() => triggerRef.current?.focus());
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>병원 로고 설정</DialogTitle>
            <DialogDescription>
              병원관리와 고객 안내 화면에 표시할 로고를 선택합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/30 p-5">
            <Avatar className="size-28" roundness="roundrect">
              {previewUrl ? <AvatarImage alt="선택한 병원 로고 미리보기" src={previewUrl} /> : null}
              <AvatarFallback className="bg-[var(--emr-workspace-button-logo-bg)] text-[var(--emr-workspace-button-logo-fg)]">
                <WorkspaceLogoMarkIcon className="size-14" size={56} />
              </AvatarFallback>
            </Avatar>
            {previewFileName ? (
              <p className="max-w-full truncate text-sm text-muted-foreground">
                {previewFileName}
              </p>
            ) : null}
          </div>

          <Field data-invalid={Boolean(fileError)}>
            <FieldLabel htmlFor="hospital-logo-file">로고 파일</FieldLabel>
            <input
              ref={inputRef}
              id="hospital-logo-file"
              className="sr-only"
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <FieldDescription>
              PNG 또는 JPG, 최대 5MB. 256 × 256px 이상을 권장합니다.
            </FieldDescription>
            <FieldError>{fileError}</FieldError>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                파일 선택
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  replacePreview(null);
                  setPreviewFileName("");
                  setPreviewFile(null);
                  setFileError("");
                  toast.success("기본 이미지로 변경할 준비가 되었습니다.");
                }}
              >
                기본 이미지 사용
              </Button>
            </div>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                onChange(previewUrl, previewFile);
                setOpen(false);
                toast.success("로고 변경사항이 저장 대기 중입니다.");
              }}
            >
              로고 적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
