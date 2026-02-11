// src/auth/AuthGate.tsx
import React, { useEffect, useRef, useState } from "react";
import { useMsal } from "@azure/msal-react";
import {
  InteractionRequiredAuthError,
  BrowserAuthError,
  EventType,
  type AuthenticationResult,
} from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

/**
 * AuthGate:
 * - If user already signed in: render children
 * - If not signed in:
 *    - In iframe => loginPopup() (never redirect)
 *    - Top-level => loginRedirect()
 *
 * This prevents: BrowserAuthError: redirect_in_iframe
 */
export default function AuthGate(props: { children: React.ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef(false);

  function isInIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      // cross-origin access throws => assume iframe
      return true;
    }
  }

  function breakoutToTopLevel(): void {
    // Best-effort escape: if the host blocks popups, we need a top-level navigation.
    // Add a marker to avoid repeated breakout attempts.
    const url = new URL(window.location.href);
    if (!url.searchParams.has("breakout")) {
      url.searchParams.set("breakout", "1");
    }

    try {
      window.top!.location.assign(url.toString());
    } catch {
      window.location.assign(url.toString());
    }
  }

  useEffect(() => {
    // Ensure we capture accounts when MSAL completes login (popup/redirect)
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

  useEffect(() => {
    // 1) Always process redirect response if present (no-op for popup)
    // 2) If no account, begin login (popup in iframe, redirect otherwise)
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const redirectResult = await instance.handleRedirectPromise();
        if (redirectResult?.account) {
          instance.setActiveAccount(redirectResult.account);
        } else if (!instance.getActiveAccount() && accounts.length > 0) {
          instance.setActiveAccount(accounts[0]);
        }

        const active = instance.getActiveAccount() ?? (accounts[0] ?? null);

        if (active) {
          setReady(true);
          return;
        }

        // If MSAL is already doing something, wait for it.
        if (inProgress !== "none") {
          // We'll re-check on the next render tick
          setReady(false);
          return;
        }

        if (isInIframe()) {
          // ✅ iframe-safe
          try {
            const res = await instance.loginPopup(loginRequest);
            if (res?.account) instance.setActiveAccount(res.account);
            setReady(true);
            return;
          } catch (e: any) {
            // Popup blocked or disallowed => breakout to top-level
            const msg = String(e?.message ?? e);
            const looksBlocked =
              msg.toLowerCase().includes("popup") ||
              msg.toLowerCase().includes("block") ||
              msg.toLowerCase().includes("window");

            if (looksBlocked || e instanceof BrowserAuthError) {
              breakoutToTopLevel();
              return; // navigation
            }

            throw e;
          }
        }

        // ✅ top-level redirect is fine
        await instance.loginRedirect(loginRequest);
        // control returns after redirect; do not setReady(true) here
      } catch (e: any) {
        // If token acquisition triggers interaction requirement, route properly
        if (e instanceof InteractionRequiredAuthError) {
          try {
            if (isInIframe()) {
              try {
                const res = await instance.loginPopup(loginRequest);
                if (res?.account) instance.setActiveAccount(res.account);
                setReady(true);
                return;
              } catch (e3: any) {
                const msg = String(e3?.message ?? e3);
                const looksBlocked =
                  msg.toLowerCase().includes("popup") ||
                  msg.toLowerCase().includes("block") ||
                  msg.toLowerCase().includes("window");
                if (looksBlocked || e3 instanceof BrowserAuthError) {
                  breakoutToTopLevel();
                  return;
                }
                throw e3;
              }
            }

            await instance.loginRedirect(loginRequest);
            return;
          } catch (e2: any) {
            setError(String(e2?.message ?? e2));
            return;
          }
        }

        setError(String(e?.message ?? e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  // If an account arrives later (event callback), unlock UI
  useEffect(() => {
    const active = instance.getActiveAccount() ?? (accounts[0] ?? null);
    if (active) setReady(true);
  }, [accounts, instance]);

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h3>Authentication error</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  if (!ready) {
    return <div style={{ padding: 16 }}>Signing you in…</div>;
  }

  return <>{props.children}</>;
}
