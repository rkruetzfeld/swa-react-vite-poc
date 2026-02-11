// src/auth/getAccessToken.ts
import type { AccountInfo, AuthenticationResult, PopupRequest } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { pca } from "./pca";
import { tokenRequest } from "./msalConfig";

/**
 * Popup-only token acquisition helper (iframe-safe).
 * - Never calls loginRedirect / acquireTokenRedirect.
 * - Uses acquireTokenSilent when possible.
 * - Falls back to acquireTokenPopup.
 *
 * IMPORTANT:
 *  - Popup login requires a user gesture (button click) in many browsers.
 *  - If you call this during app startup without a click, popup may be blocked.
 */

export type TokenResult =
  | { ok: true; accessToken: string; account: AccountInfo | null; fromCache?: boolean }
  | { ok: false; error: unknown; requiresInteraction?: boolean };

function pickAccount(): AccountInfo | null {
  const active = pca.getActiveAccount();
  if (active) return active;

  const all = pca.getAllAccounts();
  if (all.length > 0) return all[0];

  return null;
}

async function trySilent(account: AccountInfo, request: PopupRequest): Promise<AuthenticationResult | null> {
  try {
    return await pca.acquireTokenSilent({ ...request, account });
  } catch (e) {
    // Interaction required -> caller should popup
    if (e instanceof InteractionRequiredAuthError) return null;
    // Some browsers throw generic errors for 3p cookie / iframe issues; treat as interaction-required
    return null;
  }
}

/**
 * Acquire an access token.
 * Use this inside API client and other calls that need a token.
 *
 * - If user is not signed in: returns {ok:false, requiresInteraction:true}
 * - If silent fails: will attempt popup (ONLY if allowPopup=true)
 */
export async function getAccessToken(options?: { allowPopup?: boolean }): Promise<TokenResult> {
  const allowPopup = options?.allowPopup ?? false;

  const request: PopupRequest = {
    ...(tokenRequest as PopupRequest),
  };

  const account = pickAccount();
  if (!account) {
    // Not signed in yet
    return { ok: false, error: new Error("No account in cache"), requiresInteraction: true };
  }

  // Ensure MSAL knows which account is active
  pca.setActiveAccount(account);

  // 1) Try silent first
  const silent = await trySilent(account, request);
  if (silent?.accessToken) {
    return { ok: true, accessToken: silent.accessToken, account, fromCache: true };
  }

  // 2) If silent failed and popup is allowed, try popup
  if (!allowPopup) {
    return { ok: false, error: new Error("Interaction required"), requiresInteraction: true };
  }

  try {
    const popupResult = await pca.acquireTokenPopup({ ...request, account });
    if (popupResult?.account) pca.setActiveAccount(popupResult.account);
    return { ok: true, accessToken: popupResult.accessToken, account: popupResult.account ?? account, fromCache: false };
  } catch (e) {
    return { ok: false, error: e, requiresInteraction: true };
  }
}

/**
 * Use this when the user clicks "Sign in" (user gesture).
 * This is the safest way to start auth from inside an iframe.
 */
export async function signInWithPopup(): Promise<TokenResult> {
  const request: PopupRequest = {
    ...(tokenRequest as PopupRequest),
  };

  try {
    const result = await pca.loginPopup(request);
    if (result?.account) pca.setActiveAccount(result.account);

    // After login, attempt token (silent should succeed)
    const account = result?.account ?? pickAccount();
    if (!account) return { ok: false, error: new Error("Login succeeded but no account found") };

    const silent = await trySilent(account, request);
    if (silent?.accessToken) return { ok: true, accessToken: silent.accessToken, account, fromCache: true };

    // If still no token, try popup token
    const popupResult = await pca.acquireTokenPopup({ ...request, account });
    if (popupResult?.account) pca.setActiveAccount(popupResult.account);
    return { ok: true, accessToken: popupResult.accessToken, account: popupResult.account ?? account, fromCache: false };
  } catch (e) {
    return { ok: false, error: e, requiresInteraction: true };
  }
}

/**
 * Logout helper
 */
export async function signOut(): Promise<void> {
  const account = pickAccount();
  await pca.logoutPopup({
    account: account ?? undefined,
    mainWindowRedirectUri: window.location.origin,
  });
}
