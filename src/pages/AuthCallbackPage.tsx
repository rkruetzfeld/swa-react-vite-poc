// src/pages/AuthCallbackPage.tsx
import { useEffect } from "react";
import { pca } from "../auth/pca";

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        // For popup flows, MSAL may still write hash/search response artifacts.
        // handleRedirectPromise() is safe to call; it will no-op if nothing to process.
        await pca.handleRedirectPromise();
      } finally {
        // Always try to close the popup and notify the opener
        try {
          window.opener?.postMessage({ type: "AUTH_POPUP_DONE" }, window.location.origin);
        } catch {}
        window.close();
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, Segoe UI, Arial" }}>
      <h2 style={{ margin: 0 }}>Signing you in…</h2>
      <p style={{ opacity: 0.8 }}>You can close this window if it doesn’t close automatically.</p>
    </div>
  );
}
