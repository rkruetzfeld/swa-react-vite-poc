// src/auth/pca.ts
import { PublicClientApplication, LogLevel } from "@azure/msal-browser";
import { msalConfig } from "./msalConfig";

/**
 * Single source of truth for MSAL auth config is msalConfig.ts.
 * This avoids env-var drift (e.g., VITE_AAD_CLIENT_ID vs VITE_AAD_SPA_CLIENT_ID)
 * and keeps build/CI consistent.
 */

export const pca = new PublicClientApplication({
  ...msalConfig,
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
