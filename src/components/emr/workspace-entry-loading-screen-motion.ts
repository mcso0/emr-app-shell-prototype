export const WORKSPACE_ENTRY_SPLASH_MOTION = {
  logoSize: 104,
  pieceOffset: 10,
  assemble: { duration: 640, easing: "cubic-bezier(0, 0, 0.3, 1)" },
  appear: { duration: 320, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
  settledHold: 220,
  light: { duration: 2600, easing: "linear" },
  lightAppear: { duration: 900, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
  messageDelay: 2000,
  exit: { duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  reduced: { duration: 0 }
} as const;

const angle = (25 * Math.PI) / 180;
const bandWidth = WORKSPACE_ENTRY_SPLASH_MOTION.logoSize * 1.5;
// Project the entire icon slot onto the travel axis, then add the band and a gap.
// Both loop endpoints are outside the mask, so the reset is never visible.
const halfTravel =
  (WORKSPACE_ENTRY_SPLASH_MOTION.logoSize * (Math.sin(angle) + Math.cos(angle)) +
    bandWidth) / 2 + 8;
const dx = halfTravel * Math.sin(angle);
const dy = halfTravel * Math.cos(angle);
const stops = Array.from({ length: 65 }, (_, step) => {
  const alpha = 0.9 * Math.pow(0.5 - 0.5 * Math.cos((step / 64) * Math.PI * 2), 0.8);
  const offset = (step / 64 - 0.5) * bandWidth;
  return `rgba(224, 227, 230, ${alpha.toFixed(4)}) calc(50% + ${offset.toFixed(3)}px)`;
});

export const WORKSPACE_ENTRY_SPLASH_LIGHT = {
  background: `linear-gradient(155deg, ${stops.join(",")})`,
  from: `translate(${-dx}px, ${-dy}px)`,
  to: `translate(${dx}px, ${dy}px)`
} as const;
