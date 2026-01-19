import React from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./msalConfig";

/**
 * Blocks the app until the user is authenticated.
 * Uses redirect flow to align with SWA hosting.
 */
export default function AuthGate(props: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { instance, inProgress } = useMsal();

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h2 style={{ marginBottom: 8 }}>Sign in</h2>
        <p style={{ marginTop: 0 }}>
          You must sign in to use the portal.
        </p>

        <button
          onClick={() => instance.loginRedirect(loginRequest)}
          disabled={inProgress !== "none"}
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  return <>{props.children}</>;
}
