import {
  type AccountInfo,
  InteractionRequiredAuthError,
  type PublicClientApplication,
} from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

function chooseAccount(instance: PublicClientApplication): AccountInfo | null {
  return instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
}

/**
 * Ensure we have an interactive session and an active MSAL account.
 * Popup-only. Uses the static popup redirect page (/auth-popup.html).
 */
export async function ensureSignedIn(instance: PublicClientApplication): Promise<AccountInfo> {
  const existing = chooseAccount(instance);
  if (existing) {
    instance.setActiveAccount(existing);
    return existing;
  }

  const result = await instance.loginPopup({
    ...loginRequest,
    redirectUri: `${window.location.origin}/auth-popup.html`,
  });

  if (!result.account) {
    throw new Error("Login completed but MSAL did not return an account.");
  }

  instance.setActiveAccount(result.account);
  return result.account;
}

/**
 * Returns an access token for API calls. Falls back to popup if user interaction is required.
 */
export async function getAccessToken(instance: PublicClientApplication): Promise<string> {
  const account = await ensureSignedIn(instance);

  try {
    const silent = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return silent.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      const interactive = await instance.acquireTokenPopup({
        ...loginRequest,
        account,
        redirectUri: `${window.location.origin}/auth-popup.html`,
      });
      return interactive.accessToken;
    }
    throw e;
  }
}
