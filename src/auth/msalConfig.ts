import type { Configuration } from "@azure/msal-browser";

/**
 * Expected env vars (matches your CI):
 * - VITE_AAD_TENANT_ID
 * - VITE_AAD_SPA_CLIENT_ID
 * - VITE_AAD_API_SCOPE
 */

const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string;
const clientId = import.meta.env.VITE_AAD_SPA_CLIENT_ID as string;
const apiScope = import.meta.env.VITE_AAD_API_SCOPE as string;

if (!tenantId) throw new Error("Missing VITE_AAD_TENANT_ID");
if (!clientId) throw new Error("Missing VITE_AAD_SPA_CLIENT_ID");
if (!apiScope) throw new Error("Missing VITE_AAD_API_SCOPE");

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

/**
 * Login scopes (basic profile).
 * Keep this minimal; API scope is in tokenRequest.
 */
export const loginRequest = {
  scopes: ["openid", "profile", "email"],
  prompt: "select_account",
};

/**
 * API token request (what getAccessToken.ts imports).
 */
export const tokenRequest = {
  scopes: [apiScope],
};
