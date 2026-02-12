// src/auth/getAccessToken.ts
import {
  InteractionRequiredAuthError,
  type AccountInfo,
  type PublicClientApplication,
} from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

function pickAccount(instance: PublicClientApplication): AccountInfo | null {
  return (
    instance.getActiveAccount() ??
    instance.getAllAccounts()[0] ??
    null
  );
}

/**
 * Ensures a user is signed in.
 * Uses loginPopup so the SPA does not leave the current page.
 */
export async function ensureSignedIn(
  instance: PublicClientApplication
): Promise<AccountInfo> {
  const existing = pickAccount(instance);
  if (existing) return existing;

  const result = await instance.loginPopup(loginRequest);
  if (result?.account) {
    instance.setActiveAccount(result.account);
    return result.account;
  }
  const acct = pickAccount(instance);
  if (!acct) {
    throw new Error("Login completed but no account was found in cache.");
  }
  instance.setActiveAccount(acct);
  return acct;
}

/**
 * Acquire an access token for the configured API scope.
 * Falls back to popup interaction if silent fails.
 */
export async function getAccessToken(
  instance: PublicClientApplication,
  scope: string
): Promise<string> {
  const account = await ensureSignedIn(instance);

  try {
    const res = await instance.acquireTokenSilent({
      account,
      scopes: [scope],
    });
    return res.accessToken;
  } catch (e) {
    // Typical when first consent or conditional access requires interaction
    if (e instanceof InteractionRequiredAuthError) {
      const res = await instance.acquireTokenPopup({
        account,
        scopes: [scope],
      });
      if (res?.account) instance.setActiveAccount(res.account);
      return res.accessToken;
    }
    throw e;
  }
}
