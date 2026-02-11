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
 * If interaction required: use popup (never redirect) to remain iframe-safe.
 *
 * This prevents: BrowserAuthError: redirect_in_iframe
 */

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
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
    const login = await pca.loginPopup(loginRequest);
    if (login?.account) {
      pca.setActiveAccount(login.account);
    }
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
      const resp = await pca.acquireTokenPopup({
        ...tokenRequest,
        account,
      });
      return resp.accessToken;
    }

    // Safety net: never redirect in iframe
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
