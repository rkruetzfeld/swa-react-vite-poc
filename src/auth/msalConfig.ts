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

    // Keep your static popup redirect page
    popupRedirectUri: `${origin}/auth-popup.html`,

    navigateToLoginRequestUrl: false
  },
  cache: {
    cacheLocation: "localStorage",

    // Helps in some privacy-restricted modes/browsers
    storeAuthStateInCookie: true
  },
  system: {
    // Helps avoid some popup timing weirdness in Chromium-based browsers
    asyncPopups: true,

    // Increase the window monitoring timeout to reduce false timed_out failures
    // (MSAL throws timed_out when popup monitoring doesn't get the response in time) [1](https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/8281)
    windowHashTimeout: 60000,

    loggerOptions: {
      logLevel: LogLevel.Info,
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii) return;
        // Uncomment for deep debug:
        // console.log(`[msal] ${message}`);
      }
    }
  }
};

export const loginRequest = {
  scopes: ["openid", "profile", "offline_access", apiScope].filter(Boolean),

  // Force popup to use static page (works now that SWA is excluding it)
  redirectUri: `${origin}/auth-popup.html`,

  // Useful to avoid “silent SSO weirdness” and make behavior consistent
  prompt: "select_account"
};
