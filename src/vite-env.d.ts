/// <reference types="vite/client" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_MSAL?: string;
  readonly VITE_AAD_API_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
