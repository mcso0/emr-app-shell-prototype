import { expect, test } from "@playwright/test";
import {
  NAV_RAIL_PANEL_TOGGLE_ENTER_FROM,
  NAV_RAIL_PANEL_TOGGLE_ENTER_TRANSITION,
  NAV_RAIL_PANEL_TOGGLE_EXIT_TO,
  NAV_RAIL_PANEL_TOGGLE_EXIT_TRANSITION,
  NAV_RAIL_PANEL_TOGGLE_REDUCED_EXIT_TO,
  NAV_RAIL_PANEL_TOGGLE_REDUCED_TRANSITION,
  NAV_RAIL_PANEL_TOGGLE_REDUCED_VISIBLE,
  NAV_RAIL_PANEL_TOGGLE_VISIBLE,
} from "../src/shell/nav-rail-motion";

test("nav rail panel toggle uses the approved focus motion contract", () => {
  expect(NAV_RAIL_PANEL_TOGGLE_ENTER_FROM).toEqual({
    height: 0,
    marginBottom: -10,
    opacity: 0,
    y: 4,
    filter: "blur(3px)",
  });
  expect(NAV_RAIL_PANEL_TOGGLE_VISIBLE).toEqual({
    height: "auto",
    marginBottom: 0,
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  });
  expect(NAV_RAIL_PANEL_TOGGLE_EXIT_TO).toEqual({
    height: 0,
    marginBottom: -10,
    opacity: 0,
    y: -3,
    filter: "blur(2px)",
  });
  expect(NAV_RAIL_PANEL_TOGGLE_ENTER_TRANSITION).toEqual({
    duration: 0.18,
    ease: [0.16, 1, 0.3, 1],
  });
  expect(NAV_RAIL_PANEL_TOGGLE_EXIT_TRANSITION).toEqual({
    duration: 0.12,
    ease: [0.4, 0, 1, 1],
  });
});

test("nav rail panel toggle reduced motion is instant", () => {
  expect(NAV_RAIL_PANEL_TOGGLE_REDUCED_VISIBLE).toEqual({
    height: "auto",
    marginBottom: 0,
    opacity: 1,
  });
  expect(NAV_RAIL_PANEL_TOGGLE_REDUCED_EXIT_TO).toEqual({
    height: 0,
    marginBottom: -10,
    opacity: 0,
  });
  expect(NAV_RAIL_PANEL_TOGGLE_REDUCED_TRANSITION).toEqual({ duration: 0 });
});
