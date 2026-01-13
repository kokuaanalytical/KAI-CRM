"use client";

import { useEffect } from "react";

export default function AcceptInvitePage() {
  useEffect(() => {
    // Forward whatever query params exist to the reset password page.
    // (Hash tokens can't be read server-side, but can exist in client; this preserves query at least.)
    const url = new URL(window.location.href);
    window.location.replace(`/auth/reset-password${url.search}${url.hash || ""}`);
  }, []);

  return null;
}
