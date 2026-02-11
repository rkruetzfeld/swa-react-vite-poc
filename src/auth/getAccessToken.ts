// src/auth/getAccessToken.ts
import type { AuthenticationResult, PopupRequest, SilentRequest, AccountInfo } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { pca } from "./pca";
import { loginRequest, tokenRequest } from "./msalConfig";

/**
 * Popup-only access token helper.
 *
 * - Never uses redirect flows.
 * - Ensures active account is set after popup completes.
 * - Falls back to popup when silent token fails with interaction_required.
 */

function pickAccount(): AccountInfo | null {
  return pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
}

async function loginViaPopup(): Promise<AuthenticationResult> {
  const req: PopupRequest = { ...loginRequest };
  const result = await pca.loginPopup(req);
  if (result.account) {
    pca.setActiveAccount(result.account);
  }
  return result;
}

async function acquireTokenViaPopup(account: AccountInfo): Promise<AuthenticationResult> {
  const req: PopupRequest = { ...tokenRequest, account };
  const result = await pca.acquireTokenPopup(req);
  if (result.account) {
    pca.setActiveAccount(result.account);
  }
  return result;
}

async function acquireTokenSilent(account: AccountInfo): Promise<AuthenticationResult> {
  const req: SilentRequest = { ...tokenRequest, account };
  const result = await pca.acquireTokenSilent(req);
  if (result.account) {
    pca.setActiveAccount(result.account);
  }
  return result;
}

export async function getAccessTokenOrPopup(): Promise<string> {
  const account = pickAccount();

  // If no account cached, do interactive login via popup.
  if (!account) {
    const loginResult = await loginViaPopup();
    return loginResult.accessToken || "";
  }

  // Prefer silent first.
  try {
    const silent = await acquireTokenSilent(account);
    return silent.accessToken || "";
  } catch (err: any) {
    // If user interaction required, do popup token acquisition.
    const needsInteraction =
      err instanceof InteractionRequiredAuthError ||
      (typeof err?.errorCode === "string" && err.errorCode.includes("interaction_required"));

    if (needsInteraction) {
      const popup = await acquireTokenViaPopup(account);
      return popup.accessToken || "";
    }

    // Other errors should surface.
    throw err;
  }
}

/**
 * Back-compat export: some callers still import getAccessTokenOrRedirect.
 * We are popup-only now, so this is an alias.
 */
export const getAccessTokenOrRedirect = getAccessTokenOrPopup;
