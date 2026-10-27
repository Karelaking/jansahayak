"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from "lucide-react";

import { GoogleIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";

type AuthFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  /** A small action aligned to the right of the label, such as "Forgot password?". */
  action?: React.ReactNode;
  hint?: React.ReactNode;
  /** Centered monospace treatment for one-time codes. */
  code?: boolean;
  /** Renders a show/hide control for password fields. */
  revealable?: boolean;
};

export function AuthField({
  id,
  label,
  action,
  hint,
  code = false,
  revealable = false,
  className,
  type = "text",
  ...inputProps
}: AuthFieldProps) {
  const [revealed, setRevealed] = React.useState(false);
  const inputType = revealable ? (revealed ? "text" : "password") : type;
  const inputClassName = [
    "auth-input",
    revealable ? "auth-input-actionable" : "",
    code ? "auth-input-code" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="auth-field">
      <div className="auth-field-head">
        <label htmlFor={id} className="auth-label">
          {label}
        </label>
        {action}
      </div>

      <div className="auth-input-wrap">
        <input id={id} type={inputType} className={inputClassName} {...inputProps} />
        {revealable ? (
          <button
            type="button"
            className="auth-reveal"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            disabled={inputProps.disabled}
          >
            {revealed ? (
              <EyeOff className="size-4.5" aria-hidden="true" />
            ) : (
              <Eye className="size-4.5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      {hint ? <p className="auth-hint">{hint}</p> : null}
    </div>
  );
}

export function AuthHeader({
  title,
  description,
  titleId = "auth-title",
}: {
  title: string;
  description?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <header className="auth-head">
      <h1 id={titleId}>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function AuthAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`auth-alert auth-alert-${tone}`}
    >
      <Icon className="auth-alert-icon" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function AuthSubmit({
  children,
  loading = false,
  loadingLabel = "Working…",
  className,
  disabled,
  ...buttonProps
}: React.ComponentProps<"button"> & {
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      type="submit"
      className={["auth-submit", className ?? ""].filter(Boolean).join(" ")}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...buttonProps}
    >
      {loading ? (
        <>
          <Spinner className="size-4" aria-hidden="true" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthOAuthButton({
  children = "Continue with Google",
  loading = false,
  disabled,
  onClick,
}: {
  children?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="auth-oauth"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <Spinner className="size-4.5" aria-hidden="true" />
      ) : (
        <GoogleIcon className="auth-oauth-icon" />
      )}
      <span>{children}</span>
    </button>
  );
}

export function AuthDivider({ children }: { children: React.ReactNode }) {
  return <div className="auth-divider">{children}</div>;
}

/**
 * Countdown for code-resend controls. Starts ticking immediately because these
 * views only mount after a code has already been sent.
 */
export function useResendCooldown(seconds = 30) {
  const [remaining, setRemaining] = React.useState(seconds);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const restart = React.useCallback(() => setRemaining(seconds), [seconds]);

  return { remaining, ready: remaining <= 0, restart };
}
