// src/pages/AuthCallbackPage.tsx
// Redirect flow is disabled (popup-only auth).
// This page should never be used.

export default function AuthCallbackPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Authentication</h2>
      <p>
        This application uses popup-based authentication.
        Redirect callback is not required.
      </p>
    </div>
  );
}
