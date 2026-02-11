// src/pages/AuthCallbackPage.tsx
import React, { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { pca } from "../auth/pca";

/**
 * Popup callback page:
 * - In popup-only mode we don't rely on redirect processing,
 *   but this page can still be used as a safe landing spot.
 * - If opened in a popup, it attempts to close itself.
 */
export default function AuthCallbackPage() {
  const { instance } = useMsal();

  useEffect(() => {
    (async () => {
      try {
        // In case any redirect response exists (defensive), process it.
        const result = await instance.handleRedirectPromise();
        if (result?.account) {
          pca.setActiveAccount(result.account);
        }
      } catch {
        // ignore
      } finally {
        // If this is a popup window, try to close after a tick.
        try {
          if (window.opener) {
            setTimeout(() => window.close(), 50);
          }
        } catch {
          // ignore
        }
      }
    })();
  }, [instance]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Authentication complete</h2>
      <p>You can close this window and return to the portal.</p>
    </div>
  );
}
