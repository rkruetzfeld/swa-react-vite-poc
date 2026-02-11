import React from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./msalConfig";

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function breakoutToTopLevel() {
  try {
    window.top!.location.assign(window.location.href);
  } catch {
    window.location.assign(window.location.href);
  }
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const [ready, setReady] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Ensure MSAL is initialized and any redirect response is processed
        await instance.initialize();
        await instance.handleRedirectPromise();

        // Pick an account if present
        const acct = instance.getActiveAccount() ?? accounts[0] ?? instance.getAllAccounts()[0];
        if (acct) instance.setActiveAccount(acct);

        if (mounted) setReady(true);
      } catch (e: any) {
        if (mounted) setErr(String(e?.message ?? e));
      }
    })();

    return () => {
      mounted = false;
    };
    // accounts intentionally NOT in deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  const active = instance.getActiveAccount() ?? accounts[0] ?? instance.getAllAccounts()[0];

  if (err) {
    return (
      <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
        <h3>Authentication error</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{err}</pre>
        {isInIframe() && (
          <button
            onClick={breakoutToTopLevel}
            style={{ padding: "10px 14px", marginTop: 12, cursor: "pointer" }}
          >
            Open in a new window
          </button>
        )}
      </div>
    );
  }

  if (!ready) {
    return <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>Signing you in...</div>;
  }

  if (active) {
    return <>{children}</>;
  }

  const doLogin = async () => {
    setErr(null);
    try {
      // In iframe: popup login is required
      await instance.loginPopup(loginRequest);
      const acct = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
      if (acct) instance.setActiveAccount(acct);
      // ready already true; rerender will show children
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      // If popup blocked, break out to top-level
      if (isInIframe() && msg.toLowerCase().includes("popup")) {
        breakoutToTopLevel();
        return;
      }

      setErr(msg);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      <div style={{ marginBottom: 10 }}>You’re not signed in.</div>
      <button onClick={doLogin} disabled={inProgress !== "none"} style={{ padding: "10px 14px", cursor: "pointer" }}>
        Sign in
      </button>
      {isInIframe() && (
        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          If the sign-in popup is blocked, use “Open in a new window”.
        </div>
      )}
      {isInIframe() && (
        <button
          onClick={breakoutToTopLevel}
          style={{ padding: "10px 14px", marginTop: 12, cursor: "pointer" }}
        >
          Open in a new window
        </button>
      )}
    </div>
  );
}
