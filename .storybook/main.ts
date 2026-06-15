import type { StorybookConfig } from "@storybook/nextjs-vite";

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
  ],
  framework: "@storybook/nextjs-vite",
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
