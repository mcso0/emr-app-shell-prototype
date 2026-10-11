import type { Preview } from "@storybook/nextjs-vite";
import { sb } from "storybook/test";

import "../src/app/globals.css";

// All catalog examples use synthetic fixtures; never initialize a live client.
sb.mock("../src/lib/supabase/client.ts");
sb.mock("../src/lib/kakao-postcode.ts");

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
