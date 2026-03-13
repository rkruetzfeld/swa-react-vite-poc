import { type Configuration, LogLevel } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string;
const clientId = import.meta.env.VITE_AAD_SPA_CLIENT_ID as string;
const apiScope = import.meta.env.VITE_AAD_API_SCOPE as string;

const origin = window.location.origin;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: origin,
    postLogoutRedirectUri: origin,

    // Key change: popup returns to the real app
    popupRedirectUri: origin,

    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Info,
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii) return;
        // console.log(`[msal] ${message}`);
      },
    },
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "offline_access", apiScope].filter(Boolean),
};