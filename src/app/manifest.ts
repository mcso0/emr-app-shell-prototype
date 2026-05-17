import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CLAiR EMR",
    short_name: "CLAiR",
    description: "Dense EMR workspace shell prototype for menu, panels, tables, and drawers.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#E9ECF2",
    theme_color: "#18181B",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
