import { type Configuration, LogLevel } from "@azure/msal-browser";

/**
 * Popup-first config:
 * - Main SPA stays at origin
 * - Popup returns to /auth-popup.html (static, not SPA)
 * - navigateToLoginRequestUrl=false to avoid post-login route hopping
 */

const tenantId = import.meta.env.VITE_AAD_TENANT_ID as string;
const clientId = import.meta.env.VITE_AAD_SPA_CLIENT_ID as string;
const apiScope = import.meta.env.VITE_AAD_API_SCOPE as string;

const origin = window.location.origin;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,

    // Keep the SPA on origin
    redirectUri: origin,
    postLogoutRedirectUri: origin,

    // Popup returns to static page
    popupRedirectUri: `${origin}/auth-popup.html`,

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
  redirectUri: `${origin}/auth-popup.html`,
};