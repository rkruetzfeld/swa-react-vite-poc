import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";

import App from "./App";
import { msalConfig } from "./auth/msalConfig";
import "./index.css";

async function bootstrap() {
  const msalInstance = new PublicClientApplication(msalConfig);

  // Must resolve before calling other MSAL APIs
  await msalInstance.initialize();

  // Complete any pending redirect response (safe even if you primarily use popup)
  const result = await msalInstance.handleRedirectPromise().catch(() => null);

  if (result?.account) {
    msalInstance.setActiveAccount(result.account);
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) msalInstance.setActiveAccount(accounts[0]);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </React.StrictMode>
  );
}

bootstrap().catch((e) => {
  console.error("MSAL bootstrap failed:", e);
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<pre style="padding:16px;font-family:Segoe UI, Arial, sans-serif">
MSAL bootstrap failed:
${String(e?.message ?? e)}
</pre>`;
  }
});