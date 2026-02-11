// src/pages/AuthCallbackPage.tsx
import React from "react";

export default function AuthCallbackPage() {
  React.useEffect(() => {
    // If this page was opened as a popup, try to close it automatically.
    try {
      if (window.opener) {
        // Let the opener continue; we don't need to postMessage because MSAL
        // handles the token cache in the same origin storage.
        window.close();
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      <h2>Authentication complete</h2>
      <div>You can close this window and return to the portal.</div>
    </div>
  );
}
