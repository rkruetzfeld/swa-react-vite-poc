// src/auth/getAccessToken.ts
// Popup-only MSAL token acquisition (iframe safe)

import {
  InteractionRequiredAuthError,
  type AccountInfo,
} from "@azure/msal-browser";

import { pca } from "./pca";
import { tokenRequest, loginRequest } from "./msalConfig";

function getActiveAccount(): AccountInfo | null {
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
    const loginResult = await pca.loginPopup(loginRequest);
    if (!loginResult.account) {
      throw new Error("Login failed — no account returned.");
    }
    pca.setActiveAccount(loginResult.account);
    account = loginResult.account;
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

    throw err;
  }
}
