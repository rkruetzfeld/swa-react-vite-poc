// src/auth/getAccessToken.ts
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "./msalConfig";

let pca: PublicClientApplication | null = null;

function getPca(): PublicClientApplication {
  if (!pca) {
    pca = new PublicClientApplication(msalConfig);
  }
  return pca;
}

export async function ensureSignedIn() {
  const instance = getPca();

  const accounts = instance.getAllAccounts();
  if (accounts.length > 0) {
    instance.setActiveAccount(accounts[0]);
    return accounts[0];
  }

  const result = await instance.loginPopup(loginRequest);

  if (result.account) {
    instance.setActiveAccount(result.account);
    return result.account;
  }

  throw new Error("Login succeeded but no account returned.");
}

export async function getAccessToken(): Promise<string> {
  const instance = getPca();

  let account =
    instance.getActiveAccount() ?? instance.getAllAccounts()[0];

  if (!account) {
    account = await ensureSignedIn();
  }

  try {
    const response = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    return response.accessToken;
  } catch {
    const response = await instance.acquireTokenPopup(loginRequest);
    instance.setActiveAccount(response.account!);
    return response.accessToken;
  }
}
