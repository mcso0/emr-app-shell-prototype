import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { WORKSPACE_ENTRY_SPLASH_MOTION } from "../src/components/emr/workspace-entry-loading-screen-motion";

test("workspace entry splash keeps the approved motion contract", () => {
  expect(WORKSPACE_ENTRY_SPLASH_MOTION).toEqual({
    initial: { opacity: 0, scale: 0.85 },
    full: { opacity: 1, scale: 1 },
    low: { opacity: 0.5, scale: 0.92 },
    enter: { duration: 0.6, ease: "easeOut" },
    pulseLeg: { duration: 0.8, ease: "easeInOut" },
    exit: { duration: 0.18, ease: "easeOut" },
    reduced: { duration: 0 }
  });
});

test("workspace entry splash checks readiness only after returning to full state", () => {
  const source = readFileSync("src/components/emr/workspace-entry-loading-screen.tsx", "utf8");

  const readinessLoopIndex = source.indexOf("while (active && !readyRef.current)");
  const lowStateIndex = source.indexOf("...WORKSPACE_ENTRY_SPLASH_MOTION.low");
  const fullStateIndex = source.indexOf("...WORKSPACE_ENTRY_SPLASH_MOTION.full", lowStateIndex);
  const overlayExitIndex = source.indexOf("await overlayControls.start", fullStateIndex);

  expect(readinessLoopIndex).toBeGreaterThan(-1);
  expect(lowStateIndex).toBeGreaterThan(readinessLoopIndex);
  expect(fullStateIndex).toBeGreaterThan(lowStateIndex);
  expect(overlayExitIndex).toBeGreaterThan(fullStateIndex);
  expect(source).not.toContain("repeat: Infinity");
  expect(source).toContain('transformOrigin: "center center"');
});

test("reduced motion keeps the logo static and exits instantly", () => {
  const source = readFileSync("src/components/emr/workspace-entry-loading-screen.tsx", "utf8");

  expect(source).toContain("if (prefersReducedMotion)");
  expect(source).toContain("logoControls.set(WORKSPACE_ENTRY_SPLASH_MOTION.full)");
  expect(WORKSPACE_ENTRY_SPLASH_MOTION.reduced).toEqual({ duration: 0 });
});
