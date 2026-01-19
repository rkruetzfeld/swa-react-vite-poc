import React from "react";
import { useMsal } from "@azure/msal-react";

export default function SignOutButton() {
  const { instance, inProgress } = useMsal();

  return (
    <button
      className="ghostBtn"
      onClick={() => instance.logoutRedirect()}
      disabled={inProgress !== "none"}
      title="Sign out"
      type="button"
    >
      Sign out
    </button>
  );
}
