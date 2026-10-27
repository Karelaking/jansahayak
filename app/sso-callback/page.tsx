"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

import { AuthShell, type AuthNotice } from "@/components/auth/auth-shell";
import { AuthAlert, AuthHeader } from "@/components/auth/auth-ui";
import { Spinner } from "@/components/ui/spinner";

const CALLBACK_NOTICE: AuthNotice = {
  title: "Almost there",
  body: "We’re completing the secure handoff from Google and opening your account.",
  points: [
    {
      title: "Nothing to enter",
      body: "This screen moves on by itself once the handoff finishes.",
    },
    {
      title: "If it stalls",
      body: "Return to sign in and choose Google again.",
    },
  ],
  meta: "Google sign-in · JanSahayak SafeStreets",
};

/**
 * Intermediate callback for Google sign-in. It shows a calm holding screen,
 * offers a way out if the handoff stalls, and hands off to Clerk when the
 * deployment has credentials.
 */
export default function SSOCallbackPage() {
  const router = useRouter();
  const hasClerkKeys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder"),
  );
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!hasClerkKeys) {
      const timer = window.setTimeout(() => router.replace("/dashboard"), 350);
      return () => window.clearTimeout(timer);
    }
  }, [hasClerkKeys, router]);

  React.useEffect(() => {
    if (!hasClerkKeys) return;
    const timer = window.setTimeout(() => setTimedOut(true), 12000);
    return () => window.clearTimeout(timer);
  }, [hasClerkKeys]);

  return (
    <AuthShell notice={CALLBACK_NOTICE}>
      <AuthHeader
        title={timedOut ? "Sign-in did not finish" : "Signing you in"}
        description={
          timedOut
            ? "The Google handoff is taking longer than expected. You can return and try again."
            : "Keep this page open for a moment while we finish the handoff."
        }
      />

      {timedOut ? (
        <AuthAlert tone="info">
          The handoff has not completed. Return to sign in, or open the dashboard if you were
          already signed in.
        </AuthAlert>
      ) : (
        <div className="auth-status" role="status" aria-live="polite">
          <Spinner className="size-5" aria-hidden="true" />
          <span>Finishing sign-in…</span>
        </div>
      )}

      {timedOut ? (
        <div className="auth-footer">
          <Link href="/sign-in" className="auth-text-link">
            Return to sign in
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/dashboard" className="auth-text-link">
            Open the dashboard
          </Link>
        </div>
      ) : null}

      {hasClerkKeys ? (
        <div className="sr-only">
          <AuthenticateWithRedirectCallback
            signInFallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
            signInForceRedirectUrl="/dashboard"
            signUpForceRedirectUrl="/dashboard"
          />
        </div>
      ) : null}
    </AuthShell>
  );
}
