// src/auth/AuthGate.tsx
import React from "react";
import { useMsal } from "@azure/msal-react";
import {
  EventType,
  InteractionStatus,
  type AuthenticationResult,
  type AccountInfo,
} from "@azure/msal-browser";
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

  // Simple rerender trigger when auth state changes outside of React (popup, storage updates, etc.)
  const [, bump] = React.useReducer((n) => n + 1, 0);

  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 1) Keep active account set whenever we discover one
  React.useEffect(() => {
    const acct = pickAccount(instance, accounts);
    if (acct) instance.setActiveAccount(acct);
    setReady(true);
  }, [accounts, instance]);

  // 2) MSAL event callbacks (login/token success) => set active account + rerender
  React.useEffect(() => {
    const cbId = instance.addEventCallback((event) => {
      if (
        (event.eventType === EventType.LOGIN_SUCCESS ||
          event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) &&
        event.payload
      ) {
        const payload = event.payload as AuthenticationResult;
        if (payload.account) instance.setActiveAccount(payload.account);
        bump();
      }
    });

    return () => {
      if (cbId) instance.removeEventCallback(cbId);
    };
  }, [instance]);

  // 3) Popup completion page posts a message back to the opener.
  //    This is the most reliable way to flip the UI immediately.
  React.useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (!ev.data || typeof ev.data !== "object") return;
      const data = ev.data as { type?: string };
      if (data.type !== "msal:auth:complete") return;

      const acct = pickAccount(instance, accounts);
      if (acct) instance.setActiveAccount(acct);
      bump();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [accounts, instance]);

  const active = pickAccount(instance, accounts);

  const signIn = async () => {
    try {
      setError(null);

      // Avoid multiple overlapping popups.
      if (inProgress !== InteractionStatus.None && inProgress !== "none") return;

      const result = await instance.loginPopup(loginRequest);
      if (result?.account) {
        instance.setActiveAccount(result.account);
      }
      bump();
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
