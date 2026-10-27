"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Brand } from "@/components/brand";
import { GoogleIcon } from "@/components/icons";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Lock, AlertCircle, ArrowRight } from "lucide-react";

interface CustomSignInProps {
  hasClerkKeys?: boolean;
}

export function CustomSignIn({ hasClerkKeys }: CustomSignInProps) {
  const isClerk =
    hasClerkKeys ??
    Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("placeholder"),
    );

  if (isClerk) {
    return <ClerkConnectedSignIn />;
  }
  return <LocalBridgeSignIn />;
}

/**
 * Clerk-Connected Custom Sign-In Flow
 * Implements Clerk SDK v7+ useSignIn() hook with password, Google SSO, errors, and finalize().
 */
function ClerkConnectedSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const { signIn, errors, fetchStatus } = useSignIn();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsGoogleLoading(true);
    try {
      if (signIn?.sso) {
        const { error } = await signIn.sso({
          strategy: "oauth_google",
          redirectUrl: redirectUrl || "/dashboard",
          redirectCallbackUrl: "/sso-callback",
        });
        if (error) {
          setLocalError(error.message || "Failed to initialize Google sign-in.");
          setIsGoogleLoading(false);
        }
      } else if (
        (signIn as unknown as { authenticateWithRedirect?: (opts: unknown) => Promise<unknown> })
          ?.authenticateWithRedirect
      ) {
        await (
          signIn as unknown as { authenticateWithRedirect: (opts: unknown) => Promise<unknown> }
        ).authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: redirectUrl || "/dashboard",
        });
      } else {
        setLocalError("OAuth authentication service is unavailable.");
        setIsGoogleLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in encountered an error.";
      setLocalError(msg);
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!identifier || !password) {
      setLocalError("Please enter both your email/username and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn.password({
        identifier,
        password,
      });

      if (error) {
        setLocalError(
          error.message || "Invalid credentials. Please verify your email and password.",
        );
        setIsSubmitting(false);
        return;
      }

      await signIn.finalize({
        navigate: async ({ session, decorateUrl }) => {
          const destination = session.currentTask
            ? `/sign-in/tasks/${session.currentTask.key}`
            : redirectUrl;
          const url = decorateUrl(destination);
          if (url.startsWith("http")) {
            window.location.href = url;
          } else {
            router.push(url);
          }
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication encountered an error.";
      setLocalError(msg);
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || fetchStatus === "fetching";

  return (
    <SignInLayout
      onSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
      identifier={identifier}
      setIdentifier={setIdentifier}
      password={password}
      setPassword={setPassword}
      isLoading={isLoading}
      errorMessage={
        localError ||
        errors?.global?.[0]?.message ||
        errors?.fields?.identifier?.message ||
        errors?.fields?.password?.message
      }
      redirectUrl={redirectUrl}
      isClerkActive={true}
    />
  );
}

/**
 * Local Bridge Sign-In Flow
 * Backed by /api/auth/login for local offline development and automated testing.
 */
function LocalBridgeSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading] = React.useState(false);

  const handleGoogleSignIn = async () => {
    setLocalError(
      "Google Authentication requires active Clerk credentials. Please ensure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is configured.",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!identifier) {
      setLocalError("Please enter your registered civic email or username.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identifier,
          role: identifier.includes("admin")
            ? "admin"
            : identifier.includes("mod")
              ? "moderator"
              : "citizen",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unable to sign in");
      }

      router.push(redirectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed.";
      setLocalError(msg);
      setIsLoading(false);
    }
  };

  return (
    <SignInLayout
      onSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
      identifier={identifier}
      setIdentifier={setIdentifier}
      password={password}
      setPassword={setPassword}
      isLoading={isLoading}
      errorMessage={localError}
      redirectUrl={redirectUrl}
      isClerkActive={false}
    />
  );
}

/**
 * Shared Noticeboard Sign-In Layout
 */
function SignInLayout({
  onSubmit,
  onGoogleSignIn,
  isGoogleLoading,
  identifier,
  setIdentifier,
  password,
  setPassword,
  isLoading,
  errorMessage,
  redirectUrl,
  isClerkActive,
}: {
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  isGoogleLoading: boolean;
  identifier: string;
  setIdentifier: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  redirectUrl: string;
  isClerkActive: boolean;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8 bg-[#f5f3ed]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block transition-opacity hover:opacity-85">
            <Brand />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[#0e2b24]">Civic Sign In</h1>
          <p className="text-xs text-[#486057]">
            Sign in to access your civic reporting space, tracking dockets, and verified updates.
          </p>
        </div>

        <Card className="border border-[#cbd5cb] bg-[#faf9f5] shadow-xs">
          <CardHeader className="pb-3 border-b border-[#eef1e9]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-[#17382f]">
                Account Credentials
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono tracking-wider border-[#cbd5cb] text-[#486057]"
              >
                {isClerkActive ? "Clerk Auth" : "Civic Secure"}
              </Badge>
            </div>
            <CardDescription className="text-xs text-[#5c6f66]">
              Enter your credentials to enter the JanSahayak dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900"
              >
                <AlertCircle className="size-4 shrink-0 text-rose-700 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Google Social Authentication */}
            <div className="space-y-3 mb-4">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading || isGoogleLoading}
                onClick={onGoogleSignIn}
                className="w-full h-9 bg-white hover:bg-[#f0eee6] border-[#cbd5cb] text-[#0e2b24] font-medium text-xs flex items-center justify-center gap-2.5 shadow-xs transition-colors"
                aria-label="Sign in with Google Authentication"
              >
                {isGoogleLoading ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <GoogleIcon className="size-4 shrink-0" />
                )}
                <span>Continue with Google</span>
              </Button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#cbd5cb]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                  <span className="bg-[#faf9f5] px-2 text-[#5c6f66]">or sign in with email</span>
                </div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="sign-in-identifier"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Email Address or Username
                </label>
                <Input
                  id="sign-in-identifier"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="name@example.in or civic_user"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  className="bg-white border-[#cbd5cb] text-[#17382f] text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="sign-in-password"
                    className="block text-xs font-semibold text-[#17382f]"
                  >
                    Password
                  </label>
                  <span className="text-[11px] text-[#5c6f66]">Protected by RBAC</span>
                </div>
                <Input
                  id="sign-in-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  className="bg-white border-[#cbd5cb] text-[#17382f] text-xs h-9"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] text-xs font-medium h-9 shadow-xs"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="size-3.5" />
                    <span>Authenticating...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5" />
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="size-3.5 ml-1" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-[#eef1e9] py-3 text-xs text-[#5c6f66]">
            <span>Don&apos;t have an account?</span>
            <Link
              href={`/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
              className="font-semibold text-[#0e2b24] hover:underline"
            >
              Sign Up as Citizen
            </Link>
          </CardFooter>
        </Card>

        <div className="text-center">
          <Link href="/" className="text-xs text-[#486057] hover:text-[#0e2b24] transition-colors">
            ← Back to Public Civic Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
