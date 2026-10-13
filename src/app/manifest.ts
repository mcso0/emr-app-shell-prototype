import type { MetadataRoute } from "next";
import { APP_ICON_URLS } from "@/lib/app-icons";

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
        src: APP_ICON_URLS.small,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: APP_ICON_URLS.large,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: APP_ICON_URLS.master,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: APP_ICON_URLS.maskable,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
