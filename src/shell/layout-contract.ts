const SHELL_GAP = 10;
const NAV_RAIL_WIDTH = 56;
const MODULE_SIDE_PANEL_WIDTH = 296;

export const SHELL_LAYOUT = {
  shell: {
    gap: SHELL_GAP,
    bodyPadding: SHELL_GAP,
  },
  navRailWidth: NAV_RAIL_WIDTH,
  topMenuHeight: 44,
  navigationColumn: {
    collapsedWidth: NAV_RAIL_WIDTH,
    openWidth: NAV_RAIL_WIDTH + SHELL_GAP + MODULE_SIDE_PANEL_WIDTH,
  },
  moduleSidePanel: {
    minWidth: MODULE_SIDE_PANEL_WIDTH,
    defaultWidth: MODULE_SIDE_PANEL_WIDTH,
  },
  contentAside: {
    minWidth: 280,
    defaultWidth: 280,
  },
  rightPanel: {
    defaultWidth: 316,
  },
  drawer: {
    defaultWidth: 460,
    largeWidth: 708,
    zIndex: 40,
  },
} as const;
