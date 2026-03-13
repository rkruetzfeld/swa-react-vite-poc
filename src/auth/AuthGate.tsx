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

function pickAccount(
  instance: {
    getActiveAccount: () => AccountInfo | null;
    getAllAccounts: () => AccountInfo[];
    setActiveAccount: (a: AccountInfo | null) => void;
  },
  accounts: AccountInfo[]
) {
  return instance.getActiveAccount() ?? accounts[0] ?? instance.getAllAccounts()[0] ?? null;
}

function isTimedOutError(e: any): boolean {
  const code = e?.errorCode || e?.code || "";
  const msg = (e?.message || "").toLowerCase();
  return code === "timed_out" || msg.includes("timed_out");
}

export default function AuthGate(props: { children: React.ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();

  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const acct = pickAccount(instance, accounts);
    if (acct) instance.setActiveAccount(acct);
    setReady(true);
  }, [accounts, instance]);

  const active = pickAccount(instance, accounts);

  const signIn = async () => {
    try {
      setError(null);
      if (inProgress !== InteractionStatus.None) return;

      // 1) Try popup first
      const result = await instance.loginPopup({
        ...loginRequest
      });

      if (result?.account) instance.setActiveAccount(result.account);
      window.location.reload();
    } catch (e: any) {
      console.error("loginPopup failed:", e);

      // 2) If popup times out (common in InPrivate), fall back to redirect
      if (isTimedOutError(e)) {
        try {
          await instance.loginRedirect({
            ...loginRequest,
            // redirect flow should return to the SPA
            redirectUri: window.location.origin
          });
          return; // browser will redirect away
        } catch (e2: any) {
          console.error("loginRedirect fallback failed:", e2);
          setError(e2?.message ?? String(e2));
          return;
        }
      }

      setError(e?.message ?? String(e));
    }
  };

  if (error) {
    return (
      <div style={{ padding: 16, fontFamily: "Segoe UI, Arial" }}>
        <h3>Authentication error</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>

        {!active && (
          <button onClick={signIn} style={{ padding: "10px 14px", marginTop: 12, cursor: "pointer" }}>
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
        disabled={inProgress !== InteractionStatus.None}
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