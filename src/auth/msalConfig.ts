// src/auth/msalConfig.ts
import { LogLevel, type Configuration } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AAD_SPA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID}`,

    // CRITICAL: must be origin only for popup flow
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },

  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },

  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(message);
        if (level === LogLevel.Info) console.info(message);
        if (level === LogLevel.Verbose) console.debug(message);
        if (level === LogLevel.Warning) console.warn(message);
      },
    },
  },
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_AAD_API_SCOPE],
};
