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

  // MSAL Browser: initialize must resolve before calling other MSAL APIs [3](https://dev.to/rebiiin/configure-http-security-response-headers-for-azure-static-web-apps-2b81)
  await msalInstance.initialize();

  // If we ever fall back to redirect, ensure the redirect response is processed on load
  // This avoids redirect flows getting stuck or leaving temp cache entries behind [2](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/errors)
  await msalInstance.handleRedirectPromise().catch(() => {
    // ignore; AuthGate will handle sign-in
  });

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
    el.innerHTML = `<pre style="padding:16px;font-family:Segoe UI,Arial">MSAL bootstrap failed:\n${String(
      e?.message ?? e
    )}</pre>`;
  }
});