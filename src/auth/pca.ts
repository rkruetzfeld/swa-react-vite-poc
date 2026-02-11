// src/auth/pca.ts
import { PublicClientApplication, LogLevel } from "@azure/msal-browser";
import { msalConfig } from "./msalConfig";

export const pca = new PublicClientApplication({
  ...msalConfig,
  system: {
    ...(msalConfig.system || {}),
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (level, message) => {
        if (level <= LogLevel.Warning) console.warn(message);
      },
    },
  },
});
