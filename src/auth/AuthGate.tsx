import React from "react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "./msalConfig";

function isInIframe(): boolean {
  try {
    // frameElement is the most reliable indicator
    return window.self !== window.top || !!window.frameElement;
  } catch {
    return true;
  }
}

function urlLooksLikeAuthResponse(): boolean {
  const h = window.location.hash || "";
  const q = window.location.search || "";
  // MSAL responses often contain these
  return /code=|id_token=|access_token=|state=|error=/.test(h) || /code=|state=|error=/.test(q);
}

function breakoutToTopLevel() {
  const target = window.location.href;
  try {
    window.top!.location.assign(target);
  } catch {
    window.location.assign(target);
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
        await instance.initialize();

        // Only process redirect responses if the URL looks like one.
        // Prevents "Signing you in..." hang in embedded contexts.
        if (urlLooksLikeAuthResponse()) {
          await instance.handleRedirectPromise();
        }

        const acct =
          instance.getActiveAccount() ??
          accounts[0] ??
          instance.getAllAccounts()[0] ??
          null;

        if (acct) instance.setActiveAccount(acct);

        if (mounted) setReady(true);
      } catch (e: any) {
        if (mounted) setErr(String(e?.message ?? e));
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  const active =
    instance.getActiveAccount() ??
    accounts[0] ??
    instance.getAllAccounts()[0] ??
    null;

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
    return (
      <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
        Signing you in...
      </div>
    );
  }

  if (active) {
    return <>{children}</>;
  }

  const signInPopup = async () => {
    setErr(null);
    try {
      // Must be directly user-initiated to avoid popup blocking
      const res = await instance.loginPopup(loginRequest);
      if (res?.account) instance.setActiveAccount(res.account);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setErr(msg);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      <div style={{ marginBottom: 10 }}>You’re not signed in.</div>

      <button
        onClick={signInPopup}
        disabled={inProgress !== "none"}
        style={{ padding: "10px 14px", cursor: "pointer" }}
      >
        Sign in (popup)
      </button>

      {isInIframe() && (
        <>
          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
            If the popup completes but the iframe can’t finalize sign-in, open
            the portal top-level and sign in there.
          </div>
          <button
            onClick={breakoutToTopLevel}
            style={{ padding: "10px 14px", marginTop: 12, cursor: "pointer" }}
          >
            Open in a new window
          </button>
        </>
      )}
    </div>
  );
}
