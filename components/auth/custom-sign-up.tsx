"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";

import { AuthShell, type AuthNotice } from "@/components/auth/auth-shell";
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthHeader,
  AuthOAuthButton,
  AuthSubmit,
  useResendCooldown,
} from "@/components/auth/auth-ui";

interface CustomSignUpProps {
  hasClerkKeys?: boolean;
}

const SIGN_UP_NOTICE: AuthNotice = {
  title: "Add your street to the record",
  body: "A citizen account keeps your reports and their follow-up in one place, visible to the neighbourhood.",
  points: [
    {
      title: "Report what you see",
      body: "Pin the location and describe the hazard.",
    },
    {
      title: "Back up neighbours",
      body: "Confirm reports that are already on the map.",
    },
    {
      title: "Watch the case move",
      body: "Follow each update from filing to recorded action.",
    },
  ],
  meta: "Pilot area · Greater Noida, Uttar Pradesh",
};

const VERIFY_NOTICE: AuthNotice = {
  title: "Confirm your address",
  body: "The code proves the email belongs to you, so updates about your reports reach the right person.",
  points: [
    {
      title: "Check the inbox",
      body: "The code goes to the address you just entered.",
    },
    {
      title: "Codes are personal",
      body: "Share it with no one, including anyone who asks.",
    },
  ],
  meta: "Email verification · JanSahayak SafeStreets",
};

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
 * Clerk-connected sign-up: password, Google SSO, and email-code verification.
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
          setLocalError(error.message || "We couldn't start Google sign-up. Please try again.");
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
        setLocalError("We couldn't start Google sign-up. Please try again.");
        setIsGoogleLoading(false);
      }
    } catch {
      setLocalError("We couldn't start Google sign-up. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const handleInitialSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password || !fullName) {
      setLocalError("Fill in your name, email address, and password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const parts = fullName.trim().split(" ");
      const firstName = parts[0] || fullName;
      const lastName = parts.slice(1).join(" ").trim() || undefined;

      const { error } = await signUp.password({
        emailAddress: email,
        password,
        firstName,
        ...(lastName ? { lastName } : {}),
      });

      if (error) {
        setLocalError(error.message || "Those details could not be used. Check them and try again.");
        return;
      }

      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }

      if (signUp.isTransferable) {
        setLocalError(
          "An account with this email already exists. Sign in instead to keep going.",
        );
        return;
      }

      if (signUp.unverifiedFields?.includes("email_address")) {
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) {
          setLocalError(
            sendError.message ||
              "We couldn't send a verification code. Check the address and try again.",
          );
          return;
        }
        setVerifying(true);
        return;
      }

      if (signUp.unverifiedFields?.length) {
        setLocalError(
          "This account needs a verification step that isn't available here. Contact the municipal team for help.",
        );
        return;
      }

      setLocalError("The account could not be created. Please try again.");
    } catch {
      setLocalError("The account could not be created. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!code.trim()) {
      setLocalError("Enter the code from your email to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (error) {
        setLocalError(error.message || "That code was not accepted. Check it and try again.");
        return;
      }

      if (signUp.status === "complete") {
        await finalizeSignUp();
        return;
      }

      if (signUp.isTransferable) {
        setLocalError(
          "An account with this email already exists. Sign in instead to keep going.",
        );
        return;
      }

      if (signUp.unverifiedFields?.includes("email_address")) {
        setLocalError("That code was not accepted. Use the latest email and try again.");
        return;
      }

      setLocalError("The account could not be created. Please try again.");
    } catch {
      setLocalError("Verification could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async (): Promise<boolean> => {
    setLocalError(null);
    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) {
        setLocalError(error.message || "We couldn't send another code. Try again in a moment.");
        return false;
      }
      return true;
    } catch {
      setLocalError("We couldn't send another code. Try again in a moment.");
      return false;
    }
  };

  const handleChangeEmail = async () => {
    setLocalError(null);
    setCode("");
    await signUp.reset();
    setVerifying(false);
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
      <VerificationView
        email={email}
        code={code}
        setCode={setCode}
        onSubmit={handleVerifyCode}
        onResend={handleResendCode}
        onChangeEmail={handleChangeEmail}
        isLoading={isLoading}
        errorMessage={localError}
        redirectUrl={redirectUrl}
      />
    );
  }

  return (
    <SignUpView
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
      isClerkActive
    />
  );
}

