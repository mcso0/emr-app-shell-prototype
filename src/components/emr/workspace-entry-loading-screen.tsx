"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { WorkspaceLogoMarkIcon } from "@/components/icons";
import { WORKSPACE_ENTRY_SPLASH_MOTION } from "@/components/emr/workspace-entry-loading-screen-motion";
import { cn } from "@/lib/utils";

export type WorkspaceEntryLoadingScreenProps = {
  ready: boolean;
  className?: string;
  "data-testid"?: string;
  onExitComplete?: () => void;
};

export function WorkspaceEntryLoadingScreen({
  ready,
  className,
  "data-testid": dataTestId = "workspace-entry-loading-screen",
  onExitComplete
}: WorkspaceEntryLoadingScreenProps) {
  const logoControls = useAnimationControls();
  const overlayControls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  const readyRef = useRef(ready);
  const readyResolverRef = useRef<(() => void) | null>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  const exitCompletedRef = useRef(false);

  useEffect(() => {
    readyRef.current = ready;

    if (ready) {
      readyResolverRef.current?.();
      readyResolverRef.current = null;
    }
  }, [ready]);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    let active = true;

    async function waitUntilReady() {
      if (readyRef.current) return;

      await new Promise<void>((resolve) => {
        readyResolverRef.current = resolve;
      });
    }

    async function runSequence() {
      overlayControls.set({ opacity: 1 });

      if (prefersReducedMotion) {
        logoControls.set(WORKSPACE_ENTRY_SPLASH_MOTION.full);
        await waitUntilReady();
      } else {
        logoControls.set(WORKSPACE_ENTRY_SPLASH_MOTION.initial);
        await logoControls.start({
          ...WORKSPACE_ENTRY_SPLASH_MOTION.full,
          transition: WORKSPACE_ENTRY_SPLASH_MOTION.enter
        });

        while (active && !readyRef.current) {
          await logoControls.start({
            ...WORKSPACE_ENTRY_SPLASH_MOTION.low,
            transition: WORKSPACE_ENTRY_SPLASH_MOTION.pulseLeg
          });
          if (!active) return;

          await logoControls.start({
            ...WORKSPACE_ENTRY_SPLASH_MOTION.full,
            transition: WORKSPACE_ENTRY_SPLASH_MOTION.pulseLeg
          });
        }
      }

      if (!active) return;

      await overlayControls.start({
        opacity: 0,
        transition: prefersReducedMotion
          ? WORKSPACE_ENTRY_SPLASH_MOTION.reduced
          : WORKSPACE_ENTRY_SPLASH_MOTION.exit,
        transitionEnd: { display: "none" }
      });

      if (!active || exitCompletedRef.current) return;

      exitCompletedRef.current = true;
      onExitCompleteRef.current?.();
    }

    void runSequence();

    return () => {
      active = false;
      readyResolverRef.current?.();
      readyResolverRef.current = null;
      logoControls.stop();
      overlayControls.stop();
    };
  }, [logoControls, overlayControls, prefersReducedMotion]);

  return (
    <motion.div
      animate={overlayControls}
      aria-busy="true"
      aria-label="워크스페이스를 불러오는 중"
      className={cn(
        "fixed inset-0 grid min-h-svh place-items-center overflow-hidden bg-white text-foreground",
        className
      )}
      data-testid={dataTestId}
      initial={{ opacity: 1 }}
      role="status"
      style={{ zIndex: "calc(var(--clair-z-index-tooltip) + 1)" }}
    >
      <div className="flex size-32 items-center justify-center">
        <motion.div
          animate={logoControls}
          data-splash-logo="true"
          initial={WORKSPACE_ENTRY_SPLASH_MOTION.initial}
          style={{ transformOrigin: "center center" }}
        >
          <WorkspaceLogoMarkIcon
            aria-hidden="true"
            className="block size-32 text-[#C7CCD1]"
            size={128}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
