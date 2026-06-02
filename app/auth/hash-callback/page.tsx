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
    redirect: query.get("redirect") ?? hash.get("redirect"),
    error:
      hash.get("error_description") ??
      query.get("error_description") ??
      hash.get("error") ??
      query.get("error"),
  };
}

function sanitizeRedirect(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  if (
    !trimmed ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("://") ||
    trimmed.includes("\\")
  ) {
    return fallback;
  }

  return trimmed;
}

function withRedirect(path: string, redirectTo: string, fallback = "/dashboard") {
  const safeRedirect = sanitizeRedirect(redirectTo, fallback);
  if (safeRedirect === fallback) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}redirect=${encodeURIComponent(safeRedirect)}`;
}

function withError(path: string, error: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(error)}`;
}

export default function AuthHashCallbackPage() {
  const [message, setMessage] = useState("Preparing your secure session...");

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      const params = readAuthParams();
      const next = sanitizeRedirect(params.redirect, "/dashboard");
      const forgotPasswordPath = withRedirect("/forgot-password", next);

      if (params.error) {
        window.location.replace(withError(forgotPasswordPath, params.error));
        return;
      }

      if (!params.accessToken || !params.refreshToken) {
        window.location.replace(
          withError(forgotPasswordPath, "Reset link expired. Request a new one."),
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
        window.location.replace(withError(forgotPasswordPath, error.message));
        return;
      }

      setMessage("Opening password reset...");
      window.location.replace(
        params.type === "recovery"
          ? withRedirect("/reset-password", next)
          : next,
      );
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
          <h1>ScalingMetrics</h1>
          <p>{message}</p>
        </div>
      </section>
    </main>
  );
}
