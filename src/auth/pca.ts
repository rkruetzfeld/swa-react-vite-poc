// src/auth/pca.ts
import { PublicClientApplication, EventType, AuthenticationResult } from "@azure/msal-browser";
import { msalConfig } from "./msalConfig";

export const pca = new PublicClientApplication(msalConfig);

/**
 * Initialize MSAL and ensure an active account is set when cached accounts exist.
 * This is important for popup-only auth flows (no redirect) so the opener tab
 * can reliably detect "signed-in" after the popup closes.
 */
export async function initPca(): Promise<void> {
  // Guardrail: if a previous popup/redirect was interrupted, MSAL may leave a stale
  // interaction flag that disables new sign-in attempts.
  try {
    sessionStorage.removeItem("msal.interaction.status");
  } catch {
    // ignore
  }

  await pca.initialize();

  // If MSAL has cached accounts but none is active, pick the first.
  const accounts = pca.getAllAccounts();
  if (!pca.getActiveAccount() && accounts.length > 0) {
    pca.setActiveAccount(accounts[0]);
  }

  // Keep active account aligned with successful popup outcomes.
  pca.addEventCallback((event) => {
    const isSuccess =
      event.eventType === EventType.LOGIN_SUCCESS ||
      event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS;

    if (!isSuccess || !event.payload) return;

    const payload = event.payload as AuthenticationResult;
    if (payload.account) {
      pca.setActiveAccount(payload.account);
    }
  });
}
