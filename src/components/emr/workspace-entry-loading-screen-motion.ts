export const WORKSPACE_ENTRY_SPLASH_MOTION = {
  initial: { opacity: 0, scale: 0.85 },
  full: { opacity: 1, scale: 1 },
  low: { opacity: 0.5, scale: 0.92 },
  enter: { duration: 0.6, ease: "easeOut" },
  pulseLeg: { duration: 0.8, ease: "easeInOut" },
  exit: { duration: 0.18, ease: "easeOut" },
  reduced: { duration: 0 }
} as const;
