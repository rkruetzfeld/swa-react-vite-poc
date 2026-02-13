import { type Configuration, LogLevel } from "@azure/msal-browser";

/**
 * MSAL configuration rebuilt for **popup-only** auth.
 *
 * Key idea:
 * - The popup must land on a static HTML page (no SPA router, no JS that mutates the URL).
 * - We use `popupRedirectUri: /auth-popup.html` which lives in /public so Vite ships it verbatim.
 * - We DO NOT call handleRedirectPromise() anywhere.
 */

const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string;
const clientId = import.meta.env.VITE_AAD_SPA_CLIENT_ID as string;

// Your API scope can be either:
// - an `api://<clientId>/<scopeName>` style scope, OR
// - a fully qualified scope on another app registration.
const apiScope = import.meta.env.VITE_AAD_API_SCOPE as string;

// Keep these purely origin-based for SWA.
const origin = window.location.origin;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,

    // Main app stays on the origin.
    redirectUri: `${origin}/auth-popup.html`,
    postLogoutRedirectUri: origin,

    // IMPORTANT: popup returns here (static page).
    popupRedirectUri: `${origin}/auth-popup.html`,

    // Keep SPA on the same route after login.
    navigateToLoginRequestUrl: false,
  },
  cache: {
    // LocalStorage is simplest for SWA + popups.
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Info,
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii) return;
        // Uncomment if you want noisy debugging.
        // console.log(`[msal] ${message}`);
      },
    },
  },
};

export const loginRequest = {
  // Request OpenID scopes + your API scope.
  // MSAL adds `openid profile offline_access` automatically for login,
  // but including them doesn't hurt.
  scopes: ["openid", "profile", "offline_access", apiScope].filter(Boolean),

  // Force the popup to use our static redirect.
  redirectUri: `${origin}/auth-popup.html`,
};
