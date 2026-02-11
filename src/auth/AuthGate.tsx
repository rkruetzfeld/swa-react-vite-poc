// src/auth/AuthGate.tsx
import React from "react";
import { useMsal } from "@azure/msal-react";
import { EventType, type AuthenticationResult } from "@azure/msal-browser";
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

export default function AuthGate(props: { children: React.ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Capture successful login and set active account
  React.useEffect(() => {
    const cbId = instance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS &&
        event.payload &&
        (event.payload as AuthenticationResult).account
      ) {
        const acct = (event.payload as AuthenticationResult).account!;
        instance.setActiveAccount(acct);
      }
    });

    return () => {
      if (cbId) instance.removeEventCallback(cbId);
    };
  }, [instance]);

  // Mark ready once we have an account
  React.useEffect(() => {
    const acct =
      instance.getActiveAccount() ?? accounts[0] ?? instance.getAllAccounts()[0] ?? null;
    if (acct) {
      instance.setActiveAccount(acct);
      setReady(true);
    } else {
      setReady(true);
    }
  }, [accounts, instance]);

  const active =
    instance.getActiveAccount() ?? accounts[0] ?? instance.getAllAccounts()[0] ?? null;

  const signIn = async () => {
    setError(null);
    try {
      // Popup works in iframe + top-level, and avoids redirect-in-iframe.
      const res = await instance.loginPopup(loginRequest);
      if (res?.account) instance.setActiveAccount(res.account);
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      // If popup fails in iframe, offer breakout fallback
      if (isInIframe() && msg.toLowerCase().includes("popup")) {
        breakoutToTopLevel();
        return;
      }

      setError(msg);
    }
  };

  if (error) {
    return (
      <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
        <h3>Authentication error</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
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
        disabled={inProgress !== "none"}
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
