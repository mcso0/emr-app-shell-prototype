"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import { cn } from "@/lib/utils";

type EmrMotionIconProps = {
  animationData: unknown;
  autoplay?: boolean;
  className?: string;
  loop?: boolean;
  playSignal?: number;
};

export function EmrMotionIcon({
  animationData,
  autoplay = true,
  className,
  loop = true,
  playSignal,
}: EmrMotionIconProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const lastPlaySignalRef = useRef(playSignal);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let mounted = true;

    async function loadAnimation() {
      const container = containerRef.current;
      if (!container) return;

      const lottie = await import("lottie-web");
      if (!mounted) return;

      animationRef.current?.destroy();
      animationRef.current = lottie.default.loadAnimation({
        animationData,
        autoplay: autoplay && !prefersReducedMotion,
        container,
        loop: prefersReducedMotion ? false : loop,
        renderer: "svg",
        rendererSettings: {
          preserveAspectRatio: "xMidYMid meet",
        },
      });

      if (prefersReducedMotion || !autoplay) {
        animationRef.current.goToAndStop(0, true);
      }
    }

    void loadAnimation();

    return () => {
      mounted = false;
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [animationData, autoplay, loop, prefersReducedMotion]);

  useEffect(() => {
    if (playSignal === undefined || lastPlaySignalRef.current === playSignal) return;

    lastPlaySignalRef.current = playSignal;

    const animation = animationRef.current;
    if (!animation) return;

    if (prefersReducedMotion) {
      animation.goToAndStop(0, true);
      return;
    }

    animation.goToAndPlay(0, true);
  }, [playSignal, prefersReducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none size-14 shrink-0", className)}
      ref={containerRef}
    />
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");

    function handleChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches);
    }

    query.addEventListener("change", handleChange);

    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
