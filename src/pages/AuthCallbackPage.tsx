import React from "react";

// Popup-only auth callback page.
// IMPORTANT: Do NOT call `handleRedirectPromise()` here.

export default function AuthCallbackPage() {
  React.useEffect(() => {
    // Nudge the opener to re-check auth state.
    try {
      window.opener?.postMessage({ type: "msal:auth:complete" }, window.location.origin);
    } catch {
      // ignore
    }

    // Don't close immediately. The opener needs time to poll this window's URL
    // and complete MSAL popup processing.
    const t = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }
    }, 4000);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      <h3>Authentication complete</h3>
      <p>You can close this window and return to the portal.</p>
    </div>
  );
}