/**
 * Local bridge sign-up, backed by /api/auth/register for development and tests.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !fullName) {
      setLocalError("Enter your name and email address to continue.");
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
        throw new Error(data.error || "The account could not be created.");
      }

      router.push(redirectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The account could not be created.";
      setLocalError(msg);
      setIsLoading(false);
    }
  };

  return (
    <SignUpView
      onSubmit={handleSubmit}
      isGoogleLoading={false}
      fullName={fullName}
      setFullName={setFullName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      isLoading={isLoading}
      errorMessage={localError}
      redirectUrl={redirectUrl}
      isClerkActive={false}
    />
  );
}

function SignUpView({
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
  isClerkActive,
}: {
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignUp?: () => void;
  isGoogleLoading: boolean;
  fullName: string;
  setFullName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isLoading: boolean;
  errorMessage?: string | null;
  redirectUrl: string;
  isClerkActive: boolean;
}) {
  return (
    <AuthShell notice={SIGN_UP_NOTICE}>
      <AuthHeader
        title="Create your account"
        description="Report hazards, support neighbours, and follow each case."
      />

      {errorMessage ? <AuthAlert tone="error">{errorMessage}</AuthAlert> : null}

      {onGoogleSignUp ? (
        <>
          <AuthOAuthButton
            loading={isGoogleLoading}
            disabled={isLoading}
            onClick={onGoogleSignUp}
          />
          <AuthDivider>or use your email</AuthDivider>
        </>
      ) : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          id="sign-up-fullname"
          label="Full name"
          type="text"
          autoComplete="name"
          required
          placeholder="e.g. Rahul Sharma"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isLoading || isGoogleLoading}
        />

        <AuthField
          id="sign-up-email"
          label="Email address"
          type="email"
          autoComplete="email"
          required
          placeholder="name@example.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading || isGoogleLoading}
        />

        {isClerkActive ? (
          <AuthField
            id="sign-up-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            hint="Use at least 8 characters."
            revealable
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || isGoogleLoading}
          />
        ) : null}

        <AuthSubmit loading={isLoading} loadingLabel="Creating account…">
          Create account
        </AuthSubmit>
      </form>

      <p className="auth-support">
        Public sign-ups are Civilian Reporter accounts. Moderator and administrative access is
        assigned by the municipal team.
      </p>

      <div className="auth-footer">
        <span>Already have an account?</span>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
          className="auth-text-link"
        >
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}

function VerificationView({
  email,
  code,
  setCode,
  onSubmit,
  onResend,
  onChangeEmail,
  isLoading,
  errorMessage,
  redirectUrl,
}: {
  email: string;
  code: string;
  setCode: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => Promise<boolean>;
  onChangeEmail: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
  redirectUrl: string;
}) {
  const cooldown = useResendCooldown(30);
  const [resent, setResent] = React.useState(false);

  const handleResend = async () => {
    setResent(false);
    const sent = await onResend();
    if (sent) {
      setResent(true);
      cooldown.restart();
    }
  };

  return (
    <AuthShell notice={VERIFY_NOTICE}>
      <AuthHeader
        title="Check your email"
        description={`We sent a six-digit code to ${email}.`}
      />

      {errorMessage ? <AuthAlert tone="error">{errorMessage}</AuthAlert> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          id="sign-up-code"
          label="Six-digit code"
          code
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          required
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={isLoading}
        />

        <AuthSubmit loading={isLoading} loadingLabel="Verifying…">
          Verify and create account
        </AuthSubmit>
      </form>

      <div className="auth-footer">
        <button
          type="button"
          className="auth-inline-action"
          onClick={handleResend}
          disabled={isLoading || !cooldown.ready}
        >
          {cooldown.ready ? "Resend code" : `Resend code in ${cooldown.remaining}s`}
        </button>
        {resent ? <span className="auth-hint">A new code is on its way.</span> : null}
      </div>

      <div className="auth-footer">
        <button
          type="button"
          className="auth-link-button"
          onClick={onChangeEmail}
          disabled={isLoading}
        >
          Use a different email
        </button>
        <span aria-hidden="true">·</span>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
          className="auth-text-link"
        >
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
