"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/**
 * Intermediate Clerk SSO/OAuth Callback Page
 * Handles incoming OAuth redirection from Google, completes authentication,
 * and seamlessly activates the citizen session before redirecting to the dashboard.
 */
export default function SSOCallbackPage() {
  const router = useRouter();
  const hasClerkKeys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder"),
  );

  React.useEffect(() => {
    if (!hasClerkKeys) {
      // In offline / local bridge mode, redirect immediately to dashboard
      const timer = setTimeout(() => {
        router.replace("/dashboard");
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [hasClerkKeys, router]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8 bg-[#f5f3ed]">
      <div className="w-full max-w-sm space-y-4 text-center">
        <Brand />
        <Card className="border border-[#cbd5cb] bg-[#faf9f5] shadow-xs">
          <CardContent className="pt-6 pb-6 space-y-4">
            <div className="flex justify-center">
              <Spinner className="size-8 text-[#0e2b24]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[#0e2b24]">Authenticating with Google</h2>
              <p className="text-xs text-[#5c6f66]">
                Completing secure authorization and initializing your JanSahayak citizen
                workspace...
              </p>
            </div>
            {hasClerkKeys && (
              <div className="text-left">
                <AuthenticateWithRedirectCallback
                  signInFallbackRedirectUrl="/dashboard"
                  signUpFallbackRedirectUrl="/dashboard"
                  signInForceRedirectUrl="/dashboard"
                  signUpForceRedirectUrl="/dashboard"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
