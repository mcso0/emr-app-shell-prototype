"use client";

import { useState } from "react";

import { CdsGnbPetGnbIcon } from "@/components/cds-icons/gnb";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type AnimalPatientAvatarSize = "table" | "sm" | "md" | "lg";
export type AnimalPatientAvatarState = "ready" | "loading" | "error";

export type AnimalPatientAvatarProps = {
  alt: string;
  className?: string;
  size?: AnimalPatientAvatarSize;
  src?: string | null;
  state?: AnimalPatientAvatarState;
};

const sizeClassName: Record<AnimalPatientAvatarSize, string> = {
  table: "size-7 !rounded-[var(--clair-radius-atomic-8)] [&_[data-slot=avatar-fallback]]:!rounded-[var(--clair-radius-atomic-8)] [&_[data-slot=avatar-image]]:!rounded-[var(--clair-radius-atomic-8)] [&_svg]:size-4",
  sm: "size-10 !rounded-[var(--clair-radius-atomic-12)] [&_[data-slot=avatar-fallback]]:!rounded-[var(--clair-radius-atomic-12)] [&_[data-slot=avatar-image]]:!rounded-[var(--clair-radius-atomic-12)] [&_svg]:size-5",
  md: "size-14 !rounded-[var(--clair-radius-atomic-12)] [&_[data-slot=avatar-fallback]]:!rounded-[var(--clair-radius-atomic-12)] [&_[data-slot=avatar-image]]:!rounded-[var(--clair-radius-atomic-12)] [&_svg]:size-7",
  lg: "size-20 !rounded-[var(--clair-radius-atomic-12)] [&_[data-slot=avatar-fallback]]:!rounded-[var(--clair-radius-atomic-12)] [&_[data-slot=avatar-image]]:!rounded-[var(--clair-radius-atomic-12)] [&_svg]:size-8",
};

/**
 * Shared square avatar for animal patients.
 *
 * The patient domain may provide an image URL later. Until then, callers get
 * the same veterinary fallback without coupling this visual component to
 * registration, storage, or database behavior.
 */
export function AnimalPatientAvatar({
  alt,
  className,
  size = "lg",
  src,
  state = "ready",
}: AnimalPatientAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageFailed = Boolean(src && failedSrc === src);

  const displayState =
    state === "loading"
      ? "loading"
      : state === "error" || imageFailed
        ? "error"
        : src
          ? "image"
          : "fallback";
  const label =
    displayState === "image"
      ? alt
      : `${alt} · ${displayState === "loading" ? "불러오는 중" : "이미지 미등록"}`;

  return (
    <Avatar
      aria-busy={displayState === "loading" ? true : undefined}
      aria-label={label}
      className={cn(
        "border border-[var(--emr-border-subtle)] bg-[var(--emr-surface-muted)] text-[var(--emr-text-tertiary)] after:!rounded-[inherit]",
        displayState === "loading" && "animate-pulse",
        displayState === "error" &&
          "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
        sizeClassName[size],
        className,
      )}
      data-avatar-state={displayState}
      data-testid="animal-patient-avatar"
      role="img"
      roundness="roundrect"
    >
      {displayState === "image" ? (
        <AvatarImage
          src={src ?? undefined}
          alt=""
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-transparent text-current",
          displayState === "fallback" && "!bg-[var(--clair-color-atomic-neutral-50)]",
          displayState === "loading" && "opacity-50",
        )}
      >
        <CdsGnbPetGnbIcon aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}
