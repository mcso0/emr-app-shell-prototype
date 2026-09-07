"use client";

import { useEffect, useRef, useState } from "react";
import { CdsContentEditIcon } from "@/components/cds-icons/content-and-editor";
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
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export type AvatarDraft = { url: string | null; file: File | null };
export function PersonalSettingsAvatar({
  value,
  initials,
  disabled,
  onChange,
}: {
  value: AvatarDraft;
  initials: string;
  disabled: boolean;
  onChange: (value: AvatarDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AvatarDraft>(value);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const localUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = localUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);
  function avatar(url: string | null, large = false) {
    return (
      <Avatar className={large ? "size-24" : "size-11"} roundness="roundrect">
        {url ? <AvatarImage src={url} alt="프로필 사진" /> : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
    );
  }
  return (
    <>
      <div className="relative size-11 shrink-0">
        {avatar(value.url)}
        <Button
          ref={trigger}
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          className="absolute inset-0 size-11 rounded-[var(--clair-radius-atomic-10)] bg-foreground/0 text-background opacity-0 transition-opacity hover:bg-foreground/60 hover:opacity-100 focus-visible:bg-foreground/60 focus-visible:opacity-100"
          aria-label="프로필 사진 편집"
          onClick={() => {
            setDraft(value);
            setError("");
            setOpen(true);
          }}
        >
          <CdsContentEditIcon aria-hidden="true" />
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) requestAnimationFrame(() => trigger.current?.focus());
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로필 사진 설정</DialogTitle>
            <DialogDescription>
              사진을 적용한 뒤 프로필을 저장해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {avatar(draft.url, true)}
            <label className="w-full text-sm">
              사진 파일
              <input
                aria-label="사진 파일"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full text-sm"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    ) ||
                    file.size > 5 * 1024 * 1024
                  ) {
                    setError("5MB 이하의 JPG, PNG, WebP 파일을 선택해 주세요.");
                    return;
                  }
                  const url = URL.createObjectURL(file);
                  localUrls.current.add(url);
                  setDraft({ url, file });
                  setError("");
                }}
              />
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setDraft({ url: null, file: null });
                setError("");
              }}
            >
              기본 이미지로 변경
            </Button>
            {error ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
                requestAnimationFrame(() => trigger.current?.focus());
              }}
            >
              사진 적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export async function savePersonalSettingsAvatar(
  workspaceId: string,
  draft: AvatarDraft,
): Promise<string | null> {
  const headers = { "content-type": "application/json" };
  if (!draft.file) {
    const response = await fetch("/api/users/me/avatar", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ workspaceId }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok)
      throw new Error("사진을 삭제하지 못했습니다.");
    return null;
  }
  let uploadId: string | null = null;
  try {
    const preparedResponse = await fetch("/api/users/me/avatar", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "prepare", workspaceId }),
    });
    const prepared = await preparedResponse.json();
    if (
      !preparedResponse.ok ||
      !prepared.ok ||
      typeof prepared.uploadId !== "string" ||
      typeof prepared.objectPath !== "string" ||
      typeof prepared.uploadToken !== "string" ||
      draft.file.size > prepared.maxBytes
    )
      throw new Error("사진 업로드를 준비하지 못했습니다.");
    uploadId = prepared.uploadId;
    const client = getBrowserSupabaseClient();
    if (!client) throw new Error("사진 저장 연결을 확인해 주세요.");
    const uploaded = await client.storage
      .from("profile-avatars")
      .uploadToSignedUrl(
        prepared.objectPath,
        prepared.uploadToken,
        draft.file,
        { cacheControl: "0", contentType: draft.file.type, upsert: false },
      );
    if (uploaded.error) throw new Error("사진을 업로드하지 못했습니다.");
    const finalizedResponse = await fetch("/api/users/me/avatar", {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "finalize",
        declaredMime: draft.file.type,
        uploadId,
        workspaceId,
      }),
    });
    const finalized = await finalizedResponse.json();
    if (
      !finalizedResponse.ok ||
      !finalized.ok ||
      typeof finalized.avatarUrl !== "string"
    )
      throw new Error(
        "사진을 저장하지 못했습니다. 파일을 확인한 뒤 다시 시도해 주세요.",
      );
    uploadId = null;
    return finalized.avatarUrl;
  } finally {
    if (uploadId)
      await fetch("/api/users/me/avatar", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "discard", uploadId, workspaceId }),
      }).catch(() => undefined);
  }
}
