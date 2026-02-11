import {
  InteractionRequiredAuthError,
  BrowserAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";
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
  const active = pca.getActiveAccount();
  const accounts = pca.getAllAccounts();
  const account: AccountInfo | undefined = active ?? accounts[0];

  if (!account) {
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
  }

  try {
    const resp = await pca.acquireTokenSilent({
      ...tokenRequest,
      account,
    });

    if (!resp.accessToken) {
      throw new Error("Token response missing accessToken.");
    }

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
  }
}
