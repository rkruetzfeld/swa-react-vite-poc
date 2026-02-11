// src/auth/getAccessToken.ts
// Popup-only MSAL token acquisition (iframe safe)

import {
  InteractionRequiredAuthError,
  BrowserAuthError,
  type AccountInfo,
} from "@azure/msal-browser";
<<<<<<< HEAD
import { loginRequest, tokenRequest } from "./msalConfig";

/**
 * Acquire an access token for the configured API scope.
 * Silent first.
 * If interaction required:
 *   - In iframe => popup
 *   - Top-level => popup (safer than redirect)
 *
 * This prevents redirect_in_iframe errors.
 */

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function breakoutToTopLevel(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("breakout")) {
    url.searchParams.set("breakout", "1");
  }
  try {
    window.top!.location.assign(url.toString());
  } catch {
    window.location.assign(url.toString());
  }
}

export async function getAccessTokenOrRedirect(
  pca: IPublicClientApplication
): Promise<string> {
=======

import { pca } from "./pca";
import { tokenRequest, loginRequest } from "./msalConfig";

function getActiveAccount(): AccountInfo | null {
>>>>>>> restore-ui-b4a1638
  const active = pca.getActiveAccount();
  if (active) return active;

  const accounts = pca.getAllAccounts();
  if (accounts.length > 0) {
    pca.setActiveAccount(accounts[0]);
    return accounts[0];
  }

  return null;
}

export async function getAccessToken(): Promise<string> {
  await pca.initialize();

  let account = getActiveAccount();

  // If no user signed in, force popup login
  if (!account) {
<<<<<<< HEAD
    // Never redirect automatically inside iframe
    if (isInIframe()) {
      try {
        const login = await pca.loginPopup(loginRequest);
        pca.setActiveAccount(login.account);
        return getAccessTokenOrRedirect(pca);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        const looksBlocked =
          msg.toLowerCase().includes("popup") ||
          msg.toLowerCase().includes("block") ||
          msg.toLowerCase().includes("window");
        if (looksBlocked || e instanceof BrowserAuthError) {
          breakoutToTopLevel();
          throw new Error("Breaking out to top-level for login...");
        }
        throw e;
      }
    }

    const login = await pca.loginPopup(loginRequest);
    pca.setActiveAccount(login.account);
    return getAccessTokenOrRedirect(pca);
=======
    const loginResult = await pca.loginPopup(loginRequest);
    if (!loginResult.account) {
      throw new Error("Login failed — no account returned.");
    }
    pca.setActiveAccount(loginResult.account);
    account = loginResult.account;
>>>>>>> restore-ui-b4a1638
  }

  try {
    const result = await pca.acquireTokenSilent({
      ...tokenRequest,
      account,
    });

    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const popupResult = await pca.acquireTokenPopup({
        ...tokenRequest,
        account,
      });

      return popupResult.accessToken;
    }

<<<<<<< HEAD
    return resp.accessToken;
  } catch (e: any) {
    if (e instanceof InteractionRequiredAuthError) {
      // 🔒 NEVER redirect in iframe
      if (isInIframe()) {
        try {
          const resp = await pca.acquireTokenPopup({
            ...tokenRequest,
            account,
          });
          return resp.accessToken;
        } catch (e2: any) {
          const msg = String(e2?.message ?? e2);
          const looksBlocked =
            msg.toLowerCase().includes("popup") ||
            msg.toLowerCase().includes("block") ||
            msg.toLowerCase().includes("window");
          if (looksBlocked || e2 instanceof BrowserAuthError) {
            breakoutToTopLevel();
            throw new Error("Breaking out to top-level for token acquisition...");
          }
          throw e2;
        }
      }

      const resp = await pca.acquireTokenPopup({
        ...tokenRequest,
        account,
      });

      return resp.accessToken;
    }

    // Safety net
    if (e instanceof BrowserAuthError && e.errorCode === "redirect_in_iframe") {
      const resp = await pca.acquireTokenPopup({
        ...tokenRequest,
        account,
      });
      return resp.accessToken;
    }

    throw e;
=======
    throw err;
>>>>>>> restore-ui-b4a1638
  }
}
