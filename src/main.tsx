import React from "react";
import ReactDOM from "react-dom/client";

import { MsalProvider } from "@azure/msal-react";
import { pca } from "./auth/pca";
import AuthGate from "./auth/AuthGate";

/* AG Grid styles */
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

/* AG Grid module registration (REQUIRED in v35+) */
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

import App from "./App.tsx";
import "./index.css";

async function bootstrap() {
  // ✅ MSAL v3+: must initialize before any other MSAL calls
  await pca.initialize();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <MsalProvider instance={pca}>
        <AuthGate>
          <App />
        </AuthGate>
      </MsalProvider>
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  // If init fails, show a readable error
  // (Avoids blank screen)
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML =
      `<div style="padding:16px;font-family:Segoe UI, Arial">` +
      `<h3>Authentication bootstrap error</h3>` +
      `<pre style="white-space:pre-wrap">${String(err?.message ?? err)}</pre>` +
      `</div>`;
  }
  // Also log to console for debugging
  // eslint-disable-next-line no-console
  console.error(err);
});
