import type { Transition } from "framer-motion";

// Mirrors --emr-navrail-content-gap so its removal does not snap the home item.
const NAV_RAIL_CONTENT_GAP_PX = 10;

export const NAV_RAIL_PANEL_TOGGLE_ENTER_FROM = {
  height: 0,
  marginBottom: -NAV_RAIL_CONTENT_GAP_PX,
  opacity: 0,
  y: 4,
  filter: "blur(3px)",
};

export const NAV_RAIL_PANEL_TOGGLE_VISIBLE = {
  height: "auto",
  marginBottom: 0,
  opacity: 1,
  y: 0,
  filter: "blur(0px)",
};

export const NAV_RAIL_PANEL_TOGGLE_EXIT_TO = {
  height: 0,
  marginBottom: -NAV_RAIL_CONTENT_GAP_PX,
  opacity: 0,
  y: -3,
  filter: "blur(2px)",
};

export const NAV_RAIL_PANEL_TOGGLE_ENTER_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1],
};

export const NAV_RAIL_PANEL_TOGGLE_EXIT_TRANSITION: Transition = {
  duration: 0.12,
  ease: [0.4, 0, 1, 1],
};

export const NAV_RAIL_PANEL_TOGGLE_REDUCED_VISIBLE = {
  height: "auto",
  marginBottom: 0,
  opacity: 1,
};

export const NAV_RAIL_PANEL_TOGGLE_REDUCED_EXIT_TO = {
  height: 0,
  marginBottom: -NAV_RAIL_CONTENT_GAP_PX,
  opacity: 0,
};

export const NAV_RAIL_PANEL_TOGGLE_REDUCED_TRANSITION: Transition = {
  duration: 0,
};
