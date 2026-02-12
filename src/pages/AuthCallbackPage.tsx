import React from "react";

/**
 * This route exists only for backwards compatibility.
 *
 * IMPORTANT:
 * - Do NOT call handleRedirectPromise() here.
 * - Do NOT manipulate window.location.hash.
 *
 * For popup auth, MSAL (in the opener window) watches the popup URL and processes the
 * response itself. Rendering the full SPA (or calling redirect handlers) here can break
 * the popup handshake and trigger `no_token_request_cache_error`.
 */
export default function AuthCallbackPage() {
  React.useEffect(() => {
    try {
      // Best-effort: notify opener that we reached the callback page.
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "msal:popup:callback-reached" }, window.location.origin);
      }
    } catch {
      // ignore
    }

    // Give MSAL a moment to finish its polling/processing, then close.
    const t = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }
    }, 750);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      <h2>Authentication complete</h2>
      <div>You can close this window and return to the portal.</div>
    </div>
  );
}
