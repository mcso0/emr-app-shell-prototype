"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { WorkspaceLogoMarkIcon } from "@/components/icons";
import {
  WORKSPACE_ENTRY_SPLASH_LIGHT,
  WORKSPACE_ENTRY_SPLASH_MOTION
} from "@/components/emr/workspace-entry-loading-screen-motion";
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const lightMaskRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const readyRef = useRef(ready);
  const exitRef = useRef<(() => void) | null>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  const exitCompletedRef = useRef(false);

  useEffect(() => {
    readyRef.current = ready;
    if (ready) exitRef.current?.();
  }, [ready]);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const logo = logoRef.current;
    const lightMask = lightMaskRef.current;
    const light = lightRef.current;
    const message = messageRef.current;
    if (!overlay || !logo || !lightMask || !light || !message) return;
    if (exitCompletedRef.current) return;

    let active = true;
    let exiting = false;
    const animations: Animation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const motion = WORKSPACE_ENTRY_SPLASH_MOTION;

    function animate(element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = element.animate(frames, { fill: "both", ...options });
      animations.push(animation);
      return animation;
    }

    function later(callback: () => void, delay: number) {
      timers.push(setTimeout(() => {
        if (active && !exiting) callback();
      }, delay));
    }

    function exit() {
      if (!active || exiting || exitCompletedRef.current) return;
      exiting = true;
      timers.forEach(clearTimeout);
      // Freeze the current frame; readiness never waits for an assembly or light loop.
      animations.forEach((animation) => animation.pause());
      const fade = animate(overlay!, [{ opacity: 1 }, { opacity: 0 }],
        prefersReducedMotion ? motion.reduced : motion.exit);
      void fade.finished.then(() => {
        if (!active || exitCompletedRef.current) return;
        exitCompletedRef.current = true;
        overlay!.style.display = "none";
        onExitCompleteRef.current?.();
      }).catch(() => {});
    }

    exitRef.current = exit;
    overlay.style.display = "";
    lightMask.style.opacity = "0";
    message.style.opacity = "0";

    // Derive the mask from the shared icon, so both paths stay owned by that icon.
    const mask = logo.cloneNode(true) as SVGSVGElement;
    mask.removeAttribute("style");
    lightMask.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(
      new XMLSerializer().serializeToString(mask)
    )}")`;

    if (!prefersReducedMotion) {
      // SVG path transforms use viewBox units rather than rendered CSS pixels.
      const offset = (motion.pieceOffset * 16) / motion.logoSize;
      const arrivals = [...logo.querySelectorAll("path")].flatMap((piece, index) => [
        animate(piece, [
          { transform: `translateY(${index === 0 ? -offset : offset}px)` },
          { transform: "translateY(0)" }
        ], motion.assemble),
        animate(piece, [{ opacity: 0 }, { opacity: 1 }], motion.appear)
      ]);

      void Promise.all(arrivals.map((animation) => animation.finished)).then(() => {
        if (!active || exiting) return;
        later(() => {
          animate(light, [
            { transform: WORKSPACE_ENTRY_SPLASH_LIGHT.from },
            { transform: WORKSPACE_ENTRY_SPLASH_LIGHT.to }
          ], { ...motion.light, iterations: Infinity });
          animate(lightMask, [{ opacity: 0 }, { opacity: 1 }], motion.lightAppear);
        }, motion.settledHold);
      }).catch(() => {});
    }
    logo.style.opacity = "1";

    later(() => {
      animate(message, [{ opacity: 0 }, { opacity: 1 }],
        prefersReducedMotion ? motion.reduced : motion.exit);
    }, motion.messageDelay);

    if (readyRef.current) exit();

    return () => {
      active = false;
      exitRef.current = null;
      timers.forEach(clearTimeout);
      animations.forEach((animation) => animation.cancel());
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={overlayRef}
      aria-busy="true"
      aria-label="워크스페이스를 불러오는 중"
      className={cn(
        "fixed inset-0 grid min-h-svh place-items-center overflow-hidden bg-white text-foreground",
        className
      )}
      data-testid={dataTestId}
      role="status"
      style={{ zIndex: "calc(var(--clair-z-index-tooltip) + 1)" }}
    >
      <div className="relative size-[104px]" data-splash-logo="true">
        <WorkspaceLogoMarkIcon
          ref={logoRef}
          aria-hidden="true"
          className="block size-[104px] text-[#C7CCD1]"
          size={104}
          style={{ opacity: 0 }}
        />
        <div
          ref={lightMaskRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-0"
          data-splash-light-mask="true"
          style={{ maskSize: "100% 100%", maskRepeat: "no-repeat" }}
        >
          <div
            ref={lightRef}
            className="absolute -top-[150%] -left-[150%] size-[400%]"
            data-splash-light="true"
            style={{
              background: WORKSPACE_ENTRY_SPLASH_LIGHT.background,
              transform: WORKSPACE_ENTRY_SPLASH_LIGHT.from
            }}
          />
        </div>
      </div>
      <p
        ref={messageRef}
        aria-hidden="true"
        className="emr-text-metadata absolute top-[calc(50%+62px)] w-full px-4 text-center font-medium text-[var(--clair-color-atomic-neutral-500)] opacity-0"
        data-splash-message="true"
      >
        진료 공간을 준비하고 있어요
      </p>
    </div>
  );
}
