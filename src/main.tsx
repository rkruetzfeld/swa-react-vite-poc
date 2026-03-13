import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";

import App from "./App";
import { msalConfig } from "./auth/msalConfig";
import "./index.css";

async function bootstrap() {
  // Create + initialize MSAL before any component can call loginPopup/acquireToken*
  const msalInstance = new PublicClientApplication(msalConfig);
  await msalInstance.initialize(); // Must complete before invoking other MSAL APIs [2](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization)

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
  // Hard fail with something visible if MSAL init ever breaks
  console.error("MSAL bootstrap failed:", e);
  const el = document.getElementById("root");
  if (el) el.innerHTML = `<pre style="padding:16px;font-family:Segoe UI,Arial">MSAL bootstrap failed:\n${String(e?.message ?? e)}</pre>`;
});