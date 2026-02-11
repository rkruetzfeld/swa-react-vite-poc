// src/auth/pca.ts
import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AAD_CLIENT_ID as string;
const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string | undefined;

// You can also just set VITE_AAD_AUTHORITY directly if you prefer.
const authority =
  (import.meta.env.VITE_AAD_AUTHORITY as string) ||
  `https://login.microsoftonline.com/${tenantId || "common"}`;

const redirectUri =
  (import.meta.env.VITE_AAD_REDIRECT_URI as string) || window.location.origin;

if (!clientId) {
  throw new Error("Missing VITE_AAD_CLIENT_ID");
}

export const pca = new PublicClientApplication({
  auth: {
    clientId,
    authority,
    redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    // localStorage tends to behave better across refreshes; if you must use sessionStorage, change it.
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (level, message) => {
        if (level <= LogLevel.Warning) console.warn(message);
      },
    },
  },
});
