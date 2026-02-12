import React from "react";

/**
 * IMPORTANT:
 * This app uses **popup-only** auth (loginPopup / acquireTokenPopup).
 *
 * The popup flow does NOT need handleRedirectPromise().
 * Calling handleRedirectPromise() here causes MSAL to try to process the
 * popup response as a "redirect" response and can throw:
 *   no_token_request_cache_error
 *
 * This page is only a friendly landing page for the popup redirectUri.
 */
export default function AuthCallbackPage() {
  const [canClose, setCanClose] = React.useState(true);

  React.useEffect(() => {
    // Try to close quickly (works in most popup scenarios)
    const t = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }
      // If still open after attempting to close, show the button.
      window.setTimeout(() => {
        if (!window.closed) setCanClose(false);
      }, 250);
    }, 100);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      <h3>Authentication complete</h3>
      <div>You can close this window and return to the portal.</div>

      {!canClose && (
        <button
          onClick={() => {
            try {
              window.close();
            } catch {
              // ignore
            }
          }}
          style={{ padding: "10px 14px", marginTop: 12, cursor: "pointer" }}
        >
          Close window
        </button>
      )}
    </div>
  );
}
