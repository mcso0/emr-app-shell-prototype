import type { StorybookConfig } from "@storybook/nextjs-vite";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-vitest",
    "@storybook/addon-docs",
    {
      name: "@storybook/addon-mcp",
      options: {
        toolsets: {
          dev: true,
          docs: true,
          test: true,
        },
      },
    },
    fileURLToPath(new URL("./emr-data-table-manifest.preset.ts", import.meta.url)),
    fileURLToPath(new URL("./story-example-manifests.preset.ts", import.meta.url)),
    fileURLToPath(new URL("./catalog-source-manifests.preset.ts", import.meta.url)),
  ],
  framework: "@storybook/nextjs-vite",
  viteFinal: async (config) => mergeConfig(config, {
    // Tailwind flattens Pretendard's CSS import before Vite rebases its font URL.
    // Resolve that exact asset in both dev and static Storybook builds.
    resolve: { alias: { "./woff2/PretendardVariable.woff2": fileURLToPath(new URL("../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2", import.meta.url)) } },
    // New catalog entries must not trigger a mid-play dependency reload.
    optimizeDeps: { include: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities", "next/dynamic", "@tanstack/react-virtual", "cmdk", "react-resizable-panels", "sonner", "lucide-react", "react-dom"] },
    plugins: [{
      name: "clair-storybook-next-navigation",
      enforce: "post",
      config: () => ({
        resolve: {
          alias: {
            "next/navigation": fileURLToPath(new URL("./next-navigation-shim.ts", import.meta.url)),
            "next/link": fileURLToPath(new URL("./next-link-shim.tsx", import.meta.url)),
          },
        },
      }),
    }],
  }),
  staticDirs: ["../public"],
  typescript: {
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
};
export default config;
