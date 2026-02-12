// src/pages/AuthCallbackPage.tsx
import React from "react";
import { pca } from "../auth/pca";

// This page is used as the MSAL redirectUri for popup (and redirect) flows.
// In popup flow, it loads inside the popup window. We process the response,
// notify the opener, then close.
export default function AuthCallbackPage() {
  const [status, setStatus] = React.useState<"working" | "done" | "error">(
    "working"
  );
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await pca.handleRedirectPromise();

        // If we got an auth response, set an active account for convenience.
        if (result?.account) {
          pca.setActiveAccount(result.account);
        } else {
          // If there wasn't a response, still try to set an account if one exists.
          const acct = pca.getActiveAccount() ?? pca.getAllAccounts()[0];
          if (acct) pca.setActiveAccount(acct);
        }

        // Let the opener know to re-check accounts.
        try {
          window.opener?.postMessage({ type: "msal:auth:complete" }, window.location.origin);
        } catch {
          // ignore
        }

        if (cancelled) return;
        setStatus("done");
        setMessage("You can close this window and return to the portal.");

        // Give the opener a moment to process the message, then close.
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 250);
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;
        setStatus("error");
        setMessage(String(e?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "error") {
    return (
      <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
        <h3>Authentication error</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
        <h2>Authentication complete</h2>
        <div>{message}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      Processing sign-in…
    </div>
  );
}
