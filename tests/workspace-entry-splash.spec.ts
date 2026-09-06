import { expect, test } from "@playwright/test";
import {
  WORKSPACE_ENTRY_SPLASH_LIGHT,
  WORKSPACE_ENTRY_SPLASH_MOTION
} from "../src/components/emr/workspace-entry-loading-screen-motion";

test("the light band starts and resets entirely outside the logo slot", () => {
  const [dx, dy] = WORKSPACE_ENTRY_SPLASH_LIGHT.to.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const distance = Math.hypot(dx, dy);
  const slotProjection = WORKSPACE_ENTRY_SPLASH_MOTION.logoSize * (dx + dy) / distance;
  const stops = [...WORKSPACE_ENTRY_SPLASH_LIGHT.background.matchAll(/calc\(50% \+ (-?[\d.]+)px\)/g)]
    .map((match) => Number(match[1]));
  const bandHalfWidth = Math.max(...stops.map(Math.abs));

  // Even the full square (larger than the visible mark) must be clear of the band.
  expect(distance - bandHalfWidth).toBeGreaterThan(slotProjection / 2);
  const [startX, startY] = WORKSPACE_ENTRY_SPLASH_LIGHT.from.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  expect(startX).toBe(-dx);
  expect(startY).toBe(-dy);
  expect(dx).toBeGreaterThan(0);
  expect(dy).toBeGreaterThan(dx);
});
