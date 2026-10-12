import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        optimizeDeps: {
          include: [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
            'next/dynamic',
            '@tanstack/react-virtual',
            '@base-ui/react/checkbox',
            '@base-ui/react/dialog',
            '@base-ui/react/menu',
            '@base-ui/react/popover',
            '@base-ui/react/radio',
            '@base-ui/react/radio-group',
            '@base-ui/react/select',
            '@base-ui/react/separator',
            '@base-ui/react/switch',
            '@base-ui/react/tabs',
            '@base-ui/react/tooltip',
            'input-otp',
            'cmdk',
            'react-resizable-panels',
            'sonner',
            'lucide-react',
            'react-dom',
          ],
        },
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
