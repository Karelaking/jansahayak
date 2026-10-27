"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
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
import { UserPlus, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

interface CustomSignUpProps {
  hasClerkKeys?: boolean;
}

export function CustomSignUp({ hasClerkKeys }: CustomSignUpProps) {
  const isClerk =
    hasClerkKeys ??
    Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") &&
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("placeholder"),
    );

  if (isClerk) {
    return <ClerkConnectedSignUp />;
  }
  return <LocalBridgeSignUp />;
}

/**
 * Clerk-Connected Custom Sign-Up Flow
 * Implements Clerk SDK v7+ useSignUp() with Google SSO, email verification, and finalize().
 */
function ClerkConnectedSignUp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const { signUp, errors, fetchStatus } = useSignUp();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  const handleGoogleSignUp = async () => {
    setLocalError(null);
    setIsGoogleLoading(true);
    try {
      if (signUp?.sso) {
        const { error } = await signUp.sso({
          strategy: "oauth_google",
          redirectUrl: redirectUrl || "/dashboard",
          redirectCallbackUrl: "/sso-callback",
        });
        if (error) {
          setLocalError(error.message || "Failed to initialize Google authentication.");
          setIsGoogleLoading(false);
        }
      } else if (
        (signUp as unknown as { authenticateWithRedirect?: (opts: unknown) => Promise<unknown> })
          ?.authenticateWithRedirect
      ) {
        await (
          signUp as unknown as { authenticateWithRedirect: (opts: unknown) => Promise<unknown> }
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
      const msg = err instanceof Error ? err.message : "Google registration encountered an error.";
      setLocalError(msg);
      setIsGoogleLoading(false);
    }
  };

  const handleInitialSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password || !fullName) {
      setLocalError("Please fill out all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const parts = fullName.trim().split(" ");
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(" ") || undefined;

      const { error } = await signUp.password({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      if (error) {
        setLocalError(error.message || "Sign-up validation failed.");
        setIsSubmitting(false);
        return;
      }

      // Check if email code verification is required
      if (signUp.verifications?.emailAddress?.status === "unverified") {
        await signUp.verifications.sendEmailCode();
        setVerifying(true);
      } else {
        await finalizeSignUp();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!code) {
      setLocalError("Please enter the verification code sent to your email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) {
        setLocalError(error.message || "Invalid verification code.");
        setIsSubmitting(false);
        return;
      }

      await finalizeSignUp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed.";
      setLocalError(msg);
      setIsSubmitting(false);
    }
  };

  const finalizeSignUp = async () => {
    await signUp.finalize({
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
  };

  const isLoading = isSubmitting || fetchStatus === "fetching";

  if (verifying) {
    return (
      <VerificationLayout
        email={email}
        code={code}
        setCode={setCode}
        onSubmit={handleVerifyCode}
        isLoading={isLoading}
        errorMessage={localError}
      />
    );
  }

  return (
    <SignUpLayout
      onSubmit={handleInitialSignUp}
      onGoogleSignUp={handleGoogleSignUp}
      isGoogleLoading={isGoogleLoading}
      fullName={fullName}
      setFullName={setFullName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      isLoading={isLoading}
      errorMessage={
        localError || errors?.global?.[0]?.message || errors?.fields?.emailAddress?.message
      }
      redirectUrl={redirectUrl}
    />
  );
}

/**
 * Local Bridge Sign-Up Flow
 * Backed by /api/auth/register for local development and integration tests.
 */
function LocalBridgeSignUp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading] = React.useState(false);

  const handleGoogleSignUp = async () => {
    setLocalError(
      "Google Authentication requires active Clerk credentials. Please ensure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is configured.",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !fullName) {
      setLocalError("Please enter your name and email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Registration could not be completed.");
      }

      router.push(redirectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-up failed.";
      setLocalError(msg);
      setIsLoading(false);
    }
  };

  return (
    <SignUpLayout
      onSubmit={handleSubmit}
      onGoogleSignUp={handleGoogleSignUp}
      isGoogleLoading={isGoogleLoading}
      fullName={fullName}
      setFullName={setFullName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      isLoading={isLoading}
      errorMessage={localError}
      redirectUrl={redirectUrl}
    />
  );
}

/**
 * Shared Sign-Up Form Layout
 */
function SignUpLayout({
  onSubmit,
  onGoogleSignUp,
  isGoogleLoading,
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  isLoading,
  errorMessage,
  redirectUrl,
}: {
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignUp: () => void;
  isGoogleLoading: boolean;
  fullName: string;
  setFullName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  redirectUrl: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8 bg-[#f5f3ed]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block transition-opacity hover:opacity-85">
            <Brand />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[#0e2b24]">Create Civic Account</h1>
          <p className="text-xs text-[#486057]">
            Register as a verified citizen to submit road hazard reports, track repairs, and vote in
            local consensus.
          </p>
        </div>

        <Card className="border border-[#cbd5cb] bg-[#faf9f5] shadow-xs">
          <CardHeader className="pb-3 border-b border-[#eef1e9]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-[#17382f]">
                Citizen Registration
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono tracking-wider border-[#cbd5cb] text-[#486057]"
              >
                Greater Noida
              </Badge>
            </div>
            <CardDescription className="text-xs text-[#5c6f66]">
              Your citizen account grants you public transparency rights under PRD §2 &amp; §14B.
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
                onClick={onGoogleSignUp}
                className="w-full h-9 bg-white hover:bg-[#f0eee6] border-[#cbd5cb] text-[#0e2b24] font-medium text-xs flex items-center justify-center gap-2.5 shadow-xs transition-colors"
                aria-label="Continue with Google Authentication"
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
                  <span className="bg-[#faf9f5] px-2 text-[#5c6f66]">or register with email</span>
                </div>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="sign-up-fullname"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Full Name
                </label>
                <Input
                  id="sign-up-fullname"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  className="bg-white border-[#cbd5cb] text-[#17382f] text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sign-up-email"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Email Address
                </label>
                <Input
                  id="sign-up-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="rahul@example.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  className="bg-white border-[#cbd5cb] text-[#17382f] text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sign-up-password"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Create Secure Password
                </label>
                <Input
                  id="sign-up-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  className="bg-white border-[#cbd5cb] text-[#17382f] text-xs h-9"
                />
              </div>

              <div className="rounded-lg border border-[#cbd5cb] bg-[#f0eee6] p-3 text-xs text-[#17382f] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[#0e2b24]">
                  <CheckCircle2 className="size-3.5 text-emerald-800 shrink-0" />
                  <span>Civilian Account Enrollment</span>
                </div>
                <p className="text-[11px] text-[#5c6f66] leading-relaxed">
                  All public registrations are enrolled as Civilian Reporter accounts. Moderator or
                  Administrative privileges are appointed by designated municipal authorities.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full bg-[#0e2b24] hover:bg-[#1c4b3e] text-[#f5f3ed] text-xs font-medium h-9 shadow-xs"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="size-3.5" />
                    <span>Registering Account...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="size-3.5" />
                    <span>Create Account &amp; Access Dashboard</span>
                    <ArrowRight className="size-3.5 ml-1" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-[#eef1e9] py-3 text-xs text-[#5c6f66]">
            <span>Already registered?</span>
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
              className="font-semibold text-[#0e2b24] hover:underline"
            >
              Sign In to Account
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

/**
 * OTP Email Verification Layout
 */
function VerificationLayout({
  email,
  code,
  setCode,
  onSubmit,
  isLoading,
  errorMessage,
}: {
  email: string;
  code: string;
  setCode: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8 bg-[#f5f3ed]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block transition-opacity hover:opacity-85">
            <Brand />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[#0e2b24]">Verify Email</h1>
          <p className="text-xs text-[#486057]">
            We sent a verification code to <strong>{email}</strong>.
          </p>
        </div>

        <Card className="border border-[#cbd5cb] bg-[#faf9f5] shadow-xs">
          <CardHeader className="pb-3 border-b border-[#eef1e9]">
            <CardTitle className="text-base font-semibold text-[#17382f]">
              Enter One-Time Verification Code
            </CardTitle>
            <CardDescription className="text-xs text-[#5c6f66]">
              Check your inbox and enter the 6-digit code.
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
                  htmlFor="verification-code"
                  className="block text-xs font-semibold text-[#17382f]"
                >
                  Verification Code
                </label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="123456"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isLoading}
                  className="bg-white border-[#cbd5cb] text-[#17382f] text-center tracking-widest font-mono text-base h-10"
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
                    <span>Verifying...</span>
                  </span>
                ) : (
                  <span>Verify Code &amp; Complete Registration</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
