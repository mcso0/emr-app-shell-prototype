import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".vercel/**",
    ".worktrees/**",
    "coverage/**",
    "playwright-report/**",
    "storybook-static/**",
    "test-results/**",
    "next-env.d.ts",
    "lottie-ai-chart-writing/**",
  ]),
  ...storybook.configs["flat/recommended"],
]);

export default eslintConfig;
