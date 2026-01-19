import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import { tokenRequest } from "./msalConfig";

/**
 * Acquire an access token for the configured API scope.
 * Silent first; if interaction is required, redirects.
 */
export async function getAccessTokenOrRedirect(
  pca: IPublicClientApplication
): Promise<string> {
  const active = pca.getActiveAccount();
  const accounts = pca.getAllAccounts();
  const account: AccountInfo | undefined = active ?? accounts[0];

  if (!account) {
    pca.loginRedirect(tokenRequest);
    throw new Error("No account found. Redirecting to login.");
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
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      pca.acquireTokenRedirect({ ...tokenRequest, account });
      throw new Error("Interaction required. Redirecting.");
    }
    throw e;
  }
}