"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

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

interface CustomSignInProps {
  hasClerkKeys?: boolean;
}

const SIGN_IN_NOTICE: AuthNotice = {
  title: "A record you can follow",
  body: "Reports you file stay attached to your account, along with the public trail of what followed.",
  points: [
    {
      title: "Report a hazard",
      body: "Pin the location and add what you saw.",
    },
    {
      title: "Verify local reports",
      body: "Support hazards neighbours have already documented.",
    },
    {
      title: "Track the follow-up",
      body: "Read each case from report to recorded action.",
    },
  ],
  meta: "Pilot area · Greater Noida, Uttar Pradesh",
};

const MFA_NOTICE: AuthNotice = {
  title: "One more check",
  body: "Your password was accepted. This second step confirms the account belongs to you.",
  points: [
    {
      title: "Why this step",
      body: "It appears when a second factor is switched on for the account.",
    },
    {
      title: "Lost access?",
      body: "Contact the municipal team that manages staff accounts.",
    },
  ],
  meta: "Second-step verification",
};

const RESET_NOTICE: AuthNotice = {
  title: "A way back in",
  body: "We send a single-use code to the email on your account, then you choose a new password.",
  points: [
    {
      title: "Use your account email",
      body: "The code goes to the address you signed up with.",
    },
    {
      title: "Codes are personal",
      body: "Share the code with no one, including anyone who asks.",
    },
  ],
  meta: "Password reset · JanSahayak SafeStreets",
};

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
 * Clerk-connected sign-in: password, Google SSO, a second factor, and the
 * email-code password reset flow.
 */
function ClerkConnectedSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const { signIn, errors, fetchStatus } = useSignIn();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [mfaStrategy, setMfaStrategy] = React.useState<
    "email_code" | "phone_code" | "totp" | "backup_code" | null
  >(null);
  const [mfaCode, setMfaCode] = React.useState("");

  const [resetStep, setResetStep] = React.useState<"request" | "code" | "password" | null>(null);
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetCode, setResetCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const finalizeSignIn = React.useCallback(async () => {
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
  }, [signIn, redirectUrl, router]);

  /**
   * Prepares the strongest second factor the account supports. Email codes are
   * preferred because they need no extra setup; authenticators and phone codes
   * fall back to a single code field.
   */
  const beginSecondFactor = React.useCallback(async (): Promise<boolean> => {
    const factors = signIn.supportedSecondFactors ?? [];
    const has = (strategy: string) => factors.some((factor) => factor.strategy === strategy);

    if (has("email_code")) {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) {
        setLocalError(error.message || "We couldn't send a code to your email. Try again.");
        return false;
      }
      setMfaStrategy("email_code");
      return true;
    }

    if (has("totp")) {
      setMfaStrategy("totp");
      return true;
    }

    if (has("phone_code")) {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) {
        setLocalError(error.message || "We couldn't send a code to your phone. Try again.");
        return false;
      }
      setMfaStrategy("phone_code");
      return true;
    }

    if (has("backup_code")) {
      setMfaStrategy("backup_code");
      return true;
    }

    setLocalError(
      "This account needs a second step this form cannot complete. Contact the team that manages your account.",
    );
    return false;
  }, [signIn]);

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsGoogleLoading(true);
    try {
      const { error } = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: redirectUrl || "/dashboard",
        redirectCallbackUrl: "/sso-callback",
      });
      if (error) {
        setLocalError(error.message || "We couldn't start Google sign-in. Please try again.");
        setIsGoogleLoading(false);
      }
    } catch {
      setLocalError("We couldn't start Google sign-in. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    if (!identifier.trim() || !password) {
      setLocalError("Enter your email or username and password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn.password({
        identifier: identifier.trim(),
        password,
      });

      if (error) {
        setLocalError(
          error.message || "That email and password did not match. Check them and try again.",
        );
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
        await beginSecondFactor();
        return;
      }

      if (signIn.status === "needs_new_password") {
        setLocalError(
          "This account needs a new password before it can sign in. Use “Forgot password?” to set one.",
        );
        return;
      }

      if (signIn.isTransferable) {
        setLocalError(
          "We couldn't find a JanSahayak account with those details. Create a citizen account to get started.",
        );
        return;
      }

      setLocalError("One more verification step is needed. Please try again.");
    } catch {
      setLocalError("Sign-in could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySecondFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!mfaCode.trim()) {
      setLocalError("Enter the verification code to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } =
        mfaStrategy === "email_code"
          ? await signIn.mfa.verifyEmailCode({ code: mfaCode.trim() })
          : mfaStrategy === "phone_code"
            ? await signIn.mfa.verifyPhoneCode({ code: mfaCode.trim() })
            : mfaStrategy === "totp"
              ? await signIn.mfa.verifyTOTP({ code: mfaCode.trim() })
              : await signIn.mfa.verifyBackupCode({ code: mfaCode.trim() });

      if (error) {
        setLocalError(error.message || "That code was not accepted. Check it and try again.");
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      if (signIn.status === "needs_new_password") {
        setLocalError(
          "Your password needs to be reset before sign-in can finish. Go back and use “Forgot password?”.",
        );
        return;
      }

      setLocalError("Another verification step is still needed. Please try again.");
    } catch {
      setLocalError("Verification could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReset = React.useCallback(() => {
    setLocalError(null);
    setInfoMessage(null);
    setResetEmail(identifier.includes("@") ? identifier.trim() : "");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetStep("request");
  }, [identifier]);

  const cancelReset = async () => {
    setResetStep(null);
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setLocalError(null);
    setInfoMessage(null);
    await signIn.reset();
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    const email = resetEmail.trim();

    if (!email || !email.includes("@")) {
      setLocalError("Enter the email address on your account.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn.reset();

      const { error } = await signIn.create({ identifier: email });
      if (error) {
        setLocalError(
          error.message || "We couldn't find an account with that email. Check it and try again.",
        );
        return;
      }

      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) {
        setLocalError(
          sendError.message || "We couldn't send the reset code. Try again in a moment.",
        );
        return;
      }

      setResetStep("code");
      setInfoMessage("A six-digit code is on its way.");
    } catch {
      setLocalError("The reset code could not be sent. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    if (!resetCode.trim()) {
      setLocalError("Enter the six-digit code from your email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({
        code: resetCode.trim(),
      });

      if (error) {
        setLocalError(error.message || "That code was not accepted. Check it and try again.");
        return;
      }

      if (signIn.status === "needs_new_password") {
        setResetStep("password");
        return;
      }

      setLocalError("The code was accepted, but the reset could not continue. Request a new code.");
    } catch {
      setLocalError("The code could not be checked. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (newPassword.length < 8) {
      setLocalError("Use at least 8 characters for your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError("The two passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
      });

      if (error) {
        setLocalError(error.message || "We couldn't set that password. Try a different one.");
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn();
        return;
      }

      if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
        setResetStep(null);
        await beginSecondFactor();
        return;
      }

      setLocalError(
        "Your password was updated, but sign-in did not finish. Return to sign in and use the new password.",
      );
    } catch {
      setLocalError("Your new password could not be saved. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetResend = async (): Promise<boolean> => {
    setLocalError(null);
    try {
      const { error } = await signIn.resetPasswordEmailCode.sendCode();
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

  const isLoading = isSubmitting || fetchStatus === "fetching";

  if (mfaStrategy) {
    return (
      <SecondFactorView
        strategy={mfaStrategy}
        code={mfaCode}
        setCode={setMfaCode}
        onSubmit={handleVerifySecondFactor}
        onResend={beginSecondFactor}
        onBack={() => {
          void signIn.reset();
          setMfaStrategy(null);
          setMfaCode("");
          setLocalError(null);
        }}
        isLoading={isLoading}
        errorMessage={localError || errors?.global?.[0]?.message}
      />
    );
  }

  if (resetStep === "request") {
    return (
      <ResetRequestView
        email={resetEmail}
        setEmail={setResetEmail}
        onSubmit={handleResetRequest}
        onCancel={cancelReset}
        isLoading={isLoading}
        errorMessage={localError}
      />
    );
  }

  if (resetStep === "code") {
    return (
      <ResetCodeView
        email={resetEmail}
        code={resetCode}
        setCode={setResetCode}
        onSubmit={handleResetVerify}
        onResend={handleResetResend}
        onEditEmail={() => {
          setResetStep("request");
          setLocalError(null);
          setInfoMessage(null);
        }}
        onCancel={cancelReset}
        isLoading={isLoading}
        errorMessage={localError}
        infoMessage={infoMessage}
      />
    );
  }

  if (resetStep === "password") {
    return (
      <ResetPasswordView
        password={newPassword}
        setPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        onSubmit={handleResetPassword}
        onCancel={cancelReset}
        isLoading={isLoading}
        errorMessage={localError}
      />
    );
  }

  return (
    <PasswordSignInView
      onSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
      identifier={identifier}
      setIdentifier={setIdentifier}
      password={password}
      setPassword={setPassword}
      onForgotPassword={openReset}
      isLoading={isLoading}
      errorMessage={
        localError ||
        errors?.global?.[0]?.message ||
        errors?.fields?.identifier?.message ||
        errors?.fields?.password?.message
      }
      redirectUrl={redirectUrl}
      isClerkActive
    />
  );
}

/**
 * Local bridge sign-in, backed by /api/auth/login for development and tests.
 */
function LocalBridgeSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const [identifier, setIdentifier] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!identifier.trim()) {
      setLocalError("Enter your account email to continue.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identifier.trim(),
          role: identifier.includes("admin")
            ? "admin"
            : identifier.includes("mod")
              ? "moderator"
              : "citizen",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sign-in could not be completed.");
      }

      router.push(redirectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in could not be completed.";
      setLocalError(msg);
      setIsLoading(false);
    }
  };

  return (
    <PasswordSignInView
      onSubmit={handleSubmit}
      isGoogleLoading={false}
      identifier={identifier}
      setIdentifier={setIdentifier}
      isLoading={isLoading}
      errorMessage={localError}
      redirectUrl={redirectUrl}
      isClerkActive={false}
    />
  );
}

function PasswordSignInView({
  onSubmit,
  onGoogleSignIn,
  isGoogleLoading,
  identifier,
  setIdentifier,
  password,
  setPassword,
  onForgotPassword,
  isLoading,
  errorMessage,
  redirectUrl,
  isClerkActive,
}: {
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn?: () => void;
  isGoogleLoading: boolean;
  identifier: string;
  setIdentifier: (value: string) => void;
  password?: string;
  setPassword?: (value: string) => void;
  onForgotPassword?: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
  redirectUrl: string;
  isClerkActive: boolean;
}) {
  return (
    <AuthShell notice={SIGN_IN_NOTICE}>
      <AuthHeader
        title="Sign in"
        description="Open your reports, verifications, and tracked cases."
      />

      {errorMessage ? <AuthAlert tone="error">{errorMessage}</AuthAlert> : null}

      {onGoogleSignIn ? (
        <>
          <AuthOAuthButton
            loading={isGoogleLoading}
            disabled={isLoading}
            onClick={onGoogleSignIn}
          />
          <AuthDivider>or use your email</AuthDivider>
        </>
      ) : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          id="sign-in-identifier"
          label={isClerkActive ? "Email or username" : "Email address"}
          type="text"
          autoComplete="username"
          required
          placeholder="name@example.in"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={isLoading || isGoogleLoading}
        />

        {isClerkActive ? (
          <AuthField
            id="sign-in-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Your password"
            revealable
            value={password}
            onChange={(e) => setPassword?.(e.target.value)}
            disabled={isLoading || isGoogleLoading}
            action={
              onForgotPassword ? (
                <button
                  type="button"
                  className="auth-inline-action"
                  onClick={onForgotPassword}
                  disabled={isLoading || isGoogleLoading}
                >
                  Forgot password?
                </button>
              ) : undefined
            }
          />
        ) : null}

        <AuthSubmit
          loading={isLoading}
          loadingLabel={isClerkActive ? "Signing in…" : "Opening…"}
        >
          {isClerkActive ? "Sign in" : "Continue"}
        </AuthSubmit>
      </form>

      <div className="auth-footer">
        <span>New to JanSahayak?</span>
        <Link
          href={`/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
          className="auth-text-link"
        >
          Create a citizen account
        </Link>
      </div>
    </AuthShell>
  );
}

function SecondFactorView({
  strategy,
  code,
  setCode,
  onSubmit,
  onResend,
  onBack,
  isLoading,
  errorMessage,
}: {
  strategy: "email_code" | "phone_code" | "totp" | "backup_code";
  code: string;
  setCode: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => Promise<boolean>;
  onBack: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}) {
  const cooldown = useResendCooldown(30);
  const [resent, setResent] = React.useState(false);

  const isNumeric = strategy === "email_code" || strategy === "phone_code" || strategy === "totp";
  const canResend = strategy === "email_code" || strategy === "phone_code";

  const label =
    strategy === "email_code"
      ? "Email verification code"
      : strategy === "phone_code"
        ? "SMS verification code"
        : strategy === "totp"
          ? "Authenticator code"
          : "Backup code";

  const helper =
    strategy === "email_code"
      ? "We emailed a one-time code to the address on your account."
      : strategy === "phone_code"
        ? "We sent a one-time code to the phone number on your account."
        : strategy === "totp"
          ? "Enter the current code from your authenticator app."
          : "Enter one of the backup codes you saved when you turned on two-step verification.";

  const handleResend = async () => {
    setResent(false);
    const sent = await onResend();
    if (sent) {
      setResent(true);
      cooldown.restart();
    }
  };

  return (
    <AuthShell notice={MFA_NOTICE}>
      <AuthHeader title="Confirm it’s you" description={helper} />

      {errorMessage ? <AuthAlert tone="error">{errorMessage}</AuthAlert> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          id="sign-in-mfa-code"
          label={label}
          code={isNumeric}
          inputMode={isNumeric ? "numeric" : "text"}
          autoComplete="one-time-code"
          autoFocus
          maxLength={isNumeric ? 6 : undefined}
          required
          placeholder={isNumeric ? "123456" : "Backup code"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={isLoading}
        />

        <AuthSubmit loading={isLoading} loadingLabel="Verifying…">
          Verify and sign in
        </AuthSubmit>
      </form>

      {canResend ? (
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
      ) : (
        <div className="auth-footer">
          <span>Keep this code private.</span>
        </div>
      )}

      <button type="button" className="auth-text-button" onClick={onBack} disabled={isLoading}>
        Use a different account
      </button>
    </AuthShell>
  );
}

function ResetRequestView({
  email,
  setEmail,
  onSubmit,
  onCancel,
  isLoading,
  errorMessage,
}: {
  email: string;
  setEmail: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}) {
  return (
    <AuthShell notice={RESET_NOTICE}>
      <AuthHeader
        title="Reset your password"
        description="Enter the email on your account and we’ll send a six-digit code."
      />

      {errorMessage ? <AuthAlert tone="error">{errorMessage}</AuthAlert> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          id="reset-email"
          label="Email address"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="name@example.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />

        <AuthSubmit loading={isLoading} loadingLabel="Sending code…">
          Send reset code
        </AuthSubmit>
      </form>

      <div className="auth-footer">
        <span>Remembered it?</span>
        <button type="button" className="auth-link-button" onClick={onCancel} disabled={isLoading}>
          Back to sign in
        </button>
      </div>
    </AuthShell>
  );
}

function ResetCodeView({
  email,
  code,
  setCode,
  onSubmit,
  onResend,
  onEditEmail,
  onCancel,
  isLoading,
  errorMessage,
  infoMessage,
}: {
  email: string;
  code: string;
  setCode: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => Promise<boolean>;
  onEditEmail: () => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
  infoMessage?: string | null;
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
    <AuthShell notice={RESET_NOTICE}>
      <AuthHeader
        title="Enter the reset code"
        description={`We sent a six-digit code to ${email}.`}
      />

      {errorMessage ? <AuthAlert tone="error">{errorMessage}</AuthAlert> : null}
      {infoMessage && !errorMessage ? <AuthAlert tone="info">{infoMessage}</AuthAlert> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          id="reset-code"
          label="Reset code"
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

        <AuthSubmit loading={isLoading} loadingLabel="Checking code…">
          Continue
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
          onClick={onEditEmail}
          disabled={isLoading}
        >
          Use a different email
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="auth-link-button" onClick={onCancel} disabled={isLoading}>
          Back to sign in
        </button>
      </div>
    </AuthShell>
  );
}

function ResetPasswordView({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  onSubmit,
  onCancel,
  isLoading,
  errorMessage,
}: {
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}) {
  return (
    <AuthShell notice={RESET_NOTICE}>
      <AuthHeader
        title="Choose a new password"
        description="Use at least 8 characters. You’ll be signed in once it is set."
      />

      {errorMessage ? <AuthAlert tone="error">{errorMessage}</AuthAlert> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          placeholder="At least 8 characters"
          hint="Use a password you don’t use anywhere else."
          revealable
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />

        <AuthField
          id="reset-password-confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Repeat your new password"
          revealable
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
        />

        <AuthSubmit loading={isLoading} loadingLabel="Saving…">
          Save and sign in
        </AuthSubmit>
      </form>

      <div className="auth-footer">
        <button type="button" className="auth-link-button" onClick={onCancel} disabled={isLoading}>
          Cancel and return to sign in
        </button>
      </div>
    </AuthShell>
  );
}
