// src/auth/msalConfig.ts
import type { Configuration } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string;
const clientId = import.meta.env.VITE_AAD_SPA_CLIENT_ID as string;
const apiScope = import.meta.env.VITE_AAD_API_SCOPE as string;

if (!tenantId) throw new Error("Missing VITE_AAD_TENANT_ID");
if (!clientId) throw new Error("Missing VITE_AAD_SPA_CLIENT_ID");
if (!apiScope) throw new Error("Missing VITE_AAD_API_SCOPE");

/**
 * Dedicated callback route.
 * This keeps the popup lightweight and avoids rendering the full app in the popup window.
 *
 * IMPORTANT: Add this exact URL to Entra App Registration -> Authentication -> Redirect URIs:
 *   https://<your-domain>/auth-callback
 */
const redirectUri = `${window.location.origin}/auth-callback`;

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
