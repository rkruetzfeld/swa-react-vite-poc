// src/auth/pca.ts
//
// Single MSAL instance for msal-react.
// Uses config from msalConfig.ts (keeps env vars consistent with CI).

import { PublicClientApplication, LogLevel } from "@azure/msal-browser";
import { msalConfig } from "./msalConfig";

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
