// src/auth/pca.ts
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./msalConfig";

// Single shared MSAL instance used by MsalProvider and non-React helper code.
export const pca = new PublicClientApplication(msalConfig);
