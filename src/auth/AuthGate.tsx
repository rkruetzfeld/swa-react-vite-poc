// src/auth/AuthGate.tsx
import React from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus, type AccountInfo } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

function isInIframe(): boolean {
  try {
    return window.self !== window.top || !!window.frameElement;
  } catch {
    return true;
  }
}

function breakoutToTopLevel() {
  const target = window.location.href;
  try {
    window.top!.location.assign(target);
  } catch {
    window.location.assign(target);
  }
}

function pickAccount(instance: { getActiveAccount: () => AccountInfo | null; getAllAccounts: () => AccountInfo[] }, accounts: AccountInfo[]) {
  return instance.getActiveAccount() ?? accounts[0] ?? instance.getAllAccounts()[0] ?? null;
}

export default function AuthGate(props: { children: React.ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();

  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 1) Keep active account set whenever we discover one
  React.useEffect(() => {
    const acct = pickAccount(instance, accounts);
    if (acct) instance.setActiveAccount(acct);
    setReady(true);
  }, [accounts, instance]);

  const active = pickAccount(instance, accounts);

  const signIn = async () => {
    try {
      setError(null);

      // Avoid multiple overlapping popups.
      if (inProgress !== InteractionStatus.None && inProgress !== "none") return;

      // IMPORTANT:
      // Use a *static* popup redirect page that does not run the SPA/router.
      // This prevents MSAL's popup response from being consumed/rewritten by React Router.
      const popupRedirectUri = `${window.location.origin}/auth-popup.html`;

      const result = await instance.loginPopup({
        ...loginRequest,
        redirectUri: popupRedirectUri,
      });

      if (result?.account) instance.setActiveAccount(result.account);

      // Force a hard refresh so `useMsal()` rehydrates accounts cleanly.
      // (This avoids the "popup closed but UI still says signed-out" loop.)
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? String(e));
    }
  };

  if (error) {
    return (
      <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
        <h3>Authentication error</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
        {!active && (
          <button
            onClick={signIn}
            style={{ padding: "10px 14px", marginTop: 12, cursor: "pointer" }}
          >
            Try sign in again
          </button>
        )}
        {isInIframe() && (
          <button
            onClick={breakoutToTopLevel}
            style={{ padding: "10px 14px", marginTop: 12, marginLeft: 8, cursor: "pointer" }}
          >
            Open in a new window
          </button>
        )}
      </div>
    );
  }

  if (!ready) {
    return <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>Signing you in…</div>;
  }

  if (active) {
    return <>{props.children}</>;
  }

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
      <div style={{ marginBottom: 10 }}>You’re not signed in.</div>
      <button
        onClick={signIn}
        disabled={inProgress !== InteractionStatus.None && inProgress !== "none"}
        style={{ padding: "10px 14px", cursor: "pointer" }}
      >
        Sign in
      </button>
      {isInIframe() && (
        <button
          onClick={breakoutToTopLevel}
          style={{ padding: "10px 14px", marginTop: 12, marginLeft: 8, cursor: "pointer" }}
        >
          Open in a new window
        </button>
      )}
    </div>
  );
}
