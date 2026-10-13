// Change this revision when replacing the approved app-icon assets so installed
// web apps can recognize an icon identity update instead of reusing cached URLs.
export const APP_ICON_REVISION = "20261013";

export const APP_ICON_URLS = {
  small: `/pwa-icon-192.png?v=${APP_ICON_REVISION}`,
  large: `/pwa-icon-512.png?v=${APP_ICON_REVISION}`,
  master: `/pwa-icon-1024.png?v=${APP_ICON_REVISION}`,
  maskable: `/pwa-maskable-512.png?v=${APP_ICON_REVISION}`,
  apple: `/apple-touch-icon.png?v=${APP_ICON_REVISION}`,
} as const;
