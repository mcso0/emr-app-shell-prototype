"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { GuardianProfileDrawer, PatientProfileDrawer } from "@/features/reception/profile-drawer";
import { ReceptionStaffProfileDrawer } from "@/features/reception/module";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";

export function WorkspaceProfileDrawer({ frameElement, ...props }: ShellComponentProps & {
  frameElement: HTMLElement | null;
}) {
  const profile = useLayoutStore((state) => state.activeProfileDrawer);
  const setActiveProfileDrawer = useLayoutStore((state) => state.setActiveProfileDrawer);
  const returnFocusIdRef = useRef<string | undefined>(undefined);
  const [bounds, setBounds] = useState<{
    top: number; right: number; height: number; width: number;
  } | null>(null);
  const open = Boolean(profile);
  useLayoutEffect(() => {
    if (!open || !frameElement) return;
    let animationFrame = 0;
    const update = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const rect = frameElement.getBoundingClientRect();
        const next = {
          top: rect.top,
          right: window.innerWidth - rect.right,
          height: rect.height,
          width: Math.min(380, rect.width),
        };
        setBounds((current) => current && current.top === next.top &&
          current.right === next.right && current.height === next.height &&
          current.width === next.width ? current : next);
      });
    };
    // Keep the body portal so nested menus/dialogs escape workspace clipping.
    const observer = new ResizeObserver(update);
    observer.observe(frameElement);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [frameElement, open]);
  useEffect(() => {
    if (profile) returnFocusIdRef.current = profile.returnFocusId;
  }, [profile]);
  const title = profile?.type === "patient" ? "환자 프로필" :
    profile?.type === "guardian" ? "보호자 프로필" : "직원 운영 프로필";

  return (
    <Sheet open={open && Boolean(bounds)} modal={false} disablePointerDismissal
      onOpenChange={(open) => { if (!open) setActiveProfileDrawer(null); }}>
      <SheetContent
        aria-describedby={undefined}
        className="gap-0 overflow-hidden rounded-r-[var(--emr-radius-panel)] p-0 motion-reduce:transition-none"
        style={bounds ? { ...bounds, bottom: "auto", maxWidth: bounds.width } : undefined}
        data-testid="workspace-profile-drawer"
        showCloseButton={false}
        showOverlay={false}
        initialFocus={() => document.querySelector<HTMLElement>(
          '[data-testid="workspace-profile-drawer"] button[aria-label="상세 닫기"], [data-testid="workspace-profile-drawer"] button[aria-label="직원 운영 프로필 닫기"]',
        ) ?? false}
        finalFocus={() => returnFocusIdRef.current ? document.getElementById(returnFocusIdRef.current) ?? false : false}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {profile?.type === "patient" ? (
          <PatientProfileDrawer key={`${props.workspaceId}:patient:${profile.id}`} patientId={profile.id} defaultTab={profile.profileTab} />
        ) : profile?.type === "guardian" ? (
          <GuardianProfileDrawer key={`${props.workspaceId}:guardian:${profile.id}`} guardianId={profile.id} />
        ) : profile?.type === "staff-operational-profile" ? (
          <ReceptionStaffProfileDrawer {...props} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
