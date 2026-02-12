// src/auth/msalConfig.ts
import type { Configuration } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string;
const clientId = import.meta.env.VITE_AAD_SPA_CLIENT_ID as string;
const apiScope = import.meta.env.VITE_AAD_API_SCOPE as string;

if (!tenantId) throw new Error("Missing VITE_AAD_TENANT_ID");
if (!clientId) throw new Error("Missing VITE_AAD_SPA_CLIENT_ID");
if (!apiScope) throw new Error("Missing VITE_AAD_API_SCOPE");

/**
 * For **popup** auth, keep redirectUri at the app origin.
 *
 * Why: if redirectUri points to a SPA route that boots React and calls handleRedirectPromise(),
 * the popup response processing can race/consume MSAL cache and trigger:
 *   no_token_request_cache_error
 *
 * If you want a dedicated callback page, it must be a minimal static page (no React, no MSAL calls)
 * and you must not call handleRedirectPromise() anywhere for popup-only flows.
 */
const redirectUri = window.location.origin;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    // Avoid "bounce back" loops after auth completes
    navigateToLoginRequestUrl: false,
  },
  cache: {
    // More reliable for SPA auth across reloads (including embedded)
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    // Safety: never allow redirect in an iframe
    allowRedirectInIframe: false,
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
  prompt: "select_account",
};

export const tokenRequest = {
  scopes: [apiScope],
};
