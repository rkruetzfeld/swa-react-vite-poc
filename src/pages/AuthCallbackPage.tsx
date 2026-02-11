import React from "react";
import { useMsal } from "@azure/msal-react";

/**
 * AuthCallbackPage
 * - Used as the MSAL redirectUri for popup flows.
 * - Processes the auth response and closes the popup (if opened as a popup).
 */
export default function AuthCallbackPage() {
  const { instance } = useMsal();

  React.useEffect(() => {
    (async () => {
      try {
        await instance.initialize();
        await instance.handleRedirectPromise();

        // If this is a popup window, close it after completing auth.
        if (window.opener) {
          window.close();
          return;
        }

        // Otherwise, return home.
        window.location.replace("/");
      } catch (e: any) {
        // Minimal, readable error in the callback window
        document.body.innerHTML =
          '<div style="padding:16px;font-family:Segoe UI, Arial">' +
          "<h3>Authentication callback error</h3>" +
          `<pre style="white-space:pre-wrap">${String(e?.message ?? e)}</pre>` +
          "</div>";
      }
    })();
  }, [instance]);

  return <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>Completing sign-in…</div>;
}
