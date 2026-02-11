// src/auth/msalConfig.ts

import type { Configuration } from "@azure/msal-browser";

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

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
  prompt: "select_account",
};

export const tokenRequest = {
  scopes: [apiScope],
};
