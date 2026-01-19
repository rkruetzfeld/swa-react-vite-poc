import { EventType, PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./msalConfig";

/**
 * Single MSAL instance shared by both:
 *  - MsalProvider (React)
 *  - api client token acquisition
 */
export const pca = new PublicClientApplication(msalConfig);

// Set active account on successful login
pca.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const payload = event.payload as any;
    if (payload.account) {
      pca.setActiveAccount(payload.account);
    }
  }
});
