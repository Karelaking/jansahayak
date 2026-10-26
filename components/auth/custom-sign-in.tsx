"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Brand } from "@/components/brand";
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
import {
  ShieldCheck,
  UserCheck,
  Lock,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface CustomSignInProps {
  hasClerkKeys?: boolean;
}

export function CustomSignIn({ hasClerkKeys = false }: CustomSignInProps) {
  if (hasClerkKeys) {
    return <ClerkConnectedSignIn />;
  }
  return <LocalBridgeSignIn />;
}

/**
 * Clerk-Connected Custom Sign-In Flow
 * Implements Clerk SDK v7+ useSignIn() hook with password, errors, and finalize().
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
 * Backed by /api/auth/login for local offline development, automated tests,
 * and rapid persona simulation across Citizen, Moderator, and Admin roles.
 */
function LocalBridgeSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

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
  identifier: string;
  setIdentifier: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  redirectUrl: string;
  isClerkActive: boolean;
}) {
  const router = useRouter();

  // Rapid persona simulation for dev / review
  const handleQuickLogin = async (role: "citizen" | "moderator" | "admin") => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        router.push(redirectUrl);
      }
    } catch {
      // non-blocking
    }
  };

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
                  disabled={isLoading}
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
                  disabled={isLoading}
                  className="bg-white border-[#cbd5cb] text-[#17382f] text-xs h-9"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
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

            {/* Quick Demo Persona Switcher (For local evaluation) */}
            <div className="mt-5 pt-4 border-t border-[#eef1e9]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#0e2b24] flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-700" />
                  <span>One-Click Role Simulation</span>
                </span>
                <span className="text-[10px] text-[#5c6f66]">Dev &amp; Evaluation</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleQuickLogin("citizen")}
                  className="border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9] text-[11px] h-8 flex flex-col justify-center items-center py-1"
                >
                  <UserCheck className="size-3 text-emerald-800 mb-0.5" />
                  <span>Citizen</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleQuickLogin("moderator")}
                  className="border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9] text-[11px] h-8 flex flex-col justify-center items-center py-1"
                >
                  <ShieldCheck className="size-3 text-blue-800 mb-0.5" />
                  <span>Moderator</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleQuickLogin("admin")}
                  className="border-[#cbd5cb] text-[#17382f] hover:bg-[#eef1e9] text-[11px] h-8 flex flex-col justify-center items-center py-1"
                >
                  <ShieldAlert className="size-3 text-rose-800 mb-0.5" />
                  <span>Admin</span>
                </Button>
              </div>
            </div>
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
