import { Configuration, LogLevel } from "@azure/msal-browser";

/**
 * Required Vite env vars:
 *  - VITE_AAD_TENANT_ID
 *  - VITE_AAD_SPA_CLIENT_ID
 *  - VITE_AAD_API_SCOPE  (e.g. api://<api-client-id>/Estimates.ReadWrite)
 */
const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string | undefined;
const clientId = import.meta.env.VITE_AAD_SPA_CLIENT_ID as string | undefined;
const apiScope = import.meta.env.VITE_AAD_API_SCOPE as string | undefined;

if (!tenantId || !clientId || !apiScope) {
  throw new Error(
    "Missing auth env vars. Set VITE_AAD_TENANT_ID, VITE_AAD_SPA_CLIENT_ID, and VITE_AAD_API_SCOPE."
  );
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (_level, message) => {
        if (import.meta.env.DEV) console.log(message);
      },
    },
  },
};

export const loginRequest = {
  scopes: [apiScope],
};

export const tokenRequest = {
  scopes: [apiScope],
};
