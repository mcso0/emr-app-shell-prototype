import { fn } from "storybook/test";
import type { getBrowserSupabaseClient as getActualBrowserSupabaseClient } from "../client";

// Storybook-only replacement. Stories opt into specific synthetic methods;
// the default never initializes a real Supabase client or auth connection.
export const getBrowserSupabaseClient = fn<typeof getActualBrowserSupabaseClient>(
  () => null,
).mockName("getBrowserSupabaseClient");
