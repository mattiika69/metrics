"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

function readAuthParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  return {
    accessToken: hash.get("access_token") ?? query.get("access_token"),
    refreshToken: hash.get("refresh_token") ?? query.get("refresh_token"),
    type: hash.get("type") ?? query.get("type"),
    error:
      hash.get("error_description") ??
      query.get("error_description") ??
      hash.get("error") ??
      query.get("error"),
  };
}

export default function AuthHashCallbackPage() {
  const [message, setMessage] = useState("Preparing your secure session...");

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      const params = readAuthParams();

      if (params.error) {
        window.location.replace(
          `/forgot-password?error=${encodeURIComponent(params.error)}`,
        );
        return;
      }

      if (!params.accessToken || !params.refreshToken) {
        window.location.replace(
          "/forgot-password?error=Reset%20link%20expired.%20Request%20a%20new%20one.",
        );
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });

      if (cancelled) return;

      if (error) {
        window.location.replace(
          `/forgot-password?error=${encodeURIComponent(error.message)}`,
        );
        return;
      }

      setMessage("Opening password reset...");
      window.location.replace(params.type === "recovery" ? "/reset-password" : "/dashboard");
    }

    finishAuth().catch(() => {
      if (!cancelled) {
        window.location.replace(
          "/forgot-password?error=Reset%20link%20could%20not%20be%20opened.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-heading">
          <h1>HyperOptimal</h1>
          <p>{message}</p>
        </div>
      </section>
    </main>
  );
}
