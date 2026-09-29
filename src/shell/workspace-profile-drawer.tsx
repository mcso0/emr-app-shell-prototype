"use client";

import { useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { GuardianProfileDrawer, PatientProfileDrawer } from "@/features/reception/profile-drawer";
import { ReceptionStaffProfileDrawer } from "@/features/reception/module";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";

export function WorkspaceProfileDrawer(props: ShellComponentProps) {
  const profile = useLayoutStore((state) => state.activeProfileDrawer);
  const setActiveProfileDrawer = useLayoutStore((state) => state.setActiveProfileDrawer);
  const returnFocusIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (profile) returnFocusIdRef.current = profile.returnFocusId;
  }, [profile]);
  const title = profile?.type === "patient" ? "환자 프로필" :
    profile?.type === "guardian" ? "보호자 프로필" : "직원 운영 프로필";

  return (
    <Sheet open={Boolean(profile)} modal={false} disablePointerDismissal
      onOpenChange={(open) => { if (!open) setActiveProfileDrawer(null); }}>
      <SheetContent
        aria-describedby={undefined}
        className="gap-0 p-0 motion-reduce:transition-none data-[side=right]:w-[380px] data-[side=right]:sm:max-w-[380px] max-[1100px]:data-[side=right]:w-full max-[1100px]:data-[side=right]:sm:max-w-none"
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
