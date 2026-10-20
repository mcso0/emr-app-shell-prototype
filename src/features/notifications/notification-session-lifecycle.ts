import { getBrowserSupabaseClient } from "@/lib/supabase/client";

// Disposal runs in the auth callback, before React cleanup or a late response.
// Tokens stay in SDK/local memory and never enter notification messages.
export function subscribeNotificationSessionLifecycle({
  onEnd, onChange,
}: { onEnd: () => void; onChange: () => void }) {
  const client = getBrowserSupabaseClient();
  let lastToken: string | undefined;
  let ended = false;
  const end = () => { ended = true; lastToken = undefined; onEnd(); };
  window.addEventListener("clair:session-ended", end);
  const subscription = client?.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || event === "PASSWORD_RECOVERY") {
      end();
    } else if (event === "SIGNED_IN") {
      const changed = ended || (lastToken !== undefined && lastToken !== session?.access_token);
      ended = false;
      lastToken = session?.access_token;
      if (changed) onChange();
    } else if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
      lastToken = session?.access_token;
      if (!session) end();
    }
  }).data.subscription;
  return () => {
    window.removeEventListener("clair:session-ended", end);
    subscription?.unsubscribe();
  };
}
